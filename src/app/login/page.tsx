"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
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
  const [mostrarPassword, setMostrarPassword] = useState(false);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <form
        onSubmit={onSubmit}
        className="shell w-full max-w-sm rounded-[2rem] p-2 diffused-lg animate-fade-in"
      >
        <div className="core rounded-[calc(2rem-0.5rem)] p-8 text-center">
          <Image
            src="/icons/icon-192.png"
            alt="CRM CS"
            width={56}
            height={56}
            className="mx-auto mb-4 h-14 w-14 rounded-2xl"
            priority
          />
          <h1 className="text-lg font-semibold text-foreground">CRM CS</h1>
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
          <div className="relative mt-3">
            <input
              type={mostrarPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              autoComplete="current-password"
              className="w-full rounded-xl border border-silver bg-surface-2 px-4 py-2.5 pr-10 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
            />
            <button
              type="button"
              onClick={() => setMostrarPassword((v) => !v)}
              tabIndex={-1}
              aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="ease-spring absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-foreground"
            >
              {mostrarPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
            </button>
          </div>

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
