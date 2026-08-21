"use client";

import { useEffect, useRef, useState } from "react";
import { X, Upload, Download, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { descargarCsv } from "@/lib/csv";
import { ComboboxBuscador } from "./ComboboxBuscador";

const COLUMNAS = ["Nombre completo", "Correo", "Teléfono"];

type FilaCsv = {
  nombre: string;
  email: string;
  telefono: string;
};

type ResultadoFila = {
  fila: FilaCsv;
  ok: boolean;
  error?: string;
  avisoKajabi?: string | null;
};

type FiltroResultados = "todos" | "exitosos" | "errores";

// Mismo parser mínimo de CSV que ImportarClientesModal.tsx (RFC 4180 básico,
// sin depender de una librería).
const MARCAS_DIACRITICAS = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g");

function normalizarEncabezado(s: string): string {
  return s.normalize("NFD").replace(MARCAS_DIACRITICAS, "").trim().toLowerCase();
}

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

function descargarPlantilla() {
  descargarCsv("plantilla-otras-ofertas.csv", COLUMNAS, [["Juan Pérez", "juan@correo.com", "+52 5512345678"]]);
}

export function ImportarOtrasOfertasModal({
  onClose,
  onTerminado,
}: {
  onClose: () => void;
  onTerminado: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filas, setFilas] = useState<FilaCsv[] | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultados, setResultados] = useState<ResultadoFila[] | null>(null);
  const [filtroResultados, setFiltroResultados] = useState<FiltroResultados>("todos");

  const [ofertas, setOfertas] = useState<{ valor: string; etiqueta: string }[]>([]);
  const [ofertaGlobal, setOfertaGlobal] = useState("");
  const [etiquetas, setEtiquetas] = useState<{ valor: string; etiqueta: string }[]>([]);
  const [etiquetaGlobal, setEtiquetaGlobal] = useState("");
  const [tagsCatalogo, setTagsCatalogo] = useState<string[]>([]);
  const [tagsGlobal, setTagsGlobal] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/kajabi/ofertas")
      .then((r) => r.json())
      .then((data) => {
        const opciones: { id: string; titulo: string }[] = data.ofertas ?? [];
        setOfertas(opciones.map((o) => ({ valor: o.id, etiqueta: o.titulo })));
      })
      .catch(() => setOfertas([]));
    fetch("/api/biblioteca?tipo=etiqueta")
      .then((r) => r.json())
      .then((data) => setEtiquetas((data.opciones ?? []).map((v: string) => ({ valor: v, etiqueta: v }))))
      .catch(() => setEtiquetas([]));
    fetch("/api/biblioteca?tipo=tag")
      .then((r) => r.json())
      .then((data) => setTagsCatalogo(data.opciones ?? []))
      .catch(() => setTagsCatalogo([]));
  }, []);

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
        telefono: encabezados.indexOf("telefono"),
      };
      if (idx.nombre === -1 || idx.email === -1) {
        setErrorArchivo('El CSV debe tener al menos las columnas "Nombre completo" y "Correo".');
        setFilas(null);
        return;
      }
      const datos: FilaCsv[] = crudo.slice(1).map((f) => ({
        nombre: (f[idx.nombre] ?? "").trim(),
        email: (f[idx.email] ?? "").trim(),
        telefono: idx.telefono >= 0 ? (f[idx.telefono] ?? "").trim() : "",
      }));
      setFilas(datos);
    };
    reader.readAsText(file, "utf-8");
  }

  function alternarTag(tag: string) {
    setTagsGlobal((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function importar() {
    if (!filas || !ofertaGlobal) return;
    const ofertaTitulo = ofertas.find((o) => o.valor === ofertaGlobal)?.etiqueta ?? ofertaGlobal;
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
        const res = await fetch("/api/otras-ofertas/importar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: fila.nombre,
            email: fila.email,
            telefono: fila.telefono || undefined,
            ofertaId: ofertaGlobal,
            ofertaTitulo,
            etiqueta: etiquetaGlobal || undefined,
            tags: tagsGlobal.length ? tagsGlobal : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          salida.push({ fila, ok: false, error: data.error ?? "Error desconocido" });
        } else {
          salida.push({ fila, ok: true, avisoKajabi: data.avisoKajabi });
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

  function textoKajabi(r: ResultadoFila): string {
    if (!r.ok) return "—";
    return r.avisoKajabi ? r.avisoKajabi : "OK";
  }

  const resultadosFiltrados =
    resultados?.filter((r) => (filtroResultados === "todos" ? true : filtroResultados === "exitosos" ? r.ok : !r.ok)) ?? [];

  function exportarResultados() {
    if (!resultadosFiltrados.length) return;
    descargarCsv(
      "resultado-otras-ofertas.csv",
      ["Nombre", "Correo", "CRM", "Motivo (si no se dio la oferta)"],
      resultadosFiltrados.map((r) => [r.fila.nombre, r.fila.email, r.ok ? "OK" : `Error: ${r.error ?? ""}`, textoKajabi(r)])
    );
  }

  const exitosos = resultados?.filter((r) => r.ok).length ?? 0;
  const conAviso = resultados?.filter((r) => r.ok && r.avisoKajabi).length ?? 0;
  const fallidos = resultados?.filter((r) => !r.ok).length ?? 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-foreground/30 p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && !procesando && onClose()}
    >
      <div className="shell w-full max-w-2xl rounded-[2rem] p-2 diffused-lg animate-fade-in">
        <div className="core rounded-[calc(2rem-0.5rem)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Importar Otras Ofertas desde CSV</h2>
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

              <div className="mb-4">
                <span className="mb-1 block text-xs font-medium text-muted">Oferta a otorgar (obligatorio) *</span>
                <ComboboxBuscador
                  opciones={ofertas}
                  valor={ofertaGlobal}
                  onChange={setOfertaGlobal}
                  placeholder="Seleccionar oferta de Kajabi…"
                />
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

              {filas && filas.length > 0 && !procesando && (
                <>
                  <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-silver">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-3 py-2">Nombre</th>
                          <th className="px-3 py-2">Correo</th>
                          <th className="px-3 py-2">Teléfono</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((f, i) => (
                          <tr key={i} className="border-t border-silver/60">
                            <td className="px-3 py-2 text-foreground">{f.nombre || "—"}</td>
                            <td className="px-3 py-2 text-muted">{f.email || "—"}</td>
                            <td className="px-3 py-2 text-muted">{f.telefono || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2">
                    <div>
                      <span className="mb-1 block text-xs font-medium text-muted">Etiqueta (se aplica a todos, opcional)</span>
                      <ComboboxBuscador
                        opciones={etiquetas}
                        valor={etiquetaGlobal}
                        onChange={setEtiquetaGlobal}
                        placeholder="Seleccionar…"
                        etiquetaVacio="— Ninguna —"
                      />
                    </div>
                    {tagsCatalogo.length > 0 && (
                      <div>
                        <span className="mb-1 block text-xs font-medium text-muted">Tags (se aplican a todos, opcional)</span>
                        <div className="flex flex-wrap gap-1.5">
                          {tagsCatalogo.map((tag) => {
                            const activo = tagsGlobal.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => alternarTag(tag)}
                                className={`ease-spring rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                                  activo
                                    ? "border-primary bg-primary-dim text-primary-deep"
                                    : "border-silver bg-surface text-muted hover:bg-surface-2"
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </>
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
                disabled={!filas || filas.length === 0 || !ofertaGlobal || procesando}
                title={!ofertaGlobal ? "Elige primero una oferta" : undefined}
                className="ease-spring mt-5 w-full rounded-xl brand-plate px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-40"
              >
                {procesando
                  ? "Importando…"
                  : filas
                    ? `Importar ${filas.length} registro${filas.length === 1 ? "" : "s"}`
                    : "Importar"}
              </button>
            </>
          )}

          {resultados && (
            <>
              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-center">
                  <p className="text-lg font-semibold text-success">{exitosos}</p>
                  <p className="text-xs text-muted">Con oferta otorgada</p>
                </div>
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-center">
                  <p className="text-lg font-semibold text-warning">{conAviso}</p>
                  <p className="text-xs text-muted">Con avisos (revisar)</p>
                </div>
                <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-center">
                  <p className="text-lg font-semibold text-danger">{fallidos}</p>
                  <p className="text-xs text-muted">Con error</p>
                </div>
              </div>

              <div className="mb-3 flex items-center gap-1.5">
                {(["todos", "exitosos", "errores"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltroResultados(f)}
                    className={`ease-spring rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      filtroResultados === f
                        ? "brand-plate text-white"
                        : "border border-silver bg-surface text-foreground hover:bg-surface-2"
                    }`}
                  >
                    {f === "todos" ? "Todos" : f === "exitosos" ? "Exitosos" : "Errores"}
                  </button>
                ))}
              </div>

              <div className="max-h-80 overflow-y-auto rounded-xl border border-silver">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">CRM</th>
                      <th className="px-3 py-2">Motivo (si no se dio la oferta)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultadosFiltrados.map((r, i) => (
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
                          {!r.ok ? (
                            <span className="text-muted">—</span>
                          ) : r.avisoKajabi ? (
                            <span className="flex items-start gap-1 text-warning" title={r.avisoKajabi}>
                              <AlertTriangle className="h-4 w-4 flex-none" strokeWidth={1.75} />
                              <span className="line-clamp-2">{r.avisoKajabi}</span>
                            </span>
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.75} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={exportarResultados}
                  disabled={resultadosFiltrados.length === 0}
                  className="ease-spring flex items-center gap-1.5 rounded-lg border border-silver bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-2 disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Exportar {filtroResultados === "todos" ? "todos" : filtroResultados} ({resultadosFiltrados.length})
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
