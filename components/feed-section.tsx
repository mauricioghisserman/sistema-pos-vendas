"use client";

import { useCallback, useEffect, useState } from "react";
import type { FeedItem } from "@/app/api/processos/feed/route";

type Source = "pv" | "comercial" | "dd";

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
  const preview = corpo.length > 220 ? corpo.slice(0, 220) + "…" : corpo;
  const hasMore = corpo.length > 220;

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
          {corpo && (
            <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
              {expanded ? corpo : preview}
            </p>
          )}
          {!corpo && (
            <p className="text-xs text-gray-400 italic">Sem conteúdo</p>
          )}
          {hasMore && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] text-blue-500 hover:text-blue-700 mt-1 cursor-pointer"
            >
              {expanded ? "Ver menos" : "Ver mais"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FeedSection({ processoId }: { processoId: string }) {
  const [source, setSource] = useState<Source>("dd");
  const [itens, setItens] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [semVinculo, setSemVinculo] = useState(false);
  const [ticketTitulo, setTicketTitulo] = useState<string | null>(null);

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

  useEffect(() => {
    load(source);
  }, [source, load]);

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
          <p className="text-[11px] text-gray-400 py-2 truncate" title={ticketTitulo}>
            {ticketTitulo}
          </p>
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
    </div>
  );
}
