// Cliente mínimo para la API pública de Kajabi (OAuth2 client_credentials).
// Site "Synergy Education" y oferta "Club Sinergético" (título interno
// "CLUB SINERGÉTICO ORIGINAL") — IDs confirmados a mano contra la cuenta real.
const KAJABI_API = "https://api.kajabi.com/v1";
export const KAJABI_SITE_ID = "2147540333";
export const KAJABI_OFFER_ID_CLUB_SINERGETICO = "2148198523";
export const KAJABI_TAG_MIEMBRO_DEL_CLUB = "Miembro del club";

type TokenCache = { token: string; expiraEn: number };
let tokenCache: TokenCache | null = null;

async function obtenerToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiraEn) return tokenCache.token;

  const clientId = process.env.KAJABI_CLIENT_ID;
  const clientSecret = process.env.KAJABI_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Faltan KAJABI_CLIENT_ID / KAJABI_CLIENT_SECRET en las variables de entorno");
  }

  const res = await fetch(`${KAJABI_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Kajabi OAuth falló (${res.status}): ${await res.text()}`);
  const data = await res.json();

  // Vigencia real 604800s (7 días); se resta 1 minuto de margen.
  tokenCache = { token: data.access_token, expiraEn: Date.now() + (data.expires_in - 60) * 1000 };
  return tokenCache.token;
}

