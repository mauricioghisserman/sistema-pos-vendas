import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TOKEN = process.env.HUBSPOT_API_TOKEN;

export async function PATCH(request: Request) {
  const { processoId, analistaEmail, analistaNome } = await request.json() as {
    processoId: string;
    analistaEmail: string | null;
    analistaNome: string | null;
  };

  const supabase = createServiceClient();
  const { data: processo } = await supabase
    .from("processos")
    .select("hubspot_deal_id")
    .eq("id", processoId)
    .single();

  if (!processo?.hubspot_deal_id) return NextResponse.json({ error: "processo não encontrado" }, { status: 404 });

  let hubspotOwnerId: string | null = null;

  if (analistaEmail) {
    const ownersRes = await fetch(
      `https://api.hubapi.com/crm/v3/owners?email=${encodeURIComponent(analistaEmail)}&limit=1`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    if (ownersRes.ok) {
      const ownersData = await ownersRes.json();
      hubspotOwnerId = ownersData.results?.[0]?.id ?? null;
    }
  }

  // Atualiza HubSpot
  await fetch(
    `https://api.hubapi.com/crm/v3/objects/deals/${processo.hubspot_deal_id}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties: { hubspot_owner_id: hubspotOwnerId ?? "" } }),
    }
  );

  // Atualiza Supabase
  await supabase
    .from("processos")
    .update({ hubspot_owner_nome: analistaNome ?? null })
    .eq("id", processoId);

  return NextResponse.json({ ok: true });
}
