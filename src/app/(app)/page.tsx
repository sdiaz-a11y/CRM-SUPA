"use client";

import { useEffect, useRef, useState } from "react";
import {
  Users,
  ShieldCheck,
  ShieldOff,
  GraduationCap,
  Clock,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
type Resumen = {
  totalClientes: number;
  conAcceso: number;
  sinAcceso: number;
  conSkool: number;
  vencenPronto: number;
  vencidas: number;
  altasRecientes: number;
  distribucionAcceso: { nombre: string; cantidad: number }[];
  inscripcionesPorMes: { mes: string; cantidad: number; acumulado: number }[];
  topMembresias: { nombre: string; cantidad: number }[];
};

const COLORES_DONA = ["#ef4444", "#10b981", "#0a5cff", "#f59e0b", "#8b5cf6", "#5b6472"];

export default function DashboardPage() {
  const [resumen, setResumen] = useState<Resumen | null>(null);

  useEffect(() => {
    fetch("/api/resumen")
      .then((r) => r.json())
      .then(setResumen);
  }, []);

  return (
    // md+: la altura queda acotada a lo que sobra del viewport (100dvh menos
    // el padding vertical de <main>, md:py-8 = 4rem) para que las 4 gráficas
    // quepan siempre sin scroll — cada fila se reparte el espacio disponible
    // con flex/grid en vez de alturas fijas. Debajo de md se deja el scroll
    // natural (pantallas chicas no alcanzan para todo sin apretar demasiado).
    <div className="flex flex-col gap-3 md:h-[calc(100dvh-4rem)] md:overflow-hidden">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted">Resumen general del Club Sinergético.</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted">Resumen general</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          <Kpi icon={Users} label="Total Contactos" sub="registros" value={resumen?.totalClientes} tone="primary" />
          <Kpi icon={ShieldCheck} label="Con Acceso" sub="plataforma activa" value={resumen?.conAcceso} tone="success" />
          <Kpi icon={ShieldOff} label="Sin Acceso" sub="sin activar" value={resumen?.sinAcceso} tone="danger" />
          <Kpi icon={GraduationCap} label="Con Skool" sub="membresía reg." value={resumen?.conSkool} tone="teal" />
          <Kpi icon={Clock} label="Vencen pronto" sub="≤ 15 días" value={resumen?.vencenPronto} tone="warning" />
          <Kpi icon={AlertTriangle} label="Vencidas" sub="expiradas" value={resumen?.vencidas} tone="purple" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted">
          Análisis visual <span className="normal-case tracking-normal text-muted/70">(pasa el cursor para ver detalle)</span>
        </p>
        {/* Asimétrico a propósito: las líneas necesitan ancho para los 12
            meses, la dona es naturalmente compacta/circular (mejor en una
            columna angosta y alta que en una tarjeta cuadrada), y "Top
            Membresías"/"Crecimiento" casi nunca piden tanto espacio como la
            gráfica principal. */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[2fr_2fr_1.3fr] md:grid-rows-2">
          <ChartCard
            icon={TrendingUp}
            iconTone="text-primary"
            title="Inscripciones por mes"
            subtitle="Últimos 12 meses · altas en plataforma"
            className="md:col-start-1 md:row-start-1 md:col-span-2"
          >
            {resumen ? <LineChart datos={resumen.inscripcionesPorMes} /> : <Cargando />}
          </ChartCard>

          <ChartCard
            title="Acceso a Plataforma"
            subtitle="Distribución de acceso activo"
            className="md:col-start-3 md:row-start-1 md:row-span-2"
          >
            {resumen ? <Dona datos={resumen.distribucionAcceso} total={resumen.totalClientes} /> : <Cargando />}
          </ChartCard>

          <ChartCard
            icon={GraduationCap}
            iconTone="text-primary"
            title="Top Membresías Skool"
            subtitle="Por número de registros"
            className="md:col-start-1 md:row-start-2"
          >
            {resumen ? <BarrasMembresia datos={resumen.topMembresias} /> : <Cargando />}
          </ChartCard>

          <ChartCard
            icon={TrendingUp}
            iconTone="text-success"
            title="Crecimiento acumulado"
            subtitle="Total de contactos registrados en el tiempo"
            className="md:col-start-2 md:row-start-2"
          >
            {resumen ? (
              <LineChart
                datos={resumen.inscripcionesPorMes.map((d) => ({ mes: d.mes, cantidad: d.acumulado }))}
                color="#10b981"
              />
            ) : (
              <Cargando />
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function Cargando() {
  return <p className="flex h-full items-center justify-center text-sm text-muted">Cargando…</p>;
}

function ChartCard({
  icon: Icon,
  iconTone = "text-primary",
  title,
  subtitle,
  className = "",
  children,
}: {
  icon?: typeof TrendingUp;
  iconTone?: string;
  title: string;
  subtitle: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`shell flex min-h-0 flex-col rounded-[2rem] p-2 diffused-lg ${className}`}>
      <div className="core flex min-h-0 flex-1 flex-col rounded-[calc(2rem-0.5rem)] p-4 md:p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {Icon && <Icon className={`h-4 w-4 ${iconTone}`} strokeWidth={1.75} />}
          {title}
        </h3>
        <p className="mb-2 text-xs text-muted">{subtitle}</p>
        <div className="h-56 min-h-0 flex-1 md:h-auto">{children}</div>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  sub,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  sub: string;
  value: number | undefined;
  tone: "primary" | "success" | "danger" | "teal" | "warning" | "purple";
}) {
  const toneClass = {
    primary: "bg-primary-dim text-primary",
    success: "bg-success/15 text-success",
    danger: "bg-danger/15 text-danger",
    teal: "bg-teal-500/15 text-teal-600",
    warning: "bg-warning/15 text-amber-600",
    purple: "bg-violet-500/15 text-violet-600",
  }[tone];
  const subToneClass = {
    primary: "bg-primary-dim text-primary-deep",
    success: "bg-success/15 text-success",
    danger: "bg-danger/15 text-danger",
    teal: "bg-teal-500/15 text-teal-700",
    warning: "bg-warning/15 text-amber-700",
    purple: "bg-violet-500/15 text-violet-700",
  }[tone];
  return (
    <div className="shell rounded-[1.25rem] p-1.5 diffused">
      <div className="core rounded-[calc(1.25rem-0.375rem)] p-3.5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <p className="mt-2 text-xl font-semibold text-foreground">
          {value !== undefined ? value.toLocaleString("es-MX") : "—"}
        </p>
        <p className="text-[11px] text-muted">{label}</p>
        <span className={`mt-1.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium ${subToneClass}`}>
          {sub}
        </span>
      </div>
    </div>
  );
}

// Rellena exactamente el contenedor (preserveAspectRatio="none") para poder
// fijar la altura desde afuera con flex/grid — el precio es que los puntos
// (círculos) se estiran levemente si el contenedor no guarda la proporción
// 640:200 del viewBox, algo casi imperceptible a este tamaño.
function LineChart({
  datos,
  color = "#0a5cff",
}: {
  datos: { mes: string; cantidad: number }[];
  color?: string;
}) {
  const W = 640;
  const H = 200;
  const PAD_L = 40;
  const PAD_B = 20;
  const PAD_T = 10;
  const max = Math.max(1, ...datos.map((d) => d.cantidad));
  const stepX = (W - PAD_L - 10) / Math.max(1, datos.length - 1);

  const puntos = datos.map((d, i) => {
    const x = PAD_L + i * stepX;
    const y = PAD_T + (1 - d.cantidad / max) * (H - PAD_T - PAD_B);
    return { x, y, ...d };
  });

  const linea = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${linea} L${puntos[puntos.length - 1]?.x ?? PAD_L},${H - PAD_B} L${PAD_L},${H - PAD_B} Z`;
  const gridY = [0, 0.25, 0.5, 0.75, 1];

  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || puntos.length === 0) return;
    const xSvg = ((e.clientX - rect.left) / rect.width) * W;
    let idx = 0;
    let mejor = Infinity;
    puntos.forEach((p, i) => {
      const d = Math.abs(p.x - xSvg);
      if (d < mejor) {
        mejor = d;
        idx = i;
      }
    });
    setHover(idx);
  }

  const activo = hover !== null ? puntos[hover] : null;
  const gradId = `areaFill-${color.replace("#", "")}`;

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full cursor-crosshair"
        role="img"
        aria-label="Gráfica de línea"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {gridY.map((g) => {
          const y = PAD_T + g * (H - PAD_T - PAD_B);
          return (
            <g key={g}>
              <line x1={PAD_L} y1={y} x2={W - 5} y2={y} stroke="var(--silver)" strokeWidth={1} />
              <text x={PAD_L - 8} y={y + 3} textAnchor="end" fontSize={10} fill="var(--muted)">
                {Math.round(max * (1 - g)).toLocaleString("es-MX")}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={linea} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {activo && (
          <line x1={activo.x} y1={PAD_T} x2={activo.x} y2={H - PAD_B} stroke="var(--silver)" strokeWidth={1} strokeDasharray="3,3" />
        )}
        {puntos.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hover === i ? 5 : 3}
            fill={hover === i ? color : "var(--surface)"}
            stroke={color}
            strokeWidth={2}
          />
        ))}
        {puntos.map((p, i) => (
          <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize={10} fill={hover === i ? "var(--foreground)" : "var(--muted)"}>
            {p.mes}
          </text>
        ))}
      </svg>
      {activo && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-silver bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg"
          style={{ left: `${(activo.x / W) * 100}%`, top: `${(activo.y / H) * 100}%` }}
        >
          <p className="font-semibold text-foreground">{activo.cantidad.toLocaleString("es-MX")}</p>
          <p className="text-[10px] text-muted">{activo.mes}</p>
        </div>
      )}
    </div>
  );
}

function Dona({ datos, total }: { datos: { nombre: string; cantidad: number }[]; total: number }) {
  const [hover, setHover] = useState<number | null>(null);
  let acumulado = 0;
  const segmentos = datos.map((d, i) => {
    const pct = total > 0 ? d.cantidad / total : 0;
    const seg = { ...d, color: COLORES_DONA[i % COLORES_DONA.length], pct, offset: acumulado };
    acumulado += pct;
    return seg;
  });
  const activos = datos.find((d) => d.nombre.toLowerCase() === "si")?.cantidad ?? 0;
  const pctActivos = total > 0 ? Math.round((activos / total) * 100) : 0;

  const R = 70;
  const STROKE = 20;
  const C = 2 * Math.PI * R;
  const activo = hover !== null ? segmentos[hover] : null;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <div className="relative aspect-square h-full max-h-full">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx={80} cy={80} r={R} fill="none" stroke="var(--surface-2)" strokeWidth={STROKE} />
          {segmentos.map((s, i) => {
            const arco = s.pct * C;
            return (
              <circle
                key={s.nombre}
                cx={80}
                cy={80}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={hover === i ? STROKE + 5 : STROKE}
                strokeDasharray={`${arco} ${C - arco}`}
                strokeDashoffset={-s.offset * C}
                strokeLinecap="butt"
                className="cursor-pointer transition-all"
                opacity={hover !== null && hover !== i ? 0.45 : 1}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {activo ? (
            <>
              <span className="text-lg font-semibold text-foreground">{activo.cantidad.toLocaleString("es-MX")}</span>
              <span className="text-[10px] text-muted">{activo.nombre}</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-semibold text-foreground">{pctActivos}%</span>
              <span className="text-[10px] text-muted">activos</span>
            </>
          )}
        </div>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {segmentos.map((s, i) => (
          <li
            key={s.nombre}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={`ease-spring flex cursor-pointer items-center gap-1.5 text-xs transition ${
              hover === i ? "font-semibold text-foreground" : "text-muted"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.nombre}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarrasMembresia({ datos }: { datos: { nombre: string; cantidad: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (datos.length === 0) return <p className="text-sm text-muted">Sin datos de membresía.</p>;
  const max = Math.max(...datos.map((d) => d.cantidad));
  const total = datos.reduce((s, d) => s + d.cantidad, 0);
  return (
    <ul className="flex h-full flex-col justify-center gap-2.5">
      {datos.map((d, i) => (
        <li key={d.nombre} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className={`ease-spring font-medium transition ${hover === i ? "text-primary" : "text-foreground"}`}>
              {d.nombre}
            </span>
            <span className="text-muted">
              {d.cantidad.toLocaleString("es-MX")}
              {hover === i && total > 0 && <span className="ml-1 text-primary">({Math.round((d.cantidad / total) * 100)}%)</span>}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`ease-spring h-full rounded-full brand-plate transition-all ${hover === i ? "shadow-[0_0_8px_var(--color-primary)]" : ""}`}
              style={{ width: `${(d.cantidad / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
