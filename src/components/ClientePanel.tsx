"use client";

import { useEffect, useState } from "react";
import {
  X,
  Pencil,
  Save,
  XCircle,
  Send,
  Headset,
  CalendarClock,
  PartyPopper,
  Ticket,
  MessagesSquare,
  PhoneCall,
  Copy,
  Check,
  MessageCircle,
  Phone,
  CalendarDays,
  ShieldCheck,
  Crown,
  Gem,
  User,
  LayoutGrid,
  ClipboardList,
  StickyNote,
  Activity,
  Tags,
  RefreshCw,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import type { Accesos, Cliente, EventoTimeline } from "@/lib/types";
import { useAutor } from "@/lib/autor-context";
import { AccesosSynergy } from "./AccesosSynergy";
import { Timeline } from "./Timeline";

type Tab = "resumen" | "accesos" | "seguimiento" | "notas" | "actividad";

const TABS: { key: Tab; label: string; icon: typeof User }[] = [
  { key: "resumen", label: "Resumen", icon: LayoutGrid },
  { key: "accesos", label: "Accesos", icon: ShieldCheck },
  { key: "seguimiento", label: "Seguimiento", icon: ClipboardList },
  { key: "notas", label: "Notas", icon: StickyNote },
  { key: "actividad", label: "Actividad", icon: Activity },
];

type Form = {
  nombre: string;
  telefono: string;
  pais: string;
  ciudad: string;
  notas: string;
  evento: string;
  fechaEvento: string;
  accesoPlataforma: string;
  tipoMembresia: string;
  vencimientoSkool: string;
  invitacionSkool: string;
  contactoWhats: string;
  llamada: string;
  notasSoporte: string;
  finAcceso: string;
};

function isoAFechaInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function formDeCliente(c: Cliente | null): Form {
  return {
    nombre: c?.nombre ?? "",
    telefono: c?.telefono ?? "",
    pais: c?.pais ?? "",
    ciudad: c?.ciudad ?? "",
    notas: c?.notas ?? "",
    evento: c?.evento ?? "",
    fechaEvento: c?.fechaEvento ?? "",
    accesoPlataforma: c?.accesoPlataforma ?? "",
    tipoMembresia: c?.tipoMembresia ?? "",
    vencimientoSkool: c?.vencimientoSkool ?? "",
    invitacionSkool: c?.invitacionSkool ?? "",
    contactoWhats: c?.contactoWhats ?? "",
    llamada: c?.llamada ?? "",
    notasSoporte: c?.notasSoporte ?? "",
    finAcceso: isoAFechaInput(c?.finAcceso ?? null),
  };
}

type EstadoKajabi = "cargando" | "activa" | "revocada" | "sin_contacto" | "error";

export function ClientePanel({
  clienteId,
  onClose,
  onClienteActualizado,
  onClienteEliminado,
}: {
  clienteId: string;
  onClose: () => void;
  onClienteActualizado: (cliente: Cliente) => void;
  onClienteEliminado?: (id: string) => void;
}) {
  const { autor } = useAutor();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [eventos, setEventos] = useState<EventoTimeline[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState<Tab>("resumen");
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Form>(formDeCliente(null));
  const [guardando, setGuardando] = useState(false);
  const [accesoPendiente, setAccesoPendiente] = useState<keyof Accesos | null>(null);
  const [nota, setNota] = useState("");
  const [enviandoNota, setEnviandoNota] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<"email" | "telefono" | null>(null);
  const [tagsCatalogo, setTagsCatalogo] = useState<string[]>([]);
  const [guardandoTag, setGuardandoTag] = useState<string | null>(null);
  const [estadoKajabi, setEstadoKajabi] = useState<EstadoKajabi>("cargando");
  const [pasoRenovar, setPasoRenovar] = useState<0 | 1 | 2>(0);
  const [renovando, setRenovando] = useState(false);
  const [pasoEliminar, setPasoEliminar] = useState<0 | 1 | 2>(0);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    fetch("/api/biblioteca?tipo=tag")
      .then((r) => r.json())
      .then((data) => setTagsCatalogo(data.opciones ?? []))
      .catch(() => setTagsCatalogo([]));
  }, []);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setTab("resumen");
    setEstadoKajabi("cargando");
    setPasoRenovar(0);
    setPasoEliminar(0);
    Promise.all([
      fetch(`/api/clientes/${encodeURIComponent(clienteId)}`).then((r) => r.json()),
      fetch(`/api/clientes/${encodeURIComponent(clienteId)}/eventos`).then((r) => r.json()),
    ]).then(([clienteRes, eventosRes]) => {
      if (cancelado) return;
      setCliente(clienteRes.cliente);
      setEventos(eventosRes.eventos ?? []);
      setForm(formDeCliente(clienteRes.cliente));
      setCargando(false);
    });
    fetch(`/api/clientes/${encodeURIComponent(clienteId)}/kajabi-estado`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelado) setEstadoKajabi(data.estado ?? "error");
      })
      .catch(() => {
        if (!cancelado) setEstadoKajabi("error");
      });
    return () => {
      cancelado = true;
    };
  }, [clienteId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function guardar() {
    if (!cliente || !autor) return;
    setGuardando(true);
    setError(null);
    const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "datos", ...form, autor }),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudieron guardar los cambios");
      return;
    }
    setCliente(data.cliente);
    onClienteActualizado(data.cliente);
    setEditando(false);
    const eventosRes = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}/eventos`).then((r) =>
      r.json()
    );
    setEventos(eventosRes.eventos ?? []);
  }

  function cancelarEdicion() {
    setEditando(false);
    setForm(formDeCliente(cliente));
  }

  async function toggleAcceso(nivel: keyof Accesos, activo: boolean) {
    if (!cliente || !autor) return;
    setAccesoPendiente(nivel);
    setError(null);
    const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "acceso", nivel, activo, autor }),
    });
    const data = await res.json();
    setAccesoPendiente(null);
    if (!res.ok) {
      setError(data.error ?? "No se pudo actualizar el acceso");
      return;
    }
    setCliente(data.cliente);
    onClienteActualizado(data.cliente);
    const eventosRes = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}/eventos`).then((r) =>
      r.json()
    );
    setEventos(eventosRes.eventos ?? []);
  }

  async function cambiarDetalleAcceso(
    nivel: keyof Accesos,
    cambios: { cantidad?: number; variante?: Accesos["general"]["variante"] }
  ) {
    if (!cliente || !autor) return;
    setError(null);
    const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "acceso-detalle", nivel, ...cambios, autor }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "No se pudo actualizar el acceso");
      return;
    }
    setCliente(data.cliente);
    onClienteActualizado(data.cliente);
  }

  async function confirmarRenovar() {
    if (!cliente || !autor) return;
    if (pasoRenovar < 2) {
      setPasoRenovar((p) => (p + 1) as 0 | 1 | 2);
      return;
    }
    setRenovando(true);
    setError(null);
    const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}/renovar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autor }),
    });
    const data = await res.json();
    setRenovando(false);
    setPasoRenovar(0);
    if (!res.ok) {
      setError(data.error ?? "No se pudo renovar la membresía");
      return;
    }
    const avisos: string[] = [];
    if (data.avisoKajabi) avisos.push(`Kajabi: ${data.avisoKajabi}`);
    if (data.avisoSkool) avisos.push(`Skool: ${data.avisoSkool}`);
    if (avisos.length) {
      window.alert(`La membresía se renovó en el CRM, pero hubo problemas:\n\n${avisos.join("\n")}`);
    }
    setCliente(data.cliente);
    setForm(formDeCliente(data.cliente));
    onClienteActualizado(data.cliente);
    setEstadoKajabi(data.avisoKajabi ? "revocada" : "activa");
    const eventosRes = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}/eventos`).then((r) =>
      r.json()
    );
    setEventos(eventosRes.eventos ?? []);
  }

  async function confirmarEliminar() {
    if (!cliente || !autor) return;
    if (pasoEliminar < 2) {
      setPasoEliminar((p) => (p + 1) as 0 | 1 | 2);
      return;
    }
    setEliminando(true);
    setError(null);
    const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}/eliminar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autor }),
    });
    const data = await res.json();
    setEliminando(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo eliminar el cliente");
      setPasoEliminar(0);
      return;
    }
    if (data.avisoKajabi) {
      window.alert(
        `El cliente se archivó en el CRM, pero no se pudo eliminar en Kajabi: ${data.avisoKajabi}`
      );
    }
    onClienteEliminado?.(cliente.id);
    onClose();
  }

  async function toggleTag(tag: string, activo: boolean) {
    if (!cliente || !autor) return;
    const nuevos = activo ? [...cliente.tags, tag] : cliente.tags.filter((t) => t !== tag);
    setGuardandoTag(tag);
    setError(null);
    const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "tags", tags: nuevos, autor }),
    });
    const data = await res.json();
    setGuardandoTag(null);
    if (!res.ok) {
      setError(data.error ?? "No se pudo actualizar los tags");
      return;
    }
    setCliente(data.cliente);
    onClienteActualizado(data.cliente);
    const eventosRes = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}/eventos`).then((r) =>
      r.json()
    );
    setEventos(eventosRes.eventos ?? []);
  }

  async function enviarNota() {
    if (!cliente || !autor || !nota.trim()) return;
    setEnviandoNota(true);
    setError(null);
    const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}/eventos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nota, autor }),
    });
    const data = await res.json();
    setEnviandoNota(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo agregar la nota");
      return;
    }
    setEventos(data.eventos);
    setNota("");
  }

  function copiar(valor: string, campo: "email" | "telefono") {
    navigator.clipboard.writeText(valor).then(() => {
      setCopiado(campo);
      setTimeout(() => setCopiado(null), 1500);
    });
  }

  const tieneAcceso = cliente
    ? cliente.accesos.general.activo || cliente.accesos.vip.activo || cliente.accesos.black.activo
    : false;

  const notasRegistradas = eventos
    .filter((e) => e.tipo === "NOTA")
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Cerrar panel"
        onClick={onClose}
        className="animate-fade-in-fast absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
      />
      <div className="animate-slide-in-right relative flex h-full w-full flex-col bg-surface shadow-2xl sm:w-[520px]">
        {cargando || !cliente ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">Cargando…</div>
        ) : (
          <>
            <div className="brand-plate flex-none px-6 pb-5 pt-6 text-white">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-lg font-semibold">
                  {cliente.nombre.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={onClose}
                  className="ease-spring rounded-full p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <h2 className="text-lg font-semibold">{cliente.nombre}</h2>
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    tieneAcceso ? "bg-success/20 text-white" : "bg-white/15 text-white/80"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${tieneAcceso ? "bg-success" : "bg-white/50"}`}
                  />
                  {tieneAcceso ? "Activo" : "Sin acceso"}
                </span>
              </div>

              <div className="mt-1.5 flex flex-col gap-1 text-sm text-white/85">
                <button
                  onClick={() => copiar(cliente.email, "email")}
                  className="ease-spring flex w-fit items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition hover:bg-white/10"
                >
                  {cliente.email}
                  {copiado === "email" ? (
                    <Check className="h-3 w-3" strokeWidth={2} />
                  ) : (
                    <Copy className="h-3 w-3 opacity-70" strokeWidth={1.75} />
                  )}
                </button>
                {cliente.telefono && (
                  <button
                    onClick={() => copiar(cliente.telefono ?? "", "telefono")}
                    className="ease-spring flex w-fit items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition hover:bg-white/10"
                  >
                    {cliente.telefono}
                    {copiado === "telefono" ? (
                      <Check className="h-3 w-3" strokeWidth={2} />
                    ) : (
                      <Copy className="h-3 w-3 opacity-70" strokeWidth={1.75} />
                    )}
                  </button>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium">
                  <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Cliente desde{" "}
                  {new Date(cliente.fechaInscripcion ?? cliente.creadoEn).toLocaleDateString("es-MX")}
                </span>
                {cliente.telefono && (
                  <>
                    <a
                      href={`https://wa.me/${cliente.telefono.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ease-spring flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium transition hover:bg-white/20"
                    >
                      <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                      WhatsApp
                    </a>
                    <a
                      href={`tel:${cliente.telefono}`}
                      className="ease-spring flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium transition hover:bg-white/20"
                    >
                      <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Llamar
                    </a>
                  </>
                )}
                {!editando ? (
                  <button
                    onClick={() => setEditando(true)}
                    className="ease-spring ml-auto flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-medium transition hover:bg-white/25"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Editar
                  </button>
                ) : (
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={cancelarEdicion}
                      className="ease-spring flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium transition hover:bg-white/20"
                    >
                      <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Cancelar
                    </button>
                    <button
                      onClick={guardar}
                      disabled={guardando || !form.nombre.trim()}
                      className="ease-spring flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-primary-deep transition disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {guardando ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <nav className="flex flex-none gap-1 overflow-x-auto border-b border-silver/70 bg-surface-2 px-3 py-1.5">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`ease-spring flex flex-none items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    tab === key
                      ? "bg-surface text-primary-deep shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {label}
                </button>
              ))}
            </nav>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {error && (
                <div className="animate-fade-in-fast mb-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
                  {error}
                </div>
              )}

              {tab === "resumen" && (
                <div className="space-y-5">
                  <Tarjeta titulo="Accesos y membresías">
                    <div className="grid grid-cols-3 gap-1.5">
                      <AccesoBadge
                        icon={ShieldCheck}
                        label="General"
                        detalle={cliente.accesos.general}
                        tono="primary"
                      />
                      <AccesoBadge icon={Crown} label="VIP" detalle={cliente.accesos.vip} tono="warning" />
                      <AccesoBadge icon={Gem} label="Black" detalle={cliente.accesos.black} tono="black" />
                    </div>
                    <button
                      onClick={() => setTab("accesos")}
                      className="ease-spring mt-2.5 text-xs font-medium text-primary transition hover:text-primary-deep"
                    >
                      Editar accesos →
                    </button>
                  </Tarjeta>

                  <Tarjeta titulo="Tags">
                    {tagsCatalogo.length === 0 ? (
                      <p className="text-sm text-muted">
                        Todavía no hay tags en la Biblioteca. Agrégalos desde el menú lateral.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {tagsCatalogo.map((tag) => {
                          const activo = cliente.tags.includes(tag);
                          return (
                            <button
                              key={tag}
                              onClick={() => toggleTag(tag, !activo)}
                              disabled={guardandoTag === tag}
                              className={`ease-spring flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                                activo
                                  ? "brand-plate text-white"
                                  : "border border-silver text-muted hover:text-foreground"
                              }`}
                            >
                              <Tags className="h-3 w-3" strokeWidth={1.75} />
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Tarjeta>

                  <Tarjeta titulo="Datos del cliente">
                    {!editando ? (
                      <dl className="space-y-2.5 text-sm">
                        <CampoValor label="País" valor={cliente.pais} />
                        <CampoValor label="Ciudad" valor={cliente.ciudad} />
                        <CampoValor label="Evento" valor={cliente.evento} />
                        <CampoValor label="Contacto en WhatsApp" valor={cliente.contactoWhats} />
                      </dl>
                    ) : (
                      <div className="space-y-3">
                        <Campo label="Nombre">
                          <Input value={form.nombre} onChange={(v) => setForm((f) => ({ ...f, nombre: v }))} />
                        </Campo>
                        <Campo label="Teléfono">
                          <Input
                            value={form.telefono}
                            onChange={(v) => setForm((f) => ({ ...f, telefono: v }))}
                          />
                        </Campo>
                        <div className="grid grid-cols-2 gap-2">
                          <Campo label="País">
                            <Input value={form.pais} onChange={(v) => setForm((f) => ({ ...f, pais: v }))} />
                          </Campo>
                          <Campo label="Ciudad">
                            <Input
                              value={form.ciudad}
                              onChange={(v) => setForm((f) => ({ ...f, ciudad: v }))}
                            />
                          </Campo>
                        </div>
                      </div>
                    )}
                  </Tarjeta>

                  <Tarjeta titulo="Estado y próximos pasos">
                    <ul className="space-y-2.5 text-sm">
                      <EstadoFila
                        ok={cliente.accesoPlataforma === "Si"}
                        label="Acceso a la plataforma"
                        valor={cliente.accesoPlataforma}
                      />
                      <EstadoFila
                        ok={!!cliente.invitacionSkool}
                        label="Invitación Skool"
                        valor={cliente.invitacionSkool}
                      />
                      <EstadoFila ok={!!cliente.llamada} label="Llamada de seguimiento" valor={cliente.llamada} />
                    </ul>
                  </Tarjeta>

                  <Tarjeta titulo="Notas recientes">
                    {notasRegistradas.length === 0 ? (
                      <p className="text-sm text-muted">Todavía no hay notas agregadas.</p>
                    ) : (
                      <ul className="space-y-3">
                        {notasRegistradas.slice(0, 3).map((n) => (
                          <NotaItem key={n.id} evento={n} />
                        ))}
                      </ul>
                    )}
                    <button
                      onClick={() => setTab("notas")}
                      className="ease-spring mt-2.5 text-xs font-medium text-primary transition hover:text-primary-deep"
                    >
                      Ver todas / agregar nota →
                    </button>
                  </Tarjeta>

                  <Tarjeta titulo="Zona de peligro">
                    {cliente.eliminadoEn ? (
                      <p className="text-sm text-muted">
                        Este cliente fue eliminado el{" "}
                        {new Date(cliente.eliminadoEn).toLocaleString("es-MX", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                        .
                      </p>
                    ) : pasoEliminar === 0 ? (
                      <button
                        onClick={confirmarEliminar}
                        className="ease-spring flex items-center gap-1.5 rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Eliminar cliente
                      </button>
                    ) : pasoEliminar === 1 ? (
                      <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                        <p className="mb-2.5 text-xs text-foreground">
                          Esto va a borrar de forma <strong>permanente</strong> el contacto en Kajabi, y va a
                          archivar a {cliente.nombre} en el CRM (sale de la lista principal, pero su historial
                          queda guardado en Eliminados). ¿Confirmas?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPasoEliminar(0)}
                            className="ease-spring rounded-lg border border-silver px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={confirmarEliminar}
                            className="ease-spring rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white transition"
                          >
                            Sí, continuar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                        <p className="mb-2.5 text-xs font-medium text-danger">
                          Última confirmación — el borrado en Kajabi no se puede deshacer.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPasoEliminar(0)}
                            className="ease-spring rounded-lg border border-silver px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={confirmarEliminar}
                            disabled={eliminando}
                            className="ease-spring rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50"
                          >
                            {eliminando ? "Eliminando…" : "Confirmar eliminación"}
                          </button>
                        </div>
                      </div>
                    )}
                  </Tarjeta>
                </div>
              )}

              {tab === "accesos" && (
                <div className="space-y-5">
                  <Tarjeta titulo="Estado en Kajabi">
                    {estadoKajabi === "cargando" && (
                      <p className="text-sm text-muted">Consultando en Kajabi…</p>
                    )}
                    {estadoKajabi === "activa" && (
                      <p className="flex items-center gap-1.5 text-sm text-success">
                        <Check className="h-4 w-4" strokeWidth={2} />
                        Oferta activa en Kajabi
                      </p>
                    )}
                    {estadoKajabi === "sin_contacto" && (
                      <p className="text-sm text-muted">Todavía no tiene contacto en Kajabi.</p>
                    )}
                    {estadoKajabi === "error" && (
                      <p className="text-sm text-muted">No se pudo verificar el estado en Kajabi.</p>
                    )}
                    {estadoKajabi === "revocada" && (
                      <div className="space-y-3">
                        <p className="flex items-center gap-1.5 text-sm text-danger">
                          <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
                          La oferta ya no está activa en Kajabi.
                        </p>
                        {pasoRenovar === 0 && (
                          <button
                            onClick={confirmarRenovar}
                            className="ease-spring flex items-center gap-1.5 rounded-lg brand-plate px-3 py-1.5 text-xs font-medium text-white transition"
                          >
                            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Renovar membresía
                          </button>
                        )}
                        {pasoRenovar === 1 && (
                          <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                            <p className="mb-2.5 text-xs text-foreground">
                              Esto va a otorgar la oferta en Kajabi, reenviar la invitación de Skool, poner la
                              etiqueta &quot;Renovación&quot; y actualizar Fin de acceso a un año desde hoy.
                              ¿Confirmas?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setPasoRenovar(0)}
                                className="ease-spring rounded-lg border border-silver px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={confirmarRenovar}
                                className="ease-spring rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white transition"
                              >
                                Sí, continuar
                              </button>
                            </div>
                          </div>
                        )}
                        {pasoRenovar === 2 && (
                          <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                            <p className="mb-2.5 text-xs font-medium text-danger">
                              Última confirmación — esta acción no se puede deshacer fácilmente.
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setPasoRenovar(0)}
                                className="ease-spring rounded-lg border border-silver px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={confirmarRenovar}
                                disabled={renovando}
                                className="ease-spring rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50"
                              >
                                {renovando ? "Renovando…" : "Confirmar renovación"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Tarjeta>

                  <Tarjeta titulo="Accesos a Synergy Unlimited">
                    <AccesosSynergy
                      accesos={cliente.accesos}
                      pendiente={accesoPendiente}
                      onToggle={toggleAcceso}
                      editando={editando}
                      onCambiarDetalle={cambiarDetalleAcceso}
                    />
                  </Tarjeta>

                  <Tarjeta titulo="Acceso a plataforma (histórico)">
                    {!editando ? (
                      <dl className="space-y-2.5 text-sm">
                        <CampoValor label="Registrado en el CSV de origen" valor={cliente.accesoPlataforma} />
                        <CampoValor
                          label="Fin de acceso"
                          valor={cliente.finAcceso ? new Date(cliente.finAcceso).toLocaleDateString("es-MX") : null}
                        />
                      </dl>
                    ) : (
                      <div className="space-y-3">
                        <Campo label="Acceso a plataforma">
                          <Input
                            value={form.accesoPlataforma}
                            onChange={(v) => setForm((f) => ({ ...f, accesoPlataforma: v }))}
                          />
                        </Campo>
                        <Campo label="Fin de acceso">
                          <input
                            type="date"
                            value={form.finAcceso}
                            onChange={(e) => setForm((f) => ({ ...f, finAcceso: e.target.value }))}
                            className="w-full rounded-lg border border-silver bg-surface-2 px-3 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
                          />
                        </Campo>
                      </div>
                    )}
                  </Tarjeta>
                </div>
              )}

              {tab === "seguimiento" && (
                <Tarjeta titulo="Seguimiento y soporte">
                  {!editando ? (
                    <dl className="space-y-2.5 text-sm">
                      <DatoFila icon={PartyPopper} label="Evento" valor={cliente.evento} />
                      <DatoFila icon={CalendarClock} label="Fecha del evento" valor={cliente.fechaEvento} />
                      <DatoFila icon={Ticket} label="Tipo de membresía" valor={cliente.tipoMembresia} />
                      <DatoFila
                        icon={CalendarClock}
                        label="Vencimiento Skool"
                        valor={cliente.vencimientoSkool}
                      />
                      <DatoFila
                        icon={MessagesSquare}
                        label="Invitación de Skool"
                        valor={cliente.invitacionSkool}
                      />
                      <DatoFila
                        icon={MessagesSquare}
                        label="Contacto en WhatsApp"
                        valor={cliente.contactoWhats}
                      />
                      <DatoFila icon={PhoneCall} label="Llamada" valor={cliente.llamada} />
                    </dl>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Campo label="Evento">
                          <Input value={form.evento} onChange={(v) => setForm((f) => ({ ...f, evento: v }))} />
                        </Campo>
                        <Campo label="Fecha del evento">
                          <Input
                            value={form.fechaEvento}
                            onChange={(v) => setForm((f) => ({ ...f, fechaEvento: v }))}
                          />
                        </Campo>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Campo label="Tipo de membresía">
                          <Input
                            value={form.tipoMembresia}
                            onChange={(v) => setForm((f) => ({ ...f, tipoMembresia: v }))}
                          />
                        </Campo>
                        <Campo label="Vencimiento Skool">
                          <Input
                            value={form.vencimientoSkool}
                            onChange={(v) => setForm((f) => ({ ...f, vencimientoSkool: v }))}
                          />
                        </Campo>
                      </div>
                      <Campo label="Invitación de Skool">
                        <Input
                          value={form.invitacionSkool}
                          onChange={(v) => setForm((f) => ({ ...f, invitacionSkool: v }))}
                        />
                      </Campo>
                      <div className="grid grid-cols-2 gap-2">
                        <Campo label="Contacto en WhatsApp">
                          <Input
                            value={form.contactoWhats}
                            onChange={(v) => setForm((f) => ({ ...f, contactoWhats: v }))}
                          />
                        </Campo>
                        <Campo label="Llamada">
                          <Input value={form.llamada} onChange={(v) => setForm((f) => ({ ...f, llamada: v }))} />
                        </Campo>
                      </div>
                    </div>
                  )}
                </Tarjeta>
              )}

              {tab === "notas" && (
                <div className="space-y-5">
                  <Tarjeta titulo="Agregar nota">
                    <div className="flex gap-2">
                      <input
                        value={nota}
                        onChange={(e) => setNota(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && enviarNota()}
                        placeholder="Escribe una nota…"
                        className="flex-1 rounded-lg border border-silver bg-surface-2 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      />
                      <button
                        onClick={enviarNota}
                        disabled={enviandoNota || !nota.trim()}
                        className="ease-spring flex items-center justify-center rounded-lg brand-plate px-3 text-white transition disabled:opacity-40"
                      >
                        <Send className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  </Tarjeta>

                  <Tarjeta titulo="Notas generales">
                    {!editando ? (
                      <p className="whitespace-pre-wrap text-sm text-foreground">
                        {cliente.notas || <span className="text-muted">Sin notas</span>}
                      </p>
                    ) : (
                      <textarea
                        value={form.notas}
                        onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                        rows={4}
                        className="w-full resize-none rounded-lg border border-silver bg-surface-2 px-3 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
                      />
                    )}
                  </Tarjeta>

                  <Tarjeta titulo="Notas de soporte técnico">
                    {!editando ? (
                      <p className="flex items-start gap-1.5 whitespace-pre-wrap text-sm text-foreground">
                        <Headset className="mt-0.5 h-3.5 w-3.5 flex-none text-muted" strokeWidth={1.75} />
                        {cliente.notasSoporte || <span className="text-muted">Sin notas de soporte</span>}
                      </p>
                    ) : (
                      <textarea
                        value={form.notasSoporte}
                        onChange={(e) => setForm((f) => ({ ...f, notasSoporte: e.target.value }))}
                        rows={4}
                        className="w-full resize-none rounded-lg border border-silver bg-surface-2 px-3 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
                      />
                    )}
                  </Tarjeta>

                  <Tarjeta titulo="Notas registradas">
                    {notasRegistradas.length === 0 ? (
                      <p className="text-sm text-muted">Todavía no hay notas agregadas.</p>
                    ) : (
                      <ul className="space-y-3">
                        {notasRegistradas.map((n) => (
                          <NotaItem key={n.id} evento={n} />
                        ))}
                      </ul>
                    )}
                  </Tarjeta>
                </div>
              )}

              {tab === "actividad" && (
                <div>
                  <div className="mb-4 flex gap-2">
                    <input
                      value={nota}
                      onChange={(e) => setNota(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && enviarNota()}
                      placeholder="Agregar una nota…"
                      className="flex-1 rounded-lg border border-silver bg-surface-2 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                    />
                    <button
                      onClick={enviarNota}
                      disabled={enviandoNota || !nota.trim()}
                      className="ease-spring flex items-center justify-center rounded-lg brand-plate px-3 text-white transition disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </div>
                  <Timeline eventos={eventos} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="shell rounded-2xl p-2 diffused">
      <div className="core rounded-[calc(1rem-0.25rem)] p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">{titulo}</h3>
        {children}
      </div>
    </section>
  );
}

function AccesoBadge({
  icon: Icon,
  label,
  detalle,
  tono,
}: {
  icon: typeof ShieldCheck;
  label: string;
  detalle: Accesos["general"];
  tono: "primary" | "warning" | "black";
}) {
  const activeClass =
    tono === "primary"
      ? "general-plate text-white"
      : tono === "warning"
        ? "vip-plate text-white"
        : "black-plate text-white";
  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3.5 text-center ${
        detalle.activo ? `${activeClass} border-transparent` : "border-silver bg-surface-2 text-muted"
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={1.75} />
      <span className="text-sm font-semibold">{label}</span>
      {detalle.activo && (
        <span className="text-xs opacity-80">
          {detalle.cantidad}
          {detalle.variante ? ` · ${detalle.variante}` : ""}
        </span>
      )}
    </div>
  );
}

function EstadoFila({ ok, label, valor }: { ok: boolean; label: string; valor: string | null }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-silver/60 pb-2.5 last:border-0 last:pb-0">
      <span className="flex items-center gap-2 text-foreground">
        <span
          className={`flex h-4 w-4 flex-none items-center justify-center rounded-full ${
            ok ? "bg-success/20 text-success" : "bg-silver text-muted"
          }`}
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
        {label}
      </span>
      <span className="text-xs text-muted">{valor || "Sin registro"}</span>
    </li>
  );
}

function NotaItem({ evento }: { evento: EventoTimeline }) {
  return (
    <li className="border-b border-silver/60 pb-3 last:border-0 last:pb-0">
      <p className="whitespace-pre-wrap text-sm text-foreground">{evento.detalle}</p>
      <p className="mt-1 text-xs text-muted">
        {new Date(evento.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
        {evento.autor}
      </p>
    </li>
  );
}

function DatoFila({
  icon: Icon,
  label,
  valor,
}: {
  icon: typeof Phone;
  label: string;
  valor: string | null;
}) {
  return (
    <div className="flex items-start gap-2 text-foreground">
      <Icon className="mt-0.5 h-3.5 w-3.5 flex-none text-muted" strokeWidth={1.75} />
      <span>
        <span className="text-muted">{label}: </span>
        {valor || <span className="text-muted">—</span>}
      </span>
    </div>
  );
}

function CampoValor({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="text-foreground">{valor || <span className="text-muted">—</span>}</p>
    </div>
  );
}

function Input({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-silver bg-surface-2 px-3 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
    />
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
