import { NextRequest, NextResponse } from "next/server";
import { eliminarCliente, obtenerCliente } from "@/lib/db";
import { eliminarContacto } from "@/lib/kajabi";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clienteId = decodeURIComponent(id);
  const body = await req.json();
  if (!body?.autor?.trim()) {
    return NextResponse.json({ error: "Falta el nombre de quien registra" }, { status: 400 });
  }

  const cliente = await obtenerCliente(clienteId);
  if (!cliente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // El borrado en Kajabi es real y permanente; si falla (p. ej. tiene una
  // suscripción de pago activa) se avisa, pero el archivado en el CRM sigue
  // adelante igual — no depende de que Kajabi coopere.
  let avisoKajabi: string | null = null;
  try {
    await eliminarContacto(cliente.email);
  } catch (err) {
    avisoKajabi = err instanceof Error ? err.message : "No se pudo eliminar el contacto en Kajabi";
  }

  try {
    const clienteEliminado = await eliminarCliente(clienteId, body.autor);
    return NextResponse.json({ cliente: clienteEliminado, avisoKajabi });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
