import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import KanbanBoard from "@/components/kanban-board";

export const STAGES = [
  { key: "fechado_pelo_comercial", label: "Fechado pelo comercial", hubspot_id: "209029533" },
  { key: "pos_vendas_iniciado",    label: "Pós-vendas iniciado",    hubspot_id: "209029534" },
  { key: "documentacao_pendente",  label: "Documentação pendente",  hubspot_id: "209029535" },
  { key: "instrumento_definitivo", label: "Instrumento Definitivo", hubspot_id: "209029536" },
  { key: "finalizado",             label: "Finalizado",             hubspot_id: "209394964" },
  { key: "sem_pos_vendas",         label: "Sem pós-vendas",         hubspot_id: "1089645944" },
  { key: "perdido",                label: "Perdido",                hubspot_id: "214273600" },
] as const;

export type Stage = typeof STAGES[number]["key"];

export type Processo = {
  id: string;
  titulo: string;
  status: Stage;
  prazo_entrega_doc: string | null;
  prazo_instrumento: string | null;
  hubspot_deal_id: string;
  hubspot_owner_nome: string | null;
  ccv_url: string | null;
  analistas: { nome: string; email: string } | null;
  open_tasks_count: number;
  docs_total: number;
  docs_aprovados: number;
};

export default async function ProcessosPage() {
  const supabase = await createClient();

  const [{ data: ownersData }, { data: { user } }] = await Promise.all([
    supabase.from("processos").select("hubspot_owner_nome").not("hubspot_owner_nome", "is", null),
    supabase.auth.getUser(),
  ]);

  const owners = [...new Set((ownersData ?? []).map((o) => o.hubspot_owner_nome as string))].sort();

  // Nome do analista logado para pré-filtrar os próprios processos
  let defaultOwner = "";
  if (user?.email) {
    const { data: analista } = await supabase
      .from("analistas")
      .select("nome")
      .eq("email", user.email)
      .single();
    defaultOwner = analista?.nome ?? "";
  }

  return (
    <div className="flex flex-col h-full">
      <Suspense>
        <KanbanBoard stages={STAGES} owners={owners} defaultOwner={defaultOwner} />
      </Suspense>
    </div>
  );
}
