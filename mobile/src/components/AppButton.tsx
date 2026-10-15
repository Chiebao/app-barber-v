import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "../utils/useColors";
import { fontSize, fontWeight, radius, spacing, minTouchTarget, feedback } from "../utils/tokens";
import HudIcon, { iconeDoEmoji } from "./HudIcon";

/**
 * Botão do Ouro HUD.
 *
 * Primário: gradiente metálico derivado da cor da barbearia (claro → cor →
 * escuro), texto escuro em maiúsculas. O canto chanfrado do site exigiria
 * `react-native-svg`, que não está instalado — aqui o canto é reto de 4px,
 * decisão registrada em docs/design/COBERTURA.md.
 *
 * `icon` aceita o nome de um ícone de linha (Feather) ou, por compatibilidade,
 * um emoji antigo — que é trocado pelo ícone equivalente.
 */

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function AppButton({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}: Props) {
  const colors = useColors();

  const altura: Record<Size, number> = { sm: minTouchTarget, md: 52, lg: 56 };
  const fs: Record<Size, number> = { sm: fontSize.bodySmall, md: fontSize.body, lg: 15 };

  const variantStyles: Record<Variant, { bg: string; border: string; text: string }> = {
    primary: { bg: "transparent", border: "transparent", text: "#0B0B14" },
    secondary: { bg: colors.brand[500] + "14", border: colors.brand[500], text: colors.brand[400] },
    ghost: { bg: "transparent", border: "transparent", text: colors.brand[400] },
    destructive: { bg: feedback.error, border: feedback.error, text: "#0B0B14" },
  };

  const v = variantStyles[variant];
  const isDisabled = disabled || loading;
  const primario = variant === "primary";
  const nomeIcone = iconeDoEmoji(icon);

  const conteudo = loading ? (
    <ActivityIndicator color={primario ? "#0B0B14" : colors.brand[500]} size="small" />
  ) : (
    <View style={styles.row}>
      {nomeIcone && <HudIcon nome={nomeIcone} size={18} color={isDisabled && primario ? "#4A4E66" : v.text} />}
      <Text
        style={[
          styles.text,
          {
            color: isDisabled && primario ? "#4A4E66" : v.text,
            fontSize: fs[size],
            fontWeight: primario || variant === "destructive" ? fontWeight.bold : fontWeight.semibold,
            letterSpacing: primario ? 1.4 : 0,
            textTransform: primario ? "uppercase" : "none",
          },
          textStyle,
        ]}
      >
        {!nomeIcone && icon ? `${icon}  ${title}` : title}
      </Text>
    </View>
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        {
          backgroundColor: primario ? (isDisabled ? "#1B1D2E" : "transparent") : v.bg,
          borderColor: primario ? (isDisabled ? colors.gray[700] : "transparent") : v.border,
          minHeight: altura[size],
          opacity: isDisabled && !primario ? 0.45 : 1,
        },
        style,
      ]}
    >
      {primario && !isDisabled && (
        <LinearGradient
          colors={[colors.brand[400], colors.brand[500], colors.brand[600]]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={{ paddingHorizontal: size === "sm" ? spacing.lg : spacing["2xl"] }}>{conteudo}</View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: { textAlign: "center" },
});
