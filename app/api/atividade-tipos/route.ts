import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("atividade_tipos")
    .select("id, nome")
    .order("nome");
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { nome } = await request.json();
  if (!nome?.trim()) return NextResponse.json({ error: "nome obrigatório" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("atividade_tipos")
    .insert({ nome: nome.trim(), criado_por: user.email })
    .select("id, nome")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
