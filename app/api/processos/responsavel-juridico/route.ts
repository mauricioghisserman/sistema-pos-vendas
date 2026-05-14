import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TOKEN = process.env.HUBSPOT_API_TOKEN;
const LEGALOPS_PIPELINE = "86871664";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const processoId = searchParams.get("processoId") ?? "";
  if (!processoId) return NextResponse.json({ nome: null });

  const supabase = createServiceClient();
  const { data: processo } = await supabase
    .from("processos")
    .select("hubspot_deal_id_comercial")
    .eq("id", processoId)
    .single();

  if (!processo?.hubspot_deal_id_comercial) return NextResponse.json({ nome: null });

  // Busca tickets associados ao deal comercial (onde ficam os tickets LegalOPS)
  const assocRes = await fetch(
    `https://api.hubapi.com/crm/v3/objects/deals/${processo.hubspot_deal_id_comercial}/associations/tickets`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  if (!assocRes.ok) return NextResponse.json({ nome: null });

  const assocData = await assocRes.json();
  const ticketIds: string[] = (assocData.results ?? []).map((r: { id: string }) => r.id);
  if (ticketIds.length === 0) return NextResponse.json({ nome: null });

  // Busca propriedades de cada ticket em paralelo
  const tickets = await Promise.all(
    ticketIds.map(async (id) => {
      const res = await fetch(
        `https://api.hubapi.com/crm/v3/objects/tickets/${id}?properties=hs_pipeline,hubspot_owner_id,legal_center__hubspot_deal_id_dd`,
        { headers: { Authorization: `Bearer ${TOKEN}` } }
      );
      if (!res.ok) return null;
      const d = await res.json();
      return { id, ...d.properties };
    })
  );

  // Ticket do "Elaborar contrato": LegalOPS pipeline + sem legal_center__hubspot_deal_id_dd
  const ticket = tickets.find(
    (t) => t && t.hs_pipeline === LEGALOPS_PIPELINE && !t.legal_center__hubspot_deal_id_dd
  );

  if (!ticket?.hubspot_owner_id) return NextResponse.json({ nome: null });

  const ownerRes = await fetch(
    `https://api.hubapi.com/crm/v3/owners/${ticket.hubspot_owner_id}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  if (!ownerRes.ok) return NextResponse.json({ nome: null });

  const owner = await ownerRes.json();
  const parts = [owner.firstName, owner.lastName].filter(Boolean);
  const nome = parts.length > 0 ? parts.join(" ") : (owner.email ?? null);

  return NextResponse.json({ nome });
}
