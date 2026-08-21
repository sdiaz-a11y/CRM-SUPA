import { NextRequest, NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import {
  registrarOfertaOtorgada,
  upsertOtraOfertaClienteIdentidad,
  vincularKajabiContactIdOtraOferta,
} from "@/lib/db";
import { otorgarOfertaArbitraria } from "@/lib/kajabi";

// Una fila por request, igual que /api/clientes desde ImportarClientesModal.
// A diferencia del alta del Club, esto NUNCA falla por "ya existe" — la
// identidad se encuentra o se crea, y siempre se agrega una fila fechada más
// a otras_ofertas_otorgadas. Sin Skool ni GHL: solo se suscribe al contacto
// a marketing en Kajabi (obtenerOCrearContacto) y se le otorga la oferta.
export async function POST(req: NextRequest) {
  const permiso = await requerirPermiso("importarOtrasOfertas");
  if (!permiso.ok) return permiso.respuesta;

  const body = await req.json();
  const nombre = body?.nombre?.trim();
  const email = body?.email?.trim();
  const ofertaId = body?.ofertaId?.trim();
  const ofertaTitulo = body?.ofertaTitulo?.trim();
  if (!nombre || !email || !ofertaId || !ofertaTitulo) {
    return NextResponse.json({ error: "Faltan nombre, correo u oferta" }, { status: 400 });
  }

  try {
    const cliente = await upsertOtraOfertaClienteIdentidad({
      nombre,
      email,
      telefono: body.telefono,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      etiqueta: body.etiqueta,
    });

    let avisoKajabi: string | null = null;
    try {
      const kajabiContactId = await otorgarOfertaArbitraria(cliente.nombre, cliente.email, ofertaId);
      await vincularKajabiContactIdOtraOferta(cliente.id, kajabiContactId);
      await registrarOfertaOtorgada(cliente.id, ofertaId, ofertaTitulo, permiso.usuario.nombre);
    } catch (err) {
      // La identidad (nombre/correo/tags) sí se guarda aunque Kajabi falle —
      // pero la oferta NO se registra como otorgada, porque no lo fue.
      avisoKajabi = err instanceof Error ? err.message : "No se pudo otorgar el acceso en Kajabi";
    }

    return NextResponse.json({ cliente, avisoKajabi });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
