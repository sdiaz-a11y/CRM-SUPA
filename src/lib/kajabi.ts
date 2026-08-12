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
      attributes: { name: nombre, email },
      relationships: { site: { data: { id: KAJABI_SITE_ID, type: "sites" } } },
    },
  };
  const data = (await kajabiFetch("/contacts", {
    method: "POST",
    body: JSON.stringify(body),
  })) as ContactoCreado;
  return data.data.id;
}

async function actualizarNombreContacto(contactId: string, nombre: string): Promise<void> {
  await kajabiFetch(`/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify({ data: { type: "contacts", id: contactId, attributes: { name: nombre } } }),
  });
}

export async function obtenerOCrearContacto(nombre: string, email: string): Promise<string> {
  const existente = await buscarContactoPorCorreo(email);
  if (existente) {
    // Si el contacto ya existía en Kajabi (p. ej. de una compra anterior),
    // se sincroniza el nombre con el que se capturó ahora en el CRM.
    await actualizarNombreContacto(existente, nombre);
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
