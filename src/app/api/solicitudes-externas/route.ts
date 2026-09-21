import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { crearSolicitud } from "@/lib/solicitudes";
import { subirComprobante } from "@/lib/storage";

// Solicitudes que llegan de un formulario externo (hoy: el de VSL, ver
// FORMULARIO-SOLICITUDES-VSL.md) — no hay sesión de usuario de este CRM
// detrás, así que se autentica con un secreto fijo en la URL (?token=...),
// mismo patrón que los webhooks de Kajabi/Hotmart. El "solicitado por" de
// estas filas es un usuario placeholder (SOLICITUDES_EXTERNAS_USUARIO_ID),
// nunca un usuario real con sesión.
//
// El evento queda restringido a los de VSL a propósito: este endpoint es
// solo para ese formulario, no un genérico para cualquier fuente externa.
const EVENTOS_PERMITIDOS = ["VSL MX", "VSL USA", "VSL LATAM"];

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token !== process.env.SOLICITUDES_EXTERNAS_TOKEN) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const usuarioExternoId = process.env.SOLICITUDES_EXTERNAS_USUARIO_ID;
  if (!usuarioExternoId) {
    return NextResponse.json({ error: "Falta configurar SOLICITUDES_EXTERNAS_USUARIO_ID" }, { status: 500 });
  }

  const form = await req.formData();
  const nombre = String(form.get("nombre") ?? "").trim();
  const correoPago = String(form.get("correoPago") ?? "").trim();
  const correoAcceso = String(form.get("correoAcceso") ?? "").trim();
  const telefono = String(form.get("telefono") ?? "").trim();
  const pais = String(form.get("pais") ?? "").trim();
  const evento = String(form.get("evento") ?? "").trim();
  const tipoMembresia = String(form.get("tipoMembresia") ?? "").trim();
  const archivos = form.getAll("comprobantes").filter((v): v is File => v instanceof File && v.size > 0);

  if (!nombre || !correoPago || !correoAcceso || !telefono || !evento || !tipoMembresia) {
    return NextResponse.json({ error: "Todos los campos son obligatorios" }, { status: 400 });
  }
  if (!EVENTOS_PERMITIDOS.includes(evento)) {
    return NextResponse.json({ error: `Evento inválido — debe ser uno de: ${EVENTOS_PERMITIDOS.join(", ")}` }, { status: 400 });
  }
  if (archivos.length === 0) {
    return NextResponse.json({ error: "Adjunta al menos un comprobante de pago" }, { status: 400 });
  }

  try {
    const id = randomUUID();
    const rutas: string[] = [];
    for (const archivo of archivos) {
      rutas.push(await subirComprobante(id, archivo));
    }

    const solicitud = await crearSolicitud({
      id,
      nombre,
      correoPago,
      correoAcceso,
      telefono,
      pais: pais || null,
      evento,
      tipoMembresia,
      comprobantes: rutas,
      solicitadoPorId: usuarioExternoId,
      solicitadoPorNombre: "VSL (externo)",
    });

    return NextResponse.json({ ok: true, id: solicitud.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo enviar la solicitud";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
