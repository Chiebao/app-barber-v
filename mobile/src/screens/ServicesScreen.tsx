import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "../utils/useColors";
import { api } from "../services/api";
import { ScreenBackground, ScreenHeader, AppButton } from "../components";
import { fontSize, fontWeight, spacing, radius, feedback } from "../utils/tokens";

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  category: string;
  imageUrl?: string | null;
  active: boolean;
}

interface Props {
  token: string;
  onBack: () => void;
}

const CATEGORIES = [
  { key: "corte", label: "Corte" },
  { key: "barba", label: "Barba" },
  { key: "sobrancelha", label: "Sobrancelha" },
  { key: "pezinho", label: "Pezinho" },
  { key: "luzes", label: "Luzes" },
];

const CATEGORY_ICONS: Record<string, string> = {
  corte: "✂️", barba: "🪒", sobrancelha: "👁️", pezinho: "💈", luzes: "✨",
};

const makeStyles = (colors: ReturnType<typeof import("../utils/useColors").useColors>) =>
  StyleSheet.create({
    addHeaderBtn: {
      backgroundColor: colors.brand[500],
      borderRadius: radius.sm + 2,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    addHeaderBtnText: { color: colors.dark[900], fontWeight: fontWeight.bold, fontSize: fontSize.bodySmall },
    content: { padding: spacing.lg },
    group: { marginBottom: spacing.xl },
    groupTitle: {
      fontSize: fontSize.bodySmall,
      fontWeight: fontWeight.semibold,
      color: colors.gray[400],
      marginBottom: spacing.sm + 2,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.dark[800] + "cc",
      borderRadius: radius.md + 2,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.gray[700] + "60",
      gap: spacing.md,
    },
    cardInactive: { opacity: 0.5 },
    thumb: { width: 56, height: 56, borderRadius: radius.sm + 2 },
    thumbPlaceholder: { backgroundColor: colors.gray[700], alignItems: "center", justifyContent: "center" },
    thumbIcon: { fontSize: fontSize.h1 },
    cardInfo: { flex: 1 },
    cardName: { fontSize: fontSize.body + 1, fontWeight: fontWeight.semibold, color: colors.white },
    cardSub: { fontSize: fontSize.caption, color: colors.gray[400], marginTop: 2 },
    textMuted: { color: colors.gray[500] },
    emptyText: { color: colors.gray[500], textAlign: "center", marginTop: spacing["4xl"] },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
    modalBox: {
      backgroundColor: colors.dark[800],
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing["2xl"],
      paddingBottom: spacing["2xl"] + (Platform.OS === "android" ? 24 : 0),
      gap: spacing.md,
      maxHeight: "92%",
    },
    modalTitle: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.white, marginBottom: spacing.xs },
    imagePicker: {
      height: 120,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.gray[700],
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      backgroundColor: colors.dark[900],
    },
    imagePickerImg: { width: "100%", height: "100%" },
    imagePickerText: { color: colors.gray[400], fontSize: fontSize.body },
    input: {
      backgroundColor: colors.dark[900],
      borderWidth: 1,
      borderColor: colors.gray[700],
      borderRadius: radius.md,
      paddingHorizontal: spacing.md + 2,
      paddingVertical: spacing.md - 1,
      color: colors.white,
      fontSize: fontSize.body,
    },
    row: { flexDirection: "row" },
    catChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm - 1,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.gray[700],
      marginRight: spacing.sm,
    },
    catChipActive: { borderColor: colors.brand[400], backgroundColor: colors.brand[500] + "20" },
    catChipText: { fontSize: fontSize.bodySmall, color: colors.gray[400] },
    catChipTextActive: { color: colors.brand[400] },
  });

