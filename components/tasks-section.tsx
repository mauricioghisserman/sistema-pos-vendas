"use client";

import { useEffect, useRef, useState } from "react";

type Task = {
  id: string;
  titulo: string;
  concluida: boolean;
  prazo: string | null;
  created_at: string;
};

type Props = { processoId: string };

function prazoInfo(prazo: string | null) {
  if (!prazo) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const data = new Date(prazo + "T00:00:00");
  const diff = Math.ceil((data.getTime() - hoje.getTime()) / 86400000);
  const fmt  = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return { fmt, diff };
}

export default function TasksSection({ processoId }: Props) {
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto]     = useState("");
  const [prazo, setPrazo]     = useState("");
  const [adding, setAdding]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/tasks?processoId=${processoId}`)
      .then((r) => r.json())
      .then((data) => { setTasks(data ?? []); setLoading(false); });
  }, [processoId]);

  async function addTask() {
    if (!texto.trim()) return;
    setAdding(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processoId, titulo: texto, prazo: prazo || null }),
    });
    if (res.ok) {
      const nova = await res.json();
      setTasks((prev) => [nova, ...prev]);
      setTexto("");
      setPrazo("");
    }
    setAdding(false);
    inputRef.current?.focus();
  }

  async function toggleTask(taskId: string, concluida: boolean) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, concluida } : t));
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, concluida }),
    });
  }

  async function deleteTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/tasks?taskId=${taskId}`, { method: "DELETE" });
  }

  const abertas    = tasks.filter((t) => !t.concluida);
  const concluidas = tasks.filter((t) => t.concluida);

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tasks</h3>

      {/* Adicionar task */}
      <div className="mb-4 space-y-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Nova task..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400 bg-white"
        />
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-gray-400 bg-white text-gray-600 flex-1"
          />
          <button
            onClick={addTask}
            disabled={adding || !texto.trim()}
            className="text-xs px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            {adding ? "..." : "Adicionar"}
          </button>
        </div>
      </div>

      {loading && <p className="text-xs text-gray-400">Carregando...</p>}

      {/* Tasks abertas */}
      {abertas.length > 0 && (
        <div className="space-y-1 mb-4">
          {abertas.map((task) => {
            const p = prazoInfo(task.prazo);
            return (
              <div key={task.id} className="group flex items-start gap-2.5 py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                <button
                  onClick={() => toggleTask(task.id, true)}
                  className="mt-0.5 shrink-0 w-4 h-4 rounded border border-gray-300 hover:border-gray-500 transition-colors flex items-center justify-center"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-snug">{task.titulo}</p>
                  {p && (
                    <span className={`text-xs ${p.diff < 0 ? "text-red-500" : p.diff <= 2 ? "text-amber-500" : "text-gray-400"}`}>
                      {p.diff < 0 ? `${Math.abs(p.diff)}d atraso` : `até ${p.fmt}`}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Tasks concluídas */}
      {concluidas.length > 0 && (
        <details className="group">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none mb-1">
            {concluidas.length} concluída{concluidas.length > 1 ? "s" : ""}
          </summary>
          <div className="space-y-1 mt-1">
            {concluidas.map((task) => (
              <div key={task.id} className="group/item flex items-start gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50">
                <button
                  onClick={() => toggleTask(task.id, false)}
                  className="mt-0.5 shrink-0 w-4 h-4 rounded bg-gray-200 flex items-center justify-center"
                >
                  <svg className="w-2.5 h-2.5 text-gray-500" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
                  </svg>
                </button>
                <p className="text-xs text-gray-400 line-through leading-snug flex-1">{task.titulo}</p>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover/item:opacity-100 transition-opacity text-gray-300 hover:text-red-400 shrink-0"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {!loading && tasks.length === 0 && (
        <p className="text-xs text-gray-400">Nenhuma task.</p>
      )}
    </div>
  );
}
