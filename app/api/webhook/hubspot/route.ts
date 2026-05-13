import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const STAGE_MAP: Record<string, string> = {
  "209029533": "fechado_pelo_comercial",
  "209029534": "pos_vendas_iniciado",
  "209029535": "documentacao_pendente",
  "209029536": "instrumento_definitivo",
  "209394964": "finalizado",
  "1089645944": "sem_pos_vendas",
  "214273600": "perdido",
};


async function resolverCcvUrl(fileId: string | null): Promise<string | null> {
  if (!fileId) return null;
  const res = await fetch(
    `https://api.hubapi.com/files/v3/files/${fileId}`,
    { headers: { Authorization: `Bearer ${process.env.HUBSPOT_API_TOKEN}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.url ?? null;
}

// Doc name (HubSpot IA) → nome(s) do item no checklist
// CNH substitui CPF e RG
const DOC_CHECKLIST: Record<string, string[]> = {
  "cpf":                         ["CPF ou CNH"],
  "rg":                          ["RG"],
  "cnh":                         ["CPF ou CNH", "RG"],
  "comprovante de endereço":     ["Comprovante de Endereço"],
  "certidão de estado civil":    ["Comprovante de Estado Civil"],
  "comprovante de estado civil": ["Comprovante de Estado Civil"],
  "iptu":                        ["IPTU"],
  "matrícula":                   ["Matrícula do Imóvel"],
};

type ParteIA  = { nome: string | null; parte: string; documentos: { doc: string }[] };
type ParteRow = { id: string; tipo: string; nome: string };
type ChecklistRow = { id: string; nome: string; parte_id: string | null; categoria: string };

async function marcarDocsEncontrados(
  supabase: ReturnType<typeof createServiceClient>,
  processoId: string,
  partes: ParteRow[],
  iaChecklistRaw: string
) {
  let iaChecklist: ParteIA[];
  try { iaChecklist = JSON.parse(iaChecklistRaw); } catch { return; }

  const { data: checklistItems } = await supabase
    .from("checklist_items")
    .select("id, nome, parte_id, categoria")
    .eq("processo_id", processoId) as { data: ChecklistRow[] | null };
  if (!checklistItems) return;

  const idsParaMarcar: string[] = [];

  for (const entry of iaChecklist) {
    const tipoKey = entry.parte.toLowerCase();
    const tipo = tipoKey === "imóvel" || tipoKey === "imovel" ? "imovel"
               : tipoKey === "vendedor" ? "vendedor"
               : tipoKey === "comprador" ? "comprador"
               : null;
    if (!tipo) continue;

    for (const { doc } of entry.documentos) {
      const nomesDocs = DOC_CHECKLIST[doc.toLowerCase()];
      if (!nomesDocs) continue;

      for (const nomeDoc of nomesDocs) {
        if (tipo === "imovel") {
          const item = checklistItems.find(
            (c) => !c.parte_id && c.categoria === "imovel" &&
                   c.nome.toLowerCase() === nomeDoc.toLowerCase()
          );
          if (item && !idsParaMarcar.includes(item.id)) idsParaMarcar.push(item.id);
        } else {
          // Tenta casar pelo nome; fallback: primeira parte do tipo
          const nomeIA = (entry.nome ?? "").toUpperCase();
          const parte = partes.find(
            (p) => p.tipo === tipo && p.nome.toUpperCase() === nomeIA
          );
          if (!parte) continue;

          const item = checklistItems.find(
            (c) => c.parte_id === parte.id &&
                   c.nome.toLowerCase() === nomeDoc.toLowerCase()
          );
          if (item && !idsParaMarcar.includes(item.id)) idsParaMarcar.push(item.id);
        }
      }
    }
  }

  if (idsParaMarcar.length > 0) {
    await supabase
      .from("checklist_items")
      .update({ status: "enviado" })
      .in("id", idsParaMarcar);
  }
}

async function processEventos(eventos: Record<string, unknown>[]) {
  const supabase = createServiceClient();

  for (const evento of eventos) {
    const dealId = String(evento.objectId ?? evento.dealId ?? evento.hs_object_id ?? "");
    if (!dealId) continue;

    // Deleção: remove o processo e todos os dados associados
    if (evento.subscriptionType === "deal.deletion") {
      const { data: proc } = await supabase
        .from("processos")
        .select("id")
        .eq("hubspot_deal_id", dealId)
        .single();
      if (!proc) continue;
      const pid = proc.id;
      const { data: partes } = await supabase.from("partes").select("id").eq("processo_id", pid);
      const parteIds = (partes ?? []).map((p: { id: string }) => p.id);
      if (parteIds.length > 0) {
        await supabase.from("checklist_items").delete().in("parte_id", parteIds);
      }
      await supabase.from("checklist_items").delete().eq("processo_id", pid);
      await supabase.from("documentos").delete().eq("processo_id", pid);
      await supabase.from("tasks").delete().eq("processo_id", pid);
      await supabase.from("pendencias").delete().eq("processo_id", pid);
      await supabase.from("atividades").delete().eq("processo_id", pid);
      await supabase.from("partes").delete().eq("processo_id", pid);
      await supabase.from("processos").delete().eq("id", pid);
      continue;
    }

    // Busca os dados completos do deal no HubSpot
    const dealRes = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=dealname,dealstage,hubspot_owner_id,pv__prazo_entrega_doc,pv__prazo_assinatura,pv__prazo_instrumento,pv__prazo_registro,pv__e_mail_1,pv__e_mail_2,pv__e_mail_3,pv__e_mail_4,pv__e_mail_5,pv__e_mail_6,pv__e_mail_1___comprador,pv__e_mail_2___comprador,pv__e_mail_3___comprador,pv__e_mail_4___comprador,pv__e_mail_5___comprador,pv__e_mail_6___comprador,codigo_do_imovel,bairro,cidade,pv__observacoes_pos_vendas,pv_legal_center__hubspot_deal_id_comercial,anexo_ccv,ia_checklist_das_partes`,
      { headers: { Authorization: `Bearer ${process.env.HUBSPOT_API_TOKEN}` } }
    );

    if (!dealRes.ok) continue;
    const deal = await dealRes.json();
    const props = deal.properties as Record<string, string | null>;

    const stageId = props.dealstage ?? "";
    const status = STAGE_MAP[stageId];

    // Ignora deals fora do pipeline de pós-vendas
    if (!status) continue;

    const titulo = props.dealname ?? `Deal ${dealId}`;
    const endereco = [props.bairro, props.cidade].filter(Boolean).join(", ");
    const ccv_url = await resolverCcvUrl(props.anexo_ccv ?? null);

    // Busca nome do responsável no HubSpot
    let hubspot_owner_nome: string | null = null;
    const ownerId = props.hubspot_owner_id;
    if (ownerId) {
      const ownerRes = await fetch(
        `https://api.hubapi.com/crm/v3/owners/${ownerId}`,
        { headers: { Authorization: `Bearer ${process.env.HUBSPOT_API_TOKEN}` } }
      );
      if (ownerRes.ok) {
        const owner = await ownerRes.json();
        const parts = [owner.firstName, owner.lastName].filter(Boolean);
        hubspot_owner_nome = parts.length > 0 ? parts.join(" ") : (owner.email ?? null);
      }
    }

    // Verifica se o processo já existe
    const { data: existente } = await supabase
      .from("processos")
      .select("id")
      .eq("hubspot_deal_id", dealId)
      .single();

    let processoId: string;

    if (!existente) {
      // CRIA novo processo
      const { data: novo, error } = await supabase
        .from("processos")
        .insert({
          hubspot_deal_id: dealId,
          titulo,
          status,
          hubspot_stage_id: stageId,
          endereco_imovel: endereco || null,
          prazo_entrega_doc: props.pv__prazo_entrega_doc ?? null,
          prazo_assinatura: props.pv__prazo_assinatura ?? null,
          prazo_instrumento: props.pv__prazo_instrumento ?? null,
          prazo_registro: props.pv__prazo_registro ?? null,
          observacoes: props.pv__observacoes_pos_vendas ?? null,
          hubspot_owner_nome,
          hubspot_deal_id_comercial: props.pv_legal_center__hubspot_deal_id_comercial ?? null,
          ccv_url,
        })
        .select("id")
        .single();

      if (error || !novo) continue;
      processoId = novo.id;

      // Cria as partes
      const partesParaInserir: { processo_id: string; tipo: string; nome: string; email: string }[] = [];

      // Busca partes_da_transacao via deal do comercial (campo pv_legal_center__hubspot_deal_id_comercial)
      const dealIdComercial = props.pv_legal_center__hubspot_deal_id_comercial ?? dealId;
      const assocRes = await fetch(
        `https://api.hubapi.com/crm/v3/objects/deals/${dealIdComercial}/associations/2-57453831`,
        { headers: { Authorization: `Bearer ${process.env.HUBSPOT_API_TOKEN}` } }
      );

      if (assocRes.ok) {
        const assocData = await assocRes.json();
        const assocResults: { id: string; type: string }[] = assocData.results ?? [];

        // Monta mapa id → tipo pela associação tipada
        const tipoMap: Record<string, string> = {};
        for (const r of assocResults) {
          if (r.type.includes("compradora")) tipoMap[r.id] = "comprador";
          else if (r.type.includes("vendedora")) tipoMap[r.id] = "vendedor";
        }

        const parteIds = Object.keys(tipoMap);
        if (parteIds.length > 0) {
          const batchRes = await fetch(
            `https://api.hubapi.com/crm/v3/objects/2-57453831/batch/read`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_API_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                inputs: parteIds.map((id) => ({ id })),
                properties: ["nome", "email"],
              }),
            }
          );

          if (batchRes.ok) {
            const batchData = await batchRes.json();
            for (const parte of batchData.results ?? []) {
              const tipo = tipoMap[parte.id];
              if (!tipo) continue;
              const p = parte.properties as Record<string, string | null>;
              partesParaInserir.push({
                processo_id: processoId,
                tipo,
                nome: p.nome ?? "",
                email: p.email ?? "",
              });
            }
          }
        }
      }

      // Fallback: campos legados pv__e_mail_* (deals antigos sem partes_da_transacao)
      if (partesParaInserir.length === 0) {
        [1,2,3,4,5,6].forEach((i) => {
          const email = props[`pv__e_mail_${i}___comprador`];
          if (email) partesParaInserir.push({ processo_id: processoId, tipo: "comprador", nome: email.split("@")[0], email });
        });
        [1,2,3,4,5,6].forEach((i) => {
          const email = props[`pv__e_mail_${i}`];
          if (email) partesParaInserir.push({ processo_id: processoId, tipo: "vendedor", nome: email.split("@")[0], email });
        });
      }

      if (partesParaInserir.length > 0) {
        const { data: partesInseridas } = await supabase
          .from("partes")
          .insert(partesParaInserir)
          .select("id, tipo, nome");

        // Cria checklist a partir do template
        const { data: template } = await supabase
          .from("checklist_template")
          .select("*")
          .order("ordem");

        if (template && partesInseridas) {
          const compradores = partesInseridas.filter((p: { id: string; tipo: string }) => p.tipo === "comprador");
          const vendedores = partesInseridas.filter((p: { id: string; tipo: string }) => p.tipo === "vendedor");

          const checklistItems: object[] = [];
          for (const t of template) {
            if (t.categoria === "comprador") {
              compradores.forEach((p: { id: string; tipo: string }) => checklistItems.push({ processo_id: processoId, parte_id: p.id, categoria: t.categoria, nome: t.nome, obrigatorio: t.obrigatorio, ordem: t.ordem }));
            } else if (t.categoria === "vendedor") {
              vendedores.forEach((p: { id: string; tipo: string }) => checklistItems.push({ processo_id: processoId, parte_id: p.id, categoria: t.categoria, nome: t.nome, obrigatorio: t.obrigatorio, ordem: t.ordem }));
            } else {
              checklistItems.push({ processo_id: processoId, categoria: t.categoria, nome: t.nome, obrigatorio: t.obrigatorio, ordem: t.ordem });
            }
          }
          if (checklistItems.length > 0) {
            await supabase.from("checklist_items").insert(checklistItems);

            // Marca itens já encontrados pela IA do HubSpot
            if (props.ia_checklist_das_partes && partesInseridas) {
              await marcarDocsEncontrados(
                supabase,
                processoId,
                partesInseridas as ParteRow[],
                props.ia_checklist_das_partes
              );
            }
          }
        }
      }

    } else {
      // ATUALIZA processo existente
      processoId = existente.id;
      await supabase
        .from("processos")
        .update({
          titulo,
          status,
          hubspot_stage_id: stageId,
          endereco_imovel: endereco || null,
          prazo_entrega_doc: props.pv__prazo_entrega_doc ?? null,
          prazo_assinatura: props.pv__prazo_assinatura ?? null,
          prazo_instrumento: props.pv__prazo_instrumento ?? null,
          prazo_registro: props.pv__prazo_registro ?? null,
          observacoes: props.pv__observacoes_pos_vendas ?? null,
          hubspot_owner_nome,
          hubspot_deal_id_comercial: props.pv_legal_center__hubspot_deal_id_comercial ?? null,
          ...(ccv_url !== null ? { ccv_url } : {}),
        })
        .eq("id", processoId);
    }
  }

}

export async function POST(request: Request) {
  const body = await request.json();
  const eventos = Array.isArray(body) ? body : [body];

  // Retorna 200 imediatamente — processa em background para não dar timeout no HubSpot
  processEventos(eventos).catch(console.error);

  return NextResponse.json({ ok: true });
}
