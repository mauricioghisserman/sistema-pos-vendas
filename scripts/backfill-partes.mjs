/**
 * Backfill de partes via partes_da_transacao (objeto customizado HubSpot).
 * Roda apenas para processos que ainda não têm partes no Supabase.
 *
 * Uso: node scripts/backfill-partes.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Carrega .env manualmente
const envPath = resolve(process.cwd(), ".env");
const envLines = readFileSync(envPath, "utf-8").split("\n");
for (const line of envLines) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const HUBSPOT_TOKEN = process.env.HUBSPOT_API_TOKEN;
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PARTES_OBJECT = "2-57453831";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: "sistema_pos_vendas" },
});

async function fetchDealIdComercial(dealId) {
  const res = await fetch(
    `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=pv_legal_center__hubspot_deal_id_comercial`,
    { headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` } }
  );
  if (!res.ok) return { dealIdComercial: null };
  const data = await res.json();
  const dealIdComercial = data.properties?.pv_legal_center__hubspot_deal_id_comercial || null;
  return { dealIdComercial };
}

async function fetchPartesHubspot(dealId) {
  const { dealIdComercial } = await fetchDealIdComercial(dealId);
  const assocRes = await fetch(
    `https://api.hubapi.com/crm/v3/objects/deals/${dealIdComercial ?? dealId}/associations/${PARTES_OBJECT}`,
    { headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` } }
  );
  if (!assocRes.ok) return [];

  const assocData = await assocRes.json();
  const results = assocData.results ?? [];

  const tipoMap = {};
  for (const r of results) {
    if (r.type.includes("compradora")) tipoMap[r.id] = "comprador";
    else if (r.type.includes("vendedora")) tipoMap[r.id] = "vendedor";
  }

  const parteIds = Object.keys(tipoMap);
  if (parteIds.length === 0) return [];

  const batchRes = await fetch(
    `https://api.hubapi.com/crm/v3/objects/${PARTES_OBJECT}/batch/read`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HUBSPOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: parteIds.map((id) => ({ id })),
        properties: ["nome", "email"],
      }),
    }
  );
  if (!batchRes.ok) return [];

  const batchData = await batchRes.json();
  return (batchData.results ?? []).map((p) => ({
    tipo: tipoMap[p.id],
    nome: p.properties.nome ?? "",
    email: p.properties.email ?? "",
  })).filter((p) => p.tipo);
}

async function main() {
  // 1. Processos sem partes
  const { data: processos } = await supabase
    .from("processos")
    .select("id, hubspot_deal_id, titulo");

  if (!processos?.length) { console.log("Nenhum processo encontrado."); return; }

  const { data: partesExistentes } = await supabase
    .from("partes")
    .select("processo_id");

  const comPartes = new Set((partesExistentes ?? []).map((p) => p.processo_id));
  const semPartes = processos.filter((p) => !comPartes.has(p.id));

  console.log(`Total processos: ${processos.length} | Sem partes: ${semPartes.length}`);
  if (semPartes.length === 0) { console.log("Nada a fazer."); return; }

  // 2. Template do checklist
  const { data: template } = await supabase
    .from("checklist_template")
    .select("*")
    .order("ordem");

  let criados = 0;
  let semDados = 0;

  for (const processo of semPartes) {
    const partesHubspot = await fetchPartesHubspot(processo.hubspot_deal_id);

    if (partesHubspot.length === 0) {
      semDados++;
      continue;
    }

    const { data: partesInseridas } = await supabase
      .from("partes")
      .insert(partesHubspot.map((p) => ({ ...p, processo_id: processo.id })))
      .select("id, tipo");

    if (!partesInseridas?.length) continue;

    // Cria checklist
    if (template?.length) {
      const compradores = partesInseridas.filter((p) => p.tipo === "comprador");
      const vendedores  = partesInseridas.filter((p) => p.tipo === "vendedor");

      const items = [];
      for (const t of template) {
        if (t.categoria === "comprador") {
          compradores.forEach((p) => items.push({ processo_id: processo.id, parte_id: p.id, categoria: t.categoria, nome: t.nome, obrigatorio: t.obrigatorio, ordem: t.ordem }));
        } else if (t.categoria === "vendedor") {
          vendedores.forEach((p) => items.push({ processo_id: processo.id, parte_id: p.id, categoria: t.categoria, nome: t.nome, obrigatorio: t.obrigatorio, ordem: t.ordem }));
        } else {
          items.push({ processo_id: processo.id, categoria: t.categoria, nome: t.nome, obrigatorio: t.obrigatorio, ordem: t.ordem });
        }
      }
      if (items.length > 0) await supabase.from("checklist_items").insert(items);
    }

    console.log(`✓ ${processo.titulo} — ${partesInseridas.length} partes`);
    criados++;

    // Pausa para não sobrecarregar a API
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nConcluído: ${criados} processos atualizados, ${semDados} sem partes_da_transacao no HubSpot.`);
}

main().catch(console.error);
