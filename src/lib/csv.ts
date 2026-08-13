// Descarga un CSV en el navegador a partir de encabezados + filas. Usado
// tanto por la exportación de resultados de ImportarClientesModal como por
// el botón "Descargar CSV" de la lista de clientes.
export function descargarCsv(nombreArchivo: string, encabezados: string[], filas: string[][]) {
  const escapar = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lineas = [encabezados, ...filas].map((f) => f.map(escapar).join(","));
  // BOM al inicio para que Excel detecte UTF-8 y no rompa los acentos.
  const contenido = "﻿" + lineas.join("\n") + "\n";
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}
