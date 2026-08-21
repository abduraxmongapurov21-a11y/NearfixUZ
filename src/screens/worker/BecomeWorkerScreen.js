import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ArrowLeft, Camera, CheckCircle2 } from "lucide-react-native";
import { PrimaryButton, SecondaryButton } from "../../components/ui/Button";
import { categories } from "../../constants/categories";
import { ROUTES } from "../../constants/routes";
import { uploadMediaApi } from "../../services/media/mediaService";
import {
  fetchWorkerApplicationApi,
  saveWorkerApplicationApi,
  submitWorkerApplicationApi
} from "../../services/workers/workerService";
import { workerApplicationStatusCopy } from "../../services/workers/workerApplicationState.mjs";
import {
  formatGroupedDigits,
  MAX_WORKER_PROFESSIONS,
  missingWorkerApplicationFields,
  normalizeDigits,
  toggleProfessionSelection,
  workerApplicationErrorMessage,
  workerApplicationPayload
} from "../../services/workers/workerApplicationForm.mjs";
import { useAuthStore } from "../../store/authStore";
import { colors, radius } from "../../theme";
import { Alert, Text, TextInput } from "../../i18n/native";

const emptyForm = {
  name: "",
  cityId: "tashkent",
  professions: [],
  experienceYears: "",
  profileImageUrl: "",
  bio: "",
  basePrice: ""
};

