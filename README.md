# Cabildo Digital

Aplicación para el cabildo abierto de la Municipalidad de Talanga, Honduras.
Next.js 16, React 19, TypeScript, Tailwind CSS y Supabase. Esta etapa incluye
la configuración de preguntas, el acceso del administrador, la generación e
impresión de credenciales QR y el registro anónimo de votaciones.

## Dependencias y ejecución

Se recomienda Node.js 24 LTS. Supabase utiliza `@supabase/supabase-js` y
`@supabase/ssr`. La generación local de imágenes utiliza `qrcode` y sus tipos;
`jsqr` y `pngjs` se usan solo en pruebas para decodificar los PNG. Las nuevas
dependencias tienen versiones exactas y lockfile.

```powershell
npm.cmd ci
npm.cmd run dev
```

Abrir http://localhost:3000. En PowerShell se usa `.cmd` si la política de
scripts impide ejecutar `npm.ps1` o `npx.ps1`.

## Configurar Supabase

1. Crear o seleccionar el proyecto destinado exclusivamente al cabildo.
2. Copiar `.env.example` a `.env.local` y completar URL y clave **publishable**
   del proyecto. `.env.local` está ignorado por Git; el ejemplo no contiene
   credenciales. En este entorno ya se configuraron los valores suministrados.
3. La administración opera con la clave publicable y la sesión real del administrador.
   La Etapa 5 utiliza además `SUPABASE_SECRET_KEY`, exclusivamente en el servidor,
   para las funciones de lectura de papeletas y registro transaccional. Nunca
   agregar `NEXT_PUBLIC_` a esa clave, versionarla ni introducirla en el navegador.
4. Ejecutar **una sola vez** en SQL Editor, como propietario de la base:
   `supabase/migrations/20261017171448_cabildo_inicial.sql`.
   El script usa BEGIN/COMMIT y crea tablas, restricciones, políticas y funciones.
   Es una migración inicial versionada; no debe reaplicarse sobre tablas existentes.
   La CLI oficial generó el nombre del archivo. Para gestionarla mediante CLI,
   inicializar su configuración y vincular el proyecto con la CLI oficial antes
   de aplicar las migraciones; no combinar ambos métodos sin sincronizar el historial.
5. En Authentication, deshabilitar **Allow new users to sign up** y los accesos
   anónimos. Mantener correo/contraseña habilitado. No existe registro en la app.
   La consulta realizada en este entorno detectó que el registro público sigue
   habilitado en el proyecto indicado: este paso está pendiente.
6. Crear manualmente una única cuenta en Authentication > Users, asignarle correo
   y contraseña y confirmar su correo desde el panel. No guardar la contraseña
   en el código ni en archivos versionados.
7. Asignar el UUID de esa cuenta al evento desde SQL Editor:

```sql
-- Reemplazar el UUID por el de la cuenta real de Authentication > Users.
-- La FK rechazará UUIDs que no existan. No ejecutar sin reemplazar el valor.
update public.cabildo_configuracion
set administrador_id = 'UUID_REAL_DEL_ADMINISTRADOR'::uuid
where id = '00000000-0000-4000-8000-000000000001';
```

8. Mantener `public` entre los esquemas expuestos en Data API. **No exponer
   `cabildo_privado`**. La migración configura explícitamente los GRANT; no depende
   de los permisos predeterminados históricos de Supabase.
9. Reiniciar el servidor tras cambiar variables y abrir `/login`. No se envían
   contraseñas ni tokens al almacenamiento local del navegador: la autenticación
   se realiza en el servidor y persiste con cookies HttpOnly, SameSite=Lax y
   Secure en producción. Usar HTTPS en producción.

## Modelo y seguridad

- `cabildo_configuracion`: un solo evento, título, estado (`preparacion`, `abierta`,
  `cerrada`), UUID del administrador y versión de edición.
- `cabildo_preguntas`: UUID, FK al evento, texto y orden.
- `cabildo_opciones`: UUID, FK a la pregunta, texto, orden y votos inicializados a cero.
- Las FK borran preguntas y opciones en cascada. Restricciones únicas preservan
  el orden; una restricción diferida exige al menos dos opciones por pregunta.
- RLS está habilitado en las tres tablas. `anon` no tiene permisos; las cuentas
  autenticadas solo pueden leer las filas del administrador autorizado por UUID.
  No se usa `user_metadata` para autorizar. No hay políticas ni GRANT de DML
  directo para `authenticated`.
