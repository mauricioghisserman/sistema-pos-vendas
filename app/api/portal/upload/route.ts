import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const CLAUDE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);

async function analisarEAnexar({
  buffer, mimeType, fileName, itemId, documentoId, processoId, parteId,
}: {
  buffer: Buffer; mimeType: string; fileName: string;
  itemId: string; documentoId: string; processoId: string; parteId: string;
}) {
  const supabase = createServiceClient();

  const [{ data: item }, { data: processo }, { data: parte }] = await Promise.all([
    supabase.from("checklist_items").select("nome").eq("id", itemId).single(),
    supabase.from("processos").select("hubspot_deal_id").eq("id", processoId).single(),
    supabase.from("partes").select("nome, tipo").eq("id", parteId).single(),
  ]);

  const itemNome  = item?.nome ?? "documento";
  const dealId    = processo?.hubspot_deal_id;
  const parteNome = parte?.nome ?? "";
  const parteTipo = parte?.tipo ?? "";

  let iaValido: boolean | null = null;
  if (CLAUDE_MIME_TYPES.has(mimeType) && process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const base64 = buffer.toString("base64");
      const prompt = `Este documento foi enviado como "${itemNome}". Responda APENAS com JSON válido, sem markdown: {"valido": true} se o arquivo parece ser este tipo de documento, ou {"valido": false} se não parece.`;

      type ImageMedia = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

      const fileBlock: Anthropic.ContentBlockParam =
        mimeType === "application/pdf"
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
          : { type: "image", source: { type: "base64", media_type: mimeType as ImageMedia, data: base64 } };

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 64,
        messages: [{ role: "user", content: [fileBlock, { type: "text", text: prompt }] }],
      });

      const text = (response.content[0] as Anthropic.TextBlock).text.trim().replace(/```json\n?|\n?```/g, "").trim();
      iaValido = JSON.parse(text).valido === true;
    } catch (err) {
      console.error("[claude] erro na validação:", err);
    }
  }

  if (iaValido !== null) {
    await Promise.all([
      supabase.from("documentos").update({ ia_valido: iaValido }).eq("id", documentoId),
      supabase.from("checklist_items").update({ ia_valido: iaValido }).eq("id", itemId),
    ]);
  }

  if (!dealId || !process.env.HUBSPOT_API_TOKEN) return;

  let hubspotFileUrl: string | null = null;
  let hubspotFileId: string | null  = null;

  try {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);
    form.append("fileName", fileName);
    form.append("options", JSON.stringify({
      access: "PUBLIC_NOT_INDEXABLE",
      overwrite: false,
      duplicateValidationStrategy: "NONE",
      duplicateValidationScope: "ENTIRE_PORTAL",
    }));
    form.append("folderPath", "/pos-vendas");

    const res = await fetch("https://api.hubapi.com/files/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.HUBSPOT_API_TOKEN}` },
      body: form,
    });

    if (res.ok) {
      const fileData = await res.json();
      hubspotFileId  = fileData.id;
      hubspotFileUrl = fileData.url;
      await supabase.from("documentos").update({ hubspot_file_id: hubspotFileId }).eq("id", documentoId);
    }
  } catch { /* silently fail */ }

  try {
    const validacaoLabel = iaValido === true ? "✅ Validado pela IA" : iaValido === false ? "⚠️ IA sinalizou divergência" : "";
    const noteBody = [
      `📄 <strong>${itemNome}</strong> recebido de <strong>${parteNome}</strong> (${parteTipo})`,
      validacaoLabel ? `<br>${validacaoLabel}` : "",
      hubspotFileUrl ? `<br>🔗 <a href="${hubspotFileUrl}">${fileName}</a>` : `<br>Arquivo: ${fileName}`,
    ].join("");

    await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUBSPOT_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: { hs_note_body: noteBody, hs_timestamp: new Date().toISOString() },
        associations: [{
          to: { id: dealId },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 214 }],
        }],
      }),
    });
  } catch { /* silently fail */ }
}

export async function POST(request: Request) {
  const t0 = Date.now();
  const log = (msg: string) => console.log(`[upload] +${Date.now() - t0}ms ${msg}`);

  const { token, itemId, fileName, mimeType, fileSize, data } = await request.json();
  log(`recebido — fileName=${fileName} mimeType=${mimeType} fileSize=${fileSize}`);

  if (!token || !itemId || !fileName || !mimeType || !data) {
    log("dados incompletos");
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: parte } = await supabase
    .from("partes")
    .select("id, processo_id")
    .eq("token_acesso", token)
    .single();

  if (!parte) { log("token inválido"); return NextResponse.json({ error: "Token inválido" }, { status: 403 }); }
  log(`parte ok — id=${parte.id}`);

  const { data: item } = await supabase
    .from("checklist_items")
    .select("id, status")
    .eq("id", itemId)
    .eq("parte_id", parte.id)
    .single();

  if (!item) { log("item não encontrado"); return NextResponse.json({ error: "Item não encontrado" }, { status: 404 }); }
  if (item.status === "aprovado") { log("já aprovado"); return NextResponse.json({ error: "Documento já aprovado" }, { status: 400 }); }
  log(`item ok — status=${item.status}`);

  const buffer = Buffer.from(data, "base64");
  log(`buffer decodificado — ${buffer.byteLength} bytes`);

  const ext = fileName.split(".").pop() ?? "bin";
  const storagePath = `${parte.processo_id}/${parte.id}/${itemId}/${Date.now()}.${ext}`;
  log(`enviando para storage — path=${storagePath}`);

  const { error: uploadError } = await supabase.storage
    .from("documentos")
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

  if (uploadError) { log(`storage error: ${uploadError.message}`); return NextResponse.json({ error: uploadError.message }, { status: 500 }); }
  log("storage ok");

  const { data: doc } = await supabase.from("documentos").insert({
    checklist_item_id: itemId,
    storage_path: storagePath,
    nome_arquivo: fileName,
    tamanho_bytes: fileSize ?? buffer.byteLength,
    mime_type: mimeType,
    enviado_por_parte: parte.id,
  }).select("id").single();

  await supabase
    .from("checklist_items")
    .update({ status: "enviado", motivo_reprovacao: null, ia_valido: null })
    .eq("id", itemId);

  log(`db ok — doc.id=${doc?.id}`);

  if (doc?.id) {
    analisarEAnexar({
      buffer,
      mimeType,
      fileName,
      itemId,
      documentoId: doc.id,
      processoId: parte.processo_id,
      parteId: parte.id,
    }).catch(console.error);
  }

  log("respondendo ok");
  return NextResponse.json({ ok: true });
}
