// Crea el primer usuario admin (bootstrap): el panel de Usuarios requiere
// que ya exista un admin para poder crear más usuarios desde ahí.
//
// Uso: npm run crear-admin -- correo@ejemplo.com "Nombre Apellido" "contraseña-temporal"
import "./_env";
import { hashPassword } from "../src/lib/auth";
import { normalizarEmail } from "../src/lib/db";
import { supabase } from "../src/lib/supabase";

async function main() {
  const [, , emailArg, nombreArg, passwordArg] = process.argv;
  if (!emailArg || !nombreArg || !passwordArg) {
    console.error('Uso: npm run crear-admin -- correo@ejemplo.com "Nombre Apellido" "contraseña-temporal"');
    process.exit(1);
  }
  if (passwordArg.length < 8) {
    console.error("La contraseña debe tener al menos 8 caracteres.");
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
    console.error(`Ya existe un usuario con ese correo (${email}).`);
    process.exit(1);
  }

  const password_hash = await hashPassword(passwordArg);
  const { error } = await supabase.from("usuarios").insert({
    email,
    nombre: nombreArg,
    password_hash,
    rol: "admin",
    activo: true,
    token_version: 1,
  });
  if (error) throw error;

  console.log(`Admin creado: ${email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
