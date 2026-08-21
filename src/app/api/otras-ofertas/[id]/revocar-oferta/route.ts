import { NextRequest, NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import { listarOfertasOtorgadas, obtenerOtraOfertaCliente, revocarOfertaOtorgada } from "@/lib/db";
import { revocarOferta } from "@/lib/kajabi";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permiso = await requerirPermiso("importarOtrasOfertas");
  if (!permiso.ok) return permiso.respuesta;

  const { id } = await params;
  const clienteId = decodeURIComponent(id);
  const body = await req.json();
  const grantId = body?.ofertaGrantId?.trim();
  if (!grantId) return NextResponse.json({ error: "Falta indicar qué oferta revocar" }, { status: 400 });

  try {
    const cliente = await obtenerOtraOfertaCliente(clienteId);
    if (!cliente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const ofertas = await listarOfertasOtorgadas(clienteId);
    const oferta = ofertas.find((o) => o.id === grantId);
    if (!oferta) return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });

    await revocarOferta(cliente.email, oferta.ofertaId);
    await revocarOfertaOtorgada(grantId, permiso.usuario.nombre);

    const ofertasActualizadas = await listarOfertasOtorgadas(clienteId);
    return NextResponse.json({ ofertas: ofertasActualizadas });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo revocar la oferta";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
