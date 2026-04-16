// Testa conexão com o Supabase
// Uso: node scripts/test_supabase.js

const fs = require("fs");
const path = require("path");

const env = fs.readFileSync(path.join(__dirname, "../.env"), "utf8");
const get = (key) => env.match(new RegExp(`${key}=(.+)`))?.[1]?.trim();

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const key = get("NEXT_PUBLIC_SUPABASE_ANON_KEY");

const serviceKey = get("SUPABASE_SERVICE_ROLE_KEY");

async function test() {
  // Testa com service_role no endpoint de health
  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  console.log("Status:", res.status, res.statusText);
  if (res.ok) console.log("✓ Supabase conectado com sucesso");
  else console.log("✗ Erro:", await res.text());
}

test();
