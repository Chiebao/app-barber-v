import React, { useState, useEffect, useCallback, useMemo } from "react";
import HudIcon from "../components/HudIcon";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Image,
  ImageStyle,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "../utils/useColors";
import { api } from "../services/api";
import { ScreenBackground, ScreenHeader, AppInput, AppButton, AppAlert } from "../components";
import type { AlertButton } from "../components/AppAlert";
import { fontSize, fontWeight, spacing, radius, feedback } from "../utils/tokens";

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  imageUrl2?: string;
}

interface Appointment {
  id: string;
  startTime: string;
  client: { name: string };
  services: { name: string }[];
}

interface Props {
  token: string;
  role: "owner" | "barber";
  onBack: () => void;
}

type Tab = "catalogo" | "comanda";

// Slot para foto: undefined = vazio, string = URI local ou URL remota
type PhotoSlot = { uri: string; mimeType: string } | null;

function PhotoPicker({
  photo,
  onPick,
  onRemove,
  label,
  photoStyles,
}: {
  photo: PhotoSlot;
  onPick: (p: PhotoSlot) => void;
  onRemove: () => void;
  label: string;
  photoStyles: ReturnType<typeof StyleSheet.create>;
}) {
  const handlePick = () => {
    Alert.alert(label, "Escolha como adicionar a foto", [
      {
        text: "Câmera",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permissão negada", "Permita o acesso à câmera nas configurações");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: true,
            aspect: [1, 1],
          });
          if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            onPick({ uri: asset.uri, mimeType: asset.mimeType || "image/jpeg" });
          }
        },
      },
      {
        text: "Galeria",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permissão negada", "Permita o acesso à galeria nas configurações");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: true,
            aspect: [1, 1],
          });
          if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            onPick({ uri: asset.uri, mimeType: asset.mimeType || "image/jpeg" });
          }
        },
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  if (photo) {
    return (
      <View style={photoStyles.slot}>
        <Image source={{ uri: photo.uri }} style={photoStyles.img as ImageStyle} />
        <TouchableOpacity style={photoStyles.removeBtn} onPress={onRemove}>
          <Text style={photoStyles.removeTxt}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={photoStyles.empty} onPress={handlePick}>
      <HudIcon nome="camera" size={28} color="#F9DA8A" />
      <Text style={photoStyles.emptyLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const makePhotoStyles = (colors: ReturnType<typeof import("../utils/useColors").useColors>) =>
  StyleSheet.create({
    slot: {
      width: 110,
      height: 110,
      borderRadius: radius.md,
      overflow: "hidden",
      position: "relative",
    },
    img: { width: "100%", height: "100%" } as ImageStyle,
    removeBtn: {
      position: "absolute",
      top: spacing.xs,
      right: spacing.xs,
      backgroundColor: "rgba(0,0,0,0.65)",
      borderRadius: radius.md,
      width: 24,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    removeTxt: { color: "#fff", fontSize: fontSize.bodySmall, fontWeight: fontWeight.bold },
    empty: {
      width: 110,
      height: 110,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.gray[600],
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs + 2,
      backgroundColor: colors.dark[900] + "80",
    },
    emptyIcon: { fontSize: 26 },
    emptyLabel: { fontSize: fontSize.micro, color: colors.gray[400], textAlign: "center" },
  });

const makeStyles = (colors: ReturnType<typeof import("../utils/useColors").useColors>) =>
  StyleSheet.create({
    tabs: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.gray[700] + "50",
    },
    tab: { flex: 1, paddingVertical: spacing.md, alignItems: "center" },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.brand[400] },
    tabText: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.gray[400] },
    tabTextActive: { color: colors.brand[400] },
    content: { padding: spacing.lg, paddingBottom: spacing["4xl"] },
    card: {
      backgroundColor: colors.dark[800] + "cc",
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.gray[700] + "60",
      marginBottom: spacing.xl,
      gap: spacing.sm + 2,
    },
    cardTitle: { fontSize: fontSize.body + 1, fontWeight: fontWeight.semibold, color: colors.white, marginBottom: spacing.xs },
    photoLabel: {
      fontSize: fontSize.bodySmall,
      color: colors.gray[400],
      fontWeight: fontWeight.semibold,
      marginTop: spacing.xs,
    },
    photoRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    sectionLabel: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.gray[400],
      marginBottom: spacing.sm + 2,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    productCard: {
      backgroundColor: colors.dark[800] + "cc",
      borderRadius: radius.md + 2,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.gray[700] + "60",
      overflow: "hidden",
    },
    thumbRow: {
      flexDirection: "row",
      gap: 2,
      height: 140,
    },
    thumb: {
      flex: 1,
      height: 140,
    },
    productInfo: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md + 2,
      gap: spacing.md,
    },
    productName: { fontSize: fontSize.body + 1, fontWeight: fontWeight.semibold, color: colors.white },
    productDesc: { fontSize: fontSize.caption, color: colors.gray[400], marginTop: 2 },
    productPrice: { fontSize: fontSize.body + 1, fontWeight: fontWeight.bold, color: colors.brand[400] },
    emptyText: { color: colors.gray[500], textAlign: "center", marginTop: spacing["3xl"], fontSize: fontSize.body },
    aptSelector: {
      flexDirection: "row",
      alignItems: "center",
      margin: spacing.lg,
      backgroundColor: colors.dark[800] + "cc",
      borderRadius: radius.md + 2,
      padding: spacing.md + 2,
      borderWidth: 1,
      borderColor: colors.brand[400] + "50",
      gap: spacing.sm + 2,
    },
    aptSelectorLabel: { fontSize: fontSize.bodySmall, color: colors.gray[400] },
    aptSelectorValue: { flex: 1, fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.brand[400] },
    comandaRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.dark[800] + "cc",
      borderRadius: radius.md + 2,
      padding: spacing.md + 2,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.gray[700] + "60",
      gap: spacing.md,
    },
    comandaThumb: {
      width: spacing["4xl"],
      height: spacing["4xl"],
      borderRadius: radius.sm,
    },
    addComandaBtn: {
      backgroundColor: colors.brand[500],
      borderRadius: radius.sm + 2,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md + 2,
      alignItems: "center",
      minWidth: 90,
    },
    addComandaBtnText: { color: colors.dark[900], fontWeight: fontWeight.bold, fontSize: fontSize.bodySmall },
    addBtnDisabled: { opacity: 0.6 },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    modalBox: {
      backgroundColor: colors.dark[800],
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: "60%",
      paddingBottom: spacing["3xl"],
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.xl,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray[700] + "50",
    },
    modalTitle: { fontSize: fontSize.h3, fontWeight: fontWeight.bold, color: colors.white },
    modalClose: { fontSize: fontSize.h2 - 2, color: colors.gray[400] },
    aptOption: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray[700] + "30",
      gap: spacing.md,
    },
    aptOptionTime: { fontSize: fontSize.h3, fontWeight: fontWeight.bold, color: colors.brand[400], width: 50 },
    aptOptionName: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.white },
    aptOptionServices: { fontSize: fontSize.caption, color: colors.gray[400], marginTop: 2 },
  });

