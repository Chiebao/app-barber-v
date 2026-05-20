"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { getPaletteById, paletteToVars } from "@/app/lib/palettes";

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
  client: { id: string; name: string; phone: string; noShowCount: number; notes: string | null };
  services: AppointmentService[];
}
interface Barber { id: string; name: string; phone: string; active: boolean; commission?: number; role?: string; }
interface DashboardData {
  today: { appointments: number; received: number; expected: number };
  month: { appointments: number; revenue: number; toReceive: number; avgTicket: number; cancelRate: number; revenueGrowth: number | null; aptGrowth: number | null; prevRevenue: number; prevApts: number; };
  avgRating: number | null;
  barberStats: { name: string; count: number; revenue: number; commission: number; commissionValue: number; revenueShare: number }[];
  peakHour: string | null; totalClients: number; barbers: number;
}
interface ServiceItem { id: string; name: string; duration: number; price: number; category: string; active: boolean; }
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
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

type Tab = "home" | "agenda" | "financeiro" | "config";
type SubView = null | "barbeiros" | "servicos" | "clientes" | "fidelidade" | "espera" | "produtos";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function PainelPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ name?: string; shopName?: string; shopSlug?: string; role?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [subView, setSubView] = useState<SubView>(null);
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
  const [addingBarber, setAddingBarber] = useState(false);

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

  // ── Clients state ──
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  // ── Config state ──
  const [shopSettings, setShopSettings] = useState<{ openTime: string; closeTime: string; workDays: number[]; pixKey: string; bookingMode: string } | null>(null);
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
    fetch("/api/me/shop", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(data => {
        if (data.shop?.colorTheme) applyAdminTheme(data.shop.colorTheme);
        if (data.shop) setShopSettings({
          openTime: data.shop.openTime || "08:00",
          closeTime: data.shop.closeTime || "20:00",
          workDays: data.shop.workDays || [1,2,3,4,5,6],
          pixKey: data.shop.pixKey || "",
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

  // ── Fetchers ──
  const fetchAppointments = useCallback(async () => {
    if (!token) return;
    setAgendaLoading(true);
    try {
      const res = await fetch(`/api/me/appointments?date=${selectedDate}`, { headers: authHeaders() });
      const data = await res.json();
      setAppointments(data.appointments || []);
    } catch { setAppointments([]); }
    finally { setAgendaLoading(false); }
  }, [token, selectedDate, authHeaders]);

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

  useEffect(() => { if (token && activeTab === "home") fetchAppointments(); }, [selectedDate]);
  useEffect(() => { if (token && activeTab === "agenda") fetchSlots(); }, [availDate]);
  useEffect(() => {
    if (!token || !subView) return;
    if (subView === "barbeiros") fetchBarbers();
    if (subView === "fidelidade") fetchLoyalty();
    if (subView === "espera") fetchWaitlist();
    if (subView === "servicos") fetchServices();
    if (subView === "clientes") fetchClients();
  }, [token, subView]);

  // ── Actions ──
  const cancelAppointment = async (id: string) => {
    if (!confirm("Cancelar este agendamento?")) return;
    try {
      await fetch(`/api/appointments/${id}/cancel`, { method: "PATCH", headers: authHeaders() });
      fetchAppointments();
    } catch { alert("Erro ao cancelar"); }
  };

  const markNoShow = async (id: string, clientName: string) => {
    if (!confirm(`${clientName} nao compareceu? Isso sera registrado.`)) return;
    try {
      await fetch(`/api/appointments/${id}/no-show`, { method: "PATCH", headers: authHeaders() });
      fetchAppointments();
    } catch { alert("Erro ao registrar"); }
  };

  const confirmPixPayment = async (id: string) => {
    if (!confirm("Confirmar pagamento via Pix?")) return;
    try {
      await fetch(`/api/appointments/${id}/confirm-payment`, { method: "PATCH", headers: authHeaders() });
      fetchAppointments();
    } catch { alert("Erro ao confirmar"); }
  };

  const handleConfirmPayment = async (appointmentId: string) => {
    if (!token) return;
    setConfirmingPayId(appointmentId);
    try {
      const body: Record<string, unknown> = { appointmentId, paymentMethod };
      if (removedServiceIds.length > 0) body.removedServiceIds = removedServiceIds;
      if (customPrice !== "") body.customPrice = parseFloat(customPrice);
      const res = await fetch("/api/me/finance", { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
      if (res.ok) { setPayingId(null); setRemovedServiceIds([]); setCustomPrice(""); fetchAppointments(); }
      else alert("Erro ao confirmar pagamento");
    } catch { alert("Erro ao confirmar pagamento"); }
    finally { setConfirmingPayId(null); }
  };

  const saveClientNote = async (clientId: string, note: string) => {
    setSavingNote(clientId);
    try { await fetch(`/api/me/clients/${clientId}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ notes: note || null }) }); }
    catch {} setSavingNote(null);
  };

  const handleToggleBarber = async (barberId: string, active: boolean) => {
    try { await fetch("/api/auth/add-barber", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ barberId, active }) }); fetchBarbers(); }
    catch { alert("Erro"); }
  };

  const handleAddBarber = async () => {
    if (!newBarberName.trim() || !newBarberPhone.trim() || newBarberPassword.length < 6) { alert("Preencha todos os campos (senha min 6)"); return; }
    setAddingBarber(true);
    try {
      const res = await fetch("/api/auth/add-barber", { method: "POST", headers: authHeaders(), body: JSON.stringify({ name: newBarberName, phone: newBarberPhone.replace(/\D/g, ""), password: newBarberPassword, commission: newBarberCommission ? parseFloat(newBarberCommission) : 0 }) });
      if (res.ok) { setNewBarberName(""); setNewBarberPhone(""); setNewBarberPassword(""); setNewBarberCommission(""); fetchBarbers(); }
      else { const d = await res.json(); alert(d.error || "Erro"); }
    } catch { alert("Erro"); } finally { setAddingBarber(false); }
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
    } catch { alert("Erro"); }
    finally { setSlotsSaving(false); }
  };

  const blockAllDay = async () => {
    if (!confirm("Bloquear o dia todo?")) return;
    setSlotsSaving(true);
    const bid = user?.role === "owner" && ownerBarberId ? ownerBarberId : undefined;
    try {
      await fetch("/api/me/blocked-slots", { method: "POST", headers: authHeaders(), body: JSON.stringify({ date: availDate, allDay: true, ...(bid ? { barberId: bid } : {}) }) });
      setSlotData(prev => prev ? { ...prev, allDay: true, blocked: [...prev.allSlots] } : prev);
    } catch { alert("Erro"); } finally { setSlotsSaving(false); }
  };

  const unblockAllDay = async () => {
    setSlotsSaving(true);
    const bid = user?.role === "owner" && ownerBarberId ? ownerBarberId : undefined;
    try {
      await fetch("/api/me/blocked-slots", { method: "DELETE", headers: authHeaders(), body: JSON.stringify({ date: availDate, allDay: true, ...(bid ? { barberId: bid } : {}) }) });
      setSlotData(prev => prev ? { ...prev, allDay: false, blocked: [] } : prev);
    } catch { alert("Erro"); } finally { setSlotsSaving(false); }
  };

  const removeFromWaitlist = async (id: string) => {
    setRemovingWaitId(id);
    try { await fetch(`/api/me/waitlist/${id}`, { method: "DELETE", headers: authHeaders() }); setWaitlist(prev => prev.filter(e => e.id !== id)); }
    catch {} setRemovingWaitId(null);
  };

  const handleAddService = async () => {
    if (!newService.name.trim() || !newService.price) { alert("Preencha nome e preco"); return; }
    setAddingService(true);
    try {
      const res = await fetch("/api/me/services", { method: "POST", headers: authHeaders(), body: JSON.stringify({ name: newService.name, duration: parseInt(newService.duration), price: parseFloat(newService.price), category: newService.category }) });
      if (res.ok) { setNewService({ name: "", duration: "30", price: "", category: "corte" }); fetchServices(); }
      else { const d = await res.json(); alert(d.error || "Erro"); }
    } catch { alert("Erro"); } finally { setAddingService(false); }
  };

  const toggleService = async (id: string, active: boolean) => {
    try { await fetch("/api/me/services", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ id, active }) }); fetchServices(); }
    catch { alert("Erro"); }
  };

  const saveShopSettings = async () => {
    if (!shopSettings) return;
    setSavingSettings(true);
    try {
      await fetch("/api/me/shop", { method: "PATCH", headers: authHeaders(), body: JSON.stringify(shopSettings) });
      alert("Configuracoes salvas!");
    } catch { alert("Erro ao salvar"); }
    finally { setSavingSettings(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { alert("Senha deve ter min 6 caracteres"); return; }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/me/password", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ currentPassword, newPassword }) });
      if (res.ok) { alert("Senha alterada com sucesso!"); setCurrentPassword(""); setNewPassword(""); }
      else { const d = await res.json(); alert(d.error || "Erro"); }
    } catch { alert("Erro"); } finally { setChangingPassword(false); }
  };

  const handleLogout = () => { localStorage.removeItem("admin_token"); localStorage.removeItem("admin_user"); router.push("/admin"); };

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
  const quickActions = [
    { icon: "💰", label: "Financeiro", onClick: () => setActiveTab("financeiro") },
    { icon: "🏆", label: "Fidelidade", onClick: () => { setSubView("fidelidade"); setActiveTab("home"); } },
    { icon: "📅", label: "Agenda", onClick: () => setActiveTab("agenda") },
    { icon: "🔧", label: "Servicos", onClick: () => { setSubView("servicos"); setActiveTab("home"); } },
    { icon: "👥", label: "Clientes", onClick: () => { setSubView("clientes"); setActiveTab("home"); } },
    ...(user?.role === "owner" ? [
      { icon: "✂️", label: "Barbeiros", onClick: () => { setSubView("barbeiros"); setActiveTab("home"); } },
      { icon: "🕐", label: "Lista Espera", onClick: () => { setSubView("espera"); setActiveTab("home"); } },
    ] : []),
  ];

  // ── Render SubViews ──
  const renderSubView = () => {
    if (!subView) return null;
    const backBtn = <button onClick={() => setSubView(null)} className="flex items-center gap-2 text-brand-400 mb-4 text-sm hover:text-brand-300"><span>←</span> Voltar</button>;

    // ─── BARBEIROS ───
    if (subView === "barbeiros") return (
      <div className="space-y-6">{backBtn}
        <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-3">
          <h3 className="font-semibold text-white">Adicionar Barbeiro</h3>
          <input type="text" placeholder="Nome *" value={newBarberName} onChange={e => setNewBarberName(e.target.value)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors" />
          <input type="tel" placeholder="Telefone (com DDD) *" value={newBarberPhone} onChange={e => setNewBarberPhone(e.target.value)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors" />
          <input type="password" placeholder="Senha (min 6) *" value={newBarberPassword} onChange={e => setNewBarberPassword(e.target.value)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors" />
          <div className="relative">
            <input type="number" min="0" max="100" placeholder="Comissao (%)" value={newBarberCommission} onChange={e => setNewBarberCommission(e.target.value)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 pr-10 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
          </div>
          <button onClick={handleAddBarber} disabled={addingBarber} className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">{addingBarber ? "Adicionando..." : "Adicionar Barbeiro"}</button>
        </div>
        {barbersLoading ? <Spinner /> : barbers.length === 0 ? <p className="text-center text-gray-500 py-6">Nenhum barbeiro cadastrado</p> : (
          <div className="space-y-3">
            {barbers.map(b => (
              <div key={b.id} className={`flex items-center gap-4 rounded-xl border bg-dark-800 p-4 ${b.active ? "border-gray-700" : "border-gray-800 opacity-60"}`}>
                <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-lg shrink-0">{b.name.charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0"><p className="font-medium text-white">{b.name}</p><p className="text-sm text-gray-400">{b.phone}{(b.commission ?? 0) > 0 && <span className="ml-2 text-brand-400">· {b.commission}%</span>}</p></div>
                <button onClick={() => handleToggleBarber(b.id, !b.active)} className={`w-12 h-6 rounded-full transition-colors shrink-0 ${b.active ? "bg-brand-500" : "bg-gray-700"}`}><div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${b.active ? "translate-x-6" : "translate-x-0.5"}`} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    // ─── SERVICOS ───
    if (subView === "servicos") return (
      <div className="space-y-6">{backBtn}
        <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-3">
          <h3 className="font-semibold text-white">Adicionar Servico</h3>
          <input type="text" placeholder="Nome do servico *" value={newService.name} onChange={e => setNewService(p => ({...p, name: e.target.value}))} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors" />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Preco *" value={newService.price} onChange={e => setNewService(p => ({...p, price: e.target.value}))} className="rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
            <input type="number" placeholder="Duracao (min)" value={newService.duration} onChange={e => setNewService(p => ({...p, duration: e.target.value}))} className="rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button key={key} onClick={() => setNewService(p => ({...p, category: key}))} className={`px-3 py-2 rounded-lg text-sm border transition ${newService.category === key ? "border-brand-400 bg-brand-500/10 text-brand-400" : "border-gray-700 text-gray-400"}`}>{CATEGORY_ICONS[key]} {label}</button>
            ))}
          </div>
          <button onClick={handleAddService} disabled={addingService} className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">{addingService ? "Adicionando..." : "Adicionar Servico"}</button>
        </div>
        {servicesLoading ? <Spinner /> : services.length === 0 ? <p className="text-center text-gray-500 py-6">Nenhum servico cadastrado</p> : (
          <div className="space-y-3">
            {services.map(s => (
              <div key={s.id} className={`flex items-center gap-4 rounded-xl border bg-dark-800 p-4 ${s.active ? "border-gray-700" : "border-gray-800 opacity-60"}`}>
                <span className="text-2xl">{CATEGORY_ICONS[s.category] || "✂️"}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{s.name}</p>
                  <p className="text-sm text-gray-400">R$ {s.price.toFixed(2)} · {s.duration}min · {CATEGORY_LABELS[s.category] || s.category}</p>
                </div>
                <button onClick={() => toggleService(s.id, !s.active)} className={`w-12 h-6 rounded-full transition-colors shrink-0 ${s.active ? "bg-brand-500" : "bg-gray-700"}`}><div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${s.active ? "translate-x-6" : "translate-x-0.5"}`} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    // ─── CLIENTES ───
    if (subView === "clientes") {
      const filtered = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch));
      return (
        <div className="space-y-4">{backBtn}
          <input type="text" placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full rounded-xl bg-dark-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors" />
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl bg-dark-800 border border-gray-700 p-3 text-center"><p className="text-lg font-bold text-white">{clients.length}</p><p className="text-xs text-gray-500">Total</p></div>
            <div className="flex-1 rounded-xl bg-dark-800 border border-gray-700 p-3 text-center"><p className="text-lg font-bold text-red-400">{clients.filter(c => c.noShowCount > 0).length}</p><p className="text-xs text-gray-500">Com faltas</p></div>
          </div>
          {clientsLoading ? <Spinner /> : filtered.length === 0 ? <p className="text-center text-gray-500 py-6">Nenhum cliente encontrado</p> : (
            <div className="space-y-3">
              {filtered.map(c => (
                <div key={c.id} className="rounded-xl border border-gray-700 bg-dark-800 p-4">
                  <div className="flex items-center justify-between">
                    <div><p className="font-semibold text-white">{c.name}</p><p className="text-sm text-gray-400">{c.phone}</p></div>
                    <div className="text-center"><p className="text-lg font-bold text-brand-400">{c.totalAppointments}</p><p className="text-xs text-gray-500">visitas</p></div>
                  </div>
                  {c.noShowCount > 0 && <p className="text-xs text-red-400 mt-2">⚠️ {c.noShowCount} falta(s)</p>}
                  {c.notes && <p className="text-xs text-gray-500 mt-2 italic">📝 {c.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

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
              <div className="flex items-center justify-between"><div><p className="font-semibold text-white">{item.clientName}</p><p className="text-xs text-gray-500">{item.clientPhone}</p></div><div className="text-center bg-brand-500/20 rounded-xl px-4 py-2"><p className="text-xl font-bold text-brand-400">{item.count}</p><p className="text-xs text-gray-400">cortes</p></div></div>
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
          <img src="/logo.png" alt="BarberPro" className="w-9 h-9 rounded-lg" />
          <div>
            <h1 className="text-lg font-bold text-brand-400 leading-tight">{user?.shopName || "Painel"}</h1>
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
          <div className="flex items-center justify-between"><h3 className="font-bold text-white text-sm">Link de Agendamento</h3><button onClick={() => setShowQR(false)} className="text-gray-500 hover:text-white text-lg">✕</button></div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-brand-400 truncate">{bookingLink}</div>
            <button onClick={() => { navigator.clipboard.writeText(bookingLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); }} className="rounded-lg bg-brand-500 text-dark-900 font-bold px-4 py-2 text-sm hover:bg-brand-400 transition whitespace-nowrap">{linkCopied ? "✓ Copiado!" : "Copiar"}</button>
          </div>
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
                        <span className="text-lg font-bold leading-none">{day}</span>
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
                                <span className="text-brand-400 font-bold">{appt.startTime} - {appt.endTime}</span>
                                <span className="text-brand-400 font-bold">R$ {appt.totalPrice?.toFixed(2)}</span>
                              </div>
                              <p className="font-semibold text-white mt-1">{appt.client?.name}</p>
                              <p className="text-sm text-gray-400">{appt.services.map(s => s.name).join(", ")}{appt.barberName ? ` · ${appt.barberName}` : ""}</p>
                              <p className="text-xs text-gray-500">{appt.client?.phone}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[appt.status] || STATUS_COLORS.pending}`}>{STATUS_LABELS[appt.status] || appt.status}</span>
                          </div>

                          {/* Pending Pix */}
                          {isPendingPix && (
                            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 space-y-2">
                              <p className="text-sm text-orange-400">⏳ Aguardando confirmacao do Pix</p>
                              <button onClick={() => confirmPixPayment(appt.id)} className="w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-dark-900 hover:bg-orange-400 transition">✓ Confirmar Pix</button>
                            </div>
                          )}

                          {/* Action buttons: Cancel + No Show */}
                          {appt.status === "confirmed" && !isPayingThis && (
                            <div className="flex gap-2">
                              <button onClick={() => cancelAppointment(appt.id)} className="flex-1 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-400 font-medium hover:bg-red-500/20 transition">Cancelar</button>
                              {isAppointmentPast(appt.date, appt.startTime) && (
                                <button onClick={() => markNoShow(appt.id, appt.client?.name)} className="flex-1 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-sm text-yellow-400 font-medium hover:bg-yellow-500/20 transition">Nao veio</button>
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
                                      <p className="text-xs text-gray-400 font-medium">Servicos realizados:</p>
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
                              <textarea rows={2} placeholder="Observacoes sobre o cliente..." value={clientNotes[appt.client.id] ?? (appt.client.notes || "")} onChange={e => setClientNotes(prev => ({...prev, [appt.client.id]: e.target.value}))} onBlur={() => saveClientNote(appt.client.id, clientNotes[appt.client.id] ?? (appt.client.notes || ""))} className="w-full rounded-lg bg-dark-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-400 focus:outline-none resize-none transition-colors" />
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
              <div className="space-y-5">
                <h2 className="text-lg font-bold text-white">📅 Minha Agenda</h2>
                {/* Date picker */}
                <input type="date" value={availDate} onChange={e => setAvailDate(e.target.value)} className="w-full rounded-xl bg-dark-800 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none transition-colors" />

                <p className="text-sm text-gray-400 capitalize">{new Date(availDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>

                {/* Block/Unblock all day */}
                {slotData && !slotsLoading && (
                  slotData.allDay || slotData.allSlots.every(t => slotData.blocked.includes(t) || slotData.booked.includes(t)) ? (
                    <button onClick={unblockAllDay} disabled={slotsSaving} className="w-full rounded-xl border border-green-500/50 bg-green-500/10 py-3 text-sm font-semibold text-green-400 hover:bg-green-500/20 transition disabled:opacity-50">✓ Liberar dia todo</button>
                  ) : (
                    <button onClick={blockAllDay} disabled={slotsSaving} className="w-full rounded-xl border border-red-500/50 bg-red-500/10 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition disabled:opacity-50">✕ Bloquear dia todo</button>
                  )
                )}

                {/* Slots grid */}
                {slotsLoading ? <Spinner /> : !slotData ? null : slotData.allSlots.length === 0 ? <p className="text-center text-gray-500 py-6">Nenhum horario neste dia</p> : (
                  <>
                    <div className="grid grid-cols-4 gap-2">
                      {slotData.allSlots.map(time => {
                        const isBooked = slotData.booked.includes(time);
                        const isBlocked = slotData.allDay || slotData.blocked.includes(time);
                        return (
                          <button key={time} onClick={() => toggleSlot(time)} disabled={isBooked || slotsSaving} className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${isBooked ? "border-brand-500/50 bg-brand-500/15 text-brand-400 cursor-not-allowed" : isBlocked ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-green-500/50 bg-green-500/15 text-green-400"}`}>
                            {time} {isBooked ? "📌" : isBlocked ? "🔒" : ""}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-center gap-6 text-xs text-gray-500">
                      <span><span className="inline-block w-3 h-3 rounded bg-green-500/30 border border-green-500 mr-1" /> Livre</span>
                      <span><span className="inline-block w-3 h-3 rounded bg-red-500/20 border border-red-500 mr-1" /> Bloqueado</span>
                      <span><span className="inline-block w-3 h-3 rounded bg-brand-500/20 border border-brand-500 mr-1" /> Agendado</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ═══════ FINANCEIRO TAB ═══════ */}
            {activeTab === "financeiro" && (
              <div className="space-y-5">
                {dashLoading ? <Spinner /> : !dashboard ? <p className="text-center text-gray-500 py-10">Nao foi possivel carregar</p> : (
                  <>
                    <div className="rounded-2xl bg-brand-500/10 border border-brand-400/30 p-5">
                      <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
                      <p className="text-4xl font-bold text-brand-400">R$ {dashboard.month.revenue.toFixed(2)}</p>
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
                      <StatBox value={`R$ ${dashboard.month.avgTicket.toFixed(2)}`} label="Ticket medio" />
                      <StatBox value={`${dashboard.month.cancelRate}%`} label="Cancelamentos" color={dashboard.month.cancelRate > 20 ? "text-red-400" : dashboard.month.cancelRate > 10 ? "text-yellow-400" : "text-green-400"} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <StatBox value={`${dashboard.totalClients}`} label="Clientes" />
                      <StatBox value={dashboard.avgRating ? `${dashboard.avgRating} ★` : "—"} label="Avaliacao" color="text-yellow-400" />
                      {dashboard.peakHour && <StatBox value={`⚡ ${dashboard.peakHour}`} label="Pico" color="text-brand-400" />}
                    </div>
                    {dashboard.barberStats?.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Ranking</p>
                        {dashboard.barberStats.map((b, i) => (
                          <div key={i} className="rounded-xl bg-dark-800 border border-gray-700 p-4 space-y-2">
                            <div className="flex items-center gap-3"><span className="text-brand-400 font-bold w-6">#{i+1}</span><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">{b.name}</p><p className="text-xs text-gray-400">{b.count} atend.</p></div><p className="text-sm font-bold text-brand-400">R$ {b.revenue.toFixed(2)}</p></div>
                            <div className="h-1.5 rounded-full bg-gray-700"><div className="h-1.5 rounded-full bg-brand-500 transition-all" style={{ width: `${Math.round(b.revenueShare * 100)}%` }} /></div>
                            {b.commission > 0 && <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5"><span className="text-xs text-green-400">Comissao ({b.commission}%)</span><span className="text-xs font-bold text-green-400">R$ {b.commissionValue.toFixed(2)}</span></div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ═══════ CONFIG TAB ═══════ */}
            {activeTab === "config" && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-white">⚙️ Configuracoes</h2>

                {/* Shop settings */}
                {shopSettings && (
                  <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-4">
                    <h3 className="font-semibold text-white">Horario de Funcionamento</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-xs text-gray-400 mb-1">Abertura</p><input type="time" value={shopSettings.openTime} onChange={e => setShopSettings(p => p ? {...p, openTime: e.target.value} : p)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none" /></div>
                      <div><p className="text-xs text-gray-400 mb-1">Fechamento</p><input type="time" value={shopSettings.closeTime} onChange={e => setShopSettings(p => p ? {...p, closeTime: e.target.value} : p)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none" /></div>
                    </div>
                    <div><p className="text-xs text-gray-400 mb-2">Dias de trabalho</p>
                      <div className="flex gap-2">{WEEKDAYS.map((d, i) => (<button key={i} onClick={() => setShopSettings(p => p ? {...p, workDays: p.workDays.includes(i) ? p.workDays.filter(x => x !== i) : [...p.workDays, i].sort()} : p)} className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${shopSettings.workDays.includes(i) ? "border-brand-400 bg-brand-500/10 text-brand-400" : "border-gray-700 text-gray-400"}`}>{d}</button>))}</div>
                    </div>
                    <div><p className="text-xs text-gray-400 mb-1">Chave Pix</p><input type="text" placeholder="Sua chave pix" value={shopSettings.pixKey} onChange={e => setShopSettings(p => p ? {...p, pixKey: e.target.value} : p)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" /></div>

                    {/* Booking mode */}
                    <div><p className="text-xs text-gray-400 mb-2">Modo de Atendimento</p>
                      <div className="flex gap-2">
                        <button onClick={() => setShopSettings(p => p ? {...p, bookingMode: "steps"} : p)} className={`flex-1 rounded-xl py-3 text-sm font-semibold transition border ${shopSettings.bookingMode === "steps" ? "bg-brand-500 text-dark-900 border-brand-500" : "bg-transparent text-gray-400 border-gray-700"}`}>📋 Etapas</button>
                        <button onClick={() => setShopSettings(p => p ? {...p, bookingMode: "agent"} : p)} className={`flex-1 rounded-xl py-3 text-sm font-semibold transition border ${shopSettings.bookingMode === "agent" ? "bg-blue-600 text-white border-blue-600" : "bg-transparent text-gray-400 border-gray-700"}`}>🤖 Agente IA</button>
                      </div>
                    </div>

                    <button onClick={saveShopSettings} disabled={savingSettings} className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">{savingSettings ? "Salvando..." : "Salvar Configuracoes"}</button>
                  </div>
                )}

                {/* Change password */}
                <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-3">
                  <h3 className="font-semibold text-white">🔒 Alterar Senha</h3>
                  <input type="password" placeholder="Senha atual" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
                  <input type="password" placeholder="Nova senha (min 6)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none" />
                  <button onClick={handleChangePassword} disabled={changingPassword} className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">{changingPassword ? "Alterando..." : "Alterar Senha"}</button>
                </div>

                {/* Logout */}
                <button onClick={handleLogout} className="w-full rounded-xl border border-red-500/30 py-3 text-sm text-red-400 hover:bg-red-500/10 transition">Sair da Conta</button>

                {/* Version */}
                <p className="text-center text-xs text-gray-600 pb-4">BarberPro v2.0</p>
              </div>
            )}
          </>
        )}
      </div>

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
function Spinner() {
  return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" /></div>;
}

function StatBox({ value, label, color, extra, extraColor }: { value: string; label: string; color?: string; extra?: string; extraColor?: string }) {
  return (
    <div className="rounded-xl bg-dark-800 border border-gray-700 p-3 text-center">
      <p className={`text-lg font-bold ${color || "text-white"}`}>{value}</p>
      {extra && <p className={`text-xs font-semibold ${extraColor || ""}`}>{extra}</p>}
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
