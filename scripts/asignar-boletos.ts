import fs from "node:fs/promises";
import path from "node:path";
import { cargarInventarioBoletos, calcularAccesos } from "../src/lib/boletos";
import type { Db } from "../src/lib/types";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

async function main() {
  const inventario = await cargarInventarioBoletos();
  const raw = await fs.readFile(DB_PATH, "utf-8");
  const db: Db = JSON.parse(raw);

  let sinInfo = 0;
  let conAlgunAcceso = 0;

  for (const cliente of db.clientes) {
    const { accesos, sinInformacion } = calcularAccesos(
      {
        evento: cliente.evento,
        pais: cliente.pais,
        accesoPlataforma: cliente.accesoPlataforma,
        tipoMembresia: cliente.tipoMembresia,
        fechaInscripcion: cliente.fechaInscripcion,
        finAcceso: cliente.finAcceso,
      },
      inventario
    );
    cliente.accesos = accesos;
    cliente.boletosSinInformacion = sinInformacion;
    cliente.actualizadoEn = new Date().toISOString();

    if (accesos.general.activo || accesos.vip.activo || accesos.black.activo) {
      conAlgunAcceso++;
    }
    if (sinInformacion) sinInfo++;
  }

  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");

  console.log(`Accesos recalculados para ${db.clientes.length} clientes.`);
  console.log(`  Con al menos un acceso activo: ${conAlgunAcceso}`);
  console.log(`  Sin información de boletos (evento no está en el inventario): ${sinInfo}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
