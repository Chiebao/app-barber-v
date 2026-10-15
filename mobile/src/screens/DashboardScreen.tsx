import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useColors } from "../utils/useColors";
import { api } from "../services/api";
import { ScreenBackground, ScreenHeader } from "../components";
import { fontSize, fontFamily, fontWeight, spacing, radius } from "../utils/tokens";

interface Props {
  token: string;
  onBack: () => void;
}

interface DashData {
  today: { appointments: number; received: number; expected: number };
  month: {
    appointments: number; revenue: number; toReceive: number;
    avgTicket: number; cancelRate: number;
    revenueGrowth: number | null; aptGrowth: number | null;
    prevRevenue: number; prevApts: number;
  };
  barbers: number;
  totalClients: number;
  avgRating: number | null;
  peakHour: string | null;
  barberStats: { name: string; count: number; revenue: number; commission: number; commissionValue: number; revenueShare: number }[];
}

function fmt(v: number) { return (v ?? 0).toFixed(2); }

function GrowthBadge({ value }: { value: number | null }) {
  const colors = useColors();
  if (value === null) return null;
  const positive = value >= 0;
  return (
    <View style={{
      flexDirection: "row", alignItems: "center",
      backgroundColor: positive ? "#22c55e20" : "#ef444420",
      borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2,
    }}>
      <Text style={{ fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: positive ? "#22c55e" : "#ef4444" }}>
        {positive ? "▲" : "▼"} {Math.abs(value)}%
      </Text>
    </View>
  );
}

function StatCard({ value, label, sub, color }: { value: string; label: string; sub?: string; color?: string }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.statCard, { flex: 1 }]}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    content: { padding: spacing.lg, paddingBottom: 56 },

    // Hero — receita do mês
    heroCard: {
      borderRadius: radius.xl,
      padding: spacing.xl,
      backgroundColor: colors.brand[500] + "18",
      borderWidth: 1,
      borderColor: colors.brand[500] + "40",
      marginBottom: spacing.lg,
    },
    heroLabel: {
      fontSize: fontSize.caption,
      color: colors.gray[400],
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    heroValue: {
      fontFamily: fontFamily.serifBold,
      fontSize: 36,
      color: colors.brand[400],
      lineHeight: 42,
    },
    heroRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
    heroPrev: { fontSize: fontSize.caption, color: colors.gray[500] },

    // Seções
    sectionLabel: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.gray[400],
      textTransform: "uppercase",
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    row: { flexDirection: "row", gap: spacing.sm },

    // Stat cards
    statCard: {
      backgroundColor: colors.dark[800],
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.gray[700] + "60",
    },
    statValue: {
      fontSize: fontSize.h2,
      fontWeight: fontWeight.bold,
      color: colors.white,
      textAlign: "center",
    },
    statLabel: {
      fontSize: fontSize.caption,
      color: colors.gray[400],
      marginTop: spacing.xs,
      textAlign: "center",
    },
    statSub: {
      fontSize: fontSize.micro,
      color: colors.gray[500],
      marginTop: 2,
      textAlign: "center",
    },

    // Dois valores numa linha
    splitCard: {
      backgroundColor: colors.dark[800],
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.gray[700] + "60",
      flexDirection: "row",
      justifyContent: "space-around",
    },
    splitItem: { alignItems: "center", flex: 1 },
    splitValue: { fontSize: fontSize.h3, fontWeight: fontWeight.bold, color: colors.white },
    splitLabel: { fontSize: fontSize.micro, color: colors.gray[400], marginTop: 2 },
    splitDivider: { width: 1, backgroundColor: colors.gray[700] + "60", marginVertical: 4 },

    // Horário de pico
    peakCard: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      backgroundColor: colors.brand[500] + "12",
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.brand[500] + "30",
      marginTop: spacing.sm,
    },
    peakLabel: { fontSize: fontSize.body, color: colors.gray[400] },
    peakValue: { fontSize: fontSize.h3, fontWeight: fontWeight.bold, color: colors.brand[400] },

    // Ranking
    barberCard: {
      backgroundColor: colors.dark[800],
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.gray[700] + "60",
      marginBottom: spacing.sm,
    },
    barberRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
    rankNum: { fontSize: fontSize.h3, fontWeight: fontWeight.bold, color: colors.brand[400], width: 28 },
    barberName: { flex: 1, fontSize: fontSize.bodyLarge, fontWeight: fontWeight.semibold, color: colors.white },
    barberRevenue: { fontSize: fontSize.bodyLarge, fontWeight: fontWeight.bold, color: colors.brand[400] },
    barberSub: { fontSize: fontSize.caption, color: colors.gray[400], marginTop: 1 },
    progressTrack: {
      height: 4, borderRadius: 99, backgroundColor: colors.gray[700] + "60", marginBottom: spacing.xs,
    },
    progressFill: { height: 4, borderRadius: 99, backgroundColor: colors.brand[500] },
    commissionRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
    commissionLabel: { fontSize: fontSize.micro, color: colors.gray[500] },
    commissionValue: { fontSize: fontSize.micro, color: colors.gray[400], fontWeight: fontWeight.semibold },

    // Empty / error
    emptyText: { color: colors.gray[500], textAlign: "center", marginTop: spacing["4xl"] },
    retryBtn: {
      marginTop: spacing.lg, alignSelf: "center",
      backgroundColor: colors.brand[500],
      borderRadius: radius.md,
      paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    },
    retryText: { color: colors.dark[900], fontWeight: fontWeight.bold },
  });
}

