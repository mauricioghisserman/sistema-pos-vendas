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
  const fmt = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
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

  return (
    <div className="rounded p-3 cursor-pointer hover:brightness-95 transition-all" style={{ backgroundColor: "#f0ede8" }}>
      <div className="mb-2">
        <p className="text-sm font-medium text-gray-900 leading-snug">{processo.titulo}</p>
      </div>
      <div className="space-y-0.5 mb-3">
        {prazoDoc && (
          <p className={`text-xs ${prazoDoc.diff < 0 ? "text-red-500" : prazoDoc.diff <= 5 ? "text-amber-500" : "text-gray-400"}`}>
            Prazo documentação: {prazoDoc.fmt} ({prazoDoc.diff >= 0 ? prazoDoc.diff : Math.abs(prazoDoc.diff)}{prazoDoc.diff < 0 ? " d. atraso" : " d."})
          </p>
        )}
        {prazoInstr && (
          <p className={`text-xs ${prazoInstr.diff < 0 ? "text-red-500" : prazoInstr.diff <= 5 ? "text-amber-500" : "text-gray-400"}`}>
            Prazo instrumento: {prazoInstr.fmt} ({prazoInstr.diff >= 0 ? prazoInstr.diff : Math.abs(prazoInstr.diff)}{prazoInstr.diff < 0 ? " d. atraso" : " d."})
          </p>
        )}
      </div>
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
  stage, search, owner, version, silentVersion, isFirst,
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

    const res  = await fetch(`/api/processos?${params}`);
    const json = await res.json();

    setItems((prev) => reset ? json.data : [...prev, ...json.data]);
    setHasMore(json.hasMore);
    setPage(pageNum);
    loadingRef.current = false;
    setLoading(false);
  }, [stage.key, search, owner]);

  // Refresh silencioso (realtime): busca em background sem limpar items
  const fetchSilent = useCallback(async () => {
    const params = new URLSearchParams({ status: stage.key, page: "0" });
    if (search) params.set("search", search);
    if (owner)  params.set("owner", owner);

    const res  = await fetch(`/api/processos?${params}`);
    const json = await res.json();

    setItems(json.data);
    setHasMore(json.hasMore);
    setPage(0);
  }, [stage.key, search, owner]);

  // Reset + re-fetch on search/owner/version change
  useEffect(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
    fetchPage(0, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.key, search, owner, version]);

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
