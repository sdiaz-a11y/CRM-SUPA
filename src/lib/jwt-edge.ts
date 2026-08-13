import { jwtVerify, SignJWT } from "jose";
import type { Rol } from "./permisos";

// Módulo separado de auth.ts a propósito: solo usa `jose` (Edge-safe), sin
// bcryptjs ni next/headers ni el cliente de Supabase. middleware.ts corre en
// el runtime Edge y no puede cargar esas dependencias Node-only.
export const COOKIE_SESION = "crm_sesion";
export const SESION_DURACION_SEG = 60 * 60 * 24 * 7; // 7 días

export type ClaimsSesion = {
  sub: string;
  email: string;
  nombre: string;
  rol: Rol;
  tokenVersion: number;
};

function clave(): Uint8Array {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto) throw new Error("Falta AUTH_SECRET en las variables de entorno");
  return new TextEncoder().encode(secreto);
}

export async function crearTokenSesion(claims: ClaimsSesion): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESION_DURACION_SEG}s`)
    .sign(clave());
}

// Solo verifica firma/expiración — no toca la base de datos. No confirma que
// el usuario siga activo ni que su rol no haya cambiado (eso lo hace
// obtenerUsuarioActual en auth.ts). Úsese solo para el gate barato del
// middleware.
export async function verificarTokenSesion(token: string): Promise<ClaimsSesion | null> {
  try {
    const { payload } = await jwtVerify(token, clave());
    return payload as unknown as ClaimsSesion;
  } catch {
    return null;
  }
}
