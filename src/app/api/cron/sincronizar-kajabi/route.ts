import { NextRequest, NextResponse } from "next/server";
import { guardarCursorSyncKajabi, marcarInvitacionSkoolEnviada, marcarMensajeBienvenidaWa, obtenerCursorSyncKajabi, registrarTagKajabi } from "@/lib/db";
import { altaEnGhl } from "@/lib/ghl";
import { KAJABI_OFFER_ID_CLUB_SINERGETICO, KAJABI_TAG_MIEMBRO_DEL_CLUB, nuevosConOfertaDesde } from "@/lib/kajabi";
import { invitarASkool } from "@/lib/skool";

export const maxDuration = 60;

// Un cliente detectado hace menos de esto se deja para la siguiente corrida
// en vez de buscarle teléfono de una vez — le da tiempo al webhook de
// Hotmart (que suele llegar casi al instante, pero no está garantizado) a
// dejarlo listo en hotmart_pendientes antes de que se le busque.
const RETRASO_MINIMO_MS = 60_000;

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

  const ahora = Date.now();
  const todos = await nuevosConOfertaDesde(KAJABI_OFFER_ID_CLUB_SINERGETICO, cursor);
  // Vienen del más viejo al más nuevo, así que en cuanto uno es demasiado
  // reciente, todos los que siguen también lo son — se cortan aquí y quedan
  // para la próxima corrida (no se pierden: el cursor solo avanza hasta el
  // último realmente procesado).
  const primerRetrasadoIdx = todos.findIndex((c) => ahora - new Date(c.creadoEn).getTime() < RETRASO_MINIMO_MS);
  const nuevos = primerRetrasadoIdx === -1 ? todos : todos.slice(0, primerRetrasadoIdx);

  for (const c of nuevos) {
    const { cliente, esNuevo } = await registrarTagKajabi(c.email, c.nombre, KAJABI_TAG_MIEMBRO_DEL_CLUB);

    // Compras que Kajabi detecta solo (típicamente vía su integración con
    // Hotmart) no pasaban por el alta normal del CRM, así que nunca
    // recibían la invitación de Skool ni el WhatsApp de bienvenida. Un
    // cliente nuevo aquí merece el mismo trato que uno dado de alta a mano.
    if (esNuevo) {
      try {
        await invitarASkool(cliente.email);
        await marcarInvitacionSkoolEnviada(cliente.id);
      } catch {
        // Best-effort: no bloquea el resto de la sincronización.
      }

      if (cliente.telefono) {
        try {
          await altaEnGhl(cliente.nombre, cliente.email, cliente.telefono);
          await marcarMensajeBienvenidaWa(cliente.id, "Enviado");
        } catch {
          await marcarMensajeBienvenidaWa(cliente.id, "Pendiente");
        }
      }
    }
  }
  if (nuevos.length > 0) {
    await guardarCursorSyncKajabi(nuevos[nuevos.length - 1].creadoEn);
  }

  return NextResponse.json({ ok: true, procesados: nuevos.length });
}
