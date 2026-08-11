import { supabase } from "./supabase";
import { parsearFechaSkool } from "./fechas";
import { cargarPaisPorEvento, regionDeCliente } from "./boletos";
import { filaACliente, fechaSkoolADateOnly, type ClienteRow } from "./supabase-map";
import type { Accesos, Cliente, EventoTimeline, TipoEvento, Variante } from "./types";

const PAGINA_INTERNA = 1000;

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function registrarEvento(
  clienteId: string,
  tipo: TipoEvento,
  detalle: string,
  autor: string
): Promise<void> {
  const { error } = await supabase
    .from("eventos_timeline")
    .insert({ cliente_id: clienteId, tipo, detalle, autor });
  if (error) throw error;
}

// Trae todas las filas de una tabla paginando de PAGINA_INTERNA en
// PAGINA_INTERNA (PostgREST limita cada respuesta a 1000 filas por
// defecto). Se usa solo para agregaciones internas (dashboard, opciones de
// filtro), nunca para listas paginadas de cara al usuario.
async function traerTodo<T>(
  construir: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const todo: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + PAGINA_INTERNA - 1;
    const { data, error } = await construir(from, to);
    if (error) throw error;
    todo.push(...(data ?? []));
    if (!data || data.length < PAGINA_INTERNA) break;
    from += PAGINA_INTERNA;
  }
  return todo;
}

// Solo los campos que usa el dashboard (api/resumen) para sus agregaciones.
export type ClienteResumen = Pick<
  Cliente,
  "id" | "nombre" | "fechaInscripcion" | "creadoEn" | "accesoPlataforma" | "tipoMembresia" | "vencimientoSkool" | "accesos"
>;

type FilaResumen = Pick<
  ClienteRow,
  "id" | "nombre" | "fecha_inscripcion" | "creado_en" | "acceso_plataforma" | "tipo_membresia" | "vencimiento_skool" | "accesos"
>;

export async function listarTodosClientes(): Promise<ClienteResumen[]> {
  const filas = await traerTodo<FilaResumen>((from, to) =>
    supabase
      .from("clientes")
      .select("id,nombre,fecha_inscripcion,creado_en,acceso_plataforma,tipo_membresia,vencimiento_skool,accesos")
      .range(from, to)
  );
  return filas.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    fechaInscripcion: r.fecha_inscripcion,
    creadoEn: r.creado_en,
    accesoPlataforma: r.acceso_plataforma,
    tipoMembresia: r.tipo_membresia,
    vencimientoSkool: r.vencimiento_skool,
    accesos: r.accesos,
  }));
}

export type EstadoFiltro = "todos" | "activos" | "revocados";
export type RegionFiltro = "todos" | "MX" | "US" | "LATAM";
export type VigenciaFiltro = "actuales" | "futuros" | "todos";

export type FiltrosClientes = {
  busqueda?: string;
  estado?: EstadoFiltro;
  region?: RegionFiltro;
  eventos?: string[];
  membresias?: string[];
  desde?: string;
  hasta?: string;
  vencidosAntesDe?: string;
  vigencia?: VigenciaFiltro;
  limite?: number;
  pagina?: number;
};

// Escapa comas (separador de condiciones en `.or()`) y comodines de ILIKE
// en texto libre de búsqueda, para que no rompan el filtro de PostgREST.
function sanearBusqueda(q: string): string {
  return q.replace(/[,%*]/g, "");
}

