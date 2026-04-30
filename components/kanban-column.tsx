"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Processo } from "@/app/(painel)/processos/page";

const LIMIT = 20;

function prazoLabel(prazo: string | null) {
  if (!prazo) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(prazo + "T00:00:00");
  const diff = Math.ceil((data.getTime() - hoje.getTime()) / 86400000);
  const fmt = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return { fmt, diff };
}

const MOSTRAR_PRAZO_DOC   = new Set(["fechado_pelo_comercial", "pos_vendas_iniciado", "documentacao_pendente"]);
const MOSTRAR_PRAZO_INSTR = new Set(["fechado_pelo_comercial", "pos_vendas_iniciado", "documentacao_pendente", "instrumento_definitivo"]);

function ProcessoCard({ processo }: { processo: Processo }) {
  const prazoDoc  = MOSTRAR_PRAZO_DOC.has(processo.status)   ? prazoLabel(processo.prazo_entrega_doc) : null;
  const prazoInstr = MOSTRAR_PRAZO_INSTR.has(processo.status) ? prazoLabel(processo.prazo_instrumento) : null;
  const analista  = processo.analistas;
  const initials  = analista?.nome
    ? analista.nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
    : null;
  const ownerNome = processo.hubspot_owner_nome;
  const ownerInitials = ownerNome
    ? ownerNome.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()
    : null;

  const prazoColor = (diff: number) =>
    diff < 0 ? "text-red-500" : diff <= 5 ? "text-amber-500" : "text-gray-400";

  const docsTotal    = processo.docs_total;
  const docsAprovados = processo.docs_aprovados;
  const hasDocs = docsTotal > 0;
  const allAprovados = hasDocs && docsAprovados === docsTotal;

  return (
    <div className="rounded p-3 cursor-pointer hover:brightness-95 transition-all" style={{ backgroundColor: "#f0ede8" }}>
      <p className="text-sm font-medium text-gray-900 leading-snug mb-2">{processo.titulo}</p>

      {/* Prazos compactos — numa linha só */}
      {(prazoDoc || prazoInstr) && (
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-2">
          {prazoDoc && (
            <span className={`inline-flex items-center gap-1 text-xs ${prazoColor(prazoDoc.diff)}`}>
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M5 19h14a2 2 0 002-2V7.414A2 2 0 0020.586 6L15 .414A2 2 0 0013.586 0H5a2 2 0 00-2 2v15a2 2 0 002 2z" />
              </svg>
              {prazoDoc.fmt}
              <span className="opacity-70">({Math.abs(prazoDoc.diff)}{prazoDoc.diff < 0 ? "d atr." : "d"})</span>
            </span>
          )}
          {prazoDoc && prazoInstr && <span className="text-gray-300 text-xs">·</span>}
          {prazoInstr && (
            <span className={`inline-flex items-center gap-1 text-xs ${prazoColor(prazoInstr.diff)}`}>
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.83a2 2 0 01-.91.54l-3.09.777.777-3.09a2 2 0 01.54-.91z" />
              </svg>
              {prazoInstr.fmt}
              <span className="opacity-70">({Math.abs(prazoInstr.diff)}{prazoInstr.diff < 0 ? "d atr." : "d"})</span>
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {ownerInitials ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-[9px] font-semibold text-amber-700">
              {ownerInitials}
            </div>
            <span className="text-xs text-gray-500 truncate max-w-[100px]">{ownerNome}</span>
          </div>
        ) : <div />}

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Progresso de docs */}
          {hasDocs && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              allAprovados
                ? "text-green-600 bg-green-50"
                : "text-gray-500 bg-gray-200"
            }`}>
              {docsAprovados}/{docsTotal} docs
            </span>
          )}
          {processo.open_tasks_count > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {processo.open_tasks_count}
            </span>
          )}
          {initials && (
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600">
              {initials}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type Props = {
  stage: { key: string; label: string };
  search: string;
  owner: string;
  sort: string;
  version: number;
  silentVersion: number;
  isFirst: boolean;
  draggingId: string | null;
  isOver: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.DragEvent, processo: Processo) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
};

export default function KanbanColumn({
  stage, search, owner, sort, version, silentVersion, isFirst,
  draggingId, isOver, onSelect, onDragStart, onDragOver, onDragLeave, onDrop,
}: Props) {
  const [items, setItems]     = useState<Processo[]>([]);
  const [page, setPage]       = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const fetchPage = useCallback(async (pageNum: number, reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const params = new URLSearchParams({ status: stage.key, page: String(pageNum) });
    if (search) params.set("search", search);
    if (owner)  params.set("owner", owner);
    if (sort)   params.set("sort", sort);

    const res  = await fetch(`/api/processos?${params}`);
    const json = await res.json();

    setItems((prev) => reset ? json.data : [...prev, ...json.data]);
    setHasMore(json.hasMore);
    setPage(pageNum);
    loadingRef.current = false;
    setLoading(false);
  }, [stage.key, search, owner, sort]);

  // Refresh silencioso (realtime): busca em background sem limpar items
  const fetchSilent = useCallback(async () => {
    const params = new URLSearchParams({ status: stage.key, page: "0" });
    if (search) params.set("search", search);
    if (owner)  params.set("owner", owner);
    if (sort)   params.set("sort", sort);

    const res  = await fetch(`/api/processos?${params}`);
    const json = await res.json();

    setItems(json.data);
    setHasMore(json.hasMore);
    setPage(0);
  }, [stage.key, search, owner, sort]);

  // Reset + re-fetch on search/owner/sort/version change
  useEffect(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
    fetchPage(0, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.key, search, owner, sort, version]);

  // Refresh silencioso ao receber evento do Realtime
  useEffect(() => {
    if (silentVersion === 0) return;
    fetchSilent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [silentVersion]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingRef.current || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
      fetchPage(page + 1);
    }
  }, [hasMore, page, fetchPage]);

  return (
    <div
      className={`flex flex-col w-64 shrink-0 h-full ${isFirst ? "pr-4" : "border-l border-gray-300/50 pl-4 pr-4"}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Cabeçalho da coluna */}
      <div className="mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">{stage.label}</span>
          <span className="text-sm text-gray-400">{items.length}{hasMore ? "+" : ""}</span>
        </div>
      </div>

      {/* Cards com scroll */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto space-y-2 rounded transition-colors ${isOver ? "bg-black/5" : ""}`}
      >
        {items.map((p) => (
          <div
            key={p.id}
            draggable
            onClick={() => onSelect(p.id)}
            onDragStart={(e) => onDragStart(e, p)}
            className={`transition-opacity ${draggingId === p.id ? "opacity-40" : "opacity-100"}`}
          >
            <ProcessoCard processo={p} />
          </div>
        ))}

        {items.length === 0 && !loading && (
          <div className={`h-10 rounded border-2 border-dashed transition-colors ${isOver ? "border-gray-400" : "border-transparent"}`} />
        )}

        {loading && (
          <div className="flex justify-center py-3">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        )}

        {/* Sentinela para scroll infinito */}
        {hasMore && !loading && <div className="h-1" />}
      </div>
    </div>
  );
}
