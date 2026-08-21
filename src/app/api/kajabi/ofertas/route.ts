import { NextResponse } from "next/server";
import { requerirPermiso } from "@/lib/auth";
import { listarOfertas } from "@/lib/kajabi";

// Catálogo completo de ofertas de Kajabi, para alimentar los selectores de
// "Otras Ofertas" (importar CSV) y del Club ("Agregar oferta" / oferta
// adicional en la alta). Cualquiera de los tres roles puede verlo — es solo
// lectura de un catálogo, no una acción sensible.
export async function GET() {
  const permiso = await requerirPermiso("verOtrasOfertas");
  if (!permiso.ok) return permiso.respuesta;

  try {
    const ofertas = await listarOfertas();
    return NextResponse.json({ ofertas });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
