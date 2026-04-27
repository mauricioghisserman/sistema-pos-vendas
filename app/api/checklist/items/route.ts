import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { processoId, parteId, categoria, nome } = await request.json();

  if (!processoId || !categoria || !nome?.trim()) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: maxOrdemData } = await supabase
    .from("checklist_items")
    .select("ordem")
    .eq("processo_id", processoId)
    .order("ordem", { ascending: false })
    .limit(1)
    .single();

  const novaOrdem = (maxOrdemData?.ordem ?? 0) + 1;

  const { data, error } = await supabase
    .from("checklist_items")
    .insert({
      processo_id: processoId,
      parte_id: parteId ?? null,
      categoria,
      nome: nome.trim(),
      obrigatorio: false,
      ordem: novaOrdem,
      status: "pendente",
    })
    .select("id,nome,status,categoria,obrigatorio,motivo_reprovacao,ordem")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Erro ao criar item" }, { status: 500 });
  }

  return NextResponse.json(data);
}
