import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import HudIcon, { iconeDoEmoji } from "../components/HudIcon";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Share,
  RefreshControl,
  Modal,
  Image,
  TextInput,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useColors } from "../utils/useColors";
import { fontSize, fontFamily, fontWeight, spacing, radius, feedback, shadow } from "../utils/tokens";
import { api, API_BASE } from "../services/api";
import { ScreenBackground, AppButton, AppCard, SectionHeader, StatusBadge, AppAlert } from "../components";
import type { AlertButton } from "../components/AppAlert";

interface UserData {
  id: string;
  name: string;
  phone: string;
  role: "owner" | "barber";
  shopId: string;
  shopName: string;
  slug: string;
  link: string;
}

interface AppointmentService {
  serviceId: string;
  name: string;
  price: number;
}

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: string;
  paidAt: string | null;
  client: { id: string; name: string; phone: string; notes?: string | null };
  services: AppointmentService[];
  barberName?: string;
}

interface Props {
  token: string;
  barber: UserData;
  onLogout: () => void;
  onOpenFinance: () => void;
  onOpenLoyalty: () => void;
  onOpenBarbers?: () => void;
  onOpenDashboard?: () => void;
  onOpenProducts?: () => void;
  onOpenAvailability?: () => void;
  onOpenSobre?: () => void;
  onOpenServices?: () => void;
  onOpenClients?: () => void;
  onOpenRecurring?: () => void;
}

