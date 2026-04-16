import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import ChecklistSection from "@/components/checklist-section";

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
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(value + "T00:00:00");
  const diff = Math.ceil((data.getTime() - hoje.getTime()) / 86400000);
  const fmt = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-medium ${diff < 0 ? "text-red-600" : diff <= 5 ? "text-amber-600" : "text-gray-700"}`}>
        {fmt}
        {diff < 0 && <span className="ml-1 font-normal text-red-400">({Math.abs(diff)}d atraso)</span>}
      </span>
    </div>
  );
}

export default async function ProcessoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: processo } = await supabase
    .from("processos")
    .select(`
      id, titulo, status, hubspot_deal_id, observacoes,
      prazo_entrega_doc, prazo_assinatura, prazo_instrumento, prazo_registro,
      created_at,
      analistas ( nome, email )
    `)
    .eq("id", id)
    .single();

  if (!processo) notFound();

  const { data: partes } = await supabase
    .from("partes")
    .select("id, tipo, nome, email, token_acesso")
    .eq("processo_id", id)
    .order("tipo");

  const { data: checklist } = await supabase
    .from("checklist_items")
    .select("id, nome, status, categoria, parte_id, obrigatorio, motivo_reprovacao, ordem")
    .eq("processo_id", id)
    .order("ordem");

  // Agrupa checklist por parte (ou "imovel" sem parte)
  const grupos: { label: string; tipo: string; parteId: string | null; items: typeof checklist }[] = [];

  const partesOrdenadas = (partes ?? []).sort((a, b) => {
    const order = ["comprador", "vendedor", "corretor"];
    return order.indexOf(a.tipo) - order.indexOf(b.tipo);
  });

  for (const parte of partesOrdenadas) {
    const items = (checklist ?? []).filter((c) => c.parte_id === parte.id);
    if (items.length > 0) {
      grupos.push({
        label: `${parte.tipo.charAt(0).toUpperCase() + parte.tipo.slice(1)} — ${parte.nome}`,
        tipo: parte.tipo,
        parteId: parte.id,
        items,
      });
    }
  }

  const itemsImovel = (checklist ?? []).filter((c) => c.categoria === "imovel" && !c.parte_id);
  if (itemsImovel.length > 0) {
    grupos.push({ label: "Imóvel", tipo: "imovel", parteId: null, items: itemsImovel });
  }

  const totalItems = checklist?.length ?? 0;
  const aprovados = checklist?.filter((c) => c.status === "aprovado").length ?? 0;

  const analista = Array.isArray(processo.analistas)
    ? processo.analistas[0]
    : processo.analistas as { nome: string; email: string } | null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <Link href="/processos" className="text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">{processo.titulo}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{STATUS_LABEL[processo.status] ?? processo.status}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{aprovados}/{totalItems} aprovados</span>
          <a
            href={`https://app.hubspot.com/contacts/deals/${processo.hubspot_deal_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50 transition-colors"
          >
            Ver no HubSpot ↗
          </a>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Checklist principal */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {grupos.map((grupo) => (
            <ChecklistSection
              key={grupo.parteId ?? "imovel"}
              label={grupo.label}
              tipo={grupo.tipo}
              items={grupo.items ?? []}
              processoId={id}
            />
          ))}
          {grupos.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-16">Nenhum item no checklist.</p>
          )}
        </div>

        {/* Painel lateral */}
        <aside className="w-72 shrink-0 border-l border-gray-100 overflow-y-auto px-5 py-5 space-y-6">
          {/* Prazos */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Prazos</h3>
            <div className="bg-white border border-gray-100 rounded-lg px-3">
              <PrazoRow label="Entrega de docs" value={processo.prazo_entrega_doc} />
              <PrazoRow label="Assinatura" value={processo.prazo_assinatura} />
              <PrazoRow label="Instrumento" value={processo.prazo_instrumento} />
              <PrazoRow label="Registro" value={processo.prazo_registro} />
              {!processo.prazo_entrega_doc && !processo.prazo_instrumento && (
                <p className="text-xs text-gray-400 py-2">Nenhum prazo cadastrado.</p>
              )}
            </div>
          </div>

          {/* Partes */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Partes</h3>
            <div className="space-y-2">
              {(partes ?? []).map((parte) => (
                <div key={parte.id} className="bg-white border border-gray-100 rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-gray-700 capitalize">{parte.tipo}</span>
                    <a
                      href={`/portal?token=${parte.token_acesso}`}
                      target="_blank"
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      Portal ↗
                    </a>
                  </div>
                  <p className="text-sm text-gray-900">{parte.nome}</p>
                  <p className="text-xs text-gray-400">{parte.email}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Responsável */}
          {analista && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Responsável</h3>
              <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5">
                <p className="text-sm text-gray-900">{analista.nome}</p>
                <p className="text-xs text-gray-400">{analista.email}</p>
              </div>
            </div>
          )}

          {/* Observações */}
          {processo.observacoes && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Observações</h3>
              <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5">
                <p className="text-xs text-gray-600 whitespace-pre-line">{processo.observacoes}</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
