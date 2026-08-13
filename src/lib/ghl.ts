// Cliente mínimo para la API pública de GoHighLevel (Private Integration
// Token, sin OAuth). Solo crea/actualiza el contacto con un tag fijo — el
// envío del WhatsApp lo dispara un Workflow de GHL sobre ese tag, ya que el
// envío de plantillas nativas de WhatsApp Business no está expuesto en la
// API pública (verificado a mano: solo existe en el endpoint interno del
// dashboard).
const GHL_API = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

function token(): string {
  const t = process.env.GHL_PRIVATE_TOKEN;
  if (!t) throw new Error("Falta GHL_PRIVATE_TOKEN en las variables de entorno");
  return t;
}

function locationId(): string {
  const l = process.env.GHL_LOCATION_ID;
  if (!l) throw new Error("Falta GHL_LOCATION_ID en las variables de entorno");
  return l;
}

function tagAltaCrm(): string {
  return process.env.GHL_TAG_ALTA_CRM || "synergy-crm-alta";
}

async function ghlFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${GHL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      Version: GHL_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`GHL ${path} falló (${res.status}): ${await res.text()}`);
  return res.json();
}

// Normaliza a formato E.164 aproximado: conserva dígitos y el "+" inicial.
function normalizarTelefono(telefono: string | null): string | undefined {
  if (!telefono) return undefined;
  const limpio = telefono.trim().replace(/[^\d+]/g, "");
  return limpio || undefined;
}

// Crea o actualiza el contacto en GHL (por correo/teléfono, según la
// configuración de unicidad de la cuenta) y le agrega el tag que dispara el
// Workflow de bienvenida por WhatsApp. El tag se agrega con el endpoint
// dedicado (no con el array `tags` del upsert) para no borrar otros tags
// que el contacto ya pudiera tener en GHL. Devuelve el contactId de GHL.
export async function altaEnGhl(nombre: string, email: string, telefono: string | null): Promise<string> {
  const data = (await ghlFetch("/contacts/upsert", {
    method: "POST",
    body: JSON.stringify({
      locationId: locationId(),
      name: nombre,
      email,
      phone: normalizarTelefono(telefono),
    }),
  })) as { contact: { id: string } };
  const contactId = data.contact.id;

  // El Workflow de bienvenida se dispara con el trigger "se agregó el tag":
  // si el contacto ya lo tenía (alta repetida, o el botón "Enviar" para
  // reenviar), volver a agregarlo no cuenta como "agregado" para GHL y el
  // Workflow no vuelve a correr. Se quita primero (ignorando el error si no
  // lo tenía) para forzar un tag agregado limpio cada vez — mismo truco que
  // otorgarOferta() en kajabi.ts con la oferta de Kajabi.
  try {
    await ghlFetch(`/contacts/${contactId}/tags`, {
      method: "DELETE",
      body: JSON.stringify({ tags: [tagAltaCrm()] }),
    });
  } catch {
    // No tenía el tag — nada que quitar, se continúa igual.
  }

  await ghlFetch(`/contacts/${contactId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tags: [tagAltaCrm()] }),
  });

  return contactId;
}
