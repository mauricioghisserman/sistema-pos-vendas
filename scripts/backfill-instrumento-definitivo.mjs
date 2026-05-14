/**
 * Backfill de instrumento_definitivo para processos existentes.
 * Busca pv__instrumento_definitivo do deal de PV no HubSpot e salva no Supabase.
 *
 * Uso: node scripts/backfill-instrumento-definitivo.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envLines = readFileSync(resolve(process.cwd(), ".env"), "utf-8").split("\n");
for (const line of envLines) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const HUBSPOT_TOKEN = process.env.HUBSPOT_API_TOKEN;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "sistema_pos_vendas" } }
);

async function main() {
  let offset = 0;
  const PAGE = 100;
  let total = 0, atualizados = 0;

  while (true) {
    const { data: processos } = await supabase
      .from("processos")
      .select("id, hubspot_deal_id")
      .is("instrumento_definitivo", null)
      .not("hubspot_deal_id", "is", null)
      .range(offset, offset + PAGE - 1);

    if (!processos || processos.length === 0) break;
    total += processos.length;

    for (const p of processos) {
      const res = await fetch(
        `https://api.hubapi.com/crm/v3/objects/deals/${p.hubspot_deal_id}?properties=pv__instrumento_definitivo`,
        { headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const valor = data.properties?.pv__instrumento_definitivo ?? null;
      if (valor) {
        await supabase.from("processos").update({ instrumento_definitivo: valor }).eq("id", p.id);
        atualizados++;
        process.stdout.write(`\r${atualizados} atualizados / ${total} processados`);
      }
    }

    if (processos.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`\nConcluído: ${atualizados} processos atualizados de ${total} verificados.`);
}

main().catch(console.error);
