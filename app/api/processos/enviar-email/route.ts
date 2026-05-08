import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { enviarEmailInicio } from "@/lib/email";

export async function POST(request: Request) {
  const { processoId } = await request.json();
  if (!processoId) return NextResponse.json({ error: "processoId obrigatório" }, { status: 400 });

  const supabase = createServiceClient();

  const { data: processo } = await supabase
    .from("processos")
    .select("id, titulo, prazo_entrega_doc, token_portal")
    .eq("id", processoId)
    .single();

  if (!processo) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
  if (!processo.token_portal) return NextResponse.json({ error: "Processo sem token_portal" }, { status: 500 });

  const { data: partes } = await supabase
    .from("partes")
    .select("id, nome, email, tipo")
    .eq("processo_id", processoId)
    .not("email", "is", null)
    .neq("email", "");

  if (!partes?.length) return NextResponse.json({ error: "Nenhuma parte com e-mail encontrada" }, { status: 400 });

  type ParteRow = { id: string; nome: string; email: string; tipo: string };

  // Envia apenas para compradores, vendedores e advogados (não para corretores)
  const partesComEmail = (partes as ParteRow[]).filter((p) => p.tipo !== "corretor");

  const resultados = await Promise.allSettled(
    partesComEmail.map((p) =>
      enviarEmailInicio({
        email: p.email,
        nome: p.nome,
        processoTitulo: processo.titulo,
        processoToken: processo.token_portal,
        prazo: processo.prazo_entrega_doc,
      })
    )
  );

  const enviados = resultados.filter((r) => r.status === "fulfilled").length;
  const falhas   = resultados.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ ok: true, enviados, falhas, total: partesComEmail.length });
}
