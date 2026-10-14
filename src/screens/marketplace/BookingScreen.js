import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { ArrowRight, Check, ChevronRight, Info, MapPin, X } from "lucide-react-native";
import { ROUTES } from "../../constants/routes";
import { WORKER_STATUS } from "../../constants/workerStatus";
import { useClientStore } from "../../store/clientStore";
import { useWorkerById } from "../../hooks/useWorkerById";
import { openClientTab } from "../../navigation/clientTabNavigation";
import {
  bookingLocationDraft,
  bookingProblemOptions,
  categoryBookingDraft,
  createBookingSubmissionLock,
  createOrderThenOptionallySave,
  normalizeBookingMapSelection,
  orderLocationDisplayText,
  sortBookingAddresses
} from "../../services/orders/bookingLocation.mjs";
import { Alert, Text, TextInput } from "../../i18n/native";
import { CategoryAvailabilityState } from "../../components/category/CategoryAvailabilityState";
import { resolveCategoryRoute } from "../../services/content/categoryAvailability.mjs";

import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoryName } from "../../services/content/categoryService";
import { WorkerAvatar } from "../../components/ui/WorkerAvatar";
import { ClientHeader } from "../../components/client/ClientHeader";
import { colors, font, radius, shadow } from "../../theme/clientTheme";

function getDefaultAddress(addresses) {
  return addresses.find((address) => address.isDefault) || addresses[0];
}

