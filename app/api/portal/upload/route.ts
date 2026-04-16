import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const token  = formData.get("token") as string;
  const itemId = formData.get("itemId") as string;
  const file   = formData.get("file") as File;

  if (!token || !itemId || !file) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Valida token e busca parte
  const { data: parte } = await supabase
    .from("partes")
    .select("id, processo_id")
    .eq("token_acesso", token)
    .single();

  if (!parte) return NextResponse.json({ error: "Token inválido" }, { status: 403 });

  // Valida que o item pertence a esta parte
  const { data: item } = await supabase
    .from("checklist_items")
    .select("id, status")
    .eq("id", itemId)
    .eq("parte_id", parte.id)
    .single();

  if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  // Não permite upload de item já aprovado
  if (item.status === "aprovado") {
    return NextResponse.json({ error: "Documento já aprovado" }, { status: 400 });
  }

  // Upload para o Supabase Storage
  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `${parte.processo_id}/${parte.id}/${itemId}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("documentos")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Registra o documento no banco
  await supabase.from("documentos").insert({
    checklist_item_id: itemId,
    storage_path: storagePath,
    nome_arquivo: file.name,
    tamanho_bytes: file.size,
    mime_type: file.type,
    enviado_por_parte: parte.id,
  });

  // Atualiza status do item para "enviado"
  await supabase
    .from("checklist_items")
    .update({ status: "enviado", motivo_reprovacao: null })
    .eq("id", itemId);

  return NextResponse.json({ ok: true, storagePath });
}
