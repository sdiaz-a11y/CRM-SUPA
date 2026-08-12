"use client";

import { useRef, useState } from "react";
import { X, Upload, Download, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useAutor } from "@/lib/autor-context";

const COLUMNAS = ["Nombre completo", "Correo", "País", "Teléfono", "Evento", "Tipo de membresía", "Etiqueta"];

type FilaCsv = {
  nombre: string;
  email: string;
  pais: string;
  telefono: string;
  evento: string;
  tipoMembresia: string;
  etiqueta: string;
};

type ResultadoFila = {
  fila: FilaCsv;
  ok: boolean;
  error?: string;
  avisoKajabi?: string | null;
  avisoSkool?: string | null;
  avisoGhl?: string | null;
};

// Quita marcas diacríticas (acentos) después de normalizar a NFD, para
// comparar encabezados sin importar si el usuario escribió "Pais" o "País".
const MARCAS_DIACRITICAS = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g");

function normalizarEncabezado(s: string): string {
  return s.normalize("NFD").replace(MARCAS_DIACRITICAS, "").trim().toLowerCase();
}

// Parser CSV mínimo con soporte de comillas (RFC 4180 básico) — evita
// depender de una librería de parsing en el navegador.
function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((v) => v.trim() !== ""));
}

function descargarCsv(nombreArchivo: string, encabezados: string[], filas: string[][]) {
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

function descargarPlantilla() {
  descargarCsv(
    "plantilla-clientes.csv",
    COLUMNAS,
    [["Juan Pérez", "juan@correo.com", "México", "+52 5512345678", "WJS-MX", "12 Meses", ""]]
  );
}

export function ImportarClientesModal({
  onClose,
  onTerminado,
}: {
  onClose: () => void;
  onTerminado: () => void;
}) {
  const { autor } = useAutor();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filas, setFilas] = useState<FilaCsv[] | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultados, setResultados] = useState<ResultadoFila[] | null>(null);

  function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorArchivo(null);
    setResultados(null);
    setNombreArchivo(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const texto = String(reader.result ?? "");
      const crudo = parsearCsv(texto);
      if (crudo.length < 2) {
        setErrorArchivo("El archivo no tiene filas de datos.");
        setFilas(null);
        return;
      }
      const encabezados = crudo[0].map(normalizarEncabezado);
      const idx = {
        nombre: encabezados.indexOf("nombre completo"),
        email: encabezados.indexOf("correo"),
        pais: encabezados.indexOf("pais"),
        telefono: encabezados.indexOf("telefono"),
        evento: encabezados.indexOf("evento"),
        tipoMembresia: encabezados.indexOf("tipo de membresia"),
        etiqueta: encabezados.indexOf("etiqueta"),
      };
      if (idx.nombre === -1 || idx.email === -1) {
        setErrorArchivo('El CSV debe tener al menos las columnas "Nombre completo" y "Correo".');
        setFilas(null);
        return;
      }
      const datos: FilaCsv[] = crudo.slice(1).map((f) => ({
        nombre: (f[idx.nombre] ?? "").trim(),
        email: (f[idx.email] ?? "").trim(),
        pais: idx.pais >= 0 ? (f[idx.pais] ?? "").trim() : "",
        telefono: idx.telefono >= 0 ? (f[idx.telefono] ?? "").trim() : "",
        evento: idx.evento >= 0 ? (f[idx.evento] ?? "").trim() : "",
        tipoMembresia: idx.tipoMembresia >= 0 ? (f[idx.tipoMembresia] ?? "").trim() : "",
        etiqueta: idx.etiqueta >= 0 ? (f[idx.etiqueta] ?? "").trim() : "",
      }));
      setFilas(datos);
    };
    reader.readAsText(file, "utf-8");
  }

  async function importar() {
    if (!filas || !autor) return;
    setProcesando(true);
    setProgreso(0);
    const salida: ResultadoFila[] = [];
    for (const fila of filas) {
      if (!fila.nombre || !fila.email) {
        salida.push({ fila, ok: false, error: "Falta nombre o correo" });
        setProgreso((p) => p + 1);
        continue;
      }
      try {
        const res = await fetch("/api/clientes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: fila.nombre,
            email: fila.email,
            pais: fila.pais || undefined,
            telefono: fila.telefono || undefined,
            evento: fila.evento || undefined,
            tipoMembresia: fila.tipoMembresia || undefined,
            etiqueta: fila.etiqueta || undefined,
            autor,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          salida.push({ fila, ok: false, error: data.error ?? "Error desconocido" });
        } else {
          salida.push({
            fila,
            ok: true,
            avisoKajabi: data.avisoKajabi,
            avisoSkool: data.avisoSkool,
            avisoGhl: data.avisoGhl,
          });
        }
      } catch {
        salida.push({ fila, ok: false, error: "Error de red" });
      }
      setProgreso((p) => p + 1);
    }
    setResultados(salida);
    setProcesando(false);
    onTerminado();
  }

  function exportarResultados() {
    if (!resultados) return;
    descargarCsv(
      "resultado-importacion.csv",
      ["Nombre", "Correo", "CRM", "Kajabi", "Skool", "GHL / WhatsApp"],
      resultados.map((r) => [
        r.fila.nombre,
        r.fila.email,
        r.ok ? "Creado" : `Error: ${r.error ?? ""}`,
        r.ok ? (r.avisoKajabi ? `Falló: ${r.avisoKajabi}` : "OK") : "—",
        r.ok ? (r.avisoSkool ? `Falló: ${r.avisoSkool}` : "OK") : "—",
        r.ok ? (r.avisoGhl ? `Falló: ${r.avisoGhl}` : "OK") : "—",
      ])
    );
  }

  const exitosos = resultados?.filter((r) => r.ok).length ?? 0;
  const conFallas = resultados?.filter((r) => r.ok && (r.avisoKajabi || r.avisoSkool || r.avisoGhl)).length ?? 0;
  const fallidos = resultados?.filter((r) => !r.ok).length ?? 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 p-6 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && !procesando && onClose()}
    >
      <div className="shell w-full max-w-2xl rounded-[2rem] p-2 diffused-lg animate-fade-in">
        <div className="core rounded-[calc(2rem-0.5rem)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Importar clientes desde CSV</h2>
            {!procesando && (
              <button
                onClick={onClose}
                className="ease-spring rounded-full p-1.5 text-muted transition hover:bg-surface-2"
              >
                <X className="h-4.5 w-4.5" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {!resultados && (
            <>
              <div className="mb-4 flex items-center justify-between rounded-xl border border-silver bg-surface-2 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">¿No sabes el formato?</p>
                  <p className="text-xs text-muted">Descarga la plantilla con las columnas exactas.</p>
                </div>
                <button
                  onClick={descargarPlantilla}
                  className="ease-spring flex items-center gap-1.5 rounded-lg border border-silver bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-2"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Descargar plantilla
                </button>
              </div>

              <label className="ease-spring flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-silver px-6 py-8 text-center transition hover:border-primary/50 hover:bg-surface-2">
                <Upload className="h-6 w-6 text-muted" strokeWidth={1.5} />
                <span className="text-sm font-medium text-foreground">
                  {nombreArchivo || "Elegir archivo CSV"}
                </span>
                <span className="text-xs text-muted">
                  {filas ? `${filas.length} filas detectadas` : "Nombre completo y Correo son obligatorios"}
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={onArchivo}
                  className="hidden"
                />
              </label>

              {errorArchivo && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-danger">
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {errorArchivo}
                </p>
              )}

              {procesando && (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                    <span>Procesando… no cierres esta ventana</span>
                    <span>
                      {progreso} / {filas?.length ?? 0}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full brand-plate transition-all"
                      style={{ width: `${filas?.length ? (progreso / filas.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={importar}
                disabled={!filas || filas.length === 0 || procesando}
                className="ease-spring mt-5 w-full rounded-xl brand-plate px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-40"
              >
                {procesando
                  ? "Importando…"
                  : filas
                    ? `Importar ${filas.length} cliente${filas.length === 1 ? "" : "s"}`
                    : "Importar"}
              </button>
            </>
          )}

          {resultados && (
            <>
              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-center">
                  <p className="text-lg font-semibold text-success">{exitosos}</p>
                  <p className="text-xs text-muted">Creados</p>
                </div>
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-center">
                  <p className="text-lg font-semibold text-warning">{conFallas}</p>
                  <p className="text-xs text-muted">Con avisos (revisar)</p>
                </div>
                <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-center">
                  <p className="text-lg font-semibold text-danger">{fallidos}</p>
                  <p className="text-xs text-muted">No creados</p>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto rounded-xl border border-silver">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">CRM</th>
                      <th className="px-3 py-2">Kajabi</th>
                      <th className="px-3 py-2">Skool</th>
                      <th className="px-3 py-2">WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((r, i) => (
                      <tr key={i} className="border-t border-silver/60">
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground">{r.fila.nombre || "—"}</p>
                          <p className="text-muted">{r.fila.email}</p>
                        </td>
                        <td className="px-3 py-2">
                          {r.ok ? (
                            <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.75} />
                          ) : (
                            <span className="flex items-center gap-1 text-danger">
                              <XCircle className="h-4 w-4 flex-none" strokeWidth={1.75} />
                              {r.error}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <EstadoAviso ok={r.ok} aviso={r.avisoKajabi} />
                        </td>
                        <td className="px-3 py-2">
                          <EstadoAviso ok={r.ok} aviso={r.avisoSkool} />
                        </td>
                        <td className="px-3 py-2">
                          <EstadoAviso ok={r.ok} aviso={r.avisoGhl} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={exportarResultados}
                  className="ease-spring flex items-center gap-1.5 rounded-lg border border-silver bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-2"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Exportar resultados
                </button>
                <button
                  onClick={onClose}
                  className="ease-spring ml-auto rounded-xl brand-plate px-4 py-2 text-sm font-medium text-white transition"
                >
                  Cerrar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EstadoAviso({ ok, aviso }: { ok: boolean; aviso?: string | null }) {
  if (!ok) return <span className="text-muted">—</span>;
  if (!aviso) return <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.75} />;
  return (
    <span className="flex items-start gap-1 text-warning" title={aviso}>
      <AlertTriangle className="h-4 w-4 flex-none" strokeWidth={1.75} />
      <span className="line-clamp-2">{aviso}</span>
    </span>
  );
}
