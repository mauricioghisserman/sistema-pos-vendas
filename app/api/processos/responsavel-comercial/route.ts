import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TOKEN = process.env.HUBSPOT_API_TOKEN;

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

  const dealRes = await fetch(
    `https://api.hubapi.com/crm/v3/objects/deals/${processo.hubspot_deal_id_comercial}?properties=hubspot_owner_id`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  if (!dealRes.ok) return NextResponse.json({ nome: null });

  const deal = await dealRes.json();
  const ownerId = deal.properties?.hubspot_owner_id;
  if (!ownerId) return NextResponse.json({ nome: null });

  const ownerRes = await fetch(
    `https://api.hubapi.com/crm/v3/owners/${ownerId}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  if (!ownerRes.ok) return NextResponse.json({ nome: null });

  const owner = await ownerRes.json();
  const parts = [owner.firstName, owner.lastName].filter(Boolean);
  const nome = parts.length > 0 ? parts.join(" ") : (owner.email ?? null);

  return NextResponse.json({ nome });
}
