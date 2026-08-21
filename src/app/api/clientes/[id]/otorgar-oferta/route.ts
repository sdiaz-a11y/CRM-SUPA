import { NextRequest, NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import { listarOfertasClienteClub, obtenerCliente, registrarOfertaClienteClub } from "@/lib/db";
import { otorgarOfertaArbitraria } from "@/lib/kajabi";

// Otorga una oferta EXTRA (no la del Club) a un cliente del Club ya
// existente. A diferencia de pausar/renovar (que escriben el CRM primero y
// tratan a Kajabi como efecto secundario resiliente), aquí Kajabi va
// primero: la tabla clientes_ofertas representa ofertas realmente
// otorgadas, no intentos — si Kajabi falla, no se escribe nada.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permiso = await requerirPermiso("otorgarOferta");
  if (!permiso.ok) return permiso.respuesta;

  const { id } = await params;
  const clienteId = decodeURIComponent(id);
  const body = await req.json();
  const ofertaId = body?.ofertaId?.trim();
  const ofertaTitulo = body?.ofertaTitulo?.trim();
  if (!ofertaId || !ofertaTitulo) {
    return NextResponse.json({ error: "Falta elegir una oferta" }, { status: 400 });
  }

  try {
    const cliente = await obtenerCliente(clienteId);
    if (!cliente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    await otorgarOfertaArbitraria(cliente.nombre, cliente.email, ofertaId);
    await registrarOfertaClienteClub(clienteId, ofertaId, ofertaTitulo, permiso.usuario.nombre);

    const ofertas = await listarOfertasClienteClub(clienteId);
    return NextResponse.json({ ofertas });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo otorgar la oferta";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
