import { NextRequest, NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import { listarEliminados } from "@/lib/db";

export async function GET(req: NextRequest) {
  const permiso = await requerirPermiso("verEliminados");
  if (!permiso.ok) return permiso.respuesta;

  const busqueda = req.nextUrl.searchParams.get("q") ?? undefined;
  const clientes = await listarEliminados(busqueda);
  return NextResponse.json({ clientes });
}
