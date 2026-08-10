import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Accesos, Cliente, Db, EventoTimeline, TipoEvento } from "./types";
import { parsearFechaSkool } from "./fechas";
import { cargarPaisPorEvento } from "./boletos";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

async function leerDb(): Promise<Db> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(raw) as Db;
  } catch {
    return { clientes: [], eventos: [] };
  }
}

async function escribirDb(db: Db): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function registrarEvento(
  db: Db,
  clienteId: string,
  tipo: TipoEvento,
  detalle: string,
  autor: string
): Promise<void> {
  const evento: EventoTimeline = {
    id: randomUUID(),
    clienteId,
    tipo,
    detalle,
    autor,
    fecha: new Date().toISOString(),
  };
  db.eventos.push(evento);
}

export async function listarTodosClientes(): Promise<Cliente[]> {
  const db = await leerDb();
  return db.clientes;
}

export type EstadoFiltro = "todos" | "activos" | "revocados";
export type RegionFiltro = "todos" | "MX" | "US" | "LATAM";
export type VigenciaFiltro = "actuales" | "futuros" | "todos";

export type FiltrosClientes = {
  busqueda?: string;
  estado?: EstadoFiltro;
  region?: RegionFiltro;
  eventos?: string[]; // vacío = sin filtro; coincide si el evento del cliente está en la lista
  membresias?: string[]; // vacío = sin filtro
  desde?: string; // ISO — fechaInscripcion >=
  hasta?: string; // ISO — fechaInscripcion <=
  vencidosAntesDe?: string; // ISO — vencimientoSkool <
  // "actuales" (default): fechaInscripcion <= hoy — la lista principal solo
  // muestra altas ya ocurridas. "futuros": solo fechas de inscripción
  // posteriores a hoy (registros con fecha adelantada en el CSV de origen).
  vigencia?: VigenciaFiltro;
  limite?: number;
  pagina?: number;
};

// Clasifica la región de un cliente por el evento al que asistió (columna
// País de "Asignacion de boletos.csv": EPMX-*→MX, EPUS-*→US, webinars
// LATAM→LATAM, etc.) — más confiable que el país capturado a mano. CAN se
// agrupa con LATAM porque no hay un filtro dedicado para Canadá. Si el
// evento no está en la tabla (o el cliente no tiene evento), cae al país
// capturado a mano como respaldo.
function regionDeCliente(c: Cliente, paisPorEvento: Map<string, string>): RegionFiltro {
  const eventoKey = (c.evento ?? "").trim().toLowerCase();
  const paisEvento = eventoKey ? paisPorEvento.get(eventoKey) : undefined;
  if (paisEvento === "MX") return "MX";
  if (paisEvento === "US") return "US";
  if (paisEvento === "LATAM" || paisEvento === "CAN") return "LATAM";

  const p = (c.pais ?? "").toLowerCase();
  if (p.includes("méxico") || p.includes("mexico")) return "MX";
  if (p.includes("estados unidos") || p.includes("canadá") || p.includes("canada")) return "US";
  return "LATAM";
}

export async function listarClientes(opciones?: FiltrosClientes): Promise<{
  clientes: Cliente[];
  total: number;
}> {
  const db = await leerDb();
  const q = opciones?.busqueda?.trim().toLowerCase();
  const desde = opciones?.desde ? new Date(opciones.desde) : null;
  const hasta = opciones?.hasta ? new Date(opciones.hasta) : null;
  const vencidosAntesDe = opciones?.vencidosAntesDe ? new Date(opciones.vencidosAntesDe) : null;
  const vigencia = opciones?.vigencia ?? "actuales";
  const ahora = new Date();
  const paisPorEvento =
    opciones?.region && opciones.region !== "todos" ? await cargarPaisPorEvento() : new Map<string, string>();

  const filtrados = db.clientes.filter((c) => {
    if (q && !c.nombre.toLowerCase().includes(q) && !c.email.includes(q)) return false;

    if (vigencia !== "todos") {
      const esFuturo = !!c.fechaInscripcion && new Date(c.fechaInscripcion) > ahora;
      if (vigencia === "actuales" && esFuturo) return false;
      if (vigencia === "futuros" && !esFuturo) return false;
    }

    if (opciones?.estado === "activos" && (c.accesoPlataforma ?? "").toLowerCase() !== "si") return false;
    if (opciones?.estado === "revocados" && (c.accesoPlataforma ?? "").toLowerCase() !== "revocado")
      return false;

    if (opciones?.region && opciones.region !== "todos" && regionDeCliente(c, paisPorEvento) !== opciones.region)
      return false;

    if (opciones?.eventos?.length && !(c.evento && opciones.eventos.includes(c.evento))) return false;

    if (opciones?.membresias?.length && !(c.tipoMembresia && opciones.membresias.includes(c.tipoMembresia)))
      return false;

    const fechaInscripcion = c.fechaInscripcion ? new Date(c.fechaInscripcion) : null;
    if (desde && (!fechaInscripcion || fechaInscripcion < desde)) return false;
    if (hasta && (!fechaInscripcion || fechaInscripcion > hasta)) return false;

    if (vencidosAntesDe) {
      const venceSkool = parsearFechaSkool(c.vencimientoSkool);
      if (!venceSkool || venceSkool >= vencidosAntesDe) return false;
    }

    return true;
  });

  // Más nuevo primero: la fila más alta del CSV de origen va primero (así
  // caían en el Sheets — la última fila es la más reciente).
  const ordenados = [...filtrados].sort((a, b) => b.ordenCsv - a.ordenCsv);

  const limite = opciones?.limite ?? 100;
  const pagina = Math.max(1, opciones?.pagina ?? 1);
  const inicio = (pagina - 1) * limite;
  return { clientes: ordenados.slice(inicio, inicio + limite), total: ordenados.length };
}

