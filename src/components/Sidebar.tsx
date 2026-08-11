"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Sparkles, LogOut, Library } from "lucide-react";
import { useAutor } from "@/lib/autor-context";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
];

export function Sidebar() {
  const pathname = usePathname();
  const { autor, cambiarAutor } = useAutor();

  return (
    <aside className="flex h-screen w-64 flex-none flex-col border-r border-silver/70 bg-surface px-4 py-6">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl brand-plate">
          <Sparkles className="h-5 w-5 text-white" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Synergy CRM</p>
          <p className="text-xs text-muted">Club Sinergético</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const activo = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`ease-spring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                activo
                  ? "bg-primary-dim text-primary-deep"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl bg-surface-2 px-3 py-3">
        <p className="text-xs text-muted">Conectado como</p>
        <p className="truncate text-sm font-medium text-foreground">{autor}</p>
        <button
          onClick={cambiarAutor}
          className="ease-spring mt-2 flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-danger"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
          Cambiar nombre
        </button>
      </div>
    </aside>
  );
}
