"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
interface Appointment {
  id: string; startTime: string; endTime: string; date: string;
  status: string; paidAt: string | null; paymentMethod: string | null;
  totalPrice: number; barberName: string;
  pendingExpiresAt?: string | null; pendingExpired?: boolean;
  client: { id: string; name: string; phone: string; noShowCount: number; notes: string | null };
  services: AppointmentService[];
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
interface ClientItem { id: string; name: string; phone: string; notes: string | null; noShowCount: number; firstDate: string; totalAppointments: number; }
interface SlotData { allSlots: string[]; blocked: string[]; allDay: boolean; booked: string[]; }

const STATUS_LABELS: Record<string, string> = { confirmed: "Confirmado", cancelled: "Cancelado", completed: "Concluido", pending: "Pendente", pending_payment: "Aguardando Pix", no_show: "Nao compareceu" };
const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  cancelled: "bg-red-500/20 text-red-400 border border-red-500/30",
  completed: "bg-green-500/20 text-green-400 border border-green-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  pending_payment: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
  no_show: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
};
const PAYMENT_LABELS: Record<string, string> = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartao" };
const CATEGORY_LABELS: Record<string, string> = { corte: "Corte", barba: "Barba", sobrancelha: "Sobrancelha", pezinho: "Pezinho", luzes: "Luzes" };
const CATEGORY_ICONS: Record<string, string> = { corte: "✂️", barba: "🪒", sobrancelha: "👁️", pezinho: "💈", luzes: "✨" };
// Duas letras cabem nas 7 colunas até em tela de 320px; três não cabiam e
// a última letra ficava cortada.
const WEEKDAYS = ["Do", "Se", "Te", "Qa", "Qi", "Sx", "Sa"];

