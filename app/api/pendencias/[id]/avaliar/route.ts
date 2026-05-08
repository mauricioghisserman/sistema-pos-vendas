import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status, motivo_reprovacao } = await request.json();

  if (!["aprovada", "reprovada"].includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pendencias")
    .update({ status, motivo_reprovacao: motivo_reprovacao || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
