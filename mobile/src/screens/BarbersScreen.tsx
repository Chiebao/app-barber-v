import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useColors } from "../utils/useColors";
import { api } from "../services/api";
import { ScreenBackground, ScreenHeader, AppInput, AppButton, AppCard, AppAlert } from "../components";
import type { AlertButton } from "../components/AppAlert";
import { fontSize, fontWeight, spacing, radius, feedback } from "../utils/tokens";

interface Barber {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  role: "barber" | "owner";
  commission: number;
}

interface Props {
  token: string;
  onBack: () => void;
}

const makeStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    content: { padding: spacing.lg, paddingBottom: 40 },
    cardTitle: {
      fontSize: fontSize.body + 1,
      fontWeight: fontWeight.semibold,
      color: colors.white,
      marginBottom: spacing.xs,
    },
    sectionTitle: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.semibold,
      color: colors.gray[400],
      marginBottom: spacing.md,
    },
    emptyText: { color: colors.gray[500], textAlign: "center", marginTop: spacing.xl },
    barberCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.dark[800] + "cc",
      borderRadius: radius.lg - 2,
      padding: 14,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.gray[700] + "60",
      gap: spacing.md,
    },
    barberCardInactive: { opacity: 0.5 },
    barberAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.brand[500] + "30",
      alignItems: "center",
      justifyContent: "center",
    },
    barberAvatarText: { color: colors.brand[400], fontWeight: fontWeight.bold, fontSize: fontSize.h2 - 2 },
    barberInfo: { flex: 1 },
    barberNameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    barberName: { color: colors.white, fontWeight: fontWeight.semibold, fontSize: fontSize.body + 1 },
    barberPhone: { color: colors.gray[400], fontSize: fontSize.bodySmall, marginTop: 2 },
    textMuted: { color: colors.gray[500] },
    roleBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.sm,
      backgroundColor: colors.gray[700] + "60",
      borderWidth: 1,
      borderColor: colors.gray[600],
    },
    roleBadgeOwner: {
      backgroundColor: colors.brand[500] + "20",
      borderColor: colors.brand[500] + "60",
    },
    roleBadgeText: { fontSize: fontSize.micro, color: colors.gray[400] },
    roleBadgeTextOwner: { color: colors.brand[400] },
    roleToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.dark[900] + "cc",
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.gray[700],
    },
    roleToggleInfo: { flex: 1, marginRight: spacing.md },
    roleToggleLabel: { fontSize: fontSize.body + 1, fontWeight: fontWeight.semibold, color: colors.white },
    roleToggleSub: { fontSize: fontSize.micro, color: colors.gray[500], marginTop: 2 },
  });

