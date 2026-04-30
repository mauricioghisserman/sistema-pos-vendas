import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const HUB = process.env.HUBSPOT_API_TOKEN;
const COMISSOES_OBJECT = "2-49253269";

async function hubspot(path: string) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    headers: { Authorization: `Bearer ${HUB}` },
  });
  return res.ok ? res.json() : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const processoId = searchParams.get("processoId");
  if (!processoId) return NextResponse.json([]);

  const supabase = createServiceClient();
  const { data: processo } = await supabase
    .from("processos")
    .select("hubspot_deal_id_comercial")
    .eq("id", processoId)
    .single();

  const dealIdComercial = processo?.hubspot_deal_id_comercial;
  if (!dealIdComercial) return NextResponse.json([]);

  // Busca IDs das comissões associadas ao deal comercial
  const assoc = await hubspot(`/crm/v3/objects/deals/${dealIdComercial}/associations/${COMISSOES_OBJECT}`);
  const comissaoIds = [...new Set<string>((assoc?.results ?? []).map((r: { id: string }) => r.id))];
  if (comissaoIds.length === 0) return NextResponse.json([]);

  // Batch fetch propriedades das comissões
  const batch = await fetch(`https://api.hubapi.com/crm/v3/objects/${COMISSOES_OBJECT}/batch/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${HUB}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      inputs: comissaoIds.map((id) => ({ id })),
      properties: ["corretor", "papel_do_corretor"],
    }),
  });
  if (!batch.ok) return NextResponse.json([]);
  const batchData = await batch.json();

  // Para cada comissão, busca a empresa associada em paralelo
  const result = await Promise.all(
    (batchData.results ?? []).map(async (c: { id: string; properties: Record<string, string | null> }) => {
      const compAssoc = await hubspot(`/crm/v3/objects/${COMISSOES_OBJECT}/${c.id}/associations/companies`);
      const companyId = compAssoc?.results?.[0]?.id ?? null;
      let imobiliaria: string | null = null;
      if (companyId) {
        const company = await hubspot(`/crm/v3/objects/companies/${companyId}?properties=name`);
        imobiliaria = company?.properties?.name ?? null;
      }
      return {
        corretor: c.properties.corretor ?? null,
        papel: c.properties.papel_do_corretor ?? null,
        imobiliaria,
      };
    })
  );

  return NextResponse.json(result);
}
