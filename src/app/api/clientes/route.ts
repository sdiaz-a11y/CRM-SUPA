import { NextRequest, NextResponse } from "next/server";
import {
  crearCliente,
  listarClientes,
  vincularKajabiContactId,
  type EstadoFiltro,
  type RegionFiltro,
  type VigenciaFiltro,
} from "@/lib/db";
import { altaEnKajabi } from "@/lib/kajabi";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const busqueda = searchParams.get("q") ?? undefined;
  const limite = Number(searchParams.get("limite") ?? 100);
  const pagina = Number(searchParams.get("pagina") ?? 1);
  const estado = (searchParams.get("estado") as EstadoFiltro | null) ?? undefined;
  const region = (searchParams.get("region") as RegionFiltro | null) ?? undefined;
  const eventos = searchParams.get("eventos")?.split(",").filter(Boolean) ?? undefined;
  const membresias = searchParams.get("membresias")?.split(",").filter(Boolean) ?? undefined;
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;
  const vencidosAntesDe = searchParams.get("vencidosAntesDe") ?? undefined;
  const vigencia = (searchParams.get("vigencia") as VigenciaFiltro | null) ?? undefined;
  const { clientes, total } = await listarClientes({
    busqueda,
    limite,
    pagina,
    estado,
    region,
    eventos,
    membresias,
    desde,
    hasta,
    vencidosAntesDe,
    vigencia,
  });
  return NextResponse.json({ clientes, total });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.autor?.trim()) {
    return NextResponse.json({ error: "Falta el nombre de quien registra" }, { status: 400 });
  }
  if (!body?.email?.trim() || !body?.nombre?.trim()) {
    return NextResponse.json({ error: "Nombre y correo son obligatorios" }, { status: 400 });
  }
  try {
    const cliente = await crearCliente({
      nombre: body.nombre,
      email: body.email,
      telefono: body.telefono,
      pais: body.pais,
      ciudad: body.ciudad,
      notas: body.notas,
      fechaInscripcion: body.fechaInscripcion,
      autor: body.autor,
    });

    // El alta en Kajabi es un efecto secundario del alta en el CRM: si
    // Kajabi falla (fuera de línea, credenciales vencidas, etc.) el cliente
    // igual queda creado en el CRM y se avisa del problema, en vez de
    // bloquear el flujo principal por la disponibilidad de un tercero.
    let avisoKajabi: string | null = null;
    try {
      const kajabiContactId = await altaEnKajabi(cliente.nombre, cliente.email);
      await vincularKajabiContactId(cliente.id, kajabiContactId);
    } catch (err) {
      avisoKajabi = err instanceof Error ? err.message : "No se pudo otorgar el acceso en Kajabi";
    }

    return NextResponse.json({ cliente, avisoKajabi });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
