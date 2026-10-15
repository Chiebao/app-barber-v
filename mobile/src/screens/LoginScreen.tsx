import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useColors } from "../utils/useColors";
import { fontSize, fontWeight, spacing } from "../utils/tokens";
import { api } from "../services/api";
import { ScreenBackground, AppButton, AppInput } from "../components";

interface Props {
  onLogin: (token: string, barber: Record<string, unknown>) => void;
  onGoToRegister: () => void;
}

export default function LoginScreen({ onLogin, onGoToRegister }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await api.login({
        phone: phone.replace(/\D/g, ""),
        password,
      });
      const userData = {
        ...result.user,
        role: result.role,
        shopId: result.shop.id,
        shopName: result.shop.name,
        slug: result.shop.slug,
        link: result.shop.link,
      };
      onLogin(result.token, userData);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao entrar";
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Logo */}
        <View style={styles.logoBlock}>
          <Image source={require("../../assets/logo.png")} style={styles.logoImg} resizeMode="contain" accessibilityLabel="BarberPro App" />
          <Text style={styles.subtitle}>Entre na sua conta</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <AppInput
            label="Telefone"
            placeholder="(00) 00000-0000"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(v) => setPhone(formatPhone(v))}
          />
          <AppInput
            label="Senha"
            placeholder="Digite sua senha"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <AppButton
            title="Entrar"
            onPress={handleLogin}
            loading={loading}
            disabled={!phone || !password}
            size="lg"
          />
        </View>

        {/* Register link */}
        <AppButton
          title="Não tem conta? Cadastre-se"
          variant="ghost"
          onPress={onGoToRegister}
          textStyle={{ color: colors.brand[400] }}
          style={styles.registerLink}
        />
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "transparent",
      padding: spacing["2xl"],
      justifyContent: "center",
    },
    logoBlock: {
      alignItems: "center",
      marginBottom: spacing["3xl"],
    },
    logoImg: {
      width: 170,
      height: 219,
    },
    logo: {
      fontSize: fontSize.display,
      fontWeight: fontWeight.bold,
      color: colors.brand[400],
      letterSpacing: 1,
    },
    brandLine: {
      width: 48,
      height: 3,
      backgroundColor: colors.brand[500],
      borderRadius: 2,
      marginTop: spacing.sm,
    },
    subtitle: {
      fontSize: fontSize.bodyLarge,
      color: colors.gray[400],
      marginTop: spacing.md,
    },
    form: {
      gap: spacing.lg,
    },
    registerLink: {
      marginTop: spacing["2xl"],
    },
  });
}
