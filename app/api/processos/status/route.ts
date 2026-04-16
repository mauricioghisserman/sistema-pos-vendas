import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { STAGES } from "@/app/(painel)/processos/page";

export async function PATCH(request: Request) {
  const { processoId, status } = await request.json();

  if (!processoId || !status) {
    return NextResponse.json({ error: "processoId e status são obrigatórios" }, { status: 400 });
  }

  const stage = STAGES.find((s) => s.key === status);
  if (!stage) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Busca o hubspot_deal_id
  const { data: processo, error } = await supabase
    .from("processos")
    .select("hubspot_deal_id")
    .eq("id", processoId)
    .single();

  if (error || !processo) {
    return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
  }

  // Atualiza no Supabase
  await supabase
    .from("processos")
    .update({ status, hubspot_stage_id: stage.hubspot_id })
    .eq("id", processoId);

  // Atualiza no HubSpot
  await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${processo.hubspot_deal_id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.HUBSPOT_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: { dealstage: stage.hubspot_id } }),
  });

  return NextResponse.json({ ok: true });
}
