"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ComboboxBuscador } from "./ComboboxBuscador";
import type { OtraOfertaCliente } from "@/lib/types";

// Alta de una sola persona en "Otras Ofertas" — para cuando no vale la pena
// armar un CSV por un solo caso. Pega al mismo endpoint que el importador
// (/api/otras-ofertas/importar), que ya es upsert-por-correo: si la persona
// ya existía en este roster, esto simplemente le agrega una oferta más
// fechada, sin duplicar el registro.
export function NuevaOtraOfertaModal({
  onClose,
  onCreado,
}: {
  onClose: () => void;
  onCreado: (cliente: OtraOfertaCliente) => void;
}) {
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    ofertaId: "",
    etiqueta: "",
  });
  const [ofertas, setOfertas] = useState<{ valor: string; etiqueta: string }[]>([]);
  const [etiquetas, setEtiquetas] = useState<{ valor: string; etiqueta: string }[]>([]);
  const [tagsCatalogo, setTagsCatalogo] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/kajabi/ofertas")
      .then((r) => r.json())
      .then((data) => {
        const opciones: { id: string; titulo: string }[] = data.ofertas ?? [];
        setOfertas(opciones.map((o) => ({ valor: o.id, etiqueta: o.titulo })));
      })
      .catch(() => setOfertas([]));
    fetch("/api/biblioteca?tipo=etiqueta")
      .then((r) => r.json())
      .then((data) => setEtiquetas((data.opciones ?? []).map((v: string) => ({ valor: v, etiqueta: v }))))
      .catch(() => setEtiquetas([]));
    fetch("/api/biblioteca?tipo=tag")
      .then((r) => r.json())
      .then((data) => setTagsCatalogo(data.opciones ?? []))
      .catch(() => setTagsCatalogo([]));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function alternarTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function crear() {
    if (!form.ofertaId) return;
    const ofertaTitulo = ofertas.find((o) => o.valor === form.ofertaId)?.etiqueta ?? form.ofertaId;
    setGuardando(true);
    setError(null);
    const res = await fetch("/api/otras-ofertas/importar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: form.nombre,
        email: form.email,
        telefono: form.telefono || undefined,
        ofertaId: form.ofertaId,
        ofertaTitulo,
        etiqueta: form.etiqueta || undefined,
        tags: tags.length ? tags : undefined,
      }),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo crear el registro");
      return;
    }
    if (data.avisoKajabi) {
      window.alert(`Se guardó el registro, pero no se pudo otorgar la oferta en Kajabi: ${data.avisoKajabi}`);
    }
    onCreado(data.cliente);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-foreground/30 p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="shell w-full max-w-md rounded-[2rem] p-2 diffused-lg animate-fade-in">
        <div className="core rounded-[calc(2rem-0.5rem)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Nuevo registro en Otras Ofertas</h2>
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
            <Campo label="Teléfono">
              <input
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                className="w-full rounded-lg border border-silver bg-surface-2 px-3 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
              />
            </Campo>
            <Campo label="Oferta a otorgar *">
              <ComboboxBuscador
                opciones={ofertas}
                valor={form.ofertaId}
                onChange={(ofertaId) => setForm((f) => ({ ...f, ofertaId }))}
                placeholder="Seleccionar oferta de Kajabi…"
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
            {tagsCatalogo.length > 0 && (
              <div>
                <span className="mb-1 block text-xs font-medium text-muted">Tags (opcional)</span>
                <div className="flex flex-wrap gap-1.5">
                  {tagsCatalogo.map((tag) => {
                    const activo = tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => alternarTag(tag)}
                        className={`ease-spring rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                          activo
                            ? "border-primary bg-primary-dim text-primary-deep"
                            : "border-silver bg-surface text-muted hover:bg-surface-2"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="text-xs text-muted">
              Se suscribe al contacto a marketing en Kajabi y se le otorga la oferta elegida (vigente 1 año). No se
              le manda invitación a Skool ni mensaje de bienvenida por WhatsApp — eso solo aplica al Club
              Sinergético.
            </p>
          </div>

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}

          <button
            onClick={crear}
            disabled={guardando || !form.nombre.trim() || !form.email.trim() || !form.ofertaId}
            className="ease-spring mt-5 w-full rounded-xl brand-plate px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-40"
          >
            {guardando ? "Creando…" : "Otorgar oferta"}
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
