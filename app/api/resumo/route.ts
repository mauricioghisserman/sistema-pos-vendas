import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const HUBSPOT_TOKEN = process.env.HUBSPOT_API_TOKEN!;
const GEMINI_KEY    = process.env.GEMINI_API_KEY!;

async function hubspotGet(path: string) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function getDeal(dealId: string, properties: string[]) {
  return hubspotGet(`/crm/v3/objects/deals/${dealId}?properties=${properties.join(",")}`);
}

async function getTickets(dealId: string) {
  const assoc = await hubspotGet(
    `/crm/v4/objects/deals/${dealId}/associations/tickets?limit=10`
  );
  const ids: string[] = (assoc?.results ?? []).map((r: { toObjectId: string }) => String(r.toObjectId));
  if (!ids.length) return [];

  const batch = await fetch("https://api.hubapi.com/crm/v3/objects/tickets/batch/read", {
    method: "POST",
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: ["subject", "content", "hs_pipeline_stage", "hs_ticket_priority"],
      inputs: ids.map((id) => ({ id })),
    }),
  });
  if (!batch.ok) return [];
  const json = await batch.json();
  return json.results ?? [];
}

function fmt(val: string | null | undefined) {
  return val?.trim() || "—";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const processoId = searchParams.get("processoId");
  if (!processoId) return NextResponse.json({ error: "processoId obrigatório" }, { status: 400 });

  const supabase = createServiceClient();

  // 1. Dados do Supabase
  const [{ data: processo }, { data: partes }, { data: checklist }] = await Promise.all([
    supabase
      .from("processos")
      .select("titulo, status, hubspot_deal_id, prazo_entrega_doc, prazo_instrumento, observacoes, analistas(nome)")
      .eq("id", processoId)
      .single(),
    supabase.from("partes").select("tipo, nome, email").eq("processo_id", processoId),
    supabase.from("checklist_items").select("nome, status, categoria, parte_id").eq("processo_id", processoId),
  ]);

  if (!processo) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });

  const dealId = processo.hubspot_deal_id;

  // 2. HubSpot — deal PV
  const pvDeal = await getDeal(dealId, [
    "dealname", "dealstage", "pv__prazo_entrega_doc", "pv__prazo_instrumento",
    "pv__observacoes_pos_vendas", "hubspot_owner_id",
    "pv_legal_center__hubspot_deal_id_comercial",
  ]);

  // 3. HubSpot — deal comercial
  const comercialId = pvDeal?.properties?.pv_legal_center__hubspot_deal_id_comercial;
  const [comercialDeal, tickets] = await Promise.all([
    comercialId ? getDeal(comercialId, ["dealname", "dealstage", "amount", "closedate"]) : Promise.resolve(null),
    comercialId ? getTickets(comercialId) : Promise.resolve([]),
  ]);

  // 4. Monta contexto para o Gemini
  const analista = Array.isArray(processo.analistas)
    ? (processo.analistas[0] as { nome: string } | null)
    : (processo.analistas as { nome: string } | null);

  const checklistResumo = (checklist ?? []).map((i: { nome: string; status: string }) =>
    `  - ${i.nome} [${i.status}]`
  ).join("\n");

  const partesResumo = (partes ?? []).map((p: { tipo: string; nome: string; email: string }) =>
    `  - ${p.tipo}: ${fmt(p.nome)} (${fmt(p.email)})`
  ).join("\n");

  const ticketsResumo = tickets.length
    ? tickets.map((t: { properties: Record<string, string> }) =>
        `  - ${fmt(t.properties.subject)}: ${fmt(t.properties.content?.slice(0, 200))}`
      ).join("\n")
    : "  Nenhum ticket encontrado.";

  const contexto = `
# Processo Pós-Vendas: ${processo.titulo}
Status: ${processo.status}
Analista responsável: ${fmt(analista?.nome)}
Prazo entrega de docs: ${fmt(processo.prazo_entrega_doc)}
Prazo instrumento: ${fmt(processo.prazo_instrumento)}
Observações: ${fmt(processo.observacoes)}

## Partes envolvidas
${partesResumo || "  Nenhuma parte cadastrada."}

## Checklist de documentos
${checklistResumo || "  Nenhum item."}

## Deal Comercial (HubSpot)
Nome: ${fmt(comercialDeal?.properties?.dealname)}
Valor: ${fmt(comercialDeal?.properties?.amount)}
Fechamento previsto: ${fmt(comercialDeal?.properties?.closedate)}

## Tickets Legal Ops (HubSpot)
${ticketsResumo}
`.trim();

  // 5. Chama Gemini (com 1 retry em caso de 429)
  async function callGemini(prompt: string, attempt = 0): Promise<string> {
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      if (attempt === 0 && String(err).includes("429")) {
        await new Promise((r) => setTimeout(r, 5000));
        return callGemini(prompt, 1);
      }
      throw err;
    }
  }

  try {
    const prompt = `Você é um assistente interno do time de pós-vendas da Pilar.

Contexto da empresa:
A Pilar presta serviços jurídicos e de pós-vendas para corretores imobiliários. O fluxo de uma transação funciona assim:
1. O corretor fecha uma venda e o time comercial da Pilar recebe a proposta.
2. O time jurídico faz a due diligence e elabora o contrato (CCV).
3. Após a assinatura do CCV, o time de pós-vendas é acionado.
4. O pós-vendas coleta toda a documentação de compradores, vendedores e do imóvel, acompanha os prazos e cuida de tudo até a assinatura da escritura definitiva.

Os dados abaixo representam o estado atual de um processo de pós-vendas. Com base neles, gere um resumo executivo em português do Brasil para o analista responsável entender rapidamente o que está acontecendo e o que precisa de atenção.

O resumo deve cobrir:
1. Situação da documentação (checklist): o que já foi aprovado, o que está pendente, o que foi reprovado
2. Prazos: quais estão próximos ou em atraso
3. Histórico jurídico: o que o time jurídico fez nessa transação (com base nos tickets)
4. Próximos passos prioritários

Use bullet points. Seja direto e prático. Máximo 250 palavras.

---
${contexto}`;

    const texto = await callGemini(prompt);
    return NextResponse.json({ resumo: texto, contexto });
  } catch (err) {
    const msg = String(err).includes("429")
      ? "Limite de requisições atingido. Aguarde 1 minuto e tente novamente."
      : err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
