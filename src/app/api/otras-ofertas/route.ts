import { NextRequest, NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import { listarOtrasOfertasClientes } from "@/lib/db";

export async function GET(req: NextRequest) {
  const permiso = await requerirPermiso("verOtrasOfertas");
  if (!permiso.ok) return permiso.respuesta;

  const { searchParams } = new URL(req.url);
  const busqueda = searchParams.get("q") ?? undefined;
  const etiqueta = searchParams.get("etiqueta") ?? undefined;
  const tag = searchParams.get("tag") ?? undefined;
  const limite = Number(searchParams.get("limite") ?? 100);
  const pagina = Number(searchParams.get("pagina") ?? 1);

  const { clientes, total } = await listarOtrasOfertasClientes({ busqueda, etiqueta, tag, limite, pagina });
  return NextResponse.json({ clientes, total });
}
