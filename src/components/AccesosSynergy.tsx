"use client";

import { ShieldCheck, Crown, Gem, Loader2, Minus, Plus } from "lucide-react";
import type { Accesos, Variante } from "@/lib/types";

const NIVELES: {
  key: keyof Accesos;
  label: string;
  icon: typeof ShieldCheck;
  activeClass: string;
  tieneVariante: boolean;
}[] = [
  {
    key: "general",
    label: "General",
    icon: ShieldCheck,
    activeClass: "general-plate text-white",
    tieneVariante: true,
  },
  {
    key: "vip",
    label: "VIP",
    icon: Crown,
    activeClass: "vip-plate text-white",
    tieneVariante: true,
  },
  {
    key: "black",
    label: "Black Access",
    icon: Gem,
    activeClass: "black-plate text-white",
    tieneVariante: false,
  },
];

export function AccesosSynergy({
  accesos,
  pendiente,
  onToggle,
  editando,
  onCambiarDetalle,
  soloLectura,
}: {
  accesos: Accesos;
  pendiente: keyof Accesos | null;
  onToggle: (nivel: keyof Accesos, activo: boolean) => void;
  editando?: boolean;
  onCambiarDetalle?: (nivel: keyof Accesos, cambios: { cantidad?: number; variante?: Variante }) => void;
  // El switch principal (a diferencia del editor de cantidad/variante, que ya
  // depende de `editando`) es clickeable siempre por defecto — soloLectura lo
  // deshabilita para roles sin permiso de editar accesos.
  soloLectura?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {NIVELES.map(({ key, label, icon: Icon, activeClass, tieneVariante }) => {
        const detalle = accesos[key];
        const activo = detalle.activo;
        const cargando = pendiente === key;
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <button
              type="button"
              disabled={cargando || soloLectura}
              onClick={() => onToggle(key, !activo)}
              aria-pressed={activo}
              className={`ease-spring flex w-full flex-col items-center gap-2 rounded-2xl border px-3 py-5 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
                activo
                  ? `${activeClass} border-transparent diffused`
                  : "border-silver bg-surface-2 text-muted hover:border-silver-deep"
              }`}
            >
              {cargando ? (
                <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.75} />
              ) : (
                <Icon className="h-6 w-6" strokeWidth={1.75} />
              )}
              <span className="text-base font-semibold">{label}</span>
              <span className={`text-sm uppercase tracking-wide ${activo ? "opacity-80" : "opacity-60"}`}>
                {activo
                  ? `${detalle.cantidad}${detalle.variante ? ` · ${detalle.variante}` : ""}`
                  : "Sin acceso"}
              </span>
            </button>

            {editando && onCambiarDetalle && (
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => onCambiarDetalle(key, { cantidad: Math.max(0, detalle.cantidad - 1) })}
                  className="ease-spring flex h-6 w-6 items-center justify-center rounded-md border border-silver text-muted transition hover:bg-surface-2"
                  aria-label={`Restar ${label}`}
                >
                  <Minus className="h-3 w-3" strokeWidth={2} />
                </button>
                <span className="w-5 text-center text-xs font-medium text-foreground">{detalle.cantidad}</span>
                <button
                  type="button"
                  onClick={() => onCambiarDetalle(key, { cantidad: detalle.cantidad + 1 })}
                  className="ease-spring flex h-6 w-6 items-center justify-center rounded-md border border-silver text-muted transition hover:bg-surface-2"
                  aria-label={`Sumar ${label}`}
                >
                  <Plus className="h-3 w-3" strokeWidth={2} />
                </button>
                {tieneVariante && (
                  <select
                    value={detalle.variante ?? ""}
                    onChange={(e) =>
                      onCambiarDetalle(key, { variante: (e.target.value || null) as Variante })
                    }
                    className="ml-0.5 rounded-md border border-silver bg-surface px-1 py-0.5 text-[10px] text-foreground outline-none"
                  >
                    <option value="">—</option>
                    <option value="MX">MX</option>
                    <option value="US">US</option>
                  </select>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
