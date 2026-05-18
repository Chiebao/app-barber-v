import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { fontSize, fontWeight, radius, spacing, feedback } from "../utils/tokens";

type Status = "confirmed" | "completed" | "cancelled" | "pending" | "pending_payment";

interface Props {
  status: Status | string;
  label?: string;
  size?: "sm" | "md";
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  confirmed: { color: feedback.info, bg: feedback.infoBg, label: "Confirmado" },
  completed: { color: feedback.success, bg: feedback.successBg, label: "Concluído" },
  cancelled: { color: feedback.error, bg: feedback.errorBg, label: "Cancelado" },
  pending: { color: feedback.warning, bg: feedback.warningBg, label: "Pendente" },
  pending_payment: { color: feedback.warning, bg: feedback.warningBg, label: "Aguardando Pix" },
};

export default function StatusBadge({ status, label, size = "sm" }: Props) {
  const config = statusConfig[status] || statusConfig.pending;
  const displayLabel = label || config.label;
  const isMd = size === "md";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.color + "30",
          paddingVertical: isMd ? 6 : spacing.xs,
          paddingHorizontal: isMd ? spacing.md : 10,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: config.color,
            fontSize: isMd ? fontSize.bodySmall : fontSize.caption,
          },
        ]}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.sm,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: fontWeight.semibold,
  },
});
