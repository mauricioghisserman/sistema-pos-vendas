"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ backgroundColor: "#e8e5df" }}>
      {/* Formas geométricas de fundo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(
              135deg,
              #e8e5df 0%,
              #e8e5df 40%,
              #d9d6cf 40%,
              #d9d6cf 60%,
              #eeebe6 60%,
              #eeebe6 100%
            )
          `,
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: "15%", left: "-5%", width: "55%", height: "120%",
          background: "#dedad3",
          transform: "skewY(-12deg)",
          transformOrigin: "top left",
        }}
      />

      {/* Formulário */}
      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image src="/logo-preto.svg" alt="Pilar" width={120} height={30} priority />
        </div>

        <h1 className="text-2xl font-normal text-gray-900 mb-6">Login</h1>

        {error === "acesso_negado" && (
          <p className="text-sm text-red-600 mb-4">
            Seu email não tem acesso ao sistema. Fale com a equipe Pilar.
          </p>
        )}
        {error && error !== "acesso_negado" && (
          <p className="text-sm text-red-600 mb-4">
            Erro ao autenticar. Tente novamente.
          </p>
        )}

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-900 text-white text-sm font-medium hover:bg-black transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Entrar com Google
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
