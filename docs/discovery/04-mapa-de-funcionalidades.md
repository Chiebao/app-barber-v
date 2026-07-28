# 04 — Mapa de Funcionalidades

> Status: **Funcional** (usável em produção) · **Parcial** (funciona com ressalva) ·
> **Stub/Desativado** (existe mas não opera). Fonte no código entre colchetes.

---

## Autenticação e contas

| Feature | Objetivo de negócio | Status | Fonte |
|---------|---------------------|--------|-------|
| Registro de barbearia | Onboarding self-service do dono | Funcional | `register/route.ts` |
| Login (owner/barber) | Acesso segmentado por papel | Funcional | `login/route.ts` |
| Troca de senha (logado) | Autonomia do usuário | Funcional | `me/password/route.ts` |
| Esqueci a senha (self) | Reduzir suporte manual | Parcial (abre WhatsApp do suporte, reset é manual) | `admin/page.tsx`, sessão |
| Reset super-admin | Dono da plataforma reseta qualquer conta | Funcional | `admin/reset`, `api/admin/reset-password` |
| Reset de barbeiro pelo dono | Dono destrava funcionário sozinho | Funcional | `add-barber` PATCH (newPassword) |

## Agendamento (cliente)

| Feature | Objetivo | Status | Fonte |
|---------|----------|--------|-------|
| Fluxo por etapas | Marcar em segundos, sem app | Funcional | `[slug]/page.tsx` |
| Fluxo por chat/IA | Experiência diferenciada | **Desativado** | `_chat-page.tsx`, comentário `[slug]/page.tsx:1078` |
| Cálculo de horários | Ofertar só horários válidos | Funcional | `shops/[slug]/slots/route.ts` |
| Anti no-show (Pix) | Reduzir faltas | Funcional | `appointments/route.ts:62-66` |
| Meus agendamentos | Autoatendimento pós-marcação | Funcional | `meus-agendamentos/page.tsx` |
| Cancelar/editar | Reduzir atrito e fricção | Funcional | `appointments/[id]/cancel`, `/edit` |
| Reagendar (repetir) | Aumentar recorrência | Funcional | `[slug]/page.tsx (lastBooking)` |
| Avaliação ⭐ | Prova social | Funcional | `appointments/[id]/rate`, `reviews` |
| Lista de espera | Recuperar vaga cancelada | Funcional | `waitlist`, `cancel/route.ts` |
| Aviso de atraso | Gestão de expectativa | Funcional | `[slug]/page.tsx` (step done), sessão |
| Fidelidade (cliente vê) | Retenção | Funcional | `appointments GET (loyalty)` |
| Exportar histórico PDF | Valor percebido | Funcional | `meus-agendamentos/page.tsx (@react-pdf)` |

## Painel (dono/barbeiro)

| Feature | Objetivo | Status | Fonte |
|---------|----------|--------|-------|
| Dashboard/KPIs | Visão de negócio | Funcional | `me/dashboard/route.ts` |
| Agenda do dia | Operação diária | Funcional | `me/appointments/route.ts` |
| Confirmar pagamento | Fechar caixa | Funcional | `me/finance/route.ts` |
| Pagamento adiado | Flexibilidade | Funcional | `finance/route.ts:21-28` |
| Comanda de produtos | Aumentar tíquete | Funcional | `me/products`, `ComandaItem` |
| No-show | Controlar faltas | Funcional | `appointments/[id]/no-show` |
| Cancelar + avisar waitlist | Recuperar vaga | Funcional | `cancel/route.ts` |
| Lembrar cliente (WhatsApp) | Reduzir falta (manual) | Funcional | `painel (remindClient)`, sessão |
| CRUD serviços | Catálogo | Funcional | `me/services` |
| CRUD produtos | Catálogo comanda | Funcional | `me/products` |
| Gestão de barbeiros | Equipe + comissão | Funcional | `add-barber` |
| Bloqueio de horários | Disponibilidade real | Funcional | `me/blocked-slots` |
| Relatório financeiro | Fechamento por período | Funcional | `me/finance GET` |
| Config barbearia | Personalização | Funcional | `me/shop` |
| Logo da barbearia | Marca no link | Funcional | `me/shop (logoUrl)`, sessão |
| QR Code do link | Divulgação offline | Funcional | `painel (qrcode.react)` |
| Temas (5 paletas) | Identidade visual | Funcional | `palettes.ts` |

## Notificações

| Feature | Objetivo | Status | Fonte |
|---------|----------|--------|-------|
| WhatsApp ao barbeiro (novo/cancelamento) | Ciência imediata | Parcial (depende de API configurada/estável) | `whatsapp.ts`, `appointments/route.ts` |
| Lembrete automático (cron) | Reduzir falta | **Parcial/Frágil** (cron 1x/dia no free tier + API instável) | `cron/route.ts`, `vercel.json` |
| Lembrete manual (botão wa.me) | Alternativa confiável zero-custo | Funcional | `painel`, sessão |
| Push (Expo) | Aviso no app mobile | Funcional (mobile) | `push-token`, `appointments/route.ts` |

## Plataforma / infra

| Feature | Objetivo | Status | Fonte |
|---------|----------|--------|-------|
| PWA (instalável) | App-like sem loja | Funcional | `manifest.json`, `sw.js` |
| Service worker (cache) | Robustez/atualização | Funcional | `public/sw.js` (network-first, sessão) |
| OG image dinâmica | Compartilhamento bonito | Funcional | `og/route.tsx` |
| Rate limiting | Anti-abuso | Funcional | `middleware.ts` |
| CORS + security headers | Segurança | Funcional | `middleware.ts` |
| Smoke test | Segurança de deploy | Funcional | `scripts/smoke.mjs` |
| App mobile (Expo) | Gestão pelo celular | Funcional (Android via APK) | `mobile/` |

## Resumo por saúde

- **Funcional:** a grande maioria (agendamento, painel, financeiro, fidelidade, waitlist, segurança).
- **Parcial:** notificações WhatsApp automáticas (dependência externa instável), esqueci-senha (manual).
- **Desativado:** modo chat/agente IA.
