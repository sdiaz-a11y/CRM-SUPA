import { NextRequest, NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import { listarOfertasClienteClub } from "@/lib/db";

// Ofertas EXTRA (no la del Club) otorgadas a este cliente — se muestran en
// su panel, en la sección "Estado en Kajabi".
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permiso = await requerirPermiso("verClientes");
  if (!permiso.ok) return permiso.respuesta;

  const { id } = await params;
  const ofertas = await listarOfertasClienteClub(decodeURIComponent(id));
  return NextResponse.json({ ofertas });
}
