import { NextRequest, NextResponse } from "next/server";
import {
  crearCliente,
  listarClientes,
  type EstadoFiltro,
  type RegionFiltro,
  type VigenciaFiltro,
} from "@/lib/db";

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
    return NextResponse.json({ cliente });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
