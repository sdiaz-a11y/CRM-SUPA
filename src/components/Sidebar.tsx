"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, LogOut, Library, Trash2, ShieldCheck, History, Menu, X, FileCheck2 } from "lucide-react";
import { useSesion } from "@/lib/session-context";
import { tienePermiso, type Accion, type Rol } from "@/lib/permisos";

// Item "Dashboard"/"Biblioteca"/"Eliminados" quedan solo para admin — el
// pedido original solo especificó "ver clientes y sus perfiles" para
// coordinador/abeja. Para abrirlos a otro rol, agrega el rol a su permiso
// en src/lib/permisos.ts (verDashboard/verBiblioteca/verEliminados).
const NAV: { href: string; label: string; icon: typeof LayoutDashboard; permiso: Accion }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, permiso: "verDashboard" },
  { href: "/clientes", label: "Clientes", icon: Users, permiso: "verClientes" },
  { href: "/solicitudes", label: "Solicitudes", icon: FileCheck2, permiso: "solicitarCliente" },
  { href: "/actividad", label: "Actividad", icon: History, permiso: "verActividad" },
  { href: "/biblioteca", label: "Biblioteca", icon: Library, permiso: "verBiblioteca" },
  { href: "/eliminados", label: "Eliminados", icon: Trash2, permiso: "verEliminados" },
  { href: "/usuarios", label: "Usuarios", icon: ShieldCheck, permiso: "gestionarUsuarios" },
];

const ROL_LABEL: Record<Rol, string> = {
  admin: "Administrador",
  coordinador: "Coordinador",
  abeja: "Abeja",
};

function Marca() {
  return (
    <div className="flex items-center gap-3 px-2">
      <Image src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" priority />
      <div>
        <p className="text-sm font-semibold text-foreground">CRM CS</p>
        <p className="text-xs text-muted">Club Sinergético</p>
      </div>
    </div>
  );
}

function CuentaFooter({ onCerrarSesion }: { onCerrarSesion: () => void }) {
  const { usuario } = useSesion();
  if (!usuario) return null;
  return (
    <div className="mt-auto rounded-xl bg-surface-2 px-3 py-3">
      <p className="text-xs text-muted">Conectado como</p>
      <p className="truncate text-sm font-medium text-foreground">{usuario.nombre}</p>
      <p className="text-xs text-muted">{ROL_LABEL[usuario.rol]}</p>
      <button
        onClick={onCerrarSesion}
        className="ease-spring mt-2 flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-danger"
      >
        <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
        Cerrar sesión
      </button>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { usuario, cerrarSesion } = useSesion();
  const [abierto, setAbierto] = useState(false);

  // Cierra el drawer solo con la navegación (no al abrirlo), para que un
  // clic en un link de menú no deje el drawer abierto detrás de la página
  // nueva.
  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

  if (!usuario) return null;
  const items = NAV.filter((item) => tienePermiso(usuario.rol, item.permiso));

  return (
    <>
      {/* Sidebar fijo — solo md+ (tablet/escritorio). */}
      <aside className="hidden h-screen w-64 flex-none flex-col border-r border-silver/70 bg-surface px-4 py-6 md:flex">
        <div className="mb-8">
          <Marca />
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const activo = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`ease-spring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  activo ? "bg-primary-dim text-primary-deep" : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                {label}
              </Link>
            );
          })}
        </nav>
        <CuentaFooter onCerrarSesion={cerrarSesion} />
      </aside>

      {/* Barra superior + drawer — solo debajo de md (celular/tablet chica).
          pt extra (además del safe-area del body) para que el logo y el
          botón de menú queden con aire de sobra debajo del notch/Dynamic
          Island, no pegados a él. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-silver/70 bg-surface px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:hidden">
        <button
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          className="ease-spring flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <Marca />
        <span className="w-9" aria-hidden="true" />
      </header>

      {abierto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAbierto(false)} aria-hidden="true" />
          <div className="animate-slide-in-left relative flex h-full w-72 max-w-[82%] flex-col bg-surface px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <Marca />
              <button
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                className="ease-spring flex h-9 w-9 flex-none items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1">
              {items.map(({ href, label, icon: Icon }) => {
                const activo = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`ease-spring flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                      activo ? "bg-primary-dim text-primary-deep" : "text-muted hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <CuentaFooter onCerrarSesion={cerrarSesion} />
          </div>
        </div>
      )}
    </>
  );
}
