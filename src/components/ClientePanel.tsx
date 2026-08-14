"use client";

import { useEffect, useRef, useState } from "react";
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
  Plus,
  RefreshCw,
  AlertTriangle,
  Trash2,
  IdCard,
  MapPin,
  LogIn,
  Clock,
  Mail,
} from "lucide-react";
import type { Accesos, Cliente, EventoTimeline } from "@/lib/types";
import { ESTADOS_MENSAJE_BIENVENIDA_WA } from "@/lib/types";
import { useSesion } from "@/lib/session-context";
import { tienePermiso } from "@/lib/permisos";
import { AccesosSynergy } from "./AccesosSynergy";
import { Timeline } from "./Timeline";
import type { PerfilKajabi } from "@/lib/kajabi";

type Tab = "resumen" | "accesos" | "seguimiento" | "notas" | "actividad" | "kajabi";

const TABS: { key: Tab; label: string; icon: typeof User }[] = [
  { key: "resumen", label: "Resumen", icon: LayoutGrid },
  { key: "accesos", label: "Accesos", icon: ShieldCheck },
  { key: "seguimiento", label: "Seguimiento", icon: ClipboardList },
  { key: "kajabi", label: "Perfil de Kajabi", icon: IdCard },
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

const ACCESO_LABEL: Record<keyof Accesos, string> = {
  general: "General",
  vip: "VIP",
  black: "Black Access",
};

function formatearDireccion(d: PerfilKajabi["direccion"]): string[] {
  if (!d) return [];
  const linea1 = [d.calle1, d.calle2].filter(Boolean).join(", ");
  const linea2 = [d.ciudad, d.estado, d.codigoPostal].filter(Boolean).join(", ");
  return [linea1, linea2, d.pais].filter((l): l is string => !!l);
}

function textoAcceso(d: Accesos[keyof Accesos]): string {
  return d.activo && d.cantidad > 0 ? `${d.cantidad}${d.variante ? ` · ${d.variante}` : ""}` : "Sin acceso";
}

function diferenciasAccesos(anterior: Accesos, nuevo: Accesos): { nivel: keyof Accesos; de: string; a: string }[] {
  return (Object.keys(nuevo) as (keyof Accesos)[])
    .filter((nivel) => JSON.stringify(anterior[nivel]) !== JSON.stringify(nuevo[nivel]))
    .map((nivel) => ({ nivel, de: textoAcceso(anterior[nivel]), a: textoAcceso(nuevo[nivel]) }));
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
  const { usuario } = useSesion();
  const puedeEditar = !!usuario && tienePermiso(usuario.rol, "editarCliente");
  const puedeEditarAccesos = !!usuario && tienePermiso(usuario.rol, "editarAccesos");
  const puedeAgregarNota = !!usuario && tienePermiso(usuario.rol, "agregarNota");
  const puedeEliminar = !!usuario && tienePermiso(usuario.rol, "eliminarCliente");
  const puedeRenovar = !!usuario && tienePermiso(usuario.rol, "renovarMembresia");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [eventos, setEventos] = useState<EventoTimeline[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState<Tab>("resumen");
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Form>(formDeCliente(null));
  const [guardando, setGuardando] = useState(false);
  const [editandoAccesos, setEditandoAccesos] = useState(false);
  const [borradorAccesos, setBorradorAccesos] = useState<Accesos | null>(null);
  const [confirmandoAccesos, setConfirmandoAccesos] = useState(false);
  const [guardandoAccesos, setGuardandoAccesos] = useState(false);
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
  const [pasoEnviarWa, setPasoEnviarWa] = useState<0 | 1>(0);
  const [enviandoWa, setEnviandoWa] = useState(false);
  const [perfilKajabi, setPerfilKajabi] = useState<PerfilKajabi | null>(null);
  const [cargandoPerfilKajabi, setCargandoPerfilKajabi] = useState(false);
  const [errorPerfilKajabi, setErrorPerfilKajabi] = useState<string | null>(null);

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
    setPerfilKajabi(null);
    setErrorPerfilKajabi(null);
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
    if (tab !== "kajabi" || perfilKajabi || cargandoPerfilKajabi) return;
    let cancelado = false;
    setCargandoPerfilKajabi(true);
    setErrorPerfilKajabi(null);
    fetch(`/api/clientes/${encodeURIComponent(clienteId)}/kajabi-perfil`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelado) return;
        if (data.perfil) setPerfilKajabi(data.perfil);
        else setErrorPerfilKajabi(data.error ?? "No se pudo consultar Kajabi");
      })
      .catch(() => {
        if (!cancelado) setErrorPerfilKajabi("No se pudo consultar Kajabi");
      })
      .finally(() => {
        if (!cancelado) setCargandoPerfilKajabi(false);
      });
    return () => {
      cancelado = true;
    };
  }, [tab, clienteId, perfilKajabi, cargandoPerfilKajabi]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function guardar() {
    if (!cliente || !puedeEditar) return;
    setGuardando(true);
    setError(null);
    const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "datos", ...form }),
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

  function iniciarEdicionAccesos() {
    if (!cliente || !puedeEditarAccesos) return;
    setBorradorAccesos(cliente.accesos);
    setEditandoAccesos(true);
    setConfirmandoAccesos(false);
  }

  function cancelarEdicionAccesos() {
    setEditandoAccesos(false);
    setConfirmandoAccesos(false);
    setBorradorAccesos(null);
  }

  async function confirmarGuardarAccesos() {
    if (!cliente || !borradorAccesos || !puedeEditarAccesos) return;
    setGuardandoAccesos(true);
    setError(null);
    const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "accesos", accesos: borradorAccesos }),
    });
    const data = await res.json();
    setGuardandoAccesos(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo actualizar los accesos");
      return;
    }
    setCliente(data.cliente);
    onClienteActualizado(data.cliente);
    cancelarEdicionAccesos();
    const eventosRes = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}/eventos`).then((r) =>
      r.json()
    );
    setEventos(eventosRes.eventos ?? []);
  }

  async function confirmarRenovar() {
    if (!cliente || !puedeRenovar) return;
    if (pasoRenovar < 2) {
      setPasoRenovar((p) => (p + 1) as 0 | 1 | 2);
      return;
    }
    setRenovando(true);
    setError(null);
    const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}/renovar`, {
      method: "POST",
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
    if (!cliente || !puedeEliminar) return;
    if (pasoEliminar < 2) {
      setPasoEliminar((p) => (p + 1) as 0 | 1 | 2);
      return;
    }
    setEliminando(true);
    setError(null);
    const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}/eliminar`, {
      method: "POST",
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
    if (!cliente || !puedeEditar) return;
    const nuevos = activo ? [...cliente.tags, tag] : cliente.tags.filter((t) => t !== tag);
    setGuardandoTag(tag);
    setError(null);
    const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "tags", tags: nuevos }),
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
    if (!cliente || !puedeAgregarNota || !nota.trim()) return;
    setEnviandoNota(true);
    setError(null);
    const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}/eventos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nota }),
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

  async function confirmarEnviarWa() {
    if (!cliente || !puedeEditar) return;
    if (pasoEnviarWa < 1) {
      setPasoEnviarWa(1);
      return;
    }
    setEnviandoWa(true);
    setError(null);
    const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}/reenviar-bienvenida-wa`, {
      method: "POST",
    });
    const data = await res.json();
    setEnviandoWa(false);
    setPasoEnviarWa(0);
    if (!res.ok) {
      setError(data.error ?? "No se pudo reenviar el mensaje de bienvenida");
      return;
    }
    if (data.aviso) {
      setError(`No se pudo reenviar por WhatsApp — quedó en Pendiente: ${data.aviso}`);
    }
    setCliente(data.cliente);
    setForm((f) => ({ ...f, contactoWhats: data.cliente.contactoWhats ?? "" }));
    onClienteActualizado(data.cliente);
    const eventosRes = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}/eventos`).then((r) =>
      r.json()
    );
    setEventos(eventosRes.eventos ?? []);
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
                <div className="flex items-center gap-2">
                  <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-white/15 text-lg font-semibold">
                    {cliente.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {cliente.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/90"
                      >
                        {tag}
                      </span>
                    ))}
                    {puedeEditar && (
                      <TagsPopover
                        tagsCatalogo={tagsCatalogo}
                        tagsCliente={cliente.tags}
                        guardandoTag={guardandoTag}
                        onToggle={toggleTag}
                      />
                    )}
                  </div>
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
                {!puedeEditar ? null : !editando ? (
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
                      {puedeEditarAccesos ? "Editar accesos →" : "Ver accesos →"}
                    </button>
                  </Tarjeta>

                  <Tarjeta titulo="Datos del cliente">
                    {!editando ? (
                      <dl className="space-y-2.5 text-sm">
                        <CampoValor label="País" valor={cliente.pais} />
                        <CampoValor label="Evento" valor={cliente.evento} />
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-medium text-muted">Mensaje de Bienvenida WA</p>
                            {puedeEditar && (
                              <button
                                onClick={confirmarEnviarWa}
                                disabled={!cliente.telefono || enviandoWa}
                                title={!cliente.telefono ? "El cliente no tiene teléfono registrado" : "Reenviar mensaje de bienvenida"}
                                className="ease-spring flex-none rounded-lg border border-silver px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Enviar
                              </button>
                            )}
                          </div>
                          <p className="text-foreground">
                            {cliente.contactoWhats || <span className="text-muted">—</span>}
                          </p>
                          {pasoEnviarWa === 1 && (
                            <div className="mt-2 rounded-lg border border-primary/30 bg-primary-dim/40 p-3">
                              <p className="mb-2.5 text-xs text-foreground">
                                ¿Reenviar el mensaje de bienvenida por WhatsApp a <strong>{cliente.telefono}</strong>?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setPasoEnviarWa(0)}
                                  className="ease-spring rounded-lg border border-silver px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={confirmarEnviarWa}
                                  disabled={enviandoWa}
                                  className="ease-spring rounded-lg brand-plate px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50"
                                >
                                  {enviandoWa ? "Enviando…" : "Confirmar y enviar"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
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
                        <Campo label="País">
                          <Input value={form.pais} onChange={(v) => setForm((f) => ({ ...f, pais: v }))} />
                        </Campo>
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

                  {puedeEliminar && (
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
                  )}
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
                        {!puedeRenovar ? null : pasoRenovar === 0 && (
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
                      valor={editandoAccesos && borradorAccesos ? borradorAccesos : cliente.accesos}
                      onChange={setBorradorAccesos}
                      soloLectura={!editandoAccesos}
                      paisCliente={cliente.pais}
                    />

                    {puedeEditarAccesos && !editandoAccesos && (
                      <button
                        onClick={iniciarEdicionAccesos}
                        className="ease-spring mt-3 text-xs font-medium text-primary transition hover:text-primary-deep"
                      >
                        Editar accesos →
                      </button>
                    )}

                    {editandoAccesos && !confirmandoAccesos && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={cancelarEdicionAccesos}
                          className="ease-spring rounded-lg border border-silver px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => setConfirmandoAccesos(true)}
                          disabled={
                            !borradorAccesos || diferenciasAccesos(cliente.accesos, borradorAccesos).length === 0
                          }
                          className="ease-spring rounded-lg brand-plate px-3 py-1.5 text-xs font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Guardar cambios
                        </button>
                      </div>
                    )}

                    {editandoAccesos && confirmandoAccesos && borradorAccesos && (
                      <div className="mt-3 rounded-lg border border-primary/30 bg-primary-dim/40 p-3">
                        <p className="mb-2 text-xs font-medium text-foreground">Confirma el cambio de accesos:</p>
                        <ul className="mb-2.5 space-y-1 text-xs text-foreground">
                          {diferenciasAccesos(cliente.accesos, borradorAccesos).map((d) => (
                            <li key={d.nivel}>
                              <span className="font-medium">{ACCESO_LABEL[d.nivel]}:</span> {d.de} → {d.a}
                            </li>
                          ))}
                        </ul>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmandoAccesos(false)}
                            className="ease-spring rounded-lg border border-silver px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                          >
                            Volver a editar
                          </button>
                          <button
                            onClick={confirmarGuardarAccesos}
                            disabled={guardandoAccesos}
                            className="ease-spring rounded-lg brand-plate px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50"
                          >
                            {guardandoAccesos ? "Guardando…" : "Confirmar y guardar"}
                          </button>
                        </div>
                      </div>
                    )}
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
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-start gap-2 text-foreground">
                          <MessageCircle className="mt-0.5 h-3.5 w-3.5 flex-none text-muted" strokeWidth={1.75} />
                          <span>
                            <span className="text-muted">Mensaje de Bienvenida WA: </span>
                            {cliente.contactoWhats || <span className="text-muted">—</span>}
                          </span>
                        </span>
                        {puedeEditar && (
                          <button
                            onClick={confirmarEnviarWa}
                            disabled={!cliente.telefono || enviandoWa}
                            title={!cliente.telefono ? "El cliente no tiene teléfono registrado" : "Reenviar mensaje de bienvenida"}
                            className="ease-spring flex-none rounded-lg border border-silver px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Enviar
                          </button>
                        )}
                      </div>
                      {pasoEnviarWa === 1 && (
                        <div className="rounded-lg border border-primary/30 bg-primary-dim/40 p-3">
                          <p className="mb-2.5 text-xs text-foreground">
                            ¿Reenviar el mensaje de bienvenida por WhatsApp a <strong>{cliente.telefono}</strong>?
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setPasoEnviarWa(0)}
                              className="ease-spring rounded-lg border border-silver px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={confirmarEnviarWa}
                              disabled={enviandoWa}
                              className="ease-spring rounded-lg brand-plate px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50"
                            >
                              {enviandoWa ? "Enviando…" : "Confirmar y enviar"}
                            </button>
                          </div>
                        </div>
                      )}
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
                        <Campo label="Mensaje de Bienvenida WA">
                          <select
                            value={form.contactoWhats}
                            onChange={(e) => setForm((f) => ({ ...f, contactoWhats: e.target.value }))}
                            className="w-full rounded-lg border border-silver bg-surface-2 px-3 py-1.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
                          >
                            {form.contactoWhats &&
                              !(ESTADOS_MENSAJE_BIENVENIDA_WA as readonly string[]).includes(form.contactoWhats) && (
                                <option value={form.contactoWhats}>{form.contactoWhats} (anterior)</option>
                              )}
                            <option value="">— Sin definir —</option>
                            {ESTADOS_MENSAJE_BIENVENIDA_WA.map((op) => (
                              <option key={op} value={op}>
                                {op}
                              </option>
                            ))}
                          </select>
                        </Campo>
                        <Campo label="Llamada">
                          <Input value={form.llamada} onChange={(v) => setForm((f) => ({ ...f, llamada: v }))} />
                        </Campo>
                      </div>
                    </div>
                  )}
                </Tarjeta>
              )}

              {tab === "kajabi" && (
                <div className="space-y-5">
                  <Tarjeta titulo="Perfil de Kajabi">
                    {cargandoPerfilKajabi ? (
                      <p className="text-sm text-muted">Consultando en Kajabi…</p>
                    ) : errorPerfilKajabi ? (
                      <p className="text-sm text-danger">{errorPerfilKajabi}</p>
                    ) : perfilKajabi && !perfilKajabi.encontrado ? (
                      <p className="text-sm text-muted">Este cliente todavía no tiene contacto en Kajabi.</p>
                    ) : perfilKajabi ? (
                      <dl className="space-y-2.5 text-sm">
                        <CampoValor label="Nombre en Kajabi" valor={perfilKajabi.nombre} />
                        <DatoFila icon={Mail} label="Correo" valor={perfilKajabi.email} />
                        <DatoFila icon={Phone} label="Teléfono" valor={perfilKajabi.telefono} />
                        <DatoFila
                          icon={MapPin}
                          label="Dirección"
                          valor={formatearDireccion(perfilKajabi.direccion).join(" · ") || null}
                        />
                        <CampoValor
                          label="Suscrito a marketing"
                          valor={
                            perfilKajabi.suscritoMarketing === null
                              ? null
                              : perfilKajabi.suscritoMarketing
                                ? "Sí"
                                : "No"
                          }
                        />
                      </dl>
                    ) : null}
                  </Tarjeta>

                  {!cargandoPerfilKajabi && perfilKajabi?.encontrado && (
                    <>
                      <Tarjeta titulo="Ofertas otorgadas actualmente">
                        {perfilKajabi.ofertas.length === 0 ? (
                          <p className="text-sm text-muted">No tiene ninguna oferta otorgada ahora mismo.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {perfilKajabi.ofertas.map((o) => (
                              <li key={o.id} className="flex items-center gap-2 text-sm text-foreground">
                                <ShieldCheck className="h-3.5 w-3.5 flex-none text-success" strokeWidth={1.75} />
                                {o.titulo}
                              </li>
                            ))}
                          </ul>
                        )}
                      </Tarjeta>

                      <Tarjeta titulo="Actividad en la plataforma">
                        <dl className="space-y-2.5 text-sm">
                          <DatoFila
                            icon={LogIn}
                            label="Inicios de sesión"
                            valor={perfilKajabi.signInCount === null ? null : String(perfilKajabi.signInCount)}
                          />
                          <DatoFila
                            icon={Clock}
                            label="Última actividad"
                            valor={
                              perfilKajabi.ultimaActividad
                                ? new Date(perfilKajabi.ultimaActividad).toLocaleString("es-MX", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })
                                : null
                            }
                          />
                        </dl>
                      </Tarjeta>
                    </>
                  )}
                </div>
              )}

              {tab === "notas" && (
                <div className="space-y-5">
                  {puedeAgregarNota && (
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
                  )}

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
                  {puedeAgregarNota && (
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
                  )}
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

function TagsPopover({
  tagsCatalogo,
  tagsCliente,
  guardandoTag,
  onToggle,
}: {
  tagsCatalogo: string[];
  tagsCliente: string[];
  guardandoTag: string | null;
  onToggle: (tag: string, activo: boolean) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-label="Agregar o quitar tags"
        className="ease-spring flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
      >
        <Plus className="h-3 w-3" strokeWidth={2.5} />
      </button>

      {abierto && (
        <div className="animate-fade-in-fast absolute left-0 top-[calc(100%+6px)] z-20 w-56 rounded-xl border border-silver bg-surface p-1.5 shadow-xl">
          {tagsCatalogo.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-muted">
              Todavía no hay tags en la Biblioteca. Agrégalos desde el menú lateral.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              {tagsCatalogo.map((tag) => {
                const activo = tagsCliente.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggle(tag, !activo)}
                    disabled={guardandoTag === tag}
                    className={`ease-spring flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition disabled:opacity-50 ${
                      activo ? "bg-primary-dim font-medium text-primary-deep" : "text-foreground hover:bg-surface-2"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 flex-none items-center justify-center rounded border ${
                        activo ? "border-primary bg-primary text-white" : "border-silver"
                      }`}
                    >
                      {activo && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{tag}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
