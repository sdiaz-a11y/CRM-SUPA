// Crea el bucket privado de Supabase Storage donde se guardan los
// comprobantes de pago subidos desde "Solicitudes". Idempotente: si el
// bucket ya existe, no hace nada. Se corre una sola vez.
//
// Usa fetch directo contra la API de Storage (no el cliente de
// @supabase/supabase-js): ese cliente instancia siempre un RealtimeClient,
// que en Node 20 sin WebSocket global revienta al construirse — este script
// no necesita nada de Realtime, así que evita el problema por completo.
//
// Uso: npx tsx scripts/setup-storage-comprobantes.ts
import "./_env";

const BUCKET_COMPROBANTES = "comprobantes-pago";

async function main() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Faltan SUPABASE_URL / SUPABASE_SECRET_KEY");

  const headers = {
    Authorization: `Bearer ${secretKey}`,
    apikey: secretKey,
    "Content-Type": "application/json",
  };

  const resLista = await fetch(`${url}/storage/v1/bucket`, { headers });
  if (!resLista.ok) throw new Error(`No se pudo listar buckets: ${resLista.status} ${await resLista.text()}`);
  const buckets = (await resLista.json()) as { name: string }[];

  if (buckets.some((b) => b.name === BUCKET_COMPROBANTES)) {
    console.log(`El bucket "${BUCKET_COMPROBANTES}" ya existe.`);
    return;
  }

  const resCrear = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: BUCKET_COMPROBANTES, public: false, file_size_limit: "8MB" }),
  });
  if (!resCrear.ok) throw new Error(`No se pudo crear el bucket: ${resCrear.status} ${await resCrear.text()}`);

  console.log(`Bucket "${BUCKET_COMPROBANTES}" creado (privado).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
