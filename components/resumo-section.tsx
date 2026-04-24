"use client";

import { useState } from "react";

type Props = { processoId: string };

export default function ResumoSection({ processoId }: Props) {
  const [resumo, setResumo]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function gerar() {
    setLoading(true);
    setError(null);
    setResumo(null);
    const res  = await fetch(`/api/resumo?processoId=${processoId}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao gerar resumo.");
    } else {
      setResumo(json.resumo);
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Resumo IA</h3>
        <button
          onClick={gerar}
          disabled={loading}
          className="text-xs px-2.5 py-1 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 flex items-center gap-1.5"
        >
          {loading ? (
            <>
              <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
              Gerando…
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              Gerar
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {resumo && (
        <div className="text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-3 leading-relaxed whitespace-pre-wrap">
          {resumo}
        </div>
      )}

      {!resumo && !loading && !error && (
        <p className="text-xs text-gray-400">Clique em Gerar para criar um resumo do processo com IA.</p>
      )}
    </div>
  );
}
