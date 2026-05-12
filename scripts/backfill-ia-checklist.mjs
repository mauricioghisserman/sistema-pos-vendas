// Backfill: marca checklist items como "enviado" com base em ia_checklist_das_partes
// Roda apenas para processos com hubspot_deal_id_comercial preenchido
// Não sobrescreve itens já em "enviado" ou "aprovado"
// Uso: node scripts/backfill-ia-checklist.mjs

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

const DOC_CHECKLIST = {
  "cpf":                         ["CPF ou CNH"],
  "rg":                          ["RG"],
  "cnh":                         ["CPF ou CNH", "RG"],
  "comprovante de endereço":     ["Comprovante de Endereço"],
  "certidão de estado civil":    ["Comprovante de Estado Civil"],
  "comprovante de estado civil": ["Comprovante de Estado Civil"],
  "iptu":                        ["IPTU"],
  "matrícula":                   ["Matrícula do Imóvel"],
};

// Busca processos com deal comercial vinculado
const { data: processos, error } = await supabase
  .from("processos")
  .select("id, hubspot_deal_id_comercial")
  .not("hubspot_deal_id_comercial", "is", null);

if (error) { console.error("Erro:", error.message); process.exit(1); }
console.log(`${processos.length} processos com deal comercial vinculado\n`);

let processados = 0, semCampo = 0, erros = 0, totalMarcados = 0;

for (const processo of processos) {
  // Busca ia_checklist_das_partes do deal comercial
  const dealRes = await fetch(
    `https://api.hubapi.com/crm/v3/objects/deals/${processo.hubspot_deal_id_comercial}?properties=ia_checklist_das_partes`,
    { headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` } }
  );
  if (!dealRes.ok) { erros++; continue; }
  const deal = await dealRes.json();
  const raw = deal.properties?.ia_checklist_das_partes;

  if (!raw) { semCampo++; continue; }

  let iaChecklist;
  try { iaChecklist = JSON.parse(raw); } catch { erros++; continue; }

  // Busca partes e checklist do processo
  const [{ data: partes }, { data: checklistItems }] = await Promise.all([
    supabase.from("partes").select("id, tipo, nome").eq("processo_id", processo.id),
    supabase.from("checklist_items").select("id, nome, parte_id, categoria, status").eq("processo_id", processo.id),
  ]);

  if (!partes || !checklistItems) continue;

  const idsParaMarcar = [];

  for (const entry of iaChecklist) {
    const tipoKey = (entry.parte ?? "").toLowerCase();
    const tipo = tipoKey === "imóvel" || tipoKey === "imovel" ? "imovel"
               : tipoKey === "vendedor" ? "vendedor"
               : tipoKey === "comprador" ? "comprador"
               : null;
    if (!tipo) continue;

    for (const { doc } of entry.documentos ?? []) {
      const nomesDocs = DOC_CHECKLIST[doc.toLowerCase()];
      if (!nomesDocs) continue;

      for (const nomeDoc of nomesDocs) {
        if (tipo === "imovel") {
          const item = checklistItems.find(
            (c) => !c.parte_id && c.categoria === "imovel" &&
                   c.nome.toLowerCase() === nomeDoc.toLowerCase() &&
                   c.status === "pendente"
          );
          if (item && !idsParaMarcar.includes(item.id)) idsParaMarcar.push(item.id);
        } else {
          const nomeIA = (entry.nome ?? "").toUpperCase();
          const parte = partes.find(
            (p) => p.tipo === tipo && p.nome.toUpperCase() === nomeIA
          );
          if (!parte) continue;

          const item = checklistItems.find(
            (c) => c.parte_id === parte.id &&
                   c.nome.toLowerCase() === nomeDoc.toLowerCase() &&
                   c.status === "pendente"
          );
          if (item && !idsParaMarcar.includes(item.id)) idsParaMarcar.push(item.id);
        }
      }
    }
  }

  if (idsParaMarcar.length > 0) {
    await supabase.from("checklist_items").update({ status: "enviado" }).in("id", idsParaMarcar);
    totalMarcados += idsParaMarcar.length;
    console.log(`✓ ${processo.hubspot_deal_id_comercial} → ${idsParaMarcar.length} itens marcados`);
  }

  processados++;
}

console.log(`\nConcluído: ${processados} processados, ${totalMarcados} itens marcados, ${semCampo} sem ia_checklist_das_partes, ${erros} erros.`);
