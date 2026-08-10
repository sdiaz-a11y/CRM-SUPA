import {
  UserPlus,
  Pencil,
  StickyNote,
  ShieldCheck,
  Crown,
  Gem,
  UploadCloud,
} from "lucide-react";
import type { EventoTimeline, TipoEvento } from "@/lib/types";

const ICONS: Record<TipoEvento, typeof UserPlus> = {
  CREACION: UserPlus,
  EDICION: Pencil,
  NOTA: StickyNote,
  ACCESO_GENERAL: ShieldCheck,
  ACCESO_VIP: Crown,
  ACCESO_BLACK: Gem,
  IMPORTACION: UploadCloud,
};

const LABEL: Record<TipoEvento, string> = {
  CREACION: "Cliente creado",
  EDICION: "Datos editados",
  NOTA: "Nota",
  ACCESO_GENERAL: "Acceso General",
  ACCESO_VIP: "Acceso VIP",
  ACCESO_BLACK: "Black Access",
  IMPORTACION: "Importado",
};

export function Timeline({ eventos }: { eventos: EventoTimeline[] }) {
  if (eventos.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay actividad registrada.</p>;
  }

  const ordenados = [...eventos].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <ol className="relative flex flex-col gap-5 pl-2">
      <div className="absolute left-[17px] top-2 bottom-2 w-px bg-silver" />
      {ordenados.map((evento) => {
        const Icon = ICONS[evento.tipo] ?? StickyNote;
        return (
          <li key={evento.id} className="relative flex gap-3.5">
            <div className="relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface ring-4 ring-primary-dim">
              <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1 pb-0.5 pt-0.5">
              <p className="text-sm font-medium text-foreground">{LABEL[evento.tipo]}</p>
              <p className="mt-0.5 text-sm text-muted">{evento.detalle}</p>
              <p className="mt-1 text-xs text-muted/70">
                {new Date(evento.fecha).toLocaleString("es-MX", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                · {evento.autor}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
