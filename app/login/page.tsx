"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Image from "next/image";

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [formError, setFormError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setLoading(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (otpError) {
      setFormError(otpError.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      <Image
        src="/capa.png"
        alt=""
        fill
        className="object-cover"
        priority
      />

      <div className="relative z-10 w-full max-w-sm px-4">
        <div className="flex justify-center mb-8">
          <Image src="/logo-preto.svg" alt="Pilar" width={120} height={30} priority />
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Verifique seu email</h2>
            <p className="text-sm text-gray-500">Enviamos um link de acesso para <strong>{email}</strong>. Válido por 1 hora.</p>
            <button onClick={() => setSent(false)} className="mt-4 text-xs text-gray-400 hover:text-gray-600">
              Usar outro email
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-normal text-gray-900 mb-6">Login</h1>

            {error === "acesso_negado" && (
              <p className="text-sm text-red-600 mb-4">Seu email não tem acesso ao sistema. Fale com a equipe Pilar.</p>
            )}
            {error && error !== "acesso_negado" && (
              <p className="text-sm text-red-600 mb-4">Erro ao autenticar. Tente novamente.</p>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full px-4 py-3 bg-white border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400"
              />
              {formError && <p className="text-xs text-red-500">{formError}</p>}
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full px-4 py-3 bg-gray-900 text-white text-sm font-medium hover:bg-black transition-colors disabled:opacity-50"
              >
                {loading ? "Enviando..." : "Enviar link de acesso"}
              </button>
            </form>
          </>
        )}
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
