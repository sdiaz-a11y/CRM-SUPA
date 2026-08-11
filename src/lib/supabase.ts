import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente server-only con la secret key: se usa desde API routes y scripts,
// nunca se expone al navegador. RLS está activo sin policies en las tablas,
// así que solo este cliente (que lo ignora) puede leer/escribir datos.
//
// Se crea de forma perezosa (al primer uso real, no al importar el módulo):
// Next.js importa los route.ts durante "Collecting page data" en el build,
// y si esto lanzara un error al importarse, tumbaría el build entero aunque
// ninguna petición real se haya hecho todavía.
let cliente: SupabaseClient | null = null;

function obtenerCliente(): SupabaseClient {
  if (cliente) return cliente;

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Faltan SUPABASE_URL / SUPABASE_SECRET_KEY en las variables de entorno");
  }

  cliente = createClient(url, secretKey, { auth: { persistSession: false } });
  return cliente;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(obtenerCliente(), prop, receiver);
  },
});
