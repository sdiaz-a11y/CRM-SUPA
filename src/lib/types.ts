export type Variante = "MX" | "US" | null;

export type AccesoDetalle = {
  activo: boolean;
  cantidad: number;
  variante: Variante;
};

export type Accesos = {
  general: AccesoDetalle;
  vip: AccesoDetalle;
  black: AccesoDetalle;
};

export type Cliente = {
  id: string; // email normalizado, identificador principal
  nombre: string;
  email: string;
  telefono: string | null;
  pais: string | null;
  ciudad: string | null;
  notas: string | null;
  fechaInscripcion: string | null; // ISO
  finAcceso: string | null; // ISO — FIN DEL ACCESO del CSV de origen
  boletosSinInformacion: boolean; // true si el evento no existe en la tabla de inventario y no hay override
  accesos: Accesos;

  // Posición en el CSV de origen (número de fila de la última aparición de
  // este correo). Es el criterio de orden de la lista principal: la fila
  // más alta del CSV = la más reciente = primero en el CRM. Clientes creados
  // manualmente reciben un valor mayor a cualquier fila del CSV para
  // aparecer arriba de todos.
  ordenCsv: number;

  // Columnas B–N del CSV de origen: seguimiento del evento/membresía.
  fechaEvento: string | null; // Fecha Ev.
  evento: string | null; // EVENTO
  accesoPlataforma: string | null; // Acceso a plataforma
  tipoMembresia: string | null; // Tipo de Membresia
  vencimientoSkool: string | null; // Vencimiento Skool
  invitacionSkool: string | null; // Invitacion de Skool
  contactoWhats: string | null; // Contacto en Whats
  llamada: string | null; // Llamada

  // Columna U: notas del equipo de soporte técnico.
  notasSoporte: string | null;

  // Clasificación propia del CRM, independiente de los tags de Kajabi.
  etiqueta: string | null;

  // Tags asignados desde el panel del cliente (catálogo "Biblioteca"),
  // distintos de "etiqueta": un cliente puede tener varios.
  tags: string[];

  // Id del contacto en Kajabi, si ya se creó/vinculó ahí.
  kajabiContactId: string | null;

  creadoEn: string; // ISO
  actualizadoEn: string; // ISO
};

export type TipoEvento =
  | "CREACION"
  | "EDICION"
  | "NOTA"
  | "ACCESO_GENERAL"
  | "ACCESO_VIP"
  | "ACCESO_BLACK"
  | "IMPORTACION"
  | "KAJABI";

export type EventoTimeline = {
  id: string;
  clienteId: string;
  tipo: TipoEvento;
  detalle: string;
  autor: string;
  fecha: string; // ISO
};

export type Db = {
  clientes: Cliente[];
  eventos: EventoTimeline[];
};
