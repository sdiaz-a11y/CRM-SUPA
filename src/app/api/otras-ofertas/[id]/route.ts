import { NextRequest, NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import { listarOfertasOtorgadas, obtenerOtraOfertaCliente } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permiso = await requerirPermiso("verOtrasOfertas");
  if (!permiso.ok) return permiso.respuesta;

  const { id } = await params;
  const clienteId = decodeURIComponent(id);
  const cliente = await obtenerOtraOfertaCliente(clienteId);
  if (!cliente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const ofertas = await listarOfertasOtorgadas(clienteId);
  return NextResponse.json({ cliente, ofertas });
}