- Cada lectura administrativa y guardado verifica identidad con `getUser()` en
  el servidor y autorización contra el evento protegido por RLS.
- El único punto de escritura es `guardar_cabildo`. La función pública es
  SECURITY INVOKER; delega en una función privada SECURITY DEFINER con
  `search_path` vacío y permisos EXECUTE restringidos. Esta elevación acotada es
  necesaria para guardar sin conceder DML directo: antes de escribir vuelve a
  comprobar `auth.uid()`, el administrador asignado, el estado y la versión.
- La función bloquea la fila del evento (`FOR UPDATE`) durante la transacción.
  Si cambió la versión desde otra sesión, rechaza el guardado sin sobrescribirla.
  El estado solo puede cambiarse mediante herramientas administrativas confiables;
  la Etapa 5 añade controles administrativos de apertura y cierre definitivo.
- Guardar reemplaza preguntas y opciones en una sola transacción y aumenta la
  versión. Conserva los UUID de las preguntas y regenera los UUID de las opciones;
  esto es válido solo en preparación, sin credenciales ni votos en esta etapa.
  La UI y el servidor rechazan cambios cuando el evento está abierto o cerrado.
- Las sesiones no se almacenan en caché compartida: proxy renueva tokens y
  conserva cookies y cabeceras de no almacenamiento. No se comparte un cliente
  Supabase entre peticiones. No se usa `use cache` para información administrativa.
- Los límites son 100 preguntas, 2–20 opciones por pregunta, 2000 caracteres por
  pregunta y 500 por opción. Se validan en cliente, servidor y SQL.
- No se leen ni migran los datos anteriores de localStorage. Guardar una lista
  vacía permite eliminar definitivamente todas las preguntas.

## Verificaciones

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npm.cmd test
```

Las pruebas unitarias validan entradas vacías, tipos manipulados, límites e IDs.
Para comprobar las políticas, la transacción y el bloqueo por estado, ejecutar
`supabase/tests/verificar_cabildo.sql` en SQL Editor **después** de la configuración.
El script requiere una cuenta asignada y el evento en preparación. Simula los
roles `authenticated` y `anon`, verifica creación/edición/eliminación, validación,
conflictos de versión y denegaciones, y termina con ROLLBACK. Si falla antes del
final, ejecutar ROLLBACK antes de continuar. Ejecutar también los asesores de
seguridad del panel Supabase tras aplicar la migración.

Comprobar manualmente en navegador:

1. Sin sesión, `/admin` debe llevar a `/login`; una cuenta distinta debe ser rechazada.
2. Iniciar sesión con la cuenta autorizada; crear preguntas y opciones, editarlas,
   eliminar opciones conservando dos y guardar. Los vacíos deben bloquear el guardado.
3. Actualizar la página: los datos deben persistir.
4. Iniciar sesión con la misma cuenta en una ventana privada: debe recuperar los
   mismos datos. Guardar cambios allí y después intentar guardar desde la ventana
   antigua: debe mostrarse un conflicto y solicitar recarga.
5. Desde SQL Editor, cambiar el estado a `abierta`, recargar y verificar que la UI
   esté bloqueada. Un guardado iniciado desde una pestaña anterior también debe
   ser rechazado por la base. Restaurar `preparacion` al terminar las pruebas.
6. Cerrar sesión y volver a `/admin`: debe solicitar acceso.

## Etapa 4: credenciales QR e impresión

1. Aplicar únicamente la nueva migración
   `supabase/migrations/20261017212344_cabildo_credenciales.sql` en SQL Editor,
   después de la migración inicial. No vuelve a crear ni cambia las tablas o
   políticas anteriores. Crea `cabildo_credenciales` y sus funciones de acceso.
2. Configurar `CABILDO_URL_BASE` en `.env.local`. En este entorno se dejó
   `http://localhost:3000`, exclusivamente para pruebas. Para tarjetas definitivas,
   usar el origen HTTPS público exacto, sin rutas ni parámetros, por ejemplo
   `https://cabildo.example`. Reiniciar el servidor después de cambiarlo.
3. Entrar a `/admin`, seguir «Ir a códigos QR» y comprobar los contadores.
   Cada generación acepta entre 1 y 100 tarjetas. El servidor verifica `getUser()`
   y la cuenta asignada; la función SQL vuelve a verificar UUID y preparación
   bajo un bloqueo de la fila del evento.
