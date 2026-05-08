"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Notif = {
  id: string;
  refId: string;
  tipo: "pendencia_respondida" | "documento_enviado";
  titulo: string;
  subtipo: string | null;
  parteNome: string | null;
  parteType: string | null;
  processoId: string;
  processoTitulo: string;
  at: string;
};

const SUBTIPO_LABEL: Record<string, string> = {
  documento: "Documento", esclarecimento: "Esclarecimento", informacao: "Informação",
};

const TIPO_PARTE_LABEL: Record<string, string> = {
  comprador: "Comprador", vendedor: "Vendedor", corretor: "Corretor",
  advogado_comprador: "Advogado comprador", advogado_vendedor: "Advogado vendedor",
  imovel: "Imóvel",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function TopBar() {
  const [notifs, setNotifs]   = useState<Notif[]>([]);
  const [total, setTotal]     = useState(0);
  const [open, setOpen]       = useState(false);
  const dropRef               = useRef<HTMLDivElement>(null);
  const router                = useRouter();

  async function fetchNotifs() {
    const res = await fetch("/api/notificacoes").catch(() => null);
    if (!res?.ok) return;
    const json = await res.json() as { total: number; itens: Notif[] };
    setTotal(json.total);
    setNotifs(json.itens);
  }

  // Fetch inicial
  useEffect(() => { fetchNotifs(); }, []);

  // Supabase realtime
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("notificacoes-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "sistema_pos_vendas", table: "pendencias" }, fetchNotifs)
      .on("postgres_changes", { event: "UPDATE", schema: "sistema_pos_vendas", table: "checklist_items" }, fetchNotifs)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleNotifClick(notif: Notif) {
    setOpen(false);
    router.push(`/processos?open=${notif.processoId}`);
  }

  return (
    <div className="h-10 border-b border-gray-100 flex items-center justify-end px-4 bg-white shrink-0">
      <div className="relative" ref={dropRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Notificações"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-50">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notificações</span>
            </div>

            {notifs.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-gray-400">Tudo em dia</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {notifs.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-base mt-0.5 shrink-0">
                        {n.tipo === "pendencia_respondida" ? "💬" : "📄"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {n.tipo === "pendencia_respondida"
                            ? `${SUBTIPO_LABEL[n.subtipo ?? ""] ?? n.subtipo} respondido`
                            : n.titulo}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {n.parteNome
                            ? `${n.parteNome}${n.parteType ? ` · ${TIPO_PARTE_LABEL[n.parteType] ?? n.parteType}` : ""}`
                            : (TIPO_PARTE_LABEL[n.parteType ?? ""] ?? "")}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{n.processoTitulo}</p>
                      </div>
                      <span className="text-[10px] text-gray-300 shrink-0 mt-0.5">{timeAgo(n.at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
