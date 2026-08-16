// Corrección única para clientes que se crearon automáticamente por el
// sincronizador de Kajabi (antes de que esta corrección existiera): les
// faltaba el teléfono (nunca se consultaba el perfil de Kajabi) y quedaban
// marcados como "sin acceso a la plataforma" aunque Kajabi ya les había
// confirmado el acceso — el indicador de la lista mentía. Este script:
//   1. Encuentra todos los clientes con el evento "CREACION" autor="Kajabi".
//   2. Si acceso_plataforma no es "Si", lo corrige (por definición, si
//      llegaron por esta vía es porque Kajabi ya les había otorgado la oferta).
//   3. Si no tienen teléfono, intenta traerlo del perfil real de Kajabi —
//      nunca pisa un teléfono que ya esté capturado.
//
// Uso: npm run backfill-kajabi-clientes
import "./_env";
import { obtenerPerfilKajabi } from "../src/lib/kajabi";
import { supabase } from "../src/lib/supabase";

async function main() {
  const { data: eventos, error: errEventos } = await supabase
    .from("eventos_timeline")
    .select("cliente_id")
    .eq("tipo", "CREACION")
    .eq("autor", "Kajabi");
  if (errEventos) throw errEventos;

  const ids = [...new Set((eventos ?? []).map((e) => e.cliente_id))];
  console.log(`Clientes creados automáticamente desde Kajabi: ${ids.length}`);

  const { data: clientes, error: errClientes } = await supabase
    .from("clientes")
    .select("id,nombre,telefono,acceso_plataforma")
    .in("id", ids);
  if (errClientes) throw errClientes;

  let accesoCorregido = 0;
  let telefonoEncontrado = 0;
  let telefonoNoEncontrado = 0;
  let errores = 0;

  for (const c of clientes ?? []) {
    const cambios: Record<string, string> = {};

    if ((c.acceso_plataforma ?? "").trim().toLowerCase() !== "si") {
      cambios.acceso_plataforma = "Si";
      accesoCorregido++;
    }

    if (!c.telefono) {
      try {
        const perfil = await obtenerPerfilKajabi(c.id);
        if (perfil.telefono) {
          cambios.telefono = perfil.telefono;
          telefonoEncontrado++;
        } else {
          telefonoNoEncontrado++;
        }
      } catch (err) {
        errores++;
        console.error(`  error consultando Kajabi para ${c.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
      // Pequeña pausa entre llamadas — sin esto, una corrida con muchos
      // clientes (como el backfill inicial de 158) empieza a toparse con
      // rate-limiting de la API de Kajabi a la mitad.
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    if (Object.keys(cambios).length > 0) {
      cambios.actualizado_en = new Date().toISOString();
      const { error } = await supabase.from("clientes").update(cambios).eq("id", c.id);
      if (error) {
        errores++;
        console.error(`  error guardando ${c.id}:`, error.message);
      } else {
        console.log(`  ${c.nombre} (${c.id}): ${JSON.stringify(cambios)}`);
      }
    }
  }

  console.log("\n=== RESUMEN ===");
  console.log(`Acceso a plataforma corregido a "Si": ${accesoCorregido}`);
  console.log(`Teléfono encontrado y guardado: ${telefonoEncontrado}`);
  console.log(`Teléfono no encontrado en Kajabi: ${telefonoNoEncontrado}`);
  console.log(`Errores: ${errores}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
