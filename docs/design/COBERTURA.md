# Cobertura do redesign "Ouro HUD"

Uma linha por tela/módulo real do código. Referências em `docs/design/barberpro-hud/`.
**K** = sem desenho próprio, montado com o Kit (`00-kit-componentes.html`).
Status: `feito` · `escondido` (elemento sem dado no backend) · `n/a` · `parcial` (com justificativa).

## Fase 1 — Fundação + Kit

| arquivo real | referência | fase | status | observações |
|---|---|---|---|---|
| `web/src/app/globals.css` | `00-kit` (tokens) | 1 | feito | Tokens `--hud-*` derivados de `--brand-500` com `color-mix`; utilitários `hud-bg`, `gold-text`, `gold-fill`, `hud-card`, `hud-corners`, `hud-chamfer`, `hud-input`, `hud-skeleton`, `hud-noscroll`; `prefers-reduced-motion` e alto contraste |
| `web/tailwind.config.ts` | `00-kit` | 1 | feito | Cores `hud-*` por variável. Os `brand-*` fixos ficaram só para o que não é tela (nenhuma tela usa mais) |
| `web/src/app/lib/palettes.ts` | tokens | 1 | feito | Tokens `--hud-*` por paleta + `paletteToStyle`. Nenhuma cor antiga mudou |
| `web/src/app/components/hud/*` (novo) | `00-kit` | 1 | feito | Icon (50 ícones de linha, sem biblioteca), GoldButton, Field/Input/Select/TextArea, Chip, Segmented, Switch, Checkbox, Badge, Alert, EmptyState, Spinner, Skeleton, HudCard, StepPills, Tabs, ScreenHeader, SectionLabel, BottomNav, BottomSheet, QrLinkPanel, PhotoUpload, DataTable, tema (ilha escura) |
| `web/src/app/lib/modal.tsx` | `00-kit` (modal / bottom sheet) | 1 | feito | API igual + opção nova `gaveta` (sobe de baixo no celular) para formulários. "Ilha escura": o modal fica escuro mesmo em paleta clara, com o destaque da paleta |
| `web/src/app/lib/toast.tsx` | `00-kit` (toast) | 1 | feito | API igual. Ícone + texto oculto "Sucesso/Erro/Aviso" |
| `web/src/app/kit-hud/` (temporária) | `00-kit` | 1 | n/a | Usada para conferir as 5 paletas; **removida** no fim |
| `web/src/app/layout.tsx` | tokens | 1 | n/a | Fontes já carregadas; não precisou mudar |

## A. Site do cliente — `web/src/app/[slug]/` (Fase 2)

Etapas reais do código: `loading → name → phone → (rating) → mode_select → services → barber → date → time → confirm → booking → (pix | pix_auto → pix_sent) → done`.

| arquivo real | referência | fase | status | observações |
|---|---|---|---|---|
| `[slug]/layout.tsx` | tokens | 2 | n/a | Metadata/OG; sem tela |
| `[slug]/page.tsx` · cabeçalho da loja | `c01` | 2 | feito | Logo, horário, nota (quando existe), endereço, WhatsApp e "Meus agendamentos" |
| `[slug]/page.tsx` · `loading` | K (skeleton) | 2 | feito | |
| `[slug]/page.tsx` · `name` | `c01-identificacao` | 2 | feito | Nome e telefone continuam DUAS etapas (vale o código). Avaliações públicas com estrelas em ícone |
| `[slug]/page.tsx` · `phone` | `c01` (campo) + K | 2 | feito | |
| `[slug]/page.tsx` · `rating` | `c08-avaliacao` | 2 | feito | Estrelas viraram botões de 48px com rótulo para leitor de tela |
| `[slug]/page.tsx` · `mode_select` | `c02-modo` | 2 | feito | |
| `[slug]/_chat-page.tsx` | `c03-chat` | 2 | feito | Só visual (é roteiro). Balões do cliente em ouro, do robô em cartão HUD |
| `[slug]/page.tsx` · `services` | `c04-servicos-foto` | 2 | feito | Cartões com foto + complementos + rodapé fixo com total. Fidelidade e "Agendar novamente" quando a API devolve |
| `[slug]/page.tsx` · `barber` | `c05-profissional` | 2 | feito | Especialidade/nota/"próximo livre" por barbeiro: **escondidos** (não existem) |
| `[slug]/page.tsx` · `date` | `c06` (datas) | 2 | feito | Etapa própria (vale o código) |
| `[slug]/page.tsx` · `time` | `c06` (manhã/tarde/noite, sem horários, lista de espera) | 2 | feito | Agrupamento é só apresentação da mesma lista |
| `[slug]/page.tsx` · `confirm` / `booking` | `c07-confirmar` | 2 | feito | Ticket com cantoneiras e total metálico |
| `[slug]/_pix-automatico.tsx` | `c09-pix-auto` | 2 | feito | Timer/polling intactos |
| `[slug]/page.tsx` · `pix` | `c10-pix-manual` | 2 | feito | |
| `[slug]/page.tsx` · `pix_sent` | `c11-pix-aguardando` | 2 | feito | |
| `[slug]/page.tsx` · `done` | `c12-agendado` | 2 | feito | |
| `[slug]/page.tsx` · loja não encontrada / erro | K (erro) | 2 | feito | |
| `[slug]/meus-agendamentos/page.tsx` · consulta | `c13-consulta` | 2 | feito | Inclui "não encontrado" |
| `[slug]/meus-agendamentos/page.tsx` · lista | `c14-meus-agendamentos` | 2 | feito | Stats (quantidade + total gasto), "Próximo" com cantoneiras, editar/cancelar/PDF |

