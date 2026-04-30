# Sistema Pós Vendas — Pilar (soupilar.com.br)

## Contexto do Negócio

A Pilar presta serviços para corretores imobiliários. O fluxo é:
1. Corretor tem uma proposta → passa para o time de **closers** (negociação + consultoria jurídica)
2. Proposta evolui para CCV → time **jurídico** faz Due Diligence e elabora o contrato
3. CCV assinado → inicia o **Pós Vendas**

O pós-vendas consiste em coletar documentação de compradores, vendedores e do imóvel dentro de um prazo, com acompanhamento dos analistas internos.

## Objetivo do Sistema

Ferramenta interna para o time de pós-vendas controlar processos, documentação e comunicação — com portal externo para que compradores, vendedores e corretores façam uploads e acompanhem o andamento.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend + API | Next.js 16 (App Router) + Tailwind CSS |
| Banco + Auth + Storage | Supabase |
| Automações / Integrações | HubSpot Workflows (webhook nativo) |
| Deploy | Render (`https://pos-vendas.onrender.com`) |
| IA (resumo diário) | Claude API (claude-sonnet-4-6) — futuro |

## URLs de Produção

- **App:** `https://pos-vendas.onrender.com`
- **Webhook HubSpot:** `https://pos-vendas.onrender.com/api/webhook/hubspot`
- **Portal externo:** `https://pos-vendas.onrender.com/portal?token=<token>`
- **GitHub:** `https://github.com/mauricioghisserman/sistema-pos-vendas`

## Render — Deploy

- **Build command:** `npm install && npm run build`
- **Start command:** `npm run start`
- **Runtime:** Node
- Deploy automático a cada push na branch `main`

## Integrações

- **HubSpot:** Workflow dispara webhook para `POST /api/webhook/hubspot` a cada mudança de etapa no pipeline de pós-vendas. O webhook busca os dados completos do deal via API e cria/atualiza o processo no Supabase.
  - Workflow precisa ter **"Allow re-enrollment"** ativado
  - O body do webhook deve incluir `{"objectId": "<token do deal>"}` usando o token de propriedade do HubSpot (não digitar manualmente)
  - Para capturar mudanças sem troca de etapa (owner, prazos, etc.), configurar inscrições nativas no HubSpot: Settings → Private Apps → Webhooks → `deal.propertyChange`
- **Google OAuth:** autenticação dos analistas via Google Workspace
- **Supabase Storage:** bucket `documentos` (privado, 20MB por arquivo) para uploads do portal

## Decisões Tomadas

- Lembretes automáticos: **fora do escopo por enquanto** — analista controla manualmente
- WhatsApp: **fora do escopo por enquanto** — só email
- Agentes de IA: apenas **resumo diário** por enquanto (classificação/extração de docs é futuro)
- Checklist tem um template padrão mas o **analista pode customizar por processo**
- Portal externo usa **token na URL** (sem login para comprador/vendedor)
- Corretor acessa o portal em **modo somente leitura**
- Título do processo é gerado automaticamente mas é editável pelo analista
- Processo pode ter múltiplos compradores e múltiplos vendedores
- Upload de documentos no portal aceita PDF, JPG, PNG e WebP (máx. 20MB)
- Kanban usa paginação por coluna (20 por vez, scroll infinito) — 1.200 deals em produção
- `hubspot_owner_nome` armazena o nome do responsável pelo deal no HubSpot
- Webhook HubSpot deve retornar 200 imediatamente e processar em background — chamadas síncronas causam timeout e o HubSpot marca como erro
- URL do webhook no HubSpot Private App: `https://pos-vendas.onrender.com/api/webhook/hubspot` (não `vendas.onrender.com`)
- Resumo IA usa Gemini 2.0 Flash (`gemini-2.0-flash`) via `GEMINI_API_KEY` — tem retry automático em 429
- Prazos HubSpot exigem timestamp em ms (meia-noite UTC): `new Date(valor + "T00:00:00.000Z").getTime()`
  - ~757 deals antigos têm owner nulo — owners foram deletados do HubSpot, não recuperável
  - Deals novos puxam o owner automaticamente via webhook