// Greeting baseado na hora
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function HomeScreen({ token, barber, onLogout, onOpenFinance, onOpenLoyalty, onOpenBarbers, onOpenDashboard, onOpenProducts, onOpenAvailability, onOpenSobre, onOpenServices, onOpenClients, onOpenRecurring }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [clientNotes, setClientNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const noteSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [appAlert, setAppAlert] = useState<{ title: string; message?: string; buttons?: AlertButton[] } | null>(null);

  const showAlert = (title: string, message?: string, buttons?: AlertButton[]) =>
    setAppAlert({ title, message, buttons });

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAppointments(token, selectedDate);
      setAppointments(data.appointments || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [token, selectedDate]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const bookingLink = `${API_BASE}/${barber.slug}`;

  const shareLink = async () => {
    try {
      await Share.share({
        message: `Agende seu corte na ${barber.shopName}! Acesse: ${bookingLink}`,
      });
    } catch {
      // user cancelled
    }
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(bookingLink);
    showAlert("Copiado!", "Link copiado para a área de transferência");
  };

  const getDates = () => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  };

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const day = d.getDate().toString().padStart(2, "0");
    const weekday = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"][d.getDay()];
    return { day, weekday };
  };

  const isToday = (dateStr: string) =>
    dateStr === new Date().toISOString().split("T")[0];

  const isAppointmentPast = (dateStr: string, startTime: string) => {
    const [h, m] = startTime.split(":").map(Number);
    const apptDate = new Date(dateStr + "T12:00:00");
    apptDate.setHours(h, m, 0, 0);
    return new Date() > apptDate;
  };

  // Quick action items
  const quickActions = [
    { icon: "💰", label: "Financeiro", onPress: onOpenFinance },
    { icon: "🏆", label: "Fidelidade", onPress: onOpenLoyalty },
    { icon: "🛍️", label: "Produtos", onPress: onOpenProducts },
    { icon: "📅", label: "Agenda", onPress: onOpenAvailability },
    ...(barber.role === "owner" && onOpenDashboard
      ? [{ icon: "📊", label: "Dashboard", onPress: onOpenDashboard }]
      : []),
    ...(barber.role === "owner" && onOpenBarbers
      ? [{ icon: "users", label: "Barbeiros", onPress: onOpenBarbers }]
      : []),
    ...(barber.role === "owner" && onOpenServices
      ? [{ icon: "scissors", label: "Serviços", onPress: onOpenServices }]
      : []),
    ...(barber.role === "owner" && onOpenClients
      ? [{ icon: "👥", label: "Clientes", onPress: onOpenClients }]
      : []),
    // Corte fixo: o barbeiro tambem agenda, e o cliente semanal entra numa
    // regra so em vez de virar dezenas de agendamentos iguais.
    ...(onOpenRecurring
      ? [{ icon: "🔁", label: "Corte fixo", onPress: onOpenRecurring }]
      : []),
  ];

  return (
    <ScreenBackground>
    <View style={styles.container}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.shopName}>{barber.shopName}</Text>
          <Text style={styles.greeting}>
            {getGreeting()}, {barber.name}
          </Text>
        </View>
        <TouchableOpacity onPress={onOpenSobre} style={styles.settingsButton}>
          <HudIcon nome="settings" size={22} color={colors.gray[400]} />
        </TouchableOpacity>
      </View>

      {/* ── Link compartilhavel ──────────────────────────────────── */}
      <AppCard style={styles.linkCard}>
        <Text style={styles.linkLabel}>Seu link de agendamento:</Text>
        <Text style={styles.linkUrl} numberOfLines={1}>
          {bookingLink}
        </Text>
        <View style={styles.linkActions}>
          <AppButton
            title="Copiar"
            variant="secondary"
            size="sm"
            onPress={copyLink}
            style={{ flex: 1 }}
          />
          <AppButton
            title="Compartilhar"
            variant="primary"
            size="sm"
            onPress={shareLink}
            style={{ flex: 1 }}
          />
        </View>
        <TouchableOpacity onPress={() => setShowQR(true)} style={{ alignItems: "center", marginTop: spacing.sm, paddingVertical: 6 }}>
          <Text style={{ color: colors.brand[400], fontSize: fontSize.bodySmall, fontWeight: fontWeight.semibold }}>Ver QR Code</Text>
        </TouchableOpacity>
      </AppCard>

      {/* ── QR Code Modal ──────────────────────────────────────────── */}
      <Modal visible={showQR} transparent animationType="fade" onRequestClose={() => setShowQR(false)}>
        <TouchableOpacity style={styles.qrOverlay} activeOpacity={1} onPress={() => setShowQR(false)}>
          <View style={styles.qrCard}>
            <Text style={{ color: colors.white, fontSize: fontSize.h2, fontFamily: fontFamily.serifBold, marginBottom: 4 }}>{barber.shopName}</Text>
            <Text style={{ color: colors.gray[400], fontSize: fontSize.bodySmall, marginBottom: spacing.lg }}>Escaneie para agendar</Text>
            <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: radius.lg }}>
              <Image source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bookingLink)}` }} style={{ width: 200, height: 200 }} />
            </View>
            <Text style={{ color: colors.gray[500], fontSize: fontSize.micro, marginTop: spacing.md, textAlign: "center" }}>{bookingLink}</Text>
            <TouchableOpacity onPress={() => setShowQR(false)} style={{ marginTop: spacing.lg, backgroundColor: colors.brand[500], borderRadius: radius.md, paddingHorizontal: 24, paddingVertical: 10 }}>
              <Text style={{ color: colors.dark[900], fontWeight: fontWeight.bold, fontSize: fontSize.body }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Tudo em um FlatList para scroll correto ─────────────── */}
      <FlatList
        style={{ flex: 1 }}
        ListHeaderComponent={
          <>
            {/* Date Selector */}
            <FlatList
              horizontal
              data={getDates()}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              style={styles.dateList}
              renderItem={({ item }) => {
                const { day, weekday } = formatShortDate(item);
                const active = item === selectedDate;
                return (
                  <TouchableOpacity
                    onPress={() => setSelectedDate(item)}
                    style={[styles.dateItem, active && styles.dateItemActive]}
                  >
                    <Text style={[styles.dateWeekday, active && styles.dateTextActive]}>
                      {weekday}
                    </Text>
                    <Text style={[styles.dateDay, active && styles.dateTextActive]}>
                      {day}
                    </Text>
                    {isToday(item) && <View style={styles.todayDot} />}
                  </TouchableOpacity>
                );
              }}
            />
            {/* Quick Actions Grid */}
            <View style={styles.actionsGrid}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  style={styles.actionBtn}
                  onPress={action.onPress}
                  activeOpacity={0.7}
                >
                  <HudIcon nome={iconeDoEmoji(action.icon) ?? "circle"} size={24} color={colors.brand[400]} />
                  <Text style={styles.actionLabel} numberOfLines={1}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Section Header */}
            <SectionHeader
              title={`${appointments.length} agendamento${appointments.length !== 1 ? "s" : ""}`}
              subtitle={isToday(selectedDate) ? "Hoje" : undefined}
            />
          </>
        }
        data={appointments}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchAppointments}
            tintColor={colors.brand[400]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <HudIcon nome="calendar" size={36} color={colors.brand[400]} />
            <Text style={styles.emptyText}>
              {loading ? "Carregando..." : "Nenhum agendamento neste dia"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <AppCard style={styles.appointmentCard}>
            <View style={styles.appointmentHeader}>
              <View style={styles.timeBlock}>
                <Text style={styles.timeText}>{item.startTime}</Text>
                <Text style={styles.timeSep}>-</Text>
                <Text style={styles.timeText}>{item.endTime}</Text>
              </View>
              <Text style={styles.priceText}>
                R$ {item.totalPrice.toFixed(2)}
              </Text>
            </View>
            <Text style={styles.clientName}>{item.client.name}</Text>
            <Text style={styles.servicesText}>
              {item.services.map((s) => s.name).join(", ")}
              {item.barberName ? ` · ${item.barberName}` : ""}
            </Text>
            <Text style={styles.clientPhone}>{item.client.phone}</Text>

            {/* Notas CRM */}
            <View style={styles.notesContainer}>
              <Text style={[styles.notesLabel, { color: colors.gray[400] }]}>Notas</Text>
              <TextInput
                style={[styles.notesInput, { color: colors.white, borderColor: colors.gray[700], backgroundColor: colors.dark[900] }]}
                placeholder="Observações (cabelo, preferências...)"
                placeholderTextColor={colors.gray[600]}
                multiline
                numberOfLines={2}
                value={clientNotes[item.client.id] ?? (item.client.notes || "")}
                onChangeText={(text) => {
                  setClientNotes((prev) => ({ ...prev, [item.client.id]: text }));
                  // auto-save com debounce de 1.5s
                  clearTimeout(noteSaveTimers.current[item.client.id]);
                  noteSaveTimers.current[item.client.id] = setTimeout(async () => {
                    setSavingNote(item.client.id);
                    try { await api.updateClientNotes(token, item.client.id, text || null); } catch { /* ignore */ }
                    setSavingNote(null);
                  }, 1500);
                }}
              />
              {savingNote === item.client.id && (
                <Text style={{ color: colors.gray[500], fontSize: fontSize.micro }}>Salvando...</Text>
              )}
            </View>

            {item.status === "pending_payment" && (
              <View style={styles.pendingPaymentBadge}>
                <Text style={styles.pendingPaymentText}>Aguardando confirmação do Pix</Text>
                <AppButton
                  title="✓ Confirmar Pix"
                  variant="primary"
                  size="sm"
                  onPress={() => {
                    showAlert(
                      "Confirmar Pix",
                      `Confirmar o pagamento de ${item.client.name} e liberar o agendamento das ${item.startTime}?`,
                      [
                        { text: "Voltar", style: "cancel" },
                        {
                          text: "Confirmar",
                          onPress: async () => {
                            try {
                              await api.confirmPixPayment(token, item.id);
                              fetchAppointments();
                            } catch {
                              showAlert("Erro", "Não foi possível confirmar");
                            }
                          },
                        },
                      ]
                    );
                  }}
                  style={{ backgroundColor: feedback.warning }}
                  textStyle={{ color: "#000" }}
                />
              </View>
            )}

            {item.status === "confirmed" && (
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    showAlert(
                      "Cancelar agendamento",
                      `Cancelar o agendamento de ${item.client.name} às ${item.startTime}?`,
                      [
                        { text: "Voltar", style: "cancel" },
                        {
                          text: "Cancelar",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await api.cancelAppointment(token, item.id);
                              fetchAppointments();
                            } catch {
                              showAlert("Erro", "Não foi possível cancelar");
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                {isAppointmentPast(item.date, item.startTime) && (
                  <TouchableOpacity
                    style={styles.noShowBtn}
                    onPress={() => {
                      showAlert(
                        "Cliente não veio",
                        `${item.client.name} não compareceu às ${item.startTime}?\n\nIsso será registrado e poderá exigir pagamento antecipado na próxima vez.`,
                        [
                          { text: "Voltar", style: "cancel" },
                          {
                            text: "Confirmar",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await api.markNoShow(token, item.id);
                                fetchAppointments();
                              } catch {
                                showAlert("Erro", "Não foi possível registrar");
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.noShowBtnText}>Não veio</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </AppCard>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>

      <AppAlert
        visible={!!appAlert}
        title={appAlert?.title ?? ""}
        message={appAlert?.message}
        buttons={appAlert?.buttons}
        onClose={() => setAppAlert(null)}
      />
    </ScreenBackground>
  );
}

// ── Styles Factory ─────────────────────────────────────────────────────────
function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },

    // Header
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.screenTop,
      paddingBottom: spacing.lg,
      backgroundColor: colors.dark[800],
      borderBottomWidth: 1,
      borderBottomColor: colors.gray[700] + "40",
    },
    shopName: {
      fontSize: fontSize.h2,
      fontFamily: fontFamily.serifBold,
      color: colors.brand[400],
    },
    greeting: {
      fontSize: fontSize.body,
      color: colors.gray[400],
      marginTop: spacing.xs,
    },
    settingsButton: { padding: spacing.sm },
    settingsText: { fontSize: 22 },

    // Link card
    linkCard: {
      margin: spacing.lg,
    },
    linkLabel: {
      fontSize: fontSize.caption,
      color: colors.gray[400],
      marginBottom: spacing.sm,
    },
    linkUrl: {
      fontSize: fontSize.body,
      color: colors.brand[400],
      marginBottom: spacing.md,
    },
    linkActions: {
      flexDirection: "row",
      gap: spacing.sm,
    },

    // Date selector
    dateList: {
      paddingHorizontal: spacing.lg,
      maxHeight: 80,
    },
    dateItem: {
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: 14,
      marginRight: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.gray[700],
      backgroundColor: colors.dark[800],
    },
    dateItemActive: {
      borderColor: colors.brand[400],
      backgroundColor: colors.brand[500] + "15",
    },
    dateWeekday: {
      fontSize: fontSize.micro,
      color: colors.gray[400],
    },
    dateDay: {
      fontSize: 18,
      fontWeight: fontWeight.bold,
      color: colors.white,
      marginTop: 2,
    },
    dateTextActive: { color: colors.brand[400] },
    todayDot: {
      width: spacing.xs,
      height: spacing.xs,
      borderRadius: 2,
      backgroundColor: colors.brand[500],
      marginTop: spacing.xs,
    },

    // Quick actions grid
    actionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.dark[800],
      borderWidth: 1,
      borderColor: colors.gray[700],
      minWidth: "30%",
      flexGrow: 1,
    },
    actionIcon: { fontSize: 18 },
    actionLabel: {
      fontSize: fontSize.bodySmall,
      fontWeight: fontWeight.semibold,
      color: colors.white,
      flexShrink: 1,
    },

    // Appointment cards
    appointmentCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    appointmentHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    timeBlock: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    timeText: {
      fontSize: fontSize.h3,
      fontWeight: fontWeight.bold,
      color: colors.brand[400],
    },
    timeSep: { color: colors.gray[500], fontSize: fontSize.body },
    priceText: {
      fontSize: fontSize.h3,
      fontWeight: fontWeight.bold,
      color: colors.brand[400],
    },
    clientName: {
      fontSize: 15,
      fontWeight: fontWeight.semibold,
      color: colors.white,
    },
    servicesText: {
      fontSize: fontSize.bodySmall,
      color: colors.gray[400],
      marginTop: 2,
    },
    clientPhone: {
      fontSize: fontSize.caption,
      color: colors.gray[500],
      marginTop: spacing.xs,
    },
    notesContainer: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.gray[700] + "40",
    },
    notesLabel: {
      fontSize: fontSize.micro,
      marginBottom: 4,
    },
    notesInput: {
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: fontSize.caption,
      textAlignVertical: "top",
    },

    // Card actions
    cardActions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: feedback.error + "50",
      backgroundColor: feedback.errorBg,
      alignItems: "center",
    },
    cancelBtnText: {
      fontSize: fontSize.bodySmall,
      color: feedback.error,
      fontWeight: fontWeight.semibold,
    },
    noShowBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: feedback.warning + "50",
      backgroundColor: feedback.warningBg,
      alignItems: "center",
    },
    noShowBtnText: {
      fontSize: fontSize.bodySmall,
      color: feedback.warning,
      fontWeight: fontWeight.semibold,
    },

    // Pending payment
    pendingPaymentBadge: {
      marginTop: spacing.sm,
      backgroundColor: feedback.warningBg,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: feedback.warning + "40",
      padding: spacing.sm,
      gap: spacing.sm,
    },
    pendingPaymentText: {
      fontSize: fontSize.caption,
      color: feedback.warning,
      fontWeight: fontWeight.medium,
    },

    // Empty state
    empty: {
      alignItems: "center",
      paddingVertical: spacing["4xl"],
      gap: spacing.sm,
    },
    emptyIcon: { fontSize: 32 },
    emptyText: {
      color: colors.gray[500],
      fontSize: fontSize.body,
    },
    listContent: { paddingBottom: spacing["4xl"] },

    // QR Code modal
    qrOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.85)",
      justifyContent: "center",
      alignItems: "center",
    },
    qrCard: {
      backgroundColor: colors.dark[800],
      borderRadius: radius.xl,
      padding: spacing.xl,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.gray[700],
      width: "85%",
    },
  });
}
