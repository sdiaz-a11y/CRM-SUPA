import { NextRequest, NextResponse } from "next/server";
import { registrarTagKajabi } from "@/lib/db";

// Kajabi no firma sus webhooks (sin HMAC ni cabecera de verificación), así
// que la autenticidad se valida con un secreto propio embebido en la URL
// del webhook (?token=...) al registrarlo — ver scripts/registrar-webhook-kajabi.ts.
type ContactoPayload = { type: "contacts"; attributes: { name: string; email: string } };
type TagPayload = { type: "contact_tags"; attributes: { name: string } };

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token !== process.env.KAJABI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  if (body?.event !== "tag_added") {
    return NextResponse.json({ ok: true, ignorado: true });
  }

  const payload: unknown[] = Array.isArray(body.payload) ? body.payload : [];
  const contacto = payload.find(
    (p): p is ContactoPayload => (p as { type?: string }).type === "contacts"
  );
  const tag = payload.find(
    (p): p is TagPayload => (p as { type?: string }).type === "contact_tags"
  );

  if (!contacto?.attributes?.email) {
    return NextResponse.json({ error: "Payload sin correo de contacto" }, { status: 400 });
  }

  await registrarTagKajabi(
    contacto.attributes.email,
    contacto.attributes.name,
    tag?.attributes?.name ?? "Miembro del club"
  );

  return NextResponse.json({ ok: true });
}
