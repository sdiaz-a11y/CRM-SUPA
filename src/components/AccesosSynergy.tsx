"use client";

import { ShieldCheck, Crown, Gem, Minus, Plus } from "lucide-react";
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

// Editor de cantidades de accesos (no on/off): cada nivel se controla con un
// número exacto — llevarlo a 0 lo desactiva, subirlo desde 0 lo activa. Así
// "quitarle 2 General y darle 2 VIP" o "sumarle 1 Black a alguien que ya
// tiene 1 General" es simplemente escribir los números correspondientes en
// cada tarjeta, sin que una toque a la otra.
export function AccesosSynergy({
  valor,
  onChange,
  soloLectura,
  paisCliente,
}: {
  valor: Accesos;
  onChange: (nuevoValor: Accesos) => void;
  soloLectura?: boolean;
  // Para elegir MX/US por default cuando un nivel pasa de 0 a activo.
  paisCliente?: string | null;
}) {
  function cambiarCantidad(nivel: keyof Accesos, cantidad: number) {
    const limpia = Math.max(0, Math.floor(cantidad || 0));
    const actual = valor[nivel];
    let variante = actual.variante;
    if (limpia > 0 && !variante && nivel !== "black") {
      const p = (paisCliente ?? "").toLowerCase();
      variante = p.includes("méxico") || p.includes("mexico") ? "MX" : "US";
    }
    onChange({ ...valor, [nivel]: { activo: limpia > 0, cantidad: limpia, variante } });
  }

  function cambiarVariante(nivel: keyof Accesos, variante: Variante) {
    onChange({ ...valor, [nivel]: { ...valor[nivel], variante } });
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {NIVELES.map(({ key, label, icon: Icon, activeClass, tieneVariante }) => {
        const detalle = valor[key];
        const activo = detalle.cantidad > 0;
        return (
          <div
            key={key}
            className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center transition ${
              activo ? `${activeClass} border-transparent diffused` : "border-silver bg-surface-2 text-muted"
            }`}
          >
            <Icon className="h-6 w-6" strokeWidth={1.75} />
            <span className="text-sm font-semibold">{label}</span>

            {soloLectura ? (
              <span className={`text-xs uppercase tracking-wide ${activo ? "opacity-80" : "opacity-60"}`}>
                {activo ? `${detalle.cantidad}${detalle.variante ? ` · ${detalle.variante}` : ""}` : "Sin acceso"}
              </span>
            ) : (
              <>
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => cambiarCantidad(key, detalle.cantidad - 1)}
                    disabled={detalle.cantidad <= 0}
                    className={`ease-spring flex h-6 w-6 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      activo ? "border-white/40 text-white hover:bg-white/10" : "border-silver text-muted hover:bg-surface"
                    }`}
                    aria-label={`Restar ${label}`}
                  >
                    <Minus className="h-3 w-3" strokeWidth={2} />
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={detalle.cantidad}
                    onChange={(e) => cambiarCantidad(key, Number(e.target.value))}
                    className={`w-12 rounded-md border bg-transparent py-0.5 text-center text-sm font-semibold outline-none ${
                      activo ? "border-white/40 text-white" : "border-silver text-foreground"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => cambiarCantidad(key, detalle.cantidad + 1)}
                    className={`ease-spring flex h-6 w-6 items-center justify-center rounded-md border transition ${
                      activo ? "border-white/40 text-white hover:bg-white/10" : "border-silver text-muted hover:bg-surface"
                    }`}
                    aria-label={`Sumar ${label}`}
                  >
                    <Plus className="h-3 w-3" strokeWidth={2} />
                  </button>
                </div>
                {tieneVariante && activo && (
                  <select
                    value={detalle.variante ?? ""}
                    onChange={(e) => cambiarVariante(key, (e.target.value || null) as Variante)}
                    className={`rounded-md border bg-transparent px-1.5 py-0.5 text-[11px] outline-none ${
                      activo ? "border-white/40 text-white" : "border-silver text-foreground"
                    }`}
                  >
                    <option className="text-foreground" value="">
                      —
                    </option>
                    <option className="text-foreground" value="MX">
                      MX
                    </option>
                    <option className="text-foreground" value="US">
                      US
                    </option>
                  </select>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
