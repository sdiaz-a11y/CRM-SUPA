import { NextRequest, NextResponse } from "next/server";
import { agregarNota, listarEventos } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventos = await listarEventos(decodeURIComponent(id));
  return NextResponse.json({ eventos });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clienteId = decodeURIComponent(id);
  const body = await req.json();
  if (!body?.autor?.trim()) {
    return NextResponse.json({ error: "Falta el nombre de quien registra" }, { status: 400 });
  }
  if (!body?.nota?.trim()) {
    return NextResponse.json({ error: "La nota no puede estar vacía" }, { status: 400 });
  }
  try {
    await agregarNota(clienteId, body.nota, body.autor);
    const eventos = await listarEventos(clienteId);
    return NextResponse.json({ eventos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
