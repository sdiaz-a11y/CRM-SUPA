import { NextRequest, NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import { exportarOtrasOfertasClientes } from "@/lib/db";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const permiso = await requerirPermiso("exportarCsv");
  if (!permiso.ok) return permiso.respuesta;

  const { searchParams } = new URL(req.url);
  const busqueda = searchParams.get("q") ?? undefined;
  const etiqueta = searchParams.get("etiqueta") ?? undefined;
  const tag = searchParams.get("tag") ?? undefined;

  try {
    const clientes = await exportarOtrasOfertasClientes({ busqueda, etiqueta, tag });
    return NextResponse.json({ clientes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
