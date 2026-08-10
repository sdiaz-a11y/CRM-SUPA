import { NextResponse } from "next/server";
import { listarOpcionesFiltro } from "@/lib/db";

export async function GET() {
  const opciones = await listarOpcionesFiltro();
  return NextResponse.json(opciones);
}
