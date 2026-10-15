import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useColors } from "../utils/useColors";
import { radius, spacing } from "../utils/tokens";

/**
 * Cartão HUD: raio 4px, borda fina, fundo da superfície.
 *
 * `selected` (item escolhido) e `destaque` (1 cartão por tela) ganham as
 * cantoneiras — dois "L" de 10px, feitos com Views (sem SVG).
 */
interface Props {
  children: React.ReactNode;
  selected?: boolean;
  elevated?: boolean;
  destaque?: boolean;
  style?: ViewStyle;
  padding?: keyof typeof spacing;
}

export default function AppCard({
  children,
  selected = false,
  elevated = false,
  destaque = false,
  style,
  padding = "lg",
}: Props) {
  const colors = useColors();
  const cantos = selected || destaque;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: selected ? colors.brand[500] + "1F" : colors.dark[800] + "E0",
          borderColor: selected ? colors.brand[500] : colors.gray[700],
          padding: spacing[padding],
        },
        elevated && styles.elevated,
        style,
      ]}
    >
      {cantos && (
        <>
          <View pointerEvents="none" style={[styles.canto, styles.cantoTopo, { borderColor: colors.brand[400] }]} />
          <View pointerEvents="none" style={[styles.canto, styles.cantoBase, { borderColor: colors.brand[400] }]} />
        </>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  elevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  canto: { position: "absolute", width: 10, height: 10 },
  cantoTopo: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 },
  cantoBase: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 },
});