export default function ServicesScreen({ token, onBack }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<Service | null>(null);
  const [addModal, setAddModal] = useState(false);

  // Add form
  const [newName, setNewName] = useState("");
  const [newDuration, setNewDuration] = useState("30");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("corte");
  const [newImageUri, setNewImageUri] = useState<string | null>(null);
  const [newImageMime, setNewImageMime] = useState("image/jpeg");

  // Edit form
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editImageUri, setEditImageUri] = useState<string | null>(null);
  const [editImageMime, setEditImageMime] = useState("image/jpeg");

  const [saving, setSaving] = useState(false);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getServices(token);
      setServices(data.services || []);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar os serviços");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const pickImage = async (onPicked: (uri: string, mime: string) => void) => {
    Alert.alert("Foto do serviço", "Escolha como adicionar", [
      {
        text: "Câmera", onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permissão negada", "Permita o acesso à câmera"); return; }
          const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [4, 3] });
          if (!res.canceled && res.assets[0]) onPicked(res.assets[0].uri, res.assets[0].mimeType || "image/jpeg");
        },
      },
      {
        text: "Galeria", onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permissão negada", "Permita o acesso à galeria"); return; }
          const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [4, 3] });
          if (!res.canceled && res.assets[0]) onPicked(res.assets[0].uri, res.assets[0].mimeType || "image/jpeg");
        },
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newPrice) { Alert.alert("Atenção", "Preencha nome e preço"); return; }
    setSaving(true);
    try {
      let imageUrl: string | undefined;
      if (newImageUri) imageUrl = await api.uploadImage(token, newImageUri, newImageMime);
      await api.addService(token, {
        name: newName.trim(),
        duration: parseInt(newDuration),
        price: parseFloat(newPrice),
        category: newCategory,
        imageUrl,
      });
      setAddModal(false);
      setNewName(""); setNewDuration("30"); setNewPrice(""); setNewCategory("corte"); setNewImageUri(null);
      fetchServices();
    } catch (e: unknown) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível adicionar");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (s: Service) => {
    setEditModal(s);
    setEditName(s.name);
    setEditDuration(String(s.duration));
    setEditPrice(String(s.price));
    setEditImageUri(null);
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      let imageUrl: string | undefined = undefined;
      if (editImageUri) imageUrl = await api.uploadImage(token, editImageUri, editImageMime);
      await api.updateService(token, editModal.id, {
        name: editName.trim(),
        duration: parseInt(editDuration),
        price: parseFloat(editPrice),
        ...(imageUrl !== undefined && { imageUrl }),
      });
      setEditModal(null);
      fetchServices();
    } catch (e: unknown) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (s: Service) => {
    try {
      await api.updateService(token, s.id, { active: !s.active });
      setServices((prev) => prev.map((x) => x.id === s.id ? { ...x, active: !x.active } : x));
    } catch {
      Alert.alert("Erro", "Não foi possível atualizar");
    }
  };

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: services.filter((s) => s.category === cat.key),
  })).filter((g) => g.items.length > 0);

  return (
    <ScreenBackground>
      <ScreenHeader
        title="Serviços"
        onBack={onBack}
        rightElement={
          <TouchableOpacity onPress={() => setAddModal(true)} style={styles.addHeaderBtn}>
            <Text style={styles.addHeaderBtnText}>+ Novo</Text>
          </TouchableOpacity>
        }
      />

      {loading ? (
        <ActivityIndicator color={colors.brand[400]} style={{ marginTop: spacing["4xl"] }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {grouped.map((group) => (
            <View key={group.key} style={styles.group}>
              <Text style={styles.groupTitle}>{CATEGORY_ICONS[group.key]} {group.label}</Text>
              {group.items.map((s) => (
                <TouchableOpacity key={s.id} style={[styles.card, !s.active && styles.cardInactive]} onPress={() => openEdit(s)}>
                  {s.imageUrl ? (
                    <Image source={{ uri: s.imageUrl }} style={styles.thumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Text style={styles.thumbIcon}>{CATEGORY_ICONS[s.category]}</Text>
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardName, !s.active && styles.textMuted]}>{s.name}</Text>
                    <Text style={styles.cardSub}>R$ {s.price.toFixed(2)} · {s.duration}min</Text>
                  </View>
                  <Switch
                    value={s.active}
                    onValueChange={() => handleToggleActive(s)}
                    trackColor={{ false: colors.gray[700], true: colors.brand[500] }}
                    thumbColor={colors.white}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ))}
          {services.length === 0 && (
            <Text style={styles.emptyText}>Nenhum serviço cadastrado</Text>
          )}
          <View style={{ height: spacing["4xl"] }} />
        </ScrollView>
      )}

      {/* Add Modal */}
      <Modal visible={addModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Novo serviço</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>

              <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage((uri, mime) => { setNewImageUri(uri); setNewImageMime(mime); })}>
                {newImageUri ? (
                  <Image source={{ uri: newImageUri }} style={styles.imagePickerImg} resizeMode="cover" />
                ) : (
                  <Text style={styles.imagePickerText}>📷 Adicionar foto</Text>
                )}
              </TouchableOpacity>

              <TextInput style={[styles.input, { marginBottom: spacing.sm + 2 }]} value={newName} onChangeText={setNewName} placeholder="Nome do serviço *" placeholderTextColor={colors.gray[500]} />
              <View style={[styles.row, { marginBottom: spacing.sm + 2 }]}>
                <TextInput style={[styles.input, { flex: 1 }]} value={newPrice} onChangeText={setNewPrice} placeholder="Preço (R$) *" placeholderTextColor={colors.gray[500]} keyboardType="numeric" />
                <View style={{ width: spacing.sm + 2 }} />
                <TextInput style={[styles.input, { flex: 1 }]} value={newDuration} onChangeText={setNewDuration} placeholder="Minutos" placeholderTextColor={colors.gray[500]} keyboardType="numeric" />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => setNewCategory(cat.key)}
                    style={[styles.catChip, newCategory === cat.key && styles.catChipActive]}
                  >
                    <Text style={[styles.catChipText, newCategory === cat.key && styles.catChipTextActive]}>
                      {CATEGORY_ICONS[cat.key]} {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.row}>
                <AppButton
                  title="Cancelar"
                  variant="secondary"
                  onPress={() => setAddModal(false)}
                  style={{ flex: 1 }}
                />
                <View style={{ width: spacing.sm + 2 }} />
                <AppButton
                  title="Adicionar"
                  onPress={handleAdd}
                  loading={saving}
                  disabled={saving}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={!!editModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Editar serviço</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>

              <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage((uri, mime) => { setEditImageUri(uri); setEditImageMime(mime); })}>
                {editImageUri ? (
                  <Image source={{ uri: editImageUri }} style={styles.imagePickerImg} resizeMode="cover" />
                ) : editModal?.imageUrl ? (
                  <Image source={{ uri: editModal.imageUrl }} style={styles.imagePickerImg} resizeMode="cover" />
                ) : (
                  <Text style={styles.imagePickerText}>📷 Adicionar foto</Text>
                )}
              </TouchableOpacity>

              <TextInput style={[styles.input, { marginBottom: spacing.sm + 2 }]} value={editName} onChangeText={setEditName} placeholder="Nome *" placeholderTextColor={colors.gray[500]} />
              <View style={[styles.row, { marginBottom: spacing.lg }]}>
                <TextInput style={[styles.input, { flex: 1 }]} value={editPrice} onChangeText={setEditPrice} placeholder="Preço (R$)" placeholderTextColor={colors.gray[500]} keyboardType="numeric" />
                <View style={{ width: spacing.sm + 2 }} />
                <TextInput style={[styles.input, { flex: 1 }]} value={editDuration} onChangeText={setEditDuration} placeholder="Minutos" placeholderTextColor={colors.gray[500]} keyboardType="numeric" />
              </View>

              <View style={styles.row}>
                <AppButton
                  title="Cancelar"
                  variant="secondary"
                  onPress={() => setEditModal(null)}
                  style={{ flex: 1 }}
                />
                <View style={{ width: spacing.sm + 2 }} />
                <AppButton
                  title="Salvar"
                  onPress={handleSaveEdit}
                  loading={saving}
                  disabled={saving}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenBackground>
  );
}
