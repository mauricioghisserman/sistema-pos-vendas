"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ChecklistSection from "@/components/checklist-section";

type Parte = { id: string; tipo: string; nome: string; email: string; token_acesso: string };
type ChecklistItem = { id: string; nome: string; status: string; categoria: string; parte_id: string | null; obrigatorio: boolean; motivo_reprovacao: string | null; ordem: number };
type Processo = {
  id: string; titulo: string; status: string; hubspot_deal_id: string;
  observacoes: string | null;
  prazo_entrega_doc: string | null; prazo_assinatura: string | null;
  prazo_instrumento: string | null; prazo_registro: string | null;
  analistas: { nome: string; email: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  fechado_pelo_comercial: "Fechado pelo comercial",
  pos_vendas_iniciado: "Pós-vendas iniciado",
  documentacao_pendente: "Documentação pendente",
  instrumento_definitivo: "Instrumento Definitivo",
  finalizado: "Finalizado",
  sem_pos_vendas: "Sem pós-vendas",
  perdido: "Perdido",
};

function PrazoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const data = new Date(value + "T00:00:00");
  const diff = Math.ceil((data.getTime() - hoje.getTime()) / 86400000);
  const fmt = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-medium ${diff < 0 ? "text-red-600" : diff <= 5 ? "text-amber-600" : "text-gray-700"}`}>
        {fmt}{diff < 0 && <span className="ml-1 font-normal text-red-400">({Math.abs(diff)}d atraso)</span>}
      </span>
    </div>
  );
}

type Props = { processoId: string | null; onClose: () => void };

export default function ProcessoDrawer({ processoId, onClose }: Props) {
  const [processo, setProcesso] = useState<Processo | null>(null);
  const [partes, setPartes] = useState<Parte[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!processoId) return;
    setLoading(true);
    const supabase = createClient();

    Promise.all([
      supabase.from("processos").select("id,titulo,status,hubspot_deal_id,observacoes,prazo_entrega_doc,prazo_assinatura,prazo_instrumento,prazo_registro,analistas(nome,email)").eq("id", processoId).single(),
      supabase.from("partes").select("id,tipo,nome,email,token_acesso").eq("processo_id", processoId).order("tipo"),
      supabase.from("checklist_items").select("id,nome,status,categoria,parte_id,obrigatorio,motivo_reprovacao,ordem").eq("processo_id", processoId).order("ordem"),
    ]).then(([p, pa, ch]) => {
      const analistas = p.data?.analistas;
      setProcesso({
        ...p.data!,
        analistas: Array.isArray(analistas) ? (analistas[0] ?? null) : (analistas as unknown) as { nome: string; email: string } | null,
      });
      setPartes(pa.data ?? []);
      setChecklist(ch.data ?? []);
      setLoading(false);
    });
  }, [processoId]);

  // Fecha com ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const open = !!processoId;

  // Agrupa checklist por parte
  const grupos: { label: string; tipo: string; parteId: string | null; items: ChecklistItem[] }[] = [];
  const partesOrdenadas = [...partes].sort((a, b) => ["comprador","vendedor","corretor"].indexOf(a.tipo) - ["comprador","vendedor","corretor"].indexOf(b.tipo));
  for (const parte of partesOrdenadas) {
    const items = checklist.filter((c) => c.parte_id === parte.id);
    if (items.length > 0) grupos.push({ label: `${parte.tipo.charAt(0).toUpperCase() + parte.tipo.slice(1)} — ${parte.nome}`, tipo: parte.tipo, parteId: parte.id, items });
  }
  const itemsImovel = checklist.filter((c) => c.categoria === "imovel" && !c.parte_id);
  if (itemsImovel.length > 0) grupos.push({ label: "Imóvel", tipo: "imovel", parteId: null, items: itemsImovel });

  const aprovados = checklist.filter((c) => c.status === "aprovado").length;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-[780px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}>
        {loading || !processo ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 shrink-0">
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-gray-900 truncate">{processo.titulo}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{STATUS_LABEL[processo.status] ?? processo.status}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{aprovados}/{checklist.length} aprovados</span>
                <a href={`https://app.hubspot.com/contacts/deals/${processo.hubspot_deal_id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50 transition-colors">
                  HubSpot ↗
                </a>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Checklist */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {grupos.map((grupo) => (
                  <ChecklistSection key={grupo.parteId ?? "imovel"} label={grupo.label} tipo={grupo.tipo} items={grupo.items} processoId={processo.id} />
                ))}
                {grupos.length === 0 && <p className="text-sm text-gray-400 text-center py-16">Nenhum item no checklist.</p>}
              </div>

              {/* Sidebar */}
              <aside className="w-60 shrink-0 border-l border-gray-100 overflow-y-auto px-4 py-5 space-y-5">
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Prazos</h3>
                  <div className="border border-gray-100 rounded-lg px-3">
                    <PrazoRow label="Entrega de docs" value={processo.prazo_entrega_doc} />
                    <PrazoRow label="Assinatura" value={processo.prazo_assinatura} />
                    <PrazoRow label="Instrumento" value={processo.prazo_instrumento} />
                    <PrazoRow label="Registro" value={processo.prazo_registro} />
                    {!processo.prazo_entrega_doc && !processo.prazo_instrumento && !processo.prazo_assinatura && !processo.prazo_registro && (
                      <p className="text-xs text-gray-400 py-2">Nenhum prazo.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Partes</h3>
                  <div className="space-y-2">
                    {partes.map((parte) => (
                      <div key={parte.id} className="border border-gray-100 rounded-lg px-3 py-2.5">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-gray-500 capitalize">{parte.tipo}</span>
                          <a href={`/portal?token=${parte.token_acesso}`} target="_blank" className="text-xs text-blue-500 hover:text-blue-700">Portal ↗</a>
                        </div>
                        <p className="text-sm text-gray-900">{parte.nome}</p>
                        <p className="text-xs text-gray-400 truncate">{parte.email}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {processo.analistas && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Responsável</h3>
                    <div className="border border-gray-100 rounded-lg px-3 py-2.5">
                      <p className="text-sm text-gray-900">{processo.analistas.nome}</p>
                      <p className="text-xs text-gray-400">{processo.analistas.email}</p>
                    </div>
                  </div>
                )}

                {processo.observacoes && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Observações</h3>
                    <div className="border border-gray-100 rounded-lg px-3 py-2.5">
                      <p className="text-xs text-gray-600 whitespace-pre-line">{processo.observacoes}</p>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </div>
    </>
  );
}