export function BecomeWorkerScreen({ navigation }) {
  const session = useAuthStore((state) => state.session);
  const [form, setForm] = useState(emptyForm);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const requestGeneration = useRef(0);
  const scrollRef = useRef(null);
  const locked = application?.state === "SUBMITTED" || application?.state === "APPROVED";

  useEffect(() => {
    const generation = ++requestGeneration.current;
    if (!session?.token || session.role !== "client") {
      setLoading(false);
      navigation.replace(ROUTES.CLIENT_TABS, { screen: ROUTES.HOME_TAB });
      return undefined;
    }
    const identity = useAuthStore.getState().captureAuthRequest(session.token);
    fetchWorkerApplicationApi(session.token).then((result) => {
      if (generation !== requestGeneration.current || !useAuthStore.getState().isAuthRequestCurrent(identity)) return;
      if (result.ok && result.application) {
        const item = result.application;
        setApplication(item);
        setForm({
          name: item.name || session.name || "",
          cityId: item.cityId || "tashkent",
          professions: item.professions?.length ? item.professions : [item.profession].filter(Boolean),
          experienceYears: item.experienceYears === null ? "" : String(item.experienceYears),
          profileImageUrl: item.profileImageUrl || "",
          bio: item.bio || "",
          basePrice: item.basePrice === null ? "" : String(item.basePrice)
        });
      } else {
        setForm((current) => ({ ...current, name: session.name || "" }));
      }
      setLoading(false);
    });
    return () => { requestGeneration.current += 1; };
  }, [navigation, session?.name, session?.role, session?.token, session?.userId]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleProfession(profession) {
    const next = toggleProfessionSelection(form.professions, profession);
    if (next.limitReached) {
      Alert.alert("Tanlov chegarasi", `Ko'pi bilan ${MAX_WORKER_PROFESSIONS} ta xizmat sohasini tanlash mumkin.`);
      return;
    }
    update("professions", next.professions);
  }

  function revealBioAboveKeyboard() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), Platform.OS === "ios" ? 120 : 220);
  }

  async function pickImage() {
    if (!session?.token || locked || uploading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Ruxsat kerak", "Profil rasmini tanlash uchun galereyaga ruxsat bering.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    const identity = useAuthStore.getState().captureAuthRequest(session.token);
    setUploading(true);
    const asset = result.assets[0];
    const upload = await uploadMediaApi(session.token, {
      uri: asset.uri,
      name: asset.fileName || `worker-application-${Date.now()}.jpg`,
      mimeType: asset.mimeType || "image/jpeg"
    }, { scope: "WORKER_GALLERY" });
    setUploading(false);
    if (!useAuthStore.getState().isAuthRequestCurrent(identity)) return;
    if (upload.ok && upload.media?.url) update("profileImageUrl", upload.media.url);
    else Alert.alert("Rasm yuklanmadi", upload.message || "Qayta urinib ko'ring.");
  }

  async function perform(submit) {
    if (!session?.token || saving || locked) return;
    if (submit) {
      const missing = missingWorkerApplicationFields(form);
      if (missing.length) {
        Alert.alert("Ariza to'liq emas", `Quyidagi maydonlarni to'ldiring: ${missing.join(", ")}.`);
        return;
      }
    }
    const identity = useAuthStore.getState().captureAuthRequest(session.token);
    const generation = ++requestGeneration.current;
    setSaving(true);
    const payload = workerApplicationPayload(form, !submit);
    const result = submit
      ? await submitWorkerApplicationApi(session.token, payload)
      : await saveWorkerApplicationApi(session.token, payload);
    if (generation !== requestGeneration.current || !useAuthStore.getState().isAuthRequestCurrent(identity)) return;
    setSaving(false);
    if (!result.ok) {
      Alert.alert(submit ? "Ariza yuborilmadi" : "Ariza saqlanmadi", workerApplicationErrorMessage(result));
      return;
    }
    setApplication(result.application);
    Alert.alert(submit ? "Ariza yuborildi" : "Ariza saqlandi", submit ? "Admin tekshiruvidan keyin sizga xabar beramiz." : "Keyinroq davom ettirishingiz mumkin.");
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}><ArrowLeft color={colors.text} size={22} /></Pressable>
        <Text style={styles.title}>Usta arizasi</Text><View style={styles.back} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets
      >
        {application?.state ? (
          <View style={styles.status}><CheckCircle2 color={colors.primary} size={20} /><Text style={styles.statusText}>Ariza holati: {workerApplicationStatusCopy(application.state)}</Text></View>
        ) : null}
        {application?.moderationReason ? <Text style={styles.reason}>Admin izohi: {application.moderationReason}</Text> : null}
        <Pressable disabled={locked || uploading} onPress={pickImage} style={styles.photo}>
          {form.profileImageUrl ? <Image source={{ uri: form.profileImageUrl }} style={styles.photoImage} /> : <Camera color={colors.primary} size={30} />}
          <Text style={styles.photoText}>{uploading ? "Rasm yuklanmoqda..." : "Profil rasmini tanlang"}</Text>
        </Pressable>
        <Field label="Ism" value={form.name} onChangeText={(value) => update("name", value)} editable={!locked} />
        <Field label="Shahar" value={form.cityId} onChangeText={(value) => update("cityId", value)} editable={!locked} />
        <Text style={styles.label}>Xizmat sohasi</Text>
        <Text style={styles.hint}>{`Bir yoki bir nechta sohani tanlang — ko'pi bilan ${MAX_WORKER_PROFESSIONS} ta.`}</Text>
        <View style={styles.chips}>{categories.map((item) => {
          const active = form.professions.includes(item.title);
          return <Pressable key={item.id} disabled={locked} onPress={() => toggleProfession(item.title)} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{item.title}</Text></Pressable>;
        })}</View>
        <Field label="Tajriba (yil)" value={form.experienceYears} onChangeText={(value) => update("experienceYears", value.replace(/\D/g, ""))} keyboardType="number-pad" editable={!locked} />
        <Field label="Boshlang'ich narx" value={formatGroupedDigits(form.basePrice)} onChangeText={(value) => update("basePrice", normalizeDigits(value))} keyboardType="number-pad" editable={!locked} />
        <Field label="O'zingiz haqingizda" value={form.bio} onChangeText={(value) => update("bio", value)} onFocus={revealBioAboveKeyboard} multiline editable={!locked} />
        {!locked ? <><SecondaryButton disabled={saving} title="Arizani saqlash" onPress={() => perform(false)} /><PrimaryButton disabled={saving || uploading} title={saving ? "Saqlanmoqda..." : "Arizani yuborish"} onPress={() => perform(true)} /></> : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, ...props }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput placeholder={label} style={[styles.input, props.multiline && styles.multiline]} {...props} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  header: { minHeight: 62, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 19, fontWeight: "900" },
  content: { padding: 18, paddingBottom: 48, gap: 14 },
  status: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.lg, backgroundColor: "#EAF8FC", padding: 14 },
  statusText: { color: colors.text, fontWeight: "800" },
  reason: { color: "#B45309", fontWeight: "700" },
  photo: { minHeight: 150, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 8, overflow: "hidden" },
  photoImage: { width: 96, height: 96, borderRadius: 28 },
  photoText: { color: colors.primary, fontWeight: "800" },
  field: { gap: 7 },
  label: { color: colors.text, fontWeight: "800" },
  hint: { marginTop: -6, color: colors.muted, fontSize: 12, lineHeight: 17 },
  input: { minHeight: 50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: 14, color: colors.text },
  multiline: { minHeight: 110, paddingTop: 14, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { borderColor: colors.primary, backgroundColor: "#EAF8FC" },
  chipText: { color: colors.text, fontWeight: "700" },
  chipTextActive: { color: colors.primary, fontWeight: "900" }
});
