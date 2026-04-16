/**
 * Backfill de hubspot_owner_nome para processos que ficaram null.
 * 1. Busca todos os owners ativos do HubSpot (1 chamada)
 * 2. Faz batch read dos deals (100 por vez)
 * 3. Atualiza somente os que têm owner ativo
 *
 * Uso: node scripts/backfill-owners.mjs
 */

import { createClient } from "@supabase/supabase-js";

const HUBSPOT_TOKEN = process.env.HUBSPOT_API_TOKEN;
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: "sistema_pos_vendas" },
});

async function fetchAllOwners() {
  const res = await fetch(
    "https://api.hubapi.com/crm/v3/owners?limit=500&includeArchived=true",
    { headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` } }
  );
  const data = await res.json();
  const map = new Map();
  for (const o of data.results ?? []) {
    const parts = [o.firstName, o.lastName].filter(Boolean);
    const nome = parts.length > 0 ? parts.join(" ") : (o.email ?? null);
    if (nome) map.set(o.id, nome);
  }
  return map;
}

async function batchReadDeals(ids) {
  const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals/batch/read", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: ["hubspot_owner_id"],
      inputs: ids.map((id) => ({ id })),
    }),
  });
  if (!res.ok) { console.error("Erro batch read:", res.status); return []; }
  const data = await res.json();
  return data.results ?? [];
}

async function main() {
  console.log("👥 Buscando owners ativos no HubSpot...");
  const ownerMap = await fetchAllOwners();
  console.log(`✅ ${ownerMap.size} owners encontrados.\n`);

  console.log("🔍 Buscando processos sem owner no banco...");
  const { data: processos, error } = await supabase
    .from("processos")
    .select("id, hubspot_deal_id")
    .is("hubspot_owner_nome", null);

  if (error) { console.error(error); process.exit(1); }
  console.log(`📦 ${processos.length} processos sem owner.\n`);

  const BATCH = 100;
  let updated = 0;
  let semOwner = 0;

  for (let i = 0; i < processos.length; i += BATCH) {
    const slice = processos.slice(i, i + BATCH);
    const ids   = slice.map((p) => p.hubspot_deal_id);

    console.log(`  Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(processos.length / BATCH)}...`);
    const deals = await batchReadDeals(ids);

    // Mapa: dealId → ownerNome
    const nomeByDealId = new Map();
    for (const deal of deals) {
      const ownerId = deal.properties?.hubspot_owner_id;
      const nome    = ownerId ? ownerMap.get(ownerId) : null;
      if (nome) nomeByDealId.set(String(deal.id), nome);
    }

    for (const processo of slice) {
      const nome = nomeByDealId.get(processo.hubspot_deal_id);
      if (!nome) { semOwner++; continue; }

      await supabase
        .from("processos")
        .update({ hubspot_owner_nome: nome })
        .eq("id", processo.id);

      updated++;
    }
  }

  console.log(`\n📊 Resultado:`);
  console.log(`   Atualizados:              ${updated}`);
  console.log(`   Owner removido/não existe: ${semOwner}`);
}

main().catch(console.error);