- **Partes da transação**: deals de pós-vendas têm um campo `pv_legal_center__hubspot_deal_id_comercial` que guarda o ID do deal do pipe **comercial**. As `partes_da_transacao` (objeto customizado HubSpot `2-57453831`) estão associadas ao deal **comercial**, não ao de pós-vendas. Para buscar partes de um processo: ler `pv_legal_center__hubspot_deal_id_comercial` do deal de pós-vendas → usar esse ID para buscar `partes_da_transacao`. Tipo da parte determinado pelo tipo de associação: `includes("compradora")` → comprador, `includes("vendedora")` → vendedor. Deals antigos usam fallback nos campos `pv__e_mail_*`.

## Checklist Padrão

**Comprador:** RG, CPF, Comprovante de Endereço, Comprovante de Estado Civil
**Vendedor:** RG, CPF, Comprovante de Endereço, Comprovante de Estado Civil
**Imóvel:** Matrícula do Imóvel, IPTU

## Campos do Deal HubSpot (mapeados)

Campos com prefixo `pv__` são os de pós-vendas. Os principais:

### Prazos
| Campo HubSpot | Tipo | Descrição |
|---|---|---|
| `pv__prazo_entrega_doc` | date | **Prazo de entrega de documentação** ← principal |
| `pv__prazo_assinatura` | date | Prazo para assinatura |
| `pv__prazo_instrumento` | date | Prazo do instrumento |
| `pv__prazo_registro` | date | Prazo do registro |

### Partes — E-mails
| Campo HubSpot | Tipo | Descrição |
|---|---|---|
| `pv__e_mail_1` … `pv__e_mail_6` | text | E-mails individuais dos vendedores |
| `pv__e_mail_1___comprador` … `pv__e_mail_6___comprador` | text | E-mails individuais dos compradores |

### Responsável
| Campo HubSpot | Tipo | Descrição |
|---|---|---|
| `hubspot_owner_id` | text | ID do owner do deal no HubSpot |

### Identificação do processo
| Campo HubSpot | Tipo | Descrição |
|---|---|---|
| `pv__observacoes_pos_vendas` | textarea | Observações |
| `codigo_do_imovel` | text | Código do imóvel |
| `bairro`, `cidade`, `cep` | text | Endereço |

### Observação sobre nomes
Campos de nome de comprador e vendedor ainda não existem como campos específicos no HubSpot — serão criados. Por enquanto o nome é derivado do email (parte antes do @).

## Pipeline Pós-Vendas (HubSpot ID: 117996833)

| Stage | ID HubSpot | Status no sistema |
|---|---|---|
| Fechado pelo comercial | 209029533 | `fechado_pelo_comercial` |
| Pós-vendas iniciado | 209029534 | `pos_vendas_iniciado` |
| Documentação pendente | 209029535 | `documentacao_pendente` |
| Instrumento Definitivo | 209029536 | `instrumento_definitivo` |
| Finalizado | 209394964 | `finalizado` |
| Sem pós-vendas | 1089645944 | `sem_pos_vendas` |
| Perdido | 214273600 | `perdido` |

O kanban do sistema é um espelho direto desse pipeline. Quando o analista move um card, atualiza o stage no HubSpot via API.

## Modelo de Dados (Supabase)

Schema: `sistema_pos_vendas`

| Tabela | Descrição |
|---|---|
| `analistas` | Espelho do Supabase Auth (Google OAuth) |
| `processos` | Um deal de pós-vendas — coração do sistema |
| `partes` | Compradores, vendedores e corretores (múltiplos por processo) |
| `checklist_items` | Documentos exigidos, customizável por processo |
| `documentos` | Versões de arquivo de cada item (histórico completo) |
| `atividades` | Log imutável de tudo que acontece |
| `checklist_template` | Template padrão usado ao criar novo processo |

