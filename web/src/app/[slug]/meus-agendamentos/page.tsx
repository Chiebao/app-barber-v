"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPaletteById, paletteToVars } from "@/app/lib/palettes";
import { toast } from "@/app/lib/toast";
import { useConfirmacao } from "@/app/lib/modal";

function applyWebTheme(themeId: string) {
  const p = getPaletteById(themeId);
  const vars = paletteToVars(p);
  const style = vars.split(";").map((v) => v.trim()).filter(Boolean);
  const root = document.documentElement;
  style.forEach((declaration) => {
    const [prop, val] = declaration.split(":").map((s) => s.trim());
    if (prop && val) root.style.setProperty(prop, val);
  });
}

interface ServiceItem {
  serviceId: string;
  name: string;
  price: number;
}

interface ShopService {
  id: string;
  name: string;
  price: number;
  duration: number;
  category: string;
  active: boolean;
}

interface AppointmentItem {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  /** Produtos lançados pelo barbeiro durante o atendimento. */
  produtos?: { name: string; quantity: number; price: number }[];
  produtosTotal?: number;
  /** Serviço + produtos: o que de fato saiu do bolso do cliente. */
  totalGeral?: number;
  status: string;
  services: ServiceItem[];
  barberName: string;
  shopName: string;
}

export default function MeusAgendamentos() {
  // O diálogo vive dentro deste componente porque a pergunta é dele; o
  // portal do Modal garante que ele apareça sobre a tela toda mesmo assim.
  const [confirmar, dialogoConfirmacao] = useConfirmacao();
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [verified, setVerified] = useState(true);
  const [searched, setSearched] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [shopId, setShopId] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopLogo, setShopLogo] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [shopServices, setShopServices] = useState<ShopService[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editServiceIds, setEditServiceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/shops/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        setShopId(data.shop?.id || "");
        setShopName(data.shop?.name || "");
        setShopLogo(data.shop?.logoUrl || "");
        setShopServices(data.shop?.services || []);
        if (data.shop?.colorTheme) applyWebTheme(data.shop.colorTheme);
      });
    // Pré-preenche telefone do localStorage
    try {
      const saved = localStorage.getItem("client_identity");
      if (saved) {
        const { phone: savedPhone, name: savedName } = JSON.parse(saved);
        if (savedPhone) setPhone(savedPhone);
        if (savedName) setName(savedName);
      }
    } catch { /* ignore */ }
  }, [slug]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const search = useCallback(async () => {
    if (!shopId || phone.replace(/\D/g, "").length < 10 || name.trim().length < 2) return;
    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const res = await fetch(`/api/appointments?phone=${cleanPhone}&shopId=${shopId}&name=${encodeURIComponent(name.trim())}`);
      const data = await res.json();
      setAppointments(data.appointments || []);
      setVerified(data.verified !== false);
      setSearched(true);
      // Guarda identidade para pré-preencher na próxima vez (só se confirmou)
      if (data.verified) {
        try { localStorage.setItem("client_identity", JSON.stringify({ name: name.trim(), phone: cleanPhone })); } catch { /* ignore */ }
      }
    } finally {
      setLoading(false);
    }
  }, [shopId, phone, name]);

  const handleCancel = async (id: string) => {
    if (!(await confirmar({
      titulo: "Cancelar este agendamento?",
      texto: "O horário volta a ficar livre para outra pessoa.",
      acao: "Sim, cancelar",
      cancelar: "Manter",
      perigo: true,
    }))) return;
    setCancelling(id);
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const res = await fetch(`/api/appointments/${id}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelledBy: "client", phone: cleanPhone }),
      });
      if (res.ok) {
        setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a)));
        toast.success("Agendamento cancelado");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Erro ao cancelar. Tente novamente.");
      }
    } finally {
      setCancelling(null);
    }
  };

  const startEdit = (apt: AppointmentItem) => {
    setEditingId(apt.id);
    setEditServiceIds(apt.services.map((s) => s.serviceId));
  };

  const toggleEditService = (id: string, category: string) => {
    setEditServiceIds((prev) => {
      if (category === "corte") {
        const corteIds = shopServices.filter((s) => s.category === "corte").map((s) => s.id);
        const withoutCorte = prev.filter((s) => !corteIds.includes(s));
        return prev.includes(id) ? withoutCorte : [...withoutCorte, id];
      }
      return prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId || editServiceIds.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/appointments/${editingId}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceIds: editServiceIds, phone: phone.replace(/\D/g, "") }),
      });
      if (res.ok) {
        const { appointment: updated } = await res.json();
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === editingId
              ? { ...a, services: updated.services, totalPrice: updated.totalPrice, endTime: updated.endTime }
              : a
          )
        );
        setEditingId(null);
        toast.success("Serviços atualizados");
      } else {
        const d = await res.json();
        toast.error(d.error || "Erro ao salvar alterações");
      }
    } finally {
      setSaving(false);
    }
  };

  const editTotal = shopServices
    .filter((s) => editServiceIds.includes(s.id))
    .reduce((sum, s) => sum + s.price, 0);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  };

  const totalGasto = appointments
    .filter((a) => a.status !== "cancelled")
    .reduce((sum, a) => sum + (a.totalGeral ?? a.totalPrice), 0);

  const generatePdf = async () => {
    setGeneratingPdf(true);
    try {
      const { pdf, Document, Page, Text, View, StyleSheet } = await import("@react-pdf/renderer");

      // ── Design Tokens do PDF ─────────────────────────────────────────────
      const BRAND     = "#E8960A";
      const BRAND_L   = "#F5B731";
      const DARK      = "#0B0B14";
      const DARK_2    = "#161625";
      const WHITE     = "#F5F5F7";
      const GRAY      = "#8B8FA3";
      const GRAY_D    = "#555870";
      const PAGE_BG   = "#FAFAF8";
      const ROW_ALT   = "#F5F3EE";
      const BORDER    = "#E8E5DC";
      const SUCCESS   = "#22c55e";
      const INFO      = "#3b82f6";
      const ERROR     = "#ef4444";

      const clientPhone = phone.replace(/\D/g, "");
      const formattedPhone = clientPhone.length === 11
        ? `(${clientPhone.slice(0,2)}) ${clientPhone.slice(2,7)}-${clientPhone.slice(7)}`
        : clientPhone;
      const confirmed = appointments.filter((a) => a.status === "confirmed").length;
      const completed = appointments.filter((a) => a.status === "completed").length;
      const cancelled = appointments.filter((a) => a.status === "cancelled").length;
      const activeCount = confirmed + completed;
      const avgPrice = activeCount > 0 ? totalGasto / activeCount : 0;
      const genDate = new Date().toLocaleDateString("pt-BR");

      const styles = StyleSheet.create({
        page: {
          fontFamily: "Helvetica",
          fontSize: 9,
          backgroundColor: PAGE_BG,
          paddingBottom: 60,
        },

        // ── Header (full-width brand bar) ──────────────────────────────────
        header: {
          backgroundColor: DARK,
          paddingVertical: 28,
          paddingHorizontal: 48,
          flexDirection: "row" as const,
          justifyContent: "space-between" as const,
          alignItems: "center" as const,
        },
        headerLeft: {},
        shopNameText: {
          fontSize: 22,
          fontWeight: "bold",
          color: WHITE,
          letterSpacing: 0.5,
        },
        brandAccent: {
          width: 40,
          height: 3,
          backgroundColor: BRAND,
          borderRadius: 2,
          marginTop: 6,
        },
        headerRight: {
          alignItems: "flex-end" as const,
        },
        headerLabel: {
          fontSize: 7,
          color: GRAY,
          fontWeight: "bold",
          letterSpacing: 1,
        },
        headerValue: {
          fontSize: 9,
          color: WHITE,
          marginTop: 2,
        },

        // ── Content area ───────────────────────────────────────────────────
        content: {
          paddingHorizontal: 48,
          paddingTop: 20,
        },

        // ── Client info card ───────────────────────────────────────────────
        clientCard: {
          backgroundColor: "#ffffff",
          borderRadius: 8,
          padding: 16,
          borderWidth: 1,
          borderColor: BORDER,
          flexDirection: "row" as const,
          justifyContent: "space-between" as const,
          marginBottom: 20,
        },
        clientBlock: {},
        clientLabel: {
          fontSize: 7,
          color: GRAY_D,
          fontWeight: "bold",
          letterSpacing: 0.8,
          marginBottom: 3,
        },
        clientValue: {
          fontSize: 10,
          color: DARK,
          fontWeight: "bold",
        },
        clientSubvalue: {
          fontSize: 9,
          color: GRAY,
          marginTop: 2,
        },

        // ── Stats row ──────────────────────────────────────────────────────
        statsRow: {
          flexDirection: "row" as const,
          gap: 12,
          marginBottom: 20,
        },
        statCard: {
          flex: 1,
          backgroundColor: "#ffffff",
          borderRadius: 8,
          padding: 14,
          borderWidth: 1,
          borderColor: BORDER,
          alignItems: "center" as const,
        },
        statValue: {
          fontSize: 18,
          fontWeight: "bold",
          color: DARK,
        },
        statLabel: {
          fontSize: 7,
          color: GRAY,
          fontWeight: "bold",
          letterSpacing: 0.5,
          marginTop: 4,
        },

        // ── Section title ──────────────────────────────────────────────────
        sectionTitle: {
          fontSize: 11,
          fontWeight: "bold",
          color: DARK,
          marginBottom: 10,
          paddingBottom: 6,
          borderBottomWidth: 2,
          borderBottomColor: BRAND,
        },

        // ── Table ──────────────────────────────────────────────────────────
        tableHeaderRow: {
          flexDirection: "row" as const,
          backgroundColor: DARK_2,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
        },
        tableRow: {
          flexDirection: "row" as const,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
          backgroundColor: "#ffffff",
        },
        tableRowAlt: {
          backgroundColor: ROW_ALT,
        },
        headerCell: {
          fontSize: 7,
          fontWeight: "bold",
          color: BRAND_L,
          letterSpacing: 0.5,
        },
        colData:     { flex: 1.8 },
        colHorario:  { flex: 1.5 },
        colServico:  { flex: 3 },
        colBarbeiro: { flex: 1.8 },
        colPreco:    { flex: 1.5, textAlign: "right" as const },
        colStatus:   { flex: 1.4, textAlign: "center" as const },
        cellText:    { fontSize: 8.5, color: DARK },
        cellGray:    { fontSize: 8.5, color: GRAY },

        // ── Summary section ────────────────────────────────────────────────
        summaryContainer: {
          flexDirection: "row" as const,
          justifyContent: "space-between" as const,
          marginTop: 20,
          gap: 12,
        },
        totalCard: {
          flex: 1,
          backgroundColor: DARK,
          borderRadius: 8,
          padding: 16,
          alignItems: "center" as const,
          justifyContent: "center" as const,
        },
        totalLabel: {
          fontSize: 8,
          color: GRAY,
          fontWeight: "bold",
          letterSpacing: 0.8,
        },
        totalValue: {
          fontSize: 22,
          fontWeight: "bold",
          color: BRAND,
          marginTop: 4,
        },
        statusCard: {
          flex: 1,
          backgroundColor: "#ffffff",
          borderRadius: 8,
          padding: 16,
          borderWidth: 1,
          borderColor: BORDER,
          justifyContent: "center" as const,
          gap: 6,
        },
        statusRow: {
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: 6,
        },
        statusDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
        },
        statusText: {
          fontSize: 9,
          color: DARK,
        },
        statusCount: {
          fontSize: 9,
          fontWeight: "bold",
        },

        // ── Footer ────────────────────────────────────────────────────────
        footer: {
          position: "absolute" as const,
          bottom: 20,
          left: 48,
          right: 48,
          flexDirection: "row" as const,
          justifyContent: "space-between" as const,
          alignItems: "center" as const,
          borderTopWidth: 1,
          borderTopColor: BORDER,
          paddingTop: 10,
        },
        footerLeft: {
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: 6,
        },
        footerBrandDot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: BRAND,
        },
        footerText: {
          fontSize: 7,
          color: GRAY,
        },
        footerRight: {
          fontSize: 7,
          color: GRAY,
        },
      });

      const pdfStatusLabel = (s: string) =>
        s === "confirmed" ? "Confirmado" : s === "completed" ? "Concluido" : "Cancelado";
      const pdfStatusColor = (s: string) =>
        s === "confirmed" ? INFO : s === "completed" ? SUCCESS : ERROR;

      const PdfDoc = () => (
        <Document>
          <Page size="A4" style={styles.page}>

            {/* ═══ HEADER: Barra escura com nome da barbearia ═══ */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.shopNameText}>{shopName}</Text>
                <View style={styles.brandAccent} />
              </View>
              <View style={styles.headerRight}>
                <Text style={styles.headerLabel}>RELATÓRIO DE AGENDAMENTOS</Text>
                <Text style={styles.headerValue}>{genDate}</Text>
              </View>
            </View>

            <View style={styles.content}>

              {/* ═══ DADOS DO CLIENTE ═══ */}
              <View style={styles.clientCard}>
                <View style={styles.clientBlock}>
                  <Text style={styles.clientLabel}>CLIENTE</Text>
                  <Text style={styles.clientValue}>{formattedPhone}</Text>
                </View>
                <View style={[styles.clientBlock, { alignItems: "flex-end" as const }]}>
                  <Text style={styles.clientLabel}>TOTAL DE VISITAS</Text>
                  <Text style={styles.clientValue}>{activeCount}</Text>
                  <Text style={styles.clientSubvalue}>
                    {appointments.length} agendamento{appointments.length !== 1 ? "s" : ""} no total
                  </Text>
                </View>
              </View>

              {/* ═══ STATS CARDS ═══ */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: BRAND }]}>
                    R$ {totalGasto.toFixed(2)}
                  </Text>
                  <Text style={styles.statLabel}>TOTAL INVESTIDO</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{activeCount}</Text>
                  <Text style={styles.statLabel}>SERVIÇOS REALIZADOS</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    R$ {avgPrice.toFixed(2)}
                  </Text>
                  <Text style={styles.statLabel}>TICKET MÉDIO</Text>
                </View>
              </View>

              {/* ═══ TABELA DE AGENDAMENTOS ═══ */}
              <Text style={styles.sectionTitle}>Histórico Detalhado</Text>

              <View style={styles.tableHeaderRow}>
                <Text style={[styles.colData, styles.headerCell]}>DATA</Text>
                <Text style={[styles.colHorario, styles.headerCell]}>HORÁRIO</Text>
                <Text style={[styles.colServico, styles.headerCell]}>SERVIÇO</Text>
                <Text style={[styles.colBarbeiro, styles.headerCell]}>PROFISSIONAL</Text>
                <Text style={[styles.colPreco, styles.headerCell]}>VALOR</Text>
                <Text style={[styles.colStatus, styles.headerCell]}>STATUS</Text>
              </View>

              {appointments.map((apt, idx) => (
                <View
                  key={apt.id}
                  style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
                >
                  <Text style={[styles.colData, styles.cellText]}>
                    {new Date(apt.date + "T12:00:00").toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "2-digit", year: "2-digit",
                    })}
                  </Text>
                  <Text style={[styles.colHorario, styles.cellText]}>
                    {apt.startTime} - {apt.endTime}
                  </Text>
                  <Text style={[styles.colServico, styles.cellText]}>
                    {apt.services.map((s) => s.name).join(", ")}
                    {(apt.produtos?.length ?? 0) > 0
                      ? " + " + apt.produtos!.map((p) => `${p.quantity > 1 ? `${p.quantity}x ` : ""}${p.name}`).join(", ")
                      : ""}
                  </Text>
                  <Text style={[styles.colBarbeiro, styles.cellGray]}>
                    {apt.barberName || "—"}
                  </Text>
                  <Text style={[
                    styles.colPreco,
                    styles.cellText,
                    {
                      fontWeight: apt.status !== "cancelled" ? "bold" : "normal",
                      color: apt.status === "cancelled" ? GRAY : DARK,
                    },
                  ]}>
                    R$ {(apt.totalGeral ?? apt.totalPrice).toFixed(2)}
                  </Text>
                  <Text style={[
                    styles.colStatus,
                    { fontSize: 8, fontWeight: "bold", color: pdfStatusColor(apt.status) },
                  ]}>
                    {pdfStatusLabel(apt.status)}
                  </Text>
                </View>
              ))}

              {/* ═══ RESUMO (Total + Status) ═══ */}
              <View style={styles.summaryContainer}>
                <View style={styles.totalCard}>
                  <Text style={styles.totalLabel}>TOTAL INVESTIDO</Text>
                  <Text style={styles.totalValue}>R$ {totalGasto.toFixed(2)}</Text>
                </View>
                <View style={styles.statusCard}>
                  <Text style={[styles.clientLabel, { marginBottom: 4 }]}>RESUMO</Text>
                  {confirmed > 0 && (
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: INFO }]} />
                      <Text style={styles.statusText}>Confirmados</Text>
                      <Text style={[styles.statusCount, { color: INFO }]}>{confirmed}</Text>
                    </View>
                  )}
                  {completed > 0 && (
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: SUCCESS }]} />
                      <Text style={styles.statusText}>Concluidos</Text>
                      <Text style={[styles.statusCount, { color: SUCCESS }]}>{completed}</Text>
                    </View>
                  )}
                  {cancelled > 0 && (
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: ERROR }]} />
                      <Text style={styles.statusText}>Cancelados</Text>
                      <Text style={[styles.statusCount, { color: ERROR }]}>{cancelled}</Text>
                    </View>
                  )}
                </View>
              </View>

            </View>

            {/* ═══ FOOTER ═══ */}
            <View style={styles.footer}>
              <View style={styles.footerLeft}>
                <View style={styles.footerBrandDot} />
                <Text style={styles.footerText}>
                  BarberPro  —  {shopName}  —  Obrigado pela preferencia!
                </Text>
              </View>
              <Text style={styles.footerRight}>Gerado em {genDate}</Text>
            </View>

          </Page>
        </Document>
      );

      const blob = await pdf(<PdfDoc />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `historico-${shopName.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF error:", error);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const statusLabel = (status: string) => {
    if (status === "confirmed") return "Confirmado";
    if (status === "completed") return "Concluido";
    return "Cancelado";
  };

  const statusClass = (status: string) => {
    if (status === "confirmed") return "bg-blue-500/20 text-blue-400";
    if (status === "completed") return "bg-green-500/20 text-green-400";
    return "bg-red-500/20 text-red-400";
  };

  return (
    <main className="min-h-screen bg-dark-900 pb-8">
      {dialogoConfirmacao}
      <header className="bg-dark-800 border-b border-gray-800 p-6 flex flex-col items-center gap-2">
        {shopLogo && <img src={shopLogo} alt={shopName} className="w-14 h-14 rounded-full object-cover border border-brand-500/30" />}
        <h1 className="text-2xl font-semibold text-brand-400">{shopName || "..."}</h1>
      </header>

      <nav className="flex border-b border-gray-800 bg-dark-800">
        <button
          onClick={() => router.push(`/${slug}`)}
          className="flex-1 py-3 text-sm font-medium text-center text-gray-400 hover:text-white transition-colors"
        >
          Agendar
        </button>
        <button className="flex-1 py-3 text-sm font-medium text-center border-b-2 border-brand-400 text-brand-400">
          Meus Agendamentos
        </button>
      </nav>

      <div className="max-w-lg mx-auto px-4 pt-6">
        {!searched ? (
          <div className="animate-slide-up space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Ver meus agendamentos</h2>
              <p className="text-sm text-gray-400 mt-1">Informe seu nome e telefone — os mesmos usados no agendamento.</p>
            </div>
            <input
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl bg-dark-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors"
            />
            <input
              type="tel"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              onKeyDown={(e) => { if (e.key === "Enter") search(); }}
              className="w-full rounded-xl bg-dark-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none transition-colors"
            />
            <button
              disabled={phone.replace(/\D/g, "").length < 10 || name.trim().length < 2 || loading}
              onClick={search}
              className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Buscando..." : "Ver agendamentos"}
            </button>
            <p className="text-xs text-gray-600 text-center">🔒 Pedimos o nome para proteger seus dados — só você vê seus agendamentos.</p>
          </div>
        ) : (
          <div className="animate-slide-up space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {appointments.length} agendamento{appointments.length !== 1 ? "s" : ""}
              </h2>
              {appointments.length > 0 && (
                <button
                  onClick={generatePdf}
                  disabled={generatingPdf}
                  className="rounded-lg bg-dark-800 border border-gray-700 px-4 py-2 text-sm text-brand-400 hover:bg-brand-500/10 transition-colors disabled:opacity-50"
                >
                  {generatingPdf ? "Gerando..." : "Exportar PDF"}
                </button>
              )}
            </div>

            {appointments.length === 0 ? (
              !verified ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-3xl">🔒</p>
                  <p className="text-gray-300 font-medium">Não encontramos agendamentos com esses dados</p>
                  <p className="text-sm text-gray-500">Confira se o <strong>nome</strong> e o <strong>telefone</strong> são exatamente os usados no agendamento.</p>
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8">Nenhum agendamento encontrado</p>
              )
            ) : (
              <>
                <div className="rounded-xl bg-dark-800 border border-gray-700 p-4 flex justify-between items-center">
                  <span className="text-gray-400">Total gasto</span>
                  <span className="text-xl font-semibold text-brand-400">R$ {totalGasto.toFixed(2)}</span>
                </div>

                <div className="space-y-3">
                  {appointments.map((apt) => (
                    <div key={apt.id} className="rounded-xl bg-dark-800 border border-gray-700 p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{formatDate(apt.date)}</p>
                          <p className="text-sm text-gray-400">{apt.startTime} - {apt.endTime}</p>
                          {apt.barberName && (
                            <p className="text-xs text-gray-500 mt-0.5">com {apt.barberName}</p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${statusClass(apt.status)}`}>
                          {statusLabel(apt.status)}
                        </span>
                      </div>
                      <div className="flex justify-between items-end gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-400">{apt.services.map((s) => s.name).join(", ")}</p>
                          {/* O produto que o barbeiro lançou precisa aparecer aqui:
                              sem isto o cliente paga 115 e lê 45 no próprio histórico. */}
                          {(apt.produtos?.length ?? 0) > 0 && (
                            <p className="text-xs text-gray-500">
                              +{" "}
                              {apt.produtos!
                                .map((p) => (p.quantity > 1 ? p.quantity + "x " : "") + p.name)
                                .join(", ")}
                            </p>
                          )}
                        </div>
                        <p className="font-semibold text-brand-400 shrink-0">
                          R$ {(apt.totalGeral ?? apt.totalPrice).toFixed(2)}
                        </p>
                      </div>

                      {/* Edição inline */}
                      {editingId === apt.id && (
                        <div className="pt-2 space-y-3 border-t border-gray-700">
                          <p className="text-xs font-semibold text-brand-400">Editar serviços:</p>
                          <div className="space-y-2">
                            {shopServices.map((svc) => {
                              const checked = editServiceIds.includes(svc.id);
                              return (
                                <label key={svc.id} className="flex items-center gap-3 cursor-pointer">
                                  <input
                                    type={svc.category === "corte" ? "radio" : "checkbox"}
                                    checked={checked}
                                    onChange={() => toggleEditService(svc.id, svc.category)}
                                    className="accent-yellow-400"
                                  />
                                  <span className={`flex-1 text-sm ${checked ? "text-white" : "text-gray-500"}`}>
                                    {svc.name}
                                  </span>
                                  <span className="text-sm text-brand-400">R$ {svc.price.toFixed(2)}</span>
                                </label>
                              );
                            })}
                          </div>
                          <div className="flex justify-between items-center text-sm font-semibold">
                            <span className="text-gray-400">Total:</span>
                            <span className="text-brand-400">R$ {editTotal.toFixed(2)}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingId(null)}
                              className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleSaveEdit}
                              disabled={saving || editServiceIds.length === 0}
                              className="flex-1 rounded-lg bg-brand-500 py-2 text-sm font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all"
                            >
                              {saving ? "Salvando..." : "Confirmar"}
                            </button>
                          </div>
                        </div>
                      )}

                      {apt.status === "confirmed" && editingId !== apt.id && (
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => startEdit(apt)}
                            className="flex-1 rounded-lg border border-brand-400/40 py-2 text-sm text-brand-400 hover:bg-brand-500/10 transition-colors"
                          >
                            Editar serviços
                          </button>
                          <button
                            onClick={() => handleCancel(apt.id)}
                            disabled={cancelling === apt.id}
                            className="flex-1 rounded-lg border border-red-500/30 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                          >
                            {cancelling === apt.id ? "Cancelando..." : "Cancelar"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <button
              onClick={() => setSearched(false)}
              className="w-full rounded-xl border border-gray-700 py-3 text-gray-400 hover:text-white transition-colors"
            >
              Consultar com outros dados
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
