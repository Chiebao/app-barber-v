# 03 — Escopo e MVP

> Reconstrução do que provavelmente foi MVP vs. o que evoluiu, a partir do estado atual
> do código e do histórico de commits desta sessão. `[INFERIDO]` onde não há marcação temporal.

---

## Dentro do escopo (existe e funciona)

### Núcleo (provável MVP original)
- Cadastro de barbearia + dono + serviços em uma tela. `[CONFIRMADO: register/route.ts]`
- Login por telefone + senha (owner/barber). `[CONFIRMADO: login/route.ts]`
- Página pública `/{slug}` com fluxo de agendamento passo-a-passo. `[CONFIRMADO: [slug]/page.tsx]`
- Cálculo de horários disponíveis (duração, conflito, dias de trabalho, limite diário).
  `[CONFIRMADO: shops/[slug]/slots/route.ts]`
- Agenda do dia no painel + confirmar pagamento. `[CONFIRMADO: me/appointments, me/finance]`
- Dashboard com KPIs. `[CONFIRMADO: me/dashboard]`

### Evoluções (camadas agregadas depois)
- **Fidelidade** (10 = 1). `[CONFIRMADO: finance/route.ts:54-65]`
- **Anti no-show com Pix**. `[CONFIRMADO: appointments/route.ts:62-66]`
- **Avaliações + reviews públicas**. `[CONFIRMADO: rate, reviews]`
- **Lista de espera**. `[CONFIRMADO: waitlist, cancel/route.ts]`
- **Comanda de produtos**. `[CONFIRMADO: Product, ComandaItem]`
- **Comissão por barbeiro**. `[CONFIRMADO: schema.prisma:63]`
- **Temas (5 paletas) + OG image + PWA**. `[CONFIRMADO: palettes.ts, og/route.tsx, manifest.json]`
- **Modo chat/agente IA** (construído e **desativado**). `[CONFIRMADO: [slug]/page.tsx:1078 comentário, _chat-page.tsx]`
- **Segurança**: rate limit, CORS, headers, isolamento multi-tenant. `[CONFIRMADO: middleware.ts]`
- **LGPD**: páginas de privacidade/termos e exclusão de conta. `[CONFIRMADO: /privacidade, /termos — task list]`
- **Recuperação de senha** (self via WhatsApp + super-admin). `[CONFIRMADO: admin/reset — sessão]`
- **Logo por barbearia**. `[CONFIRMADO: Shop.logoUrl — sessão]`
- **Aviso de tolerância de atraso** na confirmação. `[CONFIRMADO: [slug]/page.tsx — sessão]`
- **Smoke test de produção**. `[CONFIRMADO: scripts/smoke.mjs — sessão]`

## Fora do escopo (deliberadamente cortado ou nunca feito)

| Item | Status | Justificativa do corte |
|------|--------|------------------------|
| Checkout de pagamento (gateway) | Fora | Pix é registro manual; evita custo/fee e complexidade. `[CONFIRMADO: pixKey texto]` |
| Modo chat/agente IA | **Desativado** | Provavelmente custo/maturidade; fluxo por etapas cobre o essencial. `[CONFIRMADO: comentário no código]` |
| App do cliente (nativo) | Fora | Decisão de produto: cliente **não instala nada**. `[CONFIRMADO: README.md:5]` |
| Multi-barbearia por dono | Fora | Um dono = uma barbearia hoje (`shops[0]`). `[CONFIRMADO: login/route.ts:23]` |
| Controle de estoque de produtos | Fora | Produtos só alimentam a comanda. `[INFERIDO: schema]` |
| Lembrete automático 100% confiável | Parcial | Free tier: cron 1x/dia + WhatsApp API instável → lembrete manual (botão). `[CONFIRMADO: vercel.json, sessão]` |
| Publicação nas lojas (Play/Apple) | Fora (por ora) | Estratégia "sem gastos"; foco PWA. `[INFERIDO: sessão]` |

## Linha de corte do MVP (hipótese)

`[INFERIDO]` O MVP mínimo viável seria: **cadastro + link público + agendamento por etapas +
agenda no painel + confirmar pagamento**. Tudo além disso (fidelidade, waitlist, anti no-show,
comanda, temas, mobile) são incrementos de retenção/monetização adicionados sobre a base.

## Critério de "pronto para vender" (hoje)

- Fluxo de agendamento e painel estáveis. `[CONFIRMADO: smoke test 9/9]`
- Segurança básica fechada (rate limit, CORS, multi-tenant). `[CONFIRMADO: middleware.ts]`
- Recuperação de senha operável. `[CONFIRMADO: /admin/reset]`
- Pendências conhecidas documentadas (ver `11-riscos...` e `12-roadmap...`).