4. Leer y marcar la confirmación de impresión. Los tokens se generan con
   `randomBytes(32)` y se codifican como 43 caracteres base64url. La URL que
   contiene cada imagen es `CABILDO_URL_BASE/votar/TOKEN`. El servidor calcula
   SHA-256 y envía **solamente los hashes** a Supabase en un único INSERT atómico.
   La respuesta administrativa contiene imágenes PNG con los tokens codificados;
   no contiene una lista de hashes y no se almacena en localStorage, sessionStorage
   ni en caché del servidor. La biblioteca genera las imágenes localmente, sin
   llamar a servicios externos de QR.
5. Imprimir o guardar como PDF antes de cerrar, actualizar o abandonar la vista.
   Las imágenes permanecen únicamente en el estado en memoria de ese componente.
   «Cerrar lote» pide confirmación antes de descartarlas. No existe recuperación
   de tokens desde la base de datos ni reimpresión posterior de lotes cerrados.
   Una respuesta perdida después de confirmar el INSERT también puede dejar
   credenciales registradas sin tarjetas recuperables: actualizar contadores
   antes de repetir la generación. No se promete que un error de red signifique
   que el lote no se haya creado.
6. La impresión muestra 12 tarjetas por hoja A4 (3 columnas por 4 filas), con
   tarjetas de 60 × 65 mm y QR de 42 mm, margen de página de 10 mm y separación
   de 3 mm. Usar escala 100 %, papel A4 y quitar encabezados y pies del navegador.
   Se ocultan la administración de preguntas, formularios y botones. Los números
   visibles sirven para ordenar tarjetas; nunca son los tokens de autorización.
   No entregar copias duplicadas de una misma tarjeta.
7. Los QR locales muestran «PRUEBA LOCAL · NO DISTRIBUIR». Desde un teléfono,
   localhost apunta al propio teléfono, por lo que esas tarjetas no sirven para
   los asistentes. No imprimir tarjetas definitivas antes de fijar el dominio
   público HTTPS. Un cambio posterior de dominio invalida el destino impreso.

`cabildo_credenciales` incluye UUID, FK al evento, hash único de 64 caracteres
hexadecimales, `usado=false`, `usado_en=NULL` y fecha de creación. La restricción de
uso exige consistencia entre el booleano y su fecha. El índice `(evento_id, usado)`
permite obtener el total, las disponibles y las utilizadas en una sola consulta.
RLS permite SELECT únicamente al administrador autorizado; se revocan permisos
anónimos y toda modificación directa desde `authenticated`. La RPC pública
SECURITY INVOKER delega en una función privada con autorización explícita. No hay
función para consumir, modificar o eliminar credenciales en esta etapa.

`/votar/[codigo]` es pública. En la Etapa 5 consulta el estado y muestra el formulario
solo con una credencial disponible y la consulta abierta. No exige sesión y abrir,
actualizar o escanear nunca cambia `usado`; solo un envío válido puede consumirlo. La página
envía `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex, nofollow, noarchive`.
Se excluyen `/votar/*` del log de peticiones de desarrollo y se desactiva el log
de argumentos de Server Functions. Al preparar el hosting, excluir o enmascarar
también esas URL en logs de acceso, monitoreo y analítica externos: los tokens
viajan en la ruta por diseño. No registrar cuerpos de respuestas administrativas.

Pruebas adicionales:

- `npm.cmd test` incluye 100 tokens únicos, longitud de 32 bytes, cálculo del
  hash, límites, validación de URL y decodificación independiente de los 100 PNG.
- Después de aplicar la nueva migración, ejecutar **completo**
  `supabase/tests/verificar_credenciales.sql` como postgres en SQL Editor. Comprueba
  hashes, valores iniciales, contadores, rollback de un lote con colisión UNIQUE,
  lotes inválidos, RLS, bloqueo anónimo y rechazo en abierta/cerrada. Termina con
  ROLLBACK y no deja credenciales de prueba. Si se interrumpe, ejecutar ROLLBACK.
- Con el administrador, generar 13 tarjetas y comprobar el aumento de 13 en total
  y disponibles, sin cambios en utilizadas. Escanear una tarjeta desde un teléfono
  con el dominio público: debe aparecer el mensaje de votación no habilitada.
  Actualizar los contadores y comprobar que siguen iguales.
