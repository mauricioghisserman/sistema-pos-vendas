import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST { tipo, refId } — marca uma notificação como lida
// POST { all: true, itens: [{tipo, refId}] } — marca todas como lidas
export async function POST(request: Request) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  const email = user?.email;
  if (!email) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await request.json();
  const supabase = createServiceClient();

  if (body.all && Array.isArray(body.itens)) {
    const rows = (body.itens as { tipo: string; refId: string }[]).map(({ tipo, refId }) => ({
      analista_email: email,
      tipo,
      ref_id: refId,
    }));
    if (rows.length > 0) {
      const { error } = await supabase.from("notificacoes_lidas").upsert(rows, { onConflict: "analista_email,tipo,ref_id" });
      if (error) console.error("[notificacoes/ler]", error.message);
    }
  } else {
    const { tipo, refId } = body as { tipo: string; refId: string };
    const { error } = await supabase.from("notificacoes_lidas").upsert(
      { analista_email: email, tipo, ref_id: refId },
      { onConflict: "analista_email,tipo,ref_id" }
    );
    if (error) console.error("[notificacoes/ler]", error.message);
  }

  return NextResponse.json({ ok: true });
}
