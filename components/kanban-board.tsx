"use client";

import { useEffect, useState } from "react";
import type { Stage } from "@/app/(painel)/processos/page";
import type { STAGES } from "@/app/(painel)/processos/page";
import type { Processo } from "@/app/(painel)/processos/page";
import KanbanColumn from "@/components/kanban-column";
import ProcessoDrawer from "@/components/processo-drawer";

type Props = {
  stages: typeof STAGES;
  owners: string[];
};

export default function KanbanBoard({ stages, owners }: Props) {
  const [search, setSearch]               = useState("");
  const [debouncedSearch, setDebounced]   = useState("");
  const [selectedOwner, setSelectedOwner] = useState("");
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [draggingId, setDraggingId]       = useState<string | null>(null);
  const [overStage, setOverStage]         = useState<string | null>(null);
  const [versions, setVersions]           = useState<Record<string, number>>({});

  // Debounce busca 300 ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function moveCard(processoId: string, novoStatus: Stage) {
    const prev = draggingId ? stages.find((s) => {
      // We don't track source stage here, so bump all stages to be safe
      return false;
    }) : null;
    void prev; // unused

    setDraggingId(null);
    setOverStage(null);

    await fetch("/api/processos/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processoId, status: novoStatus }),
    });

    // Bump versão de todas as colunas para re-fetch após mover
    setVersions((v) => {
      const next = { ...v };
      stages.forEach((s) => { next[s.key] = (next[s.key] ?? 0) + 1; });
      return next;
    });
  }

  return (
    <>
      {/* Header com busca e filtro */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0 gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Processos</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Busca */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar deal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 w-56 bg-gray-50"
            />
          </div>

          {/* Filtro por responsável */}
          <select
            value={selectedOwner}
            onChange={(e) => setSelectedOwner(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-gray-400 bg-gray-50 text-gray-700"
          >
            <option value="">Todos os responsáveis</option>
            {owners.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto bg-white min-h-0">
        <div className="flex gap-0 p-5 h-full">
          {stages.map((stage, i) => (
            <KanbanColumn
              key={stage.key}
              stage={stage}
              search={debouncedSearch}
              owner={selectedOwner}
              version={versions[stage.key] ?? 0}
              isFirst={i === 0}
              draggingId={draggingId}
              isOver={overStage === stage.key}
              onSelect={setSelectedId}
              onDragStart={(e, processo) => {
                e.dataTransfer.setData("processoId", processo.id);
                setDraggingId(processo.id);
              }}
              onDragOver={(e) => { e.preventDefault(); setOverStage(stage.key); }}
              onDragLeave={() => setOverStage(null)}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("processoId");
                if (id) moveCard(id, stage.key as Stage);
              }}
            />
          ))}
        </div>
      </div>

      <ProcessoDrawer processoId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