### Colunas adicionadas após schema inicial
- `processos.hubspot_stage_id` — ID da etapa no HubSpot
- `processos.hubspot_owner_nome` — Nome do responsável pelo deal
- `processos.endereco_imovel` — Endereço formatado (bairro + cidade)
- `processos.observacoes` — Observações vindas do HubSpot

## Arquitetura de Arquivos

```
app/
  (painel)/
    layout.tsx              — layout autenticado com sidebar
    processos/page.tsx      — kanban board (server component, busca owners)
  api/
    webhook/hubspot/        — recebe eventos do HubSpot, cria/atualiza processos (retorna 200 imediato, processa em background)
    processos/route.ts      — GET paginado com busca e filtro por owner
    processos/status/       — PATCH atualiza status no Supabase + HubSpot
    processos/prazos/       — PATCH atualiza prazo no Supabase + HubSpot (timestamp ms)
    checklist/status/       — PATCH atualiza status de item do checklist
    checklist/items/        — POST cria novo item adicional no checklist
    documentos/url/         — GET gera signed URL do Supabase Storage
    portal/route.ts         — GET dados do portal por token
    portal/upload/          — POST upload de documento pelo portal
    tasks/route.ts          — GET/POST tasks por processo; ?all=true retorna todas abertas
    resumo/route.ts         — GET resumo IA (Gemini) com contexto completo do processo
    dashboard/route.ts      — GET processos com prazo vencendo nos próximos 14 dias
  portal/page.tsx           — portal externo (público, token-based)
  login/page.tsx            — login Google OAuth
  dashboard/page.tsx        — dashboard com 3 colunas: Tasks | Documentação | Instrumento
  tasks/page.tsx            — painel de tasks agrupadas por prazo
components/
  kanban-board.tsx          — board com busca, filtro e drawer
  kanban-column.tsx         — coluna com paginação e scroll infinito
  processo-drawer.tsx       — drawer lateral com checklist + sidebar (w-[900px])
  checklist-section.tsx     — seção do checklist com aprovação/reprovação + adicionar doc
  tasks-section.tsx         — seção de tasks no drawer (com prazo_hora, padrão 09:00)
  resumo-section.tsx        — botão "Gerar" resumo IA no drawer
  sidebar.tsx               — sidebar preta Pilar
scripts/
  sync-hubspot.mjs          — sync completo HubSpot → Supabase (one-shot)
  backfill-owners.mjs       — backfill de hubspot_owner_nome
```

## Status do Projeto

- [x] Mapear campos do deal HubSpot
- [x] Schema Supabase (`sistema_pos_vendas`)
- [x] Inicializar projeto Next.js
- [x] Configurar Supabase client no Next.js
- [x] Autenticação Google OAuth (analistas)
- [x] Kanban board espelhando pipeline HubSpot
- [x] Sync bidirecional HubSpot ↔ sistema (webhook + PATCH stage)
- [x] Drawer com checklist, prazos, partes e observações
- [x] Paginação por coluna (scroll infinito, 20 por vez)
- [x] Busca por deal + filtro por responsável
- [x] Owner do deal puxado do HubSpot e exibido no card
- [x] Sync total HubSpot → Supabase (script one-shot, 1.228 deals)
- [x] Portal externo com upload de documentos por token único
- [x] Supabase Storage (bucket `documentos`)
- [x] Analista consegue ver documento enviado (signed URL)
- [x] Deploy no Render (`https://pos-vendas.onrender.com`)
- [x] Tasks por processo (com prazo + hora, padrão 09:00)
- [x] Painel de tasks agrupado por prazo
- [x] Dashboard com Tasks | Documentação | Instrumento lado a lado
- [x] Edição inline de prazos no drawer com sync para HubSpot
- [x] Resumo IA por processo (Gemini 2.0 Flash) com contexto completo
- [x] Webhook HubSpot: retorna 200 imediato, processa em background (fix timeout)
- [x] Botão "Copiar link do portal" por parte no drawer
- [x] Analista pode adicionar documentos adicionais no checklist
- [ ] Envio de email com link do portal para as partes
- [ ] Resumo diário (Claude API)
- [ ] Inscrições nativas HubSpot para outras propriedades (owner, prazos)
