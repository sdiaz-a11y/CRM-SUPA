"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { useSesion } from "@/lib/session-context";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { usuario, cargando, refrescar } = useSesion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const siguiente = searchParams.get("next") || "/";

  useEffect(() => {
    if (!cargando && usuario) router.replace(siguiente);
  }, [cargando, usuario, router, siguiente]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo iniciar sesión");
        return;
      }
      await refrescar();
      router.replace(siguiente);
    } catch {
      setError("Error de red");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand p-6">
      <form
        onSubmit={onSubmit}
        className="shell w-full max-w-sm rounded-[2rem] p-2 diffused-lg animate-fade-in"
      >
        <div className="core rounded-[calc(2rem-0.5rem)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full brand-plate">
            <LogIn className="h-6 w-6 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Synergy CRM</h1>
          <p className="mt-1 text-sm text-muted">Inicia sesión con tu correo y contraseña.</p>

          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo"
            autoComplete="username"
            className="mt-6 w-full rounded-xl border border-silver bg-surface-2 px-4 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
            className="mt-3 w-full rounded-xl border border-silver bg-surface-2 px-4 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
          />

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}

          <button
            type="submit"
            disabled={!email.trim() || !password || enviando}
            className="ease-spring mt-4 w-full rounded-xl brand-plate px-4 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </form>
    </div>
  );
}