type Tab = "home" | "agenda" | "financeiro" | "config";
type ConfigView = null | "dados" | "horario" | "pagamento" | "aparencia" | "notificacoes" | "senha" | "banidos" | "assinatura";
const CONFIG_TITULOS: Record<string, string> = {
  dados: "🏠 Dados da barbearia",
  horario: "🕐 Horário e dias",
  pagamento: "💳 Pagamento",
  aparencia: "🖼️ Aparência",
  notificacoes: "🔔 Notificações",
  senha: "🔒 Senha e recuperação",
  banidos: "🚫 Clientes banidos",
  assinatura: "⭐ Minha assinatura",
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

type SubView = null | "barbeiros" | "servicos" | "clientes" | "fidelidade" | "espera" | "produtos" | "sumidos" | "fixos";

/** Corte que se repete toda semana. A regra, nao as ocorrencias. */
type CorteFixo = {
  id: string;
  clientName: string;
  clientPhone: string;
  barberId: string;
  barberName: string;
  weekday: number;
  startTime: string;
  totalDuration: number;
  totalPrice: number;
  startDate: string;
  endDate: string;
  active: boolean;
  services: { id: string; name: string }[];
};

const DIAS_DA_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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
  const [linkCopied, setLinkCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // ── Home/Agenda state ──
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
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
  const [shopSettings, setShopSettings] = useState<{ name: string; openTime: string; closeTime: string; workDays: number[]; pixKey: string; logoUrl: string; bookingMode: string; phone: string; address: string; neighborhood: string; city: string; state: string; zipCode: string; slotInterval: number } | null>(null);
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
      const data = await res.json();
      setAppointments(data.appointments || []);
    } catch { setAppointments([]); }
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
  const [fixos, setFixos] = useState<CorteFixo[]>([]);
  const [fixosLoading, setFixosLoading] = useState(false);
  const [novoFixo, setNovoFixo] = useState({
    clientName: "", clientPhone: "", barberId: "", serviceIds: [] as string[],
    weekday: 2, startTime: "10:00", startDate: "", endDate: "",
  });
  const [salvandoFixo, setSalvandoFixo] = useState(false);
  const [encerrandoFixo, setEncerrandoFixo] = useState<string | null>(null);

  const fetchFixos = useCallback(async () => {
    setFixosLoading(true);
    try {
      const res = await fetch("/api/me/recurring", { headers: authHeaders() });
      const data = await res.json();
      setFixos(data.recurring || []);
    } catch { /* silencioso: a tela mostra a lista vazia */ }
    setFixosLoading(false);
  }, [authHeaders]);

  const fetchBarbers = useCallback(async () => {
    if (!token) return; setBarbersLoading(true);
    try { const res = await fetch("/api/auth/add-barber", { headers: authHeaders() }); const data = await res.json(); setBarbers(data.barbers || []); }
    catch { setBarbers([]); } finally { setBarbersLoading(false); }
  }, [token, authHeaders]);

  const fetchDashboard = useCallback(async () => {
    if (!token) return; setDashLoading(true);
    try { const res = await fetch("/api/me/dashboard", { headers: authHeaders() }); const data = await res.json(); setDashboard(data); }
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

  useEffect(() => { if (token && activeTab === "home") fetchAppointments(); }, [selectedDate]);
  useEffect(() => { if (token && activeTab === "agenda") fetchSlots(); }, [availDate]);
  useEffect(() => {
    if (!token || !subView) return;
    if (subView === "barbeiros") fetchBarbers();
    if (subView === "fidelidade") fetchLoyalty();
    if (subView === "espera") fetchWaitlist();
    if (subView === "servicos") fetchServices();
    if (subView === "clientes") { fetchClients(); fetchBanned(); }
    if (subView === "produtos") fetchProducts();
    // O corte fixo precisa de servicos (duracao/preco) e barbeiros (de quem
    // e a agenda) para o formulario existir.
    if (subView === "fixos") { fetchFixos(); fetchServices(); fetchBarbers(); }
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

  const handleLogout = () => { localStorage.removeItem("admin_token"); localStorage.removeItem("admin_user"); localStorage.removeItem("admin_token_renewed_at"); router.push("/admin"); };

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

  if (!token) return (<div className="flex min-h-screen items-center justify-center bg-dark-900"><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" /></div>);

  // ── Quick Actions (like mobile) ──
  // Atalhos da home: so o que o barbeiro abre no dia a dia.
  const quickActions = [
    { icon: "📅", label: "Agenda", onClick: () => setActiveTab("agenda") },
    { icon: "💰", label: "Financeiro", onClick: () => setActiveTab("financeiro") },
    { icon: "👥", label: "Clientes", onClick: () => { setSubView("clientes"); setActiveTab("home"); } },
    { icon: "🏆", label: "Fidelidade", onClick: () => { setSubView("fidelidade"); setActiveTab("home"); } },
    { icon: "🔍", label: "Sumidos", onClick: () => { setSubView("sumidos"); setActiveTab("home"); } },
    { icon: "🔁", label: "Corte fixo", onClick: () => { setSubView("fixos"); setActiveTab("home"); } },
    ...(user?.role === "owner" ? [
      { icon: "🕐", label: "Lista Espera", onClick: () => { setSubView("espera"); setActiveTab("home"); } },
    ] : []),
  ];

  // Cada cartao carrega o VALOR atual, nao so o nome. E o que transforma a
  // engrenagem em painel — e o que teria denunciado, sem abrir nada, que a
  // troca de horario do Eduardo nunca chegou ao banco.
  type Cartao = {
    view: Exclude<ConfigView, null> | null;
    sub?: SubView;
    icon: string;
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
    { view: null, sub: "servicos", icon: "\u{1F527}", label: "Serviços",
      valor: resumo ? (resumo.servicos === 0 ? "nenhum" : `${resumo.servicos} ativo${resumo.servicos > 1 ? "s" : ""}`) : "—",
      pendente: !!resumo && resumo.servicos === 0 },
    { view: null, sub: "produtos", icon: "\u{1F6CD}\u{FE0F}", label: "Produtos",
      valor: resumo ? (resumo.produtos === 0 ? "nenhum" : `${resumo.produtos} ativo${resumo.produtos > 1 ? "s" : ""}`) : "—",
      pendente: !!resumo && resumo.produtos === 0 },
    { view: null, sub: "barbeiros", icon: "\u{2702}\u{FE0F}", label: "Barbeiros",
      valor: resumo ? (resumo.barbeirosSemFoto > 0 ? `${resumo.barbeirosSemFoto} sem foto` : `${resumo.barbeiros} com foto`) : "—",
      pendente: !!resumo && resumo.barbeirosSemFoto > 0 },
    { view: "banidos", icon: "\u{1F6AB}", label: "Banidos",
      valor: resumo ? (resumo.banidos === 0 ? "nenhum" : String(resumo.banidos)) : "—" },
  ] : [];

  const cartoesBarbearia: Cartao[] = user?.role === "owner" ? [
    { view: "dados", icon: "\u{1F3E0}", label: "Dados da barbearia",
      valor: resumo ? (resumo.temEndereco ? "endereço ok" : "sem endereço") : "—",
      pendente: !!resumo && !resumo.temEndereco },
    { view: "pagamento", icon: "\u{1F4B3}", label: "Pagamento",
      valor: resumo ? (resumo.pagamento.mercadoPago ? "Pix automático" : resumo.pagamento.pixManual ? "Pix manual" : "sem Pix") : "—",
      pendente: !!resumo && !resumo.pagamento.mercadoPago && !resumo.pagamento.pixManual },
    { view: "aparencia", icon: "\u{1F5BC}\u{FE0F}", label: "Aparência",
      valor: resumo ? (resumo.temLogo ? "logo enviada" : "sem logo") : "—",
      pendente: !!resumo && !resumo.temLogo },
  ] : [];

  const cartoesConta: Cartao[] = [
    { view: "notificacoes", icon: "\u{1F514}", label: "Notificações",
      valor: resumo ? (resumo.notificacoes > 0 ? `${resumo.notificacoes} aparelho${resumo.notificacoes > 1 ? "s" : ""}` : "desligadas") : "—",
      pendente: !!resumo && resumo.notificacoes === 0 },
    { view: "senha", icon: "\u{1F512}", label: "Senha", valor: "trocar e recuperar" },
  ];

  const abrirCartao = (c: Cartao) => {
    if (c.sub) { setSubView(c.sub); setActiveTab("home"); return; }
    if (c.view) setConfigView(c.view);
  };


  // ── Render SubViews ──
  const renderSubView = () => {
    if (!subView) return null;
    const backBtn = <button onClick={() => setSubView(null)} className="flex items-center gap-2 text-brand-400 mb-4 text-sm hover:text-brand-300"><span>←</span> Voltar</button>;

    // ─── BARBEIROS ───
    if (subView === "barbeiros") return (
      <div className="space-y-6">{backBtn}
        <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-3">
          <h3 className="font-semibold text-white">Adicionar barbeiro</h3>
          <input type="text" placeholder="Nome *" value={newBarberName} onChange={e => setNewBarberName(e.target.value)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors" />
          <input type="tel" placeholder="Telefone (com DDD) *" value={newBarberPhone} onChange={e => setNewBarberPhone(e.target.value)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors" />
          <input type="email" placeholder="E-mail (opcional)" value={newBarberEmail} onChange={e => setNewBarberEmail(e.target.value)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors" />
          <input type="password" placeholder="Senha (min 6) *" value={newBarberPassword} onChange={e => setNewBarberPassword(e.target.value)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors" />
          <div className="relative">
            <input type="number" min="0" max="100" placeholder="Comissão (%)" value={newBarberCommission} onChange={e => setNewBarberCommission(e.target.value)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 pr-10 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
          </div>
          <button onClick={handleAddBarber} disabled={addingBarber} className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">{addingBarber ? "Adicionando..." : "Adicionar barbeiro"}</button>
        </div>
        {barbersLoading ? <Spinner /> : barbers.length === 0 ? <p className="text-center text-gray-500 py-6">Nenhum barbeiro cadastrado</p> : (
          <div className="space-y-3">
            {barbers.map(b => (
              <div key={b.id} className={`rounded-xl border bg-dark-800 p-4 ${b.active ? "border-gray-700" : "border-gray-800 opacity-60"}`}>
                <div className="flex items-center gap-4">
                  {b.imageUrl
                    ? <img src={b.imageUrl} alt={b.name} className="w-10 h-10 rounded-full object-cover border border-brand-500/30 shrink-0" />
                    : <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 font-semibold text-lg shrink-0">{b.name.charAt(0).toUpperCase()}</div>}
                  <button onClick={() => abrirEdicaoBarbeiro(b)} className="flex-1 min-w-0 text-left group">
                    <p className="font-medium text-white group-hover:text-brand-400 transition">
                      {b.name}
                      {b.isOwnerProfile && <span className="ml-2 text-xs font-normal text-brand-400 border border-brand-400/40 rounded px-1.5 py-0.5">você</span>}
                      {!b.imageUrl && <span className="ml-2 text-xs font-normal text-yellow-400">sem foto</span>}
                    </p>
                    <p className="text-sm text-gray-400">{b.phone}{(b.commission ?? 0) > 0 && <span className="ml-2 text-brand-400">· {b.commission}%</span>}</p>
                  </button>
                  <button onClick={() => { setResetBarberId(resetBarberId === b.id ? null : b.id); setResetPassword(""); }} title="Redefinir senha" className="shrink-0 w-9 h-9 rounded-lg border border-gray-700 flex items-center justify-center text-gray-400 hover:text-brand-400 hover:border-brand-400/50 transition">🔑</button>
                  {!b.isOwnerProfile && (
                    <button onClick={() => handleToggleBarber(b.id, !b.active)} className={`w-12 h-6 rounded-full transition-colors shrink-0 ${b.active ? "bg-brand-500" : "bg-gray-700"}`}><div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${b.active ? "translate-x-6" : "translate-x-0.5"}`} /></button>
                  )}
                </div>
                {resetBarberId === b.id && (
                  <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                    <p className="text-xs text-gray-400">Nova senha para <span className="text-white font-medium">{b.name}</span></p>
                    <div className="flex gap-2">
                      <input type="text" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="flex-1 rounded-lg bg-dark-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
                      <button onClick={() => handleResetBarberPassword(b.id)} disabled={resettingBarber} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition">{resettingBarber ? "..." : "Salvar"}</button>
                    </div>
                    <p className="text-xs text-gray-500">Anote e envie a nova senha para o barbeiro por WhatsApp.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Modal aberto={!!editBarber} onFechar={() => setEditBarber(null)}>{editBarber && (<>
              <h3 className="text-lg font-semibold text-white">{editBarber.isOwnerProfile ? "Seu perfil de barbeiro" : "Editar barbeiro"}</h3>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Foto</label>
                <div className="flex items-center gap-3">
                  {editBarber.imageUrl
                    ? <img src={editBarber.imageUrl} alt={editBarber.name} className="w-16 h-16 rounded-full object-cover border border-brand-500/30 shrink-0" />
                    : <div className="w-16 h-16 rounded-full bg-brand-500/20 border border-gray-700 flex items-center justify-center text-2xl text-brand-400 font-semibold shrink-0">{editBarber.name.charAt(0).toUpperCase()}</div>}
                  <div className="flex-1 space-y-2">
                    <label className={`block text-center rounded-lg border border-brand-400/50 py-2 text-sm text-brand-400 hover:bg-brand-500/10 transition cursor-pointer ${uploadingBarberImg ? "opacity-50 pointer-events-none" : ""}`}>
                      {uploadingBarberImg ? "Enviando..." : editBarber.imageUrl ? "Trocar foto" : "Enviar foto"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingBarberImg} onChange={e => trocarFotoBarbeiro(e.target.files?.[0] || null)} />
                    </label>
                    {editBarber.imageUrl && (
                      <button onClick={removerFotoBarbeiro} disabled={uploadingBarberImg} className="w-full rounded-lg border border-gray-700 py-2 text-xs text-gray-400 hover:text-red-400 transition disabled:opacity-50">Remover foto</button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">O cliente vê essa foto na hora de escolher o profissional.</p>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nome</label>
                <input type="text" value={editBarber.name} onChange={e => setEditBarber(p => p && ({ ...p, name: e.target.value }))} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none" />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">E-mail</label>
                <input type="email" value={editBarber.email} onChange={e => setEditBarber(p => p && ({ ...p, email: e.target.value }))} placeholder="opcional" className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Comissão (%)</label>
                <input type="number" min="0" max="100" value={editBarber.commission} onChange={e => setEditBarber(p => p && ({ ...p, commission: e.target.value }))} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none" />
              </div>

              <button onClick={salvarBarbeiro} disabled={savingBarber} className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">{savingBarber ? "Salvando..." : "Salvar"}</button>
              <button onClick={() => setEditBarber(null)} className="w-full text-sm text-gray-500 hover:text-gray-300 transition py-1">Cancelar</button>
            </>)}</Modal>
      </div>
    );

    // ─── SERVICOS ───
    if (subView === "servicos") return (
      <div className="space-y-6">{backBtn}
        <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-3">
          <h3 className="font-semibold text-white">Adicionar serviço</h3>
          <input type="text" placeholder="Nome do serviço *" value={newService.name} onChange={e => setNewService(p => ({...p, name: e.target.value}))} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors" />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Preço *" value={newService.price} onChange={e => setNewService(p => ({...p, price: e.target.value}))} className="rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
            <input type="number" placeholder="Duração (min)" value={newService.duration} onChange={e => setNewService(p => ({...p, duration: e.target.value}))} className="rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button key={key} onClick={() => setNewService(p => ({...p, category: key}))} className={`px-3 py-2 rounded-lg text-sm border transition ${newService.category === key ? "border-brand-400 bg-brand-500/10 text-brand-400" : "border-gray-700 text-gray-400"}`}>{CATEGORY_ICONS[key]} {label}</button>
            ))}
          </div>
          <button onClick={handleAddService} disabled={addingService} className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">{addingService ? "Adicionando..." : "Adicionar Servico"}</button>
        </div>
        {servicesLoading ? <Spinner /> : services.length === 0 ? <p className="text-center text-gray-500 py-6">Nenhum serviço cadastrado</p> : (
          <div className="space-y-3">
            {services.map(s => (
              <div key={s.id} className={`flex items-center gap-4 rounded-xl border bg-dark-800 p-4 ${s.active ? "border-gray-700" : "border-gray-800 opacity-60"}`}>
                <span className="text-2xl">{CATEGORY_ICONS[s.category] || "✂️"}</span>
                {/* Editar e apagar vivem no modal, que abre ao tocar no nome.
                    Com os dois botões aqui, ícone e toggle sobrando, o texto
                    era espremido a 28px numa tela de 320 — o nome do serviço
                    não cabia em lugar nenhum. */}
                <button onClick={() => abrirEdicaoServico(s)} className="flex-1 min-w-0 text-left group">
                  <p className="font-medium text-white group-hover:text-brand-400 transition truncate">{s.name}</p>
                  <p className="text-sm text-gray-400 truncate">R$ {s.price.toFixed(2)} · {s.duration}min · {CATEGORY_LABELS[s.category] || s.category}</p>
                </button>
                <button onClick={() => toggleService(s.id, !s.active)} title={s.active ? "Desativar" : "Ativar"} className={`w-12 h-6 rounded-full transition-colors shrink-0 ${s.active ? "bg-brand-500" : "bg-gray-700"}`}><div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${s.active ? "translate-x-6" : "translate-x-0.5"}`} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Modal de edicao — 100vw/100vh inline porque position:fixed sozinho
            se dimensiona pelo documento, nao pela viewport, e o modal some */}
        <Modal aberto={!!editService} onFechar={() => setEditService(null)}>{editService && (<>
              <h3 className="text-lg font-semibold text-white">Editar serviço</h3>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nome</label>
                <input type="text" value={editService.name} autoFocus
                  onChange={e => setEditService(p => p && ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Preço (R$)</label>
                  <input type="number" inputMode="decimal" value={editService.price}
                    onChange={e => setEditService(p => p && ({ ...p, price: e.target.value }))}
                    className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Duração (min)</label>
                  <input type="number" inputMode="numeric" value={editService.duration}
                    onChange={e => setEditService(p => p && ({ ...p, duration: e.target.value }))}
                    className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Categoria</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <button key={key} onClick={() => setEditService(p => p && ({ ...p, category: key }))}
                      className={`px-3 py-2 rounded-lg text-sm border transition ${editService.category === key ? "border-brand-400 bg-brand-500/10 text-brand-400" : "border-gray-700 text-gray-400"}`}>
                      {CATEGORY_ICONS[key]} {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Foto do corte — e ela que o cliente ve na hora de escolher o servico */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Foto do corte</label>
                <div className="flex items-center gap-3">
                  {editService.imageUrl ? (
                    <img src={editService.imageUrl} alt={editService.name} className="w-16 h-16 rounded-xl object-cover border border-brand-500/30 shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-dark-900 border border-gray-700 flex items-center justify-center text-2xl shrink-0">📷</div>
                  )}
                  <div className="flex-1 space-y-2">
                    <label className={`block text-center rounded-lg border border-brand-400/50 py-2 text-sm text-brand-400 hover:bg-brand-500/10 transition cursor-pointer ${uploadingServiceImg ? "opacity-50 pointer-events-none" : ""}`}>
                      {uploadingServiceImg ? "Enviando..." : editService.imageUrl ? "Trocar foto" : "Enviar foto"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingServiceImg} onChange={e => trocarFotoServico(e.target.files?.[0] || null)} />
                    </label>
                    {editService.imageUrl && (
                      <button onClick={removerFotoServico} disabled={uploadingServiceImg} className="w-full rounded-lg border border-gray-700 py-2 text-xs text-gray-400 hover:text-red-400 transition disabled:opacity-50">Remover foto</button>
                    )}
                  </div>
                </div>
              </div>

              <button onClick={salvarEdicaoServico} disabled={savingService}
                className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">
                {savingService ? "Salvando..." : "Salvar alterações"}
              </button>

              <div className="pt-3 border-t border-gray-700 space-y-2">
                <button onClick={() => { const alvo = services.find(x => x.id === editService.id); if (alvo) excluirServico(alvo); }}
                  disabled={deletingService === editService.id}
                  className="w-full rounded-xl border border-red-500/30 py-2.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition">
                  {deletingService === editService.id ? "Apagando..." : "🗑️ Apagar este serviço"}
                </button>
                <button onClick={() => setEditService(null)} className="w-full text-sm text-gray-500 hover:text-gray-300 transition py-1">
                  Cancelar
                </button>
              </div>
            </>)}</Modal>
      </div>
    );

    // ─── PRODUTOS ───
    if (subView === "produtos") return (
      <div className="space-y-6">{backBtn}
        <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-3">
          <h3 className="font-semibold text-white">Adicionar produto</h3>
          <input type="text" placeholder="Nome do produto *" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" inputMode="decimal" placeholder="Preço de venda *" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
            {/* Sem o custo nao ha margem — e margem de produto costuma ser
                a surpresa que faz o dono mudar o que compra. */}
            <input type="number" inputMode="decimal" placeholder="Quanto custou" value={newProduct.custo} onChange={e => setNewProduct(p => ({ ...p, custo: e.target.value }))} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
          </div>
          <input type="text" placeholder="Descrição (opcional)" value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
          <p className="text-xs text-gray-500">A foto você adiciona depois, tocando no produto.</p>
          <button onClick={handleAddProduct} disabled={addingProduct} className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">{addingProduct ? "Adicionando..." : "Adicionar produto"}</button>
        </div>

        {productsLoading ? <Spinner /> : products.length === 0 ? <p className="text-center text-gray-500 py-6">Nenhum produto cadastrado</p> : (
          <div className="space-y-3">
            {products.map(p => (
              <div key={p.id} className={`flex items-center gap-3 rounded-xl border bg-dark-800 p-4 ${p.active ? "border-gray-700" : "border-gray-800 opacity-60"}`}>
                {p.imageUrl
                  ? <img src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  : <div className="w-12 h-12 rounded-lg bg-dark-900 border border-gray-700 flex items-center justify-center text-xl shrink-0">📷</div>}
                <button onClick={() => abrirEdicaoProduto(p)} className="flex-1 min-w-0 text-left group">
                  <p className="font-medium text-white group-hover:text-brand-400 transition truncate">{p.name}</p>
                  <p className="text-sm text-gray-400 truncate">R$ {p.price.toFixed(2)}{p.description ? ` · ${p.description}` : ""}</p>
                </button>
                <button onClick={() => toggleProduct(p.id, !p.active)} title={p.active ? "Desativar" : "Ativar"} className={`w-12 h-6 rounded-full transition-colors shrink-0 ${p.active ? "bg-brand-500" : "bg-gray-700"}`}><div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${p.active ? "translate-x-6" : "translate-x-0.5"}`} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Modal de edição — 100vw/100vh inline porque position:fixed sozinho
            se dimensiona pelo documento, não pela viewport */}
        <Modal aberto={!!editProduct} onFechar={() => setEditProduct(null)}>{editProduct && (<>
              <h3 className="text-lg font-semibold text-white">Editar produto</h3>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nome</label>
                <input type="text" value={editProduct.name} autoFocus onChange={e => setEditProduct(p => p && ({ ...p, name: e.target.value }))} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Preço (R$)</label>
                <input type="number" inputMode="decimal" value={editProduct.price} onChange={e => setEditProduct(p => p && ({ ...p, price: e.target.value }))} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Quanto custou</label>
                <input type="number" inputMode="decimal" value={editProduct.custo} onChange={e => setEditProduct(p => p && ({ ...p, custo: e.target.value }))} placeholder="Deixe vazio se não souber" className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
                {editProduct.custo.trim() !== "" && parseFloat(editProduct.price) > 0 && parseFloat(editProduct.custo) >= 0 && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    Margem de{" "}
                    <span className="font-semibold text-green-400">
                      {(parseFloat(editProduct.price) - parseFloat(editProduct.custo)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>{" "}
                    ({Math.round(((parseFloat(editProduct.price) - parseFloat(editProduct.custo)) / parseFloat(editProduct.price)) * 100)}%)
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Descrição</label>
                <input type="text" value={editProduct.description} onChange={e => setEditProduct(p => p && ({ ...p, description: e.target.value }))} placeholder="Opcional" className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Foto do produto</label>
                <div className="flex items-center gap-3">
                  {editProduct.imageUrl
                    ? <img src={editProduct.imageUrl} alt={editProduct.name} className="w-16 h-16 rounded-xl object-cover border border-brand-500/30 shrink-0" />
                    : <div className="w-16 h-16 rounded-xl bg-dark-900 border border-gray-700 flex items-center justify-center text-2xl shrink-0">📷</div>}
                  <div className="flex-1 space-y-2">
                    <label className={`block text-center rounded-lg border border-brand-400/50 py-2 text-sm text-brand-400 hover:bg-brand-500/10 transition cursor-pointer ${uploadingProductImg ? "opacity-50 pointer-events-none" : ""}`}>
                      {uploadingProductImg ? "Enviando..." : editProduct.imageUrl ? "Trocar foto" : "Enviar foto"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingProductImg} onChange={e => trocarFotoProduto(e.target.files?.[0] || null)} />
                    </label>
                    {editProduct.imageUrl && (
                      <button onClick={removerFotoProduto} disabled={uploadingProductImg} className="w-full rounded-lg border border-gray-700 py-2 text-xs text-gray-400 hover:text-red-400 transition disabled:opacity-50">Remover foto</button>
                    )}
                  </div>
                </div>
              </div>

              <button onClick={salvarEdicaoProduto} disabled={savingProduct} className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">{savingProduct ? "Salvando..." : "Salvar alterações"}</button>

              <div className="pt-3 border-t border-gray-700 space-y-2">
                <button onClick={() => { const alvo = products.find(x => x.id === editProduct.id); if (alvo) excluirProduto(alvo); }} disabled={deletingProduct === editProduct.id} className="w-full rounded-xl border border-red-500/30 py-2.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition">{deletingProduct === editProduct.id ? "Apagando..." : "🗑️ Apagar este produto"}</button>
                <button onClick={() => setEditProduct(null)} className="w-full text-sm text-gray-500 hover:text-gray-300 transition py-1">Cancelar</button>
              </div>
            </>)}</Modal>
      </div>
    );

    // ─── CORTE FIXO ───
    //
    // O cliente que vem toda semana no mesmo horario. O barbeiro cria UMA regra
    // e as ocorrencias nascem sozinhas conforme a agenda avanca — nao existe
    // "criar 52 agendamentos".
    if (subView === "fixos") {
      const servicosAtivos = services.filter(s => s.active);
      const escolhidos = servicosAtivos.filter(s => novoFixo.serviceIds.includes(s.id));
      const duracao = escolhidos.reduce((soma, s) => soma + s.duration, 0);
      const valor = escolhidos.reduce((soma, s) => soma + s.price, 0);

      const podeSalvar =
        novoFixo.clientName.trim().length >= 2 &&
        novoFixo.clientPhone.replace(/\D/g, "").length >= 8 &&
        novoFixo.serviceIds.length > 0 &&
        !!novoFixo.startDate && !!novoFixo.endDate &&
        novoFixo.endDate >= novoFixo.startDate;

      const salvarFixo = async () => {
        setSalvandoFixo(true);
        try {
          const res = await fetch("/api/me/recurring", {
            method: "POST",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ ...novoFixo, barberId: novoFixo.barberId || undefined }),
          });
          const data = await res.json();
          if (!res.ok) { toast.error(data.error || "Não consegui criar"); setSalvandoFixo(false); return; }
          toast.success(
            data.ocorrenciasCriadas > 0
              ? `Corte fixo criado — ${data.ocorrenciasCriadas} já entraram na agenda`
              : "Corte fixo criado",
          );
          setNovoFixo(prev => ({ ...prev, clientName: "", clientPhone: "", serviceIds: [] }));
          fetchFixos();
          fetchAppointments();
        } catch { toast.error("Erro de conexão"); }
        setSalvandoFixo(false);
      };

      const encerrarFixo = async (f: CorteFixo) => {
        if (!(await confirmar({
          titulo: `Encerrar o corte fixo de ${f.clientName}?`,
          texto:
            "Os cortes que já aconteceram continuam no histórico. " +
            "Os futuros que ninguém tocou saem da agenda.",
          acao: "Encerrar",
          perigo: true,
        }))) return;
        setEncerrandoFixo(f.id);
        try {
          const res = await fetch("/api/me/recurring?id=" + f.id, { method: "DELETE", headers: authHeaders() });
          const data = await res.json();
          if (!res.ok) { toast.error(data.error || "Não consegui encerrar"); setEncerrandoFixo(null); return; }
          toast.success(`Encerrado — ${data.ocorrenciasRemovidas} horário(s) liberado(s)`);
          fetchFixos();
          fetchAppointments();
        } catch { toast.error("Erro de conexão"); }
        setEncerrandoFixo(null);
      };

      return (
        <div className="space-y-6">{backBtn}
          <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-3">
            <div>
              <h3 className="font-semibold text-white">Novo corte fixo</h3>
              <p className="text-xs text-gray-500 mt-1">
                Um agendamento que se repete toda semana. Você cria uma vez e ele
                aparece sozinho na agenda até a data final.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" placeholder="Nome do cliente *" value={novoFixo.clientName}
                onChange={e => setNovoFixo(prev => ({ ...prev, clientName: e.target.value }))}
                className="rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
              <input type="tel" placeholder="Telefone *" value={novoFixo.clientPhone}
                onChange={e => setNovoFixo(prev => ({ ...prev, clientPhone: e.target.value }))}
                className="rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Serviços *</label>
              <div className="flex gap-2 flex-wrap">
                {servicosAtivos.map(s => {
                  const marcado = novoFixo.serviceIds.includes(s.id);
                  return (
                    <button key={s.id}
                      onClick={() => setNovoFixo(prev => ({
                        ...prev,
                        serviceIds: marcado
                          ? prev.serviceIds.filter(x => x !== s.id)
                          : [...prev.serviceIds, s.id],
                      }))}
                      className={`px-3 py-2 rounded-lg text-sm border transition ${marcado ? "border-brand-400 bg-brand-500/10 text-brand-400" : "border-gray-700 text-gray-400"}`}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
              {novoFixo.serviceIds.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">{duracao} min · R$ {valor.toFixed(2)}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Dia da semana</label>
                <select value={novoFixo.weekday}
                  onChange={e => setNovoFixo(prev => ({ ...prev, weekday: Number(e.target.value) }))}
                  className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none">
                  {DIAS_DA_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Horário</label>
                <input type="time" value={novoFixo.startTime}
                  onChange={e => setNovoFixo(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">De</label>
                <input type="date" value={novoFixo.startDate}
                  onChange={e => setNovoFixo(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Até</label>
                <input type="date" value={novoFixo.endDate} min={novoFixo.startDate || undefined}
                  onChange={e => setNovoFixo(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none" />
              </div>
            </div>

            {user?.role === "owner" && barbers.length > 1 && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Barbeiro</label>
                <select value={novoFixo.barberId}
                  onChange={e => setNovoFixo(prev => ({ ...prev, barberId: e.target.value }))}
                  className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none">
                  <option value="">Eu mesmo</option>
                  {barbers.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            <button onClick={salvarFixo} disabled={!podeSalvar || salvandoFixo}
              className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">
              {salvandoFixo ? "Criando..." : "Criar corte fixo"}
            </button>
          </div>

          {fixosLoading ? <Spinner /> : fixos.length === 0 ? (
            <p className="text-center text-gray-500 py-6">Nenhum corte fixo cadastrado</p>
          ) : (
            <div className="space-y-3">
              {fixos.map(f => (
                <div key={f.id} className={`rounded-xl border bg-dark-800 p-4 ${f.active ? "border-gray-700" : "border-gray-800 opacity-60"}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🔁</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white">{f.clientName}</p>
                      <p className="text-sm text-brand-400">{DIAS_DA_SEMANA[f.weekday]} às {f.startTime}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {f.services.map(s => s.name).join(", ")} · {f.totalDuration}min · R$ {f.totalPrice.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {f.startDate.split("-").reverse().join("/")} até {f.endDate.split("-").reverse().join("/")}
                        {user?.role === "owner" ? " · " + f.barberName : ""}
                      </p>
                      {!f.active && <p className="text-xs text-gray-500 mt-1">encerrado</p>}
                    </div>
                    {f.active && (
                      <button onClick={() => encerrarFixo(f)} disabled={encerrandoFixo === f.id}
                        title="Encerrar" className="shrink-0 rounded-lg border border-gray-700 px-2.5 py-2 text-sm text-gray-400 hover:text-red-400 hover:border-red-500/50 disabled:opacity-40 transition">
                        {encerrandoFixo === f.id ? "…" : "⏹"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // ─── CLIENTES ───
    if (subView === "clientes") {
      const filtered = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch));
      return (
        <div className="space-y-4">{backBtn}
          <input type="text" placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full rounded-xl bg-dark-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors" />
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl bg-dark-800 border border-gray-700 p-3 text-center"><p className="text-lg font-semibold text-white">{clients.length}</p><p className="text-xs text-gray-500">Total</p></div>
            <div className="flex-1 rounded-xl bg-dark-800 border border-gray-700 p-3 text-center"><p className="text-lg font-semibold text-red-400">{clients.filter(c => c.noShowCount > 0).length}</p><p className="text-xs text-gray-500">Com faltas</p></div>
          </div>
          {clientsLoading ? <Spinner /> : filtered.length === 0 ? <p className="text-center text-gray-500 py-6">Nenhum cliente encontrado</p> : (
            <div className="space-y-3">
              {filtered.map(c => (
                <div key={c.id} className="rounded-xl border border-gray-700 bg-dark-800 p-4">
                  <div className="flex items-center justify-between">
                    <div><p className="font-semibold text-white">{c.name}</p><p className="text-sm text-gray-400">{c.phone}</p></div>
                    <div className="text-center"><p className="text-lg font-semibold text-brand-400">{c.totalAppointments}</p><p className="text-xs text-gray-500">visitas</p></div>
                  </div>
                  {c.noShowCount > 0 && <p className="text-xs text-red-400 mt-2">⚠️ {c.noShowCount} falta(s)</p>}
                  {c.notes && <p className="text-xs text-gray-500 mt-2 italic">📝 {c.notes}</p>}
                  {estaBanido(c.phone) && <p className="text-xs text-red-400 mt-2">🚫 Banido — não consegue agendar aqui</p>}
                  <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between gap-3">
                    {user?.role === "owner" ? (
                      estaBanido(c.phone) ? (
                        <button onClick={() => desbanirCliente(c.phone)} className="text-xs text-gray-500 hover:text-green-400 transition">✓ Liberar cliente</button>
                      ) : (
                        <button onClick={() => banirCliente(c.phone, c.name)} disabled={baningClient} className="text-xs text-gray-500 hover:text-red-400 transition disabled:opacity-50">🚫 Banir cliente</button>
                      )
                    ) : <span />}
                    <button onClick={() => deleteClient(c.id, c.name)} disabled={deletingClientId === c.id} className="text-xs text-gray-500 hover:text-red-400 transition disabled:opacity-50">{deletingClientId === c.id ? "Excluindo..." : "🗑️ Excluir dados (LGPD)"}</button>
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
        <div className="rounded-xl bg-brand-500/10 border border-brand-400/30 p-4">
          <p className="text-sm font-semibold text-brand-400 mb-1">Como funciona</p>
          <p className="text-sm text-gray-400">A cada atendimento pago, o cliente ganha 1 ponto. Ao completar 10, ofereça uma recompensa!</p>
        </div>
        {loyaltyLoading ? <Spinner /> : loyalties.length === 0 ? <div className="text-center py-12"><p className="text-4xl mb-3">🏆</p><p className="text-gray-400">Nenhum cliente com pontos ainda.</p></div> : (
          <div className="space-y-3">{loyalties.map(item => (
            <div key={item.clientPhone} className="rounded-xl bg-dark-800 border border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between"><div><p className="font-semibold text-white">{item.clientName}</p><p className="text-xs text-gray-500">{item.clientPhone}</p></div><div className="text-center bg-brand-500/20 rounded-xl px-4 py-2"><p className="text-xl font-semibold text-brand-400">{item.count}</p><p className="text-xs text-gray-400">cortes</p></div></div>
              <div className="flex gap-1.5">{Array.from({ length: 10 }).map((_, i) => (<div key={i} className={`flex-1 h-2 rounded-full ${i < item.progress ? "bg-brand-500" : "bg-gray-700"}`} />))}</div>
              <div className="flex items-center justify-between"><p className="text-xs text-gray-400">{item.progress}/10</p>{item.rewardsEarned > 0 && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">🏆 {item.rewardsEarned}</span>}</div>
            </div>
          ))}</div>
        )}
      </div>
    );

    // ─── LISTA ESPERA ───
    if (subView === "espera") return (
      <div className="space-y-4">{backBtn}
        <div className="rounded-xl bg-brand-500/10 border border-brand-400/30 p-4"><p className="text-sm text-brand-400">🔔 Clientes aguardando vaga.</p></div>
        {waitlistLoading ? <Spinner /> : waitlist.length === 0 ? <div className="text-center py-12 text-gray-500"><p className="text-4xl mb-3">🕐</p><p>Nenhum cliente na lista</p></div> : (
          <div className="space-y-3">{waitlist.map(entry => (
            <div key={entry.id} className="rounded-xl border border-gray-700 bg-dark-800 p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0"><p className="font-semibold text-white">{entry.clientName}</p><p className="text-sm text-gray-400">{entry.clientPhone}</p>{entry.preferredDate && <p className="text-xs text-brand-400 mt-1">📅 Prefere: {new Date(entry.preferredDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</p>}</div>
              <button onClick={() => removeFromWaitlist(entry.id)} disabled={removingWaitId === entry.id} className="text-xs text-red-400 border border-red-500/30 rounded-lg px-3 py-1.5 hover:bg-red-500/10 disabled:opacity-50">{removingWaitId === entry.id ? "..." : "Remover"}</button>
            </div>
          ))}</div>
        )}
      </div>
    );

    return null;
  };

  return (
    <main className="min-h-screen bg-dark-900 pb-20">
      {/* ── Header ── */}
      <header className="bg-dark-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <img src={shopSettings?.logoUrl || "/logo.png"} alt={user?.shopName || "BarberPro"} className="w-9 h-9 rounded-lg object-cover" />
          <div>
            <h1 className="text-lg font-semibold text-brand-400 leading-tight">{user?.shopName || "Painel"}</h1>
            <p className="text-xs text-gray-400">{getGreeting()}, {user?.name || "proprietario"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowQR(v => !v)} className="text-xl p-2">📎</button>
          <button onClick={() => { setActiveTab("config"); setSubView(null); }} className="text-xl p-2">⚙️</button>
        </div>
      </header>

      {/* ── QR/Link Panel ── */}
      {showQR && user?.shopSlug && (
        <div className="mx-4 mt-3 rounded-2xl border border-brand-500/25 bg-dark-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm">Link de agendamento</h3>
              <span className="flex items-center gap-1 rounded-full bg-green-500/15 border border-green-500/40 px-2 py-0.5 text-[10px] font-semibold text-green-400 tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> ONLINE
              </span>
            </div>
            <button onClick={() => setShowQR(false)} className="text-gray-500 hover:text-white text-lg">✕</button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-brand-400 truncate">{bookingLink}</div>
            <button onClick={() => { navigator.clipboard.writeText(bookingLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); }} className="rounded-lg border border-gray-700 text-gray-300 font-semibold px-3 py-2 text-sm hover:text-white transition whitespace-nowrap">{linkCopied ? "✓" : "Copiar"}</button>
          </div>

          <button
            onClick={compartilharLink}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-500 text-dark-900 font-semibold py-2.5 text-sm hover:bg-brand-400 transition press-scale"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4 20-7z" />
            </svg>
            Compartilhar link
          </button>
          <div className="flex flex-col items-center gap-3">
            <div ref={qrRef} className="bg-white rounded-xl p-4"><QRCodeCanvas value={bookingLink} size={180} level="H" includeMargin={false} /></div>
            <button onClick={() => { const canvas = qrRef.current?.querySelector("canvas"); if (!canvas) return; const link = document.createElement("a"); link.download = `qrcode-${user.shopSlug}.png`; link.href = canvas.toDataURL("image/png"); link.click(); }} className="border border-gray-700 text-gray-300 rounded-lg px-4 py-2 text-sm hover:text-white transition">⬇️ Baixar QR Code</button>
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
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      resumoAssinatura.estado === "bloqueada"
                        ? "border-red-500/50 bg-red-500/10 hover:border-red-400"
                        : resumoAssinatura.estado === "carencia"
                          ? "border-yellow-500/50 bg-yellow-500/10 hover:border-yellow-400"
                          : "border-blue-500/40 bg-blue-500/10 hover:border-blue-400"
                    }`}
                  >
                    <p className={`text-sm font-semibold ${
                      resumoAssinatura.estado === "bloqueada" ? "text-red-400"
                      : resumoAssinatura.estado === "carencia" ? "text-yellow-400" : "text-blue-400"
                    }`}>
                      {resumoAssinatura.aviso}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Toque para ver os planos ›</p>
                  </button>
                )}

                <RecoveryNag token={token} onIrParaConfig={() => { setActiveTab("config"); setSubView(null); }} />

                {/* Quick Actions Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {quickActions.map(a => (
                    <button key={a.label} onClick={a.onClick} className="flex flex-col items-center gap-1 rounded-xl border border-gray-700 bg-dark-800 py-3 px-2 hover:border-brand-400/50 hover:bg-brand-500/5 transition-all">
                      <span className="text-xl">{a.icon}</span>
                      <span className="text-xs text-gray-300 leading-tight">{a.label}</span>
                    </button>
                  ))}
                </div>

                {/* Date strip */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {getDateStrip().map(date => {
                    const { weekday, day } = formatDateLabel(date);
                    const isSelected = selectedDate === date;
                    const isToday = date === new Date().toISOString().split("T")[0];
                    return (
                      <button key={date} onClick={() => setSelectedDate(date)} className={`flex-shrink-0 flex flex-col items-center rounded-xl border px-3 py-2 text-center min-w-[52px] transition-all ${isSelected ? "border-brand-400 bg-brand-500/10 text-brand-400" : "border-gray-700 bg-dark-800 text-gray-400 hover:border-gray-600"}`}>
                        <span className="text-xs capitalize">{weekday}</span>
                        <span className="text-lg font-semibold leading-none">{day}</span>
                        {isToday && <div className={`w-1 h-1 rounded-full mt-1 ${isSelected ? "bg-brand-400" : "bg-gray-500"}`} />}
                      </button>
                    );
                  })}
                </div>

                {/* Appointments */}
                <p className="text-xs text-gray-500 uppercase tracking-widest">{appointments.length} agendamento{appointments.length !== 1 ? "s" : ""}</p>
                {agendaLoading ? <Spinner /> : appointments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500"><p className="text-4xl mb-3">📋</p><p>Nenhum agendamento neste dia</p></div>
                ) : (
                  <div className="space-y-3">
                    {appointments.map(appt => {
                      const isPaid = !!appt.paidAt;
                      const isCancelled = appt.status === "cancelled";
                      const isNoShow = appt.status === "no_show";
                      const isPendingPix = appt.status === "pending_payment";
                      const isPayingThis = payingId === appt.id;
                      return (
                        <div key={appt.id} className={`rounded-xl border bg-dark-800 p-4 space-y-3 transition-all ${isCancelled || isNoShow ? "opacity-50 border-gray-800" : "border-gray-700"}`}>
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-brand-400 font-semibold">{appt.startTime} - {appt.endTime}</span>
                                <span className="text-brand-400 font-semibold">R$ {appt.totalPrice?.toFixed(2)}</span>
                              </div>
                              <p className="font-semibold text-white mt-1">{appt.client?.name}</p>
                              <p className="text-sm text-gray-400">{appt.services.map(s => s.name).join(", ")}{appt.barberName ? ` · ${appt.barberName}` : ""}</p>
                              <p className="text-xs text-gray-500">{appt.client?.phone}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${appt.pendingExpired ? "bg-gray-500/20 text-gray-400 border border-gray-600" : (STATUS_COLORS[appt.status] || STATUS_COLORS.pending)}`}>{appt.pendingExpired ? "Pix expirado" : (STATUS_LABELS[appt.status] || appt.status)}</span>
                          </div>

                          {/* Pré-agendamento por Pix: dentro do prazo ou expirado */}
                          {isPendingPix && (
                            appt.pendingExpired ? (
                              <div className="bg-gray-500/10 border border-gray-600 rounded-lg p-3 space-y-2">
                                <p className="text-sm text-gray-300">⌛ Prazo do Pix expirou — o horário foi liberado</p>
                                <p className="text-xs text-gray-500">O cliente tentou agendar mas o pagamento não foi confirmado a tempo. Se o Pix caiu depois, você ainda pode confirmar (se o horário continuar livre).</p>
                                <div className="flex gap-2">
                                  <button onClick={() => confirmPixPayment(appt.id)} className="flex-1 rounded-lg border border-gray-600 py-2 text-sm text-gray-300 hover:text-white hover:border-gray-500 transition">✓ Confirmar mesmo assim</button>
                                  <button onClick={() => remindClient(appt)} className="flex-1 rounded-lg border border-green-500/30 py-2 text-sm text-green-400 hover:bg-green-500/10 transition">💬 Falar com o cliente</button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm text-orange-400">⏳ Cliente informou que pagou — confirme o Pix</p>
                                  {timeLeftLabel(appt.pendingExpiresAt) && (
                                    <span className="text-xs text-orange-300/80 shrink-0 whitespace-nowrap">{timeLeftLabel(appt.pendingExpiresAt)}</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400">Se não confirmar dentro do prazo, o horário volta a ficar livre para outros clientes.</p>
                                <button onClick={() => confirmPixPayment(appt.id)} className="w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-dark-900 hover:bg-orange-400 transition">✓ Confirmar Pix</button>
                              </div>
                            )
                          )}

                          {/* Action buttons: Cancel + No Show / Lembrar */}
                          {appt.status === "confirmed" && !isPayingThis && (
                            <div className="flex gap-2">
                              <button onClick={() => openCancelModal(appt.id)} className="flex-1 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-400 font-medium hover:bg-red-500/20 transition">Cancelar</button>
                              {isAppointmentPast(appt.date, appt.startTime) ? (
                                <button onClick={() => markNoShow(appt.id, appt.client?.name)} className="flex-1 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-sm text-yellow-400 font-medium hover:bg-yellow-500/20 transition">Não veio</button>
                              ) : (
                                <button onClick={() => remindClient(appt)} className="flex-1 py-2 rounded-lg border border-green-500/30 bg-green-500/10 text-sm text-green-400 font-medium hover:bg-green-500/20 transition">🔔 Lembrar</button>
                              )}
                            </div>
                          )}

                          {/* Payment flow */}
                          {!isCancelled && !isNoShow && !isPendingPix && (
                            <div>
                              {isPaid ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Pago {appt.paymentMethod ? `(${PAYMENT_LABELS[appt.paymentMethod] || appt.paymentMethod})` : ""}</span>
                              ) : isPayingThis ? (
                                <div className="space-y-3 pt-1">
                                  {appt.services.length > 0 && (
                                    <div className="space-y-1.5">
                                      <p className="text-xs text-gray-400 font-medium">Serviços realizados:</p>
                                      {appt.services.map(svc => {
                                        const removed = removedServiceIds.includes(svc.serviceId);
                                        return (<label key={svc.serviceId} className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={!removed} onChange={() => { setRemovedServiceIds(prev => removed ? prev.filter(id => id !== svc.serviceId) : [...prev, svc.serviceId]); setCustomPrice(""); }} className="w-4 h-4 accent-yellow-400" /><span className={`flex-1 text-sm ${removed ? "line-through text-gray-600" : "text-white"}`}>{svc.name}</span><span className={`text-sm font-medium ${removed ? "text-gray-600" : "text-brand-400"}`}>R$ {svc.price.toFixed(2)}</span></label>);
                                      })}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2"><p className="text-xs text-gray-400 shrink-0">Valor (R$):</p><input type="number" min="0" step="0.01" value={customPrice !== "" ? customPrice : appt.services.filter(s => !removedServiceIds.includes(s.serviceId)).reduce((sum, s) => sum + s.price, 0).toFixed(2)} onChange={e => setCustomPrice(e.target.value)} className="flex-1 rounded-lg bg-dark-900 border border-gray-700 px-3 py-1.5 text-sm text-white focus:border-brand-400 focus:outline-none text-right" /></div>
                                  <p className="text-xs text-gray-400">Forma de pagamento:</p>
                                  <div className="flex gap-2">{(["pix", "dinheiro", "cartao"] as const).map(m => (<button key={m} onClick={() => setPaymentMethod(m)} className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${paymentMethod === m ? "border-brand-400 bg-brand-500/10 text-brand-400" : "border-gray-700 text-gray-400"}`}>{PAYMENT_LABELS[m]}</button>))}</div>
                                  <div className="flex gap-2">
                                    <button onClick={() => { setPayingId(null); setRemovedServiceIds([]); setCustomPrice(""); }} className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-400 hover:text-white transition">Cancelar</button>
                                    <button disabled={confirmingPayId === appt.id} onClick={() => handleConfirmPayment(appt.id)} className="flex-1 rounded-lg bg-brand-500 py-2 text-sm font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">{confirmingPayId === appt.id ? "..." : "Confirmar"}</button>
                                  </div>
                                </div>
                              ) : appt.status === "confirmed" && (
                                <button onClick={() => { setPayingId(appt.id); setPaymentMethod("pix"); setRemovedServiceIds([]); setCustomPrice(""); }} className="w-full rounded-lg border border-brand-400/50 py-2 text-sm text-brand-400 hover:bg-brand-500/10 transition">💰 Confirmar Pagamento</button>
                              )}
                            </div>
                          )}

                          {/* CRM Notes */}
                          {!isCancelled && !isNoShow && (
                            <div className="pt-1 border-t border-gray-800">
                              <p className="text-xs text-gray-500 mb-1">📝 Notas</p>
                              <textarea rows={2} placeholder="Observações sobre o cliente..." value={clientNotes[appt.client.id] ?? (appt.client.notes || "")} onChange={e => setClientNotes(prev => ({...prev, [appt.client.id]: e.target.value}))} onBlur={() => saveClientNote(appt.client.id, clientNotes[appt.client.id] ?? (appt.client.notes || ""))} className="w-full rounded-lg bg-dark-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-400 focus:outline-none resize-none transition-colors" />
                              {savingNote === appt.client.id && <p className="text-xs text-gray-500 mt-1">Salvando...</p>}
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
                    className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition press-scale ${
                      totalAReceber.promessasVencidas > 0
                        ? "border-red-500/40 bg-red-500/5 hover:bg-red-500/10"
                        : "border-yellow-500/40 bg-yellow-500/5 hover:bg-yellow-500/10"
                    }`}
                  >
                    <span className="text-xl shrink-0">💰</span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm font-semibold ${totalAReceber.promessasVencidas > 0 ? "text-red-400" : "text-yellow-400"}`}>
                        {totalAReceber.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} a receber
                      </span>
                      <span className="block text-xs text-gray-500">
                        {totalAReceber.promessasVencidas > 0
                          ? `${totalAReceber.promessasVencidas} prometeu e não pagou`
                          : "Ver quem está devendo"}
                      </span>
                    </span>
                    <span className="text-gray-600 shrink-0">›</span>
                  </button>
                )}

                <button
                  onClick={() => setVerRelatorio(true)}
                  className="w-full flex items-center gap-3 rounded-xl border border-brand-400/40 bg-brand-500/5 px-4 py-3.5 text-left hover:bg-brand-500/10 transition press-scale"
                >
                  <span className="text-xl shrink-0">📄</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-brand-400">Relatório por período</span>
                    <span className="block text-xs text-gray-500">Quem deve, como entrou, comissões</span>
                  </span>
                  <span className="text-brand-400/50 shrink-0">›</span>
                </button>

                {dashLoading ? <Spinner /> : !dashboard ? <p className="text-center text-gray-500 py-10">Não foi possível carregar</p> : (
                  <>
                    <div className="rounded-2xl bg-brand-500/10 border border-brand-400/30 p-5">
                      <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
                      <p className="text-4xl font-semibold text-brand-400">R$ {dashboard.month.revenue.toFixed(2)}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {dashboard.month.revenueGrowth !== null && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dashboard.month.revenueGrowth >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{dashboard.month.revenueGrowth >= 0 ? "▲" : "▼"} {Math.abs(dashboard.month.revenueGrowth)}%</span>}
                        {dashboard.month.toReceive > 0 && <span className="text-xs text-brand-400/80">+ R$ {dashboard.month.toReceive.toFixed(2)} a receber</span>}
                      </div>
                    </div>
                    <div><p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Hoje</p>
                      <div className="grid grid-cols-3 gap-2">
                        <StatBox value={`R$ ${dashboard.today.received.toFixed(2)}`} label="Recebido" color="text-green-400" />
                        <StatBox value={`${dashboard.today.appointments}`} label="Agendamentos" />
                        <StatBox value={`R$ ${dashboard.today.expected.toFixed(2)}`} label="A receber" color="text-brand-400" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <StatBox value={`${dashboard.month.appointments}`} label="Atendimentos" extra={dashboard.month.aptGrowth !== null ? `${dashboard.month.aptGrowth >= 0 ? "+" : ""}${dashboard.month.aptGrowth}%` : undefined} extraColor={dashboard.month.aptGrowth && dashboard.month.aptGrowth >= 0 ? "text-green-400" : "text-red-400"} />
                      <StatBox value={`R$ ${dashboard.month.avgTicket.toFixed(2)}`} label="Ticket médio" />
                      <StatBox value={`${dashboard.month.cancelRate}%`} label="Cancelamentos" color={dashboard.month.cancelRate > 20 ? "text-red-400" : dashboard.month.cancelRate > 10 ? "text-yellow-400" : "text-green-400"} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <StatBox value={`${dashboard.totalClients}`} label="Clientes" />
                      <StatBox value={dashboard.avgRating ? `${dashboard.avgRating} ★` : "—"} label="Avaliação" color="text-yellow-400" />
                      {dashboard.peakHour && <StatBox value={`⚡ ${dashboard.peakHour}`} label="Pico" color="text-brand-400" />}
                    </div>
                    {dashboard.barberStats?.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Ranking</p>
                        {dashboard.barberStats.map((b, i) => (
                          <div key={i} className="rounded-xl bg-dark-800 border border-gray-700 p-4 space-y-2">
                            <div className="flex items-center gap-3"><span className="text-brand-400 font-semibold w-6">#{i+1}</span><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">{b.name}</p><p className="text-xs text-gray-400">{b.count} atend.</p></div><p className="text-sm font-semibold text-brand-400">R$ {b.revenue.toFixed(2)}</p></div>
                            <div className="h-1.5 rounded-full bg-gray-700"><div className="h-1.5 rounded-full bg-brand-500 transition-all" style={{ width: `${Math.round(b.revenueShare * 100)}%` }} /></div>
                            {b.commission > 0 && <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5"><span className="text-xs text-green-400">Comissao ({b.commission}%)</span><span className="text-xs font-semibold text-green-400">R$ {b.commissionValue.toFixed(2)}</span></div>}
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
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => (configView ? setConfigView(null) : setActiveTab("home"))}
                    className="flex items-center gap-1 text-brand-400 text-sm hover:text-brand-300 shrink-0"
                  >
                    <span className="text-lg">←</span> Voltar
                  </button>
                  <h2 className="text-lg font-semibold text-white">
                    {configView ? CONFIG_TITULOS[configView] : "⚙️ Configurações"}
                  </h2>
                </div>

                {/* ─── Menu ─── */}
                {!configView && (
                  <>
                    {/* Cartões com o valor atual de cada coisa. Ler o estado da
                        barbearia sem abrir nada é o ponto — e um cartão que segue
                        mostrando o valor antigo denuncia na hora que a alteração
                        não salvou. */}
                    <button
                      onClick={() => setConfigView("horario")}
                      className="w-full rounded-2xl border border-gray-700 bg-dark-800 p-4 text-left hover:border-brand-400 transition-all press-scale"
                    >
                      <p className="text-xs text-gray-500">🕐 Horário e dias</p>
                      <p className="mt-1 text-lg font-semibold text-white tabular-nums">
                        {resumo
                          ? `${resumo.horario.openTime} – ${resumo.horario.closeTime} · ${resumirDias(resumo.horario.workDays)}`
                          : "—"}
                      </p>
                    </button>

                    {cartoesCadastro.length > 0 && (
                      <>
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Cadastros</p>
                        <div className="grid grid-cols-2 gap-2.5">
                          {cartoesCadastro.map(c => <TileConfig key={c.label} c={c} onClick={() => abrirCartao(c)} />)}
                        </div>
                      </>
                    )}

                    {cartoesBarbearia.length > 0 && (
                      <>
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Barbearia</p>
                        <div className="grid grid-cols-2 gap-2.5">
                          {cartoesBarbearia.map(c => <TileConfig key={c.label} c={c} onClick={() => abrirCartao(c)} />)}
                        </div>
                      </>
                    )}

                    {resumoAssinatura && (
                      <>
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Plano</p>
                        <button
                          onClick={() => setConfigView("assinatura")}
                          className={`w-full rounded-2xl border p-4 text-left transition-all press-scale ${
                            resumoAssinatura.estado === "bloqueada" || resumoAssinatura.estado === "carencia"
                              ? "border-yellow-500/50 bg-yellow-500/5 hover:border-yellow-400"
                              : "border-gray-700 bg-dark-800 hover:border-brand-400"
                          }`}
                        >
                          <p className="text-xs text-gray-500">⭐ Minha assinatura</p>
                          <p className={`mt-1 text-lg font-semibold ${
                            resumoAssinatura.estado === "bloqueada" ? "text-red-400"
                            : resumoAssinatura.estado === "carencia" ? "text-yellow-400"
                            : resumoAssinatura.estado === "trial" ? "text-blue-400"
                            : "text-white"
                          }`}>
                            {ROTULO_ASSINATURA[resumoAssinatura.estado] || resumoAssinatura.estado}
                            {resumoAssinatura.estado !== "cortesia" && (
                              <span className="text-sm font-normal text-gray-500 ml-2 tabular-nums">
                                {resumoAssinatura.diasRestantes}d
                              </span>
                            )}
                          </p>
                        </button>
                      </>
                    )}

                    <p className="text-xs text-gray-500 uppercase tracking-widest">Conta</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {cartoesConta.map(c => <TileConfig key={c.label} c={c} onClick={() => abrirCartao(c)} />)}
                    </div>

                    {/* Logout */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{user?.name || "—"}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.shopName}{user?.role === "owner" ? " · dono" : " · barbeiro"}</p>
                  </div>
                  <button onClick={handleLogout} className="shrink-0 flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition">
                    Sair <span>→</span>
                  </button>
                </div>

                    <p className="text-center text-xs text-gray-600 pb-4">BarberPro v2.0</p>
                  </>
                )}

                {/* ─── Dados da barbearia ─── */}
                {configView === "dados" && (
                  <>
                    {/* Identidade e endereco — o cliente precisa saber onde fica */}
                {shopSettings && (
                  <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-4">
                    <div>
                      <h3 className="font-semibold text-white">🏠 Dados da Barbearia</h3>
                      <p className="text-xs text-gray-500 mt-1">Aparecem no link que o cliente abre para agendar.</p>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Nome da barbearia</label>
                      <input type="text" value={shopSettings.name} onChange={e => setShopSettings(p => p ? { ...p, name: e.target.value } : p)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none" />
                      <p className="text-xs text-gray-500 mt-1">O link continua o mesmo ({bookingLink.replace(/^https?:\/\//, "")}) — trocar o nome nao quebra o que voce ja mandou pros clientes.</p>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Telefone / WhatsApp</label>
                      <input type="tel" inputMode="numeric" placeholder="(00) 00000-0000" value={shopSettings.phone} onChange={e => setShopSettings(p => p ? { ...p, phone: e.target.value } : p)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Endereço (rua e número)</label>
                      <input type="text" placeholder="Rua das Flores, 123" value={shopSettings.address} onChange={e => setShopSettings(p => p ? { ...p, address: e.target.value } : p)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Bairro</label>
                        <input type="text" value={shopSettings.neighborhood} onChange={e => setShopSettings(p => p ? { ...p, neighborhood: e.target.value } : p)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">CEP</label>
                        <input type="text" inputMode="numeric" placeholder="00000-000" value={shopSettings.zipCode} onChange={e => setShopSettings(p => p ? { ...p, zipCode: e.target.value } : p)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs text-gray-400 mb-1 block">Cidade</label>
                        <input type="text" value={shopSettings.city} onChange={e => setShopSettings(p => p ? { ...p, city: e.target.value } : p)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">UF</label>
                        <input type="text" maxLength={2} placeholder="SP" value={shopSettings.state} onChange={e => setShopSettings(p => p ? { ...p, state: e.target.value.toUpperCase() } : p)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 uppercase focus:border-brand-400 focus:outline-none" />
                      </div>
                    </div>

                    <button onClick={saveShopSettings} disabled={savingSettings} className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">
                      {savingSettings ? "Salvando..." : "Salvar dados"}
                    </button>
                  </div>
                )}
                  </>
                )}

                {/* ─── Horário e dias ─── */}
                {configView === "horario" && (
                  <>
                    {/* Shop settings */}
                {shopSettings && (
                  <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-5">
                    <h3 className="font-semibold text-white">🕐 Horário de funcionamento</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-2">Abertura</p>
                        <input type="time" value={shopSettings.openTime} onChange={e => setShopSettings(p => p ? {...p, openTime: e.target.value} : p)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white text-center text-lg font-semibold focus:border-brand-400 focus:outline-none" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-2">Fechamento</p>
                        <input type="time" value={shopSettings.closeTime} onChange={e => setShopSettings(p => p ? {...p, closeTime: e.target.value} : p)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white text-center text-lg font-semibold focus:border-brand-400 focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-2">Dias de trabalho</p>
                      <div className="grid grid-cols-7 gap-1.5">{WEEKDAYS.map((d, i) => (<button key={i} onClick={() => setShopSettings(p => p ? {...p, workDays: p.workDays.includes(i) ? p.workDays.filter(x => x !== i) : [...p.workDays, i].sort()} : p)} className={`py-2.5 rounded-lg border text-sm font-medium transition ${shopSettings.workDays.includes(i) ? "border-brand-400 bg-brand-500/10 text-brand-400" : "border-gray-700 text-gray-500"}`}>{d}</button>))}</div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">De quanto em quanto tempo</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[15, 20, 30, 45, 60].map(min => (
                          <button
                            key={min}
                            onClick={() => setShopSettings(p => p ? { ...p, slotInterval: min } : p)}
                            className={`py-2.5 rounded-lg border text-sm font-medium transition ${
                              shopSettings.slotInterval === min
                                ? "border-brand-400 bg-brand-500/10 text-brand-400"
                                : "border-gray-700 text-gray-500 hover:text-gray-300"
                            }`}
                          >
                            {min === 60 ? "1h" : min + "m"}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">
                        {shopSettings.slotInterval === 60
                          ? "O cliente vê 08:00, 09:00, 10:00 — um atendimento por hora."
                          : `O cliente vê horários a cada ${shopSettings.slotInterval} minutos.`}
                      </p>
                    </div>

                    <div><p className="text-xs text-gray-400 mb-1">Chave Pix</p><input type="text" placeholder="Sua chave pix" value={shopSettings.pixKey} onChange={e => setShopSettings(p => p ? {...p, pixKey: e.target.value} : p)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" /></div>

                    {/* Booking mode */}
                    <div><p className="text-xs text-gray-400 mb-2">Modo de Atendimento</p>
                      <div className="flex gap-2">
                        <button onClick={() => setShopSettings(p => p ? {...p, bookingMode: "steps"} : p)} className={`flex-1 rounded-xl py-3 text-sm font-semibold transition border ${shopSettings.bookingMode === "steps" ? "bg-brand-500 text-dark-900 border-brand-500" : "bg-transparent text-gray-400 border-gray-700"}`}>📋 Etapas</button>
                        <button onClick={() => setShopSettings(p => p ? {...p, bookingMode: "agent"} : p)} className={`flex-1 rounded-xl py-3 text-sm font-semibold transition border ${shopSettings.bookingMode === "agent" ? "bg-blue-600 text-white border-blue-600" : "bg-transparent text-gray-400 border-gray-700"}`}>🤖 Agente IA</button>
                      </div>
                    </div>

                    <button onClick={saveShopSettings} disabled={savingSettings} className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">{savingSettings ? "Salvando..." : "Salvar configurações"}</button>
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
                  <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-4">
                    <div>
                      <h3 className="font-semibold text-white">🖼️ Logo da barbearia</h3>
                      <p className="text-xs text-gray-500 mt-1">Aparece no topo do link que você envia para os clientes.</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {shopSettings.logoUrl ? (
                        <img src={shopSettings.logoUrl} alt="Logo" className="w-16 h-16 rounded-xl object-cover border border-brand-500/30 shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-brand-500/10 border border-gray-700 flex items-center justify-center text-2xl shrink-0">✂️</div>
                      )}
                      <div className="flex-1 space-y-2">
                        <label className={`block text-center rounded-lg border border-brand-400/50 py-2 text-sm text-brand-400 hover:bg-brand-500/10 transition cursor-pointer ${uploadingLogo ? "opacity-50 pointer-events-none" : ""}`}>
                          {uploadingLogo ? "Enviando..." : shopSettings.logoUrl ? "Trocar logo" : "Enviar logo"}
                          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingLogo} onChange={e => handleLogoUpload(e.target.files?.[0] || null)} />
                        </label>
                        {shopSettings.logoUrl && (
                          <button onClick={handleRemoveLogo} disabled={uploadingLogo} className="w-full rounded-lg border border-gray-700 py-2 text-xs text-gray-400 hover:text-red-400 transition disabled:opacity-50">Remover logo</button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">JPG, PNG ou WEBP · máx 3MB · de preferência quadrado.</p>
                  </div>
                )}
                  </>
                )}

                {/* ─── Notificações ─── */}
                {configView === "notificacoes" && <PushToggle token={token} />}

                {/* ─── Senha e recuperação ─── */}
                {configView === "senha" && (
                  <>
                    <RecoveryCode token={token} />
                    {/* Change password */}
                <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-3">
                  <h3 className="font-semibold text-white">🔒 Alterar senha</h3>
                  <input type="password" placeholder="Senha atual" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
                  <input type="password" placeholder="Nova senha (min 6)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
                  <button onClick={handleChangePassword} disabled={changingPassword} className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">{changingPassword ? "Alterando..." : "Alterar senha"}</button>
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
                    <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-3">
                      <p className="text-xs text-gray-500">
                        Cliente banido não consegue agendar nem entrar na lista de espera desta
                        barbearia. O histórico e o financeiro dele continuam intactos, e ele pode
                        agendar normalmente em outras barbearias do BarberPro.
                      </p>
                      <input type="tel" inputMode="numeric" placeholder="Telefone (com DDD)" value={novoBanido.phone} onChange={e => setNovoBanido(p => ({ ...p, phone: e.target.value }))} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
                      <input type="text" placeholder="Motivo (opcional, só você vê)" value={novoBanido.reason} onChange={e => setNovoBanido(p => ({ ...p, reason: e.target.value }))} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
                      <button onClick={() => banirCliente(novoBanido.phone, undefined, novoBanido.reason)} disabled={baningClient} className="w-full rounded-xl border border-red-500/40 bg-red-500/10 py-3 font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition">
                        {baningClient ? "Banindo..." : "Banir este telefone"}
                      </button>
                    </div>

                    {bannedLoading ? <Spinner /> : banned.length === 0 ? (
                      <p className="text-center text-gray-500 py-6">Nenhum cliente banido</p>
                    ) : (
                      <div className="space-y-2">
                        {banned.map(b => (
                          <div key={b.id} className="flex items-center gap-3 rounded-xl bg-dark-800 border border-gray-700 p-4">
                            <span className="text-xl shrink-0">🚫</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-white truncate">{b.name || "Sem nome"}</p>
                              <p className="text-sm text-gray-400">{b.phone}</p>
                              {b.reason && <p className="text-xs text-gray-500 mt-0.5 truncate">{b.reason}</p>}
                            </div>
                            <button onClick={() => desbanirCliente(b.phone)} className="shrink-0 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-400 hover:text-green-400 hover:border-green-500/50 transition">
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

      {/* ── Bottom Navigation (mobile-like) ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-gray-700 flex z-30 safe-bottom">
        {([
          { tab: "home" as Tab, icon: "🏠", label: "Inicio" },
          { tab: "agenda" as Tab, icon: "📅", label: "Agenda" },
          { tab: "financeiro" as Tab, icon: "💰", label: "Financeiro" },
          { tab: "config" as Tab, icon: "⚙️", label: "Config" },
        ]).map(item => (
          <button key={item.tab} onClick={() => { setActiveTab(item.tab); setSubView(null); }} className={`flex-1 flex flex-col items-center py-2.5 text-xs transition-colors ${activeTab === item.tab && !subView ? "text-brand-400" : "text-gray-500"}`}>
            <span className="text-lg leading-none mb-0.5">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
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
  c: { icon: string; label: string; valor: string; pendente?: boolean };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-1 rounded-2xl border bg-dark-800 p-3.5 text-left transition-all press-scale ${
        c.pendente
          ? "border-yellow-500/40 hover:border-yellow-400"
          : "border-gray-700 hover:border-brand-400"
      }`}
    >
      <span className="text-lg leading-none">{c.icon}</span>
      <span className={`text-sm font-semibold leading-tight ${c.pendente ? "text-yellow-400" : "text-white"}`}>
        {c.valor}
      </span>
      <span className="text-xs text-gray-500 leading-tight">{c.label}</span>
    </button>
  );
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" /></div>;
}

function StatBox({ value, label, color, extra, extraColor }: { value: string; label: string; color?: string; extra?: string; extraColor?: string }) {
  return (
    <div className="rounded-xl bg-dark-800 border border-gray-700 p-3 text-center">
      <p className={`text-lg font-semibold ${color || "text-white"}`}>{value}</p>
      {extra && <p className={`text-xs font-semibold ${extraColor || ""}`}>{extra}</p>}
      {/* Quebra em duas linhas em vez de cortar: "Agendamentos" não cabe
          numa coluna de 1/3 de tela a 320px, e cortar palavra é pior que
          usar uma linha a mais. */}
      <p className="text-xs text-gray-500 mt-1 leading-tight break-words">{label}</p>
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
        className="border border-gray-700 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl"
        style={{ backgroundColor: "#161625" }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white">Cancelar agendamento?</h3>
        {appt && (
          <div className="rounded-xl bg-dark-900 border border-gray-700 p-3">
            <p className="font-medium text-white">{appt.client?.name}</p>
            <p className="text-sm text-gray-400">{appt.startTime} - {appt.endTime} · {appt.services.map(s => s.name).join(", ")}</p>
          </div>
        )}
        {waitlistCount > 0 && (
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-400">📋 Lista de espera</p>
                <p className="text-xs text-gray-400">{waitlistCount} cliente{waitlistCount > 1 ? "s" : ""} aguardando vaga</p>
              </div>
              <button onClick={onToggleNotify} className={`w-12 h-6 rounded-full transition-colors shrink-0 ${notifyWaitlist ? "bg-blue-500" : "bg-gray-700"}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${notifyWaitlist ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
            {notifyWaitlist && (
              <p className="text-xs text-blue-300">Ao cancelar, abriremos o WhatsApp para voce avisar os clientes da lista de espera.</p>
            )}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-700 py-3 text-sm text-gray-400 hover:text-white transition">Voltar</button>
          <button onClick={onConfirm} disabled={confirming} className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-all">{confirming ? "Cancelando..." : "Confirmar Cancelamento"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
