import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createServiceClient();

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 14);
  const maxStr = maxDate.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("processos")
    .select("id, titulo, status, prazo_entrega_doc, prazo_instrumento, hubspot_deal_id, hubspot_owner_nome")
    .or(`prazo_entrega_doc.lte.${maxStr},prazo_instrumento.lte.${maxStr}`)
    .not("status", "in", "(\"finalizado\",\"perdido\",\"sem_pos_vendas\")")
    .order("prazo_entrega_doc", { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
