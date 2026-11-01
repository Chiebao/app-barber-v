"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { BottomNav, EmptyState, Icon, ScreenHeader, SectionLabel, Spinner as HudSpinner, type NomeIcone } from "@/app/components/hud";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { getPaletteById, paletteToVars } from "@/app/lib/palettes";
import { toast } from "@/app/lib/toast";
import PushToggle from "./_push-toggle";
import RecoveryCode from "./_recovery-code";
import RecoveryNag from "./_recovery-nag";
import Relatorio from "./_relatorio";
import Assinatura from "./_assinatura";
import AReceber from "./_a-receber";
import Agenda from "./_agenda";
import Despesas from "./_despesas";
import Mensagens from "./_mensagens";
import Comanda from "./_comanda";
import Expediente from "./_expediente";
import { salvarAgenda, lerAgenda, limparAgendas, horaDaCopia } from "@/app/lib/agenda-offline";
import NovoAgendamento from "./_novo-agendamento";
import Lucro from "./_lucro";
import Aceite from "./_aceite";
import Conversao from "./_conversao";
import Ocupacao from "./_ocupacao";
import Sumidos from "./_sumidos";
import MercadoPago from "./_mercadopago";
import { Modal, useConfirmacao } from "@/app/lib/modal";

function applyAdminTheme(themeId: string) {
  const p = getPaletteById(themeId);
  const vars = paletteToVars(p).split(";").map((v) => v.trim()).filter(Boolean);
  const root = document.documentElement;
  vars.forEach((d) => {
    const [prop, val] = d.split(":").map((s) => s.trim());
    if (prop && val) root.style.setProperty(prop, val);
  });
}

/* ── Types ──────────────────────────────────────────────────────── */
interface AppointmentService { serviceId: string; name: string; price: number; }
interface ItemComanda { productId: string; name: string; quantity: number; price: number; }
interface Appointment {
  id: string; startTime: string; endTime: string; date: string;
  status: string; paidAt: string | null; paymentMethod: string | null;
  totalPrice: number; barberName: string;
  pendingExpiresAt?: string | null; pendingExpired?: boolean;
  client: { id: string; name: string; phone: string; noShowCount: number; notes: string | null; pediuParar?: boolean };
  services: AppointmentService[];
  comanda?: ItemComanda[];
  comandaTotal?: number;
}
interface Barber { id: string; name: string; phone: string; active: boolean; role: string; commission?: number; email?: string | null; imageUrl?: string | null; isOwnerProfile?: boolean; }
interface DashboardData {
  today: { appointments: number; received: number; expected: number };
  month: { appointments: number; revenue: number; toReceive: number; avgTicket: number; cancelRate: number; revenueGrowth: number | null; aptGrowth: number | null; prevRevenue: number; prevApts: number; };
  avgRating: number | null;
  barberStats: { name: string; count: number; revenue: number; commission: number; commissionValue: number; revenueShare: number }[];
  peakHour: string | null; totalClients: number; barbers: number;
}
interface ServiceItem { id: string; name: string; duration: number; price: number; category: string; active: boolean; imageUrl?: string | null; }
interface ProductItem { id: string; name: string; price: number; custo: number | null; description: string | null; imageUrl: string | null; active: boolean; }
// `id` e do telefone (usado para salvar a nota); `pessoa` separa quem
// divide o numero. A chave da lista precisa dos dois.
interface ClientItem { id: string; pessoa: string; name: string; phone: string; notes: string | null; noShowCount: number; firstDate: string; totalAppointments: number; }
interface SlotData { allSlots: string[]; blocked: string[]; allDay: boolean; booked: string[]; }

const STATUS_LABELS: Record<string, string> = { confirmed: "Confirmado", cancelled: "Cancelado", completed: "Concluido", pending: "Pendente", pending_payment: "Aguardando Pix", no_show: "Não compareceu" };
const STATUS_COLORS: Record<string, string> = {
  confirmed: "text-hud-accent border border-[color-mix(in_srgb,var(--hud-accent)_60%,transparent)]",
  cancelled: "bg-[color-mix(in_srgb,var(--hud-err)_20%,transparent)] text-hud-err border border-[color-mix(in_srgb,var(--hud-err)_30%,transparent)]",
  completed: "bg-[color-mix(in_srgb,var(--hud-ok)_20%,transparent)] text-hud-ok border border-[color-mix(in_srgb,var(--hud-ok)_30%,transparent)]",
  pending: "bg-[color-mix(in_srgb,var(--hud-warn)_20%,transparent)] text-hud-warn border border-[color-mix(in_srgb,var(--hud-warn)_30%,transparent)]",
  pending_payment: "bg-[color-mix(in_srgb,var(--hud-warn)_20%,transparent)] text-hud-warn border border-[color-mix(in_srgb,var(--hud-warn)_30%,transparent)]",
  no_show: "text-hud-muted border border-[var(--hud-text-3)]",
};
const PAYMENT_LABELS: Record<string, string> = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão" };
const CATEGORY_LABELS: Record<string, string> = { corte: "Corte", barba: "Barba", sobrancelha: "Sobrancelha", pezinho: "Pezinho", luzes: "Luzes" };
const CATEGORY_ICONS: Record<string, NomeIcone> = { corte: "tesoura", barba: "tesoura", sobrancelha: "olho", pezinho: "tesoura", luzes: "estrela" };
// Duas letras cabem nas 7 colunas até em tela de 320px; três não cabiam e
// a última letra ficava cortada.
const WEEKDAYS = ["Do", "Se", "Te", "Qa", "Qi", "Sx", "Sa"];

type Tab = "home" | "agenda" | "financeiro" | "config";
type ConfigView = null | "dados" | "horário" | "pagamento" | "aparencia" | "notificações" | "senha" | "banidos" | "assinatura";
const CONFIG_TITULOS: Record<string, string> = {
  // As chaves seguem o ConfigView, COM acento: sem acento aqui, o título de
  // "Horário" e de "Notificações" saía em branco.
  dados: "Dados da barbearia",
  "horário": "Horário e dias",
  pagamento: "Pagamento",
  aparencia: "Aparência",
  "notificações": "Notificações",
  senha: "Senha e recuperação",
  banidos: "Clientes banidos",
  assinatura: "Minha assinatura",
};
interface ResumoShop {
  horario: { openTime: string; closeTime: string; workDays: number[] };
  servicos: number; produtos: number; barbeiros: number; barbeirosSemFoto: number; banidos: number;
  temEndereco: boolean; temTelefone: boolean; temLogo: boolean;
  pagamento: { mercadoPago: boolean; pixManual: boolean };
  tema: string; notificacoes: number;
}
const ROTULO_ASSINATURA: Record<string, string> = {
  trial: "Teste grátis", ativa: "Ativa", carencia: "Em atraso",
  bloqueada: "Bloqueada", cortesia: "Cortesia", cancelada: "Cancelada",
};
interface BannedItem { id: string; phone: string; name: string | null; reason: string | null; }

type SubView = null | "barbeiros" | "serviços" | "clientes" | "fidelidade" | "espera" | "produtos" | "sumidos" | "fixos" | "mensagens";

/** Corte que se repete toda semana. A regra, nao as ocorrencias. */