## B. Painel do barbeiro — `web/src/app/admin/` (Fases 3 e 4)

| arquivo real | referência | fase | status | observações |
|---|---|---|---|---|
| `admin/page.tsx` · login | `b01-login` | 4 | feito | |
| `admin/page.tsx` · esqueci a senha / código | `b01` + K | 4 | feito | |
| `admin/page.tsx` · cadastro | `b02-cadastro` | 4 | feito | |
| `admin/reset/page.tsx` | K | 4 | feito | |
| `painel/page.tsx` · navegação inferior | `b03` (BottomNav 68px) | 3 | feito | |
| `painel/page.tsx` · aba Início | `b03-inicio` | 3 | feito | Saudação, QR/link, banner da assinatura, **cartão "Status de hoje"** (novo), atalhos com ícone, tira de datas |
| `painel/page.tsx` · cartão de atendimento | `b05-atendimento-estados` | 3 | feito | Horário metálico, etiquetas do Kit, menu ⋯ com ícone de 44px, pagamento em segmentado |
| `painel/_comanda.tsx` | `b05` (seção 2) | 3 | feito | |
| `painel/_agenda.tsx` | `b04-agenda` | 3 | feito | Atendimento (destaque com faixa), livre (tracejado verde), bloqueado (vermelho), fechado (listrado) e **linha do "agora"** com brilho (nova, só no dia de hoje) |
| `painel/_agenda.tsx` · bloquear/intervalo/recorrente | K | 3 | feito | |
| `painel/_expediente.tsx` | K | 3 | feito | |
| `painel/_novo-agendamento.tsx` | K | 3 | feito | |
| `painel/page.tsx` · Clientes | `b06-clientes` | 3 | feito | |
| `painel/page.tsx` · Serviços | `b07-servicos` | 3 | feito | Edição em gaveta. **Parcial**: o formulário de *adicionar* continua como cartão no topo da lista (virar gaveta exigiria mudar o fluxo de estado da tela) |
| `painel/page.tsx` · Barbeiros, Produtos | `b07` | 3 | feito | Mesma observação do "adicionar" |
| `painel/_despesas.tsx` | `b07` | 3 | feito | Lançar/editar em gaveta |
| `painel/page.tsx` · Fidelidade, Espera | `b08` | 3 | feito | |
| `painel/_sumidos.tsx`, `_mensagens.tsx` | `b08` | 3 | feito | Mensagens de WhatsApp (texto enviado ao cliente) não foram tocadas |
| `painel/page.tsx` · Financeiro | `b09-financeiro` | 3 | feito | Mês com valor metálico; só métricas que o backend já calcula (ticket médio e pico existem no dashboard e ficaram) |
| `_a-receber`, `_lucro`, `_ocupacao`, `_conversao`, `_relatorio` | `b09` | 3 | feito | |
| `painel/_relatorio-pdf.tsx` | n/a | 3 | n/a | PDF, não é tela |
| `painel/page.tsx` · Config (menu) | `b10-config` | 3 | feito | **Bug corrigido**: título de "Horário e dias" e "Notificações" saía em branco |
| Config · dados, horário, pagamento (`_mercadopago`), aparência, notificações (`_push-toggle`), senha (`_recovery-code`), banidos | K | 3 | feito | |
| `painel/_assinatura.tsx` | `b11-assinatura` | 3 | feito | Trimestral incluído na lista de planos |
| `painel/_recovery-nag.tsx`, `_aceite.tsx` | K | 3 | feito | |

## C. Páginas públicas e da plataforma (Fase 4)

| arquivo real | referência | fase | status | observações |
|---|---|---|---|---|
| `web/src/app/page.tsx` (landing) | `p01-landing` | 4 | feito | Copy do código; folha creme e Caveat intactas |
| `web/src/app/pagar/[faturaId]/page.tsx` | `p02-pagar-fatura` | 4 | feito | "Pix gerado" **escondido** (o pagamento vai direto à InfinitePay) |
| `web/src/app/admin/plataforma/page.tsx` | K | 4 | feito | |
| `termos/`, `privacidade/`, `exclusao-de-dados/` | K (texto legal) | 4 | feito | |
| `download/page.tsx` | K | 4 | feito | |
| `error.tsx` | K | 4 | feito | |

