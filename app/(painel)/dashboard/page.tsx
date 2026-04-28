"use client";

import { useEffect, useState } from "react";
import ProcessoDrawer from "@/components/processo-drawer";

// ── Tipos ────────────────────────────────────────────────────────────────────

type Task = {
  id: string;
  titulo: string;
  prazo: string | null;
  prazo_hora: string | null;
  processo_id: string;
  processos: { id: string; titulo: string } | null;
};

type ProcessoPrazo = {
  id: string;
  titulo: string;
  status: string;
  prazo_entrega_doc: string | null;
  prazo_instrumento: string | null;
  analistas: { nome: string; email: string } | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysDiff(dateStr: string) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const d    = new Date(dateStr + "T00:00:00");
  return Math.ceil((d.getTime() - hoje.getTime()) / 86400000);
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function diffLabel(diff: number) {
  if (diff < 0)  return `${Math.abs(diff)}d atraso`;
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  return `${diff}d`;
}

function diffColor(diff: number) {
  if (diff < 0)   return "text-red-600 bg-red-50";
  if (diff <= 2)  return "text-amber-600 bg-amber-50";
  if (diff <= 7)  return "text-blue-600 bg-blue-50";
  return "text-gray-500 bg-gray-100";
}

// ── Seção de Tasks ───────────────────────────────────────────────────────────

function TasksPanel({ tasks, onToggle }: {
  tasks: Task[];
  onToggle: (id: string) => void;
}) {
  const hoje   = new Date(); hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);

  const ts = (t: Task) => t.prazo ? new Date(t.prazo + "T00:00:00").getTime() : null;

  const grupos = [
    { label: "Atrasadas",  color: "text-red-600",   items: tasks.filter((t) => { const d = ts(t); return d !== null && d < hoje.getTime(); }) },
    { label: "Hoje",       color: "text-amber-600",  items: tasks.filter((t) => ts(t) === hoje.getTime()) },
    { label: "Amanhã",     color: "text-blue-600",   items: tasks.filter((t) => ts(t) === amanha.getTime()) },
    { label: "Esta semana",color: "text-gray-600",   items: tasks.filter((t) => { const d = ts(t); return d !== null && d > amanha.getTime() && d <= hoje.getTime() + 7 * 86400000; }) },
    { label: "Sem prazo",  color: "text-gray-400",   items: tasks.filter((t) => !t.prazo) },
  ].filter((g) => g.items.length > 0);

  if (tasks.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Nenhuma task aberta.</p>;
  }

  return (
    <div className="space-y-5">
      {grupos.map((grupo) => (
        <div key={grupo.label}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${grupo.color}`}>
            {grupo.label} · {grupo.items.length}
          </p>
          <div className="space-y-1">
            {grupo.items.map((task) => {
              const diff = task.prazo ? daysDiff(task.prazo) : null;
              const hora = task.prazo_hora ? task.prazo_hora.slice(0, 5) : null;
              return (
                <div key={task.id} className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors group">
                  <button
                    onClick={() => onToggle(task.id)}
                    className="mt-0.5 shrink-0 w-4 h-4 rounded border border-gray-300 hover:border-gray-500 transition-colors"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-snug">{task.titulo}</p>
                    <p className="text-xs text-gray-400 truncate">{task.processos?.titulo}</p>
                  </div>
                  {diff !== null && (
                    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 ${diffColor(diff)}`}>
                      {task.prazo && fmtDate(task.prazo)}{hora ? ` ${hora}` : ""} · {diffLabel(diff)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Seção de Prazos dos Processos ────────────────────────────────────────────

type PrazoItem = { processo: ProcessoPrazo; dateStr: string; diff: number };

function PrazoGroup({ titulo, items, onOpenProcesso }: {
  titulo: string;
  items: PrazoItem[];
  onOpenProcesso: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">{titulo}</p>
        <p className="text-xs text-gray-400 px-1">Nenhum prazo crítico.</p>
      </div>
    );
  }

  const sorted    = [...items].sort((a, b) => a.diff - b.diff);
  const atrasados = sorted.filter((i) => i.diff < 0);
  const proximos  = sorted.filter((i) => i.diff >= 0);

  const renderRows = (list: PrazoItem[]) =>
    list.map((item) => (
      <button
        key={item.processo.id}
        onClick={() => onOpenProcesso(item.processo.id)}
        className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors text-left cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 leading-snug truncate">{item.processo.titulo}</p>
        </div>
        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 ${diffColor(item.diff)}`}>
          {fmtDate(item.dateStr)} · {diffLabel(item.diff)}
        </span>
      </button>
    ));

  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
        {titulo} · {items.length}
      </p>
      <div className="space-y-1">
        {atrasados.length > 0 && (
          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide px-1 pt-1">Atrasados</p>
        )}
        {renderRows(atrasados)}
        {proximos.length > 0 && atrasados.length > 0 && (
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1 pt-2">Próximos</p>
        )}
        {renderRows(proximos)}
      </div>
    </div>
  );
}


// ── Página ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [processos, setProcessos] = useState<ProcessoPrazo[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks?all=true").then((r) => r.json()),
      fetch("/api/dashboard").then((r) => r.json()),
    ]).then(([t, p]) => {
      setTasks(Array.isArray(t) ? t : []);
      setProcessos(Array.isArray(p) ? p : []);
      setLoading(false);
    });
  }, []);

  async function handleToggleTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, concluida: true }),
    });
  }

  const hoje = new Date();
  const saudacao = hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";
  const dataFmt = hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <div className="flex-1 overflow-hidden flex flex-col px-8 py-6">
        {/* Header */}
        <div className="mb-6 shrink-0">
          <h1 className="text-xl font-semibold text-gray-900">{saudacao}</h1>
          <p className="text-sm text-gray-400 capitalize">{dataFmt}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex gap-8 flex-1 overflow-hidden">
            {/* Tasks */}
            <div className="flex-1 overflow-y-auto min-w-0">
              <div className="flex items-baseline gap-2 mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Tasks</h2>
                <span className="text-xs text-gray-400">{tasks.length} aberta{tasks.length !== 1 ? "s" : ""}</span>
              </div>
              <TasksPanel tasks={tasks} onToggle={handleToggleTask} />
            </div>

            {/* Divisor */}
            <div className="w-px bg-gray-100 shrink-0" />

            {/* Entrega de documentação */}
            <div className="flex-1 overflow-y-auto min-w-0">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Entrega de documentação</h2>
              </div>
              <PrazoGroup
                titulo=""
                items={processos
                  .filter((p) => p.prazo_entrega_doc && ["fechado_pelo_comercial","pos_vendas_iniciado","documentacao_pendente"].includes(p.status) && daysDiff(p.prazo_entrega_doc) <= 14)
                  .map((p) => ({ processo: p, dateStr: p.prazo_entrega_doc!, diff: daysDiff(p.prazo_entrega_doc!) }))}
                onOpenProcesso={setSelectedId}
              />
            </div>

            {/* Divisor */}
            <div className="w-px bg-gray-100 shrink-0" />

            {/* Instrumento */}
            <div className="flex-1 overflow-y-auto min-w-0">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Instrumento</h2>
              </div>
              <PrazoGroup
                titulo=""
                items={processos
                  .filter((p) => p.prazo_instrumento && ["fechado_pelo_comercial","pos_vendas_iniciado","documentacao_pendente","instrumento_definitivo"].includes(p.status) && daysDiff(p.prazo_instrumento) <= 14)
                  .map((p) => ({ processo: p, dateStr: p.prazo_instrumento!, diff: daysDiff(p.prazo_instrumento!) }))}
                onOpenProcesso={setSelectedId}
              />
            </div>
          </div>
        )}
      </div>

      <ProcessoDrawer processoId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
