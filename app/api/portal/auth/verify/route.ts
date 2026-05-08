import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  const { magicToken } = await request.json();
  if (!magicToken) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: parte } = await supabase
    .from("partes")
    .select("id, processo_id, magic_link_expires_at")
    .eq("magic_link_token", magicToken)
    .single();

  if (!parte) {
    return NextResponse.json({ error: "Link inválido ou já utilizado" }, { status: 404 });
  }

  if (new Date(parte.magic_link_expires_at) < new Date()) {
    return NextResponse.json({ error: "Link expirado. Solicite um novo acesso." }, { status: 410 });
  }

  // Gera session token permanente e limpa o magic link
  const sessionToken = randomUUID();
  await supabase
    .from("partes")
    .update({ session_token: sessionToken, magic_link_token: null, magic_link_expires_at: null })
    .eq("id", parte.id);

  // Busca token_portal do processo
  const { data: processo } = await supabase
    .from("processos")
    .select("token_portal")
    .eq("id", parte.processo_id)
    .single();

  return NextResponse.json({
    sessionToken,
    processoToken: processo?.token_portal,
  });
}
