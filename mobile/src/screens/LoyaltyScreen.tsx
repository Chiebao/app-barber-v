import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useColors } from "../utils/useColors";
import { api } from "../services/api";
import { ScreenBackground, ScreenHeader, AppCard } from "../components";
import { fontSize, fontWeight, spacing, radius, feedback } from "../utils/tokens";

interface LoyaltyItem {
  clientName: string;
  clientPhone: string;
  count: number;
  progress: number;
  rewardsEarned: number;
}

interface Props {
  token: string;
  onBack: () => void;
}

const makeStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    infoCard: { gap: spacing.sm },
    infoTitle: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
      color: colors.brand[400],
      marginBottom: spacing.xs,
    },
    infoText: {
      fontSize: fontSize.bodySmall,
      color: colors.gray[400],
      lineHeight: 18,
    },
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing["4xl"] },
    emptyText: {
      color: colors.gray[500],
      textAlign: "center",
      paddingVertical: spacing["4xl"],
      fontSize: fontSize.body,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    clientName: {
      fontSize: fontSize.h3,
      fontWeight: fontWeight.semibold,
      color: colors.white,
    },
    clientPhone: {
      fontSize: fontSize.caption,
      color: colors.gray[500],
      marginTop: spacing.xs,
    },
    countBadge: {
      alignItems: "center",
      backgroundColor: colors.brand[500] + "20",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
    },
    countText: {
      fontSize: fontSize.h2,
      fontWeight: fontWeight.bold,
      color: colors.brand[400],
    },
    countLabel: {
      fontSize: fontSize.micro,
      color: colors.gray[400],
    },
    progressBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    dot: {
      flex: 1,
      height: spacing.sm,
      borderRadius: spacing.xs,
    },
    dotFilled: { backgroundColor: colors.brand[500] },
    dotEmpty: { backgroundColor: colors.gray[700] },
    cardFooter: { gap: spacing.xs },
    progressText: {
      fontSize: fontSize.caption,
      color: colors.gray[400],
    },
    rewardText: {
      fontSize: fontSize.bodySmall,
      color: colors.brand[400],
      fontWeight: fontWeight.medium,
    },
  });

export default function LoyaltyScreen({ token, onBack }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loyalties, setLoyalties] = useState<LoyaltyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getLoyalty(token)
      .then((data) => setLoyalties(data.loyalties || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const renderProgressBar = (progress: number) => {
    const dots = [];
    for (let i = 0; i < 10; i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.dot,
            i < progress ? styles.dotFilled : styles.dotEmpty,
          ]}
        />
      );
    }
    return <View style={styles.progressBar}>{dots}</View>;
  };

  return (
    <ScreenBackground>
    <View style={styles.container}>
      <ScreenHeader title="Fidelidade" onBack={onBack} />

      <AppCard style={{ margin: spacing.lg }} selected>
        <Text style={styles.infoTitle}>Como funciona</Text>
        <Text style={styles.infoText}>
          A cada corte confirmado, o cliente ganha 1 ponto. Ao completar 10 pontos, você recebe um alerta para oferecer uma recompensa!
        </Text>
      </AppCard>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.brand[400]}
          style={{ marginTop: spacing["4xl"] }}
        />
      ) : (
        <FlatList
          data={loyalties}
          keyExtractor={(item) => item.clientPhone}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Nenhum cliente com pontos ainda. Confirme pagamentos para acumular!
            </Text>
          }
          renderItem={({ item }) => (
            <AppCard style={{ marginBottom: spacing.md }}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.clientName}>{item.clientName}</Text>
                  <Text style={styles.clientPhone}>{item.clientPhone}</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{item.count}</Text>
                  <Text style={styles.countLabel}>cortes</Text>
                </View>
              </View>

              {renderProgressBar(item.progress)}

              <View style={styles.cardFooter}>
                <Text style={styles.progressText}>
                  {item.progress}/10 para próxima recompensa
                </Text>
                {item.rewardsEarned > 0 && (
                  <Text style={styles.rewardText}>
                    🏆 {item.rewardsEarned} recompensa{item.rewardsEarned > 1 ? "s" : ""} conquistada{item.rewardsEarned > 1 ? "s" : ""}
                  </Text>
                )}
              </View>
            </AppCard>
          )}
        />
      )}
    </View>
    </ScreenBackground>
  );
}
