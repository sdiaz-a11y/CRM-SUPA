"use client";

import { useEffect, useState } from "react";
import { X, Gift, Mail, Phone, MapPin, LogIn, Clock, IdCard } from "lucide-react";
import type { OfertaOtorgada, OtraOfertaCliente } from "@/lib/types";
import { useSesion } from "@/lib/session-context";
import { tienePermiso } from "@/lib/permisos";
import type { PerfilKajabi } from "@/lib/kajabi";

// Detalle "lista simple" de un registro de Otras Ofertas: datos capturados
// en el CSV, historial fechado de ofertas otorgadas (con revocar), y el
// Perfil de Kajabi en vivo — sin pestañas, notas ni timeline, a diferencia
// del panel de un cliente del Club.
export function OtraOfertaDetalle({ clienteId, onClose }: { clienteId: string; onClose: () => void }) {
  const { usuario } = useSesion();
  const puedeRevocar = !!usuario && tienePermiso(usuario.rol, "importarOtrasOfertas");

  const [cliente, setCliente] = useState<OtraOfertaCliente | null>(null);
  const [ofertas, setOfertas] = useState<OfertaOtorgada[]>([]);
  const [cargando, setCargando] = useState(true);
  const [perfilKajabi, setPerfilKajabi] = useState<PerfilKajabi | null>(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);
  const [confirmandoRevocarId, setConfirmandoRevocarId] = useState<string | null>(null);
  const [revocandoId, setRevocandoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    fetch(`/api/otras-ofertas/${encodeURIComponent(clienteId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelado) return;
        setCliente(data.cliente ?? null);
        setOfertas(data.ofertas ?? []);
        setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [clienteId]);

  useEffect(() => {
    if (!cliente) return;
    let cancelado = false;
    setCargandoPerfil(true);
    setErrorPerfil(null);
    fetch(`/api/kajabi/perfil?email=${encodeURIComponent(cliente.email)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelado) return;
        if (data.perfil) setPerfilKajabi(data.perfil);
        else setErrorPerfil(data.error ?? "No se pudo consultar Kajabi");
      })
      .catch(() => {
        if (!cancelado) setErrorPerfil("No se pudo consultar Kajabi");
      })
      .finally(() => {
        if (!cancelado) setCargandoPerfil(false);
      });
    return () => {
      cancelado = true;
    };
  }, [cliente]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function revocar(grantId: string) {
    if (!cliente || !puedeRevocar) return;
    if (confirmandoRevocarId !== grantId) {
      setConfirmandoRevocarId(grantId);
      return;
    }
    setRevocandoId(grantId);
    const res = await fetch(`/api/otras-ofertas/${encodeURIComponent(cliente.id)}/revocar-oferta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ofertaGrantId: grantId }),
    });
    const data = await res.json();
    setRevocandoId(null);
    setConfirmandoRevocarId(null);
    if (!res.ok) {
      window.alert(`No se pudo revocar la oferta: ${data.error ?? "error desconocido"}`);
      return;
    }
    setOfertas(data.ofertas ?? []);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-foreground/30 p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="shell w-full max-w-lg rounded-[2rem] p-2 diffused-lg animate-fade-in">
        <div className="core max-h-[85vh] overflow-y-auto rounded-[calc(2rem-0.5rem)] p-6">
          {cargando || !cliente ? (
            <p className="p-6 text-center text-sm text-muted">Cargando…</p>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">{cliente.nombre}</h2>
                  <p className="truncate text-xs text-muted">{cliente.email}</p>
                </div>
                <button
                  onClick={onClose}
                  className="ease-spring flex-none rounded-full p-1.5 text-muted transition hover:bg-surface-2"
                >
                  <X className="h-4.5 w-4.5" strokeWidth={1.75} />
                </button>
              </div>

              <div className="space-y-4">
                <Tarjeta titulo="Datos">
                  <dl className="space-y-2.5 text-sm">
                    <DatoFila icon={Phone} label="Teléfono" valor={cliente.telefono} />
                    <CampoValor label="Etiqueta" valor={cliente.etiqueta} />
                    <CampoValor label="Tags" valor={cliente.tags.length ? cliente.tags.join(", ") : null} />
                  </dl>
                </Tarjeta>

                <Tarjeta titulo="Ofertas otorgadas">
                  {ofertas.length === 0 ? (
                    <p className="text-sm text-muted">Todavía no se le ha otorgado ninguna oferta.</p>
                  ) : (
                    <ul className="space-y-2">
                      {ofertas.map((o) => (
                        <li
                          key={o.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-silver px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-sm text-foreground">
                              <Gift
                                className={`h-3.5 w-3.5 flex-none ${o.revocadoEn ? "text-muted" : "text-success"}`}
                                strokeWidth={1.75}
                              />
                              {o.ofertaTitulo}
                            </p>
                            <p className="text-xs text-muted">
                              Otorgada el {new Date(o.fechaOtorgada).toLocaleDateString("es-MX")} por {o.otorgadoPor}
                              {o.revocadoEn &&
                                ` — revocada el ${new Date(o.revocadoEn).toLocaleDateString("es-MX")} por ${o.revocadoPor}`}
                            </p>
                          </div>
                          {puedeRevocar && !o.revocadoEn && (
                            <>
                              {confirmandoRevocarId === o.id ? (
                                <div className="flex flex-none items-center gap-1.5">
                                  <button
                                    onClick={() => setConfirmandoRevocarId(null)}
                                    className="ease-spring rounded-lg border border-silver px-2 py-1 text-xs font-medium text-muted transition hover:text-foreground"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={() => revocar(o.id)}
                                    disabled={revocandoId === o.id}
                                    className="ease-spring rounded-lg bg-danger px-2 py-1 text-xs font-medium text-white transition disabled:opacity-50"
                                  >
                                    {revocandoId === o.id ? "Revocando…" : "Sí, revocar"}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => revocar(o.id)}
                                  className="ease-spring flex-none rounded-lg border border-silver px-2 py-1 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
                                >
                                  Revocar
                                </button>
                              )}
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Tarjeta>

                <Tarjeta titulo="Perfil de Kajabi">
                  {cargandoPerfil ? (
                    <p className="text-sm text-muted">Consultando en Kajabi…</p>
                  ) : errorPerfil ? (
                    <p className="text-sm text-danger">{errorPerfil}</p>
                  ) : perfilKajabi && !perfilKajabi.encontrado ? (
                    <p className="text-sm text-muted">Todavía no tiene contacto en Kajabi.</p>
                  ) : perfilKajabi ? (
                    <dl className="space-y-2.5 text-sm">
                      <CampoValor label="Nombre en Kajabi" valor={perfilKajabi.nombre} />
                      <DatoFila icon={Mail} label="Correo" valor={perfilKajabi.email} />
                      <DatoFila icon={Phone} label="Teléfono" valor={perfilKajabi.telefono} />
                      <DatoFila
                        icon={MapPin}
                        label="Dirección"
                        valor={formatearDireccion(perfilKajabi.direccion).join(" · ") || null}
                      />
                      <CampoValor
                        label="Suscrito a marketing"
                        valor={perfilKajabi.suscritoMarketing === null ? null : perfilKajabi.suscritoMarketing ? "Sí" : "No"}
                      />
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted">Ofertas activas en Kajabi ahora mismo</p>
                        {perfilKajabi.ofertas.length === 0 ? (
                          <p className="text-foreground">
                            <span className="text-muted">—</span>
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {perfilKajabi.ofertas.map((o) => (
                              <li key={o.id} className="flex items-center gap-1.5 text-foreground">
                                <IdCard className="h-3.5 w-3.5 flex-none text-success" strokeWidth={1.75} />
                                {o.titulo}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <DatoFila
                        icon={LogIn}
                        label="Inicios de sesión"
                        valor={perfilKajabi.signInCount === null ? null : String(perfilKajabi.signInCount)}
                      />
                      <DatoFila
                        icon={Clock}
                        label="Última actividad"
                        valor={
                          perfilKajabi.ultimaActividad
                            ? new Date(perfilKajabi.ultimaActividad).toLocaleString("es-MX", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : null
                        }
                      />
                    </dl>
                  ) : null}
                </Tarjeta>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatearDireccion(d: PerfilKajabi["direccion"]): string[] {
  if (!d) return [];
  const linea1 = [d.calle1, d.calle2].filter(Boolean).join(", ");
  const linea2 = [d.ciudad, d.estado, d.codigoPostal].filter(Boolean).join(", ");
  return [linea1, linea2, d.pais].filter((l): l is string => !!l);
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="shell rounded-2xl p-2 diffused">
      <div className="core rounded-[calc(1rem-0.25rem)] p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">{titulo}</h3>
        {children}
      </div>
    </section>
  );
}

function DatoFila({ icon: Icon, label, valor }: { icon: typeof Phone; label: string; valor: string | null }) {
  return (
    <div className="flex items-start gap-2 text-foreground">
      <Icon className="mt-0.5 h-3.5 w-3.5 flex-none text-muted" strokeWidth={1.75} />
      <span>
        <span className="text-muted">{label}: </span>
        {valor || <span className="text-muted">—</span>}
      </span>
    </div>
  );
}

function CampoValor({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="text-foreground">{valor || <span className="text-muted">—</span>}</p>
    </div>
  );
}
