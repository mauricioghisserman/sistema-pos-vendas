"use client";

import { useEffect, useState } from "react";

type Task = {
  id: string;
  titulo: string;
  concluida: boolean;
  prazo: string | null;
  prazo_hora: string | null;
  created_at: string;
  processo_id: string;
  processos: { id: string; titulo: string } | null;
};

function dateTs(dateStr: string) {
  return new Date(dateStr + "T00:00:00").getTime();
}

function prazoFmt(prazo: string, hora: string | null) {
  const d = new Date(prazo + "T00:00:00");
  const fmt = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return hora ? `${fmt} às ${hora.slice(0, 5)}` : fmt;
}

function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const diff = task.prazo ? Math.ceil((dateTs(task.prazo) - hoje.getTime()) / 86400000) : null;

  return (
    <div className="group flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
      <button
        onClick={onToggle}
        className="mt-0.5 shrink-0 w-4 h-4 rounded border border-gray-300 hover:border-gray-500 transition-colors"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 leading-snug">{task.titulo}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.prazo && diff !== null && (
            <span className={`text-xs ${diff < 0 ? "text-red-500" : diff <= 2 ? "text-amber-500" : "text-gray-400"}`}>
              {diff < 0 ? `${Math.abs(diff)}d atraso` : prazoFmt(task.prazo, task.prazo_hora)}
            </span>
          )}
          {task.processos && (
            <span className="text-xs text-gray-400 truncate">· {task.processos.titulo}</span>
          )}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 shrink-0 mt-0.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function GroupSection({ label, color, tasks, onToggle, onDelete }: {
  label: string; color: string; tasks: Task[];
  onToggle: (id: string) => void; onDelete: (id: string) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <h2 className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</h2>
        <span className="text-xs text-gray-400">{tasks.length}</span>
      </div>
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={() => onToggle(t.id)} onDelete={() => onDelete(t.id)} />
        ))}
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks?all=true")
      .then((r) => r.json())
      .then((data) => { setTasks(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  async function handleToggle(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, concluida: true }),
    });
  }

  async function handleDelete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/tasks?taskId=${taskId}`, { method: "DELETE" });
  }

  const hoje   = new Date(); hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
  const semana = new Date(hoje); semana.setDate(hoje.getDate() + 7);

  const ts = (t: Task) => t.prazo ? dateTs(t.prazo) : null;

  const grupos = [
    { label: "Atrasadas",   color: "text-red-500",   items: tasks.filter((t) => { const d = ts(t); return d !== null && d < hoje.getTime(); }) },
    { label: "Hoje",        color: "text-amber-500",  items: tasks.filter((t) => ts(t) === hoje.getTime()) },
    { label: "Amanhã",      color: "text-blue-500",   items: tasks.filter((t) => ts(t) === amanha.getTime()) },
    { label: "Esta semana", color: "text-gray-600",   items: tasks.filter((t) => { const d = ts(t); return d !== null && d > amanha.getTime() && d <= semana.getTime(); }) },
    { label: "Próximas",    color: "text-gray-500",   items: tasks.filter((t) => { const d = ts(t); return d !== null && d > semana.getTime(); }) },
    { label: "Sem prazo",   color: "text-gray-400",   items: tasks.filter((t) => !t.prazo) },
  ];

  const total = tasks.length;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="max-w-2xl w-full mx-auto">
        <div className="flex items-baseline gap-3 mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
          {!loading && <span className="text-sm text-gray-400">{total} aberta{total !== 1 ? "s" : ""}</span>}
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        )}

        {!loading && total === 0 && (
          <p className="text-sm text-gray-400 text-center py-16">Nenhuma task aberta.</p>
        )}

        {!loading && grupos.map((g) => (
          <GroupSection
            key={g.label}
            label={g.label}
            color={g.color}
            tasks={g.items}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
