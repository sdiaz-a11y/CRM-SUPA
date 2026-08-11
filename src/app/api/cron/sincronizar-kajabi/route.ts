import { NextRequest, NextResponse } from "next/server";
import { guardarCursorSyncKajabi, obtenerCursorSyncKajabi, registrarTagKajabi } from "@/lib/db";
import { KAJABI_OFFER_ID_CLUB_SINERGETICO, KAJABI_TAG_MIEMBRO_DEL_CLUB, nuevosConOfertaDesde } from "@/lib/kajabi";

export const maxDuration = 60;

// Reemplaza al webhook nativo de Kajabi (sin permiso disponible para esta
// cuenta): un llamador externo (cron de GitHub Actions, cada ~15 min) pega
// aquí y se consulta activamente quién tiene la oferta otorgada desde la
// última corrida. En la primera corrida NO se procesa nada existente — solo
// se establece "ahora" como punto de partida — para no arrastrar altas
// viejas (incluye un error histórico donde se le otorgó la oferta a
// contactos que nunca compraron nada).
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cursor = await obtenerCursorSyncKajabi();
  if (!cursor) {
    await guardarCursorSyncKajabi(new Date().toISOString());
    return NextResponse.json({ ok: true, procesados: 0, nota: "cursor inicial establecido" });
  }

  const nuevos = await nuevosConOfertaDesde(KAJABI_OFFER_ID_CLUB_SINERGETICO, cursor);
  for (const c of nuevos) {
    await registrarTagKajabi(c.email, c.nombre, KAJABI_TAG_MIEMBRO_DEL_CLUB);
  }
  if (nuevos.length > 0) {
    await guardarCursorSyncKajabi(nuevos[nuevos.length - 1].creadoEn);
  }

  return NextResponse.json({ ok: true, procesados: nuevos.length });
}
