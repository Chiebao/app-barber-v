# 10 — Métricas e Sucesso

> ⚠️ **Nenhuma métrica real de uso/receita existe no código** (não há analytics, tracking ou
> tabela de eventos). Tudo abaixo separa **o que já é calculável a partir do banco** de
> **propostas que exigem instrumentação**. Valores concretos: **A VALIDAR**.

---

## North Star Metric (proposta)

**Agendamentos concluídos e pagos por barbearia ativa por mês.**
Razão: captura valor real para o dono (cadeira ocupada + caixa fechado), não vaidade.
`[INFERIDO]` — precisa de definição de "barbearia ativa" com o Elias.

## O que já é medível hoje (a partir do banco, sem instrumentar)

Estes números o dashboard/relatório já calculam sob demanda: `[CONFIRMADO: me/dashboard, me/finance]`

| Métrica | Como sai | Fonte |
|---------|----------|-------|
| Agendamentos no mês | count Appointment por período | `me/dashboard` |
| Faturamento (pago) | soma `totalPrice` de `completed` + comanda | `finance GET:113-115` |
| Ticket médio | faturamento / atendimentos pagos | `finance` |
| Taxa de cancelamento | cancelados / total | `dashboard (cancelRate)` |
| Crescimento vs mês anterior | receita e nº vs período anterior | `dashboard (revenueGrowth, aptGrowth)` |
| Ranking de barbeiros | atendimentos/receita/comissão por barbeiro | `dashboard (barberStats)` |
| Horário de pico | hora com mais agendamentos | `dashboard (peakHour)` |
| Avaliação média | média de `Rating.score` | `reviews`, `dashboard (avgRating)` |
| Clientes únicos | count distinct Client | `dashboard (totalClients)` |
| No-shows | `Appointment.status = no_show` / `Client.noShowCount` | schema |
| Fidelidade acumulada | `LoyaltyCount.count` | schema |

> Observação: são métricas **por barbearia** (visão do dono). Não há visão **agregada da
> plataforma** (todas as barbearias) — o Elias não tem um painel de "saúde do negócio dele".

## O que precisa de instrumentação (não existe hoje)

| Métrica | Por que importa | O que falta |
|---------|-----------------|-------------|
| Taxa de conversão do link (visitas → agendamento) | Mede eficácia do funil do cliente | Analytics de página (ex.: Plausible/Umami — free) |
| Ativação do dono (cadastrou → 1º agendamento recebido) | Onboarding funciona? | Evento/coorte |
| Retenção de barbearias (mês a mês) | Churn do negócio | Painel agregado de plataforma |
| Efeito do aviso de atraso (retém ou irrita?) | Experimento em curso | Comparar cancelamento/nota antes/depois |
| Entrega real de notificações | Lembrete funciona? | Log de sucesso/falha (parcial: `cron` já conta) |
| Uso do lembrete manual | Barbeiro adota? | Evento de clique |

## Framework por módulo

### AARRR (visão da plataforma — para o Elias)
- **Aquisição:** nº de barbearias cadastradas. `[calculável: count Owner/Shop]`
- **Ativação:** barbearia que recebeu 1º agendamento. `[calculável com query]`
- **Retenção:** barbearia com agendamentos em meses consecutivos. `[calculável]`
- **Receita:** modelo = **assinatura mensal por barbearia, com planos** (mensal/semestral/anual;
  quanto maior o compromisso, menor a mensalidade). Faixa preliminar ~R$ 49,90–79,90/mês.
  `[CONFIRMADO: Elias, P2]`. MRR/ARR concretos: **A VALIDAR** (0 clientes pagantes hoje). A cobrança
  ocorre **fora do sistema** hoje — não há billing no código, então receita não é medível pela app.
- **Indicação:** **A VALIDAR** (não há tracking de origem).

### HEART (experiência do cliente final)
- **Happiness:** avaliação média (⭐). `[CONFIRMADO: reviews]`
- **Engagement:** agendamentos por cliente / recorrência. `[calculável]`
- **Adoption:** % de agendamentos pelo link vs. marcados na mão. **A VALIDAR** (não distinguível hoje).
- **Retention:** clientes que voltam (2º+ agendamento). `[calculável]`
- **Task success:** conversão do fluxo de agendamento. **A VALIDAR** (sem analytics).

## Metas

Nenhuma meta numérica pode ser afirmada — **A VALIDAR** com o Elias (ver `13-perguntas-abertas`).
Sugestão de primeiras metas a definir: (1) nº de barbearias ativas, (2) % de faltas antes/depois
do anti-no-show, (3) nota média ≥ 4,5.
