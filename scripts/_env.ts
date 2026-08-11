// Los scripts corren con tsx fuera de Next.js, que no carga .env.local
// automáticamente. Este loader mínimo lo hace antes de importar cualquier
// módulo que lea variables de entorno (debe ser el primer import).
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const contenido = fs.readFileSync(envPath, "utf-8");
  for (const linea of contenido.split("\n")) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const idx = limpia.indexOf("=");
    if (idx === -1) continue;
    const clave = limpia.slice(0, idx).trim();
    const valor = limpia.slice(idx + 1).trim();
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}
