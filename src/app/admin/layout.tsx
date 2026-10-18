import PanelShell from "@/components/panel-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PanelShell seccion="administracion">{children}</PanelShell>;
}
