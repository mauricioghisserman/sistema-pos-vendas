import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const HUBSPOT_CAMPO: Record<string, string> = {
  prazo_entrega_doc: "pv__prazo_entrega_doc",
  prazo_instrumento: "pv__prazo_instrumento",
};

export async function PATCH(request: Request) {
  const { processoId, campo, valor } = await request.json();

  if (!processoId || !campo || !valor || !HUBSPOT_CAMPO[campo]) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: processo, error } = await supabase
    .from("processos")
    .select("hubspot_deal_id")
    .eq("id", processoId)
    .single();

  if (error || !processo) {
    return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
  }

  // Atualiza Supabase
  await supabase
    .from("processos")
    .update({ [campo]: valor })
    .eq("id", processoId);

  // HubSpot espera timestamp em ms (meia-noite UTC)
  const ts = new Date(valor + "T00:00:00.000Z").getTime();

  await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${processo.hubspot_deal_id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.HUBSPOT_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: { [HUBSPOT_CAMPO[campo]]: ts } }),
  });

  return NextResponse.json({ ok: true, valor });
}
