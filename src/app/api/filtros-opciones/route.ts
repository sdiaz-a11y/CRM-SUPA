import { NextResponse } from "next/server";
import { listarOpcionesFiltro } from "@/lib/db";

// Pagina la tabla completa de clientes (solo 2 columnas) para armar las
// listas de eventos/membresías; con 23k+ filas puede pasar el límite por
// defecto.
export const maxDuration = 30;

export async function GET() {
  const opciones = await listarOpcionesFiltro();
  return NextResponse.json(opciones);
}
