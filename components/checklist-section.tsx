"use client";

import { useState } from "react";

type Item = {
  id: string;
  nome: string;
  status: string;
  categoria: string;
  obrigatorio: boolean;
  motivo_reprovacao: string | null;
  ia_valido: boolean | null;
};

type Props = {
  label: string;
  tipo: string;
  items: Item[];
  processoId: string;
  parteId: string | null;
};

// ─── Modal de visualização ────────────────────────────────────────────────────

function DocumentModal({
  url,
  mimeType,
  itemNome,
  itemStatus,
  iaValido,
  onAprovar,
  onReprovar,
  onClose,
}: {
  url: string;
  mimeType: string | null;
  itemNome: string;
  itemStatus: string;
  iaValido: boolean | null;
  onAprovar: () => Promise<void>;
  onReprovar: (motivo: string) => Promise<void>;
  onClose: () => void;
}) {
  const [showReprovar, setShowReprovar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const isPdf   = mimeType === "application/pdf";
  const isImage = mimeType?.startsWith("image/") ?? false;

  async function handleAprovar() {
    setLoading(true);
    await onAprovar();
    setLoading(false);
    onClose();
  }

  async function handleReprovar() {
    if (!motivo.trim()) return;
    setLoading(true);
    await onReprovar(motivo);
    setLoading(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-4xl flex flex-col shadow-2xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-gray-900 truncate">{itemNome}</span>
            {iaValido === true && (
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">
                ✓ IA validou
              </span>
            )}
            {iaValido === false && (
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                ⚠ Divergência detectada
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-3 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Documento */}
        <div className="flex-1 overflow-auto bg-gray-50 min-h-0" style={{ minHeight: "55vh" }}>
          {isPdf ? (
            <iframe src={url} className="w-full h-full" style={{ minHeight: "55vh" }} title={itemNome} />
          ) : isImage ? (
            <div className="flex items-center justify-center p-4 h-full" style={{ minHeight: "55vh" }}>
              <img src={url} alt={itemNome} className="max-w-full max-h-[55vh] object-contain rounded" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-gray-400">
              Pré-visualização não disponível.{" "}
              <a href={url} target="_blank" rel="noreferrer" className="ml-1 text-blue-500 underline">
                Abrir arquivo ↗
              </a>
            </div>
          )}
        </div>

        {/* Footer — ações só quando enviado */}
        {itemStatus === "enviado" && (
          <div className="border-t border-gray-100 px-5 py-3 shrink-0">
            {!showReprovar ? (
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowReprovar(true)}
                  disabled={loading}
                  className="text-sm px-4 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  Reprovar
                </button>
                <button
                  onClick={handleAprovar}
                  disabled={loading}
                  className="text-sm px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? "Aprovando..." : "Aprovar"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Motivo da reprovação..."
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleReprovar(); if (e.key === "Escape") setShowReprovar(false); }}
                  autoFocus
                  className="w-full text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-gray-400"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowReprovar(false)}
                    className="text-sm px-3 py-1 text-gray-400 hover:text-gray-600"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleReprovar}
                    disabled={loading || !motivo.trim()}
                    className="text-sm px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? "..." : "Confirmar reprovação"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Item individual ──────────────────────────────────────────────────────────

function ChecklistItem({ item, processoId }: { item: Item; processoId: string }) {
  const [status, setStatus]   = useState(item.status);
  const [motivo, setMotivo]   = useState(item.motivo_reprovacao ?? "");
  const [showReprovar, setShowReprovar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [docLoading, setDocLoading]     = useState(false);
  const [iaValido, setIaValido]         = useState<boolean | null>(item.ia_valido ?? null);
  const [modal, setModal]     = useState<{ url: string; mimeType: string | null } | null>(null);

  async function verDocumento() {
    setDocLoading(true);
    const res = await fetch(`/api/documentos/url?itemId=${item.id}`);
    if (res.ok) {
      const data = await res.json();
      if (data.ia_valido !== undefined && data.ia_valido !== null) setIaValido(data.ia_valido);
      setModal({ url: data.url, mimeType: data.mime_type ?? null });
    }
    setDocLoading(false);
  }

  async function updateStatus(novoStatus: string, motivoReprovacao?: string) {
    setLoading(true);
    const res = await fetch("/api/checklist/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, status: novoStatus, motivo_reprovacao: motivoReprovacao ?? null }),
    });
    if (res.ok) {
      setStatus(novoStatus);
      setShowReprovar(false);
    }
    setLoading(false);
  }

  const aprovado  = status === "aprovado";
  const reprovado = status === "reprovado";
  const enviado   = status === "enviado";
  const pendente  = status === "pendente";

  return (
    <>
      {modal && (
        <DocumentModal
          url={modal.url}
          mimeType={modal.mimeType}
          itemNome={item.nome}
          itemStatus={status}
          iaValido={iaValido}
          onAprovar={async () => { await updateStatus("aprovado"); }}
          onReprovar={async (m) => { setMotivo(m); await updateStatus("reprovado", m); }}
          onClose={() => setModal(null)}
        />
      )}

      <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">

        {/* Checkbox */}
        <button
          disabled={loading || aprovado}
          onClick={() => {
            if (pendente) updateStatus("enviado");
            else if (enviado) updateStatus("pendente");
          }}
          className="mt-0.5 shrink-0 disabled:cursor-default"
          title={pendente ? "Marcar como entregue" : enviado ? "Desmarcar" : undefined}
        >
          {aprovado ? (
            <svg className="w-4 h-4 text-green-500" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.78 5.78-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06L6.75 8.69l3.97-3.97a.75.75 0 0 1 1.06 1.06z"/>
            </svg>
          ) : reprovado ? (
            <svg className="w-4 h-4 text-red-400" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22z"/>
            </svg>
          ) : enviado ? (
            <svg className="w-4 h-4 text-blue-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="7"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l2 2 4-4"/>
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-300 hover:text-gray-400 transition-colors" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="7"/>
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Nome + badge IA + status */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`text-sm ${aprovado ? "line-through text-gray-400" : "text-gray-800"}`}>
                {item.nome}
              </span>
              {(enviado || aprovado || reprovado) && iaValido === true && (
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">✓ IA</span>
              )}
              {(enviado || aprovado || reprovado) && iaValido === false && (
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">⚠ IA</span>
              )}
            </div>
            {enviado && <span className="text-xs text-blue-500 shrink-0">Entregue</span>}
            {reprovado && <span className="text-xs text-red-500 shrink-0">Reprovado</span>}
          </div>

          {/* Motivo reprovação */}
          {reprovado && motivo && (
            <p className="text-xs text-red-400 mt-0.5">{motivo}</p>
          )}

          {/* Ações quando enviado */}
          {enviado && !showReprovar && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <button
                onClick={verDocumento}
                disabled={docLoading}
                className="text-xs px-3 py-1 bg-gray-50 text-gray-600 border border-gray-200 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {docLoading ? "Abrindo..." : "Ver documento"}
              </button>
              <button
                onClick={() => updateStatus("aprovado")}
                disabled={loading}
                className="text-xs px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                Aprovar
              </button>
              <button
                onClick={() => setShowReprovar(true)}
                disabled={loading}
                className="text-xs px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                Reprovar
              </button>
            </div>
          )}

          {/* Ver documento quando aprovado */}
          {aprovado && (
            <button
              onClick={verDocumento}
              disabled={docLoading}
              className="text-xs text-gray-400 hover:text-gray-600 mt-1"
            >
              {docLoading ? "Abrindo..." : "Ver documento"}
            </button>
          )}

          {/* Reprovar com motivo */}
          {reprovado && !showReprovar && (
            <button
              onClick={() => setShowReprovar(true)}
              className="text-xs text-gray-400 hover:text-gray-600 mt-1"
            >
              Editar motivo
            </button>
          )}

          {showReprovar && (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                placeholder="Motivo da reprovação..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => updateStatus("reprovado", motivo)}
                  disabled={loading || !motivo.trim()}
                  className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setShowReprovar(false)}
                  className="text-xs px-3 py-1 text-gray-400 hover:text-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Seção do checklist ───────────────────────────────────────────────────────

export default function ChecklistSection({ label, tipo, items: initialItems, processoId, parteId }: Props) {
  const [items, setItems]             = useState(initialItems);
  const [adicionando, setAdicionando] = useState(false);
  const [novoNome, setNovoNome]       = useState("");
  const [salvando, setSalvando]       = useState(false);

  const aprovados = items.filter((i) => i.status === "aprovado").length;
  const total     = items.length;
  const allDone   = total > 0 && aprovados === total;

  async function adicionarItem() {
    if (!novoNome.trim()) return;
    setSalvando(true);
    const res = await fetch("/api/checklist/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processoId, parteId, categoria: tipo, nome: novoNome }),
    });
    if (res.ok) {
      const novo = await res.json();
      setItems((prev) => [...prev, novo]);
      setNovoNome("");
      setAdicionando(false);
    }
    setSalvando(false);
  }

  const tipoColors: Record<string, string> = {
    comprador: "bg-blue-50 text-blue-600",
    vendedor:  "bg-purple-50 text-purple-600",
    imovel:    "bg-amber-50 text-amber-700",
    corretor:  "bg-gray-100 text-gray-600",
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tipoColors[tipo] ?? tipoColors.corretor}`}>
            {label.split(" — ")[0]}
          </span>
          {label.includes(" — ") && (
            <span className="text-sm font-medium text-gray-800">{label.split(" — ")[1]}</span>
          )}
        </div>
        <span className={`text-xs font-medium ${allDone ? "text-green-500" : "text-gray-400"}`}>
          {aprovados}/{total}
        </span>
      </div>

      <div className="px-4">
        {items.map((item) => (
          <ChecklistItem key={item.id} item={item} processoId={processoId} />
        ))}

        {adicionando ? (
          <div className="py-3 border-t border-gray-100 space-y-2">
            <input
              type="text"
              placeholder="Nome do documento..."
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") adicionarItem(); if (e.key === "Escape") { setAdicionando(false); setNovoNome(""); } }}
              autoFocus
              className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
            />
            <div className="flex gap-2">
              <button
                onClick={adicionarItem}
                disabled={salvando || !novoNome.trim()}
                className="text-xs px-3 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {salvando ? "Salvando..." : "Adicionar"}
              </button>
              <button
                onClick={() => { setAdicionando(false); setNovoNome(""); }}
                className="text-xs px-3 py-1 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdicionando(true)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors py-2.5 cursor-pointer w-full"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Adicionar documento
          </button>
        )}
      </div>
    </div>
  );
}
