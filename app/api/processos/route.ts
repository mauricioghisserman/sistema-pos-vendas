import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const LIMIT = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "";
  const page   = parseInt(searchParams.get("page") ?? "0");
  const search = (searchParams.get("search") ?? "").trim();
  const owner  = (searchParams.get("owner") ?? "").trim();

  const supabase = createServiceClient();

  let query = supabase
    .from("processos")
    .select("id, titulo, status, prazo_entrega_doc, prazo_instrumento, hubspot_deal_id, hubspot_owner_nome, analistas(nome, email)")
    .order("created_at", { ascending: false })
    .range(page * LIMIT, (page + 1) * LIMIT - 1);

  if (status) query = query.eq("status", status);
  if (search) query = query.ilike("titulo", `%${search}%`);
  if (owner)  query = query.eq("hubspot_owner_nome", owner);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map((p: { analistas: unknown; [key: string]: unknown }) => ({
    ...p,
    analistas: Array.isArray(p.analistas) ? (p.analistas[0] ?? null) : p.analistas,
  }));

  return NextResponse.json({ data: items, hasMore: items.length === LIMIT, page });
}
