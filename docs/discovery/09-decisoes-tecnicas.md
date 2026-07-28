# 09 — Decisões Técnicas (ADRs)

> Formato: Contexto / Decisão / Alternativas / Consequências. Reconstruídas do código e do
> `CLAUDE.md:569-587`. Não são datadas (histórico não registrado) — ordem lógica.

---

## ADR-001 — Next.js App Router como web + API num só projeto
- **Contexto:** time solo, orçamento zero, precisa de site do cliente + painel + API.
- **Decisão:** Next.js 14 (App Router) servindo páginas e API Routes no mesmo repo/deploy. `[CONFIRMADO: package.json, src/app/api]`
- **Alternativas:** backend separado (Express/Nest) + SPA; Pages Router.
- **Consequências:** ✅ zero custo extra de infra, um deploy. ⚠️ acoplamento web+API; escala vertical limitada ao modelo serverless da Vercel.

## ADR-002 — PostgreSQL gerenciado (Supabase) + Prisma
- **Contexto:** precisa de banco relacional confiável sem custo/ops.
- **Decisão:** Supabase (Postgres) via Prisma ORM. `[CONFIRMADO: schema.prisma, CLAUDE.md]`
- **Alternativas:** Drizzle, SQL cru, Planetscale/Neon.
- **Consequências:** ✅ type-safety, migrations, free tier. ⚠️ conexões via **pooler** exigem cuidado (migrações precisam da porta de sessão — visto na sessão ao adicionar `logoUrl`).

## ADR-003 — Auth com JWT em header + bcrypt
- **Contexto:** mesmo backend serve web e app mobile.
- **Decisão:** JWT (`Authorization: Bearer`), expira em 7 dias; bcrypt 12 rounds. `[CONFIRMADO: auth.ts]`
- **Alternativas:** cookies de sessão; provedor externo (Auth0/Supabase Auth).
- **Consequências:** ✅ sem CORS de cookie, funciona no mobile. ⚠️ sem revogação server-side (logout é client-side); token de 7 dias é janela de risco se vazar. *(CLAUDE.md diz 30 dias — desatualizado.)*

## ADR-004 — Multi-tenant por `shopId` no token
- **Contexto:** várias barbearias no mesmo banco.
- **Decisão:** isolamento lógico — toda query autenticada filtra por `shopId` do JWT. `[CONFIRMADO: finance:15, me/*]`
- **Alternativas:** um banco por tenant; schema por tenant.
- **Consequências:** ✅ simples e barato. ⚠️ isolamento depende de disciplina no código — um filtro esquecido vaza dados (bug real corrigido nesta sessão no PATCH de barbeiro).

## ADR-005 — Cliente sem app e sem login (identidade por telefone)
- **Contexto:** reduzir atrito de adoção do cliente final.
- **Decisão:** cliente acessa por `/slug` e se identifica só pelo telefone. `[CONFIRMADO: [slug]/page.tsx, appointments GET]`
- **Alternativas:** cadastro/login do cliente; app do cliente.
- **Consequências:** ✅ conversão altíssima (zero fricção). ⚠️ qualquer um com o telefone lista os agendamentos daquele número (privacidade a validar).

## ADR-006 — Valores monetários como `Float`
- **Contexto:** preços e totais.
- **Decisão:** `Float` no Prisma. `[CONFIRMADO: schema.prisma]`
- **Alternativas:** `Decimal`.
- **Consequências:** ⚠️ risco de erro de arredondamento em somatórios/relatórios. Débito técnico com impacto financeiro (ver `11-riscos`).

## ADR-007 — Pix como registro manual (sem gateway)
- **Contexto:** custo zero, evitar taxas e compliance de pagamento.
- **Decisão:** `pixKey` é texto; barbeiro confirma pagamento manualmente. `[CONFIRMADO: finance, pixKey]`
- **Alternativas:** Mercado Pago/Stripe/Asaas (fee por transação).
- **Consequências:** ✅ zero custo. ⚠️ "pré-pagamento" anti-no-show depende de honestidade + confirmação manual; não há garantia de recebimento.

## ADR-008 — Notificações WhatsApp Cloud API + Expo Push, fire-and-forget
- **Contexto:** avisar barbeiro/cliente sem infra própria.
- **Decisão:** WhatsApp Cloud API (Meta) e Expo Push; falhas não quebram o fluxo. `[CONFIRMADO: whatsapp.ts, appointments/route.ts]`
- **Alternativas:** SMS (Twilio/Zenvia), e-mail, provider próprio.
- **Consequências:** ✅ oficial e barato. ⚠️ API do WhatsApp instável/"não pronta" no projeto → lembrete real virou **manual (wa.me)**.

## ADR-009 — Cron da Vercel para lembretes (free tier = 1x/dia)
- **Contexto:** lembrar cliente 1h antes.
- **Decisão:** Vercel Cron chamando `/api/cron`. `[CONFIRMADO: vercel.json]`
- **Alternativas:** worker externo, plano pago (cron frequente).
- **Consequências:** ⚠️ free tier só permite **1x/dia**, então o lembrete automático cobre uma janela mínima — mitigado pelo botão manual.

## ADR-010 — Temas por CSS variables (5 paletas)
- **Decisão:** paletas aplicadas via variáveis CSS por barbearia. `[CONFIRMADO: palettes.ts]`
- **Consequências:** ✅ personalização sem rebuild. ⚠️ paleta fixa em 5 opções.

## ADR-011 — PWA com service worker network-first para HTML
- **Contexto:** app-like sem loja; evitar servir versão velha após deploy.
- **Decisão:** SW network-first para navegação, cache-first para assets com hash. `[CONFIRMADO: public/sw.js — sessão]`
- **Consequências:** ✅ deploy aparece na hora. ⚠️ offline só parcial.

## ADR-012 — Dois projetos Vercel (corrigido)
- **Contexto:** havia `app_barber` (fantasma) e `barberpro` (produção real).
- **Decisão:** consolidar em `barberpro`; deletar o fantasma. `[CONFIRMADO: sessão]`
- **Consequências:** ✅ menos confusão e risco. Lição: manter link local ↔ projeto de produção correto.