export function BookingScreen({ navigation, route }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const savedAddresses = useClientStore((state) => state.savedAddresses);
  const updateOrderDraft = useClientStore((state) => state.updateOrderDraft);
  const resetOrderDraft = useClientStore((state) => state.resetOrderDraft);
  const createOrderFromDraft = useClientStore((state) => state.createOrderFromDraft);
  const createAddress = useClientStore((state) => state.createAddress);
  const syncClientProfileFromApi = useClientStore((state) => state.syncClientProfileFromApi);
  const worker = useWorkerById(route.params?.workerId);
  const categories = useClientStore((state) => state.categories);
  const syncCategoriesFromApi = useClientStore((state) => state.syncCategoriesFromApi);
  const categoryStatus = useClientStore((state) => state.categoryStatus);
  const categoryError = useClientStore((state) => state.categoryError);
  const categoriesLastLoadedAt = useClientStore((state) => state.categoriesLastLoadedAt);
  const categoryId = route.params?.categoryId || worker?.categoryIds?.[0];
  const category = categories.find((item) => item.id === categoryId);
  const categoryResolution = resolveCategoryRoute(
    { categories, status: categoryStatus, lastLoadedAt: categoriesLastLoadedAt },
    categoryId,
    false
  );

  const [selectedProblem, setSelectedProblem] = useState("");
  const [otherProblem, setOtherProblem] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState(getDefaultAddress(savedAddresses)?.id);
  const [oneTimeLocation, setOneTimeLocation] = useState(null);
  const [saveOneTimeLocation, setSaveOneTimeLocation] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const submissionLockRef = useRef(createBookingSubmissionLock());

  useEffect(() => {
    syncClientProfileFromApi();
    syncCategoriesFromApi();
  }, [syncCategoriesFromApi, syncClientProfileFromApi]);

  useEffect(() => {
    if (!oneTimeLocation && !selectedAddressId && savedAddresses.length) {
      setSelectedAddressId(getDefaultAddress(savedAddresses)?.id);
    }
  }, [oneTimeLocation, savedAddresses, selectedAddressId]);

  useEffect(() => {
    const selectedLocation = route.params?.selectedBookingLocation;
    if (!selectedLocation) return;
    const normalized = normalizeBookingMapSelection(selectedLocation);
    navigation.setParams({ selectedBookingLocation: undefined });
    if (!normalized) {
      Alert.alert("Manzil kerak", "Xaritadan yaroqli nuqta tanlang.");
      return;
    }
    setOneTimeLocation(normalized);
    setSelectedAddressId(null);
    setSaveOneTimeLocation(false);
    setAddressModalOpen(false);
  }, [navigation, route.params?.selectedBookingLocation]);

  const problemOptions = useMemo(() => bookingProblemOptions(category), [category]);
  const orderedAddresses = useMemo(() => sortBookingAddresses(savedAddresses), [savedAddresses]);
  const selectedSavedAddress = useMemo(
    () =>
      orderedAddresses.find((address) => address.id === selectedAddressId) ||
      (!oneTimeLocation ? orderedAddresses[0] : null),
    [oneTimeLocation, orderedAddresses, selectedAddressId]
  );
  const selectedLocation = oneTimeLocation || selectedSavedAddress;
  const isOtherProblem = selectedProblem === "Boshqa";
  const basePrice = Number(worker?.basePriceValue);
  const displayedPrice =
    Number.isFinite(basePrice) && basePrice > 0
      ? `${basePrice.toLocaleString(i18n.language === "en" ? "en-US" : i18n.language === "ru" ? "ru-RU" : "uz-UZ")} ${t("so'm")}`
      : t("Kelishiladi");

  async function handleRefresh() {
    setRefreshing(true);
    await syncClientProfileFromApi();
    setRefreshing(false);
  }

  function validate() {
    if (!worker?.id) {
      Alert.alert("Usta tanlanmagan", "Buyurtma berish uchun usta tanlang.");
      return false;
    }
    if (!categoryId || !category) {
      Alert.alert("Category tanlanmagan", "Buyurtma uchun faol category tanlang.");
      return false;
    }

    if (worker.availability !== WORKER_STATUS.AVAILABLE) {
      Alert.alert("Usta hozir mavjud emas", "Iltimos, buyurtma uchun boshqa mavjud ustani tanlang.");
      return false;
    }

    if (!selectedProblem) {
      Alert.alert("Muammo tanlang", "Buyurtmani yuborish uchun muammo turini tanlang.");
      return false;
    }

    if (isOtherProblem && otherProblem.trim().length < 3) {
      Alert.alert("Muammoni qisqa yozing", "Boshqa muammo uchun kamida 3 ta belgi kiriting.");
      return false;
    }

    if (!selectedLocation) {
      Alert.alert("Manzil kerak", "Buyurtma uchun manzil tanlang.");
      return false;
    }

    return true;
  }

  async function handleSubmit() {
    if (!submissionLockRef.current.acquire()) return;
    if (!validate()) {
      submissionLockRef.current.release();
      return;
    }

    setSubmitting(true);

    try {
      const problemTitle = isOtherProblem ? otherProblem.trim() : selectedProblem;
      const locationDraft = bookingLocationDraft(selectedSavedAddress, oneTimeLocation);
      if (!locationDraft) throw new Error("Buyurtma uchun manzil tanlang.");

      const bookingDraft = categoryBookingDraft({ category, worker, problemTitle, locationDraft });
      if (!bookingDraft) throw new Error("Buyurtma ma'lumotlari to'liq emas.");
      updateOrderDraft(bookingDraft);

      const { orderResult: result, saveResult } = await createOrderThenOptionallySave({
        createOrder: createOrderFromDraft,
        shouldSave: Boolean(oneTimeLocation?.addressText.length >= 4 && saveOneTimeLocation),
        saveAddress: () =>
          createAddress({
            title: `Manzil ${savedAddresses.length + 1}`,
            address: oneTimeLocation.addressText,
            district: oneTimeLocation.district,
            lat: oneTimeLocation.latitude,
            lng: oneTimeLocation.longitude
          })
      });

      if (!result.ok) {
        if (result.code === "REQUEST_TIMEOUT") {
          Alert.alert(
            "Buyurtma holati tasdiqlanmadi",
            "Serverdan javob kelmadi. Buyurtma yaratilgan bo'lishi mumkin. Qayta yuborishdan oldin Buyurtmalar bo'limini tekshiring."
          );
          return;
        }
        throw new Error(result.message || "Buyurtma yaratilmadi");
      }

      resetOrderDraft({
        selectedWorkerId: worker.id,
        serviceId: categoryId,
        addressId: null,
        address: "",
        location: null
      });

      openClientTab(navigation, ROUTES.ORDERS_TAB, { orderId: result.order.id });
      if (saveResult && !saveResult.ok) {
        Alert.alert("Manzil saqlanmadi", "Buyurtma yaratildi, ammo manzil Manzillarimga saqlanmadi.");
      }
    } catch (error) {
      Alert.alert(
        "Buyurtma yuborilmadi",
        error?.message || "Internet yoki server holatini tekshirib qayta urinib ko'ring."
      );
    } finally {
      submissionLockRef.current.release();
      setSubmitting(false);
    }
  }

  function openMapPicker() {
    setAddressModalOpen(false);
    const initial = oneTimeLocation || selectedSavedAddress;
    navigation.navigate(ROUTES.MAP_PICKER, {
      returnTo: ROUTES.BOOKING,
      returnParamKey: "selectedBookingLocation",
      initialCoordinate:
        typeof initial?.latitude === "number" && typeof initial?.longitude === "number"
          ? {
              latitude: initial.latitude,
              longitude: initial.longitude,
              ...(initial.addressText ? { address: initial.addressText } : {}),
              ...(initial.district ? { district: initial.district } : {})
            }
          : undefined
    });
  }

  function openAddressChoices() {
    if (!orderedAddresses.length) {
      openMapPicker();
      return;
    }
    setAddressModalOpen(true);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <ClientHeader
        title="Buyurtma berish"
        subtitle="Xizmat tafsilotlarini kiriting"
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <CategoryAvailabilityState
          status={
            categoryResolution.kind === "pending"
              ? "loading"
              : categoryResolution.reason === "empty"
                ? "empty"
                : categoryResolution.kind === "ready"
                  ? categoryStatus
                  : "error"
          }
          error={
            categoryResolution.reason === "invalid" ? "Tanlangan kategoriya faol emas yoki mavjud emas." : categoryError
          }
          hasData={categoryResolution.kind === "ready"}
          onRetry={syncCategoriesFromApi}
        />
        {worker ? (
          <View style={styles.summaryCard}>
            <View style={styles.workerRow}>
              <WorkerAvatar worker={worker} size={54} radius={18} />
              <View style={styles.workerCopy}>
                <Text style={styles.eyebrow}>Tanlangan usta</Text>
                <Text translate={false} style={styles.workerName}>
                  {worker.name}
                </Text>
                <Text translate={false} style={styles.workerCategory}>
                  {categoryName(category, i18n.language)}
                </Text>
              </View>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Boshlang'ich narx</Text>
              <Text translate={false} style={styles.priceValue}>
                {displayedPrice}
              </Text>
            </View>
            <View style={styles.priceNoteRow}>
              <Info size={16} color={colors.muted} strokeWidth={1.8} />
              <Text style={styles.priceNote}>Yakuniy narx ish hajmiga qarab usta bilan kelishiladi.</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text translate={false} style={styles.stepText}>
                1
              </Text>
            </View>
            <Text style={styles.cardTitle}>Muammo tanlang</Text>
          </View>
          <View style={styles.problemGrid} accessibilityRole="radiogroup">
            {problemOptions.map((problem) => {
              const active = selectedProblem === problem;
              return (
                <Pressable
                  key={problem}
                  accessibilityRole="radio"
                  accessibilityLabel={t(problem)}
                  accessibilityState={{ checked: active, disabled: submitting }}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.problemChip,
                    active && styles.problemChipActive,
                    pressed && styles.pressed
                  ]}
                  onPress={() => setSelectedProblem(problem)}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={[styles.problemText, active && styles.problemTextActive]}>{problem}</Text>
                </Pressable>
              );
            })}
          </View>
          {isOtherProblem ? (
            <View style={styles.otherInputWrap}>
              <TextInput
                value={otherProblem}
                onChangeText={(value) => setOtherProblem(value.slice(0, 80))}
                editable={!submitting}
                accessibilityLabel="Muammoni qisqa yozing"
                placeholder="Muammoni qisqa yozing"
                placeholderTextColor={colors.subtle}
                style={styles.otherInput}
                multiline
                maxLength={80}
                textAlignVertical="top"
              />
              <Text translate={false} style={styles.inputCount}>
                {otherProblem.length}/80
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text translate={false} style={styles.stepText}>
                2
              </Text>
            </View>
            <Text style={styles.cardTitle}>Qayerga usta chaqiramiz?</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Manzil tanlang")}
            disabled={submitting}
            style={({ pressed }) => [styles.addressBox, pressed && styles.pressed]}
            onPress={openAddressChoices}
          >
            <View style={styles.addressIcon}>
              <MapPin size={22} color={colors.primary} strokeWidth={1.8} />
            </View>
            <View style={styles.addressTextWrap}>
              <Text translate={Boolean(oneTimeLocation || !selectedSavedAddress?.label)} style={styles.addressTitle}>
                {oneTimeLocation ? "Bir martalik manzil" : selectedSavedAddress?.label || "Manzil"}
              </Text>
              <Text
                translate={!selectedLocation || Boolean(oneTimeLocation && !oneTimeLocation.addressText)}
                style={styles.addressText}
                numberOfLines={2}
              >
                {oneTimeLocation
                  ? orderLocationDisplayText(oneTimeLocation)
                  : selectedSavedAddress?.addressText || selectedSavedAddress?.address || "Xaritadan manzil tanlang"}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.subtle} strokeWidth={1.8} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={openAddressChoices}
            style={styles.changeAddress}
          >
            <Text style={styles.addText}>O'zgartirish</Text>
          </Pressable>
          {oneTimeLocation?.addressText.length >= 4 ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={t("Manzillarimga saqlash")}
              accessibilityState={{ checked: saveOneTimeLocation, disabled: submitting }}
              disabled={submitting}
              onPress={() => setSaveOneTimeLocation((value) => !value)}
              style={styles.saveAddressRow}
            >
              <View style={[styles.checkbox, saveOneTimeLocation && styles.checkboxActive]}>
                {saveOneTimeLocation ? <Check size={15} color={colors.white} strokeWidth={2} /> : null}
              </View>
              <Text style={styles.saveAddressText}>Manzillarimga saqlash</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      <View style={styles.ctaBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(submitting ? "Yuborilmoqda..." : "Buyurtmani yuborish")}
          accessibilityState={{ disabled: submitting, busy: submitting }}
          style={({ pressed }) => [
            styles.confirmButton,
            submitting && styles.confirmButtonDisabled,
            pressed && styles.pressed
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Text style={styles.confirmText}>Buyurtmani yuborish</Text>
              <ArrowRight size={20} color={colors.white} strokeWidth={1.8} />
            </>
          )}
        </Pressable>
      </View>
      <AddressModal
        visible={addressModalOpen}
        addresses={orderedAddresses}
        selectedAddressId={oneTimeLocation ? null : selectedSavedAddress?.id}
        onClose={() => setAddressModalOpen(false)}
        onSelect={(address) => {
          setSelectedAddressId(address.id);
          setOneTimeLocation(null);
          setSaveOneTimeLocation(false);
          setAddressModalOpen(false);
        }}
        onMap={openMapPicker}
      />
    </KeyboardAvoidingView>
  );
}

function AddressModal({ visible, addresses, selectedAddressId, onClose, onSelect, onMap }) {
  const { t } = useTranslation();
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()} accessibilityViewIsModal>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Manzil tanlang</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Yopish")}
              onPress={onClose}
              style={styles.closeButton}
            >
              <X size={21} color={colors.muted} strokeWidth={1.8} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.addressList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.addressListContent}
          >
            {!addresses.length ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyTitle}>Manzillar yo'q</Text>
                <Text style={styles.modalEmptyText}>Xaritadan yangi manzil tanlab buyurtmani davom ettiring.</Text>
              </View>
            ) : null}
            <View accessibilityRole="radiogroup" style={styles.addressListContent}>
              {addresses.map((address) => {
                const active = selectedAddressId === address.id;
                return (
                  <Pressable
                    key={address.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`${address.label || t("Manzil")}, ${address.addressText || address.address || ""}`}
                    accessibilityState={{ checked: active }}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => onSelect(address)}
                  >
                    <View style={styles.optionIcon}>
                      <MapPin size={19} color={colors.primary} strokeWidth={1.8} />
                    </View>
                    <View style={styles.optionBody}>
                      <Text translate={!address.label} style={styles.optionTitle}>
                        {address.label || "Manzil"}
                      </Text>
                      <Text translate={false} style={styles.optionText} numberOfLines={2}>
                        {address.addressText || address.address}
                      </Text>
                    </View>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? <View style={styles.radioDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <Pressable accessibilityRole="button" style={styles.mapOption} onPress={onMap}>
            <View style={styles.optionIcon}>
              <MapPin size={19} color={colors.primary} strokeWidth={1.8} />
            </View>
            <Text style={styles.mapOptionText}>Xaritadan boshqa manzil tanlash</Text>
            <ChevronRight size={20} color={colors.primary} strokeWidth={1.8} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 24, gap: 16 },
  summaryCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    ...shadow
  },
  workerRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  workerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.muted, fontSize: 11, fontFamily: font.medium, marginBottom: 4 },
  workerName: { color: colors.text, fontSize: 18, lineHeight: 24, fontFamily: font.bold },
  workerCategory: { marginTop: 3, color: colors.primary, fontSize: 13, lineHeight: 19, fontFamily: font.medium },
  priceRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 17,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  priceLabel: { color: colors.muted, fontSize: 13, fontFamily: font.medium, flex: 1 },
  priceValue: { color: colors.text, fontSize: 18, fontFamily: font.bold, flexShrink: 1 },
  priceNoteRow: { marginTop: 10, flexDirection: "row", alignItems: "flex-start", gap: 7 },
  priceNote: { color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: font.regular, flex: 1 },
  formCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    ...shadow
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center"
  },
  stepText: { color: colors.primary, fontFamily: font.bold, fontSize: 12 },
  cardTitle: { color: colors.text, fontSize: 17, lineHeight: 23, fontFamily: font.bold, flex: 1, letterSpacing: -0.3 },
  problemGrid: { gap: 9 },
  problemChip: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  problemChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.subtle,
    justifyContent: "center",
    alignItems: "center"
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  problemText: { color: colors.text, fontSize: 14, lineHeight: 20, fontFamily: font.medium, flex: 1 },
  problemTextActive: { color: colors.primary, fontFamily: font.semi },
  otherInputWrap: { marginTop: 12 },
  otherInput: {
    minHeight: 100,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 14,
    paddingBottom: 30,
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: font.regular
  },
  inputCount: {
    position: "absolute",
    bottom: 10,
    right: 12,
    color: colors.muted,
    fontSize: 11,
    fontFamily: font.medium
  },
  addressBox: {
    minHeight: 86,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  addressIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  addressTextWrap: { flex: 1, minWidth: 0 },
  addressTitle: { color: colors.text, fontSize: 14, lineHeight: 21, fontFamily: font.semi },
  addressText: { marginTop: 3, color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: font.regular },
  changeAddress: { alignSelf: "flex-end", minHeight: 44, justifyContent: "center", paddingHorizontal: 3 },
  addText: { color: colors.primary, fontSize: 13, fontFamily: font.semi },
  saveAddressRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.subtle,
    alignItems: "center",
    justifyContent: "center"
  },
  checkboxActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  saveAddressText: { color: colors.text, fontSize: 13, fontFamily: font.medium, flex: 1 },
  ctaBar: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 18,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  confirmButton: {
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12
  },
  confirmButtonDisabled: { opacity: 0.65 },
  confirmText: { color: colors.white, fontSize: 16, lineHeight: 23, fontFamily: font.semi },
  pressed: { opacity: 0.78 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(23,44,56,0.38)" },
  modalSheet: {
    maxHeight: "78%",
    marginHorizontal: 14,
    marginBottom: 28,
    borderRadius: radius.xxl,
    backgroundColor: colors.white,
    padding: 18,
    gap: 10
  },
  modalHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 2
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  modalTitle: { color: colors.text, fontSize: 20, fontFamily: font.bold, flex: 1 },
  closeButton: {
    width: 44,
    height: 44,
    backgroundColor: colors.background,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  addressList: { flexGrow: 0 },
  addressListContent: { gap: 10 },
  modalEmpty: { borderRadius: radius.lg, backgroundColor: colors.background, padding: 16 },
  modalEmptyTitle: { color: colors.text, fontSize: 15, fontFamily: font.semi },
  modalEmptyText: { marginTop: 6, color: colors.muted, fontSize: 13, lineHeight: 20, fontFamily: font.regular },
  optionRow: {
    minHeight: 76,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  optionRowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  optionBody: { flex: 1, minWidth: 0 },
  optionTitle: { color: colors.text, fontSize: 14, fontFamily: font.semi },
  optionText: { marginTop: 4, color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: font.regular },
  mapOption: {
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  mapOptionText: { flex: 1, color: colors.primary, fontSize: 13, lineHeight: 20, fontFamily: font.semi }
});
