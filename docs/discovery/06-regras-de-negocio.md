# 06 — Regras de Negócio

> Regras extraídas do código, numeradas. Cada uma com origem. `[CONFIRMADO]` salvo indicação.

---

## Agendamento

- **RN-001 — Conflito de horário por barbeiro é recusado.** Um novo agendamento é rejeitado
  (HTTP 409) se sobrepõe outro do mesmo barbeiro (`startTime < apt.endTime && endTime > apt.startTime`),
  ignorando cancelados/faltas. `[appointments/route.ts (checagem de conflito, em transação Serializable)]`
- **RN-002 — Checagem de conflito é atômica.** A verificação + criação rodam em transação
  `Serializable`; corridas simultâneas resultam em 409 para o segundo. `[appointments/route.ts — sessão]`
- **RN-003 — Só agenda em dia de trabalho.** Se o dia da semana não está em `workDays`, não há slots.
  `[slots/route.ts:17-18]`
- **RN-004 — Limite diário de agenda.** Nº de agendamentos do dia ≥ `maxSlots` (calculado por
  `(fechamento-abertura)/avgServiceTime`) → agenda cheia. `[slots/route.ts:35-52]`
  ⚠️ *Observação de produto: o cálculo conta nº de agendamentos, não a duração real somada.*
- **RN-005 — Horário bloqueado não aparece.** Slots marcados em `BlockedSlot` são removidos;
  bloqueio de dia inteiro (`time = null`) zera os slots. `[slots/route.ts:56-68]`
- **RN-006 — Horário no passado (hoje) é filtrado.** Para a data de hoje, só aparecem horários
  após o horário atual. `[[slug]/page.tsx (handleSelectDate)]`
- **RN-007 — endTime é calculado.** `endTime = startTime + soma das durações dos serviços`.
  `[appointments/route.ts:38-40]`
- **RN-008 — Serviços devem pertencer à barbearia.** Serviços inválidos/de outra loja → 400.
  `[appointments/route.ts:29,33]`

## Cliente e faltas

- **RN-009 — Cliente é único por telefone (global).** Um `Client` por telefone, compartilhado
  entre barbearias. `[schema.prisma:113]`
- **RN-010 — Cliente é criado no primeiro agendamento** se não existir. `[appointments/route.ts:57-60]`
- **RN-011 — Anti no-show.** Cliente com `noShowCount >= 2` **e** barbearia com `pixKey` definida
  → exige pré-pagamento (HTTP 402) antes de confirmar. `[appointments/route.ts:62-66]`
- **RN-012 — Agendamento pré-pago fica pendente.** Com pré-pagamento, status inicial =
  `pending_payment`; senão `confirmed`. `[appointments/route.ts:78]`
- **RN-013 — Marcar falta incrementa o contador.** "Não veio" → `noShowCount++`. `[appointments/[id]/no-show]`

## Pagamento e financeiro

- **RN-014 — Formas de pagamento válidas:** `pix`, `dinheiro`, `cartao`, `adiado`. `[finance/route.ts:12]`
- **RN-015 — Pagamento confirmado fecha o atendimento.** status → `completed`, grava `paidAt`.
  `[finance/route.ts:48-51]`
- **RN-016 — Pagamento adiado não confirma.** Só grava `deferredPaymentDate`. `[finance/route.ts:21-28]`
- **RN-017 — Preço pode ser ajustado no fechamento.** Barbeiro remove serviços ou define
  `customPrice`; o total é recalculado. `[finance/route.ts:31-46]`
- **RN-018 — Comanda soma ao faturamento.** Produtos da comanda entram no `totalRevenue` do relatório.
  `[finance/route.ts:115,136]`
- **RN-019 — Barbeiro vê só o próprio financeiro.** Relatório de um `barber` filtra pelo próprio id.
  `[finance/route.ts:96]`

## Fidelidade

- **RN-020 — +1 ponto por pagamento confirmado.** `LoyaltyCount` incrementa a cada `completed`.
  `[finance/route.ts:54-58]`
- **RN-021 — Meta = 10.** A cada 10 pontos, recompensa (`count % 10 === 0`). `[finance/route.ts:65]`
- **RN-022 — Fidelidade é por barbearia+cliente.** Contagem única por `(shopId, clientId)`.
  `[schema.prisma:244]`

## Cancelamento e lista de espera

- **RN-023 — Quem pode cancelar.** Membro da loja (JWT do shop) **ou** o cliente dono
  (telefone confere). Senão 403. `[cancel/route.ts:31-39]`
- **RN-024 — Não cancela o que já está cancelado.** Segundo cancelamento → 400. `[cancel/route.ts:29]`
- **RN-025 — Cancelamento pelo cliente notifica o barbeiro/dono.** WhatsApp + Push. `[cancel/route.ts:46-88]`
- **RN-026 — Vaga aberta aciona a waitlist.** Busca até 3 pessoas da fila para a data
  (ou sem data preferida) e tenta avisar. `[cancel/route.ts (waitlist)]`
- **RN-027 — Waitlist não reserva vaga.** O aviso não garante o horário; quem reagendar primeiro fica.
  `[INFERIDO: não há hold no código]`

## Avaliação

