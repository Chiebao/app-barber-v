import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useColors } from "../utils/useColors";
import { api } from "../services/api";
import { ScreenBackground, ScreenHeader } from "../components";
import { fontSize, fontFamily, fontWeight, spacing, radius } from "../utils/tokens";

interface ClientItem {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  noShowCount: number;
  firstDate: string;
  totalAppointments: number;
}

interface Props {
  token: string;
  onBack: () => void;
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    content: { padding: spacing.lg, paddingBottom: 56 },
    searchBar: {
      backgroundColor: colors.dark[800],
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.body,
      color: colors.white,
      borderWidth: 1,
      borderColor: colors.gray[700] + "60",
      marginBottom: spacing.lg,
    },
    statsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.dark[800],
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.gray[700] + "60",
    },
    statValue: {
      fontSize: fontSize.h2,
      fontFamily: fontFamily.serifBold,
      color: colors.brand[400],
    },
    statLabel: {
      fontSize: fontSize.micro,
      color: colors.gray[400],
      marginTop: 2,
      textAlign: "center",
    },
    card: {
      backgroundColor: colors.dark[800],
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.gray[700] + "60",
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.brand[500] + "30",
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    avatarText: {
      fontSize: fontSize.h3,
      fontWeight: fontWeight.bold,
      color: colors.brand[400],
    },
    cardLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
    cardInfo: { flex: 1 },
    clientName: {
      fontSize: fontSize.bodyLarge,
      fontWeight: fontWeight.semibold,
      color: colors.white,
    },
    clientPhone: {
      fontSize: fontSize.caption,
      color: colors.gray[400],
      marginTop: 2,
    },
    countBadge: {
      backgroundColor: colors.brand[500] + "20",
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      alignItems: "center",
    },
    countNum: {
      fontSize: fontSize.h3,
      fontWeight: fontWeight.bold,
      color: colors.brand[400],
    },
    countLabel: {
      fontSize: fontSize.micro,
      color: colors.brand[400] + "aa",
    },
    cardMeta: {
      flexDirection: "row",
      marginTop: spacing.sm,
      gap: spacing.lg,
    },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: fontSize.micro, color: colors.gray[500] },
    noShowBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#ef444420",
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    noShowText: { fontSize: fontSize.micro, color: "#ef4444" },
    emptyText: {
      color: colors.gray[500],
      textAlign: "center",
      marginTop: spacing["4xl"],
    },
  });
}

export default function ClientsScreen({ token, onBack }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await api.getClients(token);
      setClients(data.clients || []);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [clients, search]);

  const totalVisits = useMemo(() => clients.reduce((s, c) => s + c.totalAppointments, 0), [clients]);

  const formatDate = (iso: string) => {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  };

  const initials = (name: string) => {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  return (
    <ScreenBackground>
      <ScreenHeader title="Clientes" onBack={onBack} />

      {loading ? (
        <ActivityIndicator color={colors.brand[400]} style={{ marginTop: spacing["4xl"] }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.brand[400]} />}
        >
          {/* Resumo */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{clients.length}</Text>
              <Text style={styles.statLabel}>Clientes únicos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalVisits}</Text>
              <Text style={styles.statLabel}>Total de cortes</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {clients.length > 0 ? (totalVisits / clients.length).toFixed(1) : "0"}
              </Text>
              <Text style={styles.statLabel}>Média por cliente</Text>
            </View>
          </View>

          {/* Busca */}
          <TextInput
            style={styles.searchBar}
            placeholder="Buscar por nome ou telefone..."
            placeholderTextColor={colors.gray[500]}
            value={search}
            onChangeText={setSearch}
          />

          {/* Lista */}
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>
              {search ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
            </Text>
          ) : (
            filtered.map((c) => (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardLeft}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials(c.name)}</Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.clientName}>{c.name}</Text>
                      <Text style={styles.clientPhone}>{c.phone}</Text>
                    </View>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countNum}>{c.totalAppointments}</Text>
                    <Text style={styles.countLabel}>corte{c.totalAppointments !== 1 ? "s" : ""}</Text>
                  </View>
                </View>

                <View style={styles.cardMeta}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaText}>Desde {formatDate(c.firstDate)}</Text>
                  </View>
                  {c.noShowCount > 0 && (
                    <View style={styles.noShowBadge}>
                      <Text style={styles.noShowText}>{c.noShowCount} no-show{c.noShowCount !== 1 ? "s" : ""}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </ScreenBackground>
  );
}
