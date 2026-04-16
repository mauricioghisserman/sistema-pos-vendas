import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const VALID_STATUS = ["pendente", "enviado", "aprovado", "reprovado"];

export async function PATCH(request: Request) {
  const { itemId, status, motivo_reprovacao } = await request.json();

  if (!itemId || !status || !VALID_STATUS.includes(status)) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("checklist_items")
    .update({
      status,
      motivo_reprovacao: status === "reprovado" ? motivo_reprovacao : null,
    })
    .eq("id", itemId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