async function kajabiFetch(path: string, init?: RequestInit): Promise<unknown> {
  const token = await obtenerToken();
  const res = await fetch(`${KAJABI_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`Kajabi ${path} falló (${res.status}): ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}

type ContactoBuscado = {
  data: { id: string; attributes: { email: string } }[];
};

export async function buscarContactoPorCorreo(email: string): Promise<string | null> {
  const params = new URLSearchParams({
    "filter[site_id]": KAJABI_SITE_ID,
    "filter[search]": email,
  });
  const data = (await kajabiFetch(`/contacts?${params}`)) as ContactoBuscado;
  const correoNormalizado = email.trim().toLowerCase();
  const encontrado = data.data.find((c) => c.attributes.email?.trim().toLowerCase() === correoNormalizado);
  return encontrado?.id ?? null;
}

type ContactoCreado = { data: { id: string } };

export async function crearContacto(nombre: string, email: string): Promise<string> {
  const body = {
    data: {
      type: "contacts",
      // subscribed: true suscribe al contacto a los correos de marketing de
      // Kajabi desde el alta — igual que si hubiera marcado la casilla al
      // comprar directamente en Kajabi.
      attributes: { name: nombre, email, subscribed: true },
      relationships: { site: { data: { id: KAJABI_SITE_ID, type: "sites" } } },
    },
  };
  const data = (await kajabiFetch("/contacts", {
    method: "POST",
    body: JSON.stringify(body),
  })) as ContactoCreado;
  return data.data.id;
}

async function actualizarContactoExistente(contactId: string, nombre: string): Promise<void> {
  await kajabiFetch(`/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify({
      data: { type: "contacts", id: contactId, attributes: { name: nombre, subscribed: true } },
    }),
  });
}

export async function obtenerOCrearContacto(nombre: string, email: string): Promise<string> {
  const existente = await buscarContactoPorCorreo(email);
  if (existente) {
    // Si el contacto ya existía en Kajabi (p. ej. de una compra anterior),
    // se sincroniza el nombre con el que se capturó ahora en el CRM y se
    // suscribe a marketing por si no lo estaba.
    await actualizarContactoExistente(existente, nombre);
    return existente;
  }
  return crearContacto(nombre, email);
}

export async function otorgarOferta(
  contactId: string,
  offerId: string,
  opciones?: { enviarBienvenida?: boolean }
): Promise<void> {
  // Se revoca primero (ignorando el error si no la tenía activa) para
  // forzar que Kajabi reactive todos los productos del paquete: un POST
  // simple no lo hace si el contacto ya tenía la oferta registrada con los
  // productos individuales desactivados — p. ej. le venció hace un año
  // (la oferta dura 12 meses) y ahora renueva, o quedó en un estado raro
  // por una acción manual en el dashboard de Kajabi.
  try {
    await kajabiFetch(`/contacts/${contactId}/relationships/offers`, {
      method: "DELETE",
      body: JSON.stringify({ data: [{ type: "offers", id: offerId }] }),
    });
  } catch {
    // No tenía la oferta activa — nada que revocar, se continúa igual.
  }

  const body: Record<string, unknown> = {
    data: [{ type: "offers", id: offerId }],
  };
  if (opciones?.enviarBienvenida === false) {
    body.meta = { send_customer_welcome_email: false };
  }
  await kajabiFetch(`/contacts/${contactId}/relationships/offers`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Alta desde el CRM: crea (o reutiliza) el contacto en Kajabi y le otorga la
// oferta "Club Sinergético Original", lo que dispara la automatización de
// Kajabi que asigna el tag "Miembro del club" (y de ahí vuelve al CRM vía
// webhook). Devuelve el contact_id para guardarlo en la fila del cliente.
export async function altaEnKajabi(nombre: string, email: string): Promise<string> {
  const contactId = await obtenerOCrearContacto(nombre, email);
  await otorgarOferta(contactId, KAJABI_OFFER_ID_CLUB_SINERGETICO);
  return contactId;
}

// Borrado real y permanente del contacto en Kajabi (usado por "Eliminar
// cliente" del CRM). Si no existe, no hay nada que borrar. Kajabi rechaza
// el borrado (422) si el contacto tiene una suscripción de pago activa.
export async function eliminarContacto(email: string): Promise<void> {
  const contactId = await buscarContactoPorCorreo(email);
  if (!contactId) return;
  await kajabiFetch(`/contacts/${contactId}`, { method: "DELETE" });
}

// Revoca la oferta sin borrar el contacto (usado por "Pausar membresía").
// Si no tiene contacto o no tenía la oferta, no hay nada que hacer.
export async function revocarOferta(email: string, offerId: string): Promise<void> {
  const contactId = await buscarContactoPorCorreo(email);
  if (!contactId) return;
  try {
    await kajabiFetch(`/contacts/${contactId}/relationships/offers`, {
      method: "DELETE",
      body: JSON.stringify({ data: [{ type: "offers", id: offerId }] }),
    });
  } catch {
    // No tenía la oferta activa — nada que revocar.
  }
}

export type EstadoOferta = "activa" | "revocada" | "sin_contacto";

type OfertasContacto = { data: { id: string }[] };

// Consulta en vivo si un contacto tiene la oferta activa ahora mismo — para
// el botón "Renovar" del panel del cliente, que solo debe aparecer si en
// Kajabi la oferta ya no está (sea porque alguien la revocó a mano o porque
// venció el timer de acceso de 365 días que trae configurado el otorgamiento).
export async function estadoOfertaContacto(email: string, offerId: string): Promise<EstadoOferta> {
  const contactId = await buscarContactoPorCorreo(email);
  if (!contactId) return "sin_contacto";
  const data = (await kajabiFetch(`/contacts/${contactId}/relationships/offers`)) as OfertasContacto;
  return data.data.some((o) => o.id === offerId) ? "activa" : "revocada";
}

type ContactoPerfil = {
  data: {
    id: string;
    attributes: {
      name: string;
      email: string;
      address_line_1: string | null;
      address_line_2: string | null;
      address_city: string | null;
      address_state: string | null;
      address_zip: string | null;
      address_country: string | null;
      phone_number: string | null;
      subscribed: boolean;
    };
    relationships: {
      customer?: { data: { id: string } | null };
    };
  }[];
};

type CustomerDetalle = {
  data: { attributes: { sign_in_count: number; last_request_at: string | null } };
};

type OfertaDetalle = {
  data: { attributes: { title: string } };
};

export type PerfilKajabi = {
  encontrado: boolean;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  direccion: {
    calle1: string | null;
    calle2: string | null;
    ciudad: string | null;
    estado: string | null;
    codigoPostal: string | null;
    pais: string | null;
  } | null;
  suscritoMarketing: boolean | null;
  ofertas: { id: string; titulo: string }[];
  signInCount: number | null;
  ultimaActividad: string | null;
};

// Perfil completo para la pestaña "Perfil de Kajabi" del panel del cliente:
// datos de contacto, dirección, suscripción a marketing, ofertas otorgadas
// ahora mismo, y actividad (inicios de sesión / última vez que usó la
// plataforma). Se busca en vivo por correo, no se guarda copia en el CRM.
export async function obtenerPerfilKajabi(email: string): Promise<PerfilKajabi> {
  const vacio: PerfilKajabi = {
    encontrado: false,
    nombre: null,
    email: null,
    telefono: null,
    direccion: null,
    suscritoMarketing: null,
    ofertas: [],
    signInCount: null,
    ultimaActividad: null,
  };

  const params = new URLSearchParams({
    "filter[site_id]": KAJABI_SITE_ID,
    "filter[search]": email,
  });
  const busqueda = (await kajabiFetch(`/contacts?${params}`)) as ContactoPerfil;
  const correoNormalizado = email.trim().toLowerCase();
  const contacto = busqueda.data.find((c) => c.attributes.email?.trim().toLowerCase() === correoNormalizado);
  if (!contacto) return vacio;

  const [ofertasRes, customerRes] = await Promise.all([
    kajabiFetch(`/contacts/${contacto.id}/relationships/offers`).catch(() => null) as Promise<OfertasContacto | null>,
    contacto.relationships.customer?.data?.id
      ? (kajabiFetch(`/customers/${contacto.relationships.customer.data.id}`).catch(() => null) as Promise<CustomerDetalle | null>)
      : Promise.resolve(null),
  ]);

  const ofertas = await Promise.all(
    (ofertasRes?.data ?? []).map(async (o) => {
      try {
        const detalle = (await kajabiFetch(`/offers/${o.id}`)) as OfertaDetalle;
        return { id: o.id, titulo: detalle.data.attributes.title };
      } catch {
        return { id: o.id, titulo: `Oferta ${o.id}` };
      }
    })
  );

  return {
    encontrado: true,
    nombre: contacto.attributes.name,
    email: contacto.attributes.email,
    telefono: contacto.attributes.phone_number,
    direccion: {
      calle1: contacto.attributes.address_line_1,
      calle2: contacto.attributes.address_line_2,
      ciudad: contacto.attributes.address_city,
      estado: contacto.attributes.address_state,
      codigoPostal: contacto.attributes.address_zip,
      pais: contacto.attributes.address_country,
    },
    suscritoMarketing: contacto.attributes.subscribed,
    ofertas,
    signInCount: customerRes?.data.attributes.sign_in_count ?? null,
    ultimaActividad: customerRes?.data.attributes.last_request_at ?? null,
  };
}

// --- Sincronización por consulta periódica (reemplaza al webhook nativo,
// cuyo permiso "Webhooks" no está disponible para esta API key) ---
//
// La cuenta de Kajabi no tiene scope para crear/leer webhooks, así que en
// vez de esperar un aviso se consulta activamente "¿a quién se le otorgó
// esta oferta?" (GET /v1/customers?filter[has_offer_id]=...), que sí está
// permitido con los scopes de view:customers ya otorgados. Cubre tanto las
// altas hechas desde el CRM como las compras directas en Kajabi.

type ClienteKajabiNuevo = { email: string; nombre: string; creadoEn: string };

type CustomersResponse = {
  data: { attributes: { name: string; email: string; created_at: string } }[];
};

// Trae, del más viejo al más nuevo, los clientes a los que se les otorgó la
// oferta después de `creadoDespuesDe` (ISO). Pagina hasta encontrar uno más
// viejo que el cursor o quedarse sin páginas.
export async function nuevosConOfertaDesde(
  offerId: string,
  creadoDespuesDe: string
): Promise<ClienteKajabiNuevo[]> {
  const encontrados: ClienteKajabiNuevo[] = [];
  const tamanoPagina = 50;
  for (let pagina = 1; ; pagina++) {
    const params = new URLSearchParams({
      "filter[site_id]": KAJABI_SITE_ID,
      "filter[has_offer_id]": offerId,
      sort: "-created_at",
      "page[size]": String(tamanoPagina),
      "page[number]": String(pagina),
    });
    const data = (await kajabiFetch(`/customers?${params}`)) as CustomersResponse;
    if (data.data.length === 0) break;

    let llegoAlCursor = false;
    for (const c of data.data) {
      if (c.attributes.created_at <= creadoDespuesDe) {
        llegoAlCursor = true;
        break;
      }
      encontrados.push({ email: c.attributes.email, nombre: c.attributes.name, creadoEn: c.attributes.created_at });
    }
    if (llegoAlCursor || data.data.length < tamanoPagina) break;
  }
  return encontrados.reverse();
}