## D. App mobile — `mobile/` (Fase 5)

| arquivo real | referência | fase | status | observações |
|---|---|---|---|---|
| `components/AppButton.tsx` | `00-kit` | 5 | feito | Gradiente com `expo-linear-gradient`; maiúsculas. **Canto reto** (chanfro exige `react-native-svg`, não instalado) |
| `components/AppCard.tsx` | `00-kit` | 5 | feito | Cantoneiras com Views (`destaque`/`selected`) |
| `components/ScreenBackground.tsx` | tokens | 5 | feito | Grade com Views + brilho em degradê (era foto) |
| `components/ScreenHeader.tsx`, `SectionHeader.tsx`, `StatusBadge.tsx`, `AppInput.tsx` | `00-kit` | 5 | feito | |
| `components/HudIcon.tsx` (novo) | ícones | 5 | feito | Feather de `@expo/vector-icons`, que já vem com o Expo — nada instalado |
| `utils/tokens.ts`, `context/ThemeContext.tsx`, `utils/useColors.ts` | tokens | 5 | feito | Raio 4px, cores de estado do HUD, Midnight Gold no ouro das referências |
| As 13 telas | `b01`–`b11` + K | 5 | feito | Herdam os componentes; emojis de interface viraram ícones ou texto. **Não verificado visualmente**: não há emulador nesta máquina — só checagem de tipos |
| Texto metálico no app | `00-kit` | 5 | parcial | Sem `masked-view`: cor sólida clara do destaque |

## Opção 1 — Status do WhatsApp em 2 toques (feito depois das fases)

| arquivo | o que faz |
|---|---|
| `web/src/app/api/status/[slug]/dados/route.ts` | Horários livres de hoje (ou de amanhã, se hoje lotou), pela mesma conta da página de agendamento |
| `web/src/app/api/status/[slug]/route.tsx` | Imagem 1080×1920 no visual HUD: logo, nome, frase que gira por dia, data, até 9 horários, link |
| `web/src/app/admin/painel/page.tsx` | Cartão "Status de hoje" com prévia e botão **Postar** (abre o compartilhar do celular com imagem + link na legenda; no computador baixa a imagem e copia o link) |
| `web/src/app/api/cron/status-do-dia/route.ts` + `.github/workflows/status.yml` | 7h de Brasília: push grátis (navegador + app) avisando que o status está pronto |

## Decisões registradas
- Nome/telefone e data/horário continuam etapas separadas (vale o código).
- Destaque = cor da barbearia; pontas do gradiente derivadas. Midnight Gold usa #F5B731 (ouro das referências). Telas sem barbearia usam o âmbar do BarberPro.
- Paletas claras: gradiente da cor para o escuro, texto branco nos botões, cores de estado escurecidas — contraste medido ≥ 4,5:1.
- Botões com pelo menos 44px de altura em todo o painel e no site.
- Mensagens de WhatsApp (texto que vai para o cliente) **não** foram tocadas, mesmo com emoji.
- Não há verificador de estilo (lint) configurado em `web/`; checagem = tipos + build + testes.

## Escondido por falta de dado
- Especialidade, nota e "próximo horário livre" por barbeiro (c05).
- "Pix gerado" na página de pagar fatura (p02).
- "% vs mês anterior" só aparece quando o backend manda (`revenueGrowth`).

## Corrigidos depois do redesign (a pedido)
- **Trimestral** passou a aparecer na tela de assinatura do painel (a lista de grupos era fixa em 1, 6 e 12).
- **Imagem do link** (`api/og`) lê as paletas de `palettes.ts`: "Pedra Limpa" estava com id errado (`clean_stone`) e saía com as cores da Midnight Gold.
- **Logo novo** (BarberPro App) em todo lugar que era logo nosso: `favicon.ico`, `icon-192/512.png`, `apple-touch-icon.png`, `logo.png` (quadrado), `logo-completo.webp/png` (retrato), `banner.png`; login/cadastro, download, topo da landing e da página de pagar; cartão do link da landing; no app: `icon.png`, `adaptive-icon.png`, `splash.png` e o logo nas telas de login e cadastro.

## Observações
- Teste de navegador `client.spec.ts` › "botão de exportar PDF" procura um botão "Buscar" que foi renomeado em set/2026 (falha antiga).

## Varredura final
Nenhuma tela do inventário ficou `pendente`. Itens `parcial` têm justificativa acima: formulários de *adicionar* do painel (cartão em vez de gaveta), chanfro e texto metálico no app (dependeriam de instalar bibliotecas).
