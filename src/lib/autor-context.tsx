"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "crm_autor_nombre";

type AutorContextValue = {
  autor: string | null;
  cargando: boolean;
  establecerAutor: (nombre: string) => void;
  cambiarAutor: () => void;
};

const AutorContext = createContext<AutorContextValue | null>(null);

export function AutorProvider({ children }: { children: React.ReactNode }) {
  const [autor, setAutor] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const guardado = window.localStorage.getItem(STORAGE_KEY);
    setAutor(guardado);
    setCargando(false);
  }, []);

  const establecerAutor = useCallback((nombre: string) => {
    const limpio = nombre.trim();
    if (!limpio) return;
    window.localStorage.setItem(STORAGE_KEY, limpio);
    setAutor(limpio);
  }, []);

  const cambiarAutor = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setAutor(null);
  }, []);

  return (
    <AutorContext.Provider value={{ autor, cargando, establecerAutor, cambiarAutor }}>
      {children}
    </AutorContext.Provider>
  );
}

export function useAutor() {
  const ctx = useContext(AutorContext);
  if (!ctx) throw new Error("useAutor debe usarse dentro de AutorProvider");
  return ctx;
}