/** "faltam 3h20" / "faltam 45min" a partir de um prazo ISO. */
function timeLeftLabel(iso?: string | null): string {
  if (!iso) return "";
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "";
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `faltam ${h}h${m > 0 ? String(m).padStart(2, "0") : ""}`;
  return `faltam ${m}min`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function PainelPage() {
  // Uma confirmação para o painel inteiro. Cada pergunta é uma chamada;
  // o diálogo em si é renderizado uma vez só, lá no fim do JSX.
  const [confirmar, dialogoConfirmacao] = useConfirmacao();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ name?: string; shopName?: string; shopSlug?: string; role?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [subView, setSubView] = useState<SubView>(null);
  const [configView, setConfigView] = useState<ConfigView>(null);
  const [resumo, setResumo] = useState<ResumoShop | null>(null);
  const [verRelatorio, setVerRelatorio] = useState(false);
  const [verAReceber, setVerAReceber] = useState(false);
  const [verDespesas, setVerDespesas] = useState(false);
  // Muda a cada despesa lancada para o cartao de lucro recalcular.
  const [lucroVersao, setLucroVersao] = useState(0);
  const [totalAReceber, setTotalAReceber] = useState<{ total: number; promessasVencidas: number } | null>(null);
  const [resumoAssinatura, setResumoAssinatura] = useState<{ estado: string; diasRestantes: number; aviso: string | null } | null>(null);
  const [banned, setBanned] = useState<BannedItem[]>([]);
  const [bannedLoading, setBannedLoading] = useState(false);
  const [baningClient, setBaningClient] = useState(false);
  const [novoBanido, setNovoBanido] = useState({ phone: "", reason: "" });
  const [showQR, setShowQR] = useState(false);
  // Salva sozinho ao escolher: é um seletor de três opções, e obrigar a
  // apertar "salvar" depois só cria o caso de escolher e não salvar.
  const [salvandoJanela, setSalvandoJanela] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [preparandoStatus, setPreparandoStatus] = useState(false);
  // Chegou pelo aviso das 7h ("seu status de hoje está pronto"): o cartão
  // ganha destaque para o barbeiro achar o botão de primeira.
  const [vindoDoAviso] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("status"));
  const qrRef = useRef<HTMLDivElement>(null);

  // ── Home/Agenda state ──
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  // Quando a rede falha, a tela precisa saber que está mostrando cópia —
  // senão dia sem internet vira dia sem cliente. `null` = veio da rede.
  const [agendaSalvaEm, setAgendaSalvaEm] = useState<number | null>(null);
  const [agendaSemCopia, setAgendaSemCopia] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "dinheiro" | "cartao">("pix");
  const [confirmingPayId, setConfirmingPayId] = useState<string | null>(null);
  const [removedServiceIds, setRemovedServiceIds] = useState<string[]>([]);
  const [customPrice, setCustomPrice] = useState<string>("");
  const [clientNotes, setClientNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);

  // ── Availability state ──
  const [slotData, setSlotData] = useState<SlotData | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsSaving, setSlotsSaving] = useState(false);
  const [availDate, setAvailDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [ownerBarberId, setOwnerBarberId] = useState<string | null>(null);

  // ── Barbeiros state ──
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barbersLoading, setBarbersLoading] = useState(false);
  const [newBarberName, setNewBarberName] = useState("");
  const [newBarberPhone, setNewBarberPhone] = useState("");
  const [newBarberPassword, setNewBarberPassword] = useState("");
  const [newBarberCommission, setNewBarberCommission] = useState("");
  const [newBarberEmail, setNewBarberEmail] = useState("");
  const [editBarber, setEditBarber] = useState<{ id: string; name: string; email: string; commission: string; imageUrl: string; isOwnerProfile: boolean } | null>(null);
  const [savingBarber, setSavingBarber] = useState(false);
  const [uploadingBarberImg, setUploadingBarberImg] = useState(false);
  const [addingBarber, setAddingBarber] = useState(false);
  const [resetBarberId, setResetBarberId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resettingBarber, setResettingBarber] = useState(false);

  // ── Financeiro state ──
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(false);

  // ── Fidelidade state ──
  const [loyalties, setLoyalties] = useState<{ clientName: string; clientPhone: string; count: number; progress: number; rewardsEarned: number }[]>([]);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);

  // O mesmo "hoje" que o servidor usa para expirar a fila: o do fuso da
  // barbearia, não o do relógio de quem abriu o painel.
  const hojeISO = () =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());

  // ── Waitlist state ──
  const [waitlist, setWaitlist] = useState<{ id: string; clientName: string; clientPhone: string; serviceIds: string[]; preferredDate: string | null; createdAt: string; barber: { name: string } | null }[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [removingWaitId, setRemovingWaitId] = useState<string | null>(null);

  // ── Services state ──
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [newService, setNewService] = useState({ name: "", duration: "30", price: "", category: "corte" });
  const [addingService, setAddingService] = useState(false);
  // Servico em edicao: guarda os campos como texto porque vem de <input>
  const [editService, setEditService] = useState<{ id: string; name: string; price: string; duration: string; category: string; imageUrl: string } | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [deletingService, setDeletingService] = useState<string | null>(null);
  const [uploadingServiceImg, setUploadingServiceImg] = useState(false);

  // ── Products state ──
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", price: "", custo: "", description: "" });
  const [addingProduct, setAddingProduct] = useState(false);
  const [editProduct, setEditProduct] = useState<{ id: string; name: string; price: string; custo: string; description: string; imageUrl: string } | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<string | null>(null);
  const [uploadingProductImg, setUploadingProductImg] = useState(false);

  // ── Clients state ──
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);

  // ── Config state ──
  const [shopSettings, setShopSettings] = useState<{ name: string; openTime: string; closeTime: string; workDays: number[]; pixKey: string; logoUrl: string; bookingMode: string; phone: string; address: string; neighborhood: string; city: string; state: string; zipCode: string; slotInterval: number; diasAbertos: number } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // ── Auth ──
  useEffect(() => {
    const t = localStorage.getItem("admin_token");
    const u = localStorage.getItem("admin_user");
    if (!t) { router.replace("/admin"); return; }
    setToken(t);
    if (u) { try { setUser(JSON.parse(u)); } catch {} }

    // Sessão deslizante: renova o prazo sempre que o app é aberto, para o
    // barbeiro não ser deslogado do nada. No máximo 1x a cada 6h.
    (() => {
      const LAST = "admin_token_renewed_at";
      const SIX_HOURS = 6 * 60 * 60 * 1000;
      const last = Number(localStorage.getItem(LAST) || 0);
      if (Date.now() - last < SIX_HOURS) return;
      fetch("/api/auth/refresh", { method: "POST", headers: { Authorization: `Bearer ${t}` } })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (d?.token) {
            localStorage.setItem("admin_token", d.token);
            localStorage.setItem(LAST, String(Date.now()));
            setToken(d.token);
          }
        })
        .catch(() => { /* renovação é best-effort; o token atual segue valendo */ });
    })();
    fetch("/api/me/shop", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(data => {
        if (data.shop?.colorTheme) applyAdminTheme(data.shop.colorTheme);
        if (data.shop) setShopSettings({
          name: data.shop.name || "",
          phone: data.shop.phone || "",
          address: data.shop.address || "",
          neighborhood: data.shop.neighborhood || "",
          city: data.shop.city || "",
          state: data.shop.state || "",
          zipCode: data.shop.zipCode || "",
          slotInterval: data.shop.slotInterval || 30,
          diasAbertos: data.shop.diasAbertos || 30,
          openTime: data.shop.openTime || "08:00",
          closeTime: data.shop.closeTime || "20:00",
          workDays: data.shop.workDays || [1,2,3,4,5,6],
          pixKey: data.shop.pixKey || "",
          logoUrl: data.shop.logoUrl || "",
          bookingMode: data.shop.bookingMode || "steps",
        });
      }).catch(() => {});
    // Owner barber profile
    fetch("/api/me/owner-barber", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(data => { if (data.barber) setOwnerBarberId(data.barber.id); })
      .catch(() => {});
  }, [router]);

  const authHeaders = useCallback(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }),
    [token]
  );

  // Sessão expirada (401): limpa token, avisa e volta ao login
  const handleUnauthorized = useCallback(() => {
    limparAgendas();
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    localStorage.removeItem("admin_token_renewed_at");
    toast.info("Sua sessão expirou. Faça login novamente.");
    router.replace("/admin");
  }, [router]);

  // ── Fetchers ──
  const fetchAppointments = useCallback(async () => {
    if (!token) return;
    setAgendaLoading(true);
    try {
      const res = await fetch(`/api/me/appointments?date=${selectedDate}`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const lista = data.appointments || [];
      setAppointments(lista);
      setAgendaSalvaEm(null);
      setAgendaSemCopia(false);
      salvarAgenda(selectedDate, lista, new Date().toISOString().split("T")[0]);
    } catch {
      // Rede fora. Mostrar a última cópia É o objetivo; mostrar lista
      // vazia calada era o problema.
      const copia = lerAgenda<Appointment>(selectedDate);
      setAppointments(copia?.agendamentos ?? []);
      setAgendaSalvaEm(copia?.salvoEm ?? null);
      setAgendaSemCopia(!copia);
    }
    finally { setAgendaLoading(false); }
  }, [token, selectedDate, authHeaders, handleUnauthorized]);

  const fetchSlots = useCallback(async () => {
    if (!token) return;
    setSlotsLoading(true);
    const bid = user?.role === "owner" && ownerBarberId ? `&barberId=${ownerBarberId}` : "";
    try {
      const res = await fetch(`/api/me/blocked-slots?date=${availDate}${bid}`, { headers: authHeaders() });
      const data = await res.json();
      setSlotData(data);
    } catch { setSlotData(null); }
    finally { setSlotsLoading(false); }
  }, [token, availDate, authHeaders, ownerBarberId, user?.role]);

  // ─── CORTE FIXO (agendamento recorrente) ───
  // Quantas respostas de cliente ainda não foram vistas. O número no menu
  // é o que faz alguém abrir a tela — sem ele, a caixa de entrada existe
  // e ninguém olha.
  const [msgsNaoLidas, setMsgsNaoLidas] = useState(0);
  // Menu de tres pontinhos aberto num card, e a comanda daquele atendimento.
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [comandaDe, setComandaDe] = useState<Appointment | null>(null);
  // Resumo da semana mostrado no lugar dos campos antigos de horário.
  const [verExpediente, setVerExpediente] = useState(false);
  const [semana, setSemana] = useState<{ dia: number; aberto: boolean; abre: string; fecha: string }[] | null>(null);


  const fetchBarbers = useCallback(async () => {
    if (!token) return; setBarbersLoading(true);
    try { const res = await fetch("/api/auth/add-barber", { headers: authHeaders() }); const data = await res.json(); setBarbers(data.barbers || []); }
    catch { setBarbers([]); } finally { setBarbersLoading(false); }
  }, [token, authHeaders]);

  const fetchDashboard = useCallback(async () => {
    if (!token) return; setDashLoading(true);
    // Só guarda quando veio o resumo de verdade. A rota é do DONO e responde
    // 401 `{ error }` para barbeiro contratado — guardar isso como se fossem
    // os números derrubava a aba inteira ("Algo deu errado aqui").
    try {
      const res = await fetch("/api/me/dashboard", { headers: authHeaders() });
      const data = await res.json();
      setDashboard(res.ok && data?.month ? data : null);
    }
    catch { setDashboard(null); } finally { setDashLoading(false); }
  }, [token, authHeaders]);

  const fetchLoyalty = useCallback(async () => {
    if (!token) return; setLoyaltyLoading(true);
    try { const res = await fetch("/api/me/loyalty", { headers: authHeaders() }); const data = await res.json(); setLoyalties(data.loyalties || []); }
    catch { setLoyalties([]); } finally { setLoyaltyLoading(false); }
  }, [token, authHeaders]);

  const fetchWaitlist = useCallback(async () => {
    if (!token) return; setWaitlistLoading(true);
    try { const res = await fetch("/api/me/waitlist", { headers: authHeaders() }); const data = await res.json(); setWaitlist(data.waitlist || []); }
    catch { setWaitlist([]); } finally { setWaitlistLoading(false); }
  }, [token, authHeaders]);

  const fetchServices = useCallback(async () => {
    if (!token) return; setServicesLoading(true);
    try { const res = await fetch("/api/me/services", { headers: authHeaders() }); const data = await res.json(); setServices(data.services || []); }
    catch { setServices([]); } finally { setServicesLoading(false); }
  }, [token, authHeaders]);

  // ?todos=1 para enxergar tambem os desativados e poder reativar
  const fetchProducts = useCallback(async () => {
    if (!token) return; setProductsLoading(true);
    try { const res = await fetch("/api/me/products?todos=1", { headers: authHeaders() }); const data = await res.json(); setProducts(data.products || []); }
    catch { setProducts([]); } finally { setProductsLoading(false); }
  }, [token, authHeaders]);

  // A situação da assinatura acompanha o painel inteiro, não só a
  // engrenagem: é ela que pinta o aviso no topo da home.
  const fetchAssinatura = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/me/assinatura", { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setResumoAssinatura({ estado: d.situacao.estado, diasRestantes: d.situacao.diasRestantes, aviso: d.situacao.aviso });
      }
    } catch { /* sem aviso e melhor que painel quebrado */ }
  }, [token, authHeaders]);

  const fetchResumo = useCallback(async () => {
    if (!token) return;
    try { const res = await fetch("/api/me/resumo", { headers: authHeaders() }); if (res.ok) setResumo(await res.json()); }
    catch { /* cartao cai para o rotulo sem valor; nao vale travar a tela */ }
  }, [token, authHeaders]);

  const fetchBanned = useCallback(async () => {
    if (!token) return; setBannedLoading(true);
    try { const res = await fetch("/api/me/banned-clients", { headers: authHeaders() }); const d = await res.json(); setBanned(d.banned || []); }
    catch { setBanned([]); } finally { setBannedLoading(false); }
  }, [token, authHeaders]);

  const fetchClients = useCallback(async () => {
    if (!token) return; setClientsLoading(true);
    try { const res = await fetch("/api/me/clients", { headers: authHeaders() }); const data = await res.json(); setClients(data.clients || []); }
    catch { setClients([]); } finally { setClientsLoading(false); }
  }, [token, authHeaders]);

  // Effects
  useEffect(() => {
    if (!token) return;
    if (activeTab === "home") fetchAppointments();
    if (activeTab === "agenda") fetchSlots();
    if (activeTab === "financeiro") fetchDashboard();
  }, [token, activeTab, fetchAppointments, fetchSlots, fetchDashboard]);

  useEffect(() => { if (token && configView === "banidos") fetchBanned(); }, [token, configView, fetchBanned]);
  // Recarrega ao abrir a engrenagem e toda vez que volta ao menu: e
  // exatamente quando o dono acabou de mexer em alguma coisa.
  useEffect(() => {
    if (token && activeTab === "config" && !configView) fetchResumo();
  }, [token, activeTab, configView, fetchResumo]);
  // Sair da engrenagem fecha a subtela: voltar e cair na mesma tela de antes confunde
  useEffect(() => { if (token) fetchAssinatura(); }, [token, fetchAssinatura]);
  useEffect(() => { if (activeTab !== "config") setConfigView(null); }, [activeTab]);
  useEffect(() => { if (activeTab !== "financeiro") { setVerRelatorio(false); setVerAReceber(false); setVerDespesas(false); } }, [activeTab]);
  // O total em aberto vive no botao, para o dono ver sem entrar
  useEffect(() => {
    if (!token || activeTab !== "financeiro") return;
    fetch("/api/me/a-receber", { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setTotalAReceber({ total: d.total, promessasVencidas: d.promessasVencidas }); })
      .catch(() => { /* o botao aparece sem valor; nao vale travar a aba */ });
  }, [token, activeTab, verAReceber, authHeaders]);
  // O filtro por barbeiro do relatorio precisa da lista carregada
  useEffect(() => { if (token && verRelatorio && barbers.length === 0) fetchBarbers(); }, [token, verRelatorio, barbers.length, fetchBarbers]);

  const buscarNaoLidas = useCallback(() => {
    if (!token) return;
    fetch("/api/me/mensagens", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => setMsgsNaoLidas(d?.naoLidas ?? 0))
      .catch(() => {});
  }, [token, authHeaders]);

  useEffect(() => { buscarNaoLidas(); }, [buscarNaoLidas, subView]);

  const buscarSemana = useCallback(() => {
    if (!token) return;
    fetch("/api/me/expediente", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => setSemana(d?.dias ?? null))
      .catch(() => {});
  }, [token, authHeaders]);

  // Recarrega ao entrar em Config E ao fechar o modal. Depender so do
  // callback de salvar deixava o resumo velho na tela: o dado ia para o
  // banco, a tela continuava mostrando o horario antigo.
  useEffect(() => {
    if (activeTab === "config" && !verExpediente) buscarSemana();
  }, [activeTab, verExpediente, buscarSemana]);


  useEffect(() => { if (token && activeTab === "home") fetchAppointments(); }, [selectedDate]);
  useEffect(() => { if (token && activeTab === "agenda") fetchSlots(); }, [availDate]);
  useEffect(() => {
    if (!token || !subView) return;
    if (subView === "barbeiros") fetchBarbers();
    if (subView === "fidelidade") fetchLoyalty();
    if (subView === "espera") fetchWaitlist();
    if (subView === "serviços") fetchServices();
    if (subView === "clientes") { fetchClients(); fetchBanned(); }
    if (subView === "produtos") fetchProducts();
    // O corte fixo precisa de servicos (duracao/preco) e barbeiros (de quem
    // e a agenda) para o formulario existir.
    if (subView === "fixos") { fetchServices(); fetchBarbers(); }
  }, [token, subView]);

  // ── Cancel state ──
  const [cancelModalId, setCancelModalId] = useState<string | null>(null);
  const [cancelNotifyWaitlist, setCancelNotifyWaitlist] = useState(false);
  const [waitlistCountForDate, setWaitlistCountForDate] = useState(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // ── Actions ──
  const openCancelModal = async (id: string) => {
    setCancelModalId(id);
    setCancelNotifyWaitlist(true);
    // Check waitlist count for this appointment's date
    try {
      const res = await fetch("/api/me/waitlist", { headers: authHeaders() });
      const data = await res.json();
      const appt = appointments.find(a => a.id === id);
      const entries = (data.waitlist || []).filter((w: { preferredDate: string | null }) =>
        !w.preferredDate || w.preferredDate === appt?.date
      );
      setWaitlistCountForDate(entries.length);
    } catch { setWaitlistCountForDate(0); }
  };

  const cancelAppointment = async () => {
    if (!cancelModalId) return;
    setCancellingId(cancelModalId);
    try {
      await fetch(`/api/appointments/${cancelModalId}/cancel`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ cancelledBy: "shop", notifyWaitlist: cancelNotifyWaitlist }),
      });
      const appt = appointments.find(a => a.id === cancelModalId);
      // Open wa.me links for waitlist clients if toggle is on
      if (cancelNotifyWaitlist && waitlistCountForDate > 0 && appt) {
        try {
          const res = await fetch("/api/me/waitlist", { headers: authHeaders() });
          const data = await res.json();
          const entries = (data.waitlist || []).filter((w: { preferredDate: string | null }) =>
            !w.preferredDate || w.preferredDate === appt.date
          );
          const dateFormatted = new Date(appt.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
          for (const entry of entries.slice(0, 3)) {
            const phone = entry.clientPhone.replace(/\D/g, "");
            const phoneWA = phone.startsWith("55") ? phone : `55${phone}`;
            const msg = encodeURIComponent(
              `Oi ${entry.clientName}! 🎉\nAbriu uma vaga no dia ${dateFormatted} às ${appt.startTime}.\nAgende agora: ${bookingLink}`
            );
            window.open(`https://wa.me/${phoneWA}?text=${msg}`, "_blank");
          }
        } catch { /* ignore */ }
      }
      setCancelModalId(null);
      toast.success("Agendamento cancelado");
      fetchAppointments();
    } catch { toast.error("Erro ao cancelar"); }
    finally { setCancellingId(null); }
  };

  const markNoShow = async (id: string, clientName: string) => {
    if (!(await confirmar({
      titulo: `${clientName} não veio?`,
      texto: "A falta fica registrada no cadastro do cliente. Com duas faltas, ele passa a precisar pagar antes de agendar.",
      acao: "Registrar falta",
      perigo: true,
    }))) return;
    try {
      await fetch(`/api/appointments/${id}/no-show`, { method: "PATCH", headers: authHeaders() });
      toast.success("Falta registrada");
      fetchAppointments();
    } catch { toast.error("Erro ao registrar"); }
  };

  const confirmPixPayment = async (id: string) => {
    if (!(await confirmar({
      titulo: "O Pix caiu na conta?",
      texto: "Confirme só depois de ver o dinheiro. O agendamento passa a valer e a falta anterior do cliente é zerada.",
      acao: "Sim, recebi",
    }))) return;
    try {
      const res = await fetch(`/api/appointments/${id}/confirm-payment`, { method: "PATCH", headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { toast.success("Pix confirmado — agendamento garantido"); fetchAppointments(); return; }
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Erro ao confirmar");
      if (d.slotTaken) fetchAppointments();
    } catch { toast.error("Erro ao confirmar"); }
  };

  // Lembrete manual via WhatsApp (zero custo, funciona no PWA e no APK)
  const remindClient = (appt: Appointment) => {
    const phone = (appt.client?.phone || "").replace(/\D/g, "");
    if (phone.length < 10) { toast.error("Cliente sem telefone válido"); return; }
    const phoneWA = phone.startsWith("55") ? phone : `55${phone}`;
    const dateFmt = new Date(appt.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
    const services = appt.services.map(s => s.name).join(", ");
    const msg = encodeURIComponent(
      `Olá ${appt.client?.name?.split(" ")[0] || ""}! 🫡\n` +
      `Passando pra lembrar do seu horário na ${user?.shopName || "barbearia"}:\n\n` +
      `📆 ${dateFmt} às ${appt.startTime}\n` +
      `💇‍♂️ ${services}\n\n` +
      `Até lá! Deus abençoe 🙏`
    );
    window.open(`https://wa.me/${phoneWA}?text=${msg}`, "_blank");
  };

  const handleConfirmPayment = async (appointmentId: string) => {
    if (!token) return;
    setConfirmingPayId(appointmentId);
    try {
      const body: Record<string, unknown> = { appointmentId, paymentMethod };
      if (removedServiceIds.length > 0) body.removedServiceIds = removedServiceIds;
      if (customPrice !== "") body.customPrice = parseFloat(customPrice);
      const res = await fetch("/api/me/finance", { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { setPayingId(null); setRemovedServiceIds([]); setCustomPrice(""); toast.success("Pagamento confirmado"); fetchAppointments(); }
      else toast.error("Erro ao confirmar pagamento");
    } catch { toast.error("Erro ao confirmar pagamento"); }
    finally { setConfirmingPayId(null); }
  };

  const saveClientNote = async (clientId: string, note: string) => {
    setSavingNote(clientId);
    try { await fetch(`/api/me/clients/${clientId}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ notes: note || null }) }); }
    catch {} setSavingNote(null);
  };

  const handleToggleBarber = async (barberId: string, active: boolean) => {
    try { await fetch("/api/auth/add-barber", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ barberId, active }) }); fetchBarbers(); }
    catch { toast.error("Erro ao atualizar barbeiro"); }
  };

  const handleResetBarberPassword = async (barberId: string) => {
    if (resetPassword.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres"); return; }
    setResettingBarber(true);
    try {
      const res = await fetch("/api/auth/add-barber", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ barberId, newPassword: resetPassword }) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { toast.success("Senha do barbeiro redefinida"); setResetBarberId(null); setResetPassword(""); }
      else { const d = await res.json(); toast.error(d.error || "Erro ao redefinir"); }
    } catch { toast.error("Erro ao redefinir"); } finally { setResettingBarber(false); }
  };

  const handleAddBarber = async () => {
    if (!newBarberName.trim() || !newBarberPhone.trim() || newBarberPassword.length < 6) { toast.error("Preencha todos os campos (senha min 6)"); return; }
    setAddingBarber(true);
    try {
      const res = await fetch("/api/auth/add-barber", { method: "POST", headers: authHeaders(), body: JSON.stringify({ name: newBarberName, phone: newBarberPhone.replace(/\D/g, ""), password: newBarberPassword, commission: newBarberCommission ? parseFloat(newBarberCommission) : 0, email: newBarberEmail.trim() }) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { setNewBarberName(""); setNewBarberPhone(""); setNewBarberPassword(""); setNewBarberCommission(""); setNewBarberEmail(""); toast.success("Barbeiro adicionado"); fetchBarbers(); }
      else { const d = await res.json(); toast.error(d.error || "Erro ao adicionar"); }
    } catch { toast.error("Erro ao adicionar"); } finally { setAddingBarber(false); }
  };

  const toggleSlot = async (time: string) => {
    if (!slotData || slotData.booked.includes(time)) return;
    setSlotsSaving(true);
    const bid = user?.role === "owner" && ownerBarberId ? ownerBarberId : undefined;
    const isBlocked = slotData.blocked.includes(time);
    try {
      await fetch("/api/me/blocked-slots", {
        method: isBlocked ? "DELETE" : "POST",
        headers: authHeaders(),
        body: JSON.stringify({ date: availDate, times: [time], ...(bid ? { barberId: bid } : {}) }),
      });
      setSlotData(prev => prev ? {
        ...prev,
        blocked: isBlocked ? prev.blocked.filter(t => t !== time) : [...prev.blocked, time],
        allDay: false,
      } : prev);
    } catch { toast.error("Erro ao atualizar horário"); }
    finally { setSlotsSaving(false); }
  };

  const blockAllDay = async () => {
    if (!(await confirmar({
      titulo: "Bloquear o dia inteiro?",
      texto: "Nenhum horário deste dia vai aparecer para o cliente agendar. Dá para liberar depois.",
      acao: "Bloquear o dia",
    }))) return;
    setSlotsSaving(true);
    const bid = user?.role === "owner" && ownerBarberId ? ownerBarberId : undefined;
    try {
      await fetch("/api/me/blocked-slots", { method: "POST", headers: authHeaders(), body: JSON.stringify({ date: availDate, allDay: true, ...(bid ? { barberId: bid } : {}) }) });
      setSlotData(prev => prev ? { ...prev, allDay: true, blocked: [...prev.allSlots] } : prev);
      toast.success("Dia bloqueado");
    } catch { toast.error("Erro ao bloquear"); } finally { setSlotsSaving(false); }
  };

  const unblockAllDay = async () => {
    setSlotsSaving(true);
    const bid = user?.role === "owner" && ownerBarberId ? ownerBarberId : undefined;
    try {
      await fetch("/api/me/blocked-slots", { method: "DELETE", headers: authHeaders(), body: JSON.stringify({ date: availDate, allDay: true, ...(bid ? { barberId: bid } : {}) }) });
      setSlotData(prev => prev ? { ...prev, allDay: false, blocked: [] } : prev);
      toast.success("Dia liberado");
    } catch { toast.error("Erro ao liberar"); } finally { setSlotsSaving(false); }
  };

  const deleteClient = async (id: string, name: string) => {
    if (!(await confirmar({
      titulo: `Apagar todos os dados de ${name}?`,
      texto:
        "Some agendamentos, fidelidade e histórico deste cliente NESTA barbearia.\n\n" +
        "Não tem volta — é o direito ao esquecimento da LGPD.",
      acao: "Apagar tudo",
      perigo: true,
    }))) return;
    setDeletingClientId(id);
    try {
      const res = await fetch(`/api/me/clients/${id}`, { method: "DELETE", headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { toast.success("Dados do cliente excluídos"); setClients(prev => prev.filter(c => c.id !== id)); }
      else { const d = await res.json(); toast.error(d.error || "Erro ao excluir"); }
    } catch { toast.error("Erro ao excluir"); }
    finally { setDeletingClientId(null); }
  };

  const removeFromWaitlist = async (id: string) => {
    setRemovingWaitId(id);
    try { await fetch(`/api/me/waitlist/${id}`, { method: "DELETE", headers: authHeaders() }); setWaitlist(prev => prev.filter(e => e.id !== id)); }
    catch { toast.error("Erro ao remover da lista"); } setRemovingWaitId(null);
  };

  const handleAddService = async () => {
    if (!newService.name.trim() || !newService.price) { toast.error("Preencha nome e preço"); return; }
    setAddingService(true);
    try {
      const res = await fetch("/api/me/services", { method: "POST", headers: authHeaders(), body: JSON.stringify({ name: newService.name, duration: parseInt(newService.duration), price: parseFloat(newService.price), category: newService.category }) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { setNewService({ name: "", duration: "30", price: "", category: "corte" }); toast.success("Serviço adicionado"); fetchServices(); }
      else { const d = await res.json(); toast.error(d.error || "Erro ao adicionar"); }
    } catch { toast.error("Erro ao adicionar"); } finally { setAddingService(false); }
  };

  const abrirEdicaoServico = (s: ServiceItem) =>
    setEditService({ id: s.id, name: s.name, price: String(s.price), duration: String(s.duration), category: s.category, imageUrl: s.imageUrl || "" });

  /** Foto do corte: sobe e ja grava no servico, para o cliente ver no agendamento. */
  const trocarFotoServico = async (file: File | null) => {
    if (!file || !editService) return;
    setUploadingServiceImg(true);
    try {
      const url = await enviarImagem(file);
      if (!url) return;
      const res = await fetch("/api/me/services", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ id: editService.id, imageUrl: url }) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { setEditService(p => p && ({ ...p, imageUrl: url })); toast.success("Foto atualizada"); fetchServices(); }
      else toast.error("Erro ao salvar a foto");
    } finally { setUploadingServiceImg(false); }
  };

  const removerFotoServico = async () => {
    if (!editService) return;
    setUploadingServiceImg(true);
    try {
      const res = await fetch("/api/me/services", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ id: editService.id, imageUrl: null }) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { setEditService(p => p && ({ ...p, imageUrl: "" })); toast.success("Foto removida"); fetchServices(); }
    } finally { setUploadingServiceImg(false); }
  };

  const salvarEdicaoServico = async () => {
    if (!editService) return;
    if (!editService.name.trim() || !editService.price) { toast.error("Preencha nome e preço"); return; }
    setSavingService(true);
    try {
      const res = await fetch("/api/me/services", {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({
          id: editService.id,
          name: editService.name.trim(),
          price: parseFloat(editService.price),
          duration: parseInt(editService.duration) || 30,
          category: editService.category,
        }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { toast.success("Serviço atualizado"); setEditService(null); fetchServices(); }
      else { const d = await res.json(); toast.error(d.error || "Erro ao salvar"); }
    } catch { toast.error("Erro ao salvar"); } finally { setSavingService(false); }
  };

  const excluirServico = async (s: ServiceItem) => {
    if (!(await confirmar({
      titulo: `Apagar "${s.name}"?`,
      texto: "O serviço some da lista para sempre. Se ele já foi usado em atendimento, eu aviso antes de fazer qualquer coisa.",
      acao: "Apagar",
      perigo: true,
    }))) return;
    setDeletingService(s.id);
    try {
      const res = await fetch("/api/me/services", {
        method: "DELETE", headers: authHeaders(), body: JSON.stringify({ id: s.id }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const d = await res.json().catch(() => ({}));

      // 409 = servico ja usado em atendimento. Apagar quebraria o historico,
      // entao oferecemos desativar, que resolve o problema real do dono
      // (sumir da tela do cliente) sem mexer no que ja aconteceu.
      if (res.status === 409) {
        const ok = await confirmar({
          titulo: "Melhor desativar que apagar",
          texto:
            `"${s.name}" já foi usado em ${d.usos} atendimento${d.usos === 1 ? "" : "s"}. ` +
            "Apagar levaria esses atendimentos junto e o financeiro deixaria de fechar.\n\n" +
            "Desativando, ele some da tela do cliente e o histórico fica intacto.",
          acao: "Desativar",
          cancelar: "Deixar como está",
        });
        if (ok) await toggleService(s.id, false);
        return;
      }
      if (res.ok) { toast.success("Serviço apagado"); setEditService(null); fetchServices(); }
      else toast.error(d.error || "Erro ao apagar");
    } catch { toast.error("Erro ao apagar"); } finally { setDeletingService(null); }
  };

  // ── Banir cliente ──
  const banirCliente = async (telefone: string, nome?: string, motivo?: string) => {
    const tel = (telefone || "").replace(/\D/g, "");
    if (tel.length < 10) { toast.error("Telefone inválido"); return; }
    if (!(await confirmar({
      titulo: `Banir ${nome || tel}?`,
      texto:
        "Ele para de conseguir agendar e de entrar na lista de espera desta barbearia, " +
        "e os agendamentos futuros dele são cancelados.\n\n" +
        "O histórico e o financeiro não mudam. Dá para liberar depois.",
      acao: "Banir",
      perigo: true,
    }))) return;

    setBaningClient(true);
    try {
      const res = await fetch("/api/me/banned-clients", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ phone: tel, name: nome, reason: motivo || undefined }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "Erro ao banir"); return; }
      toast.success(
        d.agendamentosCancelados > 0
          ? `Cliente banido · ${d.agendamentosCancelados} agendamento(s) cancelado(s)`
          : "Cliente banido"
      );
      setNovoBanido({ phone: "", reason: "" });
      fetchBanned();
      if (subView === "clientes") fetchClients();
      fetchAppointments();
    } catch { toast.error("Erro ao banir"); } finally { setBaningClient(false); }
  };

  const desbanirCliente = async (telefone: string) => {
    try {
      const res = await fetch("/api/me/banned-clients", {
        method: "DELETE", headers: authHeaders(), body: JSON.stringify({ phone: telefone }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { toast.success("Cliente liberado"); fetchBanned(); }
      else toast.error("Erro ao liberar");
    } catch { toast.error("Erro ao liberar"); }
  };

  const estaBanido = (telefone: string) => banned.some(b => b.phone === (telefone || "").replace(/\D/g, ""));

  // ── Barbeiro: editar perfil, foto e e-mail ──
  const abrirEdicaoBarbeiro = (b: Barber) =>
    setEditBarber({ id: b.id, name: b.name, email: b.email || "", commission: String(b.commission ?? 0), imageUrl: b.imageUrl || "", isOwnerProfile: !!b.isOwnerProfile });

  const salvarBarbeiro = async () => {
    if (!editBarber) return;
    if (!editBarber.name.trim()) { toast.error("Informe o nome"); return; }
    setSavingBarber(true);
    try {
      const res = await fetch("/api/auth/add-barber", {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ barberId: editBarber.id, name: editBarber.name.trim(), email: editBarber.email.trim(), commission: Number(editBarber.commission) || 0 }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { toast.success("Perfil atualizado"); setEditBarber(null); fetchBarbers(); }
      else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Erro ao salvar"); }
    } catch { toast.error("Erro ao salvar"); } finally { setSavingBarber(false); }
  };

  /** A foto e o motivo de o dono ter perfil de barbeiro: e ela que o cliente ve. */
  const trocarFotoBarbeiro = async (file: File | null) => {
    if (!file || !editBarber) return;
    setUploadingBarberImg(true);
    try {
      const url = await enviarImagem(file);
      if (!url) return;
      const res = await fetch("/api/auth/add-barber", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ barberId: editBarber.id, imageUrl: url }) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { setEditBarber(p => p && ({ ...p, imageUrl: url })); toast.success("Foto atualizada"); fetchBarbers(); }
      else toast.error("Erro ao salvar a foto");
    } finally { setUploadingBarberImg(false); }
  };

  const removerFotoBarbeiro = async () => {
    if (!editBarber) return;
    setUploadingBarberImg(true);
    try {
      const res = await fetch("/api/auth/add-barber", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ barberId: editBarber.id, imageUrl: null }) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { setEditBarber(p => p && ({ ...p, imageUrl: "" })); toast.success("Foto removida"); fetchBarbers(); }
    } finally { setUploadingBarberImg(false); }
  };

  // ── Produtos ──
  const handleAddProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.price) { toast.error("Preencha nome e preço"); return; }
    setAddingProduct(true);
    try {
      const res = await fetch("/api/me/products", { method: "POST", headers: authHeaders(), body: JSON.stringify({ name: newProduct.name.trim(), price: parseFloat(newProduct.price), custo: newProduct.custo.trim() || null, description: newProduct.description.trim() || null }) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { setNewProduct({ name: "", price: "", custo: "", description: "" }); toast.success("Produto adicionado"); fetchProducts(); }
      else { const d = await res.json(); toast.error(d.error || "Erro ao adicionar"); }
    } catch { toast.error("Erro ao adicionar"); } finally { setAddingProduct(false); }
  };

  const abrirEdicaoProduto = (p: ProductItem) =>
    setEditProduct({ id: p.id, name: p.name, price: String(p.price), custo: p.custo === null ? "" : String(p.custo), description: p.description || "", imageUrl: p.imageUrl || "" });

  const salvarEdicaoProduto = async () => {
    if (!editProduct) return;
    if (!editProduct.name.trim() || !editProduct.price) { toast.error("Preencha nome e preço"); return; }
    setSavingProduct(true);
    try {
      const res = await fetch("/api/me/products", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ id: editProduct.id, name: editProduct.name.trim(), price: parseFloat(editProduct.price), custo: editProduct.custo.trim() === "" ? null : editProduct.custo.trim(), description: editProduct.description.trim() || null }) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { toast.success("Produto atualizado"); setEditProduct(null); fetchProducts(); }
      else { const d = await res.json(); toast.error(d.error || "Erro ao salvar"); }
    } catch { toast.error("Erro ao salvar"); } finally { setSavingProduct(false); }
  };

  const toggleProduct = async (id: string, active: boolean) => {
    try { await fetch("/api/me/products", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ id, active }) }); fetchProducts(); }
    catch { toast.error("Erro ao atualizar produto"); }
  };

  const excluirProduto = async (p: ProductItem) => {
    if (!(await confirmar({
      titulo: `Apagar "${p.name}"?`,
      texto: "O produto some da lista para sempre. Se ele já foi vendido, eu aviso antes de fazer qualquer coisa.",
      acao: "Apagar",
      perigo: true,
    }))) return;
    setDeletingProduct(p.id);
    try {
      const res = await fetch("/api/me/products", { method: "DELETE", headers: authHeaders(), body: JSON.stringify({ id: p.id }) });
      if (res.status === 401) { handleUnauthorized(); return; }
      const d = await res.json().catch(() => ({}));
      // 409 = produto ja vendido. Apagar levaria as linhas de comanda junto.
      if (res.status === 409) {
        const ok = await confirmar({
          titulo: "Melhor desativar que apagar",
          texto:
            `"${p.name}" já foi vendido em ${d.usos} atendimento${d.usos === 1 ? "" : "s"}. ` +
            "Apagar levaria essas vendas junto e o financeiro deixaria de fechar.\n\n" +
            "Desativando, ele some da comanda e o histórico fica intacto.",
          acao: "Desativar",
          cancelar: "Deixar como está",
        });
        if (ok) await toggleProduct(p.id, false);
        return;
      }
      if (res.ok) { toast.success("Produto apagado"); setEditProduct(null); fetchProducts(); }
      else toast.error(d.error || "Erro ao apagar");
    } catch { toast.error("Erro ao apagar"); } finally { setDeletingProduct(null); }
  };

  const trocarFotoProduto = async (file: File | null) => {
    if (!file || !editProduct) return;
    setUploadingProductImg(true);
    try {
      const url = await enviarImagem(file);
      if (!url) return;
      const res = await fetch("/api/me/products", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ id: editProduct.id, imageUrl: url }) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { setEditProduct(p => p && ({ ...p, imageUrl: url })); toast.success("Foto atualizada"); fetchProducts(); }
      else toast.error("Erro ao salvar a foto");
    } finally { setUploadingProductImg(false); }
  };

  const removerFotoProduto = async () => {
    if (!editProduct) return;
    setUploadingProductImg(true);
    try {
      const res = await fetch("/api/me/products", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ id: editProduct.id, imageUrl: null }) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { setEditProduct(p => p && ({ ...p, imageUrl: "" })); toast.success("Foto removida"); fetchProducts(); }
    } finally { setUploadingProductImg(false); }
  };

  const toggleService = async (id: string, active: boolean) => {
    try { await fetch("/api/me/services", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ id, active }) }); fetchServices(); }
    catch { toast.error("Erro ao atualizar serviço"); }
  };

  // O intervalo é da barbearia inteira, não do dia aberto na tela — por
  // isso salva em /api/me/shop e não em blocked-slots.
  const mudarIntervalo = async (min: number) => {
    try {
      const res = await fetch("/api/me/shop", {
        method: "PATCH", headers: authHeaders(), body: JSON.stringify({ slotInterval: min }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) { toast.error("Não consegui mudar o intervalo"); return; }
      setShopSettings(p => p ? { ...p, slotInterval: min } : p);
      toast.success(min >= 60 ? "Agenda de 1 em 1 hora" : `Agenda de ${min} em ${min} minutos`);
    } catch { toast.error("Erro de conexão"); }
  };

  const saveShopSettings = async () => {
    if (!shopSettings) return;
    setSavingSettings(true);
    try {
      const res = await fetch("/api/me/shop", { method: "PATCH", headers: authHeaders(), body: JSON.stringify(shopSettings) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Erro ao salvar"); return; }
      // O nome vive tambem no admin_user (cabecalho do painel). Sem atualizar
      // aqui, o dono troca o nome e continua vendo o antigo ate deslogar.
      const d = await res.json().catch(() => ({}));
      if (d.shop?.name) {
        setUser(u => (u ? { ...u, shopName: d.shop.name } : u));
        try {
          const bruto = localStorage.getItem("admin_user");
          if (bruto) {
            const obj = JSON.parse(bruto);
            obj.shopName = d.shop.name;
            localStorage.setItem("admin_user", JSON.stringify(obj));
          }
        } catch { /* localStorage indisponivel: o cabecalho corrige no proximo login */ }
      }
      if (res.status === 401) { handleUnauthorized(); return; }
      toast.success("Configurações salvas!");
    } catch { toast.error("Erro ao salvar"); }
    finally { setSavingSettings(false); }
  };

  /** Sobe uma imagem e devolve a URL publica. null = falhou (ja avisou o usuario). */
  const enviarImagem = useCallback(async (file: File): Promise<string | null> => {
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) { toast.error("Use uma imagem (JPG, PNG ou WEBP)"); return null; }
    if (file.size > 3 * 1024 * 1024) { toast.error("Imagem muito grande (máx 3MB)"); return null; }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/me/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (up.status === 401) { handleUnauthorized(); return null; }
      const d = await up.json();
      if (!up.ok || !d.url) { toast.error(d.error || "Falha no upload"); return null; }
      return d.url as string;
    } catch { toast.error("Erro no upload"); return null; }
  }, [token, handleUnauthorized]);

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) { toast.error("Use uma imagem (JPG, PNG ou WEBP)"); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error("Imagem muito grande (máx 3MB)"); return; }
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/me/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (up.status === 401) { handleUnauthorized(); return; }
      const upData = await up.json();
      if (!up.ok || !upData.url) { toast.error(upData.error || "Falha no upload"); return; }
      // Salva a URL no shop
      const patch = await fetch("/api/me/shop", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ logoUrl: upData.url }) });
      if (patch.ok) { setShopSettings(p => p ? { ...p, logoUrl: upData.url } : p); toast.success("Logo atualizado!"); }
      else toast.error("Erro ao salvar logo");
    } catch { toast.error("Erro no upload"); }
    finally { setUploadingLogo(false); }
  };

  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    try {
      const patch = await fetch("/api/me/shop", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ logoUrl: null }) });
      if (patch.ok) { setShopSettings(p => p ? { ...p, logoUrl: "" } : p); toast.success("Logo removido"); }
      else toast.error("Erro ao remover");
    } catch { toast.error("Erro ao remover"); }
    finally { setUploadingLogo(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres"); return; }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/me/password", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ currentPassword, newPassword }) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) { toast.success("Senha alterada com sucesso!"); setCurrentPassword(""); setNewPassword(""); }
      else { const d = await res.json(); toast.error(d.error || "Erro ao alterar senha"); }
    } catch { toast.error("Erro ao alterar senha"); } finally { setChangingPassword(false); }
  };

  /**
   * Compartilhar o link.
   *
   * No celular, o menu nativo é o certo: o barbeiro escolhe WhatsApp,
   * Instagram, ou o contato que quiser, sem sair do app. Onde não existe
   * (desktop, navegador antigo), cai no WhatsApp Web, que é para onde ele
   * ia de qualquer jeito.
   */
  const trocarJanelaDaAgenda = async (dias: number) => {
    if (!shopSettings) return;
    const anterior = shopSettings.diasAbertos;
    // Otimista: o seletor mexe na hora e volta atrás se o servidor recusar.
    setShopSettings({ ...shopSettings, diasAbertos: dias });
    setSalvandoJanela(true);
    try {
      const res = await fetch("/api/me/shop", {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ diasAbertos: dias }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Agenda aberta por ${dias} dias`);
    } catch {
      setShopSettings(s => (s ? { ...s, diasAbertos: anterior } : s));
      toast.error("Não deu para salvar. Tente de novo.");
    } finally {
      setSalvandoJanela(false);
    }
  };

  /**
   * Status do WhatsApp em dois toques.
   *
   * Nenhum sistema pode postar no Status de alguém — o WhatsApp não tem API
   * para isso. Então a imagem do dia vem pronta e o botão abre o compartilhar
   * do celular: o barbeiro escolhe WhatsApp → Meu status, e o link vai junto
   * na legenda. No computador (sem compartilhar arquivo) a imagem é baixada
   * e o link copiado.
   */
  const postarStatus = async () => {
    if (!user?.shopSlug) return;
    setPreparandoStatus(true);
    try {
      const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
      const r = await fetch(`/api/status/${user.shopSlug}?d=${hoje}`);
      if (!r.ok) throw new Error("imagem");
      const blob = await r.blob();
      const arquivo = new File([blob], `status-${hoje}.png`, { type: "image/png" });
      const legenda = `Agende seu horário: ${bookingLink}`;
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], text: legenda });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = arquivo.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        await navigator.clipboard?.writeText(legenda).catch(() => {});
        toast.info("Imagem baixada e link copiado. Poste no Status pelo WhatsApp do celular.");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("Não consegui preparar a imagem de hoje. Tente de novo.");
    } finally {
      setPreparandoStatus(false);
    }
  };

  const compartilharLink = async () => {
    const texto = `Agende seu horário na ${user?.shopName || "barbearia"} pelo link:`;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };

    if (nav.share) {
      try {
        await nav.share({ title: user?.shopName || "Agendamento", text: texto, url: bookingLink });
        return;
      } catch (e) {
        // Cancelar o menu nativo não é erro — só não faz nada
        if ((e as Error)?.name === "AbortError") return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto + " " + bookingLink)}`, "_blank");
  };

  const handleLogout = () => { limparAgendas(); localStorage.removeItem("admin_token"); localStorage.removeItem("admin_user"); localStorage.removeItem("admin_token_renewed_at"); router.push("/admin"); };

  const isAppointmentPast = (dateStr: string, startTime: string) => {
    const [h, m] = startTime.split(":").map(Number);
    const apptDate = new Date(dateStr + "T12:00:00");
    apptDate.setHours(h, m, 0, 0);
    return new Date() > apptDate;
  };

  // ── Helpers ──
  const getDateStrip = () => { const dates: string[] = []; const today = new Date(); for (let i = 0; i < 14; i++) { const d = new Date(today); d.setDate(d.getDate() + i); dates.push(d.toISOString().split("T")[0]); } return dates; };
  const formatDateLabel = (dateStr: string) => { const d = new Date(dateStr + "T12:00:00"); return { weekday: d.toLocaleDateString("pt-BR", { weekday: "short" }), day: d.toLocaleDateString("pt-BR", { day: "2-digit" }), month: d.toLocaleDateString("pt-BR", { month: "short" }) }; };
  const bookingLink = typeof window !== "undefined" && user?.shopSlug ? `${window.location.origin}/${user.shopSlug}` : "";

  if (!token) return (<div className="flex min-h-screen items-center justify-center bg-hud-bg"><div className="h-10 w-10 animate-spin rounded-full border-4 border-hud-accent border-t-transparent" /></div>);

  // ── Quick Actions (like mobile) ──
  // Atalhos da home: so o que o barbeiro abre no dia a dia.
  const quickActions = [
    { icon: "agenda" as NomeIcone, label: "Agenda", onClick: () => setActiveTab("agenda") },
    { icon: "dinheiro" as NomeIcone, label: "Financeiro", onClick: () => setActiveTab("financeiro") },
    { icon: "usuarios" as NomeIcone, label: "Clientes", onClick: () => { setSubView("clientes"); setActiveTab("home"); } },
    { icon: "presente" as NomeIcone, label: "Fidelidade", onClick: () => { setSubView("fidelidade"); setActiveTab("home"); } },
    { icon: "busca" as NomeIcone, label: "Sumidos", onClick: () => { setSubView("sumidos"); setActiveTab("home"); } },
    { icon: "mais" as NomeIcone, label: "Novo agendamento", onClick: () => { setSubView("fixos"); setActiveTab("home"); } },
    { icon: "mensagem" as NomeIcone, label: msgsNaoLidas > 0 ? `Mensagens (${msgsNaoLidas})` : "Mensagens", onClick: () => { setSubView("mensagens"); setActiveTab("home"); } },
    ...(user?.role === "owner" ? [
      { icon: "relogio" as NomeIcone, label: "Lista Espera", onClick: () => { setSubView("espera"); setActiveTab("home"); } },
    ] : []),
  ];

  // Cada cartao carrega o VALOR atual, nao so o nome. E o que transforma a
  // engrenagem em painel — e o que teria denunciado, sem abrir nada, que a
  // troca de horario do Eduardo nunca chegou ao banco.
  type Cartao = {
    view: Exclude<ConfigView, null> | null;
    sub?: SubView;
    icon: NomeIcone;
    label: string;
    valor: string;
    pendente?: boolean;
  };

  const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

  /** "seg a sab" quando os dias sao seguidos, "seg, qua, sex" quando nao sao. */
  const resumirDias = (dias: number[]): string => {
    if (!dias || dias.length === 0) return "nenhum dia";
    if (dias.length === 7) return "todo dia";
    const ord = [...dias].sort((a, b) => a - b);
    const seguidos = ord.every((d, i) => i === 0 || d === ord[i - 1] + 1);
    return seguidos && ord.length > 2
      ? `${DIAS_CURTOS[ord[0]]} a ${DIAS_CURTOS[ord[ord.length - 1]]}`
      : ord.map(d => DIAS_CURTOS[d]).join(", ");
  };

  const cartoesCadastro: Cartao[] = user?.role === "owner" ? [
    { view: null, sub: "serviços", icon: "tesoura", label: "Serviços",
      valor: resumo ? (resumo.servicos === 0 ? "nenhum" : `${resumo.servicos} ativo${resumo.servicos > 1 ? "s" : ""}`) : "—",
      pendente: !!resumo && resumo.servicos === 0 },
    { view: null, sub: "produtos", icon: "presente", label: "Produtos",
      valor: resumo ? (resumo.produtos === 0 ? "nenhum" : `${resumo.produtos} ativo${resumo.produtos > 1 ? "s" : ""}`) : "—",
      pendente: !!resumo && resumo.produtos === 0 },
    { view: null, sub: "barbeiros", icon: "usuarios", label: "Barbeiros",
      valor: resumo ? (resumo.barbeirosSemFoto > 0 ? `${resumo.barbeirosSemFoto} sem foto` : `${resumo.barbeiros} com foto`) : "—",
      pendente: !!resumo && resumo.barbeirosSemFoto > 0 },
    { view: "banidos", icon: "bloqueio", label: "Banidos",
      valor: resumo ? (resumo.banidos === 0 ? "nenhum" : String(resumo.banidos)) : "—" },
  ] : [];

  const cartoesBarbearia: Cartao[] = user?.role === "owner" ? [
    { view: "dados", icon: "inicio", label: "Dados da barbearia",
      valor: resumo ? (resumo.temEndereco ? "endereço ok" : "sem endereço") : "—",
      pendente: !!resumo && !resumo.temEndereco },
    { view: "pagamento", icon: "cartao", label: "Pagamento",
      valor: resumo ? (resumo.pagamento.mercadoPago ? "Pix automático" : resumo.pagamento.pixManual ? "Pix manual" : "sem Pix") : "—",
      pendente: !!resumo && !resumo.pagamento.mercadoPago && !resumo.pagamento.pixManual },
    { view: "aparencia", icon: "paleta", label: "Aparência",
      valor: resumo ? (resumo.temLogo ? "logo enviada" : "sem logo") : "—",
      pendente: !!resumo && !resumo.temLogo },
  ] : [];

  const cartoesConta: Cartao[] = [
    { view: "notificações", icon: "sino", label: "Notificações",
      valor: resumo ? (resumo.notificacoes > 0 ? `${resumo.notificacoes} aparelho${resumo.notificacoes > 1 ? "s" : ""}` : "desligadas") : "—",
      pendente: !!resumo && resumo.notificacoes === 0 },
    { view: "senha", icon: "cadeado", label: "Senha", valor: "trocar e recuperar" },
  ];

  const abrirCartao = (c: Cartao) => {
    if (c.sub) { setSubView(c.sub); setActiveTab("home"); return; }
    if (c.view) setConfigView(c.view);
  };


  // ── Render SubViews ──
  const renderSubView = () => {
    if (!subView) return null;
    const TITULO_SUB: Record<string, string> = { barbeiros: "Barbeiros", "serviços": "Serviços", produtos: "Produtos", mensagens: "Mensagens", clientes: "Clientes", sumidos: "Clientes sumidos", fidelidade: "Fidelidade", espera: "Lista de espera", fixos: "Novo agendamento" };
    const backBtn = <div className="mb-2"><ScreenHeader titulo={TITULO_SUB[subView] || ""} onVoltar={() => setSubView(null)} /></div>;

    // ─── BARBEIROS ───
    if (subView === "barbeiros") return (
      <div className="space-y-6">{backBtn}
        <div className="hud-card p-5 space-y-3">
          <h3 className="font-semibold text-hud-text">Adicionar barbeiro</h3>
          <input type="text" placeholder="Nome *" value={newBarberName} onChange={e => setNewBarberName(e.target.value)} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none transition-colors" />
          <input type="tel" placeholder="Telefone (com DDD) *" value={newBarberPhone} onChange={e => setNewBarberPhone(e.target.value)} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none transition-colors" />
          <input type="email" placeholder="E-mail (opcional)" value={newBarberEmail} onChange={e => setNewBarberEmail(e.target.value)} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none transition-colors" />
          <input type="password" placeholder="Senha (min 6) *" value={newBarberPassword} onChange={e => setNewBarberPassword(e.target.value)} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none transition-colors" />
          <div className="relative">
            <input type="number" min="0" max="100" placeholder="Comissão (%)" value={newBarberCommission} onChange={e => setNewBarberCommission(e.target.value)} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 pr-10 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none transition-colors" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-hud-muted text-sm">%</span>
          </div>
          <button onClick={handleAddBarber} disabled={addingBarber} className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all">{addingBarber ? "Adicionando..." : "Adicionar barbeiro"}</button>
        </div>
        {barbersLoading ? <Spinner /> : barbers.length === 0 ? <p className="text-center text-hud-muted py-6">Nenhum barbeiro cadastrado</p> : (
          <div className="space-y-3">
            {barbers.map(b => (
              <div key={b.id} className={`rounded border bg-hud-surface p-4 ${b.active ? "border-hud-border" : "border-hud-border opacity-60"}`}>
                <div className="flex items-center gap-4">
                  {b.imageUrl
                    ? <img src={b.imageUrl} alt={b.name} className="w-10 h-10 rounded-full object-cover border border-[color-mix(in_srgb,var(--hud-accent)_30%,transparent)] shrink-0" />
                    : <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] flex items-center justify-center text-hud-light font-semibold text-lg shrink-0">{b.name.charAt(0).toUpperCase()}</div>}
                  <button onClick={() => abrirEdicaoBarbeiro(b)} className="flex-1 min-w-0 text-left group">
                    <p className="font-medium text-hud-text group-hover:text-hud-light transition">
                      {b.name}
                      {b.isOwnerProfile && <span className="ml-2 text-xs font-normal text-hud-light border border-[color-mix(in_srgb,var(--hud-accent)_40%,transparent)] rounded px-1.5 py-0.5">você</span>}
                      {!b.imageUrl && <span className="ml-2 text-xs font-normal text-hud-warn">sem foto</span>}
                    </p>
                    <p className="text-sm text-hud-muted">{b.phone}{(b.commission ?? 0) > 0 && <span className="ml-2 text-hud-light">· {b.commission}%</span>}</p>
                  </button>
                  <button onClick={() => { setResetBarberId(resetBarberId === b.id ? null : b.id); setResetPassword(""); }} title="Redefinir senha" aria-label="Redefinir senha" className="hud-focus shrink-0 w-11 h-11 rounded border border-hud-border flex items-center justify-center text-hud-muted hover:text-hud-light hover:border-hud-accent transition"><Icon nome="cadeado" tamanho={18} /></button>
                  {!b.isOwnerProfile && (
                    <button onClick={() => handleToggleBarber(b.id, !b.active)} className={`w-12 h-6 rounded-full transition-colors shrink-0 ${b.active ? "gold-fill" : "bg-[var(--hud-track)]"}`}><div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${b.active ? "translate-x-6" : "translate-x-0.5"}`} /></button>
                  )}
                </div>
                {resetBarberId === b.id && (
                  <div className="mt-3 pt-3 border-t border-hud-border space-y-2">
                    <p className="text-xs text-hud-muted">Nova senha para <span className="text-hud-text font-medium">{b.name}</span></p>
                    <div className="flex gap-2">
                      <input type="text" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="flex-1 rounded bg-hud-bg border border-hud-border px-3 py-2 text-sm text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
                      <button onClick={() => handleResetBarberPassword(b.id)} disabled={resettingBarber} className="rounded gold-fill px-4 py-2 text-sm font-semibold text-[var(--hud-on-accent)] hover:brightness-105 disabled:opacity-50 transition">{resettingBarber ? "..." : "Salvar"}</button>
                    </div>
                    <p className="text-xs text-hud-muted">Anote e envie a nova senha para o barbeiro por WhatsApp.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Modal gaveta largura="max-w-md" aberto={!!editBarber} onFechar={() => setEditBarber(null)}>{editBarber && (<>
              <h3 className="font-display text-xl leading-tight text-hud-text">{editBarber.isOwnerProfile ? "Seu perfil de barbeiro" : "Editar barbeiro"}</h3>

              <div>
                <label className="text-xs text-hud-muted mb-1 block">Foto</label>
                <div className="flex items-center gap-3">
                  {editBarber.imageUrl
                    ? <img src={editBarber.imageUrl} alt={editBarber.name} className="w-16 h-16 rounded-full object-cover border border-[color-mix(in_srgb,var(--hud-accent)_30%,transparent)] shrink-0" />
                    : <div className="w-16 h-16 rounded-full bg-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] border border-hud-border flex items-center justify-center text-2xl text-hud-light font-semibold shrink-0">{editBarber.name.charAt(0).toUpperCase()}</div>}
                  <div className="flex-1 space-y-2">
                    <label className={`block text-center rounded border border-[color-mix(in_srgb,var(--hud-accent)_50%,transparent)] py-2 text-sm text-hud-light hover:bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] transition cursor-pointer ${uploadingBarberImg ? "opacity-50 pointer-events-none" : ""}`}>
                      {uploadingBarberImg ? "Enviando..." : editBarber.imageUrl ? "Trocar foto" : "Enviar foto"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingBarberImg} onChange={e => trocarFotoBarbeiro(e.target.files?.[0] || null)} />
                    </label>
                    {editBarber.imageUrl && (
                      <button onClick={removerFotoBarbeiro} disabled={uploadingBarberImg} className="hud-focus min-h-[44px] w-full rounded border border-hud-border py-2 text-xs text-hud-muted hover:text-hud-err transition disabled:opacity-50">Remover foto</button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-hud-muted mt-2">O cliente vê essa foto na hora de escolher o profissional.</p>
              </div>

              <div>
                <label className="text-xs text-hud-muted mb-1 block">Nome</label>
                <input type="text" value={editBarber.name} onChange={e => setEditBarber(p => p && ({ ...p, name: e.target.value }))} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text focus:border-hud-accent focus:outline-none" />
              </div>

              <div>
                <label className="text-xs text-hud-muted mb-1 block">E-mail</label>
                <input type="email" value={editBarber.email} onChange={e => setEditBarber(p => p && ({ ...p, email: e.target.value }))} placeholder="opcional" className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
              </div>

              <div>
                <label className="text-xs text-hud-muted mb-1 block">Comissão (%)</label>
                <input type="number" min="0" max="100" value={editBarber.commission} onChange={e => setEditBarber(p => p && ({ ...p, commission: e.target.value }))} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text focus:border-hud-accent focus:outline-none" />
              </div>

              <button onClick={salvarBarbeiro} disabled={savingBarber} className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all">{savingBarber ? "Salvando..." : "Salvar"}</button>
              <button onClick={() => setEditBarber(null)} className="w-full text-sm text-hud-muted hover:text-hud-soft transition py-1">Cancelar</button>
            </>)}</Modal>
      </div>
    );

    // ─── SERVICOS ───
    if (subView === "serviços") return (
      <div className="space-y-6">{backBtn}
        <div className="hud-card p-5 space-y-3">
          <h3 className="font-semibold text-hud-text">Adicionar serviço</h3>
          <input type="text" placeholder="Nome do serviço *" value={newService.name} onChange={e => setNewService(p => ({...p, name: e.target.value}))} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none transition-colors" />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Preço *" value={newService.price} onChange={e => setNewService(p => ({...p, price: e.target.value}))} className="rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
            <input type="number" placeholder="Duração (min)" value={newService.duration} onChange={e => setNewService(p => ({...p, duration: e.target.value}))} className="rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button key={key} onClick={() => setNewService(p => ({...p, category: key}))} className={`px-3 py-2 rounded text-sm border transition ${newService.category === key ? "border-hud-accent bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] text-hud-light" : "border-hud-border text-hud-muted"}`}><Icon nome={CATEGORY_ICONS[key] || "tesoura"} tamanho={14} className="mr-1 inline-block align-[-2px]" />{label}</button>
            ))}
          </div>
          <button onClick={handleAddService} disabled={addingService} className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all">{addingService ? "Adicionando..." : "Adicionar Serviço"}</button>
        </div>
        {servicesLoading ? <Spinner /> : services.length === 0 ? <p className="text-center text-hud-muted py-6">Nenhum serviço cadastrado</p> : (
          <div className="space-y-3">
            {services.map(s => (
              <div key={s.id} className={`flex items-center gap-4 rounded border bg-hud-surface p-4 ${s.active ? "border-hud-border" : "border-hud-border opacity-60"}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-hud-border text-hud-accent"><Icon nome={CATEGORY_ICONS[s.category] || "tesoura"} /></span>
                {/* Editar e apagar vivem no modal, que abre ao tocar no nome.
                    Com os dois botões aqui, ícone e toggle sobrando, o texto
                    era espremido a 28px numa tela de 320 — o nome do serviço
                    não cabia em lugar nenhum. */}
                <button onClick={() => abrirEdicaoServico(s)} className="flex-1 min-w-0 text-left group">
                  <p className="font-medium text-hud-text group-hover:text-hud-light transition truncate">{s.name}</p>
                  <p className="text-sm text-hud-muted truncate">R$ {s.price.toFixed(2)} · {s.duration}min · {CATEGORY_LABELS[s.category] || s.category}</p>
                </button>
                <button onClick={() => toggleService(s.id, !s.active)} title={s.active ? "Desativar" : "Ativar"} className={`w-12 h-6 rounded-full transition-colors shrink-0 ${s.active ? "gold-fill" : "bg-[var(--hud-track)]"}`}><div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${s.active ? "translate-x-6" : "translate-x-0.5"}`} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Modal de edicao — 100vw/100vh inline porque position:fixed sozinho
            se dimensiona pelo documento, nao pela viewport, e o modal some */}
        <Modal gaveta largura="max-w-md" aberto={!!editService} onFechar={() => setEditService(null)}>{editService && (<>
              <h3 className="font-display text-xl leading-tight text-hud-text">Editar serviço</h3>

              <div>
                <label className="text-xs text-hud-muted mb-1 block">Nome</label>
                <input type="text" value={editService.name} autoFocus
                  onChange={e => setEditService(p => p && ({ ...p, name: e.target.value }))}
                  className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-hud-muted mb-1 block">Preço (R$)</label>
                  <input type="number" inputMode="decimal" value={editService.price}
                    onChange={e => setEditService(p => p && ({ ...p, price: e.target.value }))}
                    className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text focus:border-hud-accent focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-hud-muted mb-1 block">Duração (min)</label>
                  <input type="number" inputMode="numeric" value={editService.duration}
                    onChange={e => setEditService(p => p && ({ ...p, duration: e.target.value }))}
                    className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text focus:border-hud-accent focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="text-xs text-hud-muted mb-1 block">Categoria</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <button key={key} onClick={() => setEditService(p => p && ({ ...p, category: key }))}
                      className={`px-3 py-2 rounded text-sm border transition ${editService.category === key ? "border-hud-accent bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] text-hud-light" : "border-hud-border text-hud-muted"}`}>
                      <Icon nome={CATEGORY_ICONS[key] || "tesoura"} tamanho={14} className="mr-1 inline-block align-[-2px]" />{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Foto do corte — e ela que o cliente ve na hora de escolher o servico */}
              <div>
                <label className="text-xs text-hud-muted mb-1 block">Foto do corte</label>
                <div className="flex items-center gap-3">
                  {editService.imageUrl ? (
                    <img src={editService.imageUrl} alt={editService.name} className="w-16 h-16 rounded object-cover border border-[color-mix(in_srgb,var(--hud-accent)_30%,transparent)] shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded bg-hud-bg border border-hud-border flex items-center justify-center text-2xl shrink-0"><Icon nome="imagem" tamanho={18} /></div>
                  )}
                  <div className="flex-1 space-y-2">
                    <label className={`block text-center rounded border border-[color-mix(in_srgb,var(--hud-accent)_50%,transparent)] py-2 text-sm text-hud-light hover:bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] transition cursor-pointer ${uploadingServiceImg ? "opacity-50 pointer-events-none" : ""}`}>
                      {uploadingServiceImg ? "Enviando..." : editService.imageUrl ? "Trocar foto" : "Enviar foto"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingServiceImg} onChange={e => trocarFotoServico(e.target.files?.[0] || null)} />
                    </label>
                    {editService.imageUrl && (
                      <button onClick={removerFotoServico} disabled={uploadingServiceImg} className="hud-focus min-h-[44px] w-full rounded border border-hud-border py-2 text-xs text-hud-muted hover:text-hud-err transition disabled:opacity-50">Remover foto</button>
                    )}
                  </div>
                </div>
              </div>

              <button onClick={salvarEdicaoServico} disabled={savingService}
                className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all">
                {savingService ? "Salvando..." : "Salvar alterações"}
              </button>

              <div className="pt-3 border-t border-hud-border space-y-2">
                <button onClick={() => { const alvo = services.find(x => x.id === editService.id); if (alvo) excluirServico(alvo); }}
                  disabled={deletingService === editService.id}
                  className="w-full rounded border border-[color-mix(in_srgb,var(--hud-err)_30%,transparent)] py-2.5 text-sm text-hud-err hover:bg-[color-mix(in_srgb,var(--hud-err)_10%,transparent)] disabled:opacity-50 transition">
                  {deletingService === editService.id ? "Apagando..." : "Apagar este serviço"}
                </button>
                <button onClick={() => setEditService(null)} className="w-full text-sm text-hud-muted hover:text-hud-soft transition py-1">
                  Cancelar
                </button>
              </div>
            </>)}</Modal>
      </div>
    );

    // ─── PRODUTOS ───
    if (subView === "produtos") return (
      <div className="space-y-6">{backBtn}
        <div className="hud-card p-5 space-y-3">
          <h3 className="font-semibold text-hud-text">Adicionar produto</h3>
          <input type="text" placeholder="Nome do produto *" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none transition-colors" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" inputMode="decimal" placeholder="Preço de venda *" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
            {/* Sem o custo nao ha margem — e margem de produto costuma ser
                a surpresa que faz o dono mudar o que compra. */}
            <input type="number" inputMode="decimal" placeholder="Quanto custou" value={newProduct.custo} onChange={e => setNewProduct(p => ({ ...p, custo: e.target.value }))} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
          </div>
          <input type="text" placeholder="Descrição (opcional)" value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
          <p className="text-xs text-hud-muted">A foto você adiciona depois, tocando no produto.</p>
          <button onClick={handleAddProduct} disabled={addingProduct} className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all">{addingProduct ? "Adicionando..." : "Adicionar produto"}</button>
        </div>

        {productsLoading ? <Spinner /> : products.length === 0 ? <p className="text-center text-hud-muted py-6">Nenhum produto cadastrado</p> : (
          <div className="space-y-3">
            {products.map(p => (
              <div key={p.id} className={`flex items-center gap-3 rounded border bg-hud-surface p-4 ${p.active ? "border-hud-border" : "border-hud-border opacity-60"}`}>
                {p.imageUrl
                  ? <img src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded object-cover shrink-0" />
                  : <div className="w-12 h-12 rounded bg-hud-bg border border-hud-border flex items-center justify-center text-xl shrink-0"><Icon nome="imagem" tamanho={18} /></div>}
                <button onClick={() => abrirEdicaoProduto(p)} className="flex-1 min-w-0 text-left group">
                  <p className="font-medium text-hud-text group-hover:text-hud-light transition truncate">{p.name}</p>
                  <p className="text-sm text-hud-muted truncate">R$ {p.price.toFixed(2)}{p.description ? ` · ${p.description}` : ""}</p>
                </button>
                <button onClick={() => toggleProduct(p.id, !p.active)} title={p.active ? "Desativar" : "Ativar"} className={`w-12 h-6 rounded-full transition-colors shrink-0 ${p.active ? "gold-fill" : "bg-[var(--hud-track)]"}`}><div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${p.active ? "translate-x-6" : "translate-x-0.5"}`} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Modal de edição — 100vw/100vh inline porque position:fixed sozinho
            se dimensiona pelo documento, não pela viewport */}
        <Modal gaveta largura="max-w-md" aberto={!!editProduct} onFechar={() => setEditProduct(null)}>{editProduct && (<>
              <h3 className="font-display text-xl leading-tight text-hud-text">Editar produto</h3>

              <div>
                <label className="text-xs text-hud-muted mb-1 block">Nome</label>
                <input type="text" value={editProduct.name} autoFocus onChange={e => setEditProduct(p => p && ({ ...p, name: e.target.value }))} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text focus:border-hud-accent focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-hud-muted mb-1 block">Preço (R$)</label>
                <input type="number" inputMode="decimal" value={editProduct.price} onChange={e => setEditProduct(p => p && ({ ...p, price: e.target.value }))} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text focus:border-hud-accent focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-hud-muted mb-1">Quanto custou</label>
                <input type="number" inputMode="decimal" value={editProduct.custo} onChange={e => setEditProduct(p => p && ({ ...p, custo: e.target.value }))} placeholder="Deixe vazio se não souber" className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
                {editProduct.custo.trim() !== "" && parseFloat(editProduct.price) > 0 && parseFloat(editProduct.custo) >= 0 && (
                  <p className="mt-1.5 text-xs text-hud-muted">
                    Margem de{" "}
                    <span className="font-semibold text-hud-ok">
                      {(parseFloat(editProduct.price) - parseFloat(editProduct.custo)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>{" "}
                    ({Math.round(((parseFloat(editProduct.price) - parseFloat(editProduct.custo)) / parseFloat(editProduct.price)) * 100)}%)
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs text-hud-muted mb-1 block">Descrição</label>
                <input type="text" value={editProduct.description} onChange={e => setEditProduct(p => p && ({ ...p, description: e.target.value }))} placeholder="Opcional" className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
              </div>

              <div>
                <label className="text-xs text-hud-muted mb-1 block">Foto do produto</label>
                <div className="flex items-center gap-3">
                  {editProduct.imageUrl
                    ? <img src={editProduct.imageUrl} alt={editProduct.name} className="w-16 h-16 rounded object-cover border border-[color-mix(in_srgb,var(--hud-accent)_30%,transparent)] shrink-0" />
                    : <div className="w-16 h-16 rounded bg-hud-bg border border-hud-border flex items-center justify-center text-2xl shrink-0"><Icon nome="imagem" tamanho={18} /></div>}
                  <div className="flex-1 space-y-2">
                    <label className={`block text-center rounded border border-[color-mix(in_srgb,var(--hud-accent)_50%,transparent)] py-2 text-sm text-hud-light hover:bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] transition cursor-pointer ${uploadingProductImg ? "opacity-50 pointer-events-none" : ""}`}>
                      {uploadingProductImg ? "Enviando..." : editProduct.imageUrl ? "Trocar foto" : "Enviar foto"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingProductImg} onChange={e => trocarFotoProduto(e.target.files?.[0] || null)} />
                    </label>
                    {editProduct.imageUrl && (
                      <button onClick={removerFotoProduto} disabled={uploadingProductImg} className="hud-focus min-h-[44px] w-full rounded border border-hud-border py-2 text-xs text-hud-muted hover:text-hud-err transition disabled:opacity-50">Remover foto</button>
                    )}
                  </div>
                </div>
              </div>

              <button onClick={salvarEdicaoProduto} disabled={savingProduct} className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all">{savingProduct ? "Salvando..." : "Salvar alterações"}</button>

              <div className="pt-3 border-t border-hud-border space-y-2">
                <button onClick={() => { const alvo = products.find(x => x.id === editProduct.id); if (alvo) excluirProduto(alvo); }} disabled={deletingProduct === editProduct.id} className="w-full rounded border border-[color-mix(in_srgb,var(--hud-err)_30%,transparent)] py-2.5 text-sm text-hud-err hover:bg-[color-mix(in_srgb,var(--hud-err)_10%,transparent)] disabled:opacity-50 transition">{deletingProduct === editProduct.id ? "Apagando..." : "Apagar este produto"}</button>
                <button onClick={() => setEditProduct(null)} className="w-full text-sm text-hud-muted hover:text-hud-soft transition py-1">Cancelar</button>
              </div>
            </>)}</Modal>
      </div>
    );

    // ─── CORTE FIXO ───
    //
    // O cliente que vem toda semana no mesmo horario. O barbeiro cria UMA regra
    // e as ocorrencias nascem sozinhas conforme a agenda avanca — nao existe
    // "criar 52 agendamentos".
    if (subView === "mensagens") {
      return (
        <div className="space-y-6">{backBtn}
          <Mensagens
            token={token}
            onVoltar={() => setSubView(null)}
            onUnauthorized={handleUnauthorized}
            onMudou={buscarNaoLidas}
          />
        </div>
      );
    }

    if (subView === "fixos") {
      return (
        <div className="space-y-6">{backBtn}
          <NovoAgendamento
            token={token}
            services={services}
            barbers={barbers}
            ehDono={user?.role === "owner"}
            onCriado={fetchAppointments}
            onUnauthorized={handleUnauthorized}
          />
        </div>
      );
    }
    // ─── CLIENTES ───
    if (subView === "clientes") {
      const filtered = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch));
      return (
        <div className="space-y-4">{backBtn}
          <input type="text" placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full rounded bg-hud-surface border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none transition-colors" />
          <div className="flex gap-2">
            <div className="hud-card flex-1 p-3 text-center"><p className="text-lg font-semibold text-hud-text">{clients.length}</p><p className="text-xs text-hud-muted">Total</p></div>
            <div className="hud-card flex-1 p-3 text-center"><p className="text-lg font-semibold text-hud-err">{clients.filter(c => c.noShowCount > 0).length}</p><p className="text-xs text-hud-muted">Com faltas</p></div>
          </div>
          {clientsLoading ? <Spinner /> : filtered.length === 0 ? <p className="text-center text-hud-muted py-6">Nenhum cliente encontrado</p> : (
            <div className="space-y-3">
              {filtered.map(c => (
                <div key={`${c.id}|${c.pessoa}`} className="hud-card p-4">
                  <div className="flex items-center justify-between">
                    <div><p className="font-semibold text-hud-text">{c.name}</p><p className="text-sm text-hud-muted">{c.phone}</p></div>
                    <div className="text-center"><p className="text-lg font-semibold text-hud-light">{c.totalAppointments}</p><p className="text-xs text-hud-muted">visitas</p></div>
                  </div>
                  {c.noShowCount > 0 && <p className="text-xs text-hud-err mt-2 flex items-center gap-1"><Icon nome="alerta" tamanho={13} /> {c.noShowCount} falta(s)</p>}
                  {c.notes && <p className="text-xs text-hud-muted mt-2 italic flex items-start gap-1"><Icon nome="editar" tamanho={13} className="mt-0.5 shrink-0" /> {c.notes}</p>}
                  {estaBanido(c.phone) && <p className="text-xs text-hud-err mt-2"><Icon nome="bloqueio" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Banido — não consegue agendar aqui</p>}
                  <div className="mt-3 pt-3 border-t border-hud-border flex items-center justify-between gap-3">
                    {user?.role === "owner" ? (
                      estaBanido(c.phone) ? (
                        <button onClick={() => desbanirCliente(c.phone)} className="text-xs text-hud-muted hover:text-hud-ok transition">✓ Liberar cliente</button>
                      ) : (
                        <button onClick={() => banirCliente(c.phone, c.name)} disabled={baningClient} className="text-xs text-hud-muted hover:text-hud-err transition disabled:opacity-50"><Icon nome="bloqueio" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Banir cliente</button>
                      )
                    ) : <span />}
                    <button onClick={() => deleteClient(c.id, c.name)} disabled={deletingClientId === c.id} className="hud-focus inline-flex min-h-[44px] items-center gap-1.5 text-xs text-hud-muted hover:text-hud-err transition disabled:opacity-50"><Icon nome="lixo" tamanho={14} />{deletingClientId === c.id ? "Excluindo..." : "Excluir dados (LGPD)"}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // ─── CLIENTES SUMIDOS ───
    if (subView === "sumidos") return (
      <div className="space-y-4">{backBtn}
        <Sumidos token={token} shopName={user?.shopName} bookingLink={bookingLink} />
      </div>
    );

    // ─── FIDELIDADE ───
    if (subView === "fidelidade") return (
      <div className="space-y-4">{backBtn}
        <div className="rounded bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-accent)_30%,transparent)] p-4">
          <p className="text-sm font-semibold text-hud-light mb-1">Como funciona</p>
          <p className="text-sm text-hud-muted">A cada atendimento pago, o cliente ganha 1 ponto. Ao completar 10, ofereça uma recompensa!</p>
        </div>
        {loyaltyLoading ? <Spinner /> : loyalties.length === 0 ? <div className="text-center py-12"><p className="text-4xl mb-3"><Icon nome="presente" tamanho={18} /></p><p className="text-hud-muted">Nenhum cliente com pontos ainda.</p></div> : (
          <div className="space-y-3">{loyalties.map(item => (
            <div key={item.clientPhone} className="hud-card p-4 space-y-3">
              <div className="flex items-center justify-between"><div><p className="font-semibold text-hud-text">{item.clientName}</p><p className="text-xs text-hud-muted">{item.clientPhone}</p></div><div className="text-center bg-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] rounded px-4 py-2"><p className="text-xl font-semibold text-hud-light">{item.count}</p><p className="text-xs text-hud-muted">cortes</p></div></div>
              <div className="flex gap-1.5">{Array.from({ length: 10 }).map((_, i) => (<div key={i} className={`flex-1 h-2 rounded-full ${i < item.progress ? "gold-fill" : "bg-[var(--hud-track)]"}`} />))}</div>
              <div className="flex items-center justify-between"><p className="text-xs text-hud-muted">{item.progress}/10</p>{item.rewardsEarned > 0 && <span className="text-xs bg-[color-mix(in_srgb,var(--hud-warn)_20%,transparent)] text-hud-warn px-2 py-1 rounded-full inline-flex items-center gap-1"><Icon nome="presente" tamanho={13} /> {item.rewardsEarned}</span>}</div>
            </div>
          ))}</div>
        )}
      </div>
    );

    // ─── LISTA ESPERA ───
    if (subView === "espera") return (
      <div className="space-y-4">{backBtn}
        <div className="rounded bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-accent)_30%,transparent)] p-4">
          <p className="text-sm text-hud-light"><Icon nome="sino" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Clientes aguardando vaga.</p>
          {/* O barbeiro não vai limpar a fila à mão, e não limpava: uma
              cliente ficou uma semana esperando um dia que já tinha
              passado. Agora sai sozinho — mas ele precisa SABER disso,
              senão continua achando que a lista é problema dele. */}
          <p className="text-xs text-hud-muted mt-1">
            Sai da lista sozinho quando o dia passa, e o cliente é avisado.
          </p>
        </div>
        {waitlistLoading ? <Spinner /> : waitlist.length === 0 ? <div className="text-center py-12 text-hud-muted"><p className="text-4xl mb-3"><Icon nome="relogio" tamanho={18} /></p><p>Nenhum cliente na lista</p></div> : (
          <div className="space-y-3">{waitlist.map(entry => (
            <div key={entry.id} className="hud-card p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0"><p className="font-semibold text-hud-text">{entry.clientName}</p><p className="text-sm text-hud-muted">{entry.clientPhone}</p>{entry.preferredDate && <p className="text-xs text-hud-light mt-1 flex flex-wrap items-center gap-1"><Icon nome="agenda" tamanho={13} /> Prefere: {new Date(entry.preferredDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}{entry.preferredDate === hojeISO() && <span className="text-hud-warn"> · último dia</span>}</p>}</div>
              <button onClick={() => removeFromWaitlist(entry.id)} disabled={removingWaitId === entry.id} className="text-xs text-hud-err border border-[color-mix(in_srgb,var(--hud-err)_30%,transparent)] rounded px-3 py-1.5 hover:bg-[color-mix(in_srgb,var(--hud-err)_10%,transparent)] disabled:opacity-50">{removingWaitId === entry.id ? "..." : "Remover"}</button>
            </div>
          ))}</div>
        )}
      </div>
    );

    return null;
  };

  return (
    <main className="min-h-screen hud-bg pb-20">
      {/* ── Header ── */}
      <header className="border-b border-hud-border bg-[color-mix(in_srgb,var(--hud-bg)_88%,transparent)] backdrop-blur-md px-4 py-2.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <img src={shopSettings?.logoUrl || "/logo.png"} alt="" className="w-11 h-11 rounded-full border border-hud-accent object-cover" />
          <div>
            <p className="text-xs text-hud-muted">{getGreeting()},</p>
            <h1 className="font-display text-xl leading-tight text-hud-text">{user?.name?.split(" ")[0] || "proprietário"}</h1>
            <p className="text-[11px] text-hud-muted truncate max-w-[52vw]">{user?.shopName || "Painel"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowQR(v => !v)} aria-label="Link e QR code de agendamento" aria-expanded={showQR} className="hud-focus flex h-11 w-11 items-center justify-center rounded border border-hud-border text-hud-accent"><Icon nome="qr" /></button>
          <button onClick={() => { setActiveTab("config"); setSubView(null); }} aria-label="Configurações" className="hud-focus flex h-11 w-11 items-center justify-center rounded border border-hud-border text-hud-muted hover:text-hud-text"><Icon nome="config" /></button>
        </div>
      </header>

      {/* ── QR/Link Panel ── */}
      {showQR && user?.shopSlug && (
        <div className="hud-card hud-corners mx-auto mt-3 max-w-2xl p-4 space-y-3 [margin-inline:16px] sm:[margin-inline:auto]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-hud-text text-sm">Link de agendamento</h3>
              <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--hud-ok)_15%,transparent)] border border-[color-mix(in_srgb,var(--hud-ok)_40%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-hud-ok tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-hud-ok" /> ONLINE
              </span>
            </div>
            <button onClick={() => setShowQR(false)} aria-label="Fechar" className="hud-focus -mr-2 flex h-11 w-11 items-center justify-center rounded text-hud-muted hover:text-hud-text"><Icon nome="fechar" /></button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-hud-bg border border-hud-border rounded px-3 py-2 text-sm text-hud-light truncate">{bookingLink}</div>
            <button onClick={() => { navigator.clipboard.writeText(bookingLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); }} className="rounded border border-hud-border text-hud-soft font-semibold px-3 py-2 text-sm hover:text-hud-text transition whitespace-nowrap">{linkCopied ? "Copiado" : "Copiar"}</button>
          </div>

          {/* O barbeiro pediu aqui, colado no link: é a tela que ele abre
              quando vai mandar o link para alguém, e é nessa hora que ele
              pensa em até quando quer receber marcação.

              Só o dono: a janela é da BARBEARIA, e a rota recusa barbeiro
              contratado. Mostrar para ele seria oferecer um botão que dá
              erro. */}
          {user?.role === "owner" && (
          <div className="flex items-center justify-between gap-3 rounded border border-hud-border bg-hud-bg px-3 py-2">
            <div>
              <p className="text-sm text-hud-soft">Agenda aberta até:</p>
              <p className="text-[11px] text-hud-muted">Vale só para o link. No painel você marca para qualquer data.</p>
            </div>
            <select
              value={shopSettings?.diasAbertos ?? 30}
              disabled={!shopSettings || salvandoJanela}
              onChange={(e) => trocarJanelaDaAgenda(parseInt(e.target.value))}
              className="rounded border border-hud-border bg-hud-surface text-hud-text text-sm px-3 py-2 disabled:opacity-50"
            >
              <option value={7}>7 dias</option>
              <option value={15}>15 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </div>
          )}

          <button
            onClick={compartilharLink}
            className="hud-focus w-full flex items-center justify-center gap-2 rounded gold-fill min-h-[48px] font-bold uppercase tracking-[0.08em] text-sm hover:brightness-105 transition"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4 20-7z" />
            </svg>
            Compartilhar link
          </button>
          <div className="flex flex-col items-center gap-3">
            <div ref={qrRef} className="bg-white rounded p-4"><QRCodeCanvas value={bookingLink} size={180} level="H" includeMargin={false} /></div>
            <button onClick={() => { const canvas = qrRef.current?.querySelector("canvas"); if (!canvas) return; const link = document.createElement("a"); link.download = `qrcode-${user.shopSlug}.png`; link.href = canvas.toDataURL("image/png"); link.click(); }} className="hud-focus inline-flex min-h-[44px] items-center gap-2 border border-hud-border text-hud-text font-bold rounded px-4 text-sm hover:border-hud-muted transition"><Icon nome="baixar" tamanho={16} /> Baixar QR Code</button>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* SubView takes over when active */}
        {subView ? renderSubView() : (
          <>
            {/* ═══════ HOME TAB ═══════ */}
            {activeTab === "home" && (
              <div className="space-y-5">
                {resumoAssinatura?.aviso && (resumoAssinatura.estado === "carencia" || resumoAssinatura.estado === "bloqueada" || resumoAssinatura.estado === "trial") && (
                  <button
                    onClick={() => { setActiveTab("config"); setConfigView("assinatura"); }}
                    className={`w-full rounded border p-4 text-left transition ${
                      resumoAssinatura.estado === "bloqueada"
                        ? "border-[color-mix(in_srgb,var(--hud-err)_50%,transparent)] bg-[color-mix(in_srgb,var(--hud-err)_10%,transparent)] hover:border-hud-err"
                        : resumoAssinatura.estado === "carencia"
                          ? "border-[color-mix(in_srgb,var(--hud-warn)_50%,transparent)] bg-[color-mix(in_srgb,var(--hud-warn)_10%,transparent)] hover:border-hud-warn"
                          : "border-[color-mix(in_srgb,var(--hud-info)_40%,transparent)] bg-[color-mix(in_srgb,var(--hud-info)_10%,transparent)] hover:border-hud-info"
                    }`}
                  >
                    <p className={`text-sm font-semibold ${
                      resumoAssinatura.estado === "bloqueada" ? "text-hud-err"
                      : resumoAssinatura.estado === "carencia" ? "text-hud-warn" : "text-hud-info"
                    }`}>
                      {resumoAssinatura.aviso}
                    </p>
                    <p className="text-xs text-hud-muted mt-1">Toque para ver os planos ›</p>
                  </button>
                )}

                {/* Status do WhatsApp de hoje — imagem pronta, dois toques */}
                {user?.shopSlug && (
                  <div className={`hud-card flex items-center gap-3 p-3 ${vindoDoAviso ? "hud-card-sel hud-corners" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/status/${user.shopSlug}?d=${new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })}`}
                      alt="Prévia da imagem de hoje para o Status"
                      className="h-[84px] w-[48px] shrink-0 rounded border border-hud-border object-cover bg-hud-surface"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="hud-eyebrow">Status de hoje</p>
                      <p className="text-sm text-hud-soft leading-snug">Imagem nova com os horários livres. Toque e escolha <b className="text-hud-text">Meu status</b>.</p>
                    </div>
                    <button
                      onClick={postarStatus}
                      disabled={preparandoStatus}
                      className="hud-focus gold-fill shrink-0 inline-flex min-h-[44px] items-center gap-1.5 rounded px-3 text-xs font-extrabold uppercase tracking-[0.06em] disabled:opacity-70"
                    >
                      {preparandoStatus ? <HudSpinner tamanho={14} sobreDestaque /> : <Icon nome="compartilhar" tamanho={16} />}
                      Postar
                    </button>
                  </div>
                )}

                <RecoveryNag token={token} onIrParaConfig={() => { setActiveTab("config"); setSubView(null); }} />

                {/* Quick Actions Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {quickActions.map(a => (
                    <button key={a.label} onClick={a.onClick} className="hud-card hud-focus flex min-h-[76px] flex-col items-center justify-center gap-1.5 py-3 px-1.5 hover:border-hud-accent transition-all">
                      <span className="text-hud-accent"><Icon nome={a.icon} tamanho={22} /></span>
                      <span className="text-[11px] font-semibold text-hud-soft leading-tight text-center">{a.label}</span>
                    </button>
                  ))}
                </div>

                {/* Date strip */}
                <div className="hud-noscroll flex gap-2 overflow-x-auto pb-1">
                  {getDateStrip().map(date => {
                    const { weekday, day } = formatDateLabel(date);
                    const isSelected = selectedDate === date;
                    const isToday = date === new Date().toISOString().split("T")[0];
                    return (
                      <button key={date} onClick={() => setSelectedDate(date)} aria-pressed={isSelected} className={`hud-focus flex-shrink-0 flex min-h-[64px] flex-col items-center justify-center rounded border px-3 py-2 text-center min-w-[54px] transition-all ${isSelected ? "hud-card-sel hud-corners border-hud-accent text-hud-light" : "hud-card text-hud-muted hover:border-hud-muted"}`}>
                        <span className="text-[11px] font-semibold uppercase">{weekday.replace(".", "")}</span>
                        <span className={`font-display text-2xl leading-none ${isSelected ? "gold-text" : "text-hud-text"}`}>{day}</span>
                        {isToday && <div className={`w-1 h-1 rounded-full mt-1 ${isSelected ? "gold-fill" : "bg-[var(--hud-text-2)]"}`} />}
                      </button>
                    );
                  })}
                </div>

                {/* Appointments */}
                {/* Sem conexão: dizer QUE é cópia e DE QUANDO. Sem isso o
                    barbeiro lê uma agenda velha como se fosse a de agora. */}
                {agendaSalvaEm !== null && (
                  <div className="rounded border border-[color-mix(in_srgb,var(--hud-warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--hud-warn)_10%,transparent)] px-4 py-3 text-sm text-hud-warn">
                    <p className="font-semibold">Sem conexão — agenda salva às {horaDaCopia(agendaSalvaEm)}</p>
                    <p className="text-[color-mix(in_srgb,var(--hud-warn)_80%,transparent)] text-xs mt-1">
                      Quem marcou depois disso não aparece aqui, e não dá para confirmar pagamento nem marcar horário até a internet voltar.
                    </p>
                  </div>
                )}
                {agendaSemCopia && (
                  <div className="rounded border border-[color-mix(in_srgb,var(--hud-err)_40%,transparent)] bg-[color-mix(in_srgb,var(--hud-err)_10%,transparent)] px-4 py-3 text-sm text-hud-err">
                    <p className="font-semibold">Sem conexão — não há cópia salva deste dia</p>
                    <p className="text-[color-mix(in_srgb,var(--hud-err)_80%,transparent)] text-xs mt-1">
                      A lista abaixo está vazia porque não deu para carregar, não porque o dia está livre.
                    </p>
                  </div>
                )}
                <SectionLabel>{appointments.length} agendamento{appointments.length !== 1 ? "s" : ""}</SectionLabel>
                {agendaLoading ? <Spinner /> : appointments.length === 0 ? (
                  <EmptyState erro={agendaSemCopia} icone={agendaSemCopia ? "alerta" : "agenda"} titulo={agendaSemCopia ? "Não foi possível carregar" : "Nenhum agendamento neste dia"} />
                ) : (
                  <div className="space-y-3">
                    {appointments.map(appt => {
                      const isPaid = !!appt.paidAt;
                      const isCancelled = appt.status === "cancelled";
                      const isNoShow = appt.status === "no_show";
                      const isPendingPix = appt.status === "pending_payment";
                      const isPayingThis = payingId === appt.id;
                      return (
                        <div key={appt.id} className={`hud-card p-4 space-y-3 transition-all ${isCancelled || isNoShow ? "opacity-60" : ""}`}>
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="gold-text font-display text-xl tabular-nums">{appt.startTime}</span>
                                <span className="text-xs text-hud-muted tabular-nums">até {appt.endTime}</span>
                                <span className="ml-auto whitespace-nowrap text-sm font-bold text-hud-light tabular-nums">R$ {appt.totalPrice?.toFixed(2).replace(".", ",")}</span>
                              </div>
                              <p className="font-semibold text-hud-text mt-1">{appt.client?.name}</p>
                              <p className="text-sm text-hud-muted">{appt.services.map(s => s.name).join(", ")}{appt.barberName ? ` · ${appt.barberName}` : ""}</p>
                              <p className="text-xs text-hud-muted">{appt.client?.phone}</p>
                              {appt.client?.pediuParar && <p className="text-xs text-hud-warn mt-1">Pediu para não receber lembretes</p>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[10px] font-bold px-2 py-[3px] rounded-[3px] ${appt.pendingExpired ? "text-hud-err border border-[color-mix(in_srgb,var(--hud-err)_60%,transparent)]" : (STATUS_COLORS[appt.status] || STATUS_COLORS.pending)}`}>{appt.pendingExpired ? "Pix expirado" : (STATUS_LABELS[appt.status] || appt.status)}</span>
                              {!isCancelled && !isNoShow && (
                                <div className="relative">
                                  <button
                                    onClick={() => setMenuAberto(menuAberto === appt.id ? null : appt.id)}
                                    aria-label="Mais opções"
                                    className="hud-focus flex h-11 w-11 items-center justify-center rounded text-hud-muted hover:text-hud-text transition"
                                  >
                                    <Icon nome="menu" />
                                  </button>
                                  {menuAberto === appt.id && (
                                    <>
                                      {/* Camada invisível: tocar fora fecha, sem precisar
                                          de listener global no documento. */}
                                      <div className="fixed inset-0 z-30" onClick={() => setMenuAberto(null)} />
                                      <div className="hud-card absolute right-0 top-11 z-40 w-56 p-1 shadow-[0_14px_40px_var(--hud-shadow)]">
                                        <button
                                          onClick={() => { setComandaDe(appt); setMenuAberto(null); }}
                                          className="hud-focus flex min-h-[44px] w-full items-center rounded px-3 text-left text-sm font-semibold text-hud-text hover:bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] transition"
                                        >
                                          <Icon nome="mais" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Adicionar produto
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* O que foi lançado precisa aparecer no card: produto que
                              só existe dentro de um modal é produto esquecido. */}
                          {(appt.comanda?.length ?? 0) > 0 && (
                            <div className="rounded bg-hud-bg border border-hud-border px-3 py-2">
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="text-xs font-semibold text-hud-muted">Produtos</span>
                                <span className="text-sm font-bold text-hud-light tabular-nums">
                                  R$ {(appt.comandaTotal ?? 0).toFixed(2)}
                                </span>
                              </div>
                              <p className="text-xs text-hud-muted mt-0.5">
                                {appt.comanda!.map(i => `${i.quantity > 1 ? `${i.quantity}× ` : ""}${i.name}`).join(", ")}
                              </p>
                            </div>
                          )}

                          {/* Pré-agendamento por Pix: dentro do prazo ou expirado */}
                          {isPendingPix && (
                            appt.pendingExpired ? (
                              <div className="bg-[color-mix(in_srgb,var(--hud-err)_6%,transparent)] border border-[color-mix(in_srgb,var(--hud-err)_40%,transparent)] rounded p-3 space-y-2">
                                <p className="text-sm text-hud-soft flex items-center gap-1.5"><Icon nome="relogio" tamanho={15} className="text-hud-err" /> Prazo do Pix expirou — o horário foi liberado</p>
                                <p className="text-xs text-hud-muted">O cliente tentou agendar mas o pagamento não foi confirmado a tempo. Se o Pix caiu depois, você ainda pode confirmar (se o horário continuar livre).</p>
                                <div className="flex gap-2">
                                  <button onClick={() => confirmPixPayment(appt.id)} className="hud-focus flex-1 min-h-[44px] rounded border border-hud-border text-sm font-bold text-hud-text hover:border-hud-muted transition">Confirmar mesmo assim</button>
                                  <button onClick={() => remindClient(appt)} className="flex-1 rounded border border-[color-mix(in_srgb,var(--hud-ok)_30%,transparent)] py-2 text-sm text-hud-ok hover:bg-[color-mix(in_srgb,var(--hud-ok)_10%,transparent)] transition"><Icon nome="mensagem" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Falar com o cliente</button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-[color-mix(in_srgb,var(--hud-warn)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-warn)_30%,transparent)] rounded p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm text-hud-warn"><Icon nome="relogio" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Cliente informou que pagou — confirme o Pix</p>
                                  {timeLeftLabel(appt.pendingExpiresAt) && (
                                    <span className="text-xs text-[color-mix(in_srgb,var(--hud-warn)_80%,transparent)] shrink-0 whitespace-nowrap">{timeLeftLabel(appt.pendingExpiresAt)}</span>
                                  )}
                                </div>
                                <p className="text-xs text-hud-muted">Se não confirmar dentro do prazo, o horário volta a ficar livre para outros clientes.</p>
                                <button onClick={() => confirmPixPayment(appt.id)} className="hud-focus w-full min-h-[44px] rounded bg-hud-warn text-sm font-extrabold text-[#0B0B14] hover:brightness-110 transition inline-flex items-center justify-center gap-1.5"><Icon nome="check" tamanho={16} traco={3} /> Confirmar Pix</button>
                              </div>
                            )
                          )}

                          {/* Action buttons: Cancel + No Show / Lembrar */}
                          {appt.status === "confirmed" && !isPayingThis && (
                            <div className="flex gap-2">
                              <button onClick={() => openCancelModal(appt.id)} className="flex-1 py-2 rounded border border-[color-mix(in_srgb,var(--hud-err)_30%,transparent)] bg-[color-mix(in_srgb,var(--hud-err)_10%,transparent)] text-sm text-hud-err font-medium hover:bg-[color-mix(in_srgb,var(--hud-err)_20%,transparent)] transition">Cancelar</button>
                              {isAppointmentPast(appt.date, appt.startTime) ? (
                                <button onClick={() => markNoShow(appt.id, appt.client?.name)} className="flex-1 py-2 rounded border border-[color-mix(in_srgb,var(--hud-warn)_30%,transparent)] bg-[color-mix(in_srgb,var(--hud-warn)_10%,transparent)] text-sm text-hud-warn font-medium hover:bg-[color-mix(in_srgb,var(--hud-warn)_20%,transparent)] transition">Não veio</button>
                              ) : (
                                <button onClick={() => remindClient(appt)} className="flex-1 py-2 rounded border border-[color-mix(in_srgb,var(--hud-ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--hud-ok)_10%,transparent)] text-sm text-hud-ok font-medium hover:bg-[color-mix(in_srgb,var(--hud-ok)_20%,transparent)] transition"><Icon nome="sino" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Lembrar</button>
                              )}
                            </div>
                          )}

                          {/* Payment flow */}
                          {!isCancelled && !isNoShow && !isPendingPix && (
                            <div>
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-[3px] bg-[color-mix(in_srgb,var(--hud-ok)_8%,transparent)] text-hud-ok border border-[color-mix(in_srgb,var(--hud-ok)_50%,transparent)]"><Icon nome="check" tamanho={12} traco={3} /> Pago {appt.paymentMethod ? `(${PAYMENT_LABELS[appt.paymentMethod] || appt.paymentMethod})` : ""}</span>
                              ) : isPayingThis ? (
                                <div className="space-y-3 pt-1">
                                  {appt.services.length > 0 && (
                                    <div className="space-y-1.5">
                                      <p className="text-xs text-hud-muted font-medium">Serviços realizados:</p>
                                      {appt.services.map(svc => {
                                        const removed = removedServiceIds.includes(svc.serviceId);
                                        return (<label key={svc.serviceId} className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={!removed} onChange={() => { setRemovedServiceIds(prev => removed ? prev.filter(id => id !== svc.serviceId) : [...prev, svc.serviceId]); setCustomPrice(""); }} className="w-5 h-5 accent-[var(--hud-accent)]" /><span className={`flex-1 text-sm ${removed ? "line-through text-hud-faint" : "text-hud-text"}`}>{svc.name}</span><span className={`text-sm font-medium ${removed ? "text-hud-faint" : "text-hud-light"}`}>R$ {svc.price.toFixed(2)}</span></label>);
                                      })}
                                    </div>
                                  )}
                                  {(appt.comandaTotal ?? 0) > 0 && (
                                    // O produto entra no que o cliente paga agora. Sem esta
                                    // linha o barbeiro confirma só o serviço e a pomada some.
                                    <p className="text-xs text-hud-muted">
                                      + R$ {(appt.comandaTotal ?? 0).toFixed(2)} em produtos
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2"><p className="text-xs text-hud-muted shrink-0">Valor (R$):</p><input type="number" min="0" step="0.01" value={customPrice !== "" ? customPrice : (appt.services.filter(s => !removedServiceIds.includes(s.serviceId)).reduce((sum, s) => sum + s.price, 0) + (appt.comandaTotal ?? 0)).toFixed(2)} onChange={e => setCustomPrice(e.target.value)} className="flex-1 rounded bg-hud-bg border border-hud-border px-3 py-1.5 text-sm text-hud-text focus:border-hud-accent focus:outline-none text-right" /></div>
                                  <p className="text-xs text-hud-muted">Forma de pagamento:</p>
                                  <div className="flex gap-2">{(["pix", "dinheiro", "cartao"] as const).map(m => (<button key={m} onClick={() => setPaymentMethod(m)} aria-pressed={paymentMethod === m} className={`hud-focus flex-1 min-h-[44px] rounded border text-sm transition-all ${paymentMethod === m ? "gold-fill border-transparent font-extrabold" : "border-hud-border text-hud-muted font-semibold"}`}>{PAYMENT_LABELS[m]}</button>))}</div>
                                  <div className="flex gap-2">
                                    <button onClick={() => { setPayingId(null); setRemovedServiceIds([]); setCustomPrice(""); }} className="flex-1 rounded border border-hud-border py-2 text-sm text-hud-muted hover:text-hud-text transition">Cancelar</button>
                                    <button disabled={confirmingPayId === appt.id} onClick={() => handleConfirmPayment(appt.id)} className="hud-focus flex-1 min-h-[44px] rounded gold-fill text-sm font-extrabold hover:brightness-105 disabled:opacity-50 transition-all">{confirmingPayId === appt.id ? "Salvando…" : "Confirmar"}</button>
                                  </div>
                                </div>
                              ) : appt.status === "confirmed" && (
                                <button onClick={() => { setPayingId(appt.id); setPaymentMethod("pix"); setRemovedServiceIds([]); setCustomPrice(""); }} className="hud-focus gold-fill w-full min-h-[48px] rounded text-sm font-extrabold uppercase tracking-[0.08em] hover:brightness-105 transition inline-flex items-center justify-center gap-2"><Icon nome="dinheiro" tamanho={18} /> Confirmar pagamento</button>
                              )}
                            </div>
                          )}

                          {/* CRM Notes */}
                          {!isCancelled && !isNoShow && (
                            <div className="pt-1 border-t border-hud-border">
                              <p className="text-xs text-hud-muted mb-1"><Icon nome="editar" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Notas</p>
                              <textarea rows={2} placeholder="Observações sobre o cliente..." value={clientNotes[appt.client.id] ?? (appt.client.notes || "")} onChange={e => setClientNotes(prev => ({...prev, [appt.client.id]: e.target.value}))} onBlur={() => saveClientNote(appt.client.id, clientNotes[appt.client.id] ?? (appt.client.notes || ""))} className="w-full rounded bg-hud-bg border border-hud-border px-3 py-2 text-sm text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none resize-none transition-colors" />
                              {savingNote === appt.client.id && <p className="text-xs text-hud-muted mt-1">Salvando...</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═══════ AGENDA (Availability) TAB ═══════ */}
            {activeTab === "agenda" && (
              <Agenda
                token={token}
                data={availDate}
                onMudarData={setAvailDate}
                barberId={user?.role === "owner" && ownerBarberId ? ownerBarberId : undefined}
                slotInterval={shopSettings?.slotInterval || 30}
                onMudarIntervalo={mudarIntervalo}
                onUnauthorized={handleUnauthorized}
              />
            )}

            {/* ═══════ FINANCEIRO TAB ═══════ */}
            {activeTab === "financeiro" && verDespesas && (
              <Despesas
                token={token}
                onVoltar={() => setVerDespesas(false)}
                onUnauthorized={handleUnauthorized}
                onMudou={() => setLucroVersao(v => v + 1)}
              />
            )}

            {activeTab === "financeiro" && !verDespesas && verAReceber && (
              <AReceber
                token={token}
                onVoltar={() => setVerAReceber(false)}
                onUnauthorized={handleUnauthorized}
                onPagou={() => { fetchDashboard(); fetchAppointments(); }}
              />
            )}

            {activeTab === "financeiro" && !verDespesas && !verAReceber && verRelatorio && (
              <Relatorio
                token={token}
                ehDono={user?.role === "owner"}
                nomeBarbearia={user?.shopName || "Barbearia"}
                barbeiros={barbers.map(b => ({ id: b.id, name: b.name }))}
                onVoltar={() => setVerRelatorio(false)}
                onUnauthorized={handleUnauthorized}
              />
            )}

            {activeTab === "financeiro" && !verDespesas && !verRelatorio && !verAReceber && user?.role === "owner" && (
              <div className="mb-5 space-y-4">
                {/* Antes de tudo: quanto sobrou. O resto do financeiro
                    responde perguntas menores que esta. */}
                <Lucro
                  token={token}
                  onUnauthorized={handleUnauthorized}
                  onVerDespesas={() => setVerDespesas(true)}
                  recarregar={lucroVersao}
                />
                <Ocupacao token={token} />
                <Conversao token={token} />
              </div>
            )}
            {activeTab === "financeiro" && !verDespesas && !verRelatorio && !verAReceber && (
              <div className="space-y-5">
                {/* O resumo responde "como estou indo". O relatorio responde
                    "quem me deve, como entrou, quanto pago de comissao" —
                    perguntas diferentes, telas diferentes. */}
                {totalAReceber && totalAReceber.total > 0 && (
                  <button
                    onClick={() => setVerAReceber(true)}
                    className={`w-full flex items-center gap-3 rounded border px-4 py-3.5 text-left transition press-scale ${
                      totalAReceber.promessasVencidas > 0
                        ? "border-[color-mix(in_srgb,var(--hud-err)_40%,transparent)] bg-[color-mix(in_srgb,var(--hud-err)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--hud-err)_10%,transparent)]"
                        : "border-[color-mix(in_srgb,var(--hud-warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--hud-warn)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--hud-warn)_10%,transparent)]"
                    }`}
                  >
                    <span className="text-xl shrink-0"><Icon nome="dinheiro" tamanho={18} /></span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm font-semibold ${totalAReceber.promessasVencidas > 0 ? "text-hud-err" : "text-hud-warn"}`}>
                        {totalAReceber.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} a receber
                      </span>
                      <span className="block text-xs text-hud-muted">
                        {totalAReceber.promessasVencidas > 0
                          ? `${totalAReceber.promessasVencidas} prometeu e não pagou`
                          : "Ver quem está devendo"}
                      </span>
                    </span>
                    <span className="text-hud-faint shrink-0">›</span>
                  </button>
                )}

                <button
                  onClick={() => setVerRelatorio(true)}
                  className="w-full flex items-center gap-3 rounded border border-[color-mix(in_srgb,var(--hud-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--hud-accent)_5%,transparent)] px-4 py-3.5 text-left hover:bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] transition press-scale"
                >
                  <span className="shrink-0 text-hud-accent"><Icon nome="ticket" tamanho={20} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-hud-light">Relatório por período</span>
                    <span className="block text-xs text-hud-muted">Quem deve, como entrou, comissões</span>
                  </span>
                  <span className="text-[color-mix(in_srgb,var(--hud-accent)_50%,transparent)] shrink-0">›</span>
                </button>

                {dashLoading ? <Spinner /> : !dashboard ? (
                  user?.role !== "owner" ? (
                    // Barbeiro contratado: o resumo do mês é da barbearia (do
                    // dono). O que é dele — atendimentos e comissão — está no
                    // relatório.
                    <EmptyState
                      icone="grafico"
                      titulo="Seu relatório"
                      texto="O resumo do mês da barbearia fica com o dono. Seus atendimentos e sua comissão estão no relatório."
                      acao={{ rotulo: "Ver meu relatório", onClick: () => setVerRelatorio(true) }}
                    />
                  ) : (
                    <EmptyState
                      erro
                      titulo="Não foi possível carregar"
                      texto="Confira a internet e tente de novo."
                      acao={{ rotulo: "Tentar de novo", onClick: fetchDashboard }}
                    />
                  )
                ) : (
                  <>
                    <div className="hud-card hud-corners p-5">
                      <p className="hud-eyebrow mb-1">{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
                      <p className="gold-text gold-glow font-display text-5xl tabular-nums">R$ {dashboard.month.revenue.toFixed(2).replace(".", ",")}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {dashboard.month.revenueGrowth !== null && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dashboard.month.revenueGrowth >= 0 ? "bg-[color-mix(in_srgb,var(--hud-ok)_20%,transparent)] text-hud-ok" : "bg-[color-mix(in_srgb,var(--hud-err)_20%,transparent)] text-hud-err"}`}>{dashboard.month.revenueGrowth >= 0 ? "▲" : "▼"} {Math.abs(dashboard.month.revenueGrowth)}%</span>}
                        {dashboard.month.toReceive > 0 && <span className="text-xs text-[color-mix(in_srgb,var(--hud-accent)_80%,transparent)]">+ R$ {dashboard.month.toReceive.toFixed(2)} a receber</span>}
                      </div>
                    </div>
                    <div><SectionLabel className="mb-2">Hoje</SectionLabel>
                      <div className="grid grid-cols-3 gap-2">
                        <StatBox value={`R$ ${dashboard.today.received.toFixed(2)}`} label="Recebido" color="text-hud-ok" />
                        <StatBox value={`${dashboard.today.appointments}`} label="Agendamentos" />
                        <StatBox value={`R$ ${dashboard.today.expected.toFixed(2)}`} label="A receber" color="text-hud-light" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <StatBox value={`${dashboard.month.appointments}`} label="Atendimentos" extra={dashboard.month.aptGrowth !== null ? `${dashboard.month.aptGrowth >= 0 ? "+" : ""}${dashboard.month.aptGrowth}%` : undefined} extraColor={dashboard.month.aptGrowth && dashboard.month.aptGrowth >= 0 ? "text-hud-ok" : "text-hud-err"} />
                      <StatBox value={`R$ ${dashboard.month.avgTicket.toFixed(2)}`} label="Ticket médio" />
                      <StatBox value={`${dashboard.month.cancelRate}%`} label="Cancelamentos" color={dashboard.month.cancelRate > 20 ? "text-hud-err" : dashboard.month.cancelRate > 10 ? "text-hud-warn" : "text-hud-ok"} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <StatBox value={`${dashboard.totalClients}`} label="Clientes" />
                      <StatBox value={dashboard.avgRating ? `${dashboard.avgRating} ★` : "—"} label="Avaliação" color="text-hud-warn" />
                      {dashboard.peakHour && <StatBox value={dashboard.peakHour} label="Pico" color="text-hud-light" />}
                    </div>
                    {dashboard.barberStats?.length > 0 && (
                      <div className="space-y-3">
                        <p className="hud-eyebrow">Ranking</p>
                        {dashboard.barberStats.map((b, i) => (
                          <div key={i} className="hud-card p-4 space-y-2">
                            <div className="flex items-center gap-3"><span className="text-hud-light font-semibold w-6">#{i+1}</span><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-hud-text truncate">{b.name}</p><p className="text-xs text-hud-muted">{b.count} atend.</p></div><p className="text-sm font-semibold text-hud-light">R$ {b.revenue.toFixed(2)}</p></div>
                            <div className="h-1.5 rounded-full bg-[var(--hud-track)]"><div className="h-1.5 rounded-full gold-fill transition-all" style={{ width: `${Math.round(b.revenueShare * 100)}%` }} /></div>
                            {b.commission > 0 && <div className="flex items-center justify-between bg-[color-mix(in_srgb,var(--hud-ok)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-ok)_20%,transparent)] rounded px-3 py-1.5"><span className="text-xs text-hud-ok">Comissao ({b.commission}%)</span><span className="text-xs font-semibold text-hud-ok">R$ {b.commissionValue.toFixed(2)}</span></div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ═══════ CONFIG TAB ═══════ */}
            {/* Antes era uma pilha de oito blocos numa rolagem só. O problema
                prático não era feiúra: o botão "Salvar" do horário ficava
                telas abaixo do campo de horário, então dava para trocar o
                horário, sair e achar que tinha salvo. Agora cada assunto é uma
                tela curta com o próprio botão à vista. */}
            {activeTab === "config" && (
              <div className="space-y-6">
                <ScreenHeader
                  titulo={configView ? CONFIG_TITULOS[configView] : "Configurações"}
                  onVoltar={() => (configView ? setConfigView(null) : setActiveTab("home"))}
                />

                {/* ─── Menu ─── */}
                {!configView && (
                  <>
                    {/* Cartões com o valor atual de cada coisa. Ler o estado da
                        barbearia sem abrir nada é o ponto — e um cartão que segue
                        mostrando o valor antigo denuncia na hora que a alteração
                        não salvou. */}
                    <button
                      onClick={() => setConfigView("horário")}
                      className="hud-card hud-corners hud-focus w-full p-4 text-left hover:border-hud-accent transition-all"
                    >
                      <p className="hud-label flex items-center gap-1.5"><Icon nome="relogio" tamanho={14} />Horário e dias</p>
                      <p className="mt-1 text-lg font-semibold text-hud-text tabular-nums">
                        {resumo
                          ? `${resumo.horario.openTime} – ${resumo.horario.closeTime} · ${resumirDias(resumo.horario.workDays)}`
                          : "—"}
                      </p>
                    </button>

                    {cartoesCadastro.length > 0 && (
                      <>
                        <SectionLabel>Cadastros</SectionLabel>
                        <div className="grid grid-cols-2 gap-2.5">
                          {cartoesCadastro.map(c => <TileConfig key={c.label} c={c} onClick={() => abrirCartao(c)} />)}
                        </div>
                      </>
                    )}

                    {cartoesBarbearia.length > 0 && (
                      <>
                        <SectionLabel>Barbearia</SectionLabel>
                        <div className="grid grid-cols-2 gap-2.5">
                          {cartoesBarbearia.map(c => <TileConfig key={c.label} c={c} onClick={() => abrirCartao(c)} />)}
                        </div>
                      </>
                    )}

                    {resumoAssinatura && (
                      <>
                        <SectionLabel>Plano</SectionLabel>
                        <button
                          onClick={() => setConfigView("assinatura")}
                          className={`w-full rounded border p-4 text-left transition-all press-scale ${
                            resumoAssinatura.estado === "bloqueada" || resumoAssinatura.estado === "carencia"
                              ? "border-[color-mix(in_srgb,var(--hud-warn)_50%,transparent)] bg-[color-mix(in_srgb,var(--hud-warn)_5%,transparent)] hover:border-hud-warn"
                              : "border-hud-border bg-hud-surface hover:border-hud-accent"
                          }`}
                        >
                          <p className="hud-label flex items-center gap-1.5"><Icon nome="estrela" tamanho={14} />Minha assinatura</p>
                          <p className={`mt-1 text-lg font-semibold ${
                            resumoAssinatura.estado === "bloqueada" ? "text-hud-err"
                            : resumoAssinatura.estado === "carencia" ? "text-hud-warn"
                            : resumoAssinatura.estado === "trial" ? "text-hud-info"
                            : "text-hud-text"
                          }`}>
                            {ROTULO_ASSINATURA[resumoAssinatura.estado] || resumoAssinatura.estado}
                            {resumoAssinatura.estado !== "cortesia" && (
                              <span className="text-sm font-normal text-hud-muted ml-2 tabular-nums">
                                {resumoAssinatura.diasRestantes}d
                              </span>
                            )}
                          </p>
                        </button>
                      </>
                    )}

                    <SectionLabel>Conta</SectionLabel>
                    <div className="grid grid-cols-2 gap-2.5">
                      {cartoesConta.map(c => <TileConfig key={c.label} c={c} onClick={() => abrirCartao(c)} />)}
                    </div>

                    {/* Logout */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="min-w-0">
                    <p className="text-sm text-hud-text truncate">{user?.name || "—"}</p>
                    <p className="text-xs text-hud-muted truncate">{user?.shopName}{user?.role === "owner" ? " · dono" : " · barbeiro"}</p>
                  </div>
                  <button onClick={handleLogout} className="hud-focus shrink-0 flex min-h-[44px] items-center gap-2 rounded border border-[color-mix(in_srgb,var(--hud-err)_45%,transparent)] px-4 text-sm font-bold text-hud-err hover:bg-[color-mix(in_srgb,var(--hud-err)_8%,transparent)] transition">
                    <Icon nome="sair" tamanho={16} /> Sair
                  </button>
                </div>

                    <p className="text-center text-xs text-hud-faint pb-4">BarberPro v2.0</p>
                  </>
                )}

                {/* ─── Dados da barbearia ─── */}
                {configView === "dados" && (
                  <>
                    {/* Identidade e endereco — o cliente precisa saber onde fica */}
                {shopSettings && (
                  <div className="hud-card p-5 space-y-4">
                    <div>
                      <h3 className="font-semibold text-hud-text"><Icon nome="inicio" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Dados da Barbearia</h3>
                      <p className="text-xs text-hud-muted mt-1">Aparecem no link que o cliente abre para agendar.</p>
                    </div>

                    <div>
                      <label className="text-xs text-hud-muted mb-1 block">Nome da barbearia</label>
                      <input type="text" value={shopSettings.name} onChange={e => setShopSettings(p => p ? { ...p, name: e.target.value } : p)} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text focus:border-hud-accent focus:outline-none" />
                      <p className="text-xs text-hud-muted mt-1">O link continua o mesmo ({bookingLink.replace(/^https?:\/\//, "")}) — trocar o nome nao quebra o que voce ja mandou pros clientes.</p>
                    </div>

                    <div>
                      <label className="text-xs text-hud-muted mb-1 block">Telefone / WhatsApp</label>
                      <input type="tel" inputMode="numeric" placeholder="(00) 00000-0000" value={shopSettings.phone} onChange={e => setShopSettings(p => p ? { ...p, phone: e.target.value } : p)} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
                    </div>

                    <div>
                      <label className="text-xs text-hud-muted mb-1 block">Endereço (rua e número)</label>
                      <input type="text" placeholder="Rua das Flores, 123" value={shopSettings.address} onChange={e => setShopSettings(p => p ? { ...p, address: e.target.value } : p)} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-hud-muted mb-1 block">Bairro</label>
                        <input type="text" value={shopSettings.neighborhood} onChange={e => setShopSettings(p => p ? { ...p, neighborhood: e.target.value } : p)} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text focus:border-hud-accent focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-hud-muted mb-1 block">CEP</label>
                        <input type="text" inputMode="numeric" placeholder="00000-000" value={shopSettings.zipCode} onChange={e => setShopSettings(p => p ? { ...p, zipCode: e.target.value } : p)} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs text-hud-muted mb-1 block">Cidade</label>
                        <input type="text" value={shopSettings.city} onChange={e => setShopSettings(p => p ? { ...p, city: e.target.value } : p)} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text focus:border-hud-accent focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-hud-muted mb-1 block">UF</label>
                        <input type="text" maxLength={2} placeholder="SP" value={shopSettings.state} onChange={e => setShopSettings(p => p ? { ...p, state: e.target.value.toUpperCase() } : p)} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint uppercase focus:border-hud-accent focus:outline-none" />
                      </div>
                    </div>

                    <button onClick={saveShopSettings} disabled={savingSettings} className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all">
                      {savingSettings ? "Salvando..." : "Salvar dados"}
                    </button>
                  </div>
                )}
                  </>
                )}

                {/* ─── Horário e dias ─── */}
                {configView === "horário" && (
                  <>
                    {/* Shop settings */}
                {shopSettings && (
                  <div className="hud-card p-5 space-y-5">
                    <h3 className="font-semibold text-hud-text"><Icon nome="relogio" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Horário de funcionamento</h3>

                    {/* Os campos únicos de abertura e fechamento saíram: cada dia
                        tem o seu. Aqui fica o resumo da semana, que abre o modal. */}
                    <button
                      onClick={() => setVerExpediente(true)}
                      className="w-full rounded border border-hud-border p-3.5 text-left hover:border-[color-mix(in_srgb,var(--hud-accent)_50%,transparent)] transition"
                    >
                      <span className="flex items-center justify-between gap-3 mb-2.5">
                        <span className="text-sm font-semibold text-hud-text">Cada dia com seu horário</span>
                        <span className="text-hud-light text-sm shrink-0">Editar ›</span>
                      </span>
                      {semana ? (
                        <span className="grid grid-cols-7 gap-1">
                          {semana.map(d => (
                            <span
                              key={d.dia}
                              className={`rounded py-1.5 text-center border ${d.aberto ? "border-hud-border bg-hud-bg" : "border-hud-border opacity-45"}`}
                            >
                              <span className="block text-[11px] font-bold text-hud-soft">{WEEKDAYS[d.dia]}</span>
                              <span className="block text-[9px] text-hud-muted tabular-nums mt-0.5">
                                {d.aberto ? d.abre.slice(0, 2) + "–" + d.fecha.slice(0, 2) : "—"}
                              </span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="block text-xs text-hud-muted">Toque para definir o horário de cada dia e o almoço.</span>
                      )}
                    </button>
                    <div>
                      <p className="text-xs text-hud-muted mb-1">De quanto em quanto tempo</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[15, 20, 30, 45, 60].map(min => (
                          <button
                            key={min}
                            onClick={() => setShopSettings(p => p ? { ...p, slotInterval: min } : p)}
                            className={`py-2.5 rounded border text-sm font-medium transition ${
                              shopSettings.slotInterval === min
                                ? "border-hud-accent bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] text-hud-light"
                                : "border-hud-border text-hud-muted hover:text-hud-soft"
                            }`}
                          >
                            {min === 60 ? "1h" : min + "m"}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-hud-muted mt-1.5">
                        {shopSettings.slotInterval === 60
                          ? "O cliente vê 08:00, 09:00, 10:00 — um atendimento por hora."
                          : `O cliente vê horários a cada ${shopSettings.slotInterval} minutos.`}
                      </p>
                    </div>

                    <div><p className="text-xs text-hud-muted mb-1">Chave Pix</p><input type="text" placeholder="Sua chave pix" value={shopSettings.pixKey} onChange={e => setShopSettings(p => p ? {...p, pixKey: e.target.value} : p)} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" /></div>

                    {/* Booking mode */}
                    <div><p className="text-xs text-hud-muted mb-2">Modo de Atendimento</p>
                      <div className="flex gap-2">
                        <button onClick={() => setShopSettings(p => p ? {...p, bookingMode: "steps"} : p)} className={`flex-1 rounded py-3 text-sm font-semibold transition border ${shopSettings.bookingMode === "steps" ? "gold-fill text-[var(--hud-on-accent)] border-hud-accent" : "bg-transparent text-hud-muted border-hud-border"}`}><Icon nome="agenda" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Etapas</button>
                        <button onClick={() => setShopSettings(p => p ? {...p, bookingMode: "agent"} : p)} className={`flex-1 rounded py-3 text-sm font-semibold transition border ${shopSettings.bookingMode === "agent" ? "gold-fill text-[var(--hud-on-accent)] border-hud-accent" : "bg-transparent text-hud-muted border-hud-border"}`}><Icon nome="mensagem" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Agente IA</button>
                      </div>
                    </div>

                    <button onClick={saveShopSettings} disabled={savingSettings} className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all">{savingSettings ? "Salvando..." : "Salvar configurações"}</button>
                  </div>
                )}
                  </>
                )}

                {/* ─── Pagamento ─── */}
                {configView === "pagamento" && <MercadoPago token={token} />}

                {/* ─── Aparência ─── */}
                {configView === "aparencia" && (
                  <>
                    {/* Logo da barbearia */}
                {shopSettings && (
                  <div className="hud-card p-5 space-y-4">
                    <div>
                      <h3 className="font-semibold text-hud-text"><Icon nome="imagem" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Logo da barbearia</h3>
                      <p className="text-xs text-hud-muted mt-1">Aparece no topo do link que você envia para os clientes.</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {shopSettings.logoUrl ? (
                        <img src={shopSettings.logoUrl} alt="Logo" className="w-16 h-16 rounded object-cover border border-[color-mix(in_srgb,var(--hud-accent)_30%,transparent)] shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] border border-hud-border flex items-center justify-center text-2xl shrink-0"><Icon nome="tesoura" tamanho={18} /></div>
                      )}
                      <div className="flex-1 space-y-2">
                        <label className={`block text-center rounded border border-[color-mix(in_srgb,var(--hud-accent)_50%,transparent)] py-2 text-sm text-hud-light hover:bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] transition cursor-pointer ${uploadingLogo ? "opacity-50 pointer-events-none" : ""}`}>
                          {uploadingLogo ? "Enviando..." : shopSettings.logoUrl ? "Trocar logo" : "Enviar logo"}
                          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingLogo} onChange={e => handleLogoUpload(e.target.files?.[0] || null)} />
                        </label>
                        {shopSettings.logoUrl && (
                          <button onClick={handleRemoveLogo} disabled={uploadingLogo} className="hud-focus min-h-[44px] w-full rounded border border-hud-border py-2 text-xs text-hud-muted hover:text-hud-err transition disabled:opacity-50">Remover logo</button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-hud-muted">JPG, PNG ou WEBP · máx 3MB · de preferência quadrado.</p>
                  </div>
                )}
                  </>
                )}

                {/* ─── Notificações ─── */}
                {configView === "notificações" && <PushToggle token={token} />}

                {/* ─── Senha e recuperação ─── */}
                {configView === "senha" && (
                  <>
                    <RecoveryCode token={token} />
                    {/* Change password */}
                <div className="hud-card p-5 space-y-3">
                  <h3 className="font-semibold text-hud-text"><Icon nome="cadeado" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Alterar senha</h3>
                  <input type="password" placeholder="Senha atual" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
                  <input type="password" placeholder="Nova senha (min 6)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
                  <button onClick={handleChangePassword} disabled={changingPassword} className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all">{changingPassword ? "Alterando..." : "Alterar senha"}</button>
                </div>
                  </>
                )}

                {/* ─── Assinatura ─── */}
                {configView === "assinatura" && (
                  <Assinatura token={token} onUnauthorized={handleUnauthorized} />
                )}

                {/* ─── Clientes banidos ─── */}
                {configView === "banidos" && (
                  <div className="space-y-4">
                    <div className="hud-card p-5 space-y-3">
                      <p className="text-xs text-hud-muted">
                        Cliente banido não consegue agendar nem entrar na lista de espera desta
                        barbearia. O histórico e o financeiro dele continuam intactos, e ele pode
                        agendar normalmente em outras barbearias do BarberPro.
                      </p>
                      <input type="tel" inputMode="numeric" placeholder="Telefone (com DDD)" value={novoBanido.phone} onChange={e => setNovoBanido(p => ({ ...p, phone: e.target.value }))} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
                      <input type="text" placeholder="Motivo (opcional, só você vê)" value={novoBanido.reason} onChange={e => setNovoBanido(p => ({ ...p, reason: e.target.value }))} className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
                      <button onClick={() => banirCliente(novoBanido.phone, undefined, novoBanido.reason)} disabled={baningClient} className="w-full rounded border border-[color-mix(in_srgb,var(--hud-err)_40%,transparent)] bg-[color-mix(in_srgb,var(--hud-err)_10%,transparent)] py-3 font-semibold text-hud-err hover:bg-[color-mix(in_srgb,var(--hud-err)_20%,transparent)] disabled:opacity-50 transition">
                        {baningClient ? "Banindo..." : "Banir este telefone"}
                      </button>
                    </div>

                    {bannedLoading ? <Spinner /> : banned.length === 0 ? (
                      <p className="text-center text-hud-muted py-6">Nenhum cliente banido</p>
                    ) : (
                      <div className="space-y-2">
                        {banned.map(b => (
                          <div key={b.id} className="hud-card flex items-center gap-3 p-4">
                            <span className="text-xl shrink-0"><Icon nome="bloqueio" tamanho={18} /></span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-hud-text truncate">{b.name || "Sem nome"}</p>
                              <p className="text-sm text-hud-muted">{b.phone}</p>
                              {b.reason && <p className="text-xs text-hud-muted mt-0.5 truncate">{b.reason}</p>}
                            </div>
                            <button onClick={() => desbanirCliente(b.phone)} className="shrink-0 rounded border border-hud-border px-3 py-2 text-xs text-hud-muted hover:text-hud-ok hover:border-[color-mix(in_srgb,var(--hud-ok)_50%,transparent)] transition">
                              Liberar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Aceite dos termos — cobre o painel inteiro ate ser resolvido */}
      <Aceite
        token={token}
        onAceito={() => { fetchAppointments(); }}
        onSair={handleLogout}
      />

      {/* ── Cancel Confirmation Modal ── */}
      {dialogoConfirmacao}
      <Expediente
        aberto={verExpediente}
        onFechar={() => setVerExpediente(false)}
        token={token}
        onSalvo={() => { buscarSemana(); fetchSlots(); }}
        onUnauthorized={handleUnauthorized}
      />
      <Comanda
        aberto={!!comandaDe}
        onFechar={() => setComandaDe(null)}
        token={token}
        appointmentId={comandaDe?.id ?? null}
        clienteNome={comandaDe?.client?.name ?? ""}
        itensAtuais={comandaDe?.comanda ?? []}
        onSalvo={fetchAppointments}
        onUnauthorized={handleUnauthorized}
      />
      <CancelModal
        open={!!cancelModalId}
        appt={cancelModalId ? appointments.find(a => a.id === cancelModalId) || null : null}
        waitlistCount={waitlistCountForDate}
        notifyWaitlist={cancelNotifyWaitlist}
        onToggleNotify={() => setCancelNotifyWaitlist(v => !v)}
        onClose={() => setCancelModalId(null)}
        onConfirm={cancelAppointment}
        confirming={cancellingId === cancelModalId}
      />

      {/* ── Navegação inferior (68px) ── */}
      <BottomNav<Tab>
        valor={subView ? ("" as Tab) : activeTab}
        onChange={(t) => { setActiveTab(t); setSubView(null); }}
        itens={[
          { valor: "home", rotulo: "Início", icone: "inicio" },
          { valor: "agenda", rotulo: "Agenda", icone: "agenda" },
          { valor: "financeiro", rotulo: "Financeiro", icone: "dinheiro" },
          { valor: "config", rotulo: "Config", icone: "config" },
        ]}
      />
    </main>
  );
}

/* ── Shared Components ── */
/**
 * Cartão da engrenagem: ícone, rótulo e o VALOR atual.
 *
 * O valor é o ponto todo. Pendência vira cor no próprio cartão em vez de
 * barra de progresso — cobra do mesmo jeito e não fica sobrando na tela
 * depois que tudo estiver configurado.
 */
function TileConfig({
  c,
  onClick,
}: {
  c: { icon: NomeIcone; label: string; valor: string; pendente?: boolean };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`hud-card hud-focus flex min-h-[96px] flex-col gap-1 p-3.5 text-left transition-all ${
        c.pendente
          ? "!border-[color-mix(in_srgb,var(--hud-warn)_50%,transparent)] hover:!border-hud-warn"
          : "hover:border-hud-accent"
      }hud-focus`}
    >
      <span className={c.pendente ? "text-hud-warn" : "text-hud-accent"}><Icon nome={c.icon} tamanho={20} /></span>
      <span className={`text-sm font-semibold leading-tight ${c.pendente ? "text-hud-warn" : "text-hud-text"}`}>
        {c.valor}
      </span>
      <span className="text-xs text-hud-muted leading-tight">{c.label}</span>
    </button>
  );
}

function Spinner() {
  return <div className="flex justify-center py-12"><HudSpinner rotulo="Carregando…" /></div>;
}

function StatBox({ value, label, color, extra, extraColor }: { value: string; label: string; color?: string; extra?: string; extraColor?: string }) {
  return (
    <div className="hud-card p-3 text-center">
      <p className={`font-display text-xl tabular-nums leading-tight ${color || "text-hud-text"}`}>{value}</p>
      {extra && <p className={`text-xs font-semibold ${extraColor || ""}`}>{extra}</p>}
      {/* Quebra em duas linhas em vez de cortar: "Agendamentos" não cabe
          numa coluna de 1/3 de tela a 320px, e cortar palavra é pior que
          usar uma linha a mais. */}
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-hud-muted leading-tight [overflow-wrap:anywhere] hyphens-auto" lang="pt-BR">{label}</p>
    </div>
  );
}

function CancelModal({ open, appt, waitlistCount, notifyWaitlist, onToggleNotify, onClose, onConfirm, confirming }: {
  open: boolean;
  appt: Appointment | null;
  waitlistCount: number;
  notifyWaitlist: boolean;
  onToggleNotify: () => void;
  onClose: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !open) return null;
  return createPortal(
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      {/* Fundo sólido: a classe de vidro é 74% opaca e faz o modal
          parecer conteúdo desfocado em vez de uma caixa por cima. */}
      <div
        className="border border-hud-border rounded max-w-sm w-full p-6 space-y-4 shadow-2xl"
        style={{ backgroundColor: "#161625" }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-display text-xl leading-tight text-hud-text">Cancelar agendamento?</h3>
        {appt && (
          <div className="rounded bg-hud-bg border border-hud-border p-3">
            <p className="font-medium text-hud-text">{appt.client?.name}</p>
            <p className="text-sm text-hud-muted">{appt.startTime} - {appt.endTime} · {appt.services.map(s => s.name).join(", ")}</p>
          </div>
        )}
        {waitlistCount > 0 && (
          <div className="rounded bg-[color-mix(in_srgb,var(--hud-info)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-info)_30%,transparent)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-hud-info"><Icon nome="copiar" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Lista de espera</p>
                <p className="text-xs text-hud-muted">{waitlistCount} cliente{waitlistCount > 1 ? "s" : ""} aguardando vaga</p>
              </div>
              <button onClick={onToggleNotify} className={`hud-focus w-12 h-6 rounded-full transition-colors shrink-0 ${notifyWaitlist ? "bg-hud-info" : "bg-[var(--hud-track)]"}hud-focus`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${notifyWaitlist ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
            {notifyWaitlist && (
              <p className="text-xs text-hud-info">Ao cancelar, abriremos o WhatsApp para você avisar os clientes da lista de espera.</p>
            )}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="hud-focus flex-1 rounded border border-hud-border py-3 text-sm text-hud-muted hover:text-hud-text transition">Voltar</button>
          <button onClick={onConfirm} disabled={confirming} className="hud-focus flex-1 rounded bg-hud-err py-3 text-sm font-semibold text-hud-text hover:brightness-110 disabled:opacity-50 transition-all">{confirming ? "Cancelando..." : "Confirmar Cancelamento"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
