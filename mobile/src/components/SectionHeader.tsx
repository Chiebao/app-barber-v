import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { useColors } from "../utils/useColors";
import { fontSize, fontWeight, spacing } from "../utils/tokens";

interface Props {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}

/** Rótulo de seção HUD: maiúsculas espaçadas, na cor clara do destaque. */
export default function SectionHeader({ title, subtitle, action, style }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.brand[400] }]}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { color: colors.gray[400] }]}>{subtitle}</Text>}
      </View>
      {action && (
        <TouchableOpacity
          onPress={action.onPress}
          accessibilityRole="button"
          style={styles.action}
        >
          <Text style={[styles.actionText, { color: colors.brand[400] }]}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  textBlock: { flex: 1 },
  title: {
    fontSize: fontSize.micro,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  subtitle: { fontSize: fontSize.bodySmall, marginTop: 4 },
  action: { minHeight: 44, justifyContent: "center", paddingLeft: spacing.md },
  actionText: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
});
