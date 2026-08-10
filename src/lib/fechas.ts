// "Vencimiento Skool" viene como texto libre D/M/YYYY (día/mes sin ceros).
export function parsearFechaSkool(v: string | null | undefined): Date | null {
  if (!v) return null;
  const partes = v.split("/");
  if (partes.length !== 3) return null;
  const [d, m, y] = partes.map(Number);
  if (!d || !m || !y) return null;
  const fecha = new Date(y, m - 1, d);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}
