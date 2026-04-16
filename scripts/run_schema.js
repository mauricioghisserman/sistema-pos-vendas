// Aplica o schema.sql no Supabase via Management API
// Uso: node scripts/run_schema.js

const fs = require("fs");
const path = require("path");

const env = fs.readFileSync(path.join(__dirname, "../.env"), "utf8");
const get = (key) => env.match(new RegExp(`${key}=(.+)`))?.[1]?.trim();

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = get("SUPABASE_SERVICE_ROLE_KEY");

// Extrai o project ref da URL (ex: wzdiqeauwqejsqikwgngj)
const projectRef = url.replace("https://", "").replace(".supabase.co", "");

const sql = fs.readFileSync(path.join(__dirname, "../supabase/schema.sql"), "utf8");

async function run() {
  console.log("Aplicando schema no projeto:", projectRef);

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const text = await res.text();

  if (res.ok) {
    console.log("✓ Schema aplicado com sucesso");
  } else {
    console.error("✗ Erro:", res.status, text);
  }
}

run();
