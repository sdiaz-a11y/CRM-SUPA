"use client";

import { useEffect } from "react";

// Registra el service worker mínimo que hace instalable la app (Android/
// Chrome lo exige para el prompt de "Agregar a pantalla de inicio"). No
// renderiza nada — solo el efecto secundario del registro.
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
