import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { useColors } from "../utils/useColors";
import { fontSize, fontFamily, fontWeight, spacing } from "../utils/tokens";

interface Props {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}

export default function SectionHeader({ title, subtitle, action, style }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.white }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.gray[400] }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {action && (
        <TouchableOpacity onPress={action.onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.actionText, { color: colors.brand[400] }]}>
            {action.label}
          </Text>
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
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.h3,
    fontFamily: fontFamily.serif,
  },
  subtitle: {
    fontSize: fontSize.bodySmall,
    marginTop: 2,
  },
  actionText: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
