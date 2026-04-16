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
| Frontend + API | Next.js (App Router) + Tailwind CSS |
| Banco + Auth + Storage | Supabase |
| Automações / Integrações | HubSpot Workflows (webhook nativo) |
| Deploy | Render |
| IA (resumo diário) | Claude API (claude-sonnet-4-6) |

## Integrações

- **HubSpot:** Pipeline comercial → pipeline jurídico → pipeline pós-vendas. O deal entra no pós-vendas e o workflow do HubSpot dispara um webhook direto na nossa API (sem Zapier). O prazo de documentação vem como campo do deal.
- **Email:** comunicação com partes (por enquanto sem WhatsApp)
- **Google OAuth:** autenticação dos analistas via Google Workspace

## Decisões Tomadas

- Lembretes automáticos: **fora do escopo por enquanto** — analista controla manualmente quando cobrar
- WhatsApp: **fora do escopo por enquanto** — só email
- Agentes de IA: apenas **resumo diário** por enquanto (classificação/extração de docs é futuro)
- Checklist tem um template padrão mas o **analista pode customizar por processo**
- Portal externo usa **token na URL** (sem login para comprador/vendedor)
- Corretor acessa o portal em **modo somente leitura**
- Título do processo é gerado automaticamente mas é editável pelo analista
- Processo pode ter múltiplos compradores e múltiplos vendedores

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
| `pv__e_mails_compradores` | textarea | E-mails compradores (lista) |
| `pv__e_mails_vendedores` | textarea | E-mails vendedores (lista) |
| `pv__e_mail_1` … `pv__e_mail_6` | text | E-mails individuais dos vendedores |
| `pv__e_mail_1___comprador` … `pv__e_mail_6___comprador` | text | E-mails individuais dos compradores |
| `pv__qtd__de_e_mails___compradores` | select | Quantidade de compradores |
| `pv__qtd__de_e_mails__todas_partes_envolvidas_` | select | Quantidade de vendedores |

### Identificação do processo
| Campo HubSpot | Tipo | Descrição |
|---|---|---|
| `id_do_pos_vendas` | number | ID do processo pós-vendas |
| `etapa_do_pos_vendas` | text | Etapa atual |
| `pv__pos_vendas_ja_criado` | text | Flag para evitar duplicação no webhook |
| `pv__ccv_externo_` | select | CCV é externo? |
| `pv__tera_pos_vendas_` | select | Terá pós-vendas? |
| `pv__observacoes_pos_vendas` | textarea | Observações |

### Imóvel
| Campo HubSpot | Tipo | Descrição |
|---|---|---|
| `codigo_do_imovel` | text | Código do imóvel |
| `bairro`, `cidade`, `cep` | text | Endereço |

### Dados do comprador (preenchidos antes)
| Campo HubSpot | Tipo | Descrição |
|---|---|---|
| `fin__nome_do_comprador_principal` | text | Nome comprador principal |
| `cpf_compradores_separados_por_virgula` | textarea | CPFs compradores |
| `cpf_do_s__comprador_es_` | text | CPF comprador principal |

### Observação sobre nomes
Campos de nome de comprador e vendedor ainda não existem como campos específicos no HubSpot — serão criados. Por enquanto não contar com eles no webhook.

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

## Status do Projeto

- [x] Mapear campos do deal HubSpot
- [x] Schema Supabase (`sistema_pos_vendas`)
- [ ] Inicializar projeto Next.js
- [ ] Configurar Supabase client no Next.js
- [ ] Integração HubSpot via webhook nativo (workflow HubSpot → POST na nossa API → criar processo)
- [ ] Painel do analista
- [ ] Portal externo
- [ ] Resumo diário (Claude API)
