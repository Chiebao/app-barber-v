import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useColors } from "../utils/useColors";
import { api } from "../services/api";
import { ScreenBackground, ScreenHeader, AppCard, AppButton } from "../components";
import { fontSize, fontWeight, spacing, radius, feedback } from "../utils/tokens";

interface ServiceItem {
  name: string;
  category: string;
  price: number;
}

interface AppointmentItem {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  deferredPaymentDate: string | null;
  client: { name: string; phone: string };
  services: ServiceItem[];
}

interface Summary {
  totalAppointments: number;
  totalPaid: number;
  totalUnpaid: number;
  paidCount: number;
  unpaidCount: number;
  serviceCounts: Record<string, number>;
  paymentCounts: Record<string, { count: number; total: number }>;
}

interface Props {
  token: string;
  onBack: () => void;
}

type Period = "day" | "week" | "month";

const PAYMENT_METHODS = [
  { key: "pix", label: "Pix", icon: "💠" },
  { key: "dinheiro", label: "Dinheiro", icon: "💵" },
  { key: "cartao", label: "Cartão", icon: "💳" },
];

const CATEGORY_LABELS: Record<string, string> = {
  corte: "Cortes",
  barba: "Barbas",
  sobrancelha: "Sobrancelhas",
  pezinho: "Pezinhos",
  luzes: "Luzes",
};

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    periodTabs: {
      flexDirection: "row",
      padding: spacing.md,
      gap: spacing.sm,
    },
    periodTab: {
      flex: 1,
      paddingVertical: spacing.sm + 2,
      borderRadius: spacing.sm + 2,
      borderWidth: 1,
      borderColor: colors.gray[700],
      alignItems: "center",
    },
    periodTabActive: {
      borderColor: colors.brand[400],
      backgroundColor: colors.brand[500] + "15",
    },
    periodText: { fontSize: fontSize.body, color: colors.gray[400] },
    periodTextActive: { color: colors.brand[400], fontWeight: fontWeight.semibold },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    content: { flex: 1, paddingHorizontal: spacing.lg },
    summaryRow: { flexDirection: "row" },
    summaryItem: { flex: 1, alignItems: "center" },
    summaryDivider: { width: 1, backgroundColor: colors.gray[700], marginHorizontal: spacing.md },
    summaryLabel: { fontSize: fontSize.caption, color: colors.gray[400], marginBottom: spacing.xs },
    summaryValue: { fontSize: fontSize.h2 + 2, fontWeight: fontWeight.bold },
    summaryCount: { fontSize: fontSize.micro, color: colors.gray[500], marginTop: 2 },
    paymentBreakdown: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.gray[700],
      gap: spacing.xs + 2,
    },
    paymentMethodRow: { flexDirection: "row", justifyContent: "space-between" },
    paymentMethodLabel: { fontSize: fontSize.bodySmall, color: colors.gray[400] },
    paymentMethodValue: { fontSize: fontSize.bodySmall, color: colors.white },
    serviceBreakdown: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.gray[700],
    },
    breakdownTitle: { fontSize: fontSize.caption, color: colors.gray[400], marginBottom: spacing.sm },
    serviceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
    serviceLabel: { fontSize: fontSize.bodySmall, color: colors.gray[400] },
    serviceCount: { fontSize: fontSize.bodySmall, fontWeight: fontWeight.bold, color: colors.brand[400] },
    listTitle: { fontSize: fontSize.h3, fontWeight: fontWeight.semibold, color: colors.white, marginBottom: spacing.md },
    emptyText: { color: colors.gray[500], textAlign: "center", paddingVertical: spacing["3xl"] },
    aptHeader: { flexDirection: "row", gap: spacing.sm + 2 },
    aptLeft: { flex: 1 },
    clientName: { fontSize: fontSize.body + 1, fontWeight: fontWeight.semibold, color: colors.white },
    aptServices: { fontSize: fontSize.caption, color: colors.gray[400], marginTop: 2, flexWrap: "wrap" },
    aptTime: { fontSize: fontSize.micro, color: colors.gray[500], marginTop: 2 },
    aptRight: { alignItems: "flex-end", gap: spacing.xs + 2, flexShrink: 0 },
    aptPrice: { fontSize: fontSize.h3, fontWeight: fontWeight.bold, color: colors.brand[400] },
    paidBadge: {
      backgroundColor: feedback.success + "20",
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    paidText: { fontSize: fontSize.caption, color: feedback.success },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing["2xl"],
    },
    modalContent: {
      backgroundColor: colors.dark[800],
      borderRadius: radius.xl,
      padding: spacing["2xl"],
      width: "100%",
      maxWidth: 320,
      alignItems: "center",
    },
    modalTitle: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.white, marginBottom: spacing.xl },
    paymentOption: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      padding: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.gray[700],
      marginBottom: spacing.sm + 2,
    },
    paymentIcon: { fontSize: spacing["2xl"], marginRight: spacing.lg - 2 },
    paymentLabel: { fontSize: fontSize.h3, color: colors.white, fontWeight: fontWeight.medium },
    cancelButton: {
      marginTop: spacing.sm,
      padding: spacing.md,
      width: "100%",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: feedback.error + "50",
      backgroundColor: feedback.errorBg,
      alignItems: "center",
    },
    cancelText: { color: feedback.error, fontSize: fontSize.body, fontWeight: fontWeight.semibold },
    loyaltyIcon: { fontSize: spacing["4xl"], marginBottom: spacing.md },
    loyaltyTitle: { fontSize: fontSize.h2 + 2, fontWeight: fontWeight.bold, color: colors.brand[400], marginBottom: spacing.sm },
    loyaltyText: { fontSize: fontSize.h3, color: colors.white, textAlign: "center", marginBottom: spacing.xs },
    loyaltyHint: { fontSize: fontSize.body, color: colors.gray[400], textAlign: "center", marginBottom: spacing.xl },
    loyaltyButton: {
      backgroundColor: colors.brand[500],
      paddingHorizontal: spacing["3xl"],
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    loyaltyButtonText: { fontSize: fontSize.h3, fontWeight: fontWeight.bold, color: colors.dark[900] },

    // Deferred date picker
    deferTitle: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.gray[300], marginBottom: spacing.md, textAlign: "center" },
    datesScroll: { maxHeight: 100 },
    datesRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center", paddingBottom: spacing.sm },
    dateChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.gray[600],
      alignItems: "center",
      minWidth: 60,
    },
    dateChipSelected: { borderColor: colors.brand[400], backgroundColor: colors.brand[500] + "20" },
    dateChipDay: { fontSize: fontSize.micro, color: colors.gray[400] },
    dateChipDaySelected: { color: colors.brand[400] },
    dateChipNum: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.white },
    dateChipNumSelected: { color: colors.brand[400] },
    confirmDeferBtn: {
      marginTop: spacing.md,
      backgroundColor: colors.brand[500],
      borderRadius: radius.md,
      padding: spacing.md,
      width: "100%",
      alignItems: "center",
    },
    confirmDeferText: { color: colors.dark[900], fontWeight: fontWeight.bold, fontSize: fontSize.body },
    backBtn: { marginTop: spacing.sm, padding: spacing.sm, alignItems: "center" },
    backBtnText: { color: colors.gray[400], fontSize: fontSize.caption },

    // Deferred badge
    deferredBadge: {
      backgroundColor: colors.brand[500] + "20",
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    deferredText: { fontSize: fontSize.caption, color: colors.brand[400] },
  });
}

