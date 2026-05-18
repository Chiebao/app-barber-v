import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
  Switch,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useColors } from "../utils/useColors";
import { api, API_BASE } from "../services/api";
import { ScreenBackground, ScreenHeader, AppCard, AppInput, AppButton, AppAlert } from "../components";
import type { AlertButton } from "../components/AppAlert";
import { fontSize, fontWeight, spacing, radius, feedback } from "../utils/tokens";
import { useTheme, PALETTES } from "../context/ThemeContext";

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

interface ShopData {
  id: string;
  name: string;
  slug: string;
  openTime: string;
  closeTime: string;
  workDays: number[];
  avgServiceTime: number;
  pixKey: string | null;
  bookingMode: string;
}

interface Props {
  token: string;
  barber: UserData;
  onBack: () => void;
  onLogout: () => void;
}

const DAYS = [
  { label: "Dom", value: 0 },
  { label: "Seg", value: 1 },
  { label: "Ter", value: 2 },
  { label: "Qua", value: 3 },
  { label: "Qui", value: 4 },
  { label: "Sex", value: 5 },
  { label: "Sáb", value: 6 },
];

const APP_VERSION = "1.0.0";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const makeStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.lg },
    // Profile
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.brand[500] + "30",
      borderWidth: 2,
      borderColor: colors.brand[500],
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: fontSize.h1,
      fontWeight: fontWeight.bold,
      color: colors.brand[400],
    },
    profileName: {
      fontSize: fontSize.h3,
      fontWeight: fontWeight.bold,
      color: colors.white,
      marginBottom: spacing.xs,
    },
    profilePhone: {
      fontSize: fontSize.bodySmall,
      color: colors.gray[400],
      marginBottom: spacing.sm,
    },
    roleBadge: {
      alignSelf: "flex-start",
      backgroundColor: colors.gray[700] + "60",
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 3,
    },
    roleBadgeOwner: { backgroundColor: colors.brand[500] + "20" },
    roleBadgeText: {
      fontSize: fontSize.caption,
      color: colors.white,
      fontWeight: fontWeight.semibold,
    },
    // Card inner
    cardTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cardTitle: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
      color: colors.white,
    },
    cardSubtitle: {
      fontSize: fontSize.bodySmall,
      color: colors.gray[400],
      marginTop: -spacing.xs,
    },
    collapseArrow: {
      fontSize: fontSize.bodySmall,
      color: colors.gray[500],
    },
    // Link
    linkBox: {
      backgroundColor: colors.dark[900] + "cc",
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.gray[700],
    },
    linkText: {
      fontSize: fontSize.bodySmall,
      color: colors.brand[400],
    },
    linkActions: {
      flexDirection: "row",
      gap: spacing.md,
    },
    linkBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: "center",
      backgroundColor: colors.dark[900] + "cc",
      borderWidth: 1,
      borderColor: colors.gray[700],
    },
    linkBtnText: {
      fontSize: fontSize.bodySmall,
      color: colors.white,
      fontWeight: fontWeight.semibold,
    },
    linkBtnShare: {
      backgroundColor: colors.brand[500] + "15",
      borderColor: colors.brand[500] + "50",
    },
    linkBtnShareText: {
      fontSize: fontSize.bodySmall,
      color: colors.brand[400],
      fontWeight: fontWeight.semibold,
    },
    // Form
    row: { flexDirection: "row" },
    daysRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    dayChip: {
      paddingVertical: 7,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.gray[700],
      backgroundColor: colors.dark[900] + "80",
    },
    dayChipActive: {
      borderColor: colors.brand[400],
      backgroundColor: colors.brand[500] + "20",
    },
    dayChipText: {
      fontSize: fontSize.bodySmall,
      color: colors.gray[400],
      fontWeight: fontWeight.semibold,
    },
    dayChipTextActive: { color: colors.brand[400] },
    fieldLabel: {
      fontSize: fontSize.caption,
      color: colors.gray[400],
      fontWeight: fontWeight.semibold,
      marginBottom: spacing.xs,
    },
    // Version
    version: {
      textAlign: "center",
      fontSize: fontSize.caption,
      color: colors.gray[600],
      marginTop: spacing.xs,
    },
  });

const makeThemePickerStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    paletteBtn: {
      width: "30%",
      borderRadius: radius.md,
      borderWidth: 2,
      padding: spacing.md,
      backgroundColor: colors.dark[900] + "cc",
      alignItems: "center",
      gap: spacing.sm,
      position: "relative",
    },
    swatchRow: {
      flexDirection: "row",
      gap: 3,
    },
    swatch: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
    },
    paletteName: {
      fontSize: 9,
      fontWeight: fontWeight.semibold,
      color: colors.gray[400],
      textAlign: "center",
    },
    activeDot: {
      position: "absolute",
      top: spacing.xs,
      right: spacing.xs,
      width: spacing.lg,
      height: spacing.lg,
      borderRadius: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    activeDotText: {
      fontSize: 9,
      color: "#fff",
      fontWeight: fontWeight.bold,
    },
  });

export default function SobreScreen({ token, barber, onBack, onLogout }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const themePickerStyles = useMemo(() => makeThemePickerStyles(colors), [colors]);

  const { palette, setPalette } = useTheme();

  const handleSelectPalette = useCallback(async (id: string) => {
    await setPalette(id);
    // Salva no servidor para o web também refletir o tema
    if (barber.role === "owner") {
      try {
        await api.updateShop(token, { colorTheme: id });
      } catch {
        // falha silenciosa — tema local já foi aplicado
      }
    }
  }, [setPalette, token, barber.role]);
  const [shop, setShop] = useState<ShopData | null>(null);
  const [loadingShop, setLoadingShop] = useState(barber.role === "owner");

  // Shop form
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [workDays, setWorkDays] = useState<number[]>([]);
  const [avgServiceTime, setAvgServiceTime] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [chatbotOn, setChatbotOn] = useState(false);
  const [savingShop, setSavingShop] = useState(false);

  // Password form
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [showPwdForm, setShowPwdForm] = useState(false);

  const bookingLink = `${API_BASE}/${barber.slug}`;
  const [appAlert, setAppAlert] = useState<{ title: string; message?: string; buttons?: AlertButton[] } | null>(null);

  // Excluir conta
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const showAlert = (title: string, message?: string, buttons?: AlertButton[]) => setAppAlert({ title, message, buttons });

  const fetchShop = useCallback(async () => {
    if (barber.role !== "owner") return;
    setLoadingShop(true);
    try {
      const res = await api.getShop(token);
      const s: ShopData = res.shop;
      setShop(s);
      setOpenTime(s.openTime);
      setCloseTime(s.closeTime);
      setWorkDays(s.workDays);
      setAvgServiceTime(String(s.avgServiceTime));
      setPixKey(s.pixKey || "");
      setChatbotOn(s.bookingMode === "agent");
    } catch {
      showAlert("Erro", "Não foi possível carregar dados da barbearia");
    } finally {
      setLoadingShop(false);
    }
  }, [token, barber.role]);

  useEffect(() => {
    fetchShop();
  }, [fetchShop]);

  const toggleDay = (day: number) => {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSaveShop = async () => {
    if (!openTime || !closeTime) {
      showAlert("Atenção", "Preencha horários de abertura e fechamento");
      return;
    }
    if (workDays.length === 0) {
      showAlert("Atenção", "Selecione ao menos um dia de trabalho");
      return;
    }
    const avg = parseInt(avgServiceTime);
    if (isNaN(avg) || avg < 10) {
      showAlert("Atenção", "Tempo médio de serviço inválido (mínimo 10 min)");
      return;
    }
    setSavingShop(true);
    try {
      await api.updateShop(token, { openTime, closeTime, workDays, avgServiceTime: avg, pixKey, bookingMode: chatbotOn ? "agent" : "steps" });
      showAlert("Salvo!", "Configurações da barbearia atualizadas");
    } catch (e: unknown) {
      showAlert("Erro", e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSavingShop(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      showAlert("Atenção", "Preencha todos os campos");
      return;
    }
    if (newPwd.length < 6) {
      showAlert("Atenção", "Nova senha deve ter ao menos 6 caracteres");
      return;
    }
    if (newPwd !== confirmPwd) {
      showAlert("Atenção", "Nova senha e confirmação não coincidem");
      return;
    }
    setSavingPwd(true);
    try {
      await api.changePassword(token, currentPwd, newPwd);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setShowPwdForm(false);
      showAlert("Senha alterada!", "Faça login novamente com a nova senha na próxima vez.");
    } catch (e: unknown) {
      showAlert("Erro", e instanceof Error ? e.message : "Não foi possível alterar a senha");
    } finally {
      setSavingPwd(false);
    }
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(bookingLink);
    showAlert("Copiado!", "Link copiado para a área de transferência");
  };

  const shareLink = async () => {
    await Share.share({
      message: `Agende seu corte na ${barber.shopName}! Acesse: ${bookingLink}`,
    });
  };

  const handleLogout = () => {
    showAlert("Sair", "Deseja encerrar a sessão?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: onLogout },
    ]);
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      showAlert("Atenção", "Digite sua senha para confirmar a exclusão.");
      return;
    }
    setDeletingAccount(true);
    try {
      await api.deleteAccount(token, deletePassword.trim());
      setShowDeleteConfirm(false);
      setDeletePassword("");
      showAlert("Conta excluída", "Sua conta e dados foram removidos permanentemente.", [
        { text: "OK", onPress: onLogout },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir conta";
      showAlert("Erro", msg);
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <ScreenHeader title="Perfil & Config." onBack={onBack} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* Avatar + info */}
          <AppCard>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(barber.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{barber.name}</Text>
                <Text style={styles.profilePhone}>{barber.phone}</Text>
                <View style={[styles.roleBadge, barber.role === "owner" && styles.roleBadgeOwner]}>
                  <Text style={styles.roleBadgeText}>
                    {barber.role === "owner" ? "👑 Dono" : "✂️ Barbeiro"}
                  </Text>
                </View>
              </View>
            </View>
          </AppCard>

          {/* Link de agendamento */}
          <AppCard style={{ gap: spacing.md }}>
            <Text style={styles.cardTitle}>🔗 Link de Agendamento</Text>
            <Text style={styles.cardSubtitle}>{barber.shopName}</Text>
            <View style={styles.linkBox}>
              <Text style={styles.linkText} numberOfLines={1}>{bookingLink}</Text>
            </View>
            <View style={styles.linkActions}>
              <TouchableOpacity style={styles.linkBtn} onPress={copyLink}>
                <Text style={styles.linkBtnText}>📋 Copiar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.linkBtn, styles.linkBtnShare]} onPress={shareLink}>
                <Text style={styles.linkBtnShareText}>↗ Compartilhar</Text>
              </TouchableOpacity>
            </View>
          </AppCard>

          {/* Configurações da barbearia (só owner) */}
          {barber.role === "owner" && (
            <AppCard style={{ gap: spacing.md }}>
              <Text style={styles.cardTitle}>🏪 Configurações da Barbearia</Text>

              {loadingShop ? (
                <ActivityIndicator color={colors.brand[400]} style={{ marginVertical: spacing.xl }} />
              ) : (
                <>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <AppInput
                        label="Abertura"
                        value={openTime}
                        onChangeText={setOpenTime}
                        placeholder="08:00"
                      />
                    </View>
                    <View style={{ width: spacing.md }} />
                    <View style={{ flex: 1 }}>
                      <AppInput
                        label="Fechamento"
                        value={closeTime}
                        onChangeText={setCloseTime}
                        placeholder="20:00"
                      />
                    </View>
                  </View>

                  <Text style={styles.fieldLabel}>Dias de trabalho</Text>
                  <View style={styles.daysRow}>
                    {DAYS.map((d) => {
                      const active = workDays.includes(d.value);
                      return (
                        <TouchableOpacity
                          key={d.value}
                          style={[styles.dayChip, active && styles.dayChipActive]}
                          onPress={() => toggleDay(d.value)}
                        >
                          <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                            {d.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <AppInput
                    label="Tempo médio de serviço (min)"
                    value={avgServiceTime}
                    onChangeText={setAvgServiceTime}
                    keyboardType="number-pad"
                    placeholder="30"
                  />

                  <AppInput
                    label="Chave PIX (opcional)"
                    value={pixKey}
                    onChangeText={setPixKey}
                    placeholder="CPF, CNPJ, e-mail ou telefone"
                    autoCapitalize="none"
                  />

                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: colors.dark[900] + "cc",
                    borderRadius: radius.md,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: chatbotOn ? colors.brand[500] + "60" : colors.gray[700],
                  }}>
                    <View style={{ flex: 1, marginRight: spacing.md }}>
                      <Text style={{ fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.white }}>
                        {chatbotOn ? "🤖 Chatbot ativo" : "📋 Etapas clássico"}
                      </Text>
                      <Text style={{ fontSize: fontSize.micro, color: colors.gray[500], marginTop: 2 }}>
                        {chatbotOn ? "Clientes agendam via conversa com IA" : "Clientes seguem etapas passo a passo"}
                      </Text>
                    </View>
                    <Switch
                      value={chatbotOn}
                      onValueChange={setChatbotOn}
                      trackColor={{ false: colors.gray[700], true: colors.brand[500] }}
                      thumbColor={colors.white}
                    />
                  </View>

                  <AppButton
                    title="Salvar Configurações"
                    onPress={handleSaveShop}
                    loading={savingShop}
                    disabled={savingShop}
                  />
                </>
              )}
            </AppCard>
          )}

          {/* Alterar senha */}
          <AppCard style={{ gap: spacing.md }}>
            <TouchableOpacity
              style={styles.cardTitleRow}
              onPress={() => setShowPwdForm((v) => !v)}
            >
              <Text style={styles.cardTitle}>🔑 Alterar Senha</Text>
              <Text style={styles.collapseArrow}>{showPwdForm ? "▲" : "▼"}</Text>
            </TouchableOpacity>

            {showPwdForm && (
              <>
                <AppInput
                  label="Senha atual"
                  value={currentPwd}
                  onChangeText={setCurrentPwd}
                  secureTextEntry
                  placeholder="••••••"
                />
                <AppInput
                  label="Nova senha"
                  value={newPwd}
                  onChangeText={setNewPwd}
                  secureTextEntry
                  placeholder="Mínimo 6 caracteres"
                />
                <AppInput
                  label="Confirmar nova senha"
                  value={confirmPwd}
                  onChangeText={setConfirmPwd}
                  secureTextEntry
                  placeholder="Repita a nova senha"
                />
                <AppButton
                  title="Alterar Senha"
                  onPress={handleChangePassword}
                  loading={savingPwd}
                  disabled={savingPwd}
                />
              </>
            )}
          </AppCard>

          {/* Paletas de cor */}
          <AppCard style={{ gap: spacing.md }}>
            <Text style={styles.cardTitle}>🎨 Paleta de Cores</Text>
            <Text style={[styles.cardSubtitle, { marginBottom: spacing.md }]}>Personalize o visual do app</Text>
            <View style={themePickerStyles.grid}>
              {PALETTES.map((p) => {
                const isActive = palette.id === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      themePickerStyles.paletteBtn,
                      { borderColor: isActive ? p.brand : "transparent" },
                    ]}
                    onPress={() => handleSelectPalette(p.id)}
                    activeOpacity={0.8}
                  >
                    {/* Preview das 3 cores principais */}
                    <View style={themePickerStyles.swatchRow}>
                      <View style={[themePickerStyles.swatch, { backgroundColor: p.bgPrimary }]} />
                      <View style={[themePickerStyles.swatch, { backgroundColor: p.brand }]} />
                      <View style={[themePickerStyles.swatch, { backgroundColor: p.bgSecondary }]} />
                    </View>
                    <Text style={themePickerStyles.paletteName}>{p.name}</Text>
                    {isActive && (
                      <View style={[themePickerStyles.activeDot, { backgroundColor: p.brand }]}>
                        <Text style={themePickerStyles.activeDotText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </AppCard>

          {/* Sair */}
          <AppButton
            title="Sair da conta"
            variant="destructive"
            onPress={handleLogout}
          />

          {/* Excluir conta */}
          {!showDeleteConfirm ? (
            <TouchableOpacity
              onPress={() => setShowDeleteConfirm(true)}
              style={{ alignSelf: "center", paddingVertical: spacing.md }}
            >
              <Text style={{ color: colors.error, fontSize: fontSize.bodySmall, textDecorationLine: "underline" }}>
                Excluir minha conta
              </Text>
            </TouchableOpacity>
          ) : (
            <AppCard style={{ gap: spacing.md, borderColor: colors.error + "40", borderWidth: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.error }]}>Excluir conta permanentemente</Text>
              <Text style={styles.cardSubtitle}>
                {barber.role === "owner"
                  ? "Isso excluirá sua barbearia, barbeiros, serviços e todos os agendamentos. Essa ação não pode ser desfeita."
                  : "Seus dados pessoais serão removidos e sua conta desativada. Essa ação não pode ser desfeita."}
              </Text>
              <AppInput
                label="Confirme sua senha"
                value={deletePassword}
                onChangeText={setDeletePassword}
                secureTextEntry
                placeholder="Digite sua senha"
              />
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <AppButton
                    title="Cancelar"
                    variant="secondary"
                    onPress={() => { setShowDeleteConfirm(false); setDeletePassword(""); }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AppButton
                    title={deletingAccount ? "Excluindo..." : "Excluir"}
                    variant="destructive"
                    onPress={handleDeleteAccount}
                    disabled={deletingAccount}
                  />
                </View>
              </View>
            </AppCard>
          )}

          {/* Versão */}
          <Text style={styles.version}>BarberPro v{APP_VERSION}</Text>

          <View style={{ height: spacing["4xl"] }} />
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
