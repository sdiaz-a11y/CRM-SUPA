"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAutor } from "@/lib/autor-context";
import { PAISES_AMERICA } from "@/lib/paises-america";
import { ComboboxBuscador } from "./ComboboxBuscador";
import type { Cliente } from "@/lib/types";

const OPCIONES_PAIS = PAISES_AMERICA.map((p) => ({ valor: p.nombre, etiqueta: p.nombre, nota: p.lada }));
const OPCIONES_MEMBRESIA = ["3 Meses", "6 Meses", "12 Meses"].map((m) => ({ valor: m, etiqueta: m }));

export function NuevoClienteModal({
  onClose,
  onCreado,
}: {
  onClose: () => void;
  onCreado: (cliente: Cliente) => void;
}) {
  const { autor } = useAutor();
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    pais: "",
    evento: "",
    tipoMembresia: "",
    etiqueta: "",
  });
  const [eventos, setEventos] = useState<{ valor: string; etiqueta: string }[]>([]);
  const [etiquetas, setEtiquetas] = useState<{ valor: string; etiqueta: string }[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/biblioteca?tipo=evento")
      .then((r) => r.json())
      .then((data) => setEventos((data.opciones ?? []).map((v: string) => ({ valor: v, etiqueta: v }))))
      .catch(() => setEventos([]));
    fetch("/api/biblioteca?tipo=etiqueta")
      .then((r) => r.json())
      .then((data) => setEtiquetas((data.opciones ?? []).map((v: string) => ({ valor: v, etiqueta: v }))))
      .catch(() => setEtiquetas([]));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onCambiarPais(pais: string) {
    const lada = PAISES_AMERICA.find((p) => p.nombre === pais)?.lada ?? "";
    setForm((f) => ({
      ...f,
      pais,
      // Solo antepone la lada si el usuario todavía no había escrito nada,
      // para no pisarle un número que ya estaba tecleando.
      telefono: f.telefono.trim() ? f.telefono : lada ? `${lada} ` : f.telefono,
    }));
  }

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
    const avisos: string[] = [];
    if (data.avisoKajabi) avisos.push(`Kajabi: ${data.avisoKajabi}`);
    if (data.avisoSkool) avisos.push(`Skool: ${data.avisoSkool}`);
    if (data.avisoGhl) avisos.push(`GoHighLevel: ${data.avisoGhl}`);
    if (avisos.length) {
      window.alert(`Cliente creado, pero hubo problemas:\n\n${avisos.join("\n")}`);
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
            <Campo label="Nombre completo *">
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
            <div className="grid grid-cols-2 gap-2">
              <Campo label="País">
                <ComboboxBuscador
                  opciones={OPCIONES_PAIS}
                  valor={form.pais}
                  onChange={onCambiarPais}
                  placeholder="Seleccionar país…"
                />
              </Campo>
              <Campo label="Teléfono">
                <input
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  className="w-full rounded-lg border border-silver bg-surface-2 px-3 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
                />
              </Campo>
            </div>
            <Campo label="Evento">
              <ComboboxBuscador
                opciones={eventos}
                valor={form.evento}
                onChange={(evento) => setForm((f) => ({ ...f, evento }))}
                placeholder="Seleccionar evento…"
              />
            </Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Tipo de membresía">
                <ComboboxBuscador
                  opciones={OPCIONES_MEMBRESIA}
                  valor={form.tipoMembresia}
                  onChange={(tipoMembresia) => setForm((f) => ({ ...f, tipoMembresia }))}
                  placeholder="Seleccionar…"
                />
              </Campo>
              <Campo label="Etiqueta (opcional)">
                <ComboboxBuscador
                  opciones={etiquetas}
                  valor={form.etiqueta}
                  onChange={(etiqueta) => setForm((f) => ({ ...f, etiqueta }))}
                  placeholder="Seleccionar…"
                  etiquetaVacio="— Ninguna —"
                />
              </Campo>
            </div>
            <p className="text-xs text-muted">
              Al crear el cliente se le otorga automáticamente el acceso en Kajabi (oferta &quot;Club
              Sinergético&quot;, con correo de bienvenida), se le envía la invitación a la comunidad de
              Skool, y se le manda el mensaje de bienvenida por WhatsApp.
            </p>
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