export default function ProductsScreen({ token, role, onBack }: Props) {
  const colors = useColors();
  const photoStyles = useMemo(() => makePhotoStyles(colors), [colors]);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [tab, setTab] = useState<Tab>("catalogo");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulário novo produto
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [photo1, setPhoto1] = useState<PhotoSlot>(null);
  const [photo2, setPhoto2] = useState<PhotoSlot>(null);
  const [adding, setAdding] = useState(false);

  // Editar produto
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [appAlert, setAppAlert] = useState<{ title: string; message?: string; buttons?: AlertButton[] } | null>(null);
  const showAlert = (title: string, message?: string, buttons?: AlertButton[]) => setAppAlert({ title, message, buttons });

  // Comanda
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingApts, setLoadingApts] = useState(false);
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [showAptModal, setShowAptModal] = useState(false);
  const [savingItem, setSavingItem] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getProducts(token);
      setProducts(data.products || []);
    } catch {
      showAlert("Erro", "Não foi possível carregar os produtos");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const fetchAppointments = useCallback(async () => {
    setLoadingApts(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const data = await api.getAppointments(token, today);
      setAppointments(
        (data.appointments || []).filter((a: { status: string }) => a.status !== "cancelled")
      );
    } catch {
      // silently fail
    } finally {
      setLoadingApts(false);
    }
  }, [token]);

  const handleTabChange = (t: Tab) => {
    setTab(t);
    if (t === "comanda" && appointments.length === 0) fetchAppointments();
  };

  const handleAddProduct = async () => {
    if (!newName.trim() || !newPrice) {
      showAlert("Atenção", "Preencha nome e preço");
      return;
    }
    const price = parseFloat(newPrice.replace(",", "."));
    if (isNaN(price) || price <= 0) {
      showAlert("Atenção", "Preço inválido");
      return;
    }
    setAdding(true);
    try {
      let imageUrl: string | undefined;
      let imageUrl2: string | undefined;

      if (photo1) {
        imageUrl = await api.uploadImage(token, photo1.uri, photo1.mimeType);
      }
      if (photo2) {
        imageUrl2 = await api.uploadImage(token, photo2.uri, photo2.mimeType);
      }

      await api.addProduct(token, {
        name: newName.trim(),
        price,
        description: newDesc.trim() || undefined,
        imageUrl,
        imageUrl2,
      });

      setNewName("");
      setNewPrice("");
      setNewDesc("");
      setPhoto1(null);
      setPhoto2(null);
      fetchProducts();
    } catch (e: unknown) {
      showAlert("Erro", e instanceof Error ? e.message : "Não foi possível adicionar o produto");
    } finally {
      setAdding(false);
    }
  };

  const openProductActions = (p: Product) => {
    if (role !== "owner") return;
    showAlert(p.name, "O que deseja fazer?", [
      {
        text: "Editar",
        onPress: () => {
          setEditProduct(p);
          setEditName(p.name);
          setEditPrice(String(p.price));
          setEditDesc(p.description || "");
        },
      },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          showAlert("Excluir produto", `Excluir "${p.name}"?`, [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Excluir",
              style: "destructive",
              onPress: async () => {
                try {
                  await api.deleteProduct(token, p.id);
                  fetchProducts();
                } catch {
                  showAlert("Erro", "Não foi possível excluir");
                }
              },
            },
          ]);
        },
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleSaveEdit = async () => {
    if (!editProduct || !editName.trim() || !editPrice) return;
    const price = parseFloat(editPrice.replace(",", "."));
    if (isNaN(price) || price <= 0) { showAlert("Atenção", "Preço inválido"); return; }
    setSavingEdit(true);
    try {
      await api.updateProduct(token, editProduct.id, { name: editName.trim(), price, description: editDesc.trim() || undefined });
      setEditProduct(null);
      fetchProducts();
    } catch {
      showAlert("Erro", "Não foi possível salvar");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddToComanda = async (product: Product) => {
    if (!selectedApt) {
      showAlert("Atenção", "Selecione um atendimento primeiro");
      return;
    }
    setSavingItem(product.id);
    try {
      await api.addComandaItem(token, selectedApt.id, product.id, 1);
      showAlert("Adicionado!", `${product.name} adicionado à comanda de ${selectedApt.client.name}`);
    } catch {
      showAlert("Erro", "Não foi possível adicionar à comanda");
    } finally {
      setSavingItem(null);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <ScreenHeader title="Produtos" onBack={onBack} />

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === "catalogo" && styles.tabActive]}
            onPress={() => handleTabChange("catalogo")}
          >
            <Text style={[styles.tabText, tab === "catalogo" && styles.tabTextActive]}>Catálogo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === "comanda" && styles.tabActive]}
            onPress={() => handleTabChange("comanda")}
          >
            <Text style={[styles.tabText, tab === "comanda" && styles.tabTextActive]}>Comanda</Text>
          </TouchableOpacity>
        </View>

        {tab === "catalogo" ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Formulário (só owner) */}
            {role === "owner" && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Novo Produto</Text>
                <AppInput
                  placeholder="Nome do produto *"
                  value={newName}
                  onChangeText={setNewName}
                />
                <AppInput
                  placeholder="Preço (ex: 25.00) *"
                  value={newPrice}
                  onChangeText={setNewPrice}
                  keyboardType="decimal-pad"
                />
                <AppInput
                  placeholder="Descrição (opcional)"
                  value={newDesc}
                  onChangeText={setNewDesc}
                />

                {/* Fotos */}
                <Text style={styles.photoLabel}>Fotos do produto (até 2)</Text>
                <View style={styles.photoRow}>
                  <PhotoPicker
                    photo={photo1}
                    onPick={setPhoto1}
                    onRemove={() => setPhoto1(null)}
                    label="Foto 1"
                    photoStyles={photoStyles}
                  />
                  <PhotoPicker
                    photo={photo2}
                    onPick={setPhoto2}
                    onRemove={() => setPhoto2(null)}
                    label="Foto 2"
                    photoStyles={photoStyles}
                  />
                </View>

                <AppButton
                  title={photo1 || photo2 ? "Enviando fotos..." : "Adicionar Produto"}
                  onPress={handleAddProduct}
                  loading={adding}
                  disabled={adding}
                />
              </View>
            )}

            <Text style={styles.sectionLabel}>
              {products.length} produto{products.length !== 1 ? "s" : ""}
            </Text>

            {loading ? (
              <ActivityIndicator color={colors.brand[400]} style={{ marginTop: spacing.xl }} />
            ) : products.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum produto cadastrado</Text>
            ) : (
              products.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.productCard}
                  onPress={() => openProductActions(p)}
                  activeOpacity={role === "owner" ? 0.7 : 1}
                >
                  {/* Miniaturas */}
                  {(p.imageUrl || p.imageUrl2) && (
                    <View style={styles.thumbRow}>
                      {p.imageUrl && (
                        <Image source={{ uri: p.imageUrl }} style={styles.thumb} />
                      )}
                      {p.imageUrl2 && (
                        <Image source={{ uri: p.imageUrl2 }} style={styles.thumb} />
                      )}
                    </View>
                  )}
                  <View style={styles.productInfo}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{p.name}</Text>
                      {!!p.description && (
                        <Text style={styles.productDesc}>{p.description}</Text>
                      )}
                    </View>
                    <Text style={styles.productPrice}>R$ {p.price.toFixed(2)}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Seletor de atendimento */}
            <TouchableOpacity
              style={styles.aptSelector}
              onPress={() => setShowAptModal(true)}
            >
              <Text style={styles.aptSelectorLabel}>Atendimento:</Text>
              <Text style={styles.aptSelectorValue} numberOfLines={1}>
                {selectedApt
                  ? `${selectedApt.startTime} — ${selectedApt.client.name}`
                  : "Selecionar..."}
              </Text>
            </TouchableOpacity>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              {!selectedApt ? (
                <Text style={styles.emptyText}>Selecione um atendimento para adicionar produtos</Text>
              ) : loading ? (
                <ActivityIndicator color={colors.brand[400]} style={{ marginTop: spacing.xl }} />
              ) : products.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum produto cadastrado</Text>
              ) : (
                products.map((p) => (
                  <View key={p.id} style={styles.comandaRow}>
                    {p.imageUrl && (
                      <Image source={{ uri: p.imageUrl }} style={styles.comandaThumb} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{p.name}</Text>
                      <Text style={styles.productPrice}>R$ {p.price.toFixed(2)}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.addComandaBtn, savingItem === p.id && styles.addBtnDisabled]}
                      onPress={() => handleAddToComanda(p)}
                      disabled={savingItem === p.id}
                    >
                      {savingItem === p.id ? (
                        <ActivityIndicator color={colors.dark[900]} size="small" />
                      ) : (
                        <Text style={styles.addComandaBtnText}>+ Comanda</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        )}

        {/* Modal de edição de produto */}
        <Modal visible={!!editProduct} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar Produto</Text>
                <TouchableOpacity onPress={() => setEditProduct(null)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm + 2 }}>
                <AppInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nome do produto"
                />
                <AppInput
                  value={editPrice}
                  onChangeText={setEditPrice}
                  placeholder="Preço"
                  keyboardType="decimal-pad"
                />
                <AppInput
                  value={editDesc}
                  onChangeText={setEditDesc}
                  placeholder="Descrição (opcional)"
                />
                <AppButton
                  title="Salvar"
                  onPress={handleSaveEdit}
                  loading={savingEdit}
                  disabled={savingEdit}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Modal de seleção de atendimento */}
        <Modal visible={showAptModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Selecionar Atendimento</Text>
                <TouchableOpacity onPress={() => setShowAptModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              {loadingApts ? (
                <ActivityIndicator color={colors.brand[400]} style={{ padding: spacing["3xl"] }} />
              ) : appointments.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum atendimento hoje</Text>
              ) : (
                <FlatList
                  data={appointments}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.aptOption}
                      onPress={() => {
                        setSelectedApt(item);
                        setShowAptModal(false);
                      }}
                    >
                      <Text style={styles.aptOptionTime}>{item.startTime}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.aptOptionName}>{item.client.name}</Text>
                        <Text style={styles.aptOptionServices} numberOfLines={1}>
                          {item.services.map((s) => s.name).join(", ")}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
      <AppAlert
        visible={!!appAlert}
        title={appAlert?.title ?? ""}
        message={appAlert?.message}
        buttons={appAlert?.buttons}
        onClose={() => setAppAlert(null)}
      />
    </ScreenBackground>
  );
}
