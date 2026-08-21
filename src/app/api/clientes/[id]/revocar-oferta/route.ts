import { NextRequest, NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import { listarOfertasClienteClub, obtenerCliente, revocarOfertaClienteClub } from "@/lib/db";
import { revocarOferta } from "@/lib/kajabi";

// Revoca una oferta EXTRA ya otorgada a un cliente del Club. Kajabi va
// primero, igual que al otorgar — si falla, no se marca nada como revocado
// en el CRM.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permiso = await requerirPermiso("otorgarOferta");
  if (!permiso.ok) return permiso.respuesta;

  const { id } = await params;
  const clienteId = decodeURIComponent(id);
  const body = await req.json();
  const grantId = body?.ofertaGrantId?.trim();
  if (!grantId) return NextResponse.json({ error: "Falta indicar qué oferta revocar" }, { status: 400 });

  try {
    const cliente = await obtenerCliente(clienteId);
    if (!cliente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const ofertas = await listarOfertasClienteClub(clienteId);
    const oferta = ofertas.find((o) => o.id === grantId);
    if (!oferta) return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });

    await revocarOferta(cliente.email, oferta.ofertaId);
    await revocarOfertaClienteClub(grantId, permiso.usuario.nombre);

    const ofertasActualizadas = await listarOfertasClienteClub(clienteId);
    return NextResponse.json({ ofertas: ofertasActualizadas });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo revocar la oferta";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
