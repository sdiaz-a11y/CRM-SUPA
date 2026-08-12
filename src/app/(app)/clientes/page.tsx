"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarX,
  X,
  ChevronDown,
  Check,
  Upload,
} from "lucide-react";
import type { Cliente } from "@/lib/types";
import { ClientePanel } from "@/components/ClientePanel";
import { NuevoClienteModal } from "@/components/NuevoClienteModal";
import { ImportarClientesModal } from "@/components/ImportarClientesModal";

const LIMITE = 100;

type Estado = "todos" | "activos" | "revocados";
type Region = "todos" | "MX" | "US" | "LATAM";
type Vigencia = "actuales" | "futuros" | "todos";

const FILTROS_VACIOS = {
  estado: "todos" as Estado,
  region: "todos" as Region,
  vigencia: "actuales" as Vigencia,
  eventos: [] as string[],
  membresias: [] as string[],
  desde: "",
  hasta: "",
  vencidosAntesDe: "",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [mostrarImportar, setMostrarImportar] = useState(false);
  const [recargaKey, setRecargaKey] = useState(0);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [opciones, setOpciones] = useState<{ eventos: string[]; membresias: string[] }>({
    eventos: [],
    membresias: [],
  });

  useEffect(() => {
    fetch("/api/filtros-opciones")
      .then((r) => r.json())
      .then(setOpciones)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtros]);

  useEffect(() => {
    setCargando(true);
    const controlador = new AbortController();
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({ limite: String(LIMITE), pagina: String(pagina) });
      if (busqueda.trim()) params.set("q", busqueda.trim());
      if (filtros.estado !== "todos") params.set("estado", filtros.estado);
      if (filtros.region !== "todos") params.set("region", filtros.region);
      if (filtros.vigencia !== "actuales") params.set("vigencia", filtros.vigencia);
      if (filtros.eventos.length) params.set("eventos", filtros.eventos.join(","));
      if (filtros.membresias.length) params.set("membresias", filtros.membresias.join(","));
      if (filtros.desde) params.set("desde", filtros.desde);
      if (filtros.hasta) params.set("hasta", filtros.hasta);
      if (filtros.vencidosAntesDe) params.set("vencidosAntesDe", filtros.vencidosAntesDe);
      fetch(`/api/clientes?${params}`, { signal: controlador.signal })
        .then((r) => r.json())
        .then((data) => {
          setClientes(data.clientes ?? []);
          setTotal(data.total ?? 0);
          setCargando(false);
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timeout);
      controlador.abort();
    };
  }, [busqueda, pagina, filtros, recargaKey]);

  function actualizarEnLista(cliente: Cliente) {
    setClientes((prev) => prev.map((c) => (c.id === cliente.id ? cliente : c)));
  }

  function quitarDeLista(id: string) {
    setClientes((prev) => prev.filter((c) => c.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }

  const hayFiltrosActivos =
    filtros.estado !== "todos" ||
    filtros.region !== "todos" ||
    filtros.vigencia !== "actuales" ||
    filtros.eventos.length > 0 ||
    filtros.membresias.length > 0 ||
    !!filtros.desde ||
    !!filtros.hasta ||
    !!filtros.vencidosAntesDe;

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE));
  const inicio = total === 0 ? 0 : (pagina - 1) * LIMITE + 1;
  const fin = Math.min(pagina * LIMITE, total);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Clientes</h1>
          <p className="text-sm text-muted">{total.toLocaleString("es-MX")} clientes registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMostrarImportar(true)}
            className="ease-spring flex items-center gap-2 rounded-xl border border-silver bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-2"
          >
            <Upload className="h-4 w-4" strokeWidth={2} />
            Importar CSV
          </button>
          <button
            onClick={() => setMostrarNuevo(true)}
            className="ease-spring flex items-center gap-2 rounded-xl brand-plate px-4 py-2.5 text-sm font-medium text-white transition"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Nuevo cliente
          </button>
        </div>
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

      <div className="shell mb-5 rounded-[1.5rem] p-2 diffused">
        <div className="core space-y-3 rounded-[calc(1.5rem-0.5rem)] p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <Pildora
              opciones={[
                { valor: "todos", label: "Todos" },
                { valor: "activos", label: "Activos" },
                { valor: "revocados", label: "Revocados" },
              ]}
              valor={filtros.estado}
              onChange={(v) => setFiltros((f) => ({ ...f, estado: v as Estado }))}
            />
            <span className="mx-0.5 h-5 w-px bg-silver" />
            <Pildora
              opciones={[
                { valor: "todos", label: "Todos" },
                { valor: "MX", label: "MX" },
                { valor: "US", label: "US" },
                { valor: "LATAM", label: "LATAM" },
              ]}
              valor={filtros.region}
              onChange={(v) => setFiltros((f) => ({ ...f, region: v as Region }))}
            />
            <span className="mx-0.5 h-5 w-px bg-silver" />
            <MultiSelect
              label="eventos"
              todasLabel="Todos los eventos"
              opciones={opciones.eventos}
              seleccion={filtros.eventos}
              onChange={(v) => setFiltros((f) => ({ ...f, eventos: v }))}
            />
            <MultiSelect
              label="membresías"
              todasLabel="Todas las membresías"
              opciones={opciones.membresias}
              seleccion={filtros.membresias}
              onChange={(v) => setFiltros((f) => ({ ...f, membresias: v }))}
            />
            <span className="mx-0.5 h-5 w-px bg-silver" />
            <Pildora
              opciones={[
                { valor: "actuales", label: "Hasta hoy" },
                { valor: "futuros", label: "Futuros" },
                { valor: "todos", label: "Todos" },
              ]}
              valor={filtros.vigencia}
              onChange={(v) => setFiltros((f) => ({ ...f, vigencia: v as Vigencia }))}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-silver/60 pt-3">
            <CampoFecha
              icon={Calendar}
              label="Desde"
              value={filtros.desde}
              onChange={(v) => setFiltros((f) => ({ ...f, desde: v }))}
            />
            <CampoFecha
              icon={Calendar}
              label="Hasta"
              value={filtros.hasta}
              onChange={(v) => setFiltros((f) => ({ ...f, hasta: v }))}
            />
            <CampoFecha
              icon={CalendarX}
              label="Vencidos antes de"
              value={filtros.vencidosAntesDe}
              onChange={(v) => setFiltros((f) => ({ ...f, vencidosAntesDe: v }))}
            />
            {hayFiltrosActivos && (
              <button
                onClick={() => setFiltros(FILTROS_VACIOS)}
                className="ease-spring ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-danger/10 hover:text-danger"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="shell flex h-[calc(100vh-21rem)] flex-col rounded-[1.75rem] p-2 diffused">
        <div className="core flex flex-1 flex-col overflow-hidden rounded-[calc(1.75rem-0.5rem)]">
          {cargando ? (
            <p className="p-8 text-center text-sm text-muted">Cargando clientes…</p>
          ) : clientes.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">No se encontraron clientes.</p>
          ) : (
            <>
              <div className="flex-1 overflow-auto">
                <table className="w-full min-w-[1100px] table-fixed text-sm">
                  <colgroup>
                    <col className="w-[16%]" />
                    <col className="w-[19%]" />
                    <col className="w-[12%]" />
                    <col className="w-[9%]" />
                    <col className="w-[13%]" />
                    <col className="w-[13%]" />
                    <col className="w-[8%]" />
                    <col className="w-[10%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-surface">
                    <tr className="border-b border-silver text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      <th className="whitespace-nowrap px-5 py-3">Nombre</th>
                      <th className="whitespace-nowrap px-5 py-3">Correo</th>
                      <th className="whitespace-nowrap px-5 py-3">Teléfono</th>
                      <th className="whitespace-nowrap px-5 py-3">Evento</th>
                      <th className="whitespace-nowrap px-5 py-3">Acceso</th>
                      <th className="whitespace-nowrap px-5 py-3">Msj. bienvenida</th>
                      <th className="whitespace-nowrap px-5 py-3">Membresía</th>
                      <th className="whitespace-nowrap px-5 py-3">Vence Skool</th>
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
                        <td className="truncate px-5 py-2.5 text-muted">{c.telefono || "—"}</td>
                        <td className="truncate px-5 py-2.5 text-muted" title={c.evento ?? undefined}>
                          {c.evento || "—"}
                        </td>
                        <td className="px-5 py-2.5">
                          <PillAcceso valor={c.accesoPlataforma} />
                        </td>
                        <td className="truncate px-5 py-2.5 text-muted" title={c.contactoWhats ?? undefined}>
                          {c.contactoWhats || "—"}
                        </td>
                        <td className="truncate px-5 py-2.5 text-muted">{c.tipoMembresia || "—"}</td>
                        <td className="truncate px-5 py-2.5 text-muted">{c.vencimientoSkool || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-none items-center justify-between border-t border-silver/60 px-5 py-3">
                <p className="text-xs text-muted">
                  Mostrando {inicio.toLocaleString("es-MX")}–{fin.toLocaleString("es-MX")} de{" "}
                  {total.toLocaleString("es-MX")}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={pagina <= 1}
                    className="ease-spring flex items-center justify-center rounded-lg border border-silver p-1.5 text-muted transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                  <span className="text-xs font-medium text-foreground">
                    Página {pagina} de {totalPaginas.toLocaleString("es-MX")}
                  </span>
                  <button
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    disabled={pagina >= totalPaginas}
                    className="ease-spring flex items-center justify-center rounded-lg border border-silver p-1.5 text-muted transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {seleccionado && (
        <ClientePanel
          clienteId={seleccionado}
          onClose={() => setSeleccionado(null)}
          onClienteActualizado={actualizarEnLista}
          onClienteEliminado={quitarDeLista}
        />
      )}

      {mostrarNuevo && (
        <NuevoClienteModal
          onClose={() => setMostrarNuevo(false)}
          onCreado={(cliente) => setClientes((prev) => [cliente, ...prev])}
        />
      )}

      {mostrarImportar && (
        <ImportarClientesModal
          onClose={() => setMostrarImportar(false)}
          onTerminado={() => setRecargaKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

function Pildora({
  opciones,
  valor,
  onChange,
}: {
  opciones: { valor: string; label: string }[];
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            onClick={() => onChange(o.valor)}
            className={`ease-spring rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              activo
                ? "border-transparent brand-plate text-white"
                : "border-silver bg-surface-2 text-muted hover:border-silver-deep hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function MultiSelect({
  label,
  todasLabel,
  opciones,
  seleccion,
  onChange,
}: {
  label: string;
  todasLabel: string;
  opciones: string[];
  seleccion: string[];
  onChange: (v: string[]) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, []);

  useEffect(() => {
    if (!abierto) setBusqueda("");
  }, [abierto]);

  function toggle(op: string) {
    onChange(seleccion.includes(op) ? seleccion.filter((s) => s !== op) : [...seleccion, op]);
  }

  const opcionesFiltradas = busqueda.trim()
    ? opciones.filter((op) => op.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : opciones;

  const texto =
    seleccion.length === 0
      ? todasLabel
      : seleccion.length === 1
        ? seleccion[0]
        : `${seleccion.length} ${label}`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAbierto((a) => !a)}
        className={`ease-spring flex max-w-[180px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
          seleccion.length > 0
            ? "border-primary bg-primary-dim text-primary-deep"
            : "border-silver bg-surface-2 text-muted hover:border-silver-deep hover:text-foreground"
        }`}
      >
        <span className="truncate">{texto}</span>
        <ChevronDown className="h-3.5 w-3.5 flex-none" strokeWidth={1.75} />
      </button>

      {abierto && (
        <div className="animate-fade-in-fast absolute left-0 top-[calc(100%+6px)] z-20 w-64 rounded-xl border border-silver bg-surface p-1.5 shadow-xl">
          {opciones.length > 5 && (
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" strokeWidth={1.75} />
              <input
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={`Buscar ${label}…`}
                className="w-full rounded-lg border border-silver bg-surface-2 py-1.5 pl-8 pr-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto">
            {seleccion.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="ease-spring mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-danger transition hover:bg-danger/10"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
                Limpiar selección
              </button>
            )}
            {opcionesFiltradas.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-muted">
                {opciones.length === 0 ? "Sin opciones disponibles." : "Sin resultados."}
              </p>
            ) : (
              opcionesFiltradas.map((op) => {
                const activo = seleccion.includes(op);
                return (
                  <button
                    key={op}
                    onClick={() => toggle(op)}
                    className={`ease-spring flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                      activo ? "bg-primary-dim text-primary-deep font-medium" : "text-foreground hover:bg-surface-2"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 flex-none items-center justify-center rounded border ${
                        activo ? "border-primary bg-primary text-white" : "border-silver"
                      }`}
                    >
                      {activo && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{op}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CampoFecha({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-muted">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-silver bg-surface-2 px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

function PillAcceso({ valor }: { valor: string | null }) {
  const v = (valor ?? "").trim();
  const key = v.toLowerCase();
  const toneClass =
    key === "si"
      ? "bg-success/15 text-success"
      : key === "no"
        ? "bg-danger/15 text-danger"
        : key === "revocado"
          ? "bg-black-access text-white"
          : key.includes("renov")
            ? "bg-primary-dim text-primary-deep"
            : "bg-surface-2 text-muted";
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>
      {v || "—"}
    </span>
  );
}
