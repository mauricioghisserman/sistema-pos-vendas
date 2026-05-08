import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sessionToken, respostaTexto, fileName, mimeType, fileSize, data } = await request.json();

  if (!sessionToken) return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });

  const supabase = createServiceClient();

  // Valida sessão
  const { data: parte } = await supabase
    .from("partes")
    .select("id, processo_id, tipo")
    .eq("session_token", sessionToken)
    .single();

  if (!parte || parte.tipo === "corretor") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Valida que a pendência pertence ao processo e à parte
  const { data: pendencia } = await supabase
    .from("pendencias")
    .select("id, status, tipo, parte_id")
    .eq("id", id)
    .eq("processo_id", parte.processo_id)
    .eq("parte_id", parte.id)
    .single();

  if (!pendencia) return NextResponse.json({ error: "Pendência não encontrada" }, { status: 404 });
  if (pendencia.status === "aprovada") return NextResponse.json({ error: "Pendência já aprovada" }, { status: 400 });

  // Atualiza resposta em texto (se houver)
  if (respostaTexto !== undefined) {
    const { error: updateError } = await supabase
      .from("pendencias")
      .update({ resposta_texto: respostaTexto, status: "respondida" })
      .eq("id", id);

    if (updateError) {
      console.error("[responder] erro ao atualizar pendência:", updateError.message, updateError.code);
      return NextResponse.json({ error: "Erro ao salvar resposta" }, { status: 500 });
    }
  }

  // Upload de arquivo (se houver)
  let arquivo = null;
  if (data && fileName && mimeType) {
    const buffer = Buffer.from(data, "base64");
    const ext = fileName.split(".").pop() ?? "bin";
    const storagePath = `pendencias/${parte.processo_id}/${id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error("[responder] erro ao fazer upload:", uploadError.message);
      return NextResponse.json({ error: "Erro ao enviar arquivo" }, { status: 500 });
    }

    const { data: arq, error: arqError } = await supabase
      .from("pendencia_arquivos")
      .insert({ pendencia_id: id, storage_path: storagePath, nome_arquivo: fileName, tamanho_bytes: fileSize ?? buffer.byteLength, mime_type: mimeType })
      .select("id, nome_arquivo, storage_path")
      .single();

    if (arqError) {
      console.error("[responder] erro ao salvar pendencia_arquivos:", arqError.message, arqError.code);
    }

    // Marca como respondida se ainda não estava
    const { error: statusError } = await supabase
      .from("pendencias")
      .update({ status: "respondida" })
      .eq("id", id);

    if (statusError) {
      console.error("[responder] erro ao atualizar status:", statusError.message, statusError.code);
    }

    arquivo = arq;
  }

  return NextResponse.json({ ok: true, arquivo });
}
