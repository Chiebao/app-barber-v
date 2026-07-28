# 07 — User Stories (engenharia reversa)

> Épicos → histórias com critérios de aceite em Gherkin, derivados do comportamento real do código.

---

## Épico A — Onboarding e conta

### US-A1 — Cadastrar barbearia
> Como **dono**, quero cadastrar minha barbearia com serviços e horários numa tela, para começar a receber agendamentos rápido.

```gherkin
Dado que informei nome, barbearia, telefone, senha (≥6), serviços e horários
Quando envio o cadastro
Então minha barbearia é criada com um link /slug único
E eu já sou o primeiro barbeiro da loja
E recebo o link e o QR Code para compartilhar
```
```gherkin
Dado que o telefone já está cadastrado
Quando tento cadastrar
Então recebo erro "Telefone já cadastrado" e nada é criado
```
`[CONFIRMADO: register/route.ts]`

### US-A2 — Entrar na conta
> Como **dono ou barbeiro**, quero logar com telefone e senha, para acessar meu painel.

```gherkin
Dado telefone e senha corretos
Quando faço login
Então recebo um token e caio no painel com as permissões do meu papel
```
```gherkin
Dado uma senha errada
Quando faço login
Então recebo "Credenciais inválidas" (401)
```
`[CONFIRMADO: login/route.ts]`

### US-A3 — Recuperar senha
> Como **usuário que esqueceu a senha**, quero pedir ajuda, para voltar a acessar.

```gherkin
Dado que cliquei em "Esqueci minha senha" e informei meu telefone
Quando confirmo
Então abre o WhatsApp do suporte com uma mensagem pronta com meu telefone
```
```gherkin
Dado que sou dono da plataforma com a senha-mestra
Quando informo telefone + nova senha em /admin/reset
Então a senha da conta (dono e/ou barbeiro) é redefinida
```
`[CONFIRMADO: admin/page.tsx, admin/reset — sessão]`

---

## Épico B — Agendamento (cliente)

### US-B1 — Agendar um horário
> Como **cliente**, quero marcar horário pelo link, para não depender de WhatsApp.

```gherkin
Dado que escolhi serviços, barbeiro, data e um horário disponível
Quando confirmo
Então meu agendamento é criado e o barbeiro é notificado
E vejo um aviso de tolerância de até 15 minutos
```
```gherkin
Dado que dois clientes escolhem o mesmo horário ao mesmo tempo
Quando ambos confirmam
Então só um é aceito e o outro recebe "horário acabou de ser ocupado" (409)
```
`[CONFIRMADO: [slug]/page.tsx, appointments/route.ts]`

### US-B2 — Pré-pagamento por histórico de falta
> Como **barbearia**, quero exigir sinal de quem falta muito, para reduzir prejuízo.

```gherkin
Dado um cliente com 2+ faltas e a loja com chave Pix
Quando ele tenta agendar
Então o sistema exige pré-pagamento via Pix antes de confirmar
```
`[CONFIRMADO: appointments/route.ts:62-66]`

### US-B3 — Ver, cancelar e editar meus agendamentos
> Como **cliente**, quero gerenciar meus agendamentos, para ter autonomia.

```gherkin
Dado que informei meu telefone em "Meus agendamentos"
Quando abro a lista
Então vejo meus agendamentos e posso cancelar ou editar serviços dos confirmados
```
`[CONFIRMADO: meus-agendamentos/page.tsx]`

### US-B4 — Entrar na lista de espera
> Como **cliente**, quero ser avisado se abrir vaga, para não perder o dia que quero.

```gherkin
Dado que o dia escolhido está cheio
Quando entro na lista de espera
Então fico registrado e sou avisado se alguém cancelar naquele dia
```
`[CONFIRMADO: waitlist, cancel/route.ts]`

### US-B5 — Avaliar o atendimento
> Como **cliente**, quero avaliar, para ajudar outros e dar retorno ao barbeiro.

```gherkin
Dado que tenho um atendimento concluído sem avaliação
Quando volto ao link e informo meu telefone
Então vejo a tela de avaliação (1-5 + comentário)
E minha nota entra na média pública da barbearia
```
`[CONFIRMADO: rate, reviews, appointments GET]`

---

## Épico C — Operação diária (barbeiro/dono)

### US-C1 — Trabalhar a agenda do dia
> Como **barbeiro**, quero ver a agenda do dia, para me organizar.

```gherkin
Dado que estou logado
Quando abro a agenda
Então vejo os agendamentos do dia com cliente, serviço, horário e status
```
`[CONFIRMADO: me/appointments, painel]`

### US-C2 — Confirmar pagamento
> Como **barbeiro**, quero registrar o pagamento, para fechar o atendimento e o caixa.

```gherkin
Dado um atendimento confirmado
Quando registro a forma de pagamento (podendo ajustar preço/serviços)
Então o atendimento vira "concluído", grava a data de pagamento e soma +1 na fidelidade
```
`[CONFIRMADO: finance/route.ts]`

### US-C3 — Cancelar e acionar a fila
> Como **dono**, quero cancelar avisando a lista de espera, para não perder a vaga.

```gherkin
Dado um agendamento com pessoas na lista de espera para aquela data
Quando cancelo
Então posso avisar por WhatsApp os clientes da fila
```
`[CONFIRMADO: cancel/route.ts, painel — sessão]`

### US-C4 — Lembrar o cliente
> Como **barbeiro**, quero lembrar o cliente do horário, para reduzir faltas.

```gherkin
Dado um agendamento futuro confirmado
Quando toco em "Lembrar"
Então abre o WhatsApp do cliente com uma mensagem pronta
```
`[CONFIRMADO: painel (remindClient) — sessão]`

### US-C5 — Gerir catálogo e equipe
> Como **dono**, quero gerir serviços, produtos e barbeiros, para manter a loja atualizada.

```gherkin
Dado que sou dono
Quando crio/edito serviços, produtos ou barbeiros (com comissão)
Então as mudanças refletem no agendamento e no financeiro
```
`[CONFIRMADO: me/services, me/products, add-barber]`

### US-C6 — Ver o negócio (dashboard/financeiro)
> Como **dono**, quero KPIs e relatório por período, para decidir com dados.

```gherkin
Dado que sou dono
Quando abro o dashboard
Então vejo agendamentos, faturamento, ticket médio, cancelamento e ranking de barbeiros
```
`[CONFIRMADO: me/dashboard, me/finance GET]`

### US-C7 — Personalizar a marca
> Como **dono**, quero logo e tema próprios, para que o link tenha a cara da minha barbearia.

```gherkin
Dado que subo um logo e escolho um tema
Quando um cliente abre meu link
Então vê meu logo e minhas cores — nunca de outra barbearia
```
`[CONFIRMADO: me/shop (logoUrl), palettes — sessão]`

---

## Histórias de dívida (o que falta virar história pronta)

- **US-D1 (A VALIDAR):** confiabilidade do lembrete automático (hoje frágil no free tier).
- **US-D2 (A VALIDAR):** reserva temporária da vaga para a lista de espera (evitar corrida).
- **US-D3 (A VALIDAR):** self-service completo de reset de senha do dono (hoje manual).