- Guardar PDF A4: deben salir dos hojas (12 tarjetas y 1), sin botones ni preguntas.
  Confirmar también una lectura física desde el papel con el teléfono previsto.
- Cerrar el lote, comprobar que las imágenes desaparecen y que los contadores
  permanecen. Repetir acceso sin sesión y con otra cuenta: no deben poder generar.
- Cambiar temporalmente estado a abierta/cerrada en SQL Editor y comprobar el
  rechazo, incluso desde una pestaña abierta previamente. Restaurar preparación
  únicamente si todavía se está configurando el evento.

## Estado de la configuración y verificaciones

La URL y clave publicable suministradas permiten consultar Auth (HTTP 200).
La migración inicial y sus pruebas SQL fueron ejecutadas correctamente por el
usuario durante la Etapa 3. ESLint, TypeScript, compilación y las nueve pruebas
automáticas de las etapas 2–4 pasaron.
Las comprobaciones HTTP locales confirmaron que `/admin` sin sesión exige acceso
y no entrega preguntas, que la acción de guardado rechaza una llamada directa
sin sesión y que el acceso valida entradas vacías desde el servidor.
La ruta pública respondió sin sesión y las acciones QR rechazaron llamadas
directas sin autorización. Se verificó el componente de impresión con un lote
sintético de 13 tarjetas: Edge generó dos hojas A4, ocultó controles y preguntas,
y respetó los tamaños de tarjeta/QR. La vista también se comprobó a 375 px.
El proyecto sigue sin aparecer entre los autorizados por la conexión MCP
administrativa disponible. **La migración nueva de credenciales está preparada,
pero no aplicada por este agente**. Queda pendiente ejecutar su SQL, los tests de
base y el flujo autenticado de generación en el proyecto real. No se crearon
credenciales reales durante las pruebas locales.

`npm audit` detectó cinco alertas altas en la cadena de dependencias de desarrollo
`eslint-config-next` → `fast-glob` → `micromatch` → `braces`. No son dependencias
Supabase. No se aplicó `audit fix --force`, que propone una versión incompatible
de eslint-config-next. Debe revisarse una actualización compatible del tooling.

La Etapa 5 incorpora formulario ciudadano y consumo transaccional de QR.
La Etapa 6 incorpora resultados públicos con barras CSS y consultas periódicas.
No se implementaron WebSockets, Realtime ni despliegue.

## Documentación consultada

- https://supabase.com/changelog
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/functions
- https://github.com/soldair/node-qrcode
- https://nodejs.org/api/crypto.html
- Guías locales de Next.js en `node_modules/next/dist/docs/`.

## Etapa 5: apertura, formulario y voto único

Aplicar, después de las dos migraciones anteriores:

`supabase/migrations/20261017215744_cabildo_votacion.sql`

La migración no borra registros ni cambia el estado del cabildo. Mantiene las
cuatro tablas existentes y RLS; no crea tablas de respuestas ni historiales de
selecciones. Agrega funciones y un trigger de transición. Desde esta etapa solo
se permiten `preparacion -> abierta -> cerrada`; el cierre es definitivo, incluso
si se intenta volver atrás mediante un UPDATE normal. No usar instrucciones de
etapas anteriores que sugieran restaurar preparación después de abrir.

Configurar `SUPABASE_SECRET_KEY` en `.env.local` y reiniciar el servidor. Es la
clave secreta del proyecto, sin prefijo NEXT_PUBLIC_. En este entorno se guardó
la suministrada por el usuario. Debe rotarse después de haber sido compartida en
el chat y actualizarse localmente; no imprimir su valor en logs o respuestas.
El cliente de votación tiene `server-only`, no usa cookies ni persistencia de
sesión y todas sus consultas tienen `cache: no-store`.

En `/admin`, «Abrir consulta» comprueba en PostgreSQL que existan preguntas y
opciones válidas y credenciales generadas. Guardar antes los cambios del editor y
los PDF de QR. Tras abrir, se bloquean preguntas y nuevos QR. «Cerrar consulta»
finaliza la consulta. Solo el administrador asignado puede ejecutar estas
transiciones; no hay programación ni flujos de aprobación adicionales.

El servidor valida el token base64url canónico de 32 bytes y calcula exactamente
el SHA-256 utilizado al crear el QR. `leer_papeleta` consulta credencial y evento
sin modificar filas, y devuelve preguntas/opciones ordenadas sin contadores de
votos. La página distingue credencial inválida, utilizada, preparación, consulta
cerrada y formulario disponible. No se solicita autenticación ni datos personales.
El formulario usa un grupo de radios por pregunta y exige todas las respuestas.