export async function listarClientes(opciones?: FiltrosClientes): Promise<{
  clientes: Cliente[];
  total: number;
}> {
  const limite = opciones?.limite ?? 100;
  const pagina = Math.max(1, opciones?.pagina ?? 1);
  const inicio = (pagina - 1) * limite;
  const ahora = new Date().toISOString();
  const vigencia = opciones?.vigencia ?? "actuales";

  let query = supabase.from("clientes").select("*", { count: "exact" });

  const q = sanearBusqueda(opciones?.busqueda?.trim() ?? "");
  if (q) query = query.or(`nombre.ilike.%${q}%,email.ilike.%${q}%`);

  if (opciones?.estado === "activos") query = query.ilike("acceso_plataforma", "si");
  if (opciones?.estado === "revocados") query = query.ilike("acceso_plataforma", "revocado");

  if (opciones?.region && opciones.region !== "todos") query = query.eq("region", opciones.region);

  if (opciones?.eventos?.length) query = query.in("evento", opciones.eventos);
  if (opciones?.membresias?.length) query = query.in("tipo_membresia", opciones.membresias);

  if (opciones?.desde) query = query.gte("fecha_inscripcion", opciones.desde);
  if (opciones?.hasta) query = query.lte("fecha_inscripcion", opciones.hasta);

  if (opciones?.vencidosAntesDe) query = query.lt("vencimiento_skool_fecha", opciones.vencidosAntesDe);

  if (vigencia === "actuales") query = query.or(`fecha_inscripcion.is.null,fecha_inscripcion.lte.${ahora}`);
  if (vigencia === "futuros") query = query.gt("fecha_inscripcion", ahora);

  query = query.order("orden_csv", { ascending: false }).range(inicio, inicio + limite - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { clientes: (data as ClienteRow[]).map(filaACliente), total: count ?? 0 };
}

export async function listarOpcionesFiltro(): Promise<{ eventos: string[]; membresias: string[] }> {
  const filas = await traerTodo<{ evento: string | null; tipo_membresia: string | null }>((from, to) =>
    supabase.from("clientes").select("evento,tipo_membresia").range(from, to)
  );
  const eventos = new Set<string>();
  const membresias = new Set<string>();
  for (const f of filas) {
    if (f.evento) eventos.add(f.evento);
    if (f.tipo_membresia) membresias.add(f.tipo_membresia);
  }
  return {
    eventos: Array.from(eventos).sort((a, b) => a.localeCompare(b)),
    membresias: Array.from(membresias).sort((a, b) => a.localeCompare(b)),
  };
}

export async function obtenerCliente(id: string): Promise<Cliente | null> {
  const { data, error } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? filaACliente(data as ClienteRow) : null;
}

export async function listarEventos(clienteId: string): Promise<EventoTimeline[]> {
  const { data, error } = await supabase
    .from("eventos_timeline")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("fecha", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    clienteId: e.cliente_id,
    tipo: e.tipo,
    detalle: e.detalle,
    autor: e.autor,
    fecha: e.fecha,
  }));
}

export async function listarEventosGlobal(limite = 15): Promise<EventoTimeline[]> {
  // La IMPORTACION masiva del CSV genera miles de eventos idénticos con el
  // mismo timestamp: no aportan nada en "Actividad reciente", se excluyen.
  const { data, error } = await supabase
    .from("eventos_timeline")
    .select("*")
    .neq("tipo", "IMPORTACION")
    .order("fecha", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    clienteId: e.cliente_id,
    tipo: e.tipo,
    detalle: e.detalle,
    autor: e.autor,
    fecha: e.fecha,
  }));
}

async function regionParaCrearOEditar(evento: string | null, pais: string | null): Promise<string> {
  const mapa = await cargarPaisPorEvento();
  return regionDeCliente(evento, pais, mapa);
}

