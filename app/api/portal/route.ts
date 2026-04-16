import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });

  const supabase = createServiceClient();

  // Busca a parte pelo token
  const { data: parte, error: parteError } = await supabase
    .from("partes")
    .select("id, tipo, nome, email, processo_id")
    .eq("token_acesso", token)
    .single();

  if (parteError || !parte) {
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
  }

  // Busca o processo
  const { data: processo } = await supabase
    .from("processos")
    .select("id, titulo, status, prazo_entrega_doc")
    .eq("id", parte.processo_id)
    .single();

  // Busca os itens do checklist desta parte
  const { data: itens } = await supabase
    .from("checklist_items")
    .select("id, nome, status, obrigatorio, motivo_reprovacao, ordem")
    .eq("processo_id", parte.processo_id)
    .eq("parte_id", parte.id)
    .order("ordem");

  // Busca o documento mais recente de cada item
  const itemIds = (itens ?? []).map((i: { id: string }) => i.id);
  const { data: documentos } = itemIds.length > 0
    ? await supabase
        .from("documentos")
        .select("id, checklist_item_id, nome_arquivo, created_at")
        .in("checklist_item_id", itemIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Agrupa último documento por item
  const docByItem: Record<string, { id: string; nome_arquivo: string }> = {};
  for (const doc of documentos ?? []) {
    if (!docByItem[doc.checklist_item_id]) {
      docByItem[doc.checklist_item_id] = { id: doc.id, nome_arquivo: doc.nome_arquivo };
    }
  }

  return NextResponse.json({
    parte: { id: parte.id, tipo: parte.tipo, nome: parte.nome },
    processo: { titulo: processo?.titulo, prazo_entrega_doc: processo?.prazo_entrega_doc },
    itens: (itens ?? []).map((item: { id: string; [key: string]: unknown }) => ({
      ...item,
      documento: docByItem[item.id] ?? null,
    })),
  });
}