- **RN-028 — Nota de 1 a 5.** Fora disso → 400. `[rate/route.ts]`
- **RN-029 — Uma avaliação por atendimento.** `appointmentId` é único; reavaliar → 400. `[rate/route.ts, schema.prisma:171]`
- **RN-030 — Só avalia atendimento concluído.** A tela de avaliação aparece para agendamento
  `completed` sem nota. `[appointments/route.ts:175]`
- **RN-031 — Review pública mostra só o primeiro nome.** Privacidade. `[reviews/route.ts]`

## Autenticação e permissões

- **RN-032 — Login tenta dono, depois barbeiro.** Verifica `Owner` por telefone; se falhar, `Barber` ativo.
  `[login/route.ts:13-59]`
- **RN-033 — Token JWT expira em 7 dias.** `[auth.ts:22]` ⚠️ *(CLAUDE.md diz 30 dias — divergência.)*
- **RN-034 — Senha com bcrypt (12 rounds).** `[auth.ts:8]`
- **RN-035 — Sem JWT_SECRET a app não sobe.** Falha explícita no boot. `[auth.ts:4]`
- **RN-036 — Rotas `owner only`.** Dashboard, clientes, add-barber, create/update de serviços →
  exigem `role === owner`. `[add-barber:18, dashboard, services]`
- **RN-037 — Isolamento multi-tenant.** Operações do painel filtram por `shopId` do token;
  reset/edição de barbeiro valida que ele é da loja do dono. `[finance:15, add-barber PATCH — sessão]`
- **RN-038 — Senha mínima 6 caracteres.** No registro, troca e reset. `[register schema, me/password, admin/reset]`
- **RN-039 — Reset super-admin exige senha-mestra.** `ADMIN_SECRET`; erro → 401. `[api/admin/reset-password — sessão]`
- **RN-040 — Barbeiro único por (loja, telefone).** `[schema.prisma:71]`

## Notificações

- **RN-041 — Notificação é fire-and-forget.** Falha de WhatsApp/Push não quebra a operação
  (`.catch(console.error)`). `[appointments/route.ts, cancel/route.ts]`
- **RN-042 — Lembrete automático 1x/dia.** Cron busca agendamentos ~1h à frente e marca
  `reminderSentAt` só se a API confirmar. `[cron/route.ts, vercel.json — sessão]`
- **RN-043 — Cron protegido.** Exige `Authorization: Bearer CRON_SECRET`. `[cron/route.ts — sessão]`

## Segurança de borda

- **RN-044 — Rate limit por IP e rota:** login 10/min, register 5/min, appointments 15/min,
  waitlist 10/min, admin 5/min. `[middleware.ts]`
- **RN-045 — CORS por whitelist de origens.** `[middleware.ts]`
- **RN-046 — Upload: imagem até 3MB, tipos jpg/png/webp.** `[me/upload/route.ts]`

---

## Pré-pagamento Pix, LGPD e notificações (B15, B16, B17, Web Push)

> Origem: respostas P6/P8/P9 do Elias.

> ✅ **Todas implementadas em 20/05/2026.** Ficam registradas abaixo com o número definitivo.

- **RN-047 — Pré-agendamento expira em 6 horas de barbearia ABERTA.** O relógio só corre no
  expediente: pré-agendou 22h → começa a contar na próxima abertura. Assim o barbeiro sempre
  tem um turno inteiro para confirmar, em vez de o prazo morrer de madrugada.
  `[pending-deadline.ts; B15]`
- **RN-048 — O prazo nunca passa da hora do corte.** `deadline = min(6h úteis, início do corte)`.
  `[pending-deadline.ts (capAtAppointment)]`
- **RN-049 — Pré-agendamento vencido não ocupa mais o horário.** Vale na checagem de conflito
  do booking e na geração de slots — o horário volta para qualquer cliente. `[occupiesSlotWhere]`
- **RN-050 — Quem declarou o Pix fica protegido durante o prazo.** Enquanto vigente, o
  `pending_payment` segura a vaga (decisão do negócio: não passar para trás quem já pagou).
  Antes de declarar o pagamento, nada é reservado — aí o cliente comum leva o horário.
  `[decisão P6-1a]`
- **RN-051 — Confirmação tardia só vale se o horário continuar livre.** O barbeiro pode
  confirmar um Pix vencido, mas o sistema checa conflito antes e devolve 409 se a vaga já foi
  ocupada. `[confirm-payment/route.ts]`
- **RN-052 — Aviso ao barbeiro quando o cliente declara o Pix.** Push/WhatsApp com texto próprio
  ("Pix declarado — confirme"), distinto do aviso de agendamento normal. `[appointments/route.ts]`
- **RN-053 — Exclusão de dados do cliente (LGPD).** O dono apaga cliente e histórico, escopado
  à barbearia. `[me/clients/[id] DELETE; B17]`
- **RN-054 — Verificação por nome + telefone em "Meus agendamentos".** A lista só sai quando o
  nome confere. `[appointments GET; B2]`
- **RN-055 — Notificação no navegador (Web Push).** Barbeiro/dono recebem aviso de novo
  agendamento, Pix declarado e cancelamento com o app fechado. Uma inscrição por aparelho;
  inscrições mortas são removidas sozinhas. No iPhone exige iOS 16.4+ com o PWA instalado.
  `[lib/webpush.ts, sw.js, me/push-subscription]`
