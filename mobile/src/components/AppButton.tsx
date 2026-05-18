import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { useColors } from "../utils/useColors";
import { fontSize, fontWeight, radius, spacing, minTouchTarget, feedback } from "../utils/tokens";

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

  const sizeMap: Record<Size, { py: number; px: number; fs: number }> = {
    sm: { py: 8, px: 16, fs: fontSize.bodySmall },
    md: { py: 12, px: spacing["2xl"], fs: fontSize.body },
    lg: { py: 14, px: spacing["3xl"], fs: fontSize.bodyLarge },
  };

  const s = sizeMap[size];

  const variantStyles: Record<Variant, { bg: string; border: string; text: string }> = {
    primary: {
      bg: colors.brand[500],
      border: colors.brand[500],
      text: colors.dark[900],
    },
    secondary: {
      bg: "transparent",
      border: colors.gray[700],
      text: colors.gray[400],
    },
    ghost: {
      bg: "transparent",
      border: "transparent",
      text: colors.gray[400],
    },
    destructive: {
      bg: feedback.error,
      border: feedback.error,
      text: "#ffffff",
    },
  };

  const v = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          minHeight: minTouchTarget,
          opacity: isDisabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? colors.dark[900] : colors.brand[500]}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.text,
            {
              color: v.text,
              fontSize: s.fs,
              fontWeight: variant === "primary" ? fontWeight.bold : fontWeight.semibold,
            },
            textStyle,
          ]}
        >
          {icon ? `${icon}  ${title}` : title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  text: {
    textAlign: "center",
  },
});
