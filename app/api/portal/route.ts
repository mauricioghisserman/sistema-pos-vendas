import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const LADO_COMPRADOR = new Set(["comprador", "advogado_comprador"]);
const LADO_VENDEDOR  = new Set(["vendedor", "advogado_vendedor"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const processoToken = searchParams.get("processo");
  const sessionToken  = searchParams.get("session");

  if (!processoToken || !sessionToken) {
    return NextResponse.json({ error: "Parâmetros obrigatórios" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Valida session
  const { data: parteSessao } = await supabase
    .from("partes")
    .select("id, tipo, nome, email, processo_id")
    .eq("session_token", sessionToken)
    .single();

  if (!parteSessao) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  // Valida que a sessão pertence ao processo correto
  const { data: processo } = await supabase
    .from("processos")
    .select("id, titulo, status, prazo_entrega_doc, token_portal")
    .eq("token_portal", processoToken)
    .eq("id", parteSessao.processo_id)
    .single();

  if (!processo) {
    return NextResponse.json({ error: "Link inválido" }, { status: 404 });
  }

  // Determina quais tipos de parte o usuário pode ver
  let tiposVisiveis: string[];
  if (LADO_COMPRADOR.has(parteSessao.tipo)) {
    tiposVisiveis = ["comprador", "advogado_comprador"];
  } else if (LADO_VENDEDOR.has(parteSessao.tipo)) {
    tiposVisiveis = ["vendedor", "advogado_vendedor"];
  } else {
    // corretor vê tudo em modo leitura
    tiposVisiveis = ["comprador", "advogado_comprador", "vendedor", "advogado_vendedor", "corretor"];
  }

  // Busca todas as partes visíveis do processo
  const { data: partes } = await supabase
    .from("partes")
    .select("id, tipo, nome")
    .eq("processo_id", processo.id)
    .in("tipo", tiposVisiveis)
    .order("tipo");

  const parteIds = (partes ?? []).map((p: { id: string }) => p.id);

  // Busca itens de checklist dessas partes + imóvel
  const { data: itensParte } = parteIds.length > 0
    ? await supabase
        .from("checklist_items")
        .select("id, parte_id, nome, status, obrigatorio, motivo_reprovacao, ordem")
        .eq("processo_id", processo.id)
        .in("parte_id", parteIds)
        .order("ordem")
    : { data: [] };

  const { data: itensImovel } = await supabase
    .from("checklist_items")
    .select("id, parte_id, nome, status, obrigatorio, motivo_reprovacao, ordem")
    .eq("processo_id", processo.id)
    .is("parte_id", null)
    .eq("categoria", "imovel")
    .order("ordem");

  const todosItens = [...(itensParte ?? []), ...(itensImovel ?? [])];
  const itemIds = todosItens.map((i: { id: string }) => i.id);

  // Último documento por item
  const { data: documentos } = itemIds.length > 0
    ? await supabase
        .from("documentos")
        .select("id, checklist_item_id, nome_arquivo, created_at")
        .in("checklist_item_id", itemIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const docByItem: Record<string, { id: string; nome_arquivo: string }> = {};
  for (const doc of documentos ?? []) {
    if (!docByItem[doc.checklist_item_id]) {
      docByItem[doc.checklist_item_id] = { id: doc.id, nome_arquivo: doc.nome_arquivo };
    }
  }

  // Determina se pode fazer upload (corretor não pode)
  const podeUpload = parteSessao.tipo !== "corretor";

  // Agrupa: um grupo por parte + um grupo para imóvel
  const TIPO_LABEL: Record<string, string> = {
    comprador: "Comprador", vendedor: "Vendedor", corretor: "Corretor",
    advogado_comprador: "Advogado comprador", advogado_vendedor: "Advogado vendedor",
  };

  const gruposParte = (partes ?? []).map((p: { id: string; tipo: string; nome: string }) => ({
    parteId: p.id,
    tipo: p.tipo,
    label: `${TIPO_LABEL[p.tipo] ?? p.tipo} — ${p.nome}`,
    ehProprio: p.id === parteSessao.id,
    itens: (itensParte ?? [])
      .filter((i: { parte_id: string }) => i.parte_id === p.id)
      .map((i: { id: string; [key: string]: unknown }) => ({ ...i, documento: docByItem[i.id] ?? null })),
  })).filter((g: { itens: unknown[] }) => g.itens.length > 0);

  const grupoImovel = (itensImovel ?? []).length > 0
    ? [{
        parteId: null,
        tipo: "imovel",
        label: "Imóvel",
        ehProprio: false,
        itens: (itensImovel ?? []).map((i: { id: string; [key: string]: unknown }) => ({
          ...i,
          documento: docByItem[i.id] ?? null,
        })),
      }]
    : [];

  // Busca pendências atribuídas à parte autenticada
  const { data: pendencias } = await supabase
    .from("pendencias")
    .select("id, tipo, titulo, descricao, status, resposta_texto, motivo_reprovacao, created_at")
    .eq("processo_id", processo.id)
    .eq("parte_id", parteSessao.id)
    .order("created_at", { ascending: false });

  // Busca arquivos das pendências
  const pendenciaIds = (pendencias ?? []).map((p: { id: string }) => p.id);
  const { data: pendenciaArquivos } = pendenciaIds.length > 0
    ? await supabase
        .from("pendencia_arquivos")
        .select("id, pendencia_id, nome_arquivo, storage_path")
        .in("pendencia_id", pendenciaIds)
    : { data: [] };

  const arquivosByPendencia: Record<string, { id: string; nome_arquivo: string }[]> = {};
  for (const a of pendenciaArquivos ?? []) {
    if (!arquivosByPendencia[a.pendencia_id]) arquivosByPendencia[a.pendencia_id] = [];
    arquivosByPendencia[a.pendencia_id].push({ id: a.id, nome_arquivo: a.nome_arquivo });
  }

  const pendenciasComArquivos = (pendencias ?? []).map((p: { id: string; [key: string]: unknown }) => ({
    ...p,
    arquivos: arquivosByPendencia[p.id] ?? [],
  }));

  return NextResponse.json({
    parte: { id: parteSessao.id, tipo: parteSessao.tipo, nome: parteSessao.nome },
    processo: { titulo: processo.titulo, prazo_entrega_doc: processo.prazo_entrega_doc },
    podeUpload,
    grupos: [...gruposParte, ...grupoImovel],
    pendencias: pendenciasComArquivos,
  });
}
