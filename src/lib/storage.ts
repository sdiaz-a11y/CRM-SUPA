import { randomUUID } from "crypto";
import { supabase } from "@/lib/supabase";

// Bucket privado (no público): los comprobantes de pago solo se ven vía URL
// firmada de corta duración, nunca por link directo.
export const BUCKET_COMPROBANTES = "comprobantes-pago";

const TAMANO_MAXIMO_BYTES = 8 * 1024 * 1024;
const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

export async function subirComprobante(solicitudId: string, archivo: File): Promise<string> {
  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    throw new Error(`"${archivo.name}" pesa más de 8 MB`);
  }
  if (archivo.type && !TIPOS_PERMITIDOS.includes(archivo.type)) {
    throw new Error(`"${archivo.name}" no es una imagen o PDF válido`);
  }

  const extension = archivo.name.includes(".") ? archivo.name.split(".").pop() : "bin";
  const ruta = `${solicitudId}/${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await archivo.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .upload(ruta, buffer, { contentType: archivo.type || "application/octet-stream" });
  if (error) throw error;

  return ruta;
}

// 10 minutos: alcanza de sobra para que el admin vea el comprobante al
// revisar, sin dejar el link firmado activo por más tiempo del necesario.
export async function urlFirmadaComprobante(ruta: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_COMPROBANTES).createSignedUrl(ruta, 600);
  if (error) throw error;
  return data.signedUrl;
}
