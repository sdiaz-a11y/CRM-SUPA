"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { UsuarioSesion } from "./auth";

// Reemplaza al viejo AutorProvider/AutorGate (nombre libre en localStorage,
// sin verificación real). La identidad ahora viene del servidor —
// /api/auth/me relee la sesión (cookie + DB) en cada refresco, así que un
// cambio de rol o una desactivación desde el panel de Usuarios se refleja
// aquí sin esperar a que expire la cookie.
type SesionContextValue = {
  usuario: UsuarioSesion | null;
  cargando: boolean;
  refrescar: () => Promise<void>;
  cerrarSesion: () => Promise<void>;
};

const SesionContext = createContext<SesionContextValue | null>(null);

const INTERVALO_REFRESCO_MS = 5 * 60 * 1000;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        setUsuario(null);
        return;
      }
      const data = await res.json();
      setUsuario(data.usuario);
    } catch {
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    refrescar();
    const intervalo = setInterval(refrescar, INTERVALO_REFRESCO_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") refrescar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [refrescar]);

  const cerrarSesion = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUsuario(null);
    window.location.href = "/login";
  }, []);

  return (
    <SesionContext.Provider value={{ usuario, cargando, refrescar, cerrarSesion }}>
      {children}
    </SesionContext.Provider>
  );
}

export function useSesion() {
  const ctx = useContext(SesionContext);
  if (!ctx) throw new Error("useSesion debe usarse dentro de SessionProvider");
  return ctx;
}
