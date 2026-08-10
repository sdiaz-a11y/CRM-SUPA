"use client";

import { useEffect, useState } from "react";
import {
  Users,
  ShieldCheck,
  ShieldOff,
  GraduationCap,
  Clock,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { Timeline } from "@/components/Timeline";
import type { EventoTimeline } from "@/lib/types";

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
  eventosRecientes: (EventoTimeline & { clienteNombre: string })[];
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
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted">Resumen general del Club Sinergético.</p>
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">Resumen general</p>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi
          icon={Users}
          label="Total Contactos"
          sub="registros"
          value={resumen?.totalClientes}
          tone="primary"
        />
        <Kpi
          icon={ShieldCheck}
          label="Con Acceso"
          sub="plataforma activa"
          value={resumen?.conAcceso}
          tone="success"
        />
        <Kpi icon={ShieldOff} label="Sin Acceso" sub="sin activar" value={resumen?.sinAcceso} tone="danger" />
        <Kpi
          icon={GraduationCap}
          label="Con Skool"
          sub="membresía reg."
          value={resumen?.conSkool}
          tone="teal"
        />
        <Kpi icon={Clock} label="Vencen pronto" sub="≤ 15 días" value={resumen?.vencenPronto} tone="warning" />
        <Kpi
          icon={AlertTriangle}
          label="Vencidas"
          sub="expiradas"
          value={resumen?.vencidas}
          tone="purple"
        />
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">Análisis visual</p>
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="shell rounded-[2rem] p-2 diffused-lg lg:col-span-2">
          <div className="core rounded-[calc(2rem-0.5rem)] p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TrendingUp className="h-4 w-4 text-primary" strokeWidth={1.75} />
              Inscripciones por mes
            </h3>
            <p className="mb-4 text-xs text-muted">Últimos 12 meses · altas en plataforma</p>
            {resumen ? (
              <LineChart datos={resumen.inscripcionesPorMes} />
            ) : (
              <p className="py-16 text-center text-sm text-muted">Cargando…</p>
            )}
          </div>
        </div>

        <div className="shell rounded-[2rem] p-2 diffused-lg">
          <div className="core rounded-[calc(2rem-0.5rem)] p-6">
            <h3 className="text-sm font-semibold text-foreground">Acceso a Plataforma</h3>
            <p className="mb-4 text-xs text-muted">Distribución de acceso activo</p>
            {resumen ? (
              <Dona datos={resumen.distribucionAcceso} total={resumen.totalClientes} />
            ) : (
              <p className="py-16 text-center text-sm text-muted">Cargando…</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="shell rounded-[2rem] p-2 diffused-lg">
          <div className="core rounded-[calc(2rem-0.5rem)] p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <GraduationCap className="h-4 w-4 text-primary" strokeWidth={1.75} />
              Top Membresías Skool
            </h3>
            <p className="mb-4 text-xs text-muted">Por número de registros</p>
            {resumen ? (
              <BarrasMembresia datos={resumen.topMembresias} />
            ) : (
              <p className="py-8 text-center text-sm text-muted">Cargando…</p>
            )}
          </div>
        </div>

        <div className="shell rounded-[2rem] p-2 diffused-lg">
          <div className="core rounded-[calc(2rem-0.5rem)] p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TrendingUp className="h-4 w-4 text-success" strokeWidth={1.75} />
              Crecimiento acumulado
            </h3>
            <p className="mb-4 text-xs text-muted">Total de contactos registrados en el tiempo</p>
            {resumen ? (
              <LineChart
                datos={resumen.inscripcionesPorMes.map((d) => ({ mes: d.mes, cantidad: d.acumulado }))}
                color="#10b981"
              />
            ) : (
              <p className="py-16 text-center text-sm text-muted">Cargando…</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 shell rounded-[2rem] p-2 diffused-lg">
        <div className="core rounded-[calc(2rem-0.5rem)] p-6">
          <h3 className="mb-5 text-xs font-semibold uppercase tracking-[0.15em] text-muted">
            Actividad reciente
          </h3>
          {resumen ? (
            resumen.eventosRecientes.length > 0 ? (
              <Timeline eventos={resumen.eventosRecientes} />
            ) : (
              <p className="text-sm text-muted">Todavía no hay actividad registrada.</p>
            )
          ) : (
            <p className="text-sm text-muted">Cargando…</p>
          )}
        </div>
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
    <div className="shell rounded-[1.5rem] p-2 diffused">
      <div className="core rounded-[calc(1.5rem-0.5rem)] p-5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
        </div>
        <p className="mt-3 text-2xl font-semibold text-foreground">
          {value !== undefined ? value.toLocaleString("es-MX") : "—"}
        </p>
        <p className="text-xs text-muted">{label}</p>
        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${subToneClass}`}>
          {sub}
        </span>
      </div>
    </div>
  );
}

function LineChart({
  datos,
  color = "#0a5cff",
}: {
  datos: { mes: string; cantidad: number }[];
  color?: string;
}) {
  const W = 640;
  const H = 220;
  const PAD_L = 40;
  const PAD_B = 24;
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

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Gráfica de línea">
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
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#areaFill)" />
        <path d={linea} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {puntos.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
        ))}
        {puntos.map((p, i) => (
          <text key={i} x={p.x} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">
            {p.mes}
          </text>
        ))}
      </svg>
    </div>
  );
}

function Dona({ datos, total }: { datos: { nombre: string; cantidad: number }[]; total: number }) {
  let acumulado = 0;
  const segmentos = datos.map((d, i) => {
    const pct = total > 0 ? (d.cantidad / total) * 100 : 0;
    const inicio = acumulado;
    acumulado += pct;
    return { ...d, color: COLORES_DONA[i % COLORES_DONA.length], inicio, fin: acumulado };
  });
  const gradiente = segmentos
    .map((s) => `${s.color} ${s.inicio}% ${s.fin}%`)
    .join(", ");
  const activos = datos.find((d) => d.nombre.toLowerCase() === "si")?.cantidad ?? 0;
  const pctActivos = total > 0 ? Math.round((activos / total) * 100) : 0;

  return (
    <div>
      <div className="relative mx-auto h-44 w-44">
        <div
          className="h-full w-full rounded-full"
          style={{ background: `conic-gradient(${gradiente})` }}
        />
        <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-surface">
          <span className="text-2xl font-semibold text-foreground">{pctActivos}%</span>
          <span className="text-[10px] text-muted">activos</span>
        </div>
      </div>
      <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {segmentos.map((s) => (
          <li key={s.nombre} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.nombre}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarrasMembresia({ datos }: { datos: { nombre: string; cantidad: number }[] }) {
  if (datos.length === 0) return <p className="text-sm text-muted">Sin datos de membresía.</p>;
  const max = Math.max(...datos.map((d) => d.cantidad));
  return (
    <ul className="space-y-3">
      {datos.map((d) => (
        <li key={d.nombre}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">{d.nombre}</span>
            <span className="text-muted">{d.cantidad.toLocaleString("es-MX")}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="ease-spring h-full rounded-full brand-plate"
              style={{ width: `${(d.cantidad / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
