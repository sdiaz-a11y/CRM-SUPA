import { NextRequest, NextResponse } from "next/server";
import {
  actualizarTelefonoCliente,
  guardarTelefonoPendienteHotmart,
  marcarMensajeBienvenidaWa,
  normalizarEmail,
  obtenerCliente,
} from "@/lib/db";
import { altaEnGhl } from "@/lib/ghl";
import { extraerDatosHotmart } from "@/lib/hotmart";

// Hotmart no firma sus webhooks con HMAC (a diferencia de otros proveedores)
// — la autenticidad se valida con un secreto propio embebido en la URL
// (?token=...), mismo patrón que el webhook de Kajabi.
//
// Por qué existe: Kajabi le otorga la oferta a los compradores de Hotmart
// automático (vía su propia integración), pero ese aviso no trae teléfono.
// Este webhook sí lo trae directo de Hotmart. El sincronizador de Kajabi
// (cada ~15 min) casi siempre crea al cliente DESPUÉS de que este webhook ya
// llegó, así que lo normal es no encontrar al cliente todavía — se guarda en
// espera (hotmart_pendientes) y el sincronizador lo recoge al crearlo.
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token !== process.env.HOTMART_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const datos = extraerDatosHotmart(body);
  if (!datos || !datos.telefono) {
    // Sin correo o sin teléfono no hay nada que hacer. 200 para que Hotmart
    // no reintente un evento que nunca va a traer más datos.
    return NextResponse.json({ ok: true, ignorado: true });
  }

  const id = normalizarEmail(datos.email);
  const cliente = await obtenerCliente(id);
  if (!cliente) {
    await guardarTelefonoPendienteHotmart(id, datos.telefono, datos.producto);
    return NextResponse.json({ ok: true, guardado: "pendiente" });
  }

  if (cliente.telefono) {
    return NextResponse.json({ ok: true, nota: "el cliente ya tenía teléfono, no se tocó" });
  }

  const actualizado = await actualizarTelefonoCliente(cliente.id, datos.telefono);

  // Ya se pudo mandar antes (Enviado) o alguien lo marcó a mano como Número
  // Inválido — no se reintenta por encima de eso, solo cuando de verdad
  // nunca se pudo mandar por falta de teléfono.
  let avisoWa: string | null = null;
  if (actualizado.contactoWhats !== "Enviado" && actualizado.contactoWhats !== "Número Inválido") {
    try {
      await altaEnGhl(actualizado.nombre, actualizado.email, datos.telefono);
      await marcarMensajeBienvenidaWa(actualizado.id, "Enviado");
    } catch (err) {
      avisoWa = err instanceof Error ? err.message : "No se pudo enviar el WhatsApp de bienvenida";
      await marcarMensajeBienvenidaWa(actualizado.id, "Pendiente");
    }
  }

  return NextResponse.json({ ok: true, telefonoActualizado: true, avisoWa });
}
