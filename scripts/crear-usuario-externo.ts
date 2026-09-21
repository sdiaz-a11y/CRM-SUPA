// Crea un usuario "placeholder" para atribuir solicitudes que llegan de un
// formulario externo sin sesión de este CRM (ver /api/solicitudes-externas y
// FORMULARIO-SOLICITUDES-VSL.md) — solicitudes_cliente.solicitado_por_id
// exige un usuario real (FK not null), así que no puede quedar en null.
//
// Se crea inactivo (activo=false) y con contraseña aleatoria que no se
// muestra ni se guarda: nunca debe iniciar sesión de verdad, solo existe
// para que la fila de la solicitud tenga a quién apuntar.
//
// Uso: npm run crear-usuario-externo -- correo@ejemplo.com "Nombre a mostrar"
import "./_env";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { normalizarEmail } from "../src/lib/db";
import { supabase } from "../src/lib/supabase";

async function main() {
  const [, , emailArg, nombreArg] = process.argv;
  if (!emailArg || !nombreArg) {
    console.error('Uso: npm run crear-usuario-externo -- correo@ejemplo.com "Nombre a mostrar"');
    process.exit(1);
  }

  const email = normalizarEmail(emailArg);
  const { data: existente, error: errLectura } = await supabase
    .from("usuarios")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (errLectura) throw errLectura;
  if (existente) {
    console.log(`Ya existía — id: ${existente.id}`);
    return;
  }

  const password_hash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
  const { data, error } = await supabase
    .from("usuarios")
    .insert({ email, nombre: nombreArg, password_hash, rol: "abeja", activo: false })
    .select("id")
    .single();
  if (error) throw error;

  console.log(`Usuario creado: ${email}`);
  console.log(`id: ${data.id}`);
  console.log("Pega ese id en SOLICITUDES_EXTERNAS_USUARIO_ID (.env.local y Vercel).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
