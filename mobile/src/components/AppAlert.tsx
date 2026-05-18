import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useColors } from "../utils/useColors";
import { fontSize, fontWeight, spacing, radius } from "../utils/tokens";

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onClose?: () => void;
}

export default function AppAlert({ visible, title, message, buttons, onClose }: Props) {
  const colors = useColors();

  const btns: AlertButton[] = buttons?.length
    ? buttons
    : [{ text: "OK", onPress: onClose, style: "default" }];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.box, { backgroundColor: colors.dark[800], borderColor: colors.gray[700] + "60" }]}>
          <Text style={[styles.title, { color: colors.white }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: colors.gray[400] }]}>{message}</Text> : null}

          <View style={[styles.btnRow, btns.length > 2 && styles.btnCol]}>
            {btns.map((btn, i) => {
              const isDestructive = btn.style === "destructive";
              const isCancel = btn.style === "cancel";
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.btn,
                    btns.length <= 2 && { flex: 1 },
                    btns.length > 2 && { width: "100%" },
                    isDestructive && { backgroundColor: "#ef444420", borderColor: "#ef444440" },
                    isCancel && { borderColor: colors.gray[600] },
                    !isDestructive && !isCancel && { backgroundColor: colors.brand[500] + "20", borderColor: colors.brand[500] + "50" },
                  ]}
                  onPress={() => { btn.onPress?.(); onClose?.(); }}
                >
                  <Text style={[
                    styles.btnText,
                    isDestructive && { color: "#ef4444" },
                    isCancel && { color: colors.gray[400] },
                    !isDestructive && !isCancel && { color: colors.brand[400] },
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing["2xl"],
  },
  box: {
    width: "100%",
    maxWidth: 320,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing["2xl"],
  },
  title: {
    fontSize: fontSize.h3,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  message: {
    fontSize: fontSize.body,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  btnRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  btnCol: {
    flexDirection: "column",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  btn: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  btnText: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