export default function FinanceScreen({ token, onBack }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [period, setPeriod] = useState<Period>("day");
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showDeferPicker, setShowDeferPicker] = useState(false);
  const [selectedDeferDate, setSelectedDeferDate] = useState<string | null>(null);
  const [loyaltyAlert, setLoyaltyAlert] = useState<{
    clientName: string;
    count: number;
  } | null>(null);

  // Gera os próximos 14 dias para o seletor de data adiada
  const deferDates = useMemo(() => {
    const days: { iso: string; dayName: string; dayNum: string }[] = [];
    const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    for (let i = 1; i <= 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push({
        iso: d.toISOString().split("T")[0],
        dayName: DAY_NAMES[d.getDay()],
        dayNum: String(d.getDate()).padStart(2, "0"),
      });
    }
    return days;
  }, []);

  const getDateRange = useCallback((): { start: string; end: string } => {
    const today = new Date();
    const yyyy = (d: Date) => d.toISOString().split("T")[0];

    if (period === "day") {
      return { start: yyyy(today), end: yyyy(today) };
    }
    if (period === "week") {
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: yyyy(monday), end: yyyy(sunday) };
    }
    // month
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: yyyy(firstDay), end: yyyy(lastDay) };
  }, [period]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const data = await api.getFinanceReport(token, start, end);
      setAppointments(data.appointments || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [token, getDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConfirmPayment = async (method: string) => {
    if (method === "adiado") {
      setShowDeferPicker(true);
      return;
    }
    if (!paymentModal) return;
    setConfirming(true);
    try {
      const result = await api.confirmPayment(token, paymentModal, method);
      setPaymentModal(null);
      if (result.loyalty?.reachedReward) {
        setLoyaltyAlert({ clientName: result.loyalty.clientName, count: result.loyalty.count });
      }
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro";
      Alert.alert("Erro", message);
    } finally {
      setConfirming(false);
    }
  };

  const handleConfirmDefer = async () => {
    if (!paymentModal || !selectedDeferDate) return;
    setConfirming(true);
    try {
      await api.confirmPayment(token, paymentModal, "adiado", selectedDeferDate);
      setPaymentModal(null);
      setShowDeferPicker(false);
      setSelectedDeferDate(null);
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro";
      Alert.alert("Erro", message);
    } finally {
      setConfirming(false);
    }
  };

  const closePaymentModal = () => {
    setPaymentModal(null);
    setShowDeferPicker(false);
    setSelectedDeferDate(null);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  return (
    <ScreenBackground>
    <View style={styles.container}>
      <ScreenHeader title="Financeiro" onBack={onBack} />

      {/* Period tabs */}
      <View style={styles.periodTabs}>
        {(["day", "week", "month"] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            style={[styles.periodTab, period === p && styles.periodTabActive]}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {p === "day" ? "Hoje" : p === "week" ? "Semana" : "Mês"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand[400]} />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Resumo financeiro */}
          {summary && (
            <AppCard style={{ marginBottom: spacing.xl }} padding="xl">
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Valor Pago</Text>
                  <Text style={[styles.summaryValue, { color: feedback.success }]}>
                    R$ {summary.totalPaid.toFixed(2)}
                  </Text>
                  <Text style={styles.summaryCount}>{summary.paidCount} atendimentos</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>A Receber</Text>
                  <Text style={[styles.summaryValue, { color: colors.brand[400] }]}>
                    R$ {summary.totalUnpaid.toFixed(2)}
                  </Text>
                  <Text style={styles.summaryCount}>{summary.unpaidCount} pendentes</Text>
                </View>
              </View>

              {/* Pagamentos por metodo */}
              {Object.keys(summary.paymentCounts).length > 0 && (
                <View style={styles.paymentBreakdown}>
                  {Object.entries(summary.paymentCounts).map(([method, data]) => (
                    <View key={method} style={styles.paymentMethodRow}>
                      <Text style={styles.paymentMethodLabel}>
                        {method === "pix" ? "💠 Pix" : method === "dinheiro" ? "💵 Dinheiro" : "💳 Cartão"}
                      </Text>
                      <Text style={styles.paymentMethodValue}>
                        {data.count}x = R$ {data.total.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Contagem por servico */}
              {Object.keys(summary.serviceCounts).length > 0 && (
                <View style={styles.serviceBreakdown}>
                  <Text style={styles.breakdownTitle}>Serviços realizados</Text>
                  {Object.entries(summary.serviceCounts).map(([cat, count]) => (
                    <View key={cat} style={styles.serviceRow}>
                      <Text style={styles.serviceLabel}>
                        {CATEGORY_LABELS[cat] || cat}
                      </Text>
                      <Text style={styles.serviceCount}>{count}</Text>
                    </View>
                  ))}
                </View>
              )}
            </AppCard>
          )}

          {/* Lista de agendamentos */}
          <Text style={styles.listTitle}>Atendimentos</Text>
          {appointments.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum atendimento neste período</Text>
          ) : (
            appointments.map((apt) => (
              <AppCard key={apt.id} style={{ marginBottom: spacing.sm + 2 }} padding="md">
                <View style={styles.aptHeader}>
                  <View style={styles.aptLeft}>
                    <Text style={styles.clientName}>{apt.client.name}</Text>
                    <Text style={styles.aptServices}>
                      {apt.services.map((s) => s.name).join(", ")}
                    </Text>
                    <Text style={styles.aptTime}>
                      {formatDate(apt.date)} - {apt.startTime}
                    </Text>
                  </View>
                  <View style={styles.aptRight}>
                    <Text style={styles.aptPrice}>R$ {apt.totalPrice.toFixed(2)}</Text>
                    {apt.paidAt ? (
                      <View style={styles.paidBadge}>
                        <Text style={styles.paidText}>
                          {apt.paymentMethod === "pix" ? "💠" : apt.paymentMethod === "dinheiro" ? "💵" : "💳"} Pago
                        </Text>
                      </View>
                    ) : apt.deferredPaymentDate ? (
                      <View style={styles.deferredBadge}>
                        <Text style={styles.deferredText}>
                          📅 {new Date(apt.deferredPaymentDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </Text>
                      </View>
                    ) : (
                      <AppButton
                        title="Confirmar"
                        onPress={() => setPaymentModal(apt.id)}
                        size="sm"
                        style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 }}
                      />
                    )}
                  </View>
                </View>
              </AppCard>
            ))
          )}
          <View style={{ height: spacing["3xl"] + spacing.sm }} />
        </ScrollView>
      )}

      {/* Modal de pagamento */}
      <Modal visible={!!paymentModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {!showDeferPicker ? (
              <>
                <Text style={styles.modalTitle}>Forma de pagamento</Text>
                {PAYMENT_METHODS.map((method) => (
                  <TouchableOpacity
                    key={method.key}
                    style={styles.paymentOption}
                    onPress={() => handleConfirmPayment(method.key)}
                    disabled={confirming}
                  >
                    <Text style={styles.paymentIcon}>{method.icon}</Text>
                    <Text style={styles.paymentLabel}>{method.label}</Text>
                  </TouchableOpacity>
                ))}
                {/* Opção Adiado */}
                <TouchableOpacity
                  style={[styles.paymentOption, { borderColor: colors.brand[400] + "60", backgroundColor: colors.brand[500] + "10" }]}
                  onPress={() => handleConfirmPayment("adiado")}
                  disabled={confirming}
                >
                  <Text style={styles.paymentIcon}>📅</Text>
                  <Text style={[styles.paymentLabel, { color: colors.brand[400] }]}>Adiado</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={closePaymentModal}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Quando vai pagar?</Text>
                <Text style={styles.deferTitle}>Selecione a data combinada</Text>
                <View style={styles.datesRow}>
                  {deferDates.map((d) => (
                    <TouchableOpacity
                      key={d.iso}
                      style={[styles.dateChip, selectedDeferDate === d.iso && styles.dateChipSelected]}
                      onPress={() => setSelectedDeferDate(d.iso)}
                    >
                      <Text style={[styles.dateChipDay, selectedDeferDate === d.iso && styles.dateChipDaySelected]}>{d.dayName}</Text>
                      <Text style={[styles.dateChipNum, selectedDeferDate === d.iso && styles.dateChipNumSelected]}>{d.dayNum}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.confirmDeferBtn, !selectedDeferDate && { opacity: 0.4 }]}
                  onPress={handleConfirmDefer}
                  disabled={!selectedDeferDate || confirming}
                >
                  <Text style={styles.confirmDeferText}>Confirmar data</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backBtn} onPress={() => setShowDeferPicker(false)}>
                  <Text style={styles.backBtnText}>← Voltar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de fidelidade */}
      <Modal visible={!!loyaltyAlert} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.loyaltyIcon}>🏆</Text>
            <Text style={styles.loyaltyTitle}>Cliente Fiel!</Text>
            <Text style={styles.loyaltyText}>
              {loyaltyAlert?.clientName} completou{" "}
              {loyaltyAlert?.count} cortes!
            </Text>
            <Text style={styles.loyaltyHint}>
              Hora de oferecer uma recompensa!
            </Text>
            <TouchableOpacity
              style={styles.loyaltyButton}
              onPress={() => setLoyaltyAlert(null)}
            >
              <Text style={styles.loyaltyButtonText}>Entendi!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
    </ScreenBackground>
  );
}
