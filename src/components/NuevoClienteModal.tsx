"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAutor } from "@/lib/autor-context";
import type { Cliente } from "@/lib/types";

export function NuevoClienteModal({
  onClose,
  onCreado,
}: {
  onClose: () => void;
  onCreado: (cliente: Cliente) => void;
}) {
  const { autor } = useAutor();
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "", pais: "", ciudad: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function crear() {
    if (!autor) return;
    setGuardando(true);
    setError(null);
    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, autor }),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo crear el cliente");
      return;
    }
    if (data.avisoKajabi) {
      window.alert(`Cliente creado, pero falló el alta en Kajabi: ${data.avisoKajabi}`);
    }
    onCreado(data.cliente);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 p-6 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="shell w-full max-w-md rounded-[2rem] p-2 diffused-lg animate-fade-in">
        <div className="core rounded-[calc(2rem-0.5rem)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Nuevo cliente</h2>
            <button
              onClick={onClose}
              className="ease-spring rounded-full p-1.5 text-muted transition hover:bg-surface-2"
            >
              <X className="h-4.5 w-4.5" strokeWidth={1.75} />
            </button>
          </div>

          <div className="space-y-3">
            <Campo label="Nombre *">
              <input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                className="w-full rounded-lg border border-silver bg-surface-2 px-3 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
              />
            </Campo>
            <Campo label="Correo *">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-silver bg-surface-2 px-3 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
              />
            </Campo>
            <Campo label="Teléfono">
              <input
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                className="w-full rounded-lg border border-silver bg-surface-2 px-3 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
              />
            </Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="País">
                <input
                  value={form.pais}
                  onChange={(e) => setForm((f) => ({ ...f, pais: e.target.value }))}
                  className="w-full rounded-lg border border-silver bg-surface-2 px-3 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
                />
              </Campo>
              <Campo label="Ciudad">
                <input
                  value={form.ciudad}
                  onChange={(e) => setForm((f) => ({ ...f, ciudad: e.target.value }))}
                  className="w-full rounded-lg border border-silver bg-surface-2 px-3 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
                />
              </Campo>
            </div>
          </div>

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}

          <button
            onClick={crear}
            disabled={guardando || !form.nombre.trim() || !form.email.trim()}
            className="ease-spring mt-5 w-full rounded-xl brand-plate px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-40"
          >
            {guardando ? "Creando…" : "Crear cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
