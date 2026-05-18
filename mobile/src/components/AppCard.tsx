import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useColors } from "../utils/useColors";
import { radius, spacing, shadow } from "../utils/tokens";

interface Props {
  children: React.ReactNode;
  selected?: boolean;
  elevated?: boolean;
  style?: ViewStyle;
  padding?: keyof typeof spacing;
}

export default function AppCard({
  children,
  selected = false,
  elevated = false,
  style,
  padding = "lg",
}: Props) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.card,
        elevated && shadow.elevated,
        !elevated && shadow.card,
        {
          backgroundColor: colors.dark[800],
          borderColor: selected ? colors.brand[500] : colors.gray[700],
          padding: spacing[padding],
        },
        selected && { backgroundColor: colors.brand[500] + "10" },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
