import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, Platform } from "react-native";
import { useColors } from "../utils/useColors";
import { fontSize, fontFamily, fontWeight, spacing } from "../utils/tokens";

interface Props {
  title: string;
  onBack: () => void;
  rightElement?: React.ReactNode;
}

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
    <View style={[styles.header, { borderBottomColor: colors.gray[700] + "40" }]}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={[styles.backText, { color: colors.brand[400] }]}>← Voltar</Text>
      </TouchableOpacity>
      <Text style={[styles.title, { color: colors.white }]}>{title}</Text>
      {rightElement || <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
  },
  backBtn: { width: 70 },
  backText: { fontSize: 15 },
  title: {
    fontSize: fontSize.h2,
    fontFamily: fontFamily.serifBold,
  },
  spacer: { width: 70 },
});