`registrar_votacion` es SECURITY INVOKER, con EXECUTE revocado de PUBLIC, anon y
authenticated y concedido solamente a service_role. Se invoca desde una Server
Action de Next.js, nunca desde un cliente Supabase del navegador. Los permisos
de ese rol sobre las cuatro tablas se acotan explícitamente a SELECT y a las
columnas necesarias para bloquear filas e incrementar votos y marcar uso. Las
políticas administrativas existentes permanecen habilitadas.

En una sola transacción la función:

1. Obtiene un bloqueo SHARE del evento y comprueba que esté abierto. El cierre
   administrativo espera a los votos en curso y los envíos posteriores ven cerrada.
2. Bloquea la credencial con FOR UPDATE y comprueba que no se haya utilizado.
3. Valida exactamente una respuesta por pregunta, sin duplicados, ajenas ni
   opciones que pertenezcan a otra pregunta.
4. Bloquea las opciones en un orden fijo por UUID, para evitar deadlocks entre
   envíos con JSON ordenado de forma distinta.
5. Ejecuta `votos = votos + 1` para las opciones elegidas y marca usado/fecha.

Cualquier error revierte todos los cambios. Dos solicitudes con el mismo QR se
serializan; solo la primera puede registrar. Diferentes QR pueden votar en paralelo
sin perder incrementos. Si la respuesta se pierde después del commit, repetir con
el mismo QR devuelve «utilizada» y nunca suma otra vez. El formulario conserva las
selecciones en memoria durante un error de red, y muestra mensajes sin afirmar un
fracaso que podría haberse confirmado en la base. No se guardan votos en localStorage.

No se almacena el conjunto de respuestas asociado al token. La base solo conserva
contadores agregados y la fecha/estado de uso de cada credencial. No se agregaron
IP, identidad, teléfono, correo, analítica ni mecanismos de seguimiento. Mantener
los logs de hosting y herramientas externas sin URL completas de QR ni cuerpos
de solicitudes/respuestas de votación. Los mensajes de error SQL no incluyen las
respuestas ni los tokens, y los logs de peticiones/Server Functions siguen filtrados.

### Pruebas de esta etapa

Se ejecutaron 25 pruebas automatizadas, incluidas las migraciones reales sobre un
PostgreSQL 17 temporal separado de Supabase, con roles equivalentes y un esquema
Auth mínimo para las políticas. Pasaron los casos de formato, respuestas incompletas,
opciones ajenas, duplicados, token inexistente, repetición, concurrencia del mismo QR,
concurrencia de QR distintos, overflow con rollback completo, bloqueo de edición,
permisos y cierre definitivo. También se comprobó que el cierre espera un voto en curso.

El flujo móvil se probó a 375 px en Edge con el código real de Next.js y PostgreSQL
local mediante un adaptador HTTP de pruebas. Pasaron apertura sin consumo, recarga
sin consumo, validación de campos, envío, incremento de dos contadores, uso del QR
y rechazo después de recargar. No hubo errores de consola ni claves de base enviadas
desde el navegador. Ese adaptador fue temporal y no forma parte de la aplicación.

Para repetir las pruebas de PostgreSQL, usar exclusivamente una base **vacía y
local** cuyo nombre comience por `cabildo_test_`, con un usuario de pruebas que
pueda crear roles con BYPASSRLS. No usar Supabase, producción ni un evento real:

```powershell
# Crear previamente una base nueva y vacía en PostgreSQL local.
$env:CABILDO_TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:5432/cabildo_test_revision'
npm.cmd test
Remove-Item Env:CABILDO_TEST_DATABASE_URL
```

El arnés rechaza hosts remotos, nombres no destinados a pruebas y bases con tablas.
Aplica las tres migraciones, crea únicamente datos sintéticos y ejecuta conexiones
simultáneas con bloqueos controlados. Deja esa base de pruebas poblada: para repetir,
usar otra base nueva y vacía. Sin esta variable, `npm test` ejecuta los tests unitarios
y declara omitido el bloque de integración. `pg` es dependencia solo de desarrollo.
PostgreSQL portátil se descargó únicamente a una carpeta temporal para esta ejecución;
no se instaló un servicio del sistema ni se añadió a las dependencias del producto.

