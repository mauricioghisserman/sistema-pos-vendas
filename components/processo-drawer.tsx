"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ChecklistSection from "@/components/checklist-section";
import TasksSection from "@/components/tasks-section";
import ResumoSection from "@/components/resumo-section";

type Parte = { id: string; tipo: string; nome: string; email: string; token_acesso: string };
type ChecklistItem = { id: string; nome: string; status: string; categoria: string; parte_id: string | null; obrigatorio: boolean; motivo_reprovacao: string | null; ordem: number; ia_valido: boolean | null };
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

function PrazoRow({ label, value, campo, processoId, onUpdate }: {
  label: string;
  value: string | null;
  campo: string;
  processoId: string;
  onUpdate: (campo: string, valor: string) => void;
}) {
  const [editing, setEditing]   = useState(false);
  const [modo, setModo]         = useState<"data" | "dias">("data");
  const [inputData, setInputData] = useState(value ?? "");
  const [inputDias, setInputDias] = useState("");
  const [saving, setSaving]     = useState(false);

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  // Data calculada no modo "dias"
  const dataCalculada = (() => {
    const n = parseInt(inputDias);
    if (!inputDias || isNaN(n) || n < 0) return null;
    const d = new Date(hoje); d.setDate(d.getDate() + n);
    return d.toISOString().split("T")[0];
  })();

  function openEdit() {
    setInputData(value ?? "");
    setInputDias("");
    setModo("data");
    setEditing(true);
  }

  function cancel() { setEditing(false); }

  async function save() {
    const novaData = modo === "data" ? inputData : dataCalculada;
    if (!novaData) return;
    setSaving(true);
    await fetch("/api/processos/prazos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processoId, campo, valor: novaData }),
    });
    onUpdate(campo, novaData);
    setSaving(false);
    setEditing(false);
  }

  // Exibição do valor atual
  const displayDiff = value ? Math.ceil((new Date(value + "T00:00:00").getTime() - hoje.getTime()) / 86400000) : null;
  const displayFmt  = value ? new Date(value + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;

  if (editing) {
    const novaDataPreview = modo === "dias" && dataCalculada
      ? new Date(dataCalculada + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : null;

    return (
      <div className="py-2.5 border-b border-gray-100 last:border-0">
        <p className="text-xs text-gray-400 mb-2">{label}</p>

        {/* Tabs */}
        <div className="flex gap-1 mb-2">
          {(["data", "dias"] as const).map((m) => (
            <button key={m} onClick={() => setModo(m)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${modo === m ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
              {m === "data" ? "Data" : "Dias"}
            </button>
          ))}
        </div>

        {modo === "data" ? (
          <input
            type="date"
            value={inputData}
            onChange={(e) => { setInputData(e.target.value); if (e.target.value) { const v = e.target.value; setTimeout(() => { setSaving(true); fetch("/api/processos/prazos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ processoId, campo, valor: v }) }).then(() => { onUpdate(campo, v); setSaving(false); setEditing(false); }); }, 0); } }}
            onKeyDown={(e) => { if (e.key === "Escape") cancel(); }}
            autoFocus
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
          />
        ) : (
          <div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                placeholder="ex: 30"
                value={inputDias}
                onChange={(e) => setInputDias(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
                onBlur={() => { if (dataCalculada) save(); }}
                autoFocus
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
              />
              <span className="text-xs text-gray-400 shrink-0">dias</span>
            </div>
            {novaDataPreview && (
              <p className="text-xs text-gray-400 mt-1">→ {novaDataPreview}</p>
            )}
            {saving && <p className="text-xs text-gray-400 mt-1">Salvando...</p>}
          </div>
        )}

        <button onClick={cancel} className="text-xs mt-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="group py-2 border-b border-gray-100 last:border-0">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <div className="flex items-center gap-1.5">
        {displayFmt ? (
          <p className={`text-xs font-medium ${displayDiff! < 0 ? "text-red-600" : displayDiff! <= 5 ? "text-amber-600" : "text-gray-700"}`}>
            {displayFmt}
            {displayDiff! < 0
              ? <span className="ml-1 font-normal text-red-400">({Math.abs(displayDiff!)}d atraso)</span>
              : <span className="ml-1 font-normal text-gray-400">({displayDiff}d)</span>}
          </p>
        ) : (
          <p className="text-xs text-gray-400">—</p>
        )}
        <button
          onClick={openEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-700 cursor-pointer"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function AdicionarParteForm({ processoId, onAdicionada }: {
  processoId: string;
  onAdicionada: (parte: Parte, novosItens: ChecklistItem[]) => void;
}) {
  const [aberto, setAberto]   = useState(false);
  const [tipo, setTipo]       = useState("comprador");
  const [nome, setNome]       = useState("");
  const [email, setEmail]     = useState("");
  const [salvando, setSalvando] = useState(false);
  const supabase = createClient();

  async function salvar() {
    if (!nome.trim() || !email.trim()) return;
    setSalvando(true);

    const res = await fetch("/api/processos/partes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processoId, tipo, nome, email }),
    });

    if (res.ok) {
      const novaParte: Parte = await res.json();

      // Busca os novos itens de checklist criados para esta parte
      const { data: novosItens } = await supabase
        .from("checklist_items")
        .select("id,nome,status,categoria,parte_id,obrigatorio,motivo_reprovacao,ordem,ia_valido")
        .eq("processo_id", processoId)
        .eq("parte_id", novaParte.id);

      onAdicionada(novaParte, novosItens ?? []);
      setNome(""); setEmail(""); setTipo("comprador"); setAberto(false);
    }
    setSalvando(false);
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors mt-2 cursor-pointer w-full"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Adicionar parte
      </button>
    );
  }

  return (
    <div className="mt-2 border border-gray-100 rounded-lg px-3 py-3 space-y-2">
      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400 bg-white"
      >
        <option value="comprador">Comprador</option>
        <option value="vendedor">Vendedor</option>
        <option value="corretor">Corretor</option>
      </select>
      <input
        type="text"
        placeholder="Nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
      />
      <input
        type="email"
        placeholder="E-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") salvar(); if (e.key === "Escape") setAberto(false); }}
        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
      />
      <div className="flex gap-2">
        <button
          onClick={salvar}
          disabled={salvando || !nome.trim() || !email.trim()}
          className="text-xs px-3 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {salvando ? "Salvando..." : "Adicionar"}
        </button>
        <button
          onClick={() => { setAberto(false); setNome(""); setEmail(""); }}
          className="text-xs px-3 py-1 text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ParteCard({ parte }: { parte: Parte }) {
  const [copiado, setCopiado] = useState(false);

  function copiarLink() {
    const url = `${window.location.origin}/portal?token=${parte.token_acesso}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  return (
    <div className="border border-gray-100 rounded-lg px-3 py-2.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-medium text-gray-500 capitalize">{parte.tipo}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={copiarLink}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            title="Copiar link do portal"
          >
            {copiado ? (
              <>
                <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-500">Copiado!</span>
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copiar link</span>
              </>
            )}
          </button>
          <a
            href={`${typeof window !== "undefined" ? window.location.origin : ""}/portal?token=${parte.token_acesso}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
            title="Abrir portal"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>Abrir</span>
          </a>
        </div>
      </div>
      <p className="text-sm text-gray-900">{parte.nome}</p>
      <p className="text-xs text-gray-400 truncate">{parte.email}</p>
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
      supabase.from("checklist_items").select("id,nome,status,categoria,parte_id,obrigatorio,motivo_reprovacao,ordem,ia_valido").eq("processo_id", processoId).order("ordem"),
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
      <div className={`fixed top-0 right-0 h-full w-[900px] max-w-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}>
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
                  <ChecklistSection key={grupo.parteId ?? "imovel"} label={grupo.label} tipo={grupo.tipo} items={grupo.items} processoId={processo.id} parteId={grupo.parteId} />
                ))}
                {grupos.length === 0 && <p className="text-sm text-gray-400 text-center py-16">Nenhum item no checklist.</p>}
              </div>

              {/* Sidebar */}
              <aside className="w-80 shrink-0 border-l border-gray-100 overflow-y-auto overflow-x-hidden px-4 py-5 space-y-5">
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Prazos</h3>
                  <div className="border border-gray-100 rounded-lg px-3">
                    <PrazoRow label="Entrega de docs" value={processo.prazo_entrega_doc} campo="prazo_entrega_doc" processoId={processo.id} onUpdate={(c, v) => setProcesso((p) => p ? { ...p, [c]: v } : p)} />
                    <PrazoRow label="Assinatura" value={processo.prazo_assinatura} campo="prazo_assinatura" processoId={processo.id} onUpdate={(c, v) => setProcesso((p) => p ? { ...p, [c]: v } : p)} />
                    <PrazoRow label="Instrumento" value={processo.prazo_instrumento} campo="prazo_instrumento" processoId={processo.id} onUpdate={(c, v) => setProcesso((p) => p ? { ...p, [c]: v } : p)} />
                    <PrazoRow label="Registro" value={processo.prazo_registro} campo="prazo_registro" processoId={processo.id} onUpdate={(c, v) => setProcesso((p) => p ? { ...p, [c]: v } : p)} />
                    {!processo.prazo_entrega_doc && !processo.prazo_instrumento && !processo.prazo_assinatura && !processo.prazo_registro && (
                      <p className="text-xs text-gray-400 py-2">Nenhum prazo.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Partes</h3>
                  <div className="space-y-2">
                    {partes.map((parte) => (
                      <ParteCard key={parte.id} parte={parte} />
                    ))}
                  </div>
                  <AdicionarParteForm
                    processoId={processo.id}
                    onAdicionada={(novaParte, novosItens) => {
                      setPartes((prev) => [...prev, novaParte]);
                      setChecklist((prev) => [...prev, ...novosItens]);
                    }}
                  />
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

                <div>
                  <ResumoSection processoId={processo.id} />
                </div>

                <div>
                  <TasksSection processoId={processo.id} />
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </>
  );
}
