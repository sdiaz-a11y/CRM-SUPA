"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { Cliente } from "@/lib/types";
import { ClientePanel } from "@/components/ClientePanel";

export default function EliminadosPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    const controlador = new AbortController();
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (busqueda.trim()) params.set("q", busqueda.trim());
      fetch(`/api/eliminados?${params}`, { signal: controlador.signal })
        .then((r) => r.json())
        .then((data) => {
          setClientes(data.clientes ?? []);
          setCargando(false);
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timeout);
      controlador.abort();
    };
  }, [busqueda]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Eliminados</h1>
        <p className="text-sm text-muted">
          Clientes archivados desde el CRM. Su historial se conserva completo.
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o correo…"
          className="w-full max-w-md rounded-xl border border-silver bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
        />
      </div>

      <div className="shell flex h-[calc(100vh-14rem)] flex-col rounded-[1.75rem] p-2 diffused">
        <div className="core flex flex-1 flex-col overflow-hidden rounded-[calc(1.75rem-0.5rem)]">
          {cargando ? (
            <p className="p-8 text-center text-sm text-muted">Cargando…</p>
          ) : clientes.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">No hay clientes eliminados.</p>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full min-w-[600px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[38%]" />
                  <col className="w-[32%]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-surface">
                  <tr className="border-b border-silver text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    <th className="whitespace-nowrap px-5 py-3">Nombre</th>
                    <th className="whitespace-nowrap px-5 py-3">Correo</th>
                    <th className="whitespace-nowrap px-5 py-3">Eliminado</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSeleccionado(c.id)}
                      onKeyDown={(e) => e.key === "Enter" && setSeleccionado(c.id)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Ver perfil de ${c.nombre}`}
                      className="ease-spring cursor-pointer border-b border-silver/60 outline-none transition last:border-0 hover:bg-surface-2 focus-visible:bg-primary-dim"
                    >
                      <td className="truncate px-5 py-2.5 font-medium text-foreground" title={c.nombre}>
                        {c.nombre}
                      </td>
                      <td className="truncate px-5 py-2.5 text-muted" title={c.email}>
                        {c.email}
                      </td>
                      <td className="truncate px-5 py-2.5 text-muted">
                        {c.eliminadoEn
                          ? new Date(c.eliminadoEn).toLocaleString("es-MX", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {seleccionado && (
        <ClientePanel
          clienteId={seleccionado}
          onClose={() => setSeleccionado(null)}
          onClienteActualizado={() => {}}
        />
      )}
    </div>
  );
}
