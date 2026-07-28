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
3. Qual a meta dos próximos 3–6 meses (nº de barbearias, receita)? *(ainda aberta)*
4. Existe contrato/termo com os donos clientes? Quem é responsável pelos dados (LGPD)? *(ainda aberta)*

## 🔴 Faltas e pagamento
5. Qual o volume de faltas hoje? O anti-no-show (2 faltas → Pix) está sendo usado/eficaz?
6. O pré-pagamento Pix é realmente cobrado e conferido, ou é só um "aviso"? Há reembolso?
7. Vale integrar Pix real (Mercado Pago)? Qual o apetite por fee por transação?

## 🔴 Privacidade / LGPD
8. É aceitável que qualquer pessoa com um telefone veja os agendamentos daquele número?
9. Como tratar solicitação de exclusão de dados de um cliente (existe fluxo real além da página)?
10. Onde ficam os backups e qual a política de retenção assumida com os clientes?

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
