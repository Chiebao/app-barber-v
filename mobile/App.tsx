import React, { useState, useEffect, useCallback } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Marcellus_400Regular } from "@expo-google-fonts/marcellus";
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { ThemeProvider } from "./src/context/ThemeContext";
import * as Notifications from "expo-notifications";
import { api, setOnUnauthorized } from "./src/services/api";

SplashScreen.preventAutoHideAsync();
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import HomeScreen from "./src/screens/HomeScreen";
import FinanceScreen from "./src/screens/FinanceScreen";
import LoyaltyScreen from "./src/screens/LoyaltyScreen";
import BarbersScreen from "./src/screens/BarbersScreen";
import ProductsScreen from "./src/screens/ProductsScreen";
import AvailabilityScreen from "./src/screens/AvailabilityScreen";
import SobreScreen from "./src/screens/SobreScreen";
import ServicesScreen from "./src/screens/ServicesScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import ClientsScreen from "./src/screens/ClientsScreen";

// Permite exibir push mesmo com app aberto
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type Screen = "login" | "register" | "home" | "finance" | "loyalty" | "barbers" | "dashboard" | "products" | "availability" | "sobre" | "services" | "clients";

export default function App() {
  const [fontsLoaded] = useFonts({
    // Marcellus tem um peso so: e letra de titulo, nao de texto corrido
    Marcellus_400Regular,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const [screen, setScreen] = useState<Screen>("login");
  const [token, setToken] = useState("");
  const [barber, setBarber] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const registerPushToken = async (authToken: string) => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;
      const expoPushToken = await Notifications.getExpoPushTokenAsync();
      await api.savePushToken(authToken, expoPushToken.data);
    } catch {
      // silently fail — push notifications are optional
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const savedToken = await SecureStore.getItemAsync("token");
        const savedBarber = await SecureStore.getItemAsync("barber");
        if (savedToken && savedBarber) {
          setToken(savedToken);
          setBarber(JSON.parse(savedBarber));
          setScreen("home");
          registerPushToken(savedToken);
        }
      } catch {
        // first launch
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleAuth = async (newToken: string, newBarber: Record<string, unknown>) => {
    setToken(newToken);
    setBarber(newBarber);
    setScreen("home");
    await SecureStore.setItemAsync("token", newToken);
    await SecureStore.setItemAsync("barber", JSON.stringify(newBarber));
    registerPushToken(newToken);
  };

  const handleLogout = async () => {
    setToken("");
    setBarber(null);
    setScreen("login");
    await SecureStore.deleteItemAsync("token");
    await SecureStore.deleteItemAsync("barber");
  };

  useEffect(() => {
    setOnUnauthorized(handleLogout);
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (!loading && fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [loading, fontsLoaded]);

  if (loading || !fontsLoaded) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
    <ThemeProvider>
      <StatusBar style="light" />
      {screen === "login" && (
        <LoginScreen
          onLogin={handleAuth}
          onGoToRegister={() => setScreen("register")}
        />
      )}
      {screen === "register" && (
        <RegisterScreen
          onRegister={handleAuth}
          onGoToLogin={() => setScreen("login")}
        />
      )}
      {screen === "home" && barber && (
        <HomeScreen
          token={token}
          barber={barber as never}
          onLogout={handleLogout}
          onOpenFinance={() => setScreen("finance")}
          onOpenLoyalty={() => setScreen("loyalty")}
          onOpenBarbers={() => setScreen("barbers")}
          onOpenProducts={() => setScreen("products")}
          onOpenAvailability={() => setScreen("availability")}
          onOpenDashboard={() => setScreen("dashboard")}
          onOpenSobre={() => setScreen("sobre")}
          onOpenServices={() => setScreen("services")}
          onOpenClients={() => setScreen("clients")}
        />
      )}
      {screen === "finance" && (
        <FinanceScreen
          token={token}
          onBack={() => setScreen("home")}
        />
      )}
      {screen === "loyalty" && (
        <LoyaltyScreen
          token={token}
          onBack={() => setScreen("home")}
        />
      )}
      {screen === "barbers" && (
        <BarbersScreen
          token={token}
          onBack={() => setScreen("home")}
        />
      )}
      {screen === "products" && barber && (
        <ProductsScreen
          token={token}
          role={(barber as { role: "owner" | "barber" }).role}
          onBack={() => setScreen("home")}
        />
      )}
      {screen === "availability" && barber && (
        <AvailabilityScreen
          token={token}
          role={(barber as { role: "owner" | "barber" }).role}
          ownerName={(barber as { name?: string }).name}
          ownerPhone={(barber as { phone?: string }).phone}
          onBack={() => setScreen("home")}
        />
      )}
      {screen === "sobre" && barber && (
        <SobreScreen
          token={token}
          barber={barber as never}
          onBack={() => setScreen("home")}
          onLogout={handleLogout}
        />
      )}
      {screen === "dashboard" && (
        <DashboardScreen token={token} onBack={() => setScreen("home")} />
      )}
      {screen === "services" && barber && (
        <ServicesScreen
          token={token}
          onBack={() => setScreen("home")}
        />
      )}
      {screen === "clients" && (
        <ClientsScreen
          token={token}
          onBack={() => setScreen("home")}
        />
      )}
    </ThemeProvider>
    </View>
  );
}