export async function crearCliente(input: {
  nombre: string;
  email: string;
  telefono?: string | null;
  pais?: string | null;
  ciudad?: string | null;
  notas?: string | null;
  evento?: string | null;
  tipoMembresia?: string | null;
  etiqueta?: string | null;
  autor: string;
}): Promise<Cliente> {
  const id = normalizarEmail(input.email);
  const { data: existente } = await supabase.from("clientes").select("id").eq("id", id).maybeSingle();
  if (existente) throw new Error("Ya existe un cliente con ese correo");

  const evento = input.evento?.trim() || null;
  const region = await regionParaCrearOEditar(evento, input.pais ?? null);

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      id,
      nombre: input.nombre.trim(),
      email: id,
      telefono: input.telefono?.trim() || null,
      pais: input.pais?.trim() || null,
      ciudad: input.ciudad?.trim() || null,
      notas: input.notas?.trim() || null,
      // Fecha de alta: siempre el momento real de creación, igual que el
      // resto del CRM (nunca se captura a mano en este formulario).
      fecha_inscripcion: new Date().toISOString(),
      evento,
      tipo_membresia: input.tipoMembresia?.trim() || null,
      etiqueta: input.etiqueta?.trim() || null,
      // Muy por encima de cualquier fila del CSV: los altas manuales
      // siempre encabezan la lista, como corresponde a "lo más reciente".
      orden_csv: Date.now(),
      region,
    })
    .select("*")
    .single();
  if (error) throw error;

  await registrarEvento(id, "CREACION", `Cliente creado por ${input.autor}`, input.autor);
  return filaACliente(data as ClienteRow);
}

