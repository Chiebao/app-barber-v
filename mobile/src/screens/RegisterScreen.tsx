import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Image,
} from "react-native";
import { useColors } from "../utils/useColors";
import { api } from "../services/api";
import { fontSize, fontWeight, spacing, radius, feedback } from "../utils/tokens";
import { ScreenBackground, AppButton, AppInput } from "../components";

interface Props {
  onRegister: (token: string, barber: Record<string, unknown>) => void;
  onGoToLogin: () => void;
}

const CUTS = [
  { name: "Degrade", category: "corte", duration: 30, price: 35 },
  { name: "Americano", category: "corte", duration: 30, price: 35 },
  { name: "Fade", category: "corte", duration: 40, price: 40 },
  { name: "Social", category: "corte", duration: 25, price: 30 },
  { name: "Moicano", category: "corte", duration: 35, price: 38 },
  { name: "Disfarçado", category: "corte", duration: 30, price: 35 },
];

const WEEKDAYS = [
  { label: "Dom", value: 0 },
  { label: "Seg", value: 1 },
  { label: "Ter", value: 2 },
  { label: "Qua", value: 3 },
  { label: "Qui", value: 4 },
  { label: "Sex", value: 5 },
  { label: "Sab", value: 6 },
];

const makeStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { padding: spacing["2xl"], paddingTop: spacing.screenTop },
    logoImg: {
      width: 110,
      height: 142,
      alignSelf: "center",
    },
    subtitle: {
      fontSize: fontSize.bodyLarge,
      color: colors.gray[400],
      textAlign: "center",
      marginTop: spacing.sm,
      marginBottom: spacing["2xl"],
    },
    progress: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing["2xl"],
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.gray[700],
    },
    dotActive: { backgroundColor: colors.brand[500] },
    line: { width: 60, height: 2, backgroundColor: colors.gray[700] },
    lineActive: { backgroundColor: colors.brand[500] },
    form: { gap: spacing.md },
    input: {
      backgroundColor: colors.dark[800],
      borderWidth: 1,
      borderColor: colors.gray[700],
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      color: colors.white,
      fontSize: fontSize.bodyLarge,
    },
    inputHalf: { flex: 1 },
    row: { flexDirection: "row", gap: spacing.md },
    inputWrapper: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.dark[800],
      borderWidth: 1,
      borderColor: colors.gray[700],
      borderRadius: radius.md,
      overflow: "hidden",
    },
    inputPrefix: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 14,
      backgroundColor: colors.dark[700] ?? colors.dark[800],
      borderRightWidth: 1,
      borderRightColor: colors.gray[700],
      alignItems: "center",
      minWidth: 42,
      justifyContent: "center",
    },
    inputPrefixText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
      color: colors.brand[400],
    },
    inputInner: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      color: colors.white,
      fontSize: fontSize.bodyLarge,
    },
    label: {
      fontSize: fontSize.body,
      color: colors.gray[400],
      marginTop: spacing.sm,
      marginBottom: 4,
    },
    daysRow: { flexDirection: "row", gap: spacing.sm },
    dayButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.gray[700],
      alignItems: "center",
    },
    dayButtonActive: {
      backgroundColor: colors.brand[500] + "20",
      borderColor: colors.brand[400],
    },
    dayText: { fontSize: fontSize.caption, color: colors.gray[400] },
    dayTextActive: { color: colors.brand[400] },
    cutsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    cutCard: {
      width: "48%" as unknown as number,
      padding: 14,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.gray[700],
      backgroundColor: colors.dark[800],
    },
    cutCardActive: {
      borderColor: colors.brand[400],
      backgroundColor: colors.brand[500] + "15",
    },
    cutName: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.white },
    cutNameActive: { color: colors.brand[400] },
    cutInfo: { fontSize: fontSize.caption, color: colors.gray[400], marginTop: 4 },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.gray[700] + "50",
      marginTop: spacing.sm,
    },
    switchLabel: { fontSize: fontSize.bodyLarge, color: colors.white },
    errorBox: {
      backgroundColor: feedback.errorBg,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: feedback.error,
    },
    errorText: {
      color: feedback.error,
      fontSize: fontSize.bodySmall,
      textAlign: "center",
    },
    linkButton: { alignItems: "center", marginTop: spacing["2xl"], paddingBottom: 40 },
  });

