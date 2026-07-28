# 11 — Riscos, Premissas e Dívidas

## Matriz CSD (Certezas · Suposições · Dúvidas)

### Certezas `[CONFIRMADO no código]`
- O agendamento por etapas e o painel funcionam em produção (smoke test 9/9).
- Há isolamento multi-tenant por `shopId` (com correção de um furo nesta sessão).
- Pix é registro manual; não há gateway.
- Lembrete automático é limitado (cron 1x/dia no free tier) e a WhatsApp API está instável.
- Monetários são `Float`.
- Cliente é global por telefone e não tem login.

### Suposições `[INFERIDO — tratar como hipótese]`
- Público são barbearias de 1–5 barbeiros.
- O modelo de cobrança do Elias existe fora do sistema (venda direta).
- Barbeiros usam o app Android; donos tendem ao PWA.
- O aviso de atraso vai reduzir irritação (experimento em curso).

### Dúvidas (só o Elias responde — ver `13-perguntas-abertas`)
- Quantas barbearias/clientes reais existem hoje?
- Como o produto é cobrado (preço, recorrência)?
- LGPD: como tratar o acesso a agendamentos só por telefone?
- Qual o volume de faltas antes/depois do anti-no-show?

---

## Riscos (Impacto × Probabilidade × Mitigação)

| # | Risco | Impacto | Prob. | Mitigação |
|---|-------|---------|-------|-----------|
| R1 | **Lembrete não entrega** (cron 1x/dia + WhatsApp instável) → faltas continuam | Alto | Alta | Botão "Lembrar" manual (feito); avaliar SMS pago ou plano cron |
| R2 | **Float em dinheiro** gera divergência de centavos no relatório | Médio | Média | Migrar para `Decimal`; arredondar centralizado |
| R3 | **Privacidade do cliente** — qualquer um com o telefone lista agendamentos (CONFIRMADO com o Elias, P8) | Alto | **Alta** | **Bloqueador de lançamento (jan):** verificação por código WhatsApp antes de listar (B2) |
| R4 | **Isolamento multi-tenant** — um filtro `shopId` esquecido vaza dados entre lojas | Alto | Média | Revisão sistemática das rotas; testes; helper de query por tenant |
| R5 | **JWT 7 dias sem revogação** — token vazado dá acesso longo | Médio | Baixa | Reduzir expiração + refresh; invalidar no servidor |
| R6 | **Dependência de free tier** (Vercel/Supabase) — limites/crescimento | Médio | Média | Monitorar limites; plano de upgrade quando escalar |
| R7 | **Reset de senha do dono é manual** (gargalo no Elias) | Médio | Média | Self-service com código por WhatsApp/SMS |
| R8 | **Pré-pagamento sem gateway** — anti-no-show depende de confiança | Médio | Média | Integrar Pix real (Mercado Pago) quando fizer sentido |
| R9 | **Modo chat/IA desativado** mas presente — confusão/manutenção | Baixo | Baixa | Remover ou concluir; documentar estado |
| R10 | **Sem backups/monitoramento próprios** além do Supabase | Médio | Baixa | Confirmar retenção de backup; alertas |

---

## Débitos técnicos com impacto de PRODUTO

| Débito | Impacto no produto (não só técnico) | Evidência |
|--------|--------------------------------------|-----------|
| `Float` em valores | Relatório financeiro pode "não bater" — perda de confiança do dono | `schema.prisma` |
| Limite diário conta nº, não duração | Agenda pode fechar cedo ou tarde demais → vaga ociosa ou overbooking percebido | `slots/route.ts:35-52` |
| Lembrete frágil | Promessa de "reduz falta" não se cumpre de forma automática | `cron/route.ts` |
| Waitlist sem reserva | Cliente avisado pode chegar e a vaga já ter ido → frustração | `cancel/route.ts` (RN-027) |
| Acesso do cliente só por telefone | Risco LGPD e privacidade | `appointments GET` |
| Modo IA morto no código | Risco de bug/manutenção e confusão de escopo | `_chat-page.tsx` |
| `CLAUDE.md` desatualizado | Novos no time recebem info errada (JWT, cron, itens "pendentes" já feitos) | `CLAUDE.md` |
| Sem painel agregado da plataforma | Elias não enxerga a saúde do próprio negócio | ausência em `me/*` |
