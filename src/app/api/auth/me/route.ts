import { NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";

export async function GET() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ usuario });
}
