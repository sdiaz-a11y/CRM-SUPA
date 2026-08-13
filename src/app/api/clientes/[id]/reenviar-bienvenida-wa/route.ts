import { NextRequest, NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import { marcarMensajeBienvenidaWa, obtenerCliente } from "@/lib/db";
import { altaEnGhl } from "@/lib/ghl";

// Reenvía el mensaje de bienvenida por WhatsApp (mismo mecanismo que el alta
// de cliente: sube/actualiza el contacto en GHL y le pone el tag que
// dispara el Workflow). Útil cuando se agregó o corrigió el teléfono
// después de la creación original. Nunca deja al cliente en "Número
// Inválido" — eso es exclusivamente una elección manual.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permiso = await requerirPermiso("editarCliente");
  if (!permiso.ok) return permiso.respuesta;

  const { id } = await params;
  const clienteId = decodeURIComponent(id);
  const cliente = await obtenerCliente(clienteId);
  if (!cliente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!cliente.telefono) {
    return NextResponse.json({ error: "El cliente no tiene teléfono registrado" }, { status: 400 });
  }

  let aviso: string | null = null;
  try {
    await altaEnGhl(cliente.nombre, cliente.email, cliente.telefono);
  } catch (err) {
    aviso = err instanceof Error ? err.message : "No se pudo enviar el mensaje de bienvenida por WhatsApp";
  }

  const actualizado = await marcarMensajeBienvenidaWa(
    clienteId,
    aviso ? "Pendiente" : "Enviado",
    permiso.usuario.nombre
  );
  return NextResponse.json({ cliente: actualizado, aviso });
}
