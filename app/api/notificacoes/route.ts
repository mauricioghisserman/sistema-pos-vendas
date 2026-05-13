import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const [supabase, authClient] = [createServiceClient(), await createClient()];
  const { data: { user } } = await authClient.auth.getUser();
  const email = user?.email ?? "";

  // Busca notificações lidas pelo analista atual
  const { data: lidasData } = email
    ? await supabase.from("notificacoes_lidas").select("tipo, ref_id").eq("analista_email", email)
    : { data: [] };
  const lidasSet = new Set((lidasData ?? []).map((l: { tipo: string; ref_id: string }) => `${l.tipo}:${l.ref_id}`));

  // Busca pendências respondidas e checklist items enviados em paralelo
  const [{ data: pendencias }, { data: itens }] = await Promise.all([
    supabase
      .from("pendencias")
      .select("id, titulo, tipo, processo_id, parte_id, created_at")
      .eq("status", "respondida")
      .order("created_at", { ascending: false }),
    supabase
      .from("checklist_items")
      .select("id, nome, processo_id, parte_id, updated_at")
      .eq("status", "enviado")
      .order("updated_at", { ascending: false }),
  ]);

  const allProcessoIds = [
    ...new Set([
      ...(pendencias ?? []).map((p: { processo_id: string }) => p.processo_id),
      ...(itens ?? []).map((i: { processo_id: string }) => i.processo_id),
    ]),
  ];

  const allParteIds = [
    ...new Set([
      ...(pendencias ?? []).map((p: { parte_id: string }) => p.parte_id).filter(Boolean),
      ...(itens ?? []).map((i: { parte_id: string }) => i.parte_id).filter(Boolean),
    ]),
  ];

  const [{ data: processos }, { data: partes }] = await Promise.all([
    allProcessoIds.length > 0
      ? supabase.from("processos").select("id, titulo").in("id", allProcessoIds)
      : Promise.resolve({ data: [] }),
    allParteIds.length > 0
      ? supabase.from("partes").select("id, nome, tipo").in("id", allParteIds)
      : Promise.resolve({ data: [] }),
  ]);

  const processoMap: Record<string, string> = {};
  for (const p of processos ?? []) processoMap[p.id] = p.titulo;

  const parteMap: Record<string, { nome: string; tipo: string }> = {};
  for (const p of partes ?? []) parteMap[p.id] = { nome: p.nome, tipo: p.tipo };

  const notifPendencias = (pendencias ?? []).map((p: { id: string; titulo: string; tipo: string; processo_id: string; parte_id: string; created_at: string }) => ({
    id: `pend_${p.id}`,
    refId: p.id,
    tipo: "pendencia_respondida" as const,
    titulo: p.titulo,
    subtipo: p.tipo,
    parteNome: parteMap[p.parte_id]?.nome ?? null,
    parteType: parteMap[p.parte_id]?.tipo ?? null,
    processoId: p.processo_id,
    processoTitulo: processoMap[p.processo_id] ?? "",
    at: p.created_at,
    lida: lidasSet.has(`pendencia_respondida:${p.id}`),
  }));

  const notifItens = (itens ?? []).map((i: { id: string; nome: string; processo_id: string; parte_id: string; updated_at: string }) => ({
    id: `item_${i.id}`,
    refId: i.id,
    tipo: "documento_enviado" as const,
    titulo: i.nome,
    subtipo: null,
    parteNome: i.parte_id ? (parteMap[i.parte_id]?.nome ?? null) : null,
    parteType: i.parte_id ? (parteMap[i.parte_id]?.tipo ?? null) : "imovel",
    processoId: i.processo_id,
    processoTitulo: processoMap[i.processo_id] ?? "",
    at: i.updated_at,
    lida: lidasSet.has(`documento_enviado:${i.id}`),
  }));

  const all = [...notifPendencias, ...notifItens]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const totalNaoLidas = all.filter((n) => !n.lida).length;

  return NextResponse.json({ total: totalNaoLidas, itens: all });
}
