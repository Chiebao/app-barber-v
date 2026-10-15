import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, Platform } from "react-native";
import { useColors } from "../utils/useColors";
import { fontFamily, spacing } from "../utils/tokens";
import HudIcon from "./HudIcon";

interface Props {
  title: string;
  onBack: () => void;
  rightElement?: React.ReactNode;
}

/** Cabeçalho de subtela HUD: voltar (44px) + título Marcellus 28. */
export default function ScreenHeader({ title, onBack, rightElement }: Props) {
  const colors = useColors();

  // Android: intercepta botão físico de voltar
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true; // impede fechar o app
    });
    return () => sub.remove();
  }, [onBack]);

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        style={[styles.backBtn, { borderColor: colors.gray[700], backgroundColor: colors.dark[800] + "D9" }]}
      >
        <HudIcon nome="chevron-left" size={22} color={colors.brand[500]} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: colors.white }]} numberOfLines={1}>
        {title}
      </Text>
      {rightElement || null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 28,
    fontFamily: fontFamily.serif,
  },
});
