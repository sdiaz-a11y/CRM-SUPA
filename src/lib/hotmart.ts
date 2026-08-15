// Extracción defensiva del payload del webhook de Hotmart: no hay acceso a
// un pago real todavía para confirmar el formato exacto contra la cuenta,
// así que se prueban varias rutas conocidas de su formato v2.0.0 (y algunas
// del v1.0.0 por si acaso) en vez de asumir una sola forma fija.
export type DatosHotmart = { email: string; telefono: string | null; producto: string | null };

function primerString(...valores: unknown[]): string | null {
  for (const v of valores) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export function extraerDatosHotmart(payload: unknown): DatosHotmart | null {
  const p = obj(payload);
  const data = Object.keys(obj(p.data)).length ? obj(p.data) : p;
  const buyer = Object.keys(obj(data.buyer)).length ? obj(data.buyer) : obj(data.subscriber);
  const product = obj(data.product);

  const email = primerString(buyer.email, data.email, p.email);
  if (!email) return null;

  const codigo = primerString(buyer.checkout_phone_code, buyer.ddi, buyer.phone_code);
  const numero = primerString(buyer.checkout_phone, buyer.phone, buyer.phone_number, data.phone);
  const telefono = numero ? (codigo && !numero.startsWith(codigo) ? `${codigo}${numero}` : numero) : null;

  const producto = primerString(product.name, data.product_name);

  return { email, telefono, producto };
}
