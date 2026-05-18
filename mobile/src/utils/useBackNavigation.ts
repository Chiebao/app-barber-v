import { useEffect, useRef } from "react";
import { BackHandler, PanResponder, Platform } from "react-native";

/**
 * Hook que intercepta:
 * - Android: botão físico de voltar (não fecha o app, chama onBack)
 * - iOS: swipe da borda esquerda para a direita (≥ 60px de deslocamento)
 *
 * Uso: chame useBackNavigation(onBack) dentro de qualquer tela.
 * Ou use via ScreenBackground passando onBack como prop.
 */
export function useBackNavigation(onBack?: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  // Android: hardware back button
  useEffect(() => {
    if (Platform.OS !== "android" || !onBack) return;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBackRef.current?.();
      return true; // true = impede fechar o app
    });

    return () => sub.remove();
  }, [onBack]);

  // iOS: swipe da borda esquerda
  const panResponder = useRef(
    PanResponder.create({
      // Ativa APENAS se o toque começar nos primeiros 20px da esquerda
      onStartShouldSetPanResponder: (evt) => {
        return Platform.OS === "ios" && evt.nativeEvent.pageX < 20;
      },
      // Só captura se o movimento horizontal for claramente maior que o vertical
      // e o toque começou na borda (pageX inicial pequeno)
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return (
          Platform.OS === "ios" &&
          evt.nativeEvent.pageX < 60 &&
          gestureState.dx > 15 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2
        );
      },
      // Não captura se já houver outro responder ativo (ex: ScrollView)
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderRelease: (_, gestureState) => {
        // Swipe de pelo menos 80px para direita com velocidade positiva
        if (gestureState.dx > 80 && gestureState.vx > 0.3) {
          onBackRef.current?.();
        }
      },
    })
  ).current;

  return { panHandlers: panResponder.panHandlers };
}
