"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Item = {
  id: string;
  nome: string;
  status: string;
  obrigatorio: boolean;
  motivo_reprovacao: string | null;
  documento: { id: string; nome_arquivo: string } | null;
};

type PortalData = {
  parte: { id: string; tipo: string; nome: string };
  processo: { titulo: string; prazo_entrega_doc: string | null };
  itens: Item[];
};

const TIPO_LABEL: Record<string, string> = {
  comprador: "Comprador",
  vendedor: "Vendedor",
  corretor: "Corretor",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "aprovado")
    return <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Aprovado</span>;
  if (status === "reprovado")
    return <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Reprovado</span>;
  if (status === "enviado")
    return <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Em análise</span>;
  return <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Pendente</span>;
}

function UploadButton({ item, token, onSuccess }: { item: Item; token: string; onSuccess: (itemId: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Apenas PDF, JPG ou PNG.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Arquivo muito grande (máx. 20MB).");
      return;
    }

    setError("");
    setLoading(true);

    const form = new FormData();
    form.append("token", token);
    form.append("itemId", item.id);
    form.append("file", file);

    const res = await fetch("/api/portal/upload", { method: "POST", body: form });
    if (res.ok) {
      onSuccess(item.id);
    } else {
      const json = await res.json();
      setError(json.error ?? "Erro ao enviar.");
    }
    setLoading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const label = item.status === "reprovado" ? "Enviar novamente" : "Anexar documento";

  return (
    <div>
      <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="text-sm px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        {loading ? "Enviando..." : label}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function ChecklistItem({ item, token, onUpload }: { item: Item; token: string; onUpload: (id: string) => void }) {
  const aprovado  = item.status === "aprovado";
  const reprovado = item.status === "reprovado";
  const enviado   = item.status === "enviado";
  const canUpload = item.status === "pendente" || item.status === "reprovado";

  return (
    <div className="flex items-start gap-4 py-4 border-b border-gray-100 last:border-0">
      {/* Ícone de status */}
      <div className="shrink-0 mt-0.5">
        {aprovado ? (
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
            </svg>
          </div>
        ) : reprovado ? (
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/>
            </svg>
          </div>
        ) : enviado ? (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="6"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l2 2 4-4"/>
            </svg>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="6"/>
            </svg>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-sm font-medium ${aprovado ? "text-gray-400 line-through" : "text-gray-900"}`}>
            {item.nome}
          </span>
          {item.obrigatorio && !aprovado && (
            <span className="text-[10px] text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded">obrigatório</span>
          )}
          <StatusBadge status={item.status} />
        </div>

        {reprovado && item.motivo_reprovacao && (
          <p className="text-xs text-red-600 mb-2 bg-red-50 px-2 py-1.5 rounded">
            <strong>Motivo:</strong> {item.motivo_reprovacao}
          </p>
        )}

        {item.documento && !aprovado && (
          <p className="text-xs text-gray-400 mb-2">
            Arquivo enviado: <span className="text-gray-600">{item.documento.nome_arquivo}</span>
          </p>
        )}

        {canUpload && (
          <UploadButton item={item} token={token} onSuccess={onUpload} />
        )}
      </div>
    </div>
  );
}

function PortalContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [data, setData]     = useState<PortalData | null>(null);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setError("Link inválido."); setLoading(false); return; }
    fetch(`/api/portal?token=${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json);
      })
      .finally(() => setLoading(false));
  }, [token]);

  function handleUpload(itemId: string) {
    if (!data) return;
    setData((prev) => prev ? {
      ...prev,
      itens: prev.itens.map((i) =>
        i.id === itemId ? { ...i, status: "enviado", motivo_reprovacao: null } : i
      ),
    } : null);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Link inválido</h2>
        <p className="text-sm text-gray-500">Este link não existe ou foi desativado.</p>
      </div>
    </div>
  );

  if (!data) return null;

  const { parte, processo, itens } = data;
  const aprovados = itens.filter((i) => i.status === "aprovado").length;
  const total     = itens.length;
  const allDone   = total > 0 && aprovados === total;

  const prazo = processo.prazo_entrega_doc
    ? new Date(processo.prazo_entrega_doc + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-black text-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-semibold tracking-wide">Pilar</span>
          <span className="text-xs text-gray-400">Portal de Documentação</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Identificação */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full capitalize">
              {TIPO_LABEL[parte.tipo] ?? parte.tipo}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">{processo.titulo}</h1>
          {prazo && (
            <p className="text-sm text-gray-500 mt-1">Prazo de entrega: <strong>{prazo}</strong></p>
          )}
        </div>

        {/* Progresso */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Documentos entregues</span>
            <span className={`text-sm font-semibold ${allDone ? "text-green-600" : "text-gray-600"}`}>
              {aprovados}/{total}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${allDone ? "bg-green-500" : "bg-black"}`}
              style={{ width: total > 0 ? `${(aprovados / total) * 100}%` : "0%" }}
            />
          </div>
          {allDone && (
            <p className="text-xs text-green-600 mt-2 font-medium">Todos os documentos foram aprovados!</p>
          )}
        </div>

        {/* Lista de documentos */}
        <div className="bg-white rounded-xl border border-gray-100 px-4">
          {itens.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Nenhum documento necessário.</p>
          ) : (
            itens.map((item) => (
              <ChecklistItem key={item.id} item={item} token={token} onUpload={handleUpload} />
            ))
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-8">
          Dúvidas? Entre em contato com a equipe Pilar.
        </p>
      </main>
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense>
      <PortalContent />
    </Suspense>
  );
}
