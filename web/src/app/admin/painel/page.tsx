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

interface AppointmentService {
  serviceId: string;
  name: string;
  price: number;
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  date: string;
  status: string;
  paidAt: string | null;
  paymentMethod: string | null;
  totalPrice: number;
  barberName: string;
  client: { id: string; name: string; phone: string; noShowCount: number; notes: string | null };
  services: AppointmentService[];
}

interface Barber {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  commission?: number;
}

interface DashboardData {
  today: { appointments: number; received: number; expected: number };
  month: {
    appointments: number; revenue: number; toReceive: number;
    avgTicket: number; cancelRate: number;
    revenueGrowth: number | null; aptGrowth: number | null;
    prevRevenue: number; prevApts: number;
  };
  avgRating: number | null;
  barberStats: { name: string; count: number; revenue: number; commission: number; commissionValue: number; revenueShare: number }[];
  peakHour: string | null;
  totalClients: number;
  barbers: number;
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  completed: "Concluido",
  pending: "Pendente",
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  cancelled: "bg-red-500/20 text-red-400 border border-red-500/30",
  completed: "bg-green-500/20 text-green-400 border border-green-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartao",
};

export default function PainelPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ name?: string; shopName?: string; shopSlug?: string; role?: string } | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<"agenda" | "barbeiros" | "financeiro" | "fidelidade" | "espera">("agenda");

  // Notas CRM (clientId → nota editada localmente)
  const [clientNotes, setClientNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);

  // Lista de espera
  const [waitlist, setWaitlist] = useState<{ id: string; clientName: string; clientPhone: string; serviceIds: string[]; preferredDate: string | null; createdAt: string; barber: { name: string } | null }[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [removingWaitId, setRemovingWaitId] = useState<string | null>(null);

  // Agenda
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "dinheiro" | "cartao">("pix");
  const [confirmingPayId, setConfirmingPayId] = useState<string | null>(null);
  const [removedServiceIds, setRemovedServiceIds] = useState<string[]>([]);
  const [customPrice, setCustomPrice] = useState<string>("");

  // Barbeiros
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barbersLoading, setBarbersLoading] = useState(false);
  const [newBarberName, setNewBarberName] = useState("");
  const [newBarberPhone, setNewBarberPhone] = useState("");
  const [newBarberPassword, setNewBarberPassword] = useState("");
  const [newBarberCommission, setNewBarberCommission] = useState("");
  const [addingBarber, setAddingBarber] = useState(false);

  // Financeiro
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(false);

  // Fidelidade
  const [loyalties, setLoyalties] = useState<{ clientName: string; clientPhone: string; count: number; progress: number; rewardsEarned: number }[]>([]);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);

  // Modo de agendamento
  const [bookingMode, setBookingMode] = useState<"steps" | "agent">("steps");
  const [bookingModeLoading, setBookingModeLoading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("admin_token");
    const u = localStorage.getItem("admin_user");
    if (!t) {
      router.replace("/admin");
      return;
    }
    setToken(t);
    if (u) {
      try { setUser(JSON.parse(u)); } catch { /* ignore */ }
    }
    // Aplica o tema e busca configurações da barbearia
    fetch("/api/me/shop", { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.shop?.colorTheme) applyAdminTheme(data.shop.colorTheme);
        if (data.shop?.bookingMode) setBookingMode(data.shop.bookingMode);
      })
      .catch(() => {});
  }, [router]);

  const authHeaders = useCallback(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }),
    [token]
  );

  // Fetch appointments for selected date
  const fetchAppointments = useCallback(async () => {
    if (!token) return;
    setAgendaLoading(true);
    try {
      const res = await fetch(`/api/me/appointments?date=${selectedDate}`, { headers: authHeaders() });
      const data = await res.json();
      setAppointments(data.appointments || []);
    } catch {
      setAppointments([]);
    } finally {
      setAgendaLoading(false);
    }
  }, [token, selectedDate, authHeaders]);

  const fetchBarbers = useCallback(async () => {
    if (!token) return;
    setBarbersLoading(true);
    try {
      const res = await fetch("/api/auth/add-barber", { headers: authHeaders() });
      const data = await res.json();
      setBarbers(data.barbers || []);
    } catch {
      setBarbers([]);
    } finally {
      setBarbersLoading(false);
    }
  }, [token, authHeaders]);

  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    setDashLoading(true);
    try {
      const res = await fetch("/api/me/dashboard", { headers: authHeaders() });
      const data = await res.json();
      setDashboard(data);
    } catch {
      setDashboard(null);
    } finally {
      setDashLoading(false);
    }
  }, [token, authHeaders]);

  const fetchLoyalty = useCallback(async () => {
    if (!token) return;
    setLoyaltyLoading(true);
    try {
      const res = await fetch("/api/me/loyalty", { headers: authHeaders() });
      const data = await res.json();
      setLoyalties(data.loyalties || []);
    } catch {
      setLoyalties([]);
    } finally {
      setLoyaltyLoading(false);
    }
  }, [token, authHeaders]);

  const fetchWaitlist = useCallback(async () => {
    if (!token) return;
    setWaitlistLoading(true);
    try {
      const res = await fetch("/api/me/waitlist", { headers: authHeaders() });
      const data = await res.json();
      setWaitlist(data.waitlist || []);
    } catch {
      setWaitlist([]);
    } finally {
      setWaitlistLoading(false);
    }
  }, [token, authHeaders]);

  const saveClientNote = async (clientId: string, note: string) => {
    if (!token) return;
    setSavingNote(clientId);
    try {
      await fetch(`/api/me/clients/${clientId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ notes: note || null }),
      });
    } catch { /* ignore */ }
    setSavingNote(null);
  };

  const removeFromWaitlist = async (id: string) => {
    if (!token) return;
    setRemovingWaitId(id);
    try {
      await fetch(`/api/me/waitlist/${id}`, { method: "DELETE", headers: authHeaders() });
      setWaitlist((prev) => prev.filter((e) => e.id !== id));
    } catch { /* ignore */ }
    setRemovingWaitId(null);
  };

  useEffect(() => {
    if (!token) return;
    if (activeTab === "agenda") fetchAppointments();
    if (activeTab === "barbeiros") fetchBarbers();
    if (activeTab === "financeiro") fetchDashboard();
    if (activeTab === "fidelidade") fetchLoyalty();
    if (activeTab === "espera") fetchWaitlist();
  }, [token, activeTab, fetchAppointments, fetchBarbers, fetchDashboard, fetchLoyalty]);

  useEffect(() => {
    if (token && activeTab === "agenda") fetchAppointments();
  }, [selectedDate, token, activeTab, fetchAppointments]);

  const handleConfirmPayment = async (appointmentId: string) => {
    if (!token) return;
    setConfirmingPayId(appointmentId);
    try {
      const body: Record<string, unknown> = { appointmentId, paymentMethod };
      if (removedServiceIds.length > 0) body.removedServiceIds = removedServiceIds;
      if (customPrice !== "") body.customPrice = parseFloat(customPrice);
      const res = await fetch("/api/me/finance", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setPayingId(null);
        setRemovedServiceIds([]);
        setCustomPrice("");
        fetchAppointments();
      } else {
        alert("Erro ao confirmar pagamento");
      }
    } catch {
      alert("Erro ao confirmar pagamento");
    } finally {
      setConfirmingPayId(null);
    }
  };

  const handleToggleBarber = async (barberId: string, active: boolean) => {
    if (!token) return;
    try {
      await fetch("/api/auth/add-barber", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ barberId, active }),
      });
      fetchBarbers();
    } catch {
      alert("Erro ao atualizar barbeiro");
    }
  };

  const handleAddBarber = async () => {
    if (!newBarberName.trim() || !newBarberPhone.trim() || newBarberPassword.length < 6) {
      alert("Preencha todos os campos (senha min 6 caracteres)");
      return;
    }
    setAddingBarber(true);
    try {
      const res = await fetch("/api/auth/add-barber", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: newBarberName,
          phone: newBarberPhone.replace(/\D/g, ""),
          password: newBarberPassword,
          commission: newBarberCommission ? parseFloat(newBarberCommission) : 0,
        }),
      });
      if (res.ok) {
        setNewBarberName("");
        setNewBarberPhone("");
        setNewBarberPassword("");
        setNewBarberCommission("");
        fetchBarbers();
      } else {
        const d = await res.json();
        alert(d.error || "Erro ao adicionar barbeiro");
      }
    } catch {
      alert("Erro ao adicionar barbeiro");
    } finally {
      setAddingBarber(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    router.push("/admin");
  };

  const getDateStrip = () => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return {
      weekday: d.toLocaleDateString("pt-BR", { weekday: "short" }),
      day: d.toLocaleDateString("pt-BR", { day: "2-digit" }),
      month: d.toLocaleDateString("pt-BR", { month: "short" }),
    };
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-dark-900 pb-10">
      {/* Header */}
      <header className="bg-dark-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="BarberPro" className="w-10 h-10 rounded-lg" />
          <div>
            <h1 className="text-xl font-bold text-brand-400">{user?.shopName || "Painel"}</h1>
            <p className="text-xs text-gray-400">Ola, {user?.name || "proprietario"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user?.shopSlug && (
            <button
              onClick={() => setShowQR((v) => !v)}
              className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-sm text-brand-400 hover:bg-brand-500/20 transition-colors"
            >
              📎 Link &amp; QR
            </button>
          )}
          <button
            onClick={handleLogout}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Card de Compartilhamento: Link + QR Code */}
      {showQR && user?.shopSlug && (
        <div className="mx-6 mt-4 rounded-2xl border border-brand-500/25 bg-dark-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">Link de Agendamento</h3>
            <button onClick={() => setShowQR(false)} className="text-gray-500 hover:text-white text-lg">✕</button>
          </div>

          {/* Link + botão copiar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-brand-400 truncate">
              {typeof window !== "undefined" ? `${window.location.origin}/${user.shopSlug}` : `/${user.shopSlug}`}
            </div>
            <button
              onClick={() => {
                const url = `${window.location.origin}/${user.shopSlug}`;
                navigator.clipboard.writeText(url);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2500);
              }}
              className="rounded-lg bg-brand-500 text-dark-900 font-bold px-4 py-2 text-sm hover:bg-brand-400 transition whitespace-nowrap"
            >
              {linkCopied ? "✓ Copiado!" : "Copiar"}
            </button>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-3">
            <div ref={qrRef} className="bg-white rounded-xl p-4">
              <QRCodeCanvas
                value={typeof window !== "undefined" ? `${window.location.origin}/${user.shopSlug}` : `https://barberpro-black.vercel.app/${user.shopSlug}`}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>
            <p className="text-xs text-gray-500 text-center">
              Imprima e cole no espelho, balcão ou cartão de visita
            </p>
            <button
              onClick={() => {
                const canvas = qrRef.current?.querySelector("canvas");
                if (!canvas) return;
                const link = document.createElement("a");
                link.download = `qrcode-${user.shopSlug}.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
              }}
              className="border border-gray-700 text-gray-300 rounded-lg px-4 py-2 text-sm hover:text-white hover:border-gray-500 transition"
            >
              ⬇️ Baixar QR Code (PNG)
            </button>
          </div>

          {/* Toggle Modo de Atendimento */}
          {user?.role === "owner" && (
            <div className="border-t border-gray-700 pt-4">
              <h4 className="text-sm font-semibold text-white mb-3">Modo de Atendimento</h4>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setBookingModeLoading(true);
                    try {
                      await fetch("/api/me/shop", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ bookingMode: "steps" }),
                      });
                      setBookingMode("steps");
                    } catch { /* ignore */ }
                    setBookingModeLoading(false);
                  }}
                  disabled={bookingModeLoading}
                  className={`flex-1 rounded-xl py-3 text-sm font-semibold transition border ${
                    bookingMode === "steps"
                      ? "bg-brand-500 text-dark-900 border-brand-500"
                      : "bg-transparent text-gray-400 border-gray-700 hover:text-white hover:border-gray-500"
                  }`}
                >
                  📋 Etapas (Clássico)
                </button>
                <button
                  onClick={async () => {
                    setBookingModeLoading(true);
                    try {
                      await fetch("/api/me/shop", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ bookingMode: "agent" }),
                      });
                      setBookingMode("agent");
                    } catch { /* ignore */ }
                    setBookingModeLoading(false);
                  }}
                  disabled={bookingModeLoading}
                  className={`flex-1 rounded-xl py-3 text-sm font-semibold transition border ${
                    bookingMode === "agent"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-transparent text-gray-400 border-gray-700 hover:text-white hover:border-gray-500"
                  }`}
                >
                  🤖 Agente IA (Chat)
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {bookingMode === "steps"
                  ? "O cliente escolhe serviço, barbeiro, data e horário passo a passo."
                  : "O cliente conversa com um assistente virtual que guia o agendamento."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-700 bg-dark-800">
        {(["agenda", "barbeiros", "financeiro", "fidelidade", "espera"] as const).map((tab) => {
          const labels = { agenda: "Agenda", barbeiros: "Barbeiros", financeiro: "Financeiro", fidelidade: "Fidelidade", espera: "Lista" };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-brand-400 text-brand-400"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">

        {/* ===== AGENDA TAB ===== */}
        {activeTab === "agenda" && (
          <div className="space-y-5">
            {/* Date strip */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {getDateStrip().map((date) => {
                const { weekday, day, month } = formatDateLabel(date);
                const isSelected = selectedDate === date;
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`flex-shrink-0 flex flex-col items-center rounded-xl border px-3 py-2 text-center min-w-[58px] transition-all ${
                      isSelected
                        ? "border-brand-400 bg-brand-500/10 text-brand-400"
                        : "border-gray-700 bg-dark-800 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <span className="text-xs capitalize">{weekday}</span>
                    <span className="text-lg font-bold leading-none">{day}</span>
                    <span className="text-xs capitalize">{month}</span>
                  </button>
                );
              })}
            </div>

            {agendaLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" />
              </div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-4xl mb-3">📅</p>
                <p>Nenhum agendamento neste dia</p>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((appt) => {
                  const isPaid = !!appt.paidAt;
                  const isCancelled = appt.status === "cancelled";
                  const isPayingThis = payingId === appt.id;

                  return (
                    <div
                      key={appt.id}
                      className={`rounded-xl border bg-dark-800 p-4 space-y-3 transition-all ${
                        isCancelled ? "opacity-50 border-gray-800" : "border-gray-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{appt.client?.name}</p>
                          <p className="text-sm text-gray-400">
                            {appt.startTime} – {appt.endTime} &nbsp;|&nbsp; {appt.barberName}
                          </p>
                          <p className="text-sm text-gray-300 mt-1">
                            {appt.services.map((s) => s.name).join(", ")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[appt.status] || STATUS_COLORS.pending}`}>
                            {STATUS_LABELS[appt.status] || appt.status}
                          </span>
                          <span className="text-brand-400 font-bold">R$ {appt.totalPrice?.toFixed(2) ?? "0.00"}</span>
                        </div>
                      </div>

                      {/* Payment area */}
                      {!isCancelled && (
                        <div>
                          {isPaid ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                                Pago {appt.paymentMethod ? `(${PAYMENT_LABELS[appt.paymentMethod] || appt.paymentMethod})` : ""}
                              </span>
                            </div>
                          ) : isPayingThis ? (
                            <div className="space-y-3 pt-1">
                              {/* Services checklist */}
                              {appt.services.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-xs text-gray-400 font-medium">Servicos realizados:</p>
                                  {appt.services.map((svc) => {
                                    const removed = removedServiceIds.includes(svc.serviceId);
                                    return (
                                      <label
                                        key={svc.serviceId}
                                        className="flex items-center gap-3 cursor-pointer group"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={!removed}
                                          onChange={() => {
                                            setRemovedServiceIds((prev) =>
                                              removed
                                                ? prev.filter((id) => id !== svc.serviceId)
                                                : [...prev, svc.serviceId]
                                            );
                                            setCustomPrice("");
                                          }}
                                          className="w-4 h-4 accent-yellow-400"
                                        />
                                        <span className={`flex-1 text-sm ${removed ? "line-through text-gray-600" : "text-white"}`}>
                                          {svc.name}
                                        </span>
                                        <span className={`text-sm font-medium ${removed ? "text-gray-600" : "text-brand-400"}`}>
                                          R$ {svc.price.toFixed(2)}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Editable price */}
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-gray-400 shrink-0">Valor final (R$):</p>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    customPrice !== ""
                                      ? customPrice
                                      : appt.services
                                          .filter((s) => !removedServiceIds.includes(s.serviceId))
                                          .reduce((sum, s) => sum + s.price, 0)
                                          .toFixed(2)
                                  }
                                  onChange={(e) => setCustomPrice(e.target.value)}
                                  className="flex-1 rounded-lg bg-dark-900 border border-gray-700 px-3 py-1.5 text-sm text-white focus:border-brand-400 focus:outline-none text-right"
                                />
                              </div>

                              <p className="text-xs text-gray-400">Forma de pagamento:</p>
                              <div className="flex gap-2">
                                {(["pix", "dinheiro", "cartao"] as const).map((method) => (
                                  <button
                                    key={method}
                                    onClick={() => setPaymentMethod(method)}
                                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                                      paymentMethod === method
                                        ? "border-brand-400 bg-brand-500/10 text-brand-400"
                                        : "border-gray-700 text-gray-400 hover:border-gray-600"
                                    }`}
                                  >
                                    {PAYMENT_LABELS[method]}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setPayingId(null); setRemovedServiceIds([]); setCustomPrice(""); }}
                                  className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button
                                  disabled={confirmingPayId === appt.id}
                                  onClick={() => handleConfirmPayment(appt.id)}
                                  className="flex-1 rounded-lg bg-brand-500 py-2 text-sm font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all"
                                >
                                  {confirmingPayId === appt.id ? "Confirmando..." : "Confirmar"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            appt.status === "confirmed" && (
                              <button
                                onClick={() => { setPayingId(appt.id); setPaymentMethod("pix"); setRemovedServiceIds([]); setCustomPrice(""); }}
                                className="w-full rounded-lg border border-brand-400/50 py-2 text-sm text-brand-400 hover:bg-brand-500/10 transition-colors"
                              >
                                Confirmar Pagamento
                              </button>
                            )
                          )}
                        </div>
                      )}
                      {/* Notas CRM */}
                      {!isCancelled && (
                        <div className="pt-1 border-t border-gray-800">
                          <p className="text-xs text-gray-500 mb-1">📝 Notas do cliente</p>
                          <textarea
                            rows={2}
                            placeholder="Observações sobre o cliente (tipo de cabelo, preferências...)"
                            value={clientNotes[appt.client.id] ?? (appt.client.notes || "")}
                            onChange={(e) => setClientNotes((prev) => ({ ...prev, [appt.client.id]: e.target.value }))}
                            onBlur={() => saveClientNote(appt.client.id, clientNotes[appt.client.id] ?? (appt.client.notes || ""))}
                            className="w-full rounded-lg bg-dark-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-400 focus:outline-none resize-none transition-colors"
                          />
                          {savingNote === appt.client.id && (
                            <p className="text-xs text-gray-500 mt-1">Salvando...</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== BARBEIROS TAB ===== */}
        {activeTab === "barbeiros" && (
          <div className="space-y-6">
            {/* Add barber form */}
            <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-3">
              <h3 className="font-semibold text-white">Adicionar Barbeiro</h3>
              <input
                type="text"
                placeholder="Nome *"
                value={newBarberName}
                onChange={(e) => setNewBarberName(e.target.value)}
                className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-colors"
              />
              <input
                type="tel"
                placeholder="Telefone (com DDD) *"
                value={newBarberPhone}
                onChange={(e) => setNewBarberPhone(e.target.value)}
                className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-colors"
              />
              <input
                type="password"
                placeholder="Senha (min 6 caracteres) *"
                value={newBarberPassword}
                onChange={(e) => setNewBarberPassword(e.target.value)}
                className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-colors"
              />
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Comissão sobre serviços (ex: 10)"
                  value={newBarberCommission}
                  onChange={(e) => setNewBarberCommission(e.target.value)}
                  className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 pr-10 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-colors"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">%</span>
              </div>
              <p className="text-xs text-gray-500 -mt-1">Percentual que o barbeiro recebe sobre o valor dos serviços (não inclui produtos da comanda)</p>
              <button
                onClick={handleAddBarber}
                disabled={addingBarber}
                className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all press-scale"
              >
                {addingBarber ? "Adicionando..." : "Adicionar Barbeiro"}
              </button>
            </div>

            {/* Barbers list */}
            {barbersLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" />
              </div>
            ) : barbers.length === 0 ? (
              <p className="text-center text-gray-500 py-6">Nenhum barbeiro cadastrado</p>
            ) : (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-300">Barbeiros cadastrados</h3>
                {barbers.map((barber) => (
                  <div
                    key={barber.id}
                    className={`flex items-center gap-4 rounded-xl border bg-dark-800 p-4 transition-all ${
                      barber.active ? "border-gray-700" : "border-gray-800 opacity-60"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-lg shrink-0">
                      {barber.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white">{barber.name}</p>
                      <p className="text-sm text-gray-400">
                        {barber.phone}
                        {(barber.commission ?? 0) > 0 && (
                          <span className="ml-2 text-brand-400">· {barber.commission}% comissão</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleBarber(barber.id, !barber.active)}
                      className={`w-12 h-6 rounded-full transition-colors shrink-0 ${barber.active ? "bg-brand-500" : "bg-gray-700"}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${barber.active ? "translate-x-6" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== FINANCEIRO TAB ===== */}
        {activeTab === "financeiro" && (
          <div className="space-y-5">
            {dashLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" />
              </div>
            ) : !dashboard ? (
              <p className="text-center text-gray-500 py-10">Não foi possível carregar os dados</p>
            ) : (
              <>
                {/* HERO — Receita do Mês */}
                <div className="rounded-2xl bg-brand-500/10 border border-brand-400/30 p-5">
                  <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
                    {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  </p>
                  <p className="text-4xl font-bold text-brand-400">R$ {(dashboard.month.revenue).toFixed(2)}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {dashboard.month.revenueGrowth !== null && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dashboard.month.revenueGrowth >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {dashboard.month.revenueGrowth >= 0 ? "▲" : "▼"} {Math.abs(dashboard.month.revenueGrowth)}% vs mês anterior
                      </span>
                    )}
                    {dashboard.month.toReceive > 0 && (
                      <span className="text-xs text-brand-400/80">+ R$ {dashboard.month.toReceive.toFixed(2)} a receber</span>
                    )}
                  </div>
                </div>

                {/* Hoje */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Hoje</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-dark-800 border border-gray-700 p-3 text-center">
                      <p className="text-lg font-bold text-green-400">R$ {(dashboard.today.received).toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-1">Recebido</p>
                    </div>
                    <div className="rounded-xl bg-dark-800 border border-gray-700 p-3 text-center">
                      <p className="text-lg font-bold text-white">{dashboard.today.appointments}</p>
                      <p className="text-xs text-gray-500 mt-1">Agendamentos</p>
                    </div>
                    <div className="rounded-xl bg-dark-800 border border-gray-700 p-3 text-center">
                      <p className="text-lg font-bold text-brand-400">R$ {(dashboard.today.expected).toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-1">A receber</p>
                    </div>
                  </div>
                </div>

                {/* Métricas do mês */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-dark-800 border border-gray-700 p-3 text-center">
                    <p className="text-lg font-bold text-white">{dashboard.month.appointments}</p>
                    {dashboard.month.aptGrowth !== null && (
                      <p className={`text-xs font-semibold ${dashboard.month.aptGrowth >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {dashboard.month.aptGrowth >= 0 ? "+" : ""}{dashboard.month.aptGrowth}%
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Atendimentos</p>
                  </div>
                  <div className="rounded-xl bg-dark-800 border border-gray-700 p-3 text-center">
                    <p className="text-lg font-bold text-white">R$ {(dashboard.month.avgTicket).toFixed(2)}</p>
                    <p className="text-xs text-gray-500 mt-1">Ticket médio</p>
                  </div>
                  <div className="rounded-xl bg-dark-800 border border-gray-700 p-3 text-center">
                    <p className={`text-lg font-bold ${dashboard.month.cancelRate > 20 ? "text-red-400" : dashboard.month.cancelRate > 10 ? "text-yellow-400" : "text-green-400"}`}>
                      {dashboard.month.cancelRate}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Cancelamentos</p>
                  </div>
                </div>

                {/* Métricas gerais */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-dark-800 border border-gray-700 p-3 text-center">
                    <p className="text-lg font-bold text-white">{dashboard.totalClients}</p>
                    <p className="text-xs text-gray-500 mt-1">Clientes únicos</p>
                  </div>
                  <div className="rounded-xl bg-dark-800 border border-gray-700 p-3 text-center">
                    <p className="text-lg font-bold text-yellow-400">{dashboard.avgRating ? `${dashboard.avgRating} ★` : "—"}</p>
                    <p className="text-xs text-gray-500 mt-1">Avaliação</p>
                  </div>
                  {dashboard.peakHour && (
                    <div className="rounded-xl bg-dark-800 border border-gray-700 p-3 text-center">
                      <p className="text-lg font-bold text-brand-400">⚡ {dashboard.peakHour}</p>
                      <p className="text-xs text-gray-500 mt-1">Pico do mês</p>
                    </div>
                  )}
                </div>

                {/* Ranking de barbeiros */}
                {dashboard.barberStats && dashboard.barberStats.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Ranking do mês</p>
                    {dashboard.barberStats.map((b, i) => (
                      <div key={i} className="rounded-xl bg-dark-800 border border-gray-700 p-4 space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-brand-400 font-bold w-6">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{b.name}</p>
                            <p className="text-xs text-gray-400">{b.count} atendimentos</p>
                          </div>
                          <p className="text-sm font-bold text-brand-400">R$ {b.revenue.toFixed(2)}</p>
                        </div>
                        {/* Barra de progresso */}
                        <div className="h-1.5 rounded-full bg-gray-700">
                          <div className="h-1.5 rounded-full bg-brand-500 transition-all" style={{ width: `${Math.round(b.revenueShare * 100)}%` }} />
                        </div>
                        {b.commission > 0 && (
                          <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5">
                            <span className="text-xs text-green-400">Comissão ({b.commission}%)</span>
                            <span className="text-xs font-bold text-green-400">R$ {b.commissionValue.toFixed(2)} a pagar</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {dashboard.barberStats.some(b => b.commission > 0) && (
                      <div className="flex items-center justify-between border border-green-500/20 bg-green-500/5 rounded-xl px-4 py-3">
                        <span className="text-sm text-gray-400">Total comissões a pagar</span>
                        <span className="text-base font-bold text-green-400">
                          R$ {dashboard.barberStats.reduce((s, b) => s + b.commissionValue, 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ===== FIDELIDADE TAB ===== */}
        {activeTab === "fidelidade" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-brand-500/10 border border-brand-400/30 p-4">
              <p className="text-sm font-semibold text-brand-400 mb-1">Como funciona</p>
              <p className="text-sm text-gray-400">
                A cada atendimento pago confirmado, o cliente ganha 1 ponto. Ao completar 10 pontos, ofereça uma recompensa!
              </p>
            </div>

            {loyaltyLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" />
              </div>
            ) : loyalties.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">🏆</p>
                <p className="text-gray-400">Nenhum cliente com pontos ainda.</p>
                <p className="text-sm text-gray-500 mt-1">Confirme pagamentos para acumular pontos.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {loyalties.map((item) => (
                  <div key={item.clientPhone} className="rounded-xl bg-dark-800 border border-gray-700 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white">{item.clientName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.clientPhone}</p>
                      </div>
                      <div className="text-center bg-brand-500/20 rounded-xl px-4 py-2">
                        <p className="text-xl font-bold text-brand-400">{item.count}</p>
                        <p className="text-xs text-gray-400">cortes</p>
                      </div>
                    </div>

                    {/* Barra de progresso com 10 bolinhas */}
                    <div className="flex gap-1.5">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className={`flex-1 h-2 rounded-full transition-colors ${
                            i < item.progress ? "bg-brand-500" : "bg-gray-700"
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">{item.progress}/10 para proxima recompensa</p>
                      {item.rewardsEarned > 0 && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                          🏆 {item.rewardsEarned} recompensa{item.rewardsEarned > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== LISTA DE ESPERA TAB ===== */}
        {activeTab === "espera" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-brand-500/10 border border-brand-400/30 p-4">
              <p className="text-sm text-brand-400">
                🔔 Clientes que pediram para ser avisados quando abrir um horário. Ao cancelar um agendamento, eles recebem WhatsApp automaticamente.
              </p>
            </div>
            {waitlistLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" />
              </div>
            ) : waitlist.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-4xl mb-3">🕐</p>
                <p>Nenhum cliente na lista de espera</p>
              </div>
            ) : (
              <div className="space-y-3">
                {waitlist.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-gray-700 bg-dark-800 p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{entry.clientName}</p>
                      <p className="text-sm text-gray-400">{entry.clientPhone}</p>
                      {entry.preferredDate && (
                        <p className="text-xs text-brand-400 mt-1">
                          📅 Prefere: {new Date(entry.preferredDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                        </p>
                      )}
                      {entry.barber && (
                        <p className="text-xs text-gray-500">Com: {entry.barber.name}</p>
                      )}
                      <p className="text-xs text-gray-600 mt-1">
                        Entrou em {new Date(entry.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromWaitlist(entry.id)}
                      disabled={removingWaitId === entry.id}
                      className="shrink-0 text-xs text-red-400 border border-red-500/30 rounded-lg px-3 py-1.5 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {removingWaitId === entry.id ? "..." : "Remover"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
