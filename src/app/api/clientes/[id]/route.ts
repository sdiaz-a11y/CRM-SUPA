import { NextRequest, NextResponse } from "next/server";
import {
  actualizarAcceso,
  actualizarDatosCliente,
  actualizarDetalleAcceso,
  actualizarTags,
  obtenerCliente,
} from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await obtenerCliente(decodeURIComponent(id));
  if (!cliente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ cliente });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clienteId = decodeURIComponent(id);
  const body = await req.json();
  if (!body?.autor?.trim()) {
    return NextResponse.json({ error: "Falta el nombre de quien registra" }, { status: 400 });
  }

  try {
    if (body.tipo === "acceso") {
      const cliente = await actualizarAcceso(clienteId, body.nivel, body.activo, body.autor);
      return NextResponse.json({ cliente });
    }

    if (body.tipo === "acceso-detalle") {
      const cliente = await actualizarDetalleAcceso(
        clienteId,
        body.nivel,
        { cantidad: body.cantidad, variante: body.variante },
        body.autor
      );
      return NextResponse.json({ cliente });
    }

    if (body.tipo === "datos") {
      const cliente = await actualizarDatosCliente(
        clienteId,
        {
          nombre: body.nombre,
          telefono: body.telefono,
          pais: body.pais,
          ciudad: body.ciudad,
          notas: body.notas,
          evento: body.evento,
          accesoPlataforma: body.accesoPlataforma,
          tipoMembresia: body.tipoMembresia,
          vencimientoSkool: body.vencimientoSkool,
          invitacionSkool: body.invitacionSkool,
          contactoWhats: body.contactoWhats,
          llamada: body.llamada,
          notasSoporte: body.notasSoporte,
        },
        body.autor
      );
      return NextResponse.json({ cliente });
    }

    if (body.tipo === "tags") {
      const cliente = await actualizarTags(clienteId, body.tags ?? [], body.autor);
      return NextResponse.json({ cliente });
    }

    return NextResponse.json({ error: "Tipo de actualización no soportado" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