En Supabase real, la comprobación privada devolvió PGRST202: `leer_papeleta` todavía
no existe. **La migración de Etapa 5 está preparada y validada localmente, pero no
se aplicó remotamente.** No se registraron votos ni se abrió/cerró el evento real.
Después de aplicarla, ejecutar los asesores de seguridad y verificar la conexión.
Probar una votación real solo en un evento/proyecto de prueba destinado a ello,
porque el cierre es definitivo y no se deben borrar respuestas o reiniciar el
cabildo real para verificar la aplicación.

## Etapa 6: resultados públicos

Abrir `/resultados`, desde el enlace de la página principal o desde el enlace del
administrador (nueva pestaña). No requiere sesión. La pantalla muestra el título,
estado, participaciones registradas y todas las preguntas/opciones ordenadas,
con votos, porcentajes de un decimal y barras CSS. Está diseñada para móvil y
proyección a 1920 × 1080, con contraste alto y tipografía grande.

Cada pregunta utiliza su propio total como denominador. Sin votos muestra 0.0 %.
Los contadores originales no se redondean. Las participaciones se obtienen contando
credenciales con `usado=true`, no sumando las respuestas de todas las preguntas.
En preparación se indica que la consulta todavía no comenzó y las barras son
neutras. Abierta muestra resultados en curso; cerrada identifica resultados finales.
No hay controles para editar datos desde esta pantalla.

`GET /api/resultados` consulta Supabase exclusivamente desde el servidor, reutilizando
el cliente privado existente. Una sola consulta PostgREST recupera título, estado,
preguntas/opciones/contadores y un conteo agregado de credenciales utilizadas.
No selecciona hashes, tokens, administradores ni registros individuales de uso.
Una transformación explícita devuelve únicamente campos públicos; no se propagan
objetos originales de la base. POST, PUT, PATCH y DELETE responden 405.

No se agregó ninguna migración, tabla, política ni permiso público. Se utilizan
los permisos SELECT de service_role ya configurados. La clave secreta permanece
en `.env.local` y en código marcado `server-only`, sin llegar al navegador.

La pantalla consulta al entrar y programa la siguiente consulta 3 segundos después
de terminar la anterior. No hay solicitudes solapadas. La consulta Supabase tiene
un límite de 8 segundos y el cliente de 10 segundos, con cancelación al desmontar.
La API, el CDN y el fetch del navegador usan `no-store`; no hay caché compartida
ni revalidación manual. No se utiliza Supabase Realtime ni WebSockets.

Si falla una consulta, la API devuelve 503 con un mensaje público sin detalles
internos. La pantalla conserva el último conjunto de resultados, advierte que
puede estar desactualizado y reintenta automáticamente. Cuando se recupera la
conexión, actualiza las cantidades y barras y retira el aviso. Los cambios de
estado también se detectan sin recargar la página.

Verificación de esta etapa:

- Lectura real: la API pública coincidió con la consulta agregada de Supabase.
  Se verificó `Cache-Control: no-store` y el rechazo de métodos de escritura.
- 32 pruebas automatizadas pasaron con PostgreSQL 17 temporal, incluidas orden,
  denominadores separados, porcentajes, cero, filtrado de campos privados,
  errores públicos, incremento por voto y ausencia de cambios ante un duplicado.
- Edge a 1920 × 1080 y 375 px: estados preparación/abierta/cerrada, actualizaciones
  sin recarga, barras proporcionales, error/reconexión y consulta lenta sin solaparse.
  Los cambios de estado y las interrupciones se simularon interceptando respuestas
  en el navegador; no se abrió, cerró ni alteró el cabildo real.
- ESLint, TypeScript y compilación de producción se verifican con los comandos
  habituales del proyecto. La integración PostgreSQL requiere una base local
  vacía con la variable de pruebas documentada en la Etapa 5.

Esta etapa reutiliza la configuración existente de Supabase y no instala nuevas
bibliotecas del producto o gráficos. No necesita aplicar SQL adicional. No se
modificaron votos reales ni se desplegó la aplicación.
#   c a b i l d o - d i g i t a l  
 #   c a b i l d o - d i g i t a l  
 #   c a b i l d o - d i g i t a l  
 #   c a b i l d o - d i g i t a l  
 #   c a b i l d o - d i g i t a l  
 #   c a b i l d o - d i g i t a l  
 #   c a b i l d o - d i g i t a l  
 