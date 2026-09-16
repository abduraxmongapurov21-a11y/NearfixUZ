import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { ArrowLeft, Check, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ROUTES } from "../../constants/routes";
import { Alert, Text, TextInput } from "../../i18n/native";
import { categoryName } from "../../services/content/categoryService";
import { useWorkerStore } from "../../store/workerStore";
import { colors, radius } from "../../theme";
import { normalizeWorkerPhone } from "../../utils/workerPhone.mjs";

const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extra: "Inter_800ExtraBold"
};

export function WorkerCreateOrderScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const worker = useWorkerStore((state) => state.workerProfile);
  const activeJob = useWorkerStore((state) => state.activeJob);
  const syncWorkerFromApi = useWorkerStore((state) => state.syncWorkerFromApi);
  const createPhoneOrder = useWorkerStore((state) => state.createPhoneOrder);
  const categories = useMemo(
    () => (Array.isArray(worker?.categories) ? worker.categories.filter((item) => item?.isActive !== false) : []),
    [worker?.categories]
  );
  const [clientPhone, setClientPhone] = useState("");
  const [clientName, setClientName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [addressText, setAddressText] = useState("");
  const [district, setDistrict] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!worker) syncWorkerFromApi();
  }, [syncWorkerFromApi, worker]);

  useEffect(() => {
    if (!categoryId && categories[0]?.id) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  async function handleSubmit() {
    if (submitting) return;
    if (activeJob) {
      setError(t("Sizda faol buyurtma bor."));
      return;
    }

    const normalizedPhone = normalizeWorkerPhone(clientPhone);
    if (!normalizedPhone) {
      setError(t("Telefon raqamni to'liq kiriting."));
      return;
    }
    if (!categoryId) {
      setError(t("Xizmat turini tanlang."));
      return;
    }
    if (description.trim().length < 3) {
      setError(t("Ish tavsifini kiriting."));
      return;
    }
    if (addressText.trim().length < 4) {
      setError(t("Manzilni kiriting."));
      return;
    }

    const cleanPrice = price.trim().replace(/\s/g, "");
    if (cleanPrice && (!/^\d+$/.test(cleanPrice) || Number(cleanPrice) <= 0)) {
      setError(t("Narx musbat son bo'lishi kerak."));
      return;
    }

    setError("");
    setSubmitting(true);
    const result = await createPhoneOrder({
      clientPhone: normalizedPhone,
      clientName: clientName.trim() || undefined,
      categoryId,
      description: description.trim(),
      addressText: addressText.trim(),
      district: district.trim() || undefined,
      priceEstimate: cleanPrice ? Number(cleanPrice) : undefined
    });
    setSubmitting(false);

    if (!result?.ok) {
      if (!result?.stale) setError(result?.message || t("Buyurtma yaratilmadi. Qayta urinib ko'ring."));
      return;
    }

    Alert.alert("Buyurtma yaratildi", "Buyurtma faol ishlaringizga qo'shildi.");
    navigation.navigate(ROUTES.WORKER_TABS, {
      screen: ROUTES.WORKER_JOBS_TAB,
      params: { orderId: result.order.id }
    });
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={22} color="#1F1E42" strokeWidth={2.7} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Buyurtma yaratish</Text>
          <Text style={styles.subtitle}>Telefon orqali buyurtma</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Ilovadan tashqarida bog'langan mijoz uchun buyurtma yarating.</Text>

        <Field label="Mijoz telefoni">
          <TextInput
            autoCapitalize="none"
            keyboardType="phone-pad"
            onChangeText={setClientPhone}
            placeholder="+998 90 123 45 67"
            style={styles.input}
            value={clientPhone}
          />
        </Field>

        <Field label="Mijoz ismi (ixtiyoriy)">
          <TextInput onChangeText={setClientName} placeholder="Mijoz ismi" style={styles.input} value={clientName} />
        </Field>

        <View style={styles.field}>
          <Text style={styles.label}>Xizmat turi</Text>
          <View style={styles.chips}>
            {categories.map((category) => {
              const selected = category.id === categoryId;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => setCategoryId(category.id)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  {selected ? <Check size={14} color="#FFFFFF" strokeWidth={2.8} /> : null}
                  <Text translate={false} style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {categoryName(category, i18n.language)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {!categories.length ? <Text style={styles.helper}>Profilga biriktirilgan faol xizmat topilmadi.</Text> : null}
        </View>

        <Field label="Ish tavsifi">
          <TextInput
            multiline
            onChangeText={setDescription}
            placeholder="Bajariladigan ishni qisqacha yozing"
            style={[styles.input, styles.textArea]}
            textAlignVertical="top"
            value={description}
          />
        </Field>

        <Field label="Manzil">
          <TextInput
            multiline
            onChangeText={setAddressText}
            placeholder="Ko'cha, uy va mo'ljal"
            style={[styles.input, styles.addressInput]}
            textAlignVertical="top"
            value={addressText}
          />
        </Field>

        <Field label="Tuman (ixtiyoriy)">
          <TextInput onChangeText={setDistrict} placeholder="Tuman" style={styles.input} value={district} />
        </Field>

        <Field label="Kelishilgan narx (ixtiyoriy)">
          <TextInput keyboardType="number-pad" onChangeText={setPrice} placeholder="Masalan: 150000" style={styles.input} value={price} />
        </Field>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={submitting || !categories.length}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            (submitting || !categories.length) && styles.submitButtonDisabled,
            pressed && styles.pressed
          ]}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Plus size={18} color="#FFFFFF" strokeWidth={2.8} />}
          <Text style={styles.submitText}>{submitting ? "Yaratilmoqda..." : "Buyurtma yaratish"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F8FC"
  },
  header: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E4EAF2",
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#F1F4F8",
    alignItems: "center",
    justifyContent: "center"
  },
  headerCopy: {
    flex: 1
  },
  title: {
    color: "#07122B",
    fontSize: 20,
    fontFamily: font.extra
  },
  subtitle: {
    marginTop: 2,
    color: "#667894",
    fontSize: 12,
    fontFamily: font.medium
  },
  content: {
    padding: 20,
    paddingBottom: 44
  },
  intro: {
    marginBottom: 18,
    color: "#667894",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: font.medium
  },
  field: {
    marginBottom: 16
  },
  label: {
    marginBottom: 7,
    color: "#1F2A44",
    fontSize: 13,
    fontFamily: font.bold
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#DCE4EE",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 15,
    color: "#07122B",
    fontSize: 14,
    fontFamily: font.medium
  },
  textArea: {
    minHeight: 104,
    paddingTop: 13
  },
  addressInput: {
    minHeight: 76,
    paddingTop: 13
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#DCE4EE",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  chipSelected: {
    borderColor: "#1F1E42",
    backgroundColor: "#1F1E42"
  },
  chipText: {
    color: "#52627A",
    fontSize: 12,
    fontFamily: font.bold
  },
  chipTextSelected: {
    color: "#FFFFFF"
  },
  helper: {
    marginTop: 8,
    color: colors.danger,
    fontSize: 12,
    fontFamily: font.medium
  },
  error: {
    marginBottom: 14,
    borderRadius: 12,
    backgroundColor: "#FEECEC",
    padding: 12,
    color: "#B42318",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: font.semi
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#18A850",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  submitButtonDisabled: {
    backgroundColor: "#A9B5C5"
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: font.extra
  },
  pressed: {
    opacity: 0.78
  }
});
