import { NextRequest, NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import { listarEventosFiltrados } from "@/lib/db";
import { TIPOS_EVENTO_FILTRABLES, type TipoEvento } from "@/lib/types";

export async function GET(req: NextRequest) {
  const permiso = await requerirPermiso("verActividad");
  if (!permiso.ok) return permiso.respuesta;

  const { searchParams } = new URL(req.url);
  const busqueda = searchParams.get("q") ?? undefined;
  const clienteId = searchParams.get("cliente") ?? undefined;
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;
  const limite = Number(searchParams.get("limite") ?? 50);
  const pagina = Number(searchParams.get("pagina") ?? 1);
  const tipos = searchParams
    .get("tipos")
    ?.split(",")
    .filter((t): t is TipoEvento => TIPOS_EVENTO_FILTRABLES.includes(t as TipoEvento));

  const { eventos, total } = await listarEventosFiltrados({
    busqueda,
    clienteId,
    desde,
    hasta,
    limite,
    pagina,
    tipos,
  });
  return NextResponse.json({ eventos, total });
}
