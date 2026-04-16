/**
 * Sync completo HubSpot → Supabase
 * Busca todos os deals do pipeline de pós-vendas e cria/atualiza processos.
 * Uso: node scripts/sync-hubspot.mjs
 */

import { createClient } from "@supabase/supabase-js";

const HUBSPOT_TOKEN = process.env.HUBSPOT_API_TOKEN;
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIPELINE_ID   = "117996833";

const STAGE_MAP = {
  "209029533": "fechado_pelo_comercial",
  "209029534": "pos_vendas_iniciado",
  "209029535": "documentacao_pendente",
  "209029536": "instrumento_definitivo",
  "209394964": "finalizado",
  "1089645944": "sem_pos_vendas",
  "214273600": "perdido",
};

const PROPERTIES = [
  "dealname","dealstage","hubspot_owner_id",
  "pv__prazo_entrega_doc","pv__prazo_assinatura","pv__prazo_instrumento","pv__prazo_registro",
  "pv__e_mail_1","pv__e_mail_2","pv__e_mail_3","pv__e_mail_4","pv__e_mail_5","pv__e_mail_6",
  "pv__e_mail_1___comprador","pv__e_mail_2___comprador","pv__e_mail_3___comprador",
  "pv__e_mail_4___comprador","pv__e_mail_5___comprador","pv__e_mail_6___comprador",
  "codigo_do_imovel","bairro","cidade","pv__observacoes_pos_vendas",
];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: "sistema_pos_vendas" },
});

async function fetchAllDeals() {
  const deals = [];
  let after = undefined;

  while (true) {
    const body = {
      filterGroups: [{ filters: [{ propertyName: "pipeline", operator: "EQ", value: PIPELINE_ID }] }],
      properties: PROPERTIES,
      limit: 100,
      ...(after ? { after } : {}),
    };

    const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HUBSPOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("Erro ao buscar deals:", res.status, await res.text());
      break;
    }

    const data = await res.json();
    deals.push(...data.results);
    console.log(`  Buscados ${deals.length} deals...`);

    if (data.paging?.next?.after) {
      after = data.paging.next.after;
    } else {
      break;
    }
  }

  return deals;
}

async function fetchOwnerName(ownerId) {
  if (!ownerId) return null;
  const res = await fetch(`https://api.hubapi.com/crm/v3/owners/${ownerId}`, {
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
  });
  if (!res.ok) return null;
  const owner = await res.json();
  const parts = [owner.firstName, owner.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : (owner.email ?? null);
}

async function syncDeal(deal) {
  const props = deal.properties;
  const dealId = String(deal.id);
  const stageId = props.dealstage ?? "";
  const status = STAGE_MAP[stageId];

  if (!status) return { skip: true };

  const titulo  = props.dealname ?? `Deal ${dealId}`;
  const endereco = [props.bairro, props.cidade].filter(Boolean).join(", ");
  const hubspot_owner_nome = await fetchOwnerName(props.hubspot_owner_id);

  const { data: existente } = await supabase
    .from("processos")
    .select("id")
    .eq("hubspot_deal_id", dealId)
    .single();

  const payload = {
    titulo,
    status,
    hubspot_stage_id: stageId,
    endereco_imovel: endereco || null,
    prazo_entrega_doc:  props.pv__prazo_entrega_doc  ?? null,
    prazo_assinatura:   props.pv__prazo_assinatura   ?? null,
    prazo_instrumento:  props.pv__prazo_instrumento  ?? null,
    prazo_registro:     props.pv__prazo_registro     ?? null,
    observacoes:        props.pv__observacoes_pos_vendas ?? null,
    hubspot_owner_nome,
  };

  if (!existente) {
    const { data: novo, error } = await supabase
      .from("processos")
      .insert({ hubspot_deal_id: dealId, ...payload })
      .select("id")
      .single();

    if (error || !novo) {
      console.error(`  ❌ Erro ao criar processo para deal ${dealId}:`, error?.message);
      return { error: true };
    }

    const processoId = novo.id;

    // Partes
    const partes = [];
    [1,2,3,4,5,6].forEach((i) => {
      const email = props[`pv__e_mail_${i}___comprador`];
      if (email) partes.push({ processo_id: processoId, tipo: "comprador", nome: email.split("@")[0], email });
    });
    [1,2,3,4,5,6].forEach((i) => {
      const email = props[`pv__e_mail_${i}`];
      if (email) partes.push({ processo_id: processoId, tipo: "vendedor", nome: email.split("@")[0], email });
    });

    if (partes.length > 0) {
      const { data: partesInseridas } = await supabase.from("partes").insert(partes).select("id,tipo");

      const { data: template } = await supabase.from("checklist_template").select("*").order("ordem");

      if (template && partesInseridas) {
        const compradores = partesInseridas.filter((p) => p.tipo === "comprador");
        const vendedores  = partesInseridas.filter((p) => p.tipo === "vendedor");
        const items = [];
        for (const t of template) {
          if (t.categoria === "comprador") {
            compradores.forEach((p) => items.push({ processo_id: processoId, parte_id: p.id, categoria: t.categoria, nome: t.nome, obrigatorio: t.obrigatorio, ordem: t.ordem }));
          } else if (t.categoria === "vendedor") {
            vendedores.forEach((p) => items.push({ processo_id: processoId, parte_id: p.id, categoria: t.categoria, nome: t.nome, obrigatorio: t.obrigatorio, ordem: t.ordem }));
          } else {
            items.push({ processo_id: processoId, categoria: t.categoria, nome: t.nome, obrigatorio: t.obrigatorio, ordem: t.ordem });
          }
        }
        if (items.length > 0) await supabase.from("checklist_items").insert(items);
      }
    }

    return { created: true, titulo };
  } else {
    await supabase.from("processos").update(payload).eq("id", existente.id);
    return { updated: true, titulo };
  }
}

async function main() {
  console.log("🔄 Iniciando sync HubSpot → Supabase...\n");

  console.log("📦 Buscando deals no HubSpot...");
  const deals = await fetchAllDeals();
  console.log(`✅ ${deals.length} deals encontrados no pipeline.\n`);

  let created = 0, updated = 0, skipped = 0, errors = 0;

  for (const deal of deals) {
    const result = await syncDeal(deal);
    if (result.created)  { created++;  console.log(`  ✅ Criado:     ${result.titulo}`); }
    if (result.updated)  { updated++;  console.log(`  🔁 Atualizado: ${result.titulo}`); }
    if (result.skip)     { skipped++; }
    if (result.error)    { errors++; }
  }

  console.log(`\n📊 Resultado:`);
  console.log(`   Criados:     ${created}`);
  console.log(`   Atualizados: ${updated}`);
  console.log(`   Ignorados:   ${skipped} (fora do pipeline)`);
  console.log(`   Erros:       ${errors}`);
}

main().catch(console.error);
