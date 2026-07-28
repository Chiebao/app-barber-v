# 13 — Perguntas Abertas

> Tudo que o código **não** responde e só o Elias sabe. Agrupado por tema, ordenado por
> criticidade (🔴 alta · 🟡 média · 🟢 baixa). Estas alimentam decisões de produto e as métricas.

---

## 🔴 Negócio e monetização
1. ✅ **RESPONDIDA:** 0 clientes pagantes hoje. Estratégia = piloto com um amigo barbeiro para
   fidelizar clientes rápido, provar o modelo e então escalar/publicar nas lojas.
2. ✅ **RESPONDIDA (preliminar):** assinatura mensal por barbearia, com planos (mensal ~R$79,90 /
   semestral ~R$64,90 / anual ~R$49,90 por mês), evoluindo funcionalidades por plano.
   ↳ **Novo desdobramento:** não existe **billing/controle de assinatura no sistema** — os planos
   são conceito comercial, não há cobrança nem bloqueio por plano no código. Ver B14 no roadmap.
3. ✅ **RESPONDIDA:** meta = app 100% pronto e testado até **dezembro**; **comercialização
   oficial em janeiro** (divulgação + prospecção ativa de clientes).
4. ✅ **RESPONDIDA (decisão tomada):** ainda não existe contrato/termo. Decisão: **Termos +
   Política de Privacidade universais** (um para todas as barbearias), aproveitando as páginas
   `/termos` e `/privacidade` já existentes; dono aceita no cadastro. Papéis LGPD: **barbearia =
   controladora** dos dados dos clientes dela, **BarberPro = operador**. Riscos LGPD priorizados
   em `11-riscos` (R3) e backlog B2/B17.

## 🔴 Faltas e pagamento
5. ✅ **RESPONDIDA:** sem dados de volume ainda. A regra 2 faltas → Pix foi **pedido do próprio
   amigo barbeiro (piloto)**; manter por enquanto.
6. ✅ **RESPONDIDA — revela feature a construir.** O Pix é realmente cobrado, mas **sem
   verificação pelo app** (confiança). Regras DESEJADAS (nem todas existem):
   - Barbeiro é avisado que foi pago e **confirma manualmente** → aí o corte é agendado. *(existe)*
   - Sem confirmação, fica **pré-agendado por 12h e some**. ❌ *(a construir — B15)*
   - Se um **cliente comum** pega o mesmo horário do cliente em lista negra, o comum tem
     **preferência**; ao ir pagar, o da lista negra recebe "horário não disponível". ❌ *(a construir — B16)*
   Reembolso: **A VALIDAR**.
7. 🟡 *Parcialmente:* indeciso entre modal manual e confirmação própria, **evitando as taxas**
   do gateway. Decisão final depende do amigo barbeiro. *(segue aberta)*

## 🔴 Privacidade / LGPD
8. ✅ **RESPONDIDA — furo confirmado.** NÃO é o login do barbeiro (esse é seguro). É a página
   do cliente `/{slug}/meus-agendamentos`: digitando **só o telefone** (sem senha) qualquer um
   vê os agendamentos daquele número. Correção: código de verificação por WhatsApp antes de
   listar. Backlog **B2** (prioridade antes de janeiro). `[CONFIRMADO: meus-agendamentos + appointments GET sem auth]`
9. ✅ **RESPONDIDA (decisão):** criar botão "Excluir cliente" no painel (dono) que apaga o
   cliente + histórico — atende o direito ao esquecimento da LGPD. Backlog **B17**.
10. ✅ **RESPONDIDA (decisão):** confiar no backup automático do Supabase (retenção curta, ~diária)
    na fase piloto; export diário via `pg_dump` quando escalar; nos Termos, prometer só o que o
    Supabase entrega. Retenção exata do plano: **A VALIDAR** no painel Supabase.

## 🟡 Notificações
11. A WhatsApp Cloud API está aprovada/estável para produção ou segue em teste?
12. Preferência para o lembrete confiável: SMS pago (~R$0,05–0,08/msg) ou manter manual?
13. Qual a taxa de resposta esperada do lembrete? Vale medir?

## 🟡 Operação e escala
14. Quantos barbeiros, em média, por barbearia? Há caso com 10+?
15. Um dono precisará gerenciar mais de uma barbearia (multi-shop)?
16. O app mobile (Android APK) está publicado na Play Store ou distribuído direto? iOS?

## 🟡 Experimentos de produto
17. O aviso de tolerância de atraso deve ser global ou configurável por barbearia?
18. Como vamos medir se o aviso retém ou irrita? (janela, métrica, critério de sucesso)
19. O modo chat/IA será concluído ou removido? Por que foi desativado?

## 🟢 Personalização e catálogo
20. As 5 paletas de tema atendem? Há demanda por cores livres?
21. Produtos existem só para comanda — há intenção de controle de estoque no futuro?
22. Categorias de serviço são fixas (corte/barba/…) — precisam ser configuráveis?

## 🟢 Roadmap e priorização
23. Confirma a ordem sugerida no `12-roadmap`? Algo é inegociável para agora?
24. Publicar no Google Play (R$ 125) é prioridade ou fica para depois?
25. Qual a definição de "barbearia ativa" para a North Star Metric?

---

### Como usar este documento
Cada resposta deve virar: (a) atualização do artefato correspondente, (b) item no backlog
(`12-roadmap`) ou (c) baixa de risco (`11-riscos`). As perguntas 🔴 bloqueiam decisões de
escala e cobrança — responder primeiro.
