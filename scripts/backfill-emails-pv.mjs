/**
 * Backfill de emails_pos_vendas para processos existentes.
 * Busca os campos pv__e_mail_* do deal de PV no HubSpot e salva no Supabase.
 *
 * Uso: node scripts/backfill-emails-pv.mjs
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

const EMAIL_PROPS = [
  ...[1,2,3,4,5,6].map((i) => `pv__e_mail_${i}`),
  ...[1,2,3,4,5,6].map((i) => `pv__e_mail_${i}___comprador`),
].join(",");

async function fetchEmailsPv(dealId) {
  const res = await fetch(
    `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=${EMAIL_PROPS}`,
    { headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const props = data.properties ?? {};

  const emails = [
    ...[1,2,3,4,5,6].map((i) => props[`pv__e_mail_${i}`]).filter(Boolean).map((email) => ({ email, tipo: "vendedor" })),
    ...[1,2,3,4,5,6].map((i) => props[`pv__e_mail_${i}___comprador`]).filter(Boolean).map((email) => ({ email, tipo: "comprador" })),
  ];
  return emails.length > 0 ? emails : null;
}

async function main() {
  let offset = 0;
  const PAGE = 100;
  let total = 0, atualizados = 0;

  while (true) {
    const { data: processos } = await supabase
      .from("processos")
      .select("id, hubspot_deal_id")
      .is("emails_pos_vendas", null)
      .not("hubspot_deal_id", "is", null)
      .range(offset, offset + PAGE - 1);

    if (!processos || processos.length === 0) break;
    total += processos.length;

    for (const p of processos) {
      const emails = await fetchEmailsPv(p.hubspot_deal_id);
      if (emails) {
        await supabase.from("processos").update({ emails_pos_vendas: emails }).eq("id", p.id);
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
