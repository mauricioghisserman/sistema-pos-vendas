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

  const rawItems = (data ?? []).map((p: { analistas: unknown; [key: string]: unknown }) => ({
    ...p,
    analistas: Array.isArray(p.analistas) ? (p.analistas[0] ?? null) : p.analistas,
  }));

  // Fetch open task counts for these processos in one query
  const ids = rawItems.map((p: { id: string; [key: string]: unknown }) => p.id);
  let taskCountMap: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: taskRows } = await supabase
      .from("tasks")
      .select("processo_id")
      .in("processo_id", ids)
      .eq("concluida", false);
    for (const row of taskRows ?? []) {
      taskCountMap[row.processo_id] = (taskCountMap[row.processo_id] ?? 0) + 1;
    }
  }

  const items = rawItems.map((p: { id: string; [key: string]: unknown }) => ({ ...p, open_tasks_count: taskCountMap[p.id] ?? 0 }));

  return NextResponse.json({ data: items, hasMore: items.length === LIMIT, page });
}
