-- ============================================================
-- Sistema Pós Vendas — Pilar
-- Schema: sistema_pos_vendas
-- ============================================================

create extension if not exists "uuid-ossp";

create schema if not exists sistema_pos_vendas;

-- ============================================================
-- ANALISTAS (espelho do auth.users — Google OAuth)
-- ============================================================
create table sistema_pos_vendas.analistas (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  email       text not null unique,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- PROCESSOS
-- ============================================================
create table sistema_pos_vendas.processos (
  id                    uuid primary key default uuid_generate_v4(),
  hubspot_deal_id       text not null unique,

  -- Título automático ao criar (editável pelo analista)
  titulo                text not null,           -- ex: "Apto 42 - João Silva"
  codigo_imovel         text,
  endereco_imovel       text,

  -- Prazos vindos do HubSpot
  prazo_entrega_doc     date,                    -- pv__prazo_entrega_doc
  prazo_assinatura      date,                    -- pv__prazo_assinatura
  prazo_instrumento     date,                    -- pv__prazo_instrumento
  prazo_registro        date,                    -- pv__prazo_registro

  status                text not null default 'em_andamento'
                          check (status in ('em_andamento', 'docs_completos', 'concluido', 'cancelado')),
  responsavel_id        uuid references sistema_pos_vendas.analistas(id) on delete set null,
  observacoes           text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- PARTES
-- Múltiplos compradores e vendedores por processo
-- ============================================================
create table sistema_pos_vendas.partes (
  id            uuid primary key default uuid_generate_v4(),
  processo_id   uuid not null references sistema_pos_vendas.processos(id) on delete cascade,

  tipo          text not null check (tipo in ('comprador', 'vendedor', 'corretor')),
  nome          text not null,
  email         text not null,
  cpf           text,

  -- Token para acesso ao portal externo: /portal?token=xxx
  token_acesso  uuid not null default uuid_generate_v4() unique,

  created_at    timestamptz not null default now()
);

-- ============================================================
-- CHECKLIST ITEMS
-- Gerado a partir do template ao criar o processo,
-- customizável pelo analista depois
-- ============================================================
create table sistema_pos_vendas.checklist_items (
  id                  uuid primary key default uuid_generate_v4(),
  processo_id         uuid not null references sistema_pos_vendas.processos(id) on delete cascade,

  categoria           text not null check (categoria in ('comprador', 'vendedor', 'imovel')),
  -- Vincula o item a uma parte específica (ex: "RG do João")
  parte_id            uuid references sistema_pos_vendas.partes(id) on delete cascade,

  nome                text not null,
  obrigatorio         boolean not null default true,
  ordem               int not null default 0,

  status              text not null default 'pendente'
                        check (status in ('pendente', 'enviado', 'aprovado', 'reprovado')),
  motivo_reprovacao   text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- DOCUMENTOS
-- Histórico de versões de cada checklist item
-- ============================================================
create table sistema_pos_vendas.documentos (
  id                uuid primary key default uuid_generate_v4(),
  checklist_item_id uuid not null references sistema_pos_vendas.checklist_items(id) on delete cascade,

  -- Supabase Storage: bucket "documentos"
  -- path: {processo_id}/{checklist_item_id}/{uuid}-{nome_arquivo}
  storage_path      text not null,
  nome_arquivo      text not null,
  tamanho_bytes     bigint,
  mime_type         text,

  enviado_por_parte     uuid references sistema_pos_vendas.partes(id) on delete set null,
  enviado_por_analista  uuid references sistema_pos_vendas.analistas(id) on delete set null,

  created_at        timestamptz not null default now()
);

-- ============================================================
-- ATIVIDADES — log imutável
-- ============================================================
create table sistema_pos_vendas.atividades (
  id            uuid primary key default uuid_generate_v4(),
  processo_id   uuid not null references sistema_pos_vendas.processos(id) on delete cascade,

  tipo          text not null check (tipo in (
                  'processo_criado',
                  'documento_enviado',
                  'documento_aprovado',
                  'documento_reprovado',
                  'email_enviado',
                  'comentario',
                  'status_alterado',
                  'responsavel_alterado'
                )),

  descricao     text not null,

  autor_parte_id      uuid references sistema_pos_vendas.partes(id) on delete set null,
  autor_analista_id   uuid references sistema_pos_vendas.analistas(id) on delete set null,

  metadata      jsonb,

  created_at    timestamptz not null default now()
);

-- ============================================================
-- CHECKLIST TEMPLATE — base para novos processos
-- ============================================================
create table sistema_pos_vendas.checklist_template (
  id          uuid primary key default uuid_generate_v4(),
  categoria   text not null check (categoria in ('comprador', 'vendedor', 'imovel')),
  nome        text not null,
  obrigatorio boolean not null default true,
  ordem       int not null default 0
);

insert into sistema_pos_vendas.checklist_template (categoria, nome, obrigatorio, ordem) values
  ('comprador', 'RG',                         true, 1),
  ('comprador', 'CPF',                         true, 2),
  ('comprador', 'Comprovante de Endereço',     true, 3),
  ('comprador', 'Comprovante de Estado Civil', true, 4),
  ('vendedor',  'RG',                          true, 1),
  ('vendedor',  'CPF',                         true, 2),
  ('vendedor',  'Comprovante de Endereço',     true, 3),
  ('vendedor',  'Comprovante de Estado Civil', true, 4),
  ('imovel',    'Matrícula do Imóvel',          true, 1),
  ('imovel',    'IPTU',                         true, 2);

-- ============================================================
-- TRIGGERS — updated_at automático
-- ============================================================
create or replace function sistema_pos_vendas.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_processos_updated_at
  before update on sistema_pos_vendas.processos
  for each row execute function sistema_pos_vendas.set_updated_at();

create trigger trg_checklist_items_updated_at
  before update on sistema_pos_vendas.checklist_items
  for each row execute function sistema_pos_vendas.set_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- Analistas autenticados: acesso total
-- Partes externas: sem auth Supabase — acesso controlado pela API via token
-- ============================================================
alter table sistema_pos_vendas.processos          enable row level security;
alter table sistema_pos_vendas.partes             enable row level security;
alter table sistema_pos_vendas.checklist_items    enable row level security;
alter table sistema_pos_vendas.documentos         enable row level security;
alter table sistema_pos_vendas.atividades         enable row level security;
alter table sistema_pos_vendas.analistas          enable row level security;
alter table sistema_pos_vendas.checklist_template enable row level security;

create policy "analistas_all" on sistema_pos_vendas.processos
  for all to authenticated using (true) with check (true);
create policy "analistas_all" on sistema_pos_vendas.partes
  for all to authenticated using (true) with check (true);
create policy "analistas_all" on sistema_pos_vendas.checklist_items
  for all to authenticated using (true) with check (true);
create policy "analistas_all" on sistema_pos_vendas.documentos
  for all to authenticated using (true) with check (true);
create policy "analistas_all" on sistema_pos_vendas.atividades
  for all to authenticated using (true) with check (true);
create policy "analistas_all" on sistema_pos_vendas.analistas
  for all to authenticated using (true) with check (true);
create policy "analistas_all" on sistema_pos_vendas.checklist_template
  for all to authenticated using (true) with check (true);

-- Expor o schema sistema_pos_vendas para o cliente Supabase
grant usage on schema sistema_pos_vendas to anon, authenticated, service_role;
grant all on all tables in schema sistema_pos_vendas to authenticated, service_role;
grant all on all sequences in schema sistema_pos_vendas to authenticated, service_role;
