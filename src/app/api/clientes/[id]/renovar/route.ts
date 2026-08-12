import { NextRequest, NextResponse } from "next/server";
import {
  marcarInvitacionSkoolEnviada,
  recalcularAccesos,
  registrarTagKajabi,
  renovarMembresia,
  vincularKajabiContactId,
} from "@/lib/db";
import { altaEnKajabi, KAJABI_TAG_MIEMBRO_DEL_CLUB } from "@/lib/kajabi";
import { invitarASkool } from "@/lib/skool";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clienteId = decodeURIComponent(id);
  const body = await req.json();
  if (!body?.autor?.trim()) {
    return NextResponse.json({ error: "Falta el nombre de quien registra" }, { status: 400 });
  }

  try {
    // Campos propios del CRM (etiqueta, tipo de membresía, acceso a
    // plataforma, fin de acceso) — no depende de que Kajabi/Skool respondan.
    let cliente = await renovarMembresia(clienteId, body.autor);

    let avisoKajabi: string | null = null;
    try {
      const kajabiContactId = await altaEnKajabi(cliente.nombre, cliente.email);
      await vincularKajabiContactId(cliente.id, kajabiContactId);
      await registrarTagKajabi(cliente.email, cliente.nombre, KAJABI_TAG_MIEMBRO_DEL_CLUB);
      cliente = await recalcularAccesos(cliente.id);
    } catch (err) {
      avisoKajabi = err instanceof Error ? err.message : "No se pudo otorgar el acceso en Kajabi";
    }

    let avisoSkool: string | null = null;
    try {
      await invitarASkool(cliente.email);
      cliente = await marcarInvitacionSkoolEnviada(cliente.id, new Date().toISOString());
    } catch (err) {
      avisoSkool = err instanceof Error ? err.message : "No se pudo enviar la invitación a Skool";
    }

    return NextResponse.json({ cliente, avisoKajabi, avisoSkool });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
