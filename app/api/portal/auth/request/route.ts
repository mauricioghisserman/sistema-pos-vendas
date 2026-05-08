import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { enviarMagicLink } from "@/lib/email";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  const { processoToken, email } = await request.json();
  if (!processoToken || !email) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Busca o processo pelo token
  const { data: processo } = await supabase
    .from("processos")
    .select("id, titulo, token_portal")
    .eq("token_portal", processoToken)
    .single();

  if (!processo) {
    return NextResponse.json({ error: "Link inválido" }, { status: 404 });
  }

  // Busca a primeira parte com esse email nesse processo
  const { data: parteRows } = await supabase
    .from("partes")
    .select("id, nome, email")
    .eq("processo_id", processo.id)
    .ilike("email", email.trim())
    .limit(1);

  const parte = parteRows?.[0] ?? null;
  if (!parte) {
    return NextResponse.json({ error: "Email não encontrado neste processo" }, { status: 404 });
  }

  // Gera magic link token com validade de 1 hora
  const magicToken = randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await supabase
    .from("partes")
    .update({ magic_link_token: magicToken, magic_link_expires_at: expiresAt })
    .eq("id", parte.id);

  // Envia email (não bloqueia resposta se falhar)
  enviarMagicLink({
    email: parte.email,
    nome: parte.nome,
    processoToken,
    magicToken,
  }).catch(console.error);

  return NextResponse.json({ ok: true });
}
