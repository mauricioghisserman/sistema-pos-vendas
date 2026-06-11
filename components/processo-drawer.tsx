"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ChecklistSection from "@/components/checklist-section";
import TasksSection from "@/components/tasks-section";
import ResumoSection from "@/components/resumo-section";
import FeedSection from "@/components/feed-section";

type Parte = { id: string; tipo: string; nome: string; email: string; token_acesso: string };
type ChecklistItem = { id: string; nome: string; status: string; categoria: string; parte_id: string | null; obrigatorio: boolean; motivo_reprovacao: string | null; ordem: number; ia_valido: boolean | null };
type Processo = {
  id: string; titulo: string; status: string; hubspot_deal_id: string;
  observacoes: string | null; ccv_url: string | null;
  prazo_entrega_doc: string | null; prazo_assinatura: string | null;
  prazo_instrumento: string | null; prazo_registro: string | null;
  hubspot_owner_nome: string | null;
  instrumento_definitivo: string | null;
  emails_pos_vendas: { email: string; tipo: string }[] | null;
  analistas: { nome: string; email: string } | null;
};
type Comissao = { corretor: string | null; imobiliaria: string | null; papel: string | null }
type Pendencia = {
  id: string; tipo: string; titulo: string; descricao: string | null;
  status: string; resposta_texto: string | null; motivo_reprovacao: string | null;
  created_at: string;
  partes: { nome: string; tipo: string } | null;
}

