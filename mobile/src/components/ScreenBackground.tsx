import React, { useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";

/**
 * Fundo Ouro HUD: cor base + grade sutil da cor de destaque (5%, a cada
 * 28px) + brilho no canto superior.
 *
 * Era uma foto de barbearia com véu por cima. A grade é feita com Views
 * finas (sem SVG); o brilho radial vira um degradê diagonal — o
 * expo-linear-gradient não faz radial.
 */
const PASSO = 28;

export default function ScreenBackground({ children }: { children: React.ReactNode }) {
  const { palette } = useTheme();
  const { width, height } = useWindowDimensions();
  const linha = palette.brand + "0D"; // ~5%

  const grade = useMemo(() => {
    const v = Array.from({ length: Math.ceil(width / PASSO) + 1 }, (_, i) => i * PASSO);
    const h = Array.from({ length: Math.ceil(height / PASSO) + 1 }, (_, i) => i * PASSO);
    return { v, h };
  }, [width, height]);

  return (
    <View style={[styles.bg, { backgroundColor: palette.bgPrimary }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {grade.v.map((x) => (
          <View key={`v${x}`} style={[styles.vertical, { left: x, backgroundColor: linha }]} />
        ))}
        {grade.h.map((y) => (
          <View key={`h${y}`} style={[styles.horizontal, { top: y, backgroundColor: linha }]} />
        ))}
        <LinearGradient
          colors={[palette.brand + "29", palette.brand + "00"]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.35, y: 0.4 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  vertical: { position: "absolute", top: 0, bottom: 0, width: 1 },
  horizontal: { position: "absolute", left: 0, right: 0, height: 1 },
});
