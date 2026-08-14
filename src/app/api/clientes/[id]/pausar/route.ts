import { NextRequest, NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import { obtenerCliente, pausarMembresia } from "@/lib/db";
import { KAJABI_OFFER_ID_CLUB_SINERGETICO, revocarOferta } from "@/lib/kajabi";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permiso = await requerirPermiso("pausarMembresia");
  if (!permiso.ok) return permiso.respuesta;

  const { id } = await params;
  const clienteId = decodeURIComponent(id);

  try {
    const clienteAntes = await obtenerCliente(clienteId);
    if (!clienteAntes) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // La revocación en Kajabi es un efecto secundario: si falla, la pausa en
    // el CRM sigue adelante igual y se avisa del problema.
    let avisoKajabi: string | null = null;
    try {
      await revocarOferta(clienteAntes.email, KAJABI_OFFER_ID_CLUB_SINERGETICO);
    } catch (err) {
      avisoKajabi = err instanceof Error ? err.message : "No se pudo revocar el acceso en Kajabi";
    }

    const cliente = await pausarMembresia(clienteId, permiso.usuario.nombre);
    return NextResponse.json({ cliente, avisoKajabi });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
