import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) return NextResponse.json({ error: "itemId obrigatório" }, { status: 400 });

  const supabase = createServiceClient();

  // Busca o documento mais recente deste item
  const { data: doc } = await supabase
    .from("documentos")
    .select("storage_path, nome_arquivo, gemini_analise")
    .eq("checklist_item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!doc) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });

  // Gera URL assinada com validade de 1 hora
  const { data: signed, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(doc.storage_path, 3600);

  if (error || !signed) return NextResponse.json({ error: "Erro ao gerar link" }, { status: 500 });

  return NextResponse.json({ url: signed.signedUrl, nome_arquivo: doc.nome_arquivo, gemini_analise: doc.gemini_analise ?? null });
}