export async function listarOpcionesFiltro(): Promise<{ eventos: string[]; membresias: string[] }> {
  const db = await leerDb();
  const eventos = new Set<string>();
  const membresias = new Set<string>();
  for (const c of db.clientes) {
    if (c.evento) eventos.add(c.evento);
    if (c.tipoMembresia) membresias.add(c.tipoMembresia);
  }
  return {
    eventos: Array.from(eventos).sort((a, b) => a.localeCompare(b)),
    membresias: Array.from(membresias).sort((a, b) => a.localeCompare(b)),
  };
}

export async function obtenerCliente(id: string): Promise<Cliente | null> {
  const db = await leerDb();
  return db.clientes.find((c) => c.id === id) ?? null;
}

export async function listarEventos(clienteId: string): Promise<EventoTimeline[]> {
  const db = await leerDb();
  return db.eventos
    .filter((e) => e.clienteId === clienteId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function listarEventosGlobal(limite = 15): Promise<EventoTimeline[]> {
  const db = await leerDb();
  // La IMPORTACION masiva del CSV genera miles de eventos idénticos con el
  // mismo timestamp: no aportan nada en "Actividad reciente", se excluyen.
  return db.eventos
    .filter((e) => e.tipo !== "IMPORTACION")
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, limite);
}

export async function crearCliente(input: {
  nombre: string;
  email: string;
  telefono?: string | null;
  pais?: string | null;
  ciudad?: string | null;
  notas?: string | null;
  fechaInscripcion?: string | null;
  autor: string;
}): Promise<Cliente> {
  const db = await leerDb();
  const id = normalizarEmail(input.email);
  if (db.clientes.some((c) => c.id === id)) {
    throw new Error("Ya existe un cliente con ese correo");
  }
  const ahora = new Date().toISOString();
  const cliente: Cliente = {
    id,
    nombre: input.nombre.trim(),
    email: id,
    telefono: input.telefono?.trim() || null,
    pais: input.pais?.trim() || null,
    ciudad: input.ciudad?.trim() || null,
    notas: input.notas?.trim() || null,
    fechaInscripcion: input.fechaInscripcion || null,
    finAcceso: null,
    boletosSinInformacion: false,
    // Muy por encima de cualquier fila del CSV: los altas manuales siempre
    // encabezan la lista, como corresponde a "lo más reciente".
    ordenCsv: Date.now(),
    accesos: {
      general: { activo: false, cantidad: 0, variante: null },
      vip: { activo: false, cantidad: 0, variante: null },
      black: { activo: false, cantidad: 0, variante: null },
    },
    fechaEvento: null,
    evento: null,
    accesoPlataforma: null,
    tipoMembresia: null,
    vencimientoSkool: null,
    invitacionSkool: null,
    contactoWhats: null,
    llamada: null,
    notasSoporte: null,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
  db.clientes.push(cliente);
  await registrarEvento(db, id, "CREACION", `Cliente creado por ${input.autor}`, input.autor);
  await escribirDb(db);
  return cliente;
}

const CAMPOS_EDITABLES: { key: keyof CambiosDatosCliente; label: string }[] = [
  { key: "nombre", label: "Nombre" },
  { key: "telefono", label: "Teléfono" },
  { key: "pais", label: "País" },
  { key: "ciudad", label: "Ciudad" },
  { key: "notas", label: "Notas" },
  { key: "evento", label: "Evento" },
  { key: "accesoPlataforma", label: "Acceso a plataforma" },
  { key: "tipoMembresia", label: "Tipo de membresía" },
  { key: "vencimientoSkool", label: "Vencimiento Skool" },
  { key: "invitacionSkool", label: "Invitación de Skool" },
  { key: "contactoWhats", label: "Contacto en WhatsApp" },
  { key: "llamada", label: "Llamada" },
  { key: "notasSoporte", label: "Notas de soporte técnico" },
];

type CambiosDatosCliente = {
  nombre: string;
  telefono?: string | null;
  pais?: string | null;
  ciudad?: string | null;
  notas?: string | null;
  evento?: string | null;
  accesoPlataforma?: string | null;
  tipoMembresia?: string | null;
  vencimientoSkool?: string | null;
  invitacionSkool?: string | null;
  contactoWhats?: string | null;
  llamada?: string | null;
  notasSoporte?: string | null;
};

export async function actualizarDatosCliente(
  id: string,
  cambios: CambiosDatosCliente,
  autor: string
): Promise<Cliente> {
  const db = await leerDb();
  const cliente = db.clientes.find((c) => c.id === id);
  if (!cliente) throw new Error("Cliente no encontrado");

  const anterior = { ...cliente };

  cliente.nombre = cambios.nombre.trim();
  cliente.telefono = cambios.telefono?.trim() || null;
  cliente.pais = cambios.pais?.trim() || null;
  cliente.ciudad = cambios.ciudad?.trim() || null;
  cliente.notas = cambios.notas?.trim() || null;
  cliente.evento = cambios.evento?.trim() || null;
  cliente.accesoPlataforma = cambios.accesoPlataforma?.trim() || null;
  cliente.tipoMembresia = cambios.tipoMembresia?.trim() || null;
  cliente.vencimientoSkool = cambios.vencimientoSkool?.trim() || null;
  cliente.invitacionSkool = cambios.invitacionSkool?.trim() || null;
  cliente.contactoWhats = cambios.contactoWhats?.trim() || null;
  cliente.llamada = cambios.llamada?.trim() || null;
  cliente.notasSoporte = cambios.notasSoporte?.trim() || null;
  cliente.actualizadoEn = new Date().toISOString();

  const detalle = CAMPOS_EDITABLES.map(({ key, label }) => ({
    label,
    anterior: (anterior[key as keyof Cliente] as string | null) ?? "—",
    nuevo: (cliente[key as keyof Cliente] as string | null) ?? "—",
  }))
    .filter((c) => c.anterior !== c.nuevo)
    .map((c) => `${c.label}: "${c.anterior}" → "${c.nuevo}"`)
    .join(" · ");
  if (detalle) {
    await registrarEvento(db, id, "EDICION", detalle, autor);
  }
  await escribirDb(db);
  return cliente;
}

const ACCESO_LABEL: Record<keyof Accesos, string> = {
  general: "General",
  vip: "VIP",
  black: "Black Access",
};
const ACCESO_TIPO: Record<keyof Accesos, TipoEvento> = {
  general: "ACCESO_GENERAL",
  vip: "ACCESO_VIP",
  black: "ACCESO_BLACK",
};

export async function actualizarAcceso(
  id: string,
  nivel: keyof Accesos,
  activo: boolean,
  autor: string
): Promise<Cliente> {
  const db = await leerDb();
  const cliente = db.clientes.find((c) => c.id === id);
  if (!cliente) throw new Error("Cliente no encontrado");

  const detalle = cliente.accesos[nivel];
  if (detalle.activo === activo) return cliente;

  detalle.activo = activo;
  if (activo && detalle.cantidad === 0) {
    detalle.cantidad = 1;
    if (nivel !== "black" && !detalle.variante) {
      const esMx = (cliente.pais ?? "").toLowerCase().includes("méxico") || (cliente.pais ?? "").toLowerCase().includes("mexico");
      detalle.variante = esMx ? "MX" : "US";
    }
  }
  cliente.actualizadoEn = new Date().toISOString();

  await registrarEvento(
    db,
    id,
    ACCESO_TIPO[nivel],
    `Acceso ${ACCESO_LABEL[nivel]}: ${activo ? "activado" : "desactivado"}`,
    autor
  );
  await escribirDb(db);
  return cliente;
}

export async function actualizarDetalleAcceso(
  id: string,
  nivel: keyof Accesos,
  cambios: { cantidad?: number; variante?: Accesos["general"]["variante"] },
  autor: string
): Promise<Cliente> {
  const db = await leerDb();
  const cliente = db.clientes.find((c) => c.id === id);
  if (!cliente) throw new Error("Cliente no encontrado");

  const detalle = cliente.accesos[nivel];
  const cantidadAnterior = detalle.cantidad;
  const varianteAnterior = detalle.variante;

  if (cambios.cantidad !== undefined) {
    detalle.cantidad = Math.max(0, Math.floor(cambios.cantidad));
    detalle.activo = detalle.cantidad > 0;
  }
  if (cambios.variante !== undefined) {
    detalle.variante = cambios.variante;
  }
  cliente.actualizadoEn = new Date().toISOString();

  if (cantidadAnterior !== detalle.cantidad || varianteAnterior !== detalle.variante) {
    await registrarEvento(
      db,
      id,
      ACCESO_TIPO[nivel],
      `Acceso ${ACCESO_LABEL[nivel]} editado: ${cantidadAnterior}${varianteAnterior ? " " + varianteAnterior : ""} → ${detalle.cantidad}${detalle.variante ? " " + detalle.variante : ""}`,
      autor
    );
  }
  await escribirDb(db);
  return cliente;
}

export async function agregarNota(id: string, nota: string, autor: string): Promise<void> {
  const db = await leerDb();
  const cliente = db.clientes.find((c) => c.id === id);
  if (!cliente) throw new Error("Cliente no encontrado");
  await registrarEvento(db, id, "NOTA", nota.trim(), autor);
  await escribirDb(db);
}
