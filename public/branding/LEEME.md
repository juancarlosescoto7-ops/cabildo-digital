# Identidad municipal

El símbolo actual es provisional y no representa el escudo oficial.
El fondo actual es un patrón geométrico provisional.

1. Copiá el logo oficial en esta carpeta, por ejemplo `logo-municipalidad.png`.
2. Copiá una fotografía del municipio, por ejemplo `fondo-talanga.jpg`.
3. En `src/lib/identidad.ts`, cambiá las rutas a:

```ts
logo: "/branding/logo-municipalidad.png",
fondo: "/branding/fondo-talanga.jpg",
```

No incluyás `public` en las rutas web. También podés reemplazar los SVG actuales
con tus propios SVG manteniendo sus nombres, sin cambiar la configuración.

Preferí un logo con fondo transparente (PNG o SVG) y una fotografía horizontal
(aproximadamente 1920 × 1080 px). El diseño aplica un degradado sobre la foto
para mantener la legibilidad. Reiniciá el servidor de desarrollo o generá una
nueva compilación después de sustituir archivos.
