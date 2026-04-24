import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const processoId = searchParams.get("processoId");
  if (!processoId) return NextResponse.json({ error: "processoId obrigatório" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, titulo, concluida, prazo, created_at, analista_id")
    .eq("processo_id", processoId)
    .order("concluida")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { processoId, titulo, prazo, analistaId } = await request.json();
  if (!processoId || !titulo?.trim()) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ processo_id: processoId, titulo: titulo.trim(), prazo: prazo ?? null, analista_id: analistaId ?? null })
    .select("id, titulo, concluida, prazo, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const { taskId, concluida } = await request.json();
  if (!taskId || typeof concluida !== "boolean") {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("tasks")
    .update({ concluida })
    .eq("id", taskId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId obrigatório" }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
