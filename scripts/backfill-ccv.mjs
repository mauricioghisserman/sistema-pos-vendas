// Backfill ccv_url para processos existentes
// Uso: node scripts/backfill-ccv.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env");
const envLines = readFileSync(envPath, "utf-8").split("\n");
for (const line of envLines) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "sistema_pos_vendas" } }
);

const HUBSPOT_TOKEN = process.env.HUBSPOT_API_TOKEN;

async function resolverUrl(fileId) {
  const res = await fetch(`https://api.hubapi.com/files/v3/files/${fileId}`, {
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.url ?? null;
}

// Busca todos os processos com hubspot_deal_id e sem ccv_url
const { data: processos, error } = await supabase
  .from("processos")
  .select("id, hubspot_deal_id, ccv_url")
  .not("hubspot_deal_id", "is", null)
  .is("ccv_url", null);

if (error) { console.error("Erro ao buscar processos:", error.message); process.exit(1); }
console.log(`${processos.length} processos sem ccv_url`);

let atualizados = 0;
let semAnexo = 0;

for (const p of processos) {
  const dealRes = await fetch(
    `https://api.hubapi.com/crm/v3/objects/deals/${p.hubspot_deal_id}?properties=anexo_ccv`,
    { headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` } }
  );
  if (!dealRes.ok) continue;
  const deal = await dealRes.json();
  const fileId = deal.properties?.anexo_ccv;

  if (!fileId) { semAnexo++; continue; }

  const url = await resolverUrl(fileId);
  if (!url) continue;

  await supabase.from("processos").update({ ccv_url: url }).eq("id", p.id);
  atualizados++;
  console.log(`✓ ${p.hubspot_deal_id} → ${url.slice(0, 60)}...`);
}

console.log(`\nConcluído: ${atualizados} atualizados, ${semAnexo} sem anexo_ccv.`);
