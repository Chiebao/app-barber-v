import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useColors } from "../utils/useColors";
import { api } from "../services/api";
import { ScreenBackground, ScreenHeader, AppButton, AppInput } from "../components";
import { fontSize, fontWeight, spacing, radius, feedback } from "../utils/tokens";

interface SlotData {
  allSlots: string[];
  blocked: string[];
  allDay: boolean;
  booked: string[];
}

interface Props {
  token: string;
  role: "owner" | "barber";
  ownerName?: string;
  ownerPhone?: string;
  onBack: () => void;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const makeStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    centerBox: { flex: 1, alignItems: "center", justifyContent: "center" },
    // Setup screen
    setupContainer: {
      padding: spacing["2xl"],
      gap: spacing.lg,
    },
    setupIcon: { fontSize: 52, textAlign: "center" },
    setupTitle: {
      fontSize: fontSize.h2,
      fontWeight: fontWeight.bold,
      color: colors.white,
      textAlign: "center",
    },
    setupDesc: {
      fontSize: fontSize.body,
      color: colors.gray[400],
      textAlign: "center",
      lineHeight: 22,
      marginBottom: spacing.sm,
    },
    // Week nav
    weekNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    navArrow: { padding: spacing.sm },
    navArrowText: { fontSize: 26, color: colors.brand[400], lineHeight: 28 },
    weekLabel: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.gray[400] },
    weekRow: { maxHeight: 80 },
    dayItem: {
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.body || 14,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.gray[700],
      backgroundColor: colors.dark[800] + "cc",
      minWidth: 54,
    },
    dayItemActive: {
      borderColor: colors.brand[400],
      backgroundColor: colors.brand[500] + "20",
    },
    dayWeekday: { fontSize: fontSize.micro, color: colors.gray[400] },
    dayNum: { fontSize: fontSize.h2 - 2, fontWeight: fontWeight.bold, color: colors.white, marginTop: 2 },
    dayTextActive: { color: colors.brand[400] },
    todayDot: {
      width: spacing.xs, height: spacing.xs, borderRadius: 2,
      backgroundColor: colors.gray[400], marginTop: spacing.xs,
    },
    todayDotActive: { backgroundColor: colors.brand[500] },
    calToggle: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    calToggleText: { fontSize: fontSize.bodySmall, color: colors.brand[400] },
    calBox: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      backgroundColor: colors.dark[800] + "cc",
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.gray[700] + "60",
      padding: spacing.md,
    },
    calHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    calNavText: { fontSize: 22, color: colors.brand[400], paddingHorizontal: spacing.sm },
    calMonthLabel: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.white },
    calGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    calWeekdayHeader: {
      width: "14.28%",
      textAlign: "center",
      fontSize: fontSize.micro,
      color: colors.gray[500],
      paddingVertical: spacing.xs,
    },
    calCell: {
      width: "14.28%",
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 20,
    },
    calCellActive: { backgroundColor: colors.brand[500] },
    calCellToday: { borderWidth: 1, borderColor: colors.brand[400] },
    calDayText: { fontSize: fontSize.bodySmall, color: colors.white },
    calDayTextActive: { color: colors.dark[900], fontWeight: fontWeight.bold },
    calDayTextToday: { color: colors.brand[400], fontWeight: fontWeight.bold },
    dateHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    dateTitle: {
      fontSize: fontSize.body + 1,
      fontWeight: fontWeight.semibold,
      color: colors.white,
      textTransform: "capitalize",
    },
    actionRow: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    actionBtn: {
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    actionBtnRed: {
      backgroundColor: feedback.error + "15",
      borderWidth: 1,
      borderColor: feedback.error + "50",
    },
    actionBtnGreen: {
      backgroundColor: feedback.success + "15",
      borderWidth: 1,
      borderColor: feedback.success + "50",
    },
    actionBtnText: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.white },
    slotsContainer: { paddingHorizontal: spacing.lg },
    slotsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    slotChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      minWidth: 80,
      justifyContent: "center",
    },
    slotFree: {
      backgroundColor: feedback.success + "15",
      borderColor: feedback.success + "50",
    },
    slotBlocked: {
      backgroundColor: feedback.error + "10",
      borderColor: feedback.error + "40",
    },
    slotBooked: {
      backgroundColor: colors.brand[500] + "15",
      borderColor: colors.brand[500] + "50",
    },
    slotTime: { fontSize: fontSize.body, fontWeight: fontWeight.semibold },
    slotTimeFree: { color: feedback.success },
    slotTimeBlocked: { color: feedback.error },
    slotTimeBooked: { color: colors.brand[400] },
    slotBadge: { fontSize: fontSize.micro },
    emptyText: { color: colors.gray[500], textAlign: "center", marginTop: 30 },
    legend: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.xl,
      marginTop: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendDot: {
      width: spacing.md, height: spacing.md, borderRadius: 6, borderWidth: 1,
    },
    legendText: { fontSize: fontSize.caption, color: colors.gray[400] },
  });