const TIPO_PENDENCIA_LABEL: Record<string, string> = {
  documento: "Documento", esclarecimento: "Esclarecimento", informacao: "Informação",
}
const STATUS_PENDENCIA_COLOR: Record<string, string> = {
  pendente: "text-yellow-700 bg-yellow-50",
  respondida: "text-blue-700 bg-blue-50",
  aprovada: "text-green-700 bg-green-50",
  reprovada: "text-red-700 bg-red-50",
}
const STATUS_PENDENCIA_LABEL: Record<string, string> = {
  pendente: "Pendente", respondida: "Respondida", aprovada: "Aprovada", reprovada: "Reprovada",
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
        <option value="advogado_comprador">Advogado comprador</option>
        <option value="advogado_vendedor">Advogado vendedor</option>
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

function ParteCard({ parte, onUpdate }: { parte: Parte; onUpdate: (id: string, nome: string, email: string) => void }) {
  const [copiado, setCopiado]   = useState(false);
  const [editando, setEditando] = useState(false);
  const [nome, setNome]         = useState(parte.nome);
  const [email, setEmail]       = useState(parte.email);
  const [salvando, setSalvando] = useState(false);

  function copiarLink() {
    const url = `${window.location.origin}/portal?token=${parte.token_acesso}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  async function salvar() {
    if (!nome.trim() || !email.trim()) return;
    setSalvando(true);
    const supabase = createClient();
    await supabase.from("partes").update({ nome: nome.trim(), email: email.trim() }).eq("id", parte.id);
    onUpdate(parte.id, nome.trim(), email.trim());
    setSalvando(false);
    setEditando(false);
  }

  const TIPO_LABEL_MAP: Record<string, string> = {
    comprador: "Comprador", vendedor: "Vendedor", corretor: "Corretor",
    advogado_comprador: "Advogado comprador", advogado_vendedor: "Advogado vendedor",
  };

  return (
    <div className="border border-gray-100 rounded-lg px-3 py-2.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-medium text-gray-500 capitalize">{TIPO_LABEL_MAP[parte.tipo] ?? parte.tipo}</span>
        <div className="flex items-center gap-2">
          {!editando && (
            <>
              <button
                onClick={copiarLink}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                title="Copiar link do portal"
              >
                {copiado ? (
                  <><svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span className="text-green-500">Copiado!</span></>
                ) : (
                  <><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span>Copiar link</span></>
                )}
              </button>
              <a
                href={`${typeof window !== "undefined" ? window.location.origin : ""}/portal?token=${parte.token_acesso}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                title="Abrir portal"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                <span>Abrir</span>
              </a>
              <button
                onClick={() => setEditando(true)}
                className="text-gray-300 hover:text-gray-600 transition-colors cursor-pointer"
                title="Editar"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.243-6.243a2 2 0 1 1 2.828 2.828L11.828 13.828A4 4 0 0 1 9 15H7v-2a4 4 0 0 1 2.172-3.586z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {editando ? (
        <div className="space-y-1.5 mt-1">
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome"
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
          />
          <div className="flex gap-2 pt-0.5">
            <button
              onClick={salvar}
              disabled={salvando || !nome.trim() || !email.trim()}
              className="text-xs px-3 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={() => { setEditando(false); setNome(parte.nome); setEmail(parte.email); }}
              className="text-xs px-3 py-1 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-900">{parte.nome}</p>
          <p className="text-xs text-gray-400 truncate">{parte.email}</p>
        </>
      )}
    </div>
  );
}

function PendenciasSection({
  processoId, partes, pendencias, onCriada, onAvaliada, onRefresh,
}: {
  processoId: string;
  partes: Parte[];
  pendencias: Pendencia[];
  onCriada: (p: Pendencia) => void;
  onAvaliada: (id: string, status: string, motivo?: string) => void;
  onRefresh: () => void;
}) {
  const [criando, setCriando]         = useState(false);
  const [tipo, setTipo]               = useState("documento");
  const [parteId, setParteId]         = useState("");
  const [titulo, setTitulo]           = useState("");
  const [descricao, setDescricao]     = useState("");
  const [salvando, setSalvando]       = useState(false);
  const [reprovandoId, setReprovandoId] = useState<string | null>(null);
  const [motivoReprova, setMotivoReprova] = useState("");

  const TIPO_PENDENCIA_ICONS: Record<string, string> = {
    documento: "📄", esclarecimento: "💬", informacao: "ℹ️",
  };

  async function criar() {
    if (!parteId || !titulo.trim()) return;
    setSalvando(true);
    const res = await fetch("/api/pendencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processoId, parteId, tipo, titulo: titulo.trim(), descricao: descricao.trim() || null }),
    });
    if (res.ok) {
      const nova = await res.json() as Pendencia;
      onCriada(nova);
      setCriando(false);
      setTipo("documento"); setParteId(""); setTitulo(""); setDescricao("");
    }
    setSalvando(false);
  }

  async function avaliar(id: string, status: "aprovada" | "reprovada", motivo?: string) {
    const res = await fetch(`/api/pendencias/${id}/avaliar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, motivo_reprovacao: motivo }),
    });
    if (res.ok) {
      onAvaliada(id, status, motivo);
      setReprovandoId(null);
      setMotivoReprova("");
    }
  }

  const partesDisponiveis = partes.filter((p) => p.tipo !== "corretor");

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pendências</h3>
          <button onClick={onRefresh} title="Atualizar" className="text-gray-300 hover:text-gray-500 transition-colors cursor-pointer">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
        <button
          onClick={() => setCriando((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
        >
          {criando ? "Cancelar" : "+ Nova"}
        </button>
      </div>

      {criando && (
        <div className="border border-gray-100 rounded-lg px-3 py-3 space-y-2 mb-2">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-gray-400">
            <option value="documento">📄 Documento</option>
            <option value="esclarecimento">💬 Esclarecimento</option>
            <option value="informacao">ℹ️ Informação</option>
          </select>
          <select value={parteId} onChange={(e) => setParteId(e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-gray-400">
            <option value="">Selecionar parte...</option>
            {partesDisponiveis.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
          <input
            type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título da pendência"
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
          />
          <textarea
            value={descricao} onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={2}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={criar} disabled={salvando || !parteId || !titulo.trim()} className="text-xs px-3 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 cursor-pointer">
              {salvando ? "Criando..." : "Criar"}
            </button>
          </div>
        </div>
      )}

      {pendencias.length === 0 && !criando && (
        <p className="text-xs text-gray-400">Nenhuma pendência criada.</p>
      )}

      <div className="space-y-2">
        {pendencias.map((p) => (
          <div key={p.id} className="border border-gray-100 rounded-lg px-3 py-2.5 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-800 leading-snug">
                  {TIPO_PENDENCIA_ICONS[p.tipo]} {p.titulo}
                </p>
                {p.partes && (
                  <p className="text-[10px] text-gray-400">{p.partes.nome}</p>
                )}
              </div>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${STATUS_PENDENCIA_COLOR[p.status]}`}>
                {STATUS_PENDENCIA_LABEL[p.status]}
              </span>
            </div>

            {p.descricao && <p className="text-[11px] text-gray-500">{p.descricao}</p>}

            {p.resposta_texto && (
              <div className="bg-blue-50 rounded px-2 py-1.5">
                <p className="text-[10px] text-blue-500 font-medium mb-0.5">Resposta</p>
                <p className="text-[11px] text-blue-800">{p.resposta_texto}</p>
              </div>
            )}

            {p.status === "respondida" && (
              reprovandoId === p.id ? (
                <div className="space-y-1.5">
                  <textarea
                    value={motivoReprova} onChange={(e) => setMotivoReprova(e.target.value)}
                    placeholder="Motivo da reprovação"
                    rows={2}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => avaliar(p.id, "reprovada", motivoReprova)} disabled={!motivoReprova.trim()} className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 cursor-pointer">Reprovar</button>
                    <button onClick={() => { setReprovandoId(null); setMotivoReprova(""); }} className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600 cursor-pointer">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => avaliar(p.id, "aprovada")} className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer">Aprovar</button>
                  <button onClick={() => setReprovandoId(p.id)} className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 cursor-pointer">Reprovar</button>
                </div>
              )
            )}

            {p.motivo_reprovacao && (
              <p className="text-[11px] text-red-600 bg-red-50 rounded px-2 py-1"><strong>Motivo:</strong> {p.motivo_reprovacao}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type Props = { processoId: string | null; onClose: () => void };

export default function ProcessoDrawer({ processoId, onClose }: Props) {
  const [processo, setProcesso] = useState<Processo | null>(null);
  const [partes, setPartes] = useState<Parte[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [responsavelComercial, setResponsavelComercial] = useState<string | null>(null);
  const [responsavelJuridico, setResponsavelJuridico] = useState<string | null>(null);
  const [analistas, setAnalistas] = useState<{ nome: string; email: string }[]>([]);
  const [atualizandoOwner, setAtualizandoOwner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "ok" | "erro">("idle");

  function refreshPendencias() {
    if (!processoId) return;
    fetch(`/api/pendencias?processoId=${processoId}`)
      .then((r) => r.json())
      .then((pend) => setPendencias(Array.isArray(pend) ? pend : []))
      .catch(() => {});
  }

  useEffect(() => {
    if (!processoId) return;
    setLoading(true);
    const supabase = createClient();

    Promise.all([
      supabase.from("processos").select("id,titulo,status,hubspot_deal_id,observacoes,prazo_entrega_doc,prazo_assinatura,prazo_instrumento,prazo_registro,ccv_url,hubspot_owner_nome,instrumento_definitivo,emails_pos_vendas,analistas(nome,email)").eq("id", processoId).single(),
      supabase.from("partes").select("id,tipo,nome,email,token_acesso").eq("processo_id", processoId).order("tipo"),
      supabase.from("checklist_items").select("id,nome,status,categoria,parte_id,obrigatorio,motivo_reprovacao,ordem,ia_valido").eq("processo_id", processoId).order("ordem"),
      fetch(`/api/processos/comissoes?processoId=${processoId}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/pendencias?processoId=${processoId}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/processos/responsavel-comercial?processoId=${processoId}`).then((r) => r.json()).catch(() => ({ nome: null })),
      fetch(`/api/processos/responsavel-juridico?processoId=${processoId}`).then((r) => r.json()).catch(() => ({ nome: null })),
    ]).then(([p, pa, ch, cm, pend, rc, rj]) => {
      const analistas = p.data?.analistas;
      setProcesso({
        ...p.data!,
        analistas: Array.isArray(analistas) ? (analistas[0] ?? null) : (analistas as unknown) as { nome: string; email: string } | null,
      });
      setPartes(pa.data ?? []);
      setChecklist(ch.data ?? []);
      setComissoes(Array.isArray(cm) ? cm : []);
      setPendencias(Array.isArray(pend) ? pend : []);
      setResponsavelComercial(rc?.nome ?? null);
      setResponsavelJuridico(rj?.nome ?? null);
      setLoading(false);

      // Busca lista de analistas para o seletor
      const supabaseClient = createClient();
      supabaseClient.from("analistas").select("nome, email").order("nome").then(({ data }) => {
        if (data) setAnalistas(data);
      });

    });
  }, [processoId]);

  // Fecha com ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const open = !!processoId;

  async function enviarEmailInicio() {
    if (!processo || enviandoEmail) return;
    setEnviandoEmail(true);
    setEmailStatus("idle");
    try {
      const res = await fetch("/api/processos/enviar-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processoId: processo.id }),
      });
      setEmailStatus(res.ok ? "ok" : "erro");
    } catch {
      setEmailStatus("erro");
    } finally {
      setEnviandoEmail(false);
      setTimeout(() => setEmailStatus("idle"), 4000);
    }
  }

  // Agrupa checklist por parte
  const grupos: { label: string; tipo: string; parteId: string | null; items: ChecklistItem[] }[] = [];
  const TIPO_ORDEM = ["comprador","vendedor","corretor","advogado_comprador","advogado_vendedor"];
  const TIPO_LABEL: Record<string, string> = {
    comprador: "Comprador", vendedor: "Vendedor", corretor: "Corretor",
    advogado_comprador: "Advogado comprador", advogado_vendedor: "Advogado vendedor",
  };
  const partesOrdenadas = [...partes].sort((a, b) => TIPO_ORDEM.indexOf(a.tipo) - TIPO_ORDEM.indexOf(b.tipo));
  for (const parte of partesOrdenadas) {
    const items = checklist.filter((c) => c.parte_id === parte.id);
    if (items.length > 0) grupos.push({ label: `${TIPO_LABEL[parte.tipo] ?? parte.tipo} — ${parte.nome}`, tipo: parte.tipo, parteId: parte.id, items });
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
      <div className={`fixed top-0 right-0 h-full w-[1150px] max-w-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}>
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
                <button
                  onClick={enviarEmailInicio}
                  disabled={enviandoEmail}
                  title="Enviar email de início para todas as partes"
                  className={`text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-50 ${
                    emailStatus === "ok" ? "border-green-300 text-green-700 bg-green-50" :
                    emailStatus === "erro" ? "border-red-300 text-red-700 bg-red-50" :
                    "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {enviandoEmail ? "Enviando..." : emailStatus === "ok" ? "Enviado ✓" : emailStatus === "erro" ? "Erro ao enviar" : "Enviar email"}
                </button>
                {processo.ccv_url && (
                  <a href={processo.ccv_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50 transition-colors flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                    </svg>
                    CCV
                  </a>
                )}
                <a href={`https://app.hubspot.com/contacts/23482022/record/0-3/${processo.hubspot_deal_id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50 transition-colors">
                  HubSpot ↗
                </a>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Checklist */}
              <div className="w-[340px] shrink-0 overflow-y-auto px-5 py-5 space-y-4">
                {grupos.map((grupo) => (
                  <ChecklistSection key={grupo.parteId ?? "imovel"} label={grupo.label} tipo={grupo.tipo} items={grupo.items} processoId={processo.id} parteId={grupo.parteId} />
                ))}
                {grupos.length === 0 && <p className="text-sm text-gray-400 text-center py-16">Nenhum item no checklist.</p>}
              </div>

              {/* Feed HubSpot */}
              <div className="flex-1 border-l border-gray-100 overflow-hidden">
                <FeedSection processoId={processo.id} />
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

                {processo.instrumento_definitivo && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Instrumento Definitivo</h3>
                    <div className="border border-gray-100 rounded-lg px-3 py-2.5">
                      <p className="text-sm text-gray-900">{processo.instrumento_definitivo}</p>
                    </div>
                  </div>
                )}

                {comissoes.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Corretores</h3>
                    <div className="space-y-2">
                      {comissoes.map((c, i) => (
                        <div key={i} className="text-sm space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                            </svg>
                            <span className="text-gray-700">{c.corretor ?? "—"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                            </svg>
                            <span className="text-gray-500">{c.imobiliaria ?? "—"}</span>
                          </div>
                          {c.papel && <p className="text-xs text-gray-400 pl-5">{c.papel}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {processo.emails_pos_vendas && processo.emails_pos_vendas.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Participantes do PV</h3>
                    <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                      {processo.emails_pos_vendas.map((p, i) => (
                        <div key={i} className="px-3 py-2 flex items-center gap-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${p.tipo === "comprador" ? "bg-blue-50 text-blue-600" : p.tipo === "demais_envolvidos" ? "bg-purple-50 text-purple-600" : "bg-amber-50 text-amber-600"}`}>
                            {p.tipo === "comprador" ? "Comprador" : p.tipo === "demais_envolvidos" ? "Demais Envolvidos" : "Vendedor"}
                          </span>
                          <span className="text-xs text-gray-700 truncate">{p.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Partes</h3>
                  <div className="space-y-2">
                    {partes.map((parte) => (
                      <ParteCard
                        key={parte.id}
                        parte={parte}
                        onUpdate={(id, nome, email) =>
                          setPartes((prev) => prev.map((p) => p.id === id ? { ...p, nome, email } : p))
                        }
                      />
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

                <PendenciasSection
                  processoId={processo.id}
                  partes={partes}
                  pendencias={pendencias}
                  onCriada={(p) => setPendencias((prev) => [p, ...prev])}
                  onAvaliada={(id, status, motivo) =>
                    setPendencias((prev) => prev.map((p) => p.id === id ? { ...p, status, motivo_reprovacao: motivo ?? null } : p))
                  }
                  onRefresh={refreshPendencias}
                />

                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Responsável</h3>
                  <select
                    value={processo.hubspot_owner_nome ?? ""}
                    disabled={atualizandoOwner}
                    onChange={async (e) => {
                      const nome = e.target.value || null;
                      const analista = analistas.find((a) => a.nome === nome) ?? null;
                      setAtualizandoOwner(true);
                      await fetch("/api/processos/responsavel", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ processoId: processo.id, analistaEmail: analista?.email ?? null, analistaNome: nome }),
                      });
                      setProcesso((p) => p ? { ...p, hubspot_owner_nome: nome } : p);
                      setAtualizandoOwner(false);
                    }}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400 bg-white cursor-pointer disabled:opacity-50"
                  >
                    <option value="">Sem responsável</option>
                    {analistas.map((a) => (
                      <option key={a.email} value={a.nome}>{a.nome}</option>
                    ))}
                  </select>
                </div>

                {responsavelComercial && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Responsável Comercial</h3>
                    <div className="border border-gray-100 rounded-lg px-3 py-2.5">
                      <p className="text-sm text-gray-900">{responsavelComercial}</p>
                    </div>
                  </div>
                )}

                {responsavelJuridico && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Responsável Jurídico</h3>
                    <div className="border border-gray-100 rounded-lg px-3 py-2.5">
                      <p className="text-sm text-gray-900">{responsavelJuridico}</p>
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
