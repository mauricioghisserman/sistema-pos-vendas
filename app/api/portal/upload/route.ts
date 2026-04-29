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

  // 1. Validação Claude — retorna true/false se o arquivo corresponde ao tipo esperado
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
      iaValido = null;
    }
  }

  if (iaValido !== null) {
    await Promise.all([
      supabase.from("documentos").update({ ia_valido: iaValido }).eq("id", documentoId),
      supabase.from("checklist_items").update({ ia_valido: iaValido }).eq("id", itemId),
    ]);
  }

  if (!dealId || !process.env.HUBSPOT_API_TOKEN) return;

  // 2. Upload para HubSpot Files
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

  // 3. Cria nota no deal
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
        properties: {
          hs_note_body: noteBody,
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          {
            to: { id: dealId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 214 }],
          },
        ],
      }),
    });
  } catch { /* silently fail */ }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const token  = formData.get("token") as string;
  const itemId = formData.get("itemId") as string;
  const file   = formData.get("file") as File;

  if (!token || !itemId || !file) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: parte } = await supabase
    .from("partes")
    .select("id, processo_id")
    .eq("token_acesso", token)
    .single();

  if (!parte) return NextResponse.json({ error: "Token inválido" }, { status: 403 });

  const { data: item } = await supabase
    .from("checklist_items")
    .select("id, status")
    .eq("id", itemId)
    .eq("parte_id", parte.id)
    .single();

  if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  if (item.status === "aprovado") return NextResponse.json({ error: "Documento já aprovado" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `${parte.processo_id}/${parte.id}/${itemId}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("documentos")
    .upload(storagePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: doc } = await supabase.from("documentos").insert({
    checklist_item_id: itemId,
    storage_path: storagePath,
    nome_arquivo: file.name,
    tamanho_bytes: file.size,
    mime_type: file.type,
    enviado_por_parte: parte.id,
  }).select("id").single();

  await supabase
    .from("checklist_items")
    .update({ status: "enviado", motivo_reprovacao: null })
    .eq("id", itemId);

  // Análise Gemini + anexo HubSpot em background
  if (doc?.id) {
    analisarEAnexar({
      buffer,
      mimeType: file.type,
      fileName: file.name,
      itemId,
      documentoId: doc.id,
      processoId: parte.processo_id,
      parteId: parte.id,
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true, storagePath });
}