export default function RegisterScreen({ onRegister, onGoToLogin }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [step1Error, setStep1Error] = useState("");

  // Step 1: Dados basicos
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("20:00");
  const [workDays, setWorkDays] = useState([1, 2, 3, 4, 5, 6]);

  // Step 2: Servicos
  const [selectedCuts, setSelectedCuts] = useState<typeof CUTS>([]);
  const [fazBarba, setFazBarba] = useState(false);
  const [tempoBarba, setTempoBarba] = useState("20");
  const [precoBarba, setPrecoBarba] = useState("25");
  const [fazSobrancelha, setFazSobrancelha] = useState(false);
  const [tempoSobrancelha, setTempoSobrancelha] = useState("15");
  const [precoSobrancelha, setPrecoSobrancelha] = useState("15");
  const [fazPezinho, setFazPezinho] = useState(false);
  const [precoPezinho, setPrecoPezinho] = useState("10");
  const [fazLuzes, setFazLuzes] = useState(false);
  const [tipoLuzes, setTipoLuzes] = useState("");
  const [tempoLuzes, setTempoLuzes] = useState("60");
  const [precoLuzes, setPrecoLuzes] = useState("80");

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const toggleWorkDay = (day: number) => {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const toggleCut = (cut: (typeof CUTS)[0]) => {
    setSelectedCuts((prev) =>
      prev.find((c) => c.name === cut.name)
        ? prev.filter((c) => c.name !== cut.name)
        : [...prev, cut]
    );
  };

  const handleRegister = async () => {
    const services = [
      ...selectedCuts,
      ...(fazBarba
        ? [
            {
              name: "Barba",
              category: "barba",
              duration: parseInt(tempoBarba),
              price: parseFloat(precoBarba),
            },
          ]
        : []),
      ...(fazSobrancelha
        ? [
            {
              name: "Sobrancelha",
              category: "sobrancelha",
              duration: parseInt(tempoSobrancelha),
              price: parseFloat(precoSobrancelha),
            },
          ]
        : []),
      ...(fazPezinho
        ? [
            {
              name: "Pezinho",
              category: "pezinho",
              duration: 10,
              price: parseFloat(precoPezinho),
            },
          ]
        : []),
      ...(fazLuzes
        ? [
            {
              name: tipoLuzes || "Luzes",
              category: "luzes",
              duration: parseInt(tempoLuzes),
              price: parseFloat(precoLuzes),
            },
          ]
        : []),
    ];

    if (services.length === 0) {
      setRegisterError("Selecione pelo menos um tipo de serviço acima antes de cadastrar.");
      return;
    }

    setRegisterError("");
    setLoading(true);
    try {
      const result = await api.register({
        ownerName: name,
        shopName,
        avgServiceTime: 30,
        phone: phone.replace(/\D/g, ""),
        password,
        openTime,
        closeTime,
        workDays,
        services,
      });
      onRegister(result.token, result.barber);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao cadastrar. Tente novamente.";
      setRegisterError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={require("../../assets/logo.png")} style={styles.logoImg} resizeMode="contain" accessibilityLabel="BarberPro App" />
        <Text style={styles.subtitle}>
          {step === 1 ? "Dados da barbearia" : "Serviços oferecidos"}
        </Text>

        {/* Progress */}
        <View style={styles.progress}>
          <View style={[styles.dot, step >= 1 && styles.dotActive]} />
          <View style={[styles.line, step >= 2 && styles.lineActive]} />
          <View style={[styles.dot, step >= 2 && styles.dotActive]} />
        </View>

        {step === 1 && (
          <View style={styles.form}>
            <AppInput
              placeholder="Seu nome"
              value={name}
              onChangeText={setName}
            />
            <AppInput
              placeholder="Nome da Barbearia"
              value={shopName}
              onChangeText={setShopName}
            />
            <AppInput
              placeholder="(00) 00000-0000"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(v) => setPhone(formatPhone(v))}
            />
            <AppInput
              placeholder="Senha (min. 6 caracteres)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <Text style={styles.label}>Horário de funcionamento</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.inputHalf]}
                placeholder="Abertura"
                placeholderTextColor={colors.gray[500]}
                value={openTime}
                onChangeText={setOpenTime}
              />
              <TextInput
                style={[styles.input, styles.inputHalf]}
                placeholder="Fechamento"
                placeholderTextColor={colors.gray[500]}
                value={closeTime}
                onChangeText={setCloseTime}
              />
            </View>

            <Text style={styles.label}>Dias de trabalho</Text>
            <View style={styles.daysRow}>
              {WEEKDAYS.map((day) => (
                <TouchableOpacity
                  key={day.value}
                  onPress={() => toggleWorkDay(day.value)}
                  style={[
                    styles.dayButton,
                    workDays.includes(day.value) && styles.dayButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      workDays.includes(day.value) && styles.dayTextActive,
                    ]}
                  >
                    {day.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {!!step1Error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{step1Error}</Text>
              </View>
            )}

            <AppButton
              title="Próximo"
              onPress={() => {
                if (!name.trim()) { setStep1Error("Preencha seu nome."); return; }
                if (!shopName.trim()) { setStep1Error("Preencha o nome da barbearia."); return; }
                if (phone.replace(/\D/g, "").length < 10) { setStep1Error("Informe um telefone válido com DDD."); return; }
                if (password.length < 6) { setStep1Error("A senha precisa ter pelo menos 6 caracteres."); return; }
                setStep1Error("");
                setStep(2);
              }}
              size="lg"
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.form}>
            <Text style={styles.label}>Cortes disponíveis</Text>
            <View style={styles.cutsGrid}>
              {CUTS.map((cut) => {
                const selected = selectedCuts.find((c) => c.name === cut.name);
                return (
                  <TouchableOpacity
                    key={cut.name}
                    onPress={() => toggleCut(cut)}
                    style={[styles.cutCard, selected && styles.cutCardActive]}
                  >
                    <Text style={[styles.cutName, selected && styles.cutNameActive]}>
                      {cut.name}
                    </Text>
                    <Text style={styles.cutInfo}>
                      {cut.duration}min - R${cut.price}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Barba */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Faz barba?</Text>
              <Switch
                value={fazBarba}
                onValueChange={setFazBarba}
                trackColor={{ true: colors.brand[500] }}
                thumbColor={colors.white}
              />
            </View>
            {fazBarba && (
              <View style={styles.row}>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputPrefix}><Text style={styles.inputPrefixText}>Min</Text></View>
                  <TextInput style={styles.inputInner} placeholder="ex: 20" placeholderTextColor={colors.gray[500]} keyboardType="numeric" value={tempoBarba} onChangeText={setTempoBarba} />
                </View>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputPrefix}><Text style={styles.inputPrefixText}>R$</Text></View>
                  <TextInput style={styles.inputInner} placeholder="ex: 25,00" placeholderTextColor={colors.gray[500]} keyboardType="numeric" value={precoBarba} onChangeText={setPrecoBarba} />
                </View>
              </View>
            )}

            {/* Sobrancelha */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Faz sobrancelha?</Text>
              <Switch
                value={fazSobrancelha}
                onValueChange={setFazSobrancelha}
                trackColor={{ true: colors.brand[500] }}
                thumbColor={colors.white}
              />
            </View>
            {fazSobrancelha && (
              <View style={styles.row}>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputPrefix}><Text style={styles.inputPrefixText}>Min</Text></View>
                  <TextInput style={styles.inputInner} placeholder="ex: 15" placeholderTextColor={colors.gray[500]} keyboardType="numeric" value={tempoSobrancelha} onChangeText={setTempoSobrancelha} />
                </View>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputPrefix}><Text style={styles.inputPrefixText}>R$</Text></View>
                  <TextInput style={styles.inputInner} placeholder="ex: 15,00" placeholderTextColor={colors.gray[500]} keyboardType="numeric" value={precoSobrancelha} onChangeText={setPrecoSobrancelha} />
                </View>
              </View>
            )}

            {/* Pezinho */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Faz pezinho?</Text>
              <Switch
                value={fazPezinho}
                onValueChange={setFazPezinho}
                trackColor={{ true: colors.brand[500] }}
                thumbColor={colors.white}
              />
            </View>
            {fazPezinho && (
              <View style={[styles.inputWrapper, { flex: undefined }]}>
                <View style={styles.inputPrefix}><Text style={styles.inputPrefixText}>R$</Text></View>
                <TextInput style={styles.inputInner} placeholder="ex: 10,00" placeholderTextColor={colors.gray[500]} keyboardType="numeric" value={precoPezinho} onChangeText={setPrecoPezinho} />
              </View>
            )}

            {/* Luzes */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Faz luzes?</Text>
              <Switch
                value={fazLuzes}
                onValueChange={setFazLuzes}
                trackColor={{ true: colors.brand[500] }}
                thumbColor={colors.white}
              />
            </View>
            {fazLuzes && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Tipo de luzes (ex: Platinado, Mechas)"
                  placeholderTextColor={colors.gray[500]}
                  value={tipoLuzes}
                  onChangeText={setTipoLuzes}
                />
                <View style={styles.row}>
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputPrefix}><Text style={styles.inputPrefixText}>Min</Text></View>
                    <TextInput style={styles.inputInner} placeholder="ex: 90" placeholderTextColor={colors.gray[500]} keyboardType="numeric" value={tempoLuzes} onChangeText={setTempoLuzes} />
                  </View>
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputPrefix}><Text style={styles.inputPrefixText}>R$</Text></View>
                    <TextInput style={styles.inputInner} placeholder="ex: 120,00" placeholderTextColor={colors.gray[500]} keyboardType="numeric" value={precoLuzes} onChangeText={setPrecoLuzes} />
                  </View>
                </View>
              </>
            )}

            {!!registerError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{registerError}</Text>
              </View>
            )}

            <View style={styles.row}>
              <AppButton
                title="Voltar"
                variant="secondary"
                onPress={() => { setRegisterError(""); setStep(1); }}
                size="lg"
                style={{ flex: 1 }}
              />
              <AppButton
                title="Cadastrar"
                onPress={handleRegister}
                loading={loading}
                size="lg"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}

        <AppButton
          title="Já tem conta? Entrar"
          variant="ghost"
          onPress={onGoToLogin}
          textStyle={{ color: colors.brand[400] }}
        />
      </ScrollView>
    </ScreenBackground>
  );
}