export default function BarbersScreen({ token, onBack }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<"barber" | "owner">("barber");
  const [newCommission, setNewCommission] = useState("");
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingCommission, setEditingCommission] = useState<string | null>(null);
  const [editCommissionValue, setEditCommissionValue] = useState("");
  const [appAlert, setAppAlert] = useState<{ title: string; message?: string; buttons?: AlertButton[] } | null>(null);
  const showAlert = (title: string, message?: string, buttons?: AlertButton[]) => setAppAlert({ title, message, buttons });

  const fetchBarbers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBarbers(token);
      setBarbers(data.barbers || []);
    } catch {
      showAlert("Erro", "Não foi possível carregar os barbeiros");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBarbers();
  }, [fetchBarbers]);

  const handleAdd = async () => {
    if (!name.trim() || !phone.trim() || password.length < 6) {
      showAlert("Atenção", "Preencha todos os campos (senha mínimo 6 caracteres)");
      return;
    }
    setAdding(true);
    try {
      await api.addBarber(token, {
        name: name.trim(),
        phone: phone.replace(/\D/g, ""),
        password,
        role: newRole,
        commission: Number(newCommission) || 0,
      });
      setName("");
      setPhone("");
      setPassword("");
      setNewRole("barber");
      setNewCommission("");
      fetchBarbers();
    } catch {
      showAlert("Erro", "Não foi possível adicionar o barbeiro");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (barberId: string, active: boolean) => {
    setTogglingId(barberId);
    try {
      await api.toggleBarber(token, barberId, active);
      setBarbers((prev) =>
        prev.map((b) => (b.id === barberId ? { ...b, active } : b))
      );
    } catch {
      showAlert("Erro", "Não foi possível atualizar o barbeiro");
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaveCommission = async (barberId: string) => {
    const val = Math.min(100, Math.max(0, Number(editCommissionValue) || 0));
    setTogglingId(barberId);
    try {
      await api.updateBarberCommission(token, barberId, val);
      setBarbers((prev) => prev.map((b) => (b.id === barberId ? { ...b, commission: val } : b)));
    } catch {
      showAlert("Erro", "Não foi possível atualizar a comissão");
    } finally {
      setTogglingId(null);
      setEditingCommission(null);
    }
  };

  const handleToggleRole = async (barberId: string, currentRole: "barber" | "owner") => {
    const newBarberRole = currentRole === "owner" ? "barber" : "owner";
    const label = newBarberRole === "owner" ? "Dono" : "Barbeiro";
    showAlert(
      "Alterar permissão",
      `Deseja tornar este profissional "${label}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            setTogglingId(barberId);
            try {
              await api.updateBarberRole(token, barberId, newBarberRole);
              setBarbers((prev) =>
                prev.map((b) => (b.id === barberId ? { ...b, role: newBarberRole } : b))
              );
            } catch {
              showAlert("Erro", "Não foi possível alterar a permissão");
            } finally {
              setTogglingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScreenHeader title="Barbeiros" onBack={onBack} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Formulário de adição */}
          <AppCard style={{ marginBottom: spacing.xl, gap: spacing.md }}>
            <Text style={styles.cardTitle}>Adicionar Barbeiro</Text>
            <AppInput
              placeholder="Nome *"
              value={name}
              onChangeText={setName}
            />
            <AppInput
              placeholder="Telefone com DDD *"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <AppInput
              placeholder="Senha (mín. 6 caracteres) *"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <AppInput
              placeholder="Comissão % (ex: 40)"
              value={newCommission}
              onChangeText={(t) => setNewCommission(t.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
            />
            {/* Toggle de permissão */}
            <View style={styles.roleToggleRow}>
              <View style={styles.roleToggleInfo}>
                <Text style={styles.roleToggleLabel}>
                  {newRole === "owner" ? "Dono" : "Barbeiro"}
                </Text>
                <Text style={styles.roleToggleSub}>
                  {newRole === "owner"
                    ? "Acesso total: dashboard, barbeiros, financeiro"
                    : "Acesso: financeiro, fidelidade, produtos, agenda"}
                </Text>
              </View>
              <Switch
                value={newRole === "owner"}
                onValueChange={(val) => setNewRole(val ? "owner" : "barber")}
                trackColor={{ false: colors.gray[700], true: colors.brand[500] }}
                thumbColor={colors.white}
              />
            </View>
            <AppButton
              title={adding ? "Adicionando..." : "Adicionar"}
              onPress={handleAdd}
              loading={adding}
              disabled={adding}
              size="lg"
              style={{ marginTop: spacing.xs }}
            />
          </AppCard>

          {/* Lista de barbeiros */}
          <Text style={styles.sectionTitle}>
            {barbers.length} barbeiro{barbers.length !== 1 ? "s" : ""} cadastrado{barbers.length !== 1 ? "s" : ""}
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.brand[400]} style={{ marginTop: spacing.xl }} />
          ) : barbers.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum barbeiro cadastrado</Text>
          ) : (
            barbers.map((barber) => (
              <View
                key={barber.id}
                style={[styles.barberCard, !barber.active && styles.barberCardInactive]}
              >
                <View style={styles.barberAvatar}>
                  <Text style={styles.barberAvatarText}>
                    {barber.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.barberInfo}>
                  <View style={styles.barberNameRow}>
                    <Text style={[styles.barberName, !barber.active && styles.textMuted]}>
                      {barber.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleToggleRole(barber.id, barber.role)}
                      style={[styles.roleBadge, barber.role === "owner" && styles.roleBadgeOwner]}
                    >
                      <Text style={[styles.roleBadgeText, barber.role === "owner" && styles.roleBadgeTextOwner]}>
                        {barber.role === "owner" ? "Dono" : "Barbeiro"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.barberPhone}>{barber.phone}</Text>
                  {editingCommission === barber.id ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <AppInput
                        placeholder="% comissão"
                        value={editCommissionValue}
                        onChangeText={(t) => setEditCommissionValue(t.replace(/[^0-9]/g, ""))}
                        keyboardType="numeric"
                        containerStyle={{ flex: 1 }}
                      />
                      <TouchableOpacity onPress={() => handleSaveCommission(barber.id)} style={{ backgroundColor: colors.brand[500], borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                        <Text style={{ color: colors.dark[900], fontWeight: "700", fontSize: 12 }}>Salvar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingCommission(null)}>
                        <Text style={{ color: colors.gray[500], fontSize: 12 }}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => { setEditingCommission(barber.id); setEditCommissionValue(String(barber.commission || 0)); }} style={{ marginTop: 4 }}>
                      <Text style={{ color: colors.green, fontSize: fontSize.bodySmall }}>
                        Comissão: {barber.commission || 0}%
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {togglingId === barber.id ? (
                  <ActivityIndicator color={colors.brand[400]} size="small" />
                ) : (
                  <Switch
                    value={barber.active}
                    onValueChange={(val) => handleToggle(barber.id, val)}
                    trackColor={{ false: colors.gray[700], true: colors.brand[500] }}
                    thumbColor={colors.white}
                  />
                )}
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
