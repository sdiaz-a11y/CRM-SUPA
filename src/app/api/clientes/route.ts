import { NextRequest, NextResponse } from "next/server";
import {
  crearCliente,
  listarClientes,
  marcarAccesoPlataforma,
  marcarInvitacionSkoolEnviada,
  recalcularAccesos,
  registrarTagKajabi,
  vincularKajabiContactId,
  type EstadoFiltro,
  type RegionFiltro,
  type VigenciaFiltro,
} from "@/lib/db";
import { altaEnKajabi, KAJABI_TAG_MIEMBRO_DEL_CLUB } from "@/lib/kajabi";
import { invitarASkool } from "@/lib/skool";

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
    let cliente = await crearCliente({
      nombre: body.nombre,
      email: body.email,
      telefono: body.telefono,
      pais: body.pais,
      evento: body.evento,
      tipoMembresia: body.tipoMembresia,
      etiqueta: body.etiqueta,
      autor: body.autor,
    });

    // El alta en Kajabi es un efecto secundario del alta en el CRM: si
    // Kajabi falla (fuera de línea, credenciales vencidas, etc.) el cliente
    // igual queda creado en el CRM y se avisa del problema, en vez de
    // bloquear el flujo principal por la disponibilidad de un tercero. El
    // "Sí" en Acceso a plataforma solo se escribe si Kajabi confirmó el
    // otorgamiento — es la forma de verificar que sí se dio.
    let avisoKajabi: string | null = null;
    try {
      const kajabiContactId = await altaEnKajabi(cliente.nombre, cliente.email);
      await vincularKajabiContactId(cliente.id, kajabiContactId);
      cliente = await marcarAccesoPlataforma(cliente.id, "Si");
      // Registro inmediato en la timeline: no hay que esperar a que el
      // sincronizador periódico (cada ~15 min) lo detecte, ya sabemos que
      // otorgar esta oferta es justo lo que asigna el tag en Kajabi.
      await registrarTagKajabi(cliente.email, cliente.nombre, KAJABI_TAG_MIEMBRO_DEL_CLUB);
      // Con el acceso ya confirmado, se calculan los boletos (General/VIP/
      // Black) igual que lo haría `npm run asignar-boletos` en lote.
      cliente = await recalcularAccesos(cliente.id);
    } catch (err) {
      avisoKajabi = err instanceof Error ? err.message : "No se pudo otorgar el acceso en Kajabi";
    }

    // Igual de resiliente: la invitación a Skool no bloquea el alta si el
    // servicio falla.
    let avisoSkool: string | null = null;
    try {
      await invitarASkool(cliente.email);
      cliente = await marcarInvitacionSkoolEnviada(cliente.id);
    } catch (err) {
      avisoSkool = err instanceof Error ? err.message : "No se pudo enviar la invitación a Skool";
    }

    return NextResponse.json({ cliente, avisoKajabi, avisoSkool });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
