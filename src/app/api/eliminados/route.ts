import { NextRequest, NextResponse } from "next/server";
import { listarEliminados } from "@/lib/db";

export async function GET(req: NextRequest) {
  const busqueda = req.nextUrl.searchParams.get("q") ?? undefined;
  const clientes = await listarEliminados(busqueda);
  return NextResponse.json({ clientes });
}
