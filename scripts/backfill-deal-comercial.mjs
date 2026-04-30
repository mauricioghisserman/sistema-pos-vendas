/**
 * Backfill de hubspot_deal_id_comercial para todos os processos.
 * Uso: node scripts/backfill-deal-comercial.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env");
const envLines = readFileSync(envPath, "utf-8").split("\n");
for (const line of envLines) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const HUBSPOT_TOKEN = process.env.HUBSPOT_API_TOKEN;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, ""),
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "sistema_pos_vendas" } }
);

async function main() {
  const { data: processos } = await supabase
    .from("processos")
    .select("id, hubspot_deal_id, hubspot_deal_id_comercial")
    .is("hubspot_deal_id_comercial", null);

  if (!processos?.length) { console.log("Nada a fazer."); return; }
  console.log(`Processos sem deal_id_comercial: ${processos.length}`);

  let atualizados = 0;
  let semCampo = 0;

  for (const processo of processos) {
    const res = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/${processo.hubspot_deal_id}?properties=pv_legal_center__hubspot_deal_id_comercial`,
      { headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` } }
    );
    if (!res.ok) { semCampo++; continue; }
    const data = await res.json();
    const dealIdComercial = data.properties?.pv_legal_center__hubspot_deal_id_comercial ?? null;

    if (!dealIdComercial) { semCampo++; continue; }

    await supabase
      .from("processos")
      .update({ hubspot_deal_id_comercial: dealIdComercial })
      .eq("id", processo.id);

    atualizados++;
    if (atualizados % 50 === 0) console.log(`  ${atualizados} atualizados...`);
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\nConcluído: ${atualizados} atualizados, ${semCampo} sem o campo.`);
}

main().catch(console.error);
