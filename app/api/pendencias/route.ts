import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { enviarEmailPendencia } from "@/lib/email";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const processoId = searchParams.get("processoId");
  if (!processoId) return NextResponse.json([], { status: 400 });

  const supabase = createServiceClient();
  const { data: pendencias } = await supabase
    .from("pendencias")
    .select("*")
    .eq("processo_id", processoId)
    .order("created_at", { ascending: false });

  if (!pendencias?.length) return NextResponse.json([]);

  // Enriquece com nome/tipo da parte
  const parteIds = [...new Set(pendencias.map((p: { parte_id: string }) => p.parte_id).filter(Boolean))];
  const { data: partes } = parteIds.length > 0
    ? await supabase.from("partes").select("id, nome, tipo").in("id", parteIds)
    : { data: [] };

  const parteMap: Record<string, { nome: string; tipo: string }> = {};
  for (const p of partes ?? []) parteMap[p.id] = { nome: p.nome, tipo: p.tipo };

  return NextResponse.json(pendencias.map((p: { parte_id: string; [key: string]: unknown }) => ({
    ...p,
    partes: parteMap[p.parte_id] ?? null,
  })));
}

export async function POST(request: Request) {
  const { processoId, parteId, tipo, titulo, descricao } = await request.json();
  if (!processoId || !parteId || !tipo || !titulo) {
    return NextResponse.json({ error: "Campos obrigatórios: processoId, parteId, tipo, titulo" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: pendencia, error } = await supabase
    .from("pendencias")
    .insert({ processo_id: processoId, parte_id: parteId, tipo, titulo, descricao: descricao || null })
    .select("*")
    .single();

  if (error || !pendencia) {
    console.error("[pendencias] erro ao criar:", error?.message, error?.code);
    return NextResponse.json({ error: "Erro ao criar pendência" }, { status: 500 });
  }

  // Busca parte e processo em paralelo para email
  const [{ data: parte }, { data: processo }] = await Promise.all([
    supabase.from("partes").select("nome, email, tipo").eq("id", parteId).single(),
    supabase.from("processos").select("titulo, token_portal").eq("id", processoId).single(),
  ]);

  if (processo?.token_portal && parte?.email) {
    enviarEmailPendencia({
      email: parte.email,
      nome: parte.nome,
      processoTitulo: processo.titulo,
      processoToken: processo.token_portal,
      pendenciaTitulo: titulo,
      pendenciaDescricao: descricao || null,
      tipo,
    }).catch(console.error);
  }

  // Retorna com dados da parte para o drawer
  return NextResponse.json({ ...pendencia, partes: parte ? { nome: parte.nome, tipo: parte.tipo } : null });
}
