import { supabase } from "./supabase";
import { calcularVencimientoSkool, formatearFechaSkool, parsearFechaSkool } from "./fechas";
import { cargarInventarioBoletos, cargarPaisPorEvento, calcularAccesos, regionDeCliente } from "./boletos";
import { filaACliente, fechaSkoolADateOnly, type ClienteRow } from "./supabase-map";
import type { Accesos, Cliente, EstadoMensajeBienvenidaWa, EventoTimeline, TipoEvento, Variante } from "./types";

const PAGINA_INTERNA = 1000;

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Los CSV masivos suelen traer el teléfono como "525512345678" (lada +
// número, sin el "+"). Se antepone si falta para que quede en formato E.164
// — lo necesitan tanto el envío de WhatsApp por GHL como los links de
// wa.me/tel: del panel del cliente.
function normalizarTelefono(telefono?: string | null): string | null {
  const limpio = telefono?.trim();
  if (!limpio) return null;
  return limpio.startsWith("+") ? limpio : `+${limpio}`;
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
      .is("eliminado_en", null)
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

// Aplica los filtros de la lista de clientes (búsqueda, estado, región,
// eventos, membresías, rango de fechas, vigencia) a una query ya iniciada
// con .from("clientes").select(...). Compartida entre listarClientes
// (paginada) y exportarClientes (trae todo lo que matchee) para no duplicar
// la lógica de filtros entre las dos.
function aplicarFiltrosClientes<
  Q extends {
    or: (s: string) => Q;
    ilike: (columna: string, valor: string) => Q;
    eq: (columna: string, valor: string) => Q;
    in: (columna: string, valores: string[]) => Q;
    gte: (columna: string, valor: string) => Q;
    lte: (columna: string, valor: string) => Q;
    lt: (columna: string, valor: string) => Q;
    gt: (columna: string, valor: string) => Q;
  },
>(query: Q, opciones?: FiltrosClientes): Q {
  const ahora = new Date().toISOString();
  const vigencia = opciones?.vigencia ?? "actuales";

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

  return query;
}

export async function listarClientes(opciones?: FiltrosClientes): Promise<{
  clientes: Cliente[];
  total: number;
}> {
  const limite = opciones?.limite ?? 100;
  const pagina = Math.max(1, opciones?.pagina ?? 1);
  const inicio = (pagina - 1) * limite;

  let query = supabase.from("clientes").select("*", { count: "exact" }).is("eliminado_en", null);
  query = aplicarFiltrosClientes(query, opciones);
  query = query.order("orden_csv", { ascending: false }).range(inicio, inicio + limite - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { clientes: (data as ClienteRow[]).map(filaACliente), total: count ?? 0 };
}

const CAP_EXPORTACION = 50_000;

// Trae TODOS los clientes que matcheen los filtros (sin paginar), para el
// botón "Descargar CSV" — a diferencia de listarClientes, que solo trae la
// página actual. Usa el mismo traerTodo() que ya pagina de a 1000 filas
// (límite de PostgREST) para las agregaciones del dashboard.
export async function exportarClientes(opciones?: FiltrosClientes): Promise<Cliente[]> {
  const filas = await traerTodo<ClienteRow>((from, to) => {
    let query = supabase.from("clientes").select("*").is("eliminado_en", null);
    query = aplicarFiltrosClientes(query, opciones);
    return query.order("orden_csv", { ascending: false }).range(from, to);
  });
  if (filas.length > CAP_EXPORTACION) {
    throw new Error("Demasiados resultados para exportar — aplica filtros para reducir la lista.");
  }
  return filas.map(filaACliente);
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
      telefono: normalizarTelefono(input.telefono),
      pais: input.pais?.trim() || null,
      ciudad: input.ciudad?.trim() || null,
      notas: input.notas?.trim() || null,
      // Fecha de alta: siempre el momento real de creación, igual que el
      // resto del CRM (nunca se captura a mano en este formulario).
      fecha_inscripcion: new Date().toISOString(),
      // El alta en Kajabi otorga la oferta ahora mismo (365 días desde hoy),
      // así que el CRM tiene que reflejarlo desde el minuto uno — si se deja
      // vacío, "Pausar/Reanudar" y el cálculo de accesos no tienen de dónde
      // partir.
      fin_acceso: finDeAccesoDentroDeUnAnio(),
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

// Refleja el resultado del envío del WhatsApp de bienvenida (disparado por
// el Workflow de GHL sobre el tag que le pone altaEnGhl). "Número Inválido"
// nunca lo escribe esta función — es una opción exclusivamente manual desde
// el panel del cliente. Sin `autor` (alta de cliente nuevo) no deja rastro
// en la timeline, porque ya queda cubierto por el evento "CREACION"; con
// `autor` sí registra el cambio — `detalle` deja personalizar ese texto
// (reenvío manual vs. confirmación real del webhook de GHL).
export async function marcarMensajeBienvenidaWa(
  id: string,
  estado: Extract<EstadoMensajeBienvenidaWa, "Enviado" | "Pendiente">,
  autor?: string,
  detalle?: string
): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .update({ contacto_whats: estado, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  if (autor) {
    await registrarEvento(id, "EDICION", detalle ?? `Mensaje de Bienvenida WA reenviado — quedó: ${estado}`, autor);
  }
  return filaACliente(data as ClienteRow);
}

// Selección manual desde el desplegable del panel del cliente — a
// diferencia de marcarMensajeBienvenidaWa(), esta sí permite "Número
// Inválido" porque siempre viene de una persona autenticada eligiéndolo a
// propósito, nunca de una automatización.
export async function establecerMensajeBienvenidaWa(
  id: string,
  estado: EstadoMensajeBienvenidaWa,
  autor: string
): Promise<Cliente> {
  const { data: fila, error: errLectura } = await supabase
    .from("clientes")
    .select("contacto_whats")
    .eq("id", id)
    .maybeSingle();
  if (errLectura) throw errLectura;
  if (!fila) throw new Error("Cliente no encontrado");
  const anterior = fila.contacto_whats ?? "—";

  const { data, error } = await supabase
    .from("clientes")
    .update({ contacto_whats: estado, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  if (anterior !== estado) {
    await registrarEvento(id, "EDICION", `Mensaje de Bienvenida WA: "${anterior}" → "${estado}"`, autor);
  }
  return filaACliente(data as ClienteRow);
}

// Completa el teléfono cuando llegó después del alta (típicamente el
// webhook de Hotmart, que trae el dato que Kajabi no pasa). Solo se usa
// cuando el cliente todavía no tenía teléfono — no pisa uno ya capturado.
export async function actualizarTelefonoCliente(id: string, telefono: string): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .update({ telefono: normalizarTelefono(telefono), actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await registrarEvento(id, "EDICION", "Teléfono completado desde Hotmart", "Hotmart");
  return filaACliente(data as ClienteRow);
}

// Recalcula General/VIP/Black con el motor de reglas (REGLAS-BOLETOS-
// SYNERGY.md) a partir de evento + tipo de membresía + acceso a
// plataforma ya guardados. Se llama tras confirmar el acceso en Kajabi,
// igual que hace `npm run asignar-boletos` en lote para el resto del CSV.
export async function recalcularAccesos(id: string): Promise<Cliente> {
  const { data: fila, error: errLectura } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (errLectura) throw errLectura;
  if (!fila) throw new Error("Cliente no encontrado");
  const cliente = filaACliente(fila as ClienteRow);

  const inventario = await cargarInventarioBoletos();
  const { accesos, sinInformacion } = calcularAccesos(
    {
      evento: cliente.evento,
      pais: cliente.pais,
      accesoPlataforma: cliente.accesoPlataforma,
      tipoMembresia: cliente.tipoMembresia,
      fechaInscripcion: cliente.fechaInscripcion,
      finAcceso: cliente.finAcceso,
    },
    inventario
  );

  const { data, error } = await supabase
    .from("clientes")
    .update({ accesos, boletos_sin_informacion: sinInformacion, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return filaACliente(data as ClienteRow);
}

// Se llama tras un envío exitoso de la invitación a Skool: marca el campo
// (ya existente, traído del CSV de origen) y calcula el vencimiento a
// partir de una fecha ancla + duración de la membresía. `fechaAncla` es la
// fecha de inscripción en el alta normal, o el momento de la renovación
// cuando se llama desde `renovarMembresia`.
export async function marcarInvitacionSkoolEnviada(id: string, fechaAncla?: string): Promise<Cliente> {
  const { data: fila, error: errLectura } = await supabase
    .from("clientes")
    .select("fecha_inscripcion,tipo_membresia")
    .eq("id", id)
    .maybeSingle();
  if (errLectura) throw errLectura;
  if (!fila) throw new Error("Cliente no encontrado");

  const ancla = fechaAncla ?? fila.fecha_inscripcion;
  const vencimiento = ancla ? calcularVencimientoSkool(ancla, fila.tipo_membresia) : null;

  const { data, error } = await supabase
    .from("clientes")
    .update({
      invitacion_skool: "Invitación enviada",
      vencimiento_skool: vencimiento ? formatearFechaSkool(vencimiento) : null,
      vencimiento_skool_fecha: fechaSkoolADateOnly(vencimiento),
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return filaACliente(data as ClienteRow);
}

function finDeAccesoDentroDeUnAnio(): string {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 365)).toISOString();
}

// Renovación de membresía (botón "Renovar" en el perfil, solo visible si en
// Kajabi la oferta ya no está activa). Section 4 de REGLAS-BOLETOS-
// SYNERGY.md: el motor de accesos usa "Renov" en Acceso a plataforma —no la
// etiqueta— para aplicar la regla fija por país (2 Generales MX, etc.) en
// vez de la tabla de inventario por evento.
export async function renovarMembresia(id: string, autor: string): Promise<Cliente> {
  const finAcceso = finDeAccesoDentroDeUnAnio();
  const { data, error } = await supabase
    .from("clientes")
    .update({
      etiqueta: "Renovacion",
      tipo_membresia: "12 Meses",
      acceso_plataforma: "Renovación",
      fin_acceso: finAcceso,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  await registrarEvento(id, "EDICION", `Membresía renovada — Fin de acceso: ${formatearFechaSkool(new Date(finAcceso))}`, autor);
  return filaACliente(data as ClienteRow);
}

// Días completos entre dos fechas ISO, usando componentes de fecha (no
// horas/minutos) para no arrastrar diferencias de horario — mismo criterio
// que finDeAccesoDentroDeUnAnio.
function diasEntreFechas(desdeIso: string, hastaIso: string): number {
  const a = new Date(desdeIso);
  const b = new Date(hastaIso);
  const inicioA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const inicioB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((inicioB - inicioA) / 86400000);
}

// Pausa de membresía (botón "Pausar" en el perfil): solo marca la pausa y
// congela cuántos días le quedaban — revocar la oferta en Kajabi lo hace la
// ruta de la API por separado, este función es la parte pura del CRM.
export async function pausarMembresia(id: string, autor: string): Promise<Cliente> {
  const { data: fila, error: errLectura } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (errLectura) throw errLectura;
  if (!fila) throw new Error("Cliente no encontrado");
  const cliente = filaACliente(fila as ClienteRow);
  if (cliente.pausadoEn) throw new Error("Este cliente ya está pausado");

  const ahora = new Date().toISOString();
  const { data, error } = await supabase
    .from("clientes")
    .update({ pausado_en: ahora, fin_acceso_al_pausar: cliente.finAcceso, actualizado_en: ahora })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  await registrarEvento(id, "EDICION", `Membresía pausada por ${autor}`, autor);
  return filaACliente(data as ClienteRow);
}

export type ResultadoReanudar = { cliente: Cliente; fechaCalculada: string; diasRestantes: number };

// Reanuda una membresía pausada: calcula cuántos días le quedaban cuando se
// pausó (fin_acceso_al_pausar − pausado_en) y se los suma a partir de hoy —
// no le regala un año completo de nuevo. El re-otorgamiento en Kajabi (que
// sí arranca su propio contador de 365 días, no editable por API) lo hace
// la ruta de la API; por eso el aviso al usuario para que lo corrija a mano.
export async function reanudarMembresia(id: string, autor: string): Promise<ResultadoReanudar> {
  const { data: fila, error: errLectura } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (errLectura) throw errLectura;
  if (!fila) throw new Error("Cliente no encontrado");
  const cliente = filaACliente(fila as ClienteRow);
  if (!cliente.pausadoEn) throw new Error("Este cliente no está pausado");

  // Respaldo por si finAccesoAlPausar quedó vacío (clientes creados antes de
  // que el alta empezara a guardar fin_acceso): se recalcula desde fecha de
  // inscripción + 365 días en vez de asumir 0 días restantes, que sería
  // castigar al cliente por un hueco de datos que no es su culpa.
  const finAlPausar =
    cliente.finAccesoAlPausar ??
    (cliente.fechaInscripcion
      ? new Date(new Date(cliente.fechaInscripcion).getTime() + 365 * 86400000).toISOString()
      : cliente.pausadoEn);
  const diasRestantes = Math.max(0, diasEntreFechas(cliente.pausadoEn, finAlPausar));

  const ahora = new Date();
  const fechaCalculada = new Date(
    Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + diasRestantes)
  ).toISOString();

  const { data, error } = await supabase
    .from("clientes")
    .update({
      pausado_en: null,
      fin_acceso_al_pausar: null,
      fin_acceso: fechaCalculada,
      actualizado_en: ahora.toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  await registrarEvento(
    id,
    "EDICION",
    `Membresía reanudada por ${autor} — ${diasRestantes} días restantes, fin de acceso recalculado a ${formatearFechaSkool(new Date(fechaCalculada))}`,
    autor
  );

  return { cliente: filaACliente(data as ClienteRow), fechaCalculada, diasRestantes };
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
  llamada?: string | null;
  notasSoporte?: string | null;
  // "YYYY-MM-DD" (input type=date) o null/vacío para limpiarla.
  finAcceso?: string | null;
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
    telefono: normalizarTelefono(cambios.telefono) ?? "—",
    pais: cambios.pais?.trim() || "—",
    ciudad: cambios.ciudad?.trim() || "—",
    notas: cambios.notas?.trim() || "—",
    evento: cambios.evento?.trim() || "—",
    accesoPlataforma: cambios.accesoPlataforma?.trim() || "—",
    tipoMembresia: cambios.tipoMembresia?.trim() || "—",
    vencimientoSkool: cambios.vencimientoSkool?.trim() || "—",
    invitacionSkool: cambios.invitacionSkool?.trim() || "—",
    llamada: cambios.llamada?.trim() || "—",
    notasSoporte: cambios.notasSoporte?.trim() || "—",
  };

  const detalleTextos = CAMPOS_EDITABLES.map(({ key, label }) => ({
    label,
    anterior: (anterior[key as keyof Cliente] as string | null) ?? "—",
    nuevo: nuevos[key],
  }))
    .filter((c) => c.anterior !== c.nuevo)
    .map((c) => `${c.label}: "${c.anterior}" → "${c.nuevo}"`);

  const nuevoEvento = cambios.evento?.trim() || null;
  const nuevoPais = cambios.pais?.trim() || null;
  const region = await regionParaCrearOEditar(nuevoEvento, nuevoPais);

  // Si cambia el tipo de membresía, el vencimiento de Skool se recalcula
  // desde la fecha de inscripción — ignora lo que se haya escrito a mano en
  // ese mismo guardado, para no dejar una fecha inconsistente con la nueva
  // duración.
  const nuevaMembresia = cambios.tipoMembresia?.trim() || null;
  const membresiaCambio = nuevaMembresia !== anterior.tipoMembresia;

  let vencimientoSkoolTexto = cambios.vencimientoSkool?.trim() || null;
  let vencimientoSkoolFecha = fechaSkoolADateOnly(parsearFechaSkool(vencimientoSkoolTexto));
  if (membresiaCambio && anterior.fechaInscripcion) {
    const recalculado = calcularVencimientoSkool(anterior.fechaInscripcion, nuevaMembresia);
    vencimientoSkoolTexto = recalculado ? formatearFechaSkool(recalculado) : null;
    vencimientoSkoolFecha = fechaSkoolADateOnly(recalculado);
  }

  const finAccesoNuevo = cambios.finAcceso?.trim() ? new Date(cambios.finAcceso.trim()).toISOString() : null;
  const finAccesoCambio = finAccesoNuevo !== anterior.finAcceso;

  const detalle = [
    ...detalleTextos,
    membresiaCambio
      ? `Vencimiento Skool recalculado: "${anterior.vencimientoSkool ?? "—"}" → "${vencimientoSkoolTexto ?? "—"}"`
      : null,
    finAccesoCambio
      ? `Fin de acceso: "${anterior.finAcceso ? formatearFechaSkool(new Date(anterior.finAcceso)) : "—"}" → "${finAccesoNuevo ? formatearFechaSkool(new Date(finAccesoNuevo)) : "—"}"`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const { data, error } = await supabase
    .from("clientes")
    .update({
      nombre: cambios.nombre.trim(),
      telefono: normalizarTelefono(cambios.telefono),
      pais: nuevoPais,
      ciudad: cambios.ciudad?.trim() || null,
      notas: cambios.notas?.trim() || null,
      evento: nuevoEvento,
      acceso_plataforma: cambios.accesoPlataforma?.trim() || null,
      tipo_membresia: nuevaMembresia,
      vencimiento_skool: vencimientoSkoolTexto,
      vencimiento_skool_fecha: vencimientoSkoolFecha,
      invitacion_skool: cambios.invitacionSkool?.trim() || null,
      llamada: cambios.llamada?.trim() || null,
      notas_soporte: cambios.notasSoporte?.trim() || null,
      fin_acceso: finAccesoNuevo,
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

  let clienteFinal = filaACliente(data as ClienteRow);
  if (membresiaCambio) {
    clienteFinal = await recalcularAccesos(id);
  }
  return clienteFinal;
}

const ACCESO_LABEL: Record<keyof Accesos, string> = {
  general: "General",
  vip: "VIP",
  black: "Black Access",
};

function textoAcceso(d: { activo: boolean; cantidad: number; variante: Variante }): string {
  return d.activo && d.cantidad > 0 ? `${d.cantidad}${d.variante ? ` · ${d.variante}` : ""}` : "Sin acceso";
}

// Guarda los 3 niveles de acceso (General/VIP/Black) en una sola escritura —
// reemplaza el objeto completo en vez de tocar un nivel a la vez, para que
// "quitarle 2 General y darle 2 VIP" sea una sola operación atómica, no dos
// PATCH separados que podrían dejar al cliente en un estado intermedio si
// uno falla. Registra un solo evento "EDICION" listando qué niveles
// cambiaron (igual que actualizarDatosCliente con los demás campos).
export async function actualizarAccesos(id: string, nuevosAccesos: Accesos, autor: string): Promise<Cliente> {
  const { data: fila, error: errLectura } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (errLectura) throw errLectura;
  if (!fila) throw new Error("Cliente no encontrado");
  const anterior = filaACliente(fila as ClienteRow).accesos;

  const normalizado = (Object.keys(nuevosAccesos) as (keyof Accesos)[]).reduce((acc, nivel) => {
    const cantidad = Math.max(0, Math.floor(nuevosAccesos[nivel].cantidad || 0));
    acc[nivel] = {
      activo: cantidad > 0,
      cantidad,
      variante: cantidad > 0 && nivel !== "black" ? nuevosAccesos[nivel].variante : null,
    };
    return acc;
  }, {} as Accesos);

  const cambios = (Object.keys(normalizado) as (keyof Accesos)[])
    .filter((nivel) => JSON.stringify(anterior[nivel]) !== JSON.stringify(normalizado[nivel]))
    .map((nivel) => `${ACCESO_LABEL[nivel]}: ${textoAcceso(anterior[nivel])} → ${textoAcceso(normalizado[nivel])}`);

  const { data, error } = await supabase
    .from("clientes")
    .update({ accesos: normalizado, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  if (cambios.length) {
    await registrarEvento(id, "EDICION", `Accesos — ${cambios.join(" · ")}`, autor);
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

export type ResultadoRegistrarTagKajabi = { cliente: Cliente; esNuevo: boolean };

// Registra en la timeline que a un cliente se le asignó un tag de Kajabi.
// Dos caminos llegan aquí para el mismo hecho real (el alta del CRM, que
// sabe que otorgar la oferta dispara el tag; y el aviso de Kajabi/Zapier,
// para altas que pasan por fuera del CRM) — por eso es idempotente: si ya
// hay un evento de este mismo tag para este cliente, no lo duplica. Si el
// correo no existe todavía en el CRM (alta directo en Kajabi, típicamente
// una compra por Hotmart que Kajabi detecta solo) se crea el cliente
// primero, tomando el teléfono en espera de Hotmart si ya llegó (ver
// hotmart_pendientes) — devuelve si el cliente es nuevo para que quien
// llama decida si hace falta invitar a Skool / mandar WhatsApp.
export async function registrarTagKajabi(
  email: string,
  nombre: string,
  tagNombre: string
): Promise<ResultadoRegistrarTagKajabi> {
  const id = normalizarEmail(email);
  const { data: existente, error: errLectura } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (errLectura) throw errLectura;

  let cliente: Cliente;
  let esNuevo = false;

  if (existente) {
    cliente = filaACliente(existente as ClienteRow);
  } else {
    esNuevo = true;
    const region = await regionParaCrearOEditar(null, null);
    const telefonoPendiente = await tomarTelefonoPendienteHotmart(id);
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        id,
        nombre: nombre?.trim() || id,
        email: id,
        telefono: telefonoPendiente,
        fecha_inscripcion: new Date().toISOString(),
        fin_acceso: finDeAccesoDentroDeUnAnio(),
        orden_csv: Date.now(),
        region,
      })
      .select("*")
      .single();
    if (error) throw error;
    cliente = filaACliente(data as ClienteRow);
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
  if (!yaRegistrado) {
    await registrarEvento(id, "KAJABI", detalle, "Kajabi");
  }

  return { cliente, esNuevo };
}

// --- Teléfonos de Hotmart en espera (ver hotmart_pendientes en schema.sql) ---

export async function guardarTelefonoPendienteHotmart(
  email: string,
  telefono: string,
  producto: string | null
): Promise<void> {
  const { error } = await supabase
    .from("hotmart_pendientes")
    .upsert({ email: normalizarEmail(email), telefono, producto, recibido_en: new Date().toISOString() });
  if (error) throw error;
}

// Lee el teléfono en espera para este correo y lo borra en el mismo paso
// (una sola vez) — si no hay nada pendiente, null.
async function tomarTelefonoPendienteHotmart(email: string): Promise<string | null> {
  const id = normalizarEmail(email);
  const { data, error } = await supabase
    .from("hotmart_pendientes")
    .select("telefono")
    .eq("email", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  await supabase.from("hotmart_pendientes").delete().eq("email", id);
  return data.telefono;
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

// Archiva el cliente (no lo borra): sale de la lista principal pero
// conserva su fila y su timeline completa, incluido este mismo evento, por
// si hay que auditar quién lo eliminó y cuándo. El borrado real en Kajabi
// se maneja aparte, en la ruta de la API.
export async function eliminarCliente(id: string, autor: string): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .update({ eliminado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  await registrarEvento(id, "ELIMINADO", `Cliente eliminado por ${autor}`, autor);
  return filaACliente(data as ClienteRow);
}

export async function listarEliminados(busqueda?: string): Promise<Cliente[]> {
  let query = supabase.from("clientes").select("*").not("eliminado_en", "is", null);
  const q = sanearBusqueda(busqueda?.trim() ?? "");
  if (q) query = query.or(`nombre.ilike.%${q}%,email.ilike.%${q}%`);
  query = query.order("eliminado_en", { ascending: false }).limit(500);

  const { data, error } = await query;
  if (error) throw error;
  return (data as ClienteRow[]).map(filaACliente);
}
