// Busca todas as propriedades de deals no HubSpot
// Uso: node scripts/hubspot_fields.js

const fs = require("fs");
const path = require("path");

// Lê o .env manualmente (sem dependências)
const envPath = path.join(__dirname, "../.env");
const env = fs.readFileSync(envPath, "utf8");
const token = env.match(/HUBSPOT_API_TOKEN=(.+)/)?.[1]?.trim();

if (!token) {
  console.error("HUBSPOT_API_TOKEN não encontrado no .env");
  process.exit(1);
}

async function fetchDealProperties() {
  const res = await fetch(
    "https://api.hubapi.com/crm/v3/properties/deals?limit=500",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    console.error("Erro:", res.status, await res.text());
    process.exit(1);
  }

  const data = await res.json();
  const props = data.results;

  // Separa campos custom (criados pela Pilar) dos campos padrão do HubSpot
  const custom = props.filter((p) => !p.hubspotDefined);
  const standard = props.filter((p) => p.hubspotDefined);

  console.log("\n=== CAMPOS CUSTOMIZADOS (" + custom.length + ") ===");
  custom.forEach((p) => {
    console.log(`  ${p.name} (${p.fieldType}) — ${p.label}`);
  });

  console.log("\n=== CAMPOS PADRÃO (" + standard.length + ") ===");
  standard.forEach((p) => {
    console.log(`  ${p.name} (${p.fieldType}) — ${p.label}`);
  });
}

fetchDealProperties();
