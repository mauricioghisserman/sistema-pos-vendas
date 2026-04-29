import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { processoId, tipo, nome, email } = await request.json();

  if (!processoId || !tipo || !nome?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: parte, error } = await supabase
    .from("partes")
    .insert({ processo_id: processoId, tipo, nome: nome.trim(), email: email.trim() })
    .select("id, tipo, nome, email, token_acesso")
    .single();

  if (error || !parte) {
    return NextResponse.json({ error: "Erro ao criar parte" }, { status: 500 });
  }

  // Cria checklist a partir do template para comprador/vendedor
  if (tipo === "comprador" || tipo === "vendedor") {
    const { data: template } = await supabase
      .from("checklist_template")
      .select("*")
      .eq("categoria", tipo)
      .order("ordem");

    if (template && template.length > 0) {
      const items = template.map((t: { categoria: string; nome: string; obrigatorio: boolean; ordem: number }) => ({
        processo_id: processoId,
        parte_id: parte.id,
        categoria: t.categoria,
        nome: t.nome,
        obrigatorio: t.obrigatorio,
        ordem: t.ordem,
        status: "pendente",
      }));
      await supabase.from("checklist_items").insert(items);
    }
  }

  return NextResponse.json(parte);
}
