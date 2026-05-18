import React from "react";
import { StyleSheet, ImageBackground, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

// Coloque a imagem em mobile/assets/bg-barber.jpg
const bgImage = require("../../assets/bg-barber.jpg");

export default function ScreenBackground({ children }: { children: React.ReactNode }) {
  const { palette } = useTheme();

  return (
    <ImageBackground
      source={bgImage}
      style={styles.bg}
      imageStyle={styles.bgImage}
    >
      {/* Overlay dinâmico — cor e opacidade controlados pelo tema */}
      <View style={[styles.overlay, { backgroundColor: palette.overlay }]} />
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  bgImage: {
    resizeMode: "cover",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
