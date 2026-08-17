import { NextRequest, NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import { marcarSolicitudRechazada, obtenerSolicitud } from "@/lib/solicitudes";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permiso = await requerirPermiso("revisarSolicitudes");
  if (!permiso.ok) return permiso.respuesta;

  const { id } = await params;
  const solicitud = await obtenerSolicitud(id);
  if (!solicitud) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  if (solicitud.estado !== "pendiente") {
    return NextResponse.json({ error: "Esta solicitud ya fue revisada" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const nota = typeof body?.nota === "string" && body.nota.trim() ? body.nota.trim() : null;

  const actualizada = await marcarSolicitudRechazada(id, nota, permiso.usuario.nombre);
  return NextResponse.json({ solicitud: actualizada });
}