// Se llama tras un otorgamiento exitoso de la oferta en Kajabi: refleja en
// el CRM que el acceso sí se dio, de la misma forma en que ya lo hacía el
// CSV de origen ("Sí" en la columna Acceso a plataforma).
export async function marcarAccesoPlataforma(id: string, valor: string): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .update({ acceso_plataforma: valor, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return filaACliente(data as ClienteRow);
}

const CAMPOS_EDITABLES: { key: keyof CambiosDatosCliente; columna: string; label: string }[] = [
  { key: "nombre", columna: "nombre", label: "Nombre" },
  { key: "telefono", columna: "telefono", label: "Teléfono" },
  { key: "pais", columna: "pais", label: "País" },
  { key: "ciudad", columna: "ciudad", label: "Ciudad" },
  { key: "notas", columna: "notas", label: "Notas" },
  { key: "evento", columna: "evento", label: "Evento" },
  { key: "accesoPlataforma", columna: "acceso_plataforma", label: "Acceso a plataforma" },
  { key: "tipoMembresia", columna: "tipo_membresia", label: "Tipo de membresía" },
  { key: "vencimientoSkool", columna: "vencimiento_skool", label: "Vencimiento Skool" },
  { key: "invitacionSkool", columna: "invitacion_skool", label: "Invitación de Skool" },
  { key: "contactoWhats", columna: "contacto_whats", label: "Contacto en WhatsApp" },
  { key: "llamada", columna: "llamada", label: "Llamada" },
  { key: "notasSoporte", columna: "notas_soporte", label: "Notas de soporte técnico" },
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
  const { data: filaAnterior, error: errLectura } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (errLectura) throw errLectura;
  if (!filaAnterior) throw new Error("Cliente no encontrado");
  const anterior = filaACliente(filaAnterior as ClienteRow);

  const nuevos: Record<string, string> = {
    nombre: cambios.nombre.trim(),
    telefono: cambios.telefono?.trim() || "—",
    pais: cambios.pais?.trim() || "—",
    ciudad: cambios.ciudad?.trim() || "—",
    notas: cambios.notas?.trim() || "—",
    evento: cambios.evento?.trim() || "—",
    accesoPlataforma: cambios.accesoPlataforma?.trim() || "—",
    tipoMembresia: cambios.tipoMembresia?.trim() || "—",
    vencimientoSkool: cambios.vencimientoSkool?.trim() || "—",
    invitacionSkool: cambios.invitacionSkool?.trim() || "—",
    contactoWhats: cambios.contactoWhats?.trim() || "—",
    llamada: cambios.llamada?.trim() || "—",
    notasSoporte: cambios.notasSoporte?.trim() || "—",
  };

  const detalle = CAMPOS_EDITABLES.map(({ key, label }) => ({
    label,
    anterior: (anterior[key as keyof Cliente] as string | null) ?? "—",
    nuevo: nuevos[key],
  }))
    .filter((c) => c.anterior !== c.nuevo)
    .map((c) => `${c.label}: "${c.anterior}" → "${c.nuevo}"`)
    .join(" · ");

  const nuevoEvento = cambios.evento?.trim() || null;
  const nuevoPais = cambios.pais?.trim() || null;
  const region = await regionParaCrearOEditar(nuevoEvento, nuevoPais);
  const vencimientoSkoolFecha = fechaSkoolADateOnly(parsearFechaSkool(cambios.vencimientoSkool?.trim() || null));

  const { data, error } = await supabase
    .from("clientes")
    .update({
      nombre: cambios.nombre.trim(),
      telefono: cambios.telefono?.trim() || null,
      pais: nuevoPais,
      ciudad: cambios.ciudad?.trim() || null,
      notas: cambios.notas?.trim() || null,
      evento: nuevoEvento,
      acceso_plataforma: cambios.accesoPlataforma?.trim() || null,
      tipo_membresia: cambios.tipoMembresia?.trim() || null,
      vencimiento_skool: cambios.vencimientoSkool?.trim() || null,
      vencimiento_skool_fecha: vencimientoSkoolFecha,
      invitacion_skool: cambios.invitacionSkool?.trim() || null,
      contacto_whats: cambios.contactoWhats?.trim() || null,
      llamada: cambios.llamada?.trim() || null,
      notas_soporte: cambios.notasSoporte?.trim() || null,
      region,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  if (detalle) {
    await registrarEvento(id, "EDICION", detalle, autor);
  }
  return filaACliente(data as ClienteRow);
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
  const { data: fila, error: errLectura } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (errLectura) throw errLectura;
  if (!fila) throw new Error("Cliente no encontrado");
  const cliente = filaACliente(fila as ClienteRow);

  const detalleAcceso = cliente.accesos[nivel];
  if (detalleAcceso.activo === activo) return cliente;

  const nuevoDetalle = { ...detalleAcceso, activo };
  if (activo && nuevoDetalle.cantidad === 0) {
    nuevoDetalle.cantidad = 1;
    if (nivel !== "black" && !nuevoDetalle.variante) {
      const p = (cliente.pais ?? "").toLowerCase();
      nuevoDetalle.variante = p.includes("méxico") || p.includes("mexico") ? "MX" : "US";
    }
  }
  const nuevosAccesos = { ...cliente.accesos, [nivel]: nuevoDetalle };

  const { data, error } = await supabase
    .from("clientes")
    .update({ accesos: nuevosAccesos, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  await registrarEvento(
    id,
    ACCESO_TIPO[nivel],
    `Acceso ${ACCESO_LABEL[nivel]}: ${activo ? "activado" : "desactivado"}`,
    autor
  );
  return filaACliente(data as ClienteRow);
}

export async function actualizarDetalleAcceso(
  id: string,
  nivel: keyof Accesos,
  cambios: { cantidad?: number; variante?: Variante },
  autor: string
): Promise<Cliente> {
  const { data: fila, error: errLectura } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (errLectura) throw errLectura;
  if (!fila) throw new Error("Cliente no encontrado");
  const cliente = filaACliente(fila as ClienteRow);

  const anterior = cliente.accesos[nivel];
  const nuevoDetalle = { ...anterior };
  if (cambios.cantidad !== undefined) {
    nuevoDetalle.cantidad = Math.max(0, Math.floor(cambios.cantidad));
    nuevoDetalle.activo = nuevoDetalle.cantidad > 0;
  }
  if (cambios.variante !== undefined) {
    nuevoDetalle.variante = cambios.variante;
  }
  const nuevosAccesos = { ...cliente.accesos, [nivel]: nuevoDetalle };

  const { data, error } = await supabase
    .from("clientes")
    .update({ accesos: nuevosAccesos, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  if (anterior.cantidad !== nuevoDetalle.cantidad || anterior.variante !== nuevoDetalle.variante) {
    await registrarEvento(
      id,
      ACCESO_TIPO[nivel],
      `Acceso ${ACCESO_LABEL[nivel]} editado: ${anterior.cantidad}${anterior.variante ? " " + anterior.variante : ""} → ${nuevoDetalle.cantidad}${nuevoDetalle.variante ? " " + nuevoDetalle.variante : ""}`,
      autor
    );
  }
  return filaACliente(data as ClienteRow);
}

export async function actualizarTags(id: string, tags: string[], autor: string): Promise<Cliente> {
  const { data: fila, error: errLectura } = await supabase
    .from("clientes")
    .select("tags")
    .eq("id", id)
    .maybeSingle();
  if (errLectura) throw errLectura;
  if (!fila) throw new Error("Cliente no encontrado");
  const anteriores: string[] = fila.tags ?? [];

  const { data, error } = await supabase
    .from("clientes")
    .update({ tags, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  const agregados = tags.filter((t) => !anteriores.includes(t));
  const quitados = anteriores.filter((t) => !tags.includes(t));
  const detalle = [agregados.length ? `+ ${agregados.join(", ")}` : null, quitados.length ? `− ${quitados.join(", ")}` : null]
    .filter(Boolean)
    .join(" · ");
  if (detalle) await registrarEvento(id, "EDICION", `Tags: ${detalle}`, autor);

  return filaACliente(data as ClienteRow);
}

export async function agregarNota(id: string, nota: string, autor: string): Promise<void> {
  const { data, error } = await supabase.from("clientes").select("id").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Cliente no encontrado");
  await registrarEvento(id, "NOTA", nota.trim(), autor);
}

export async function vincularKajabiContactId(id: string, kajabiContactId: string): Promise<void> {
  const { error } = await supabase.from("clientes").update({ kajabi_contact_id: kajabiContactId }).eq("id", id);
  if (error) throw error;
}

// Registra en la timeline que a un cliente se le asignó un tag de Kajabi.
// Dos caminos llegan aquí para el mismo hecho real (el alta del CRM, que
// sabe que otorgar la oferta dispara el tag; y el aviso de Kajabi/Zapier,
// para altas que pasan por fuera del CRM) — por eso es idempotente: si ya
// hay un evento de este mismo tag para este cliente, no lo duplica. Si el
// correo no existe todavía en el CRM (alta directo en Kajabi) se crea el
// cliente primero, para que el tag tenga dónde caer.
export async function registrarTagKajabi(email: string, nombre: string, tagNombre: string): Promise<void> {
  const id = normalizarEmail(email);
  const { data: existente, error: errLectura } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (errLectura) throw errLectura;

  if (!existente) {
    const region = await regionParaCrearOEditar(null, null);
    const { error } = await supabase.from("clientes").insert({
      id,
      nombre: nombre?.trim() || id,
      email: id,
      orden_csv: Date.now(),
      region,
    });
    if (error) throw error;
    await registrarEvento(id, "CREACION", "Cliente creado automáticamente desde Kajabi", "Kajabi");
  }

  const detalle = `Tag de Kajabi asignado: "${tagNombre}"`;
  const { data: yaRegistrado, error: errDup } = await supabase
    .from("eventos_timeline")
    .select("id")
    .eq("cliente_id", id)
    .eq("tipo", "KAJABI")
    .eq("detalle", detalle)
    .maybeSingle();
  if (errDup) throw errDup;
  if (yaRegistrado) return;

  await registrarEvento(id, "KAJABI", detalle, "Kajabi");
}

const CURSOR_SYNC_KAJABI = "ultimo_customer_creado_en";

export async function obtenerCursorSyncKajabi(): Promise<string | null> {
  const { data, error } = await supabase
    .from("kajabi_sync_estado")
    .select("valor")
    .eq("clave", CURSOR_SYNC_KAJABI)
    .maybeSingle();
  if (error) throw error;
  return data?.valor ?? null;
}

export async function guardarCursorSyncKajabi(valor: string): Promise<void> {
  const { error } = await supabase
    .from("kajabi_sync_estado")
    .upsert({ clave: CURSOR_SYNC_KAJABI, valor, actualizado_en: new Date().toISOString() });
  if (error) throw error;
}
