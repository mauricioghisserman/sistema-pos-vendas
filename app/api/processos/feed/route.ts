import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TOKEN = process.env.HUBSPOT_API_TOKEN;

export type FeedItem = {
  id: string;
  tipo: string;
  corpo: string | null;
  autorNome: string | null;
  timestamp: number;
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function resolveOwners(ids: number[]): Promise<Record<number, string>> {
  const unique = [...new Set(ids)];
  const entries = await Promise.all(
    unique.map(async (id) => {
      const res = await fetch(`https://api.hubapi.com/crm/v3/owners/${id}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (!res.ok) return [id, null] as const;
      const d = await res.json();
      const parts = [d.firstName, d.lastName].filter(Boolean);
      const name = parts.length > 0 ? parts.join(" ") : (d.email ?? null);
      return [id, name] as const;
    })
  );
  return Object.fromEntries(entries.filter(([, v]) => v !== null)) as Record<number, string>;
}

async function getEngagements(objectType: "deal" | "ticket", objectId: string): Promise<FeedItem[]> {
  const res = await fetch(
    `https://api.hubapi.com/engagements/v1/engagements/associated/${objectType}/${objectId}/paged?limit=50`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const results: { engagement: { id: number; type: string; timestamp: number; createdBy: number }; metadata: Record<string, string> }[] = data.results ?? [];

  const ownerIds = results.map((r) => r.engagement.createdBy).filter(Boolean);
  const ownerMap = await resolveOwners(ownerIds);

  return results
    .filter((r) => ["NOTE", "EMAIL", "CALL", "MEETING"].includes(r.engagement.type))
    .map((r) => ({
      id: String(r.engagement.id),
      tipo: r.engagement.type,
      corpo: r.metadata.body
        ? stripHtml(r.metadata.body)
        : (r.metadata.subject ?? r.metadata.text ?? null),
      autorNome: ownerMap[r.engagement.createdBy] ?? null,
      timestamp: r.engagement.timestamp,
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("processoId") ?? "";
  const source = searchParams.get("source") ?? "pv";
  if (!id) return NextResponse.json({ itens: [] });

  const supabase = createServiceClient();
  const { data: processo } = await supabase
    .from("processos")
    .select("hubspot_deal_id, hubspot_deal_id_comercial")
    .eq("id", id)
    .single();

  if (!processo) return NextResponse.json({ itens: [] });

  if (source === "pv") {
    const itens = await getEngagements("deal", processo.hubspot_deal_id);
    return NextResponse.json({ itens });
  }

  if (source === "comercial") {
    if (!processo.hubspot_deal_id_comercial) return NextResponse.json({ itens: [], semVinculo: true });
    const itens = await getEngagements("deal", processo.hubspot_deal_id_comercial);
    return NextResponse.json({ itens });
  }

  if (source === "dd") {
    if (!processo.hubspot_deal_id_comercial) return NextResponse.json({ itens: [], semVinculo: true });
    const ticketRes = await fetch("https://api.hubapi.com/crm/v3/objects/tickets/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "legal_center__hubspot_deal_id_dd", operator: "EQ", value: processo.hubspot_deal_id_comercial }] }],
        properties: ["subject"],
        limit: 1,
      }),
    });
    if (!ticketRes.ok) return NextResponse.json({ itens: [] });
    const ticketData = await ticketRes.json();
    const ticket = ticketData.results?.[0];
    if (!ticket) return NextResponse.json({ itens: [], semVinculo: true });

    const itens = await getEngagements("ticket", ticket.id);
    return NextResponse.json({ itens, ticketId: ticket.id, ticketTitulo: ticket.properties?.subject ?? null });
  }

  return NextResponse.json({ itens: [] });
}