export default function AvailabilityScreen({ token, role, ownerName, ownerPhone, onBack }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  // Para donos: barberId do seu perfil de barbeiro (null = ainda não criou)
  const [ownerBarberId, setOwnerBarberId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(role === "owner");

  // Setup form para donos sem perfil
  const [setupName, setSetupName] = useState(ownerName || "");
  const [setupPhone, setSetupPhone] = useState(ownerPhone || "");
  const [setupPassword, setSetupPassword] = useState("");
  const [creatingProfile, setCreatingProfile] = useState(false);

  // Semana atual: começa na segunda-feira da semana corrente
  const getWeekStart = (base: Date) => {
    const d = new Date(base);
    d.setHours(12, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  };

  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [selectedDate, setSelectedDate] = useState(toDateStr(today));
  const [slotData, setSlotData] = useState<SlotData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Calendário mini
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [showCal, setShowCal] = useState(false);

  // Para donos: busca o perfil de barbeiro existente ao montar
  useEffect(() => {
    if (role !== "owner") return;
    (async () => {
      try {
        const res = await api.getOwnerBarberProfile(token);
        if (res.barber) setOwnerBarberId(res.barber.id);
      } catch {
        // sem perfil
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [token, role]);

  // barberId efetivo: para barbeiros é undefined (API usa userId do JWT), para donos é ownerBarberId
  const effectiveBarberId = role === "owner" ? ownerBarberId ?? undefined : undefined;

  const fetchSlots = useCallback(async (date: string) => {
    if (role === "owner" && !ownerBarberId) return;
    setLoading(true);
    try {
      const data = await api.getBlockedSlots(token, date, effectiveBarberId);
      setSlotData(data);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar os horários");
    } finally {
      setLoading(false);
    }
  }, [token, effectiveBarberId, role, ownerBarberId]);

  useEffect(() => {
    if (role === "owner" && !ownerBarberId) return;
    fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots, ownerBarberId]);

  const handleCreateProfile = async () => {
    if (!setupName.trim() || !setupPhone.trim() || !setupPassword.trim()) {
      Alert.alert("Atenção", "Preencha todos os campos");
      return;
    }
    if (setupPassword.length < 6) {
      Alert.alert("Atenção", "A senha deve ter ao menos 6 caracteres");
      return;
    }
    setCreatingProfile(true);
    try {
      const res = await api.createOwnerBarberProfile(token, {
        name: setupName.trim(),
        phone: setupPhone.trim(),
        password: setupPassword,
      });
      setOwnerBarberId(res.barber.id);
    } catch (e: unknown) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível criar o perfil");
    } finally {
      setCreatingProfile(false);
    }
  };

  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handleSelectDate = (date: Date) => {
    const str = toDateStr(date);
    setSelectedDate(str);
    setSlotData(null);
  };

  const toggleSlot = async (time: string) => {
    if (!slotData) return;
    if (slotData.booked.includes(time)) return;

    setSaving(true);
    try {
      const isBlocked = slotData.blocked.includes(time);
      if (isBlocked) {
        await api.unblockSlots(token, selectedDate, [time], effectiveBarberId);
        setSlotData((prev) => prev ? { ...prev, blocked: prev.blocked.filter((t) => t !== time), allDay: false } : prev);
      } else {
        await api.blockSlots(token, selectedDate, [time], effectiveBarberId);
        setSlotData((prev) => prev ? { ...prev, blocked: [...prev.blocked, time] } : prev);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível atualizar o horário");
    } finally {
      setSaving(false);
    }
  };

  const handleBlockAllDay = async () => {
    if (!slotData) return;
    const hasBooked = slotData.booked.length > 0;
    if (hasBooked) {
      Alert.alert(
        "Atenção",
        `Há ${slotData.booked.length} agendamento(s) neste dia. Deseja bloquear os horários disponíveis mesmo assim?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Bloquear", style: "destructive", onPress: () => doBlockAllDay() },
        ]
      );
    } else {
      doBlockAllDay();
    }
  };

  const doBlockAllDay = async () => {
    setSaving(true);
    try {
      await api.blockAllDay(token, selectedDate, effectiveBarberId);
      setSlotData((prev) => prev ? { ...prev, allDay: true, blocked: [...prev.allSlots] } : prev);
    } catch {
      Alert.alert("Erro", "Não foi possível bloquear o dia");
    } finally {
      setSaving(false);
    }
  };

  const handleUnblockAllDay = async () => {
    setSaving(true);
    try {
      await api.unblockAllDay(token, selectedDate, effectiveBarberId);
      setSlotData((prev) => prev ? { ...prev, allDay: false, blocked: [] } : prev);
    } catch {
      Alert.alert("Erro", "Não foi possível desbloquear o dia");
    } finally {
      setSaving(false);
    }
  };

  // Calendário mini
  const getCalDays = () => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d, 12));
    return cells;
  };

  const slotState = (time: string): "booked" | "blocked" | "free" => {
    if (!slotData) return "free";
    if (slotData.booked.includes(time)) return "booked";
    if (slotData.allDay || slotData.blocked.includes(time)) return "blocked";
    return "free";
  };

  const allBlocked = slotData ? slotData.allDay || slotData.allSlots.every(
    (t) => slotData.blocked.includes(t) || slotData.booked.includes(t)
  ) : false;

  // Carregando perfil do dono
  if (loadingProfile) {
    return (
      <ScreenBackground>
        <ScreenHeader title="Minha Agenda" onBack={onBack} />
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.brand[400]} size="large" />
        </View>
      </ScreenBackground>
    );
  }

  // Dono sem perfil de barbeiro — tela de setup
  if (role === "owner" && !ownerBarberId) {
    return (
      <ScreenBackground>
        <ScreenHeader title="Minha Agenda" onBack={onBack} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.setupContainer}>
          <Text style={styles.setupIcon}>✂️</Text>
          <Text style={styles.setupTitle}>Configure sua agenda</Text>
          <Text style={styles.setupDesc}>
            Para gerenciar sua própria disponibilidade como barbeiro, crie seu perfil profissional.
            Ele não aparecerá na lista de barbeiros — é exclusivo para você.
          </Text>

          <AppInput
            label="Seu nome"
            value={setupName}
            onChangeText={setSetupName}
            placeholder="Ex: Rogério Silva"
          />

          <AppInput
            label="Seu telefone"
            value={setupPhone}
            onChangeText={setSetupPhone}
            placeholder="(11) 99999-9999"
            keyboardType="phone-pad"
          />

          <AppInput
            label="Senha para login como barbeiro"
            value={setupPassword}
            onChangeText={setSetupPassword}
            placeholder="Mínimo 6 caracteres"
            secureTextEntry
          />

          <AppButton
            title="Criar meu perfil"
            onPress={handleCreateProfile}
            loading={creatingProfile}
            disabled={creatingProfile}
            size="lg"
            style={{ marginTop: spacing.sm }}
          />
        </ScrollView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScreenHeader title="Minha Agenda" onBack={onBack} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Navegação semanal */}
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={() => setWeekStart((w) => addDays(w, -7))} style={styles.navArrow}>
            <Text style={styles.navArrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.weekLabel}>
            {weekStart.getDate()}/{weekStart.getMonth() + 1} – {addDays(weekStart, 6).getDate()}/{addDays(weekStart, 6).getMonth() + 1}
          </Text>
          <TouchableOpacity onPress={() => setWeekStart((w) => addDays(w, 7))} style={styles.navArrow}>
            <Text style={styles.navArrowText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 7 dias da semana */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekRow} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {week.map((d) => {
            const str = toDateStr(d);
            const active = str === selectedDate;
            const isToday = str === toDateStr(today);
            return (
              <TouchableOpacity
                key={str}
                onPress={() => handleSelectDate(d)}
                style={[styles.dayItem, active && styles.dayItemActive]}
              >
                <Text style={[styles.dayWeekday, active && styles.dayTextActive]}>
                  {WEEKDAYS[d.getDay()]}
                </Text>
                <Text style={[styles.dayNum, active && styles.dayTextActive]}>
                  {d.getDate()}
                </Text>
                {isToday && <View style={[styles.todayDot, active && styles.todayDotActive]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Botão mini calendário */}
        <TouchableOpacity style={styles.calToggle} onPress={() => setShowCal((v) => !v)}>
          <Text style={styles.calToggleText}>{showCal ? "▲ Fechar calendário" : "▼ Abrir calendário"}</Text>
        </TouchableOpacity>

        {/* Mini calendário */}
        {showCal && (
          <View style={styles.calBox}>
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
                <Text style={styles.calNavText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.calMonthLabel}>
                {MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}
              </Text>
              <TouchableOpacity onPress={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
                <Text style={styles.calNavText}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.calGrid}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={styles.calWeekdayHeader}>{w}</Text>
              ))}
              {getCalDays().map((d, i) => {
                if (!d) return <View key={`empty-${i}`} style={styles.calCell} />;
                const str = toDateStr(d);
                const active = str === selectedDate;
                const isToday = str === toDateStr(today);
                return (
                  <TouchableOpacity
                    key={str}
                    style={[styles.calCell, active && styles.calCellActive, isToday && !active && styles.calCellToday]}
                    onPress={() => {
                      handleSelectDate(d);
                      setWeekStart(getWeekStart(d));
                      setShowCal(false);
                    }}
                  >
                    <Text style={[styles.calDayText, active && styles.calDayTextActive, isToday && !active && styles.calDayTextToday]}>
                      {d.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Data selecionada + ações */}
        <View style={styles.dateHeader}>
          <Text style={styles.dateTitle}>
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", {
              weekday: "long", day: "2-digit", month: "long",
            })}
          </Text>
          {saving && <ActivityIndicator size="small" color={colors.brand[400]} />}
        </View>

        {/* Botões de ação do dia */}
        {slotData && !loading && (
          <View style={styles.actionRow}>
            {allBlocked ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnGreen]}
                onPress={handleUnblockAllDay}
                disabled={saving}
              >
                <Text style={styles.actionBtnText}>✓ Liberar dia todo</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnRed]}
                onPress={handleBlockAllDay}
                disabled={saving}
              >
                <Text style={styles.actionBtnText}>✕ Bloquear dia todo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Slots */}
        <View style={styles.slotsContainer}>
          {loading ? (
            <ActivityIndicator color={colors.brand[400]} style={{ marginTop: 30 }} />
          ) : !slotData ? null : slotData.allSlots.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum horário disponível neste dia</Text>
          ) : (
            <View style={styles.slotsGrid}>
              {slotData.allSlots.map((time) => {
                const state = slotState(time);
                return (
                  <TouchableOpacity
                    key={time}
                    onPress={() => toggleSlot(time)}
                    disabled={state === "booked" || saving}
                    style={[
                      styles.slotChip,
                      state === "free" && styles.slotFree,
                      state === "blocked" && styles.slotBlocked,
                      state === "booked" && styles.slotBooked,
                    ]}
                  >
                    <Text style={[
                      styles.slotTime,
                      state === "free" && styles.slotTimeFree,
                      state === "blocked" && styles.slotTimeBlocked,
                      state === "booked" && styles.slotTimeBooked,
                    ]}>
                      {time}
                    </Text>
                    {state === "booked" && <Text style={styles.slotBadge}>ag</Text>}
                    {state === "blocked" && <Text style={styles.slotBadge}>🔒</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Legenda */}
        {slotData && !loading && (
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: feedback.success + "30", borderColor: feedback.success }]} />
              <Text style={styles.legendText}>Livre</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: feedback.error + "20", borderColor: feedback.error }]} />
              <Text style={styles.legendText}>Bloqueado</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.brand[500] + "20", borderColor: colors.brand[500] }]} />
              <Text style={styles.legendText}>Agendado</Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenBackground>
  );
}
