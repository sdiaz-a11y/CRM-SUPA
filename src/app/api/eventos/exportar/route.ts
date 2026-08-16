import { NextRequest, NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import { exportarEventos } from "@/lib/db";
import { TIPOS_EVENTO_FILTRABLES, type TipoEvento } from "@/lib/types";

// Trae todos los eventos que matcheen los filtros (no solo la página
// visible) para el botón "Descargar CSV" de Actividad. Acepta los mismos
// query params que GET /api/eventos.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const permiso = await requerirPermiso("verActividad");
  if (!permiso.ok) return permiso.respuesta;

  const { searchParams } = new URL(req.url);
  const busqueda = searchParams.get("q") ?? undefined;
  const clienteId = searchParams.get("cliente") ?? undefined;
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;
  const tipos = searchParams
    .get("tipos")
    ?.split(",")
    .filter((t): t is TipoEvento => TIPOS_EVENTO_FILTRABLES.includes(t as TipoEvento));

  try {
    const eventos = await exportarEventos({ busqueda, clienteId, desde, hasta, tipos });
    return NextResponse.json({ eventos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
