import { createClient } from "@supabase/supabase-js";

// Cliente server-only con la secret key: se usa desde API routes y scripts,
// nunca se expone al navegador. RLS está activo sin policies en las tablas,
// así que solo este cliente (que lo ignora) puede leer/escribir datos.
const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  throw new Error("Faltan SUPABASE_URL / SUPABASE_SECRET_KEY en las variables de entorno");
}

export const supabase = createClient(url, secretKey, {
  auth: { persistSession: false },
});
