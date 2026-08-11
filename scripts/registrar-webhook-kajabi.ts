// Registra en Kajabi el webhook "tag_added" para el tag "Miembro del club",
// apuntando a /api/webhooks/kajabi de esta app. Correr una sola vez (o cada
// vez que cambie el dominio de despliegue).
//
// Requiere en .env.local: KAJABI_CLIENT_ID, KAJABI_CLIENT_SECRET,
// KAJABI_WEBHOOK_SECRET y KAJABI_WEBHOOK_BASE_URL (el dominio público de
// Vercel, sin slash final, ej. https://crm-supa.vercel.app).
//
// Uso: npm run registrar-webhook-kajabi
import "./_env";
import { KAJABI_SITE_ID } from "../src/lib/kajabi";

const KAJABI_API = "https://api.kajabi.com/v1";
const TAG_ID_MIEMBRO_DEL_CLUB = "2148273450";

async function main() {
  const clientId = process.env.KAJABI_CLIENT_ID;
  const clientSecret = process.env.KAJABI_CLIENT_SECRET;
  const webhookSecret = process.env.KAJABI_WEBHOOK_SECRET;
  const baseUrl = process.env.KAJABI_WEBHOOK_BASE_URL;

  if (!clientId || !clientSecret) throw new Error("Faltan KAJABI_CLIENT_ID / KAJABI_CLIENT_SECRET");
  if (!webhookSecret) throw new Error("Falta KAJABI_WEBHOOK_SECRET");
  if (!baseUrl) throw new Error("Falta KAJABI_WEBHOOK_BASE_URL (dominio público de Vercel)");

  const tokenRes = await fetch(`${KAJABI_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
  });
  if (!tokenRes.ok) throw new Error(`OAuth falló (${tokenRes.status}): ${await tokenRes.text()}`);
  const { access_token: token } = await tokenRes.json();

  const targetUrl = `${baseUrl}/api/webhooks/kajabi?token=${encodeURIComponent(webhookSecret)}`;

  const res = await fetch(`${KAJABI_API}/hooks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "hooks",
        attributes: {
          target_url: targetUrl,
          event: "tag_added",
          resource_id: TAG_ID_MIEMBRO_DEL_CLUB,
        },
        relationships: {
          site: { data: { id: KAJABI_SITE_ID, type: "sites" } },
        },
      },
    }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Kajabi /hooks falló (${res.status}): ${body}`);

  console.log("Webhook registrado en Kajabi:");
  console.log(body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
