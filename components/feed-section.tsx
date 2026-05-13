"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedItem } from "@/app/api/processos/feed/route";

type Source = "pv" | "comercial" | "dd";
type Tipo = { id: string; nome: string };

const TIPO_ICON: Record<string, string> = {
  NOTE: "💬",
  EMAIL: "✉️",
  CALL: "📞",
  MEETING: "📅",
};

const SOURCE_LABELS: { key: Source; label: string }[] = [
  { key: "pv",        label: "Pós-vendas" },
  { key: "comercial", label: "Comercial"  },
  { key: "dd",        label: "DD"         },
];

function relativeTime(ts: number): string {
  const now = Date.now();
  const diffMs = now - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return diffMin <= 1 ? "agora" : `há ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "ontem";
  if (diffD < 7) return `há ${diffD}d`;
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function EngagementCard({ item }: { item: FeedItem }) {
  const [expanded, setExpanded] = useState(false);
  const corpo = item.corpo ?? "";
  const isHtml = /<[a-z][\s\S]*>/i.test(corpo);
  const COLLAPSE_PX = 160;

  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-start gap-2">
        <span className="text-base mt-0.5 shrink-0">{TIPO_ICON[item.tipo] ?? "·"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {item.autorNome && (
              <span className="text-xs font-medium text-gray-700 truncate">{item.autorNome}</span>
            )}
            <span className="text-[11px] text-gray-400 shrink-0 ml-auto">{relativeTime(item.timestamp)}</span>
          </div>

          {corpo ? (
            <>
              <div
                className={`overflow-hidden transition-all ${!expanded ? "relative" : ""}`}
                style={!expanded ? { maxHeight: COLLAPSE_PX } : undefined}
              >
                {isHtml ? (
                  <div
                    className="text-xs text-gray-600 leading-relaxed feed-html"
                    dangerouslySetInnerHTML={{ __html: corpo }}
                  />
                ) : (
                  <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{corpo}</p>
                )}
                {!expanded && (
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                )}
              </div>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-[11px] text-blue-500 hover:text-blue-700 mt-1 cursor-pointer"
              >
                {expanded ? "Ver menos" : "Ver mais"}
              </button>
            </>
          ) : (
            <p className="text-xs text-gray-400 italic">Sem conteúdo</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FeedSection({ processoId }: { processoId: string }) {
  const [source, setSource] = useState<Source>("pv");
  const [itens, setItens] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [semVinculo, setSemVinculo] = useState(false);
  const [ticketTitulo, setTicketTitulo] = useState<string | null>(null);

  // Registro de atividade
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [tipoSelecionado, setTipoSelecionado] = useState("");
  const [novoTipoInput, setNovoTipoInput] = useState("");
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const novoTipoRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (src: Source) => {
    setLoading(true);
    setSemVinculo(false);
    setTicketTitulo(null);
    try {
      const res = await fetch(`/api/processos/feed?processoId=${processoId}&source=${src}`);
      const json = await res.json();
      setItens(json.itens ?? []);
      setSemVinculo(json.semVinculo ?? false);
      setTicketTitulo(json.ticketTitulo ?? null);
    } catch {
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, [processoId]);

  useEffect(() => { load(source); }, [source, load]);

  useEffect(() => {
    fetch("/api/atividade-tipos")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTipos(data); });
  }, []);

  useEffect(() => {
    if (tipoSelecionado === "__novo__") novoTipoRef.current?.focus();
  }, [tipoSelecionado]);

  async function handleRegistrar() {
    const tipoFinal = tipoSelecionado === "__novo__" ? novoTipoInput.trim() : tipoSelecionado;
    if (!texto.trim()) return;
    setSalvando(true);

    try {
      // Cria novo tipo se necessário
      if (tipoSelecionado === "__novo__" && tipoFinal) {
        const res = await fetch("/api/atividade-tipos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: tipoFinal }),
        });
        if (res.ok) {
          const novo = await res.json();
          setTipos((prev) => [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome)));
          setTipoSelecionado(tipoFinal);
          setNovoTipoInput("");
        }
      }

      await fetch("/api/processos/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processoId, texto: texto.trim(), tipo: tipoFinal || null }),
      });

      setTexto("");
      setSource("pv");
      await load("pv");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 pt-4 pb-2 shrink-0 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mr-2">Feed</h3>
        {SOURCE_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSource(key)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
              source === key
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        )}
        {!loading && ticketTitulo && (
          <p className="text-[11px] text-gray-400 py-2 truncate" title={ticketTitulo}>{ticketTitulo}</p>
        )}
        {!loading && semVinculo && (
          <p className="text-xs text-gray-400 text-center py-8">Sem vínculo com deal comercial.</p>
        )}
        {!loading && !semVinculo && itens.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">Nenhuma atividade registrada.</p>
        )}
        {!loading && itens.map((item) => (
          <EngagementCard key={item.id} item={item} />
        ))}
      </div>

      {/* Área de registro */}
      <div className="shrink-0 border-t border-gray-100 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          {tipoSelecionado === "__novo__" ? (
            <input
              ref={novoTipoRef}
              value={novoTipoInput}
              onChange={(e) => setNovoTipoInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setTipoSelecionado(""); setNovoTipoInput(""); } }}
              placeholder="Nome do novo tipo..."
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gray-400"
            />
          ) : (
            <select
              value={tipoSelecionado}
              onChange={(e) => setTipoSelecionado(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gray-400 bg-white cursor-pointer"
            >
              <option value="">Sem tipo</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.nome}>{t.nome}</option>
              ))}
              <option value="__novo__">+ Novo tipo...</option>
            </select>
          )}
        </div>

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Registrar atividade no Pós-vendas..."
          rows={3}
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-gray-400 placeholder:text-gray-300"
        />

        <div className="flex justify-end">
          <button
            onClick={handleRegistrar}
            disabled={salvando || !texto.trim() || (tipoSelecionado === "__novo__" && !novoTipoInput.trim())}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {salvando ? "Registrando..." : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
