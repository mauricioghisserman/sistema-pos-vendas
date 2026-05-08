"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Item = {
  id: string;
  nome: string;
  status: string;
  obrigatorio: boolean;
  motivo_reprovacao: string | null;
  documento: { id: string; nome_arquivo: string } | null;
};

type Grupo = {
  parteId: string | null;
  tipo: string;
  label: string;
  ehProprio: boolean;
  itens: Item[];
};

type Pendencia = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  status: string;
  resposta_texto: string | null;
  motivo_reprovacao: string | null;
  arquivos: { id: string; nome_arquivo: string }[];
};

type PortalData = {
  parte: { id: string; tipo: string; nome: string };
  processo: { titulo: string; prazo_entrega_doc: string | null };
  podeUpload: boolean;
  grupos: Grupo[];
  pendencias: Pendencia[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SESSION_KEY = "pilar_session";
const PROCESSO_KEY = "pilar_processo";

function saveSession(sessionToken: string, processoToken: string) {
  localStorage.setItem(SESSION_KEY, sessionToken);
  localStorage.setItem(PROCESSO_KEY, processoToken);
}

function loadSession() {
  return {
    sessionToken: localStorage.getItem(SESSION_KEY),
    processoToken: localStorage.getItem(PROCESSO_KEY),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "aprovado")
    return <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Aprovado</span>;
  if (status === "reprovado")
    return <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Reprovado</span>;
  if (status === "enviado")
    return <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Em análise</span>;
  return <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Pendente</span>;
}

function UploadButton({
  item, sessionToken, onSuccess,
}: {
  item: Item; sessionToken: string; onSuccess: (itemId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) { setError("Apenas PDF, JPG ou PNG."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("Arquivo muito grande (máx. 20MB)."); return; }

    setError("");
    setLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/portal/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken, itemId: item.id, fileName: file.name, mimeType: file.type, fileSize: file.size, data: base64 }),
      });

      if (res.ok) {
        onSuccess(item.id);
      } else {
        const json = await res.json().catch(() => ({}));
        setError((json as { error?: string }).error ?? "Erro ao enviar.");
      }
    } catch {
      setError("Erro ao enviar. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="text-sm px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        {loading ? "Enviando..." : item.status === "reprovado" ? "Enviar novamente" : "Anexar documento"}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function ChecklistItem({
  item, sessionToken, podeUpload, onUpload,
}: {
  item: Item; sessionToken: string; podeUpload: boolean; onUpload: (id: string) => void;
}) {
  const aprovado  = item.status === "aprovado";
  const reprovado = item.status === "reprovado";
  const enviado   = item.status === "enviado";
  const canUpload = podeUpload && (item.status === "pendente" || item.status === "reprovado");

  return (
    <div className="flex items-start gap-4 py-4 border-b border-gray-100 last:border-0">
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
              <circle cx="8" cy="8" r="6"/><path strokeLinecap="round" strokeLinejoin="round" d="M5 8l2 2 4-4"/>
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
        {canUpload && <UploadButton item={item} sessionToken={sessionToken} onSuccess={onUpload} />}
      </div>
    </div>
  );
}

const TIPO_PENDENCIA_LABEL: Record<string, string> = {
  documento: "Documento", esclarecimento: "Esclarecimento", informacao: "Informação",
};

function PendenciaCard({
  pendencia, sessionToken, onRespondida,
}: {
  pendencia: Pendencia;
  sessionToken: string;
  onRespondida: (id: string, texto: string) => void;
}) {
  const [respondendo, setRespondendo] = useState(false);
  const [texto, setTexto]             = useState("");
  const [enviando, setEnviando]       = useState(false);
  const [error, setError]             = useState("");
  const inputRef                      = useRef<HTMLInputElement>(null);

  const jaRespondida = pendencia.status !== "pendente" && pendencia.status !== "reprovada";
  const podeResponder = pendencia.status === "pendente" || pendencia.status === "reprovada";

  async function enviarResposta() {
    if (!texto.trim() && pendencia.tipo === "esclarecimento") { setError("Escreva uma resposta."); return; }
    setEnviando(true); setError("");
    const res = await fetch(`/api/pendencias/${pendencia.id}/responder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken, respostaTexto: texto.trim() || null }),
    });
    if (res.ok) {
      onRespondida(pendencia.id, texto.trim());
      setRespondendo(false);
    } else {
      setError("Erro ao enviar resposta.");
    }
    setEnviando(false);
  }

  async function enviarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) { setError("Apenas PDF, JPG ou PNG."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("Arquivo muito grande (máx. 20MB)."); return; }
    setEnviando(true); setError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/pendencias/${pendencia.id}/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken, respostaTexto: texto.trim() || null, fileName: file.name, mimeType: file.type, fileSize: file.size, data: base64 }),
      });
      if (res.ok) { onRespondida(pendencia.id, texto.trim()); setRespondendo(false); }
      else setError("Erro ao enviar.");
    } catch { setError("Erro ao enviar."); }
    finally { setEnviando(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  const STATUS_COLOR: Record<string, string> = {
    pendente: "text-yellow-700 bg-yellow-50",
    respondida: "text-blue-700 bg-blue-50",
    aprovada: "text-green-700 bg-green-50",
    reprovada: "text-red-700 bg-red-50",
  };
  const STATUS_LABEL: Record<string, string> = {
    pendente: "Pendente", respondida: "Em análise", aprovada: "Aprovada", reprovada: "Reprovada",
  };

  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span className="text-xs text-gray-400">{TIPO_PENDENCIA_LABEL[pendencia.tipo]}</span>
          <p className="text-sm font-medium text-gray-900">{pendencia.titulo}</p>
          {pendencia.descricao && <p className="text-xs text-gray-500 mt-0.5">{pendencia.descricao}</p>}
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[pendencia.status]}`}>
          {STATUS_LABEL[pendencia.status]}
        </span>
      </div>

      {pendencia.resposta_texto && (
        <div className="bg-blue-50 rounded-lg px-3 py-2 mb-2">
          <p className="text-xs text-blue-500 font-medium mb-0.5">Sua resposta</p>
          <p className="text-sm text-blue-800">{pendencia.resposta_texto}</p>
        </div>
      )}

      {pendencia.arquivos.length > 0 && (
        <div className="mb-2 space-y-1">
          {pendencia.arquivos.map((a) => (
            <p key={a.id} className="text-xs text-gray-400">📎 {a.nome_arquivo}</p>
          ))}
        </div>
      )}

      {pendencia.motivo_reprovacao && (
        <div className="bg-red-50 rounded-lg px-3 py-2 mb-2">
          <p className="text-xs text-red-600"><strong>Motivo:</strong> {pendencia.motivo_reprovacao}</p>
        </div>
      )}

      {podeResponder && !respondendo && (
        <button onClick={() => setRespondendo(true)} className="text-sm px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors">
          {pendencia.status === "reprovada" ? "Responder novamente" : "Responder"}
        </button>
      )}

      {respondendo && (
        <div className="space-y-2 mt-2">
          {(pendencia.tipo === "esclarecimento" || pendencia.tipo === "informacao") && (
            <textarea
              value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder={pendencia.tipo === "informacao" ? "Digite a informação solicitada..." : "Escreva seu esclarecimento..."}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400 resize-none"
            />
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={enviarResposta} disabled={enviando} className="text-sm px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {enviando ? "Enviando..." : "Enviar resposta"}
            </button>
            <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={enviarArquivo} />
            <button onClick={() => inputRef.current?.click()} disabled={enviando} className="text-sm px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              Anexar arquivo
            </button>
            <button onClick={() => { setRespondendo(false); setTexto(""); setError(""); }} className="text-sm text-gray-400 hover:text-gray-600">
              Cancelar
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}

      {jaRespondida && !podeResponder && pendencia.status !== "aprovada" && (
        <p className="text-xs text-gray-400 mt-1">Aguardando análise da equipe Pilar.</p>
      )}
    </div>
  );
}

// ─── Screens ──────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="bg-black text-white px-6 py-4">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <span className="font-semibold tracking-wide">Pilar</span>
        <span className="text-xs text-gray-400">Portal de Documentação</span>
      </div>
    </header>
  );
}

function EmailScreen({
  processoToken, onSent,
}: {
  processoToken: string; onSent: () => void;
}) {
  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/portal/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processoToken, email: email.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError((json as { error?: string }).error ?? "Erro ao enviar.");
      } else {
        onSent();
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-sm mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Acessar portal</h1>
          <p className="text-sm text-gray-500 mb-6">Digite o e-mail cadastrado para receber o link de acesso.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-black text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar link de acesso"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function CheckEmailScreen({ email }: { email: string }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-sm mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Verifique seu e-mail</h2>
        <p className="text-sm text-gray-500">
          Enviamos um link de acesso para <strong className="text-gray-700">{email}</strong>. Válido por 1 hora.
        </p>
        <p className="text-xs text-gray-400 mt-4">Não recebeu? Verifique a pasta de spam.</p>
      </main>
    </div>
  );
}

function PortalScreen({
  data, sessionToken, onUpdate, onPendenciaRespondida,
}: {
  data: PortalData; sessionToken: string;
  onUpdate: (grupoIdx: number, itemId: string) => void;
  onPendenciaRespondida: (id: string, texto: string) => void;
}) {
  const { parte, processo, podeUpload, grupos, pendencias } = data;

  const todosItens = grupos.flatMap((g) => g.itens);
  const aprovados  = todosItens.filter((i) => i.status === "aprovado").length;
  const total      = todosItens.length;
  const allDone    = total > 0 && aprovados === total;

  const prazo = processo.prazo_entrega_doc
    ? new Date(processo.prazo_entrega_doc + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const TIPO_LABEL: Record<string, string> = {
    comprador: "Comprador", vendedor: "Vendedor", corretor: "Corretor",
    advogado_comprador: "Advogado comprador", advogado_vendedor: "Advogado vendedor",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Identificação */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
              {TIPO_LABEL[parte.tipo] ?? parte.tipo}
            </span>
            <span className="text-xs text-gray-400">{parte.nome}</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">{processo.titulo}</h1>
          {prazo && <p className="text-sm text-gray-500 mt-1">Prazo de entrega: <strong>{prazo}</strong></p>}
        </div>

        {/* Progresso geral */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Documentos entregues</span>
            <span className={`text-sm font-semibold ${allDone ? "text-green-600" : "text-gray-600"}`}>{aprovados}/{total}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${allDone ? "bg-green-500" : "bg-black"}`}
              style={{ width: total > 0 ? `${(aprovados / total) * 100}%` : "0%" }}
            />
          </div>
          {allDone && <p className="text-xs text-green-600 mt-2 font-medium">Todos os documentos foram aprovados!</p>}
        </div>

        {/* Grupos */}
        <div className="space-y-4">
          {grupos.map((grupo, gi) => (
            <div key={gi} className="bg-white rounded-xl border border-gray-100">
              <div className="px-4 pt-4 pb-2 border-b border-gray-50">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{grupo.label}</span>
                {grupo.ehProprio && (
                  <span className="ml-2 text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">você</span>
                )}
              </div>
              <div className="px-4">
                {grupo.itens.map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    sessionToken={sessionToken}
                    podeUpload={podeUpload}
                    onUpload={(id) => onUpdate(gi, id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Pendências */}
        {pendencias.length > 0 && (
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Pendências</h2>
            <div className="bg-white rounded-xl border border-gray-100 px-4">
              {pendencias.map((p) => (
                <PendenciaCard
                  key={p.id}
                  pendencia={p}
                  sessionToken={sessionToken}
                  onRespondida={onPendenciaRespondida}
                />
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-8">
          Dúvidas? Entre em contato com a equipe Pilar.
        </p>
      </main>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Screen = "loading" | "email" | "check-email" | "portal" | "error";

function PortalContent() {
  const searchParams  = useSearchParams();
  const processoToken = searchParams.get("processo") ?? "";
  const magicToken    = searchParams.get("magic") ?? "";

  const [screen, setScreen]       = useState<Screen>("loading");
  const [errorMsg, setErrorMsg]   = useState("");
  const [emailSent, setEmailSent] = useState("");
  const [sessionToken, setSession] = useState("");
  const [data, setData]           = useState<PortalData | null>(null);

  useEffect(() => {
    if (!processoToken) { setErrorMsg("Link inválido."); setScreen("error"); return; }
    init();
  }, [processoToken]); // eslint-disable-line

  async function init() {
    // 1. Se tem magic token na URL, verifica e cria sessão
    if (magicToken) {
      const res  = await fetch("/api/portal/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ magicToken }),
      });
      const json = await res.json();
      if (!res.ok) { setErrorMsg((json as { error?: string }).error ?? "Link inválido."); setScreen("error"); return; }
      const { sessionToken: st, processoToken: pt } = json as { sessionToken: string; processoToken: string };
      saveSession(st, pt);
      // Remove magic da URL sem reload
      window.history.replaceState({}, "", `/portal?processo=${pt}`);
      await loadPortal(pt, st);
      return;
    }

    // 2. Tenta sessão salva
    const { sessionToken: savedSession, processoToken: savedProcesso } = loadSession();
    if (savedSession && savedProcesso === processoToken) {
      const ok = await loadPortal(processoToken, savedSession);
      if (ok) return;
      // Sessão inválida — limpa e pede email
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(PROCESSO_KEY);
    }

    // 3. Pede email
    setScreen("email");
  }

  async function loadPortal(pt: string, st: string): Promise<boolean> {
    const res  = await fetch(`/api/portal?processo=${pt}&session=${st}`);
    const json = await res.json();
    if (!res.ok) return false;
    setSession(st);
    setData(json as PortalData);
    setScreen("portal");
    return true;
  }

  function handleUpdate(grupoIdx: number, itemId: string) {
    setData((prev) => {
      if (!prev) return prev;
      const grupos = prev.grupos.map((g, i) =>
        i !== grupoIdx ? g : {
          ...g,
          itens: g.itens.map((item) =>
            item.id !== itemId ? item : { ...item, status: "enviado", motivo_reprovacao: null }
          ),
        }
      );
      return { ...prev, grupos };
    });
  }

  function handlePendenciaRespondida(id: string, texto: string) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pendencias: prev.pendencias.map((p) =>
          p.id !== id ? p : { ...p, status: "respondida", resposta_texto: texto || p.resposta_texto }
        ),
      };
    });
  }

  if (screen === "loading") return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
    </div>
  );

  if (screen === "error") return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-sm mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Link inválido</h2>
        <p className="text-sm text-gray-500">{errorMsg}</p>
      </main>
    </div>
  );

  if (screen === "email") return (
    <EmailScreen
      processoToken={processoToken}
      onSent={() => { setEmailSent(emailSent); setScreen("check-email"); }}
    />
  );

  if (screen === "check-email") return <CheckEmailScreen email={emailSent} />;

  if (screen === "portal" && data) return (
    <PortalScreen data={data} sessionToken={sessionToken} onUpdate={handleUpdate} onPendenciaRespondida={handlePendenciaRespondida} />
  );

  return null;
}

export default function PortalPage() {
  return (
    <Suspense>
      <PortalContent />
    </Suspense>
  );
}
