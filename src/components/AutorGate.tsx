"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { useAutor } from "@/lib/autor-context";

export function AutorGate({ children }: { children: React.ReactNode }) {
  const { autor, cargando, establecerAutor } = useAutor();
  const [nombre, setNombre] = useState("");

  if (cargando) return null;

  if (!autor) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            establecerAutor(nombre);
          }}
          className="shell w-full max-w-sm rounded-[2rem] p-2 diffused-lg animate-fade-in"
        >
          <div className="core rounded-[calc(2rem-0.5rem)] p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full brand-plate">
              <UserRound className="h-6 w-6 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-lg font-semibold text-foreground">¿Quién eres?</h1>
            <p className="mt-1 text-sm text-muted">
              Escribe tu nombre para que quede registrado en la línea de tiempo de cada cliente.
            </p>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
              className="mt-6 w-full rounded-xl border border-silver bg-surface-2 px-4 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
            />
            <button
              type="submit"
              disabled={!nombre.trim()}
              className="ease-spring mt-4 w-full rounded-xl brand-plate px-4 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Entrar
            </button>
          </div>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