export default function DashboardScreen({ token, onBack }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [data, setData]       = useState<DashData | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const r = await api.getDashboard(token);
      setData(r);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const monthName = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  return (
    <ScreenBackground>
      <ScreenHeader title="Dashboard" onBack={onBack} />

      {loading ? (
        <ActivityIndicator color={colors.brand[400]} style={{ marginTop: spacing["4xl"] }} />
      ) : error ? (
        <View style={{ alignItems: "center", marginTop: spacing["4xl"] }}>
          <Text style={styles.emptyText}>Não foi possível carregar os dados</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand[400]} />}
        >
          {/* ── HERO — Receita do mês ──────────────────────────────── */}
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{monthLabel}</Text>
            <Text style={styles.heroValue}>R$ {fmt(data.month.revenue)}</Text>
            <View style={styles.heroRow}>
              <GrowthBadge value={data.month.revenueGrowth} />
              {data.month.revenueGrowth !== null && (
                <Text style={styles.heroPrev}>vs R$ {fmt(data.month.prevRevenue)} mês anterior</Text>
              )}
            </View>
            {data.month.toReceive > 0 && (
              <Text style={[styles.heroPrev, { marginTop: spacing.xs, color: colors.brand[400] + "cc" }]}>
                + R$ {fmt(data.month.toReceive)} a receber
              </Text>
            )}
          </View>

          {/* ── HOJE ─────────────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Hoje</Text>
          <View style={styles.splitCard}>
            <View style={styles.splitItem}>
              <Text style={[styles.splitValue, { color: "#22c55e" }]}>R$ {fmt(data.today.received)}</Text>
              <Text style={styles.splitLabel}>Recebido</Text>
            </View>
            <View style={styles.splitDivider} />
            <View style={styles.splitItem}>
              <Text style={styles.splitValue}>{data.today.appointments}</Text>
              <Text style={styles.splitLabel}>Atendimentos</Text>
            </View>
            <View style={styles.splitDivider} />
            <View style={styles.splitItem}>
              <Text style={[styles.splitValue, { color: colors.brand[400] }]}>R$ {fmt(data.today.expected)}</Text>
              <Text style={styles.splitLabel}>A receber</Text>
            </View>
          </View>

          {/* ── MÊS ──────────────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>{monthLabel}</Text>
          <View style={styles.row}>
            <StatCard
              value={String(data.month.appointments)}
              label="Atendimentos"
              sub={data.month.aptGrowth !== null ? `${data.month.aptGrowth >= 0 ? "+" : ""}${data.month.aptGrowth}% vs anterior` : undefined}
            />
            <StatCard
              value={`R$ ${fmt(data.month.avgTicket)}`}
              label="Ticket médio"
            />
            <StatCard
              value={`${data.month.cancelRate}%`}
              label="Cancelamentos"
              color={data.month.cancelRate > 20 ? "#ef4444" : data.month.cancelRate > 10 ? "#f59e0b" : "#22c55e"}
            />
          </View>

          {/* ── GERAL ────────────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Geral</Text>
          <View style={styles.row}>
            <StatCard value={String(data.totalClients)} label="Clientes únicos" />
            <StatCard value={String(data.barbers)} label="Barbeiros" />
            <StatCard
              value={data.avgRating != null ? `${data.avgRating} ★` : "—"}
              label="Avaliação"
              color={colors.brand[400]}
            />
          </View>

          {/* ── HORÁRIO DE PICO ───────────────────────────────────────── */}
          {data.peakHour && (
            <View style={styles.peakCard}>
              <Text style={styles.peakLabel}>Horário de pico</Text>
              <Text style={styles.peakValue}>{data.peakHour}</Text>
            </View>
          )}

          {/* ── RANKING ──────────────────────────────────────────────── */}
          {data.barberStats.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Ranking do mês</Text>
              {data.barberStats.map((b, i) => (
                <View key={b.name} style={styles.barberCard}>
                  <View style={styles.barberRow}>
                    <Text style={styles.rankNum}>#{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.barberName}>{b.name}</Text>
                      <Text style={styles.barberSub}>{b.count} atendimento{b.count !== 1 ? "s" : ""}</Text>
                    </View>
                    <Text style={styles.barberRevenue}>R$ {fmt(b.revenue)}</Text>
                  </View>

                  {/* Barra de progresso proporcional */}
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(b.revenueShare * 100)}%` }]} />
                  </View>

                  {/* Comissão a pagar */}
                  {b.commission > 0 && (
                    <View style={styles.commissionRow}>
                      <Text style={styles.commissionLabel}>Comissão ({b.commission}%)</Text>
                      <Text style={styles.commissionValue}>R$ {fmt(b.commissionValue)} a pagar</Text>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      ) : null}
    </ScreenBackground>
  );
}
