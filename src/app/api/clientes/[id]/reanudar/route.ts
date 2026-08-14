import { NextRequest, NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import { reanudarMembresia, registrarTagKajabi, vincularKajabiContactId } from "@/lib/db";
import { altaEnKajabi, KAJABI_TAG_MIEMBRO_DEL_CLUB } from "@/lib/kajabi";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permiso = await requerirPermiso("pausarMembresia");
  if (!permiso.ok) return permiso.respuesta;

  const { id } = await params;
  const clienteId = decodeURIComponent(id);

  try {
    // Parte pura del CRM: calcula los días restantes y actualiza fin de
    // acceso. No depende de que Kajabi responda.
    const { cliente: clienteBase, fechaCalculada, diasRestantes } = await reanudarMembresia(
      clienteId,
      permiso.usuario.nombre
    );

    const cliente = clienteBase;
    let avisoKajabi: string | null = null;
    try {
      const kajabiContactId = await altaEnKajabi(cliente.nombre, cliente.email);
      await vincularKajabiContactId(cliente.id, kajabiContactId);
      await registrarTagKajabi(cliente.email, cliente.nombre, KAJABI_TAG_MIEMBRO_DEL_CLUB);
    } catch (err) {
      avisoKajabi = err instanceof Error ? err.message : "No se pudo otorgar el acceso en Kajabi";
    }

    return NextResponse.json({ cliente, fechaCalculada, diasRestantes, avisoKajabi });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
