import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  Animated,
} from "react-native";
import { useColors } from "../utils/useColors";
import { fontSize, fontWeight, radius, spacing, feedback, minTouchTarget } from "../utils/tokens";

interface Props extends Omit<TextInputProps, "style"> {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export default function AppInput({
  label,
  error,
  containerStyle,
  ...inputProps
}: Props) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? feedback.error
    : focused
    ? colors.brand[500]
    : colors.gray[700];

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.gray[400] }]}>
          {label}
        </Text>
      )}
      <TextInput
        {...inputProps}
        style={[
          styles.input,
          {
            backgroundColor: colors.dark[800],
            borderColor,
            color: colors.white,
          },
        ]}
        placeholderTextColor={colors.gray[500]}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
      />
      {error && (
        <Text style={styles.error}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.micro,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: fontSize.bodyLarge,
    minHeight: 52,
  },
  error: {
    fontSize: fontSize.caption,
    color: feedback.error,
    marginTop: spacing.xs,
  },
});
