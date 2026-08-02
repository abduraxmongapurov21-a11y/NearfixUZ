import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import {
  Bell,
  Camera,
  CheckCircle2,
  CircleHelp,
  FileText,
  LogOut,
  MapPin,
  Shield,
  ShieldCheck,
  Trash2,
  UserRound
} from "lucide-react-native";
import { CITIES } from "../../constants/catalog";
import { ROUTES } from "../../constants/routes";
import { uploadMediaApi } from "../../services/media/mediaService";
import { fetchUnreadNotificationCountApi } from "../../services/notifications/notificationService";
import { useAuthStore } from "../../store/authStore";
import { useWorkerStore } from "../../store/workerStore";
import { colors, radius, shadow } from "../../theme";
import { openPrivacyPolicy, openTerms } from "../../utils/legalLinks";
import { Alert, Text, TextInput } from "../../i18n/native";
import { LanguageSelector } from "../../components/profile/LanguageSelector";
import { useTranslation } from "react-i18next";
import {
  buildServiceLocationPayload,
  createSubmissionGuard,
  normalizeServiceLocation,
  submitServiceLocationOnce
} from "../../services/workers/serviceLocation.mjs";

const serviceOptions = ["Santexnik", "Elektrik", "Payvandchi", "Usta", "Konditsioner", "Ta'mirlash", "Tozalash"];

function getInitials(value) {
  return String(value || "NF")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getStatusMeta(status) {
  switch (status) {
    case "approved":
      return {
        label: "Tasdiqlangan",
        title: "Profil tasdiqlangan",
        text: "Siz katalogda ko'rinasiz va buyurtma qabul qilishingiz mumkin.",
        color: colors.success
      };
    case "rejected":
      return {
        label: "Rad etilgan",
        title: "Profil rad etilgan",
        text: "Qo'llab-quvvatlash jamoasi bilan bog'laning.",
        color: colors.danger
      };
    case "submitted":
    case "pending":
    case "review":
      return {
        label: "Tekshiruvda",
        title: "Tekshiruv kutilmoqda",
        text: "Ma'lumotlaringiz ko'rib chiqilgandan keyin profil katalogda ko'rinadi.",
        color: "#F59E0B"
      };
    default:
      return {
        label: "To'ldirilmoqda",
        title: "Profil to'ldirilmoqda",
        text: "Admin tekshiruvi uchun kerakli ma'lumotlarni kiriting.",
        color: "#F59E0B"
      };
  }
}

function cityName(cityId) {
  return CITIES.find((city) => city.id === cityId)?.name || "Shahar tanlanmagan";
}

function formatLocationUpdatedAt(value, language) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const locale = language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "uz-UZ";
  return date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

export function WorkerProfileManageScreen({ navigation, route }) {
  const { t, i18n } = useTranslation();
  const token = useAuthStore((state) => state.session?.token);
  const logout = useAuthStore((state) => state.logout);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const sessionPhone = useAuthStore((state) => state.session?.phone);
  const worker = useWorkerStore((state) => state.workerProfile);
  const profileSyncStatus = useWorkerStore((state) => state.profileSyncStatus);
  const syncWorkerFromApi = useWorkerStore((state) => state.syncWorkerFromApi);
  const submitWorkerProfile = useWorkerStore((state) => state.submitWorkerProfile);
  const saveServiceLocation = useWorkerStore((state) => state.saveServiceLocation);
  const clearUserData = useWorkerStore((state) => state.clearUserData);
  const [name, setName] = useState(worker?.name || "");
  const [experienceYears, setExperienceYears] = useState(String(worker?.experienceYears || ""));
  const [basePrice, setBasePrice] = useState(worker?.basePriceValue ? String(worker.basePriceValue) : "");
  const [bio, setBio] = useState(worker?.about || "");
  const [profileImageUrl, setProfileImageUrl] = useState(worker?.profileImageUrl || "");
  const [cityId, setCityId] = useState(worker?.cityId || "");
  const [selectedServices, setSelectedServices] = useState(worker?.professions || [worker?.specialty].filter(Boolean));
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [pendingServiceLocation, setPendingServiceLocation] = useState(null);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState(null);
  const locationSubmissionGuard = useRef(createSubmissionGuard());
  const isApproved = worker?.status === "approved";
  const statusMeta = useMemo(() => getStatusMeta(worker?.status), [worker?.status]);
  const servicesText = selectedServices.length ? selectedServices.join(", ") : "Soha tanlanmagan";
  const priceText = basePrice ? `${Number(basePrice || 0).toLocaleString("uz-UZ")} so'm` : "Narx kiritilmagan";
  const phone = worker?.phone || sessionPhone || "Telefon kiritilmagan";
  const savedServiceLocation = useMemo(
    () => normalizeServiceLocation(worker),
    [worker]
  );
  const locationUpdatedAt = useMemo(
    () => formatLocationUpdatedAt(worker?.serviceLocationUpdatedAt, i18n.language),
    [i18n.language, worker?.serviceLocationUpdatedAt]
  );

  useEffect(() => {
    syncWorkerFromApi();
  }, [syncWorkerFromApi]);

  const loadUnreadNotifications = useCallback(async () => {
    if (!token) {
      setUnreadNotifications(0);
      return;
    }

    const result = await fetchUnreadNotificationCountApi(token);
    if (result.ok) setUnreadNotifications(result.count);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadUnreadNotifications();
    }, [loadUnreadNotifications])
  );

  useEffect(() => {
    setName(worker?.name || "");
    setExperienceYears(String(worker?.experienceYears || ""));
    setBasePrice(worker?.basePriceValue ? String(worker.basePriceValue) : "");
    setBio(worker?.about || "");
    setProfileImageUrl(worker?.profileImageUrl || "");
    setCityId(worker?.cityId || "");
    setSelectedServices(worker?.professions || [worker?.specialty].filter(Boolean));
  }, [
    worker?.about,
    worker?.basePriceValue,
    worker?.cityId,
    worker?.experienceYears,
    worker?.name,
    worker?.profileImageUrl,
    worker?.professions,
    worker?.specialty
  ]);

  useEffect(() => {
    const selectedLocation = normalizeServiceLocation(route?.params?.selectedServiceLocation);
    if (!selectedLocation) return;

    setPendingServiceLocation(selectedLocation);
    setLocationFeedback(null);
    navigation.setParams({ selectedServiceLocation: undefined });
  }, [navigation, route?.params?.selectedServiceLocation]);

  function toggleService(service) {
    if (isApproved) return;

    setSelectedServices((current) =>
      current.includes(service) ? current.filter((item) => item !== service) : [...current, service]
    );
  }

  async function handlePickImage() {
    if (isApproved) return;

    if (!token) {
      Alert.alert("Tizimga kiring", "Rasm yuklash uchun qayta tizimga kiring.");
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Ruxsat kerak", "Profil rasmini tanlash uchun galereyaga ruxsat bering.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setUploadingImage(true);
      const uploadResult = await uploadMediaApi(
        token,
        {
          uri: asset.uri,
          name: asset.fileName || `worker-profile-${Date.now()}.jpg`,
          mimeType: asset.mimeType || "image/jpeg"
        },
        { scope: "WORKER_GALLERY" }
      );
      setUploadingImage(false);

      if (uploadResult.ok && uploadResult.media?.url) {
        setProfileImageUrl(uploadResult.media.url);
        return;
      }

      Alert.alert("Rasm yuklanmadi", "Qayta urinib ko'ring.");
    } catch (error) {
      setUploadingImage(false);
      Alert.alert("Rasm tanlanmadi", error?.message || "Galereyani ochishda xatolik yuz berdi.");
    }
  }

  async function handleSubmit() {
    if (isApproved) {
      Alert.alert("Profil tasdiqlangan", "Ma'lumotlarni o'zgartirish uchun qo'llab-quvvatlashga murojaat qiling.");
      return;
    }

    if (!name.trim()) {
      Alert.alert("Ism kerak", "Admin tekshiruvi uchun ismingizni kiriting.");
      return;
    }

    if (!selectedServices.length) {
      Alert.alert("Soha tanlang", "Kamida bitta xizmat sohasini tanlang.");
      return;
    }

    if (!cityId) {
      Alert.alert("Shahar tanlang", "Mijozlar sizni topishi uchun shaharni tanlang.");
      return;
    }

    if (!experienceYears.trim()) {
      Alert.alert("Tajriba kerak", "Ish tajribangizni yil ko'rinishida kiriting.");
      return;
    }

    if (!profileImageUrl.trim()) {
      Alert.alert("Profil rasmi kerak", "Admin tekshiruvi uchun profil rasmini yuklang.");
      return;
    }

    if (!basePrice.trim()) {
      Alert.alert("Narx kerak", "Boshlang'ich narxni kiriting.");
      return;
    }

    if (!bio.trim()) {
      Alert.alert("Tavsif kerak", "O'zingiz haqingizda qisqa ma'lumot kiriting.");
      return;
    }

    setSaving(true);
    const result = await submitWorkerProfile({
      name: name.trim(),
      cityId,
      professions: selectedServices,
      experienceYears: Number(experienceYears || 0),
      profileImageUrl: profileImageUrl.trim() || undefined,
      bio: bio.trim() || undefined,
      basePrice: Number(basePrice || 0) || undefined
    });
    setSaving(false);

    Alert.alert(
      result.ok ? "Yuborildi" : "Xatolik",
      result.ok ? "Profil ma'lumotlari admin tekshiruviga yuborildi." : result.message || t("Profilni yuborishda xatolik yuz berdi.")
    );
  }

  function openServiceLocationPicker() {
    if (locationSaving || saving) return;

    navigation.navigate(ROUTES.MAP_PICKER, {
      returnTo: ROUTES.WORKER_TABS,
      returnScreen: ROUTES.WORKER_PROFILE_TAB,
      returnParamKey: "selectedServiceLocation",
      initialCoordinate: pendingServiceLocation || savedServiceLocation || undefined,
      autoLocate: false,
      showCoordinateText: false,
      title: "Xizmat lokatsiyasini tanlang",
      selectionDescription: "Xarita markazidagi pin xizmat boshlash nuqtasini belgilaydi."
    });
  }

  async function handleSaveServiceLocation() {
    if (saving || !buildServiceLocationPayload(pendingServiceLocation)) return;
    const result = await submitServiceLocationOnce({
      guard: locationSubmissionGuard.current,
      location: pendingServiceLocation,
      submit: saveServiceLocation,
      onStart: () => {
        setLocationSaving(true);
        setLocationFeedback(null);
      }
    });

    if (result.code === "SAVE_IN_PROGRESS") return;
    setLocationSaving(false);

    if (!result.ok) {
      setLocationFeedback({ type: "error", message: result.message || t("Lokatsiyani saqlab bo'lmadi.") });
      return;
    }

    setPendingServiceLocation(null);
    setLocationFeedback({ type: "success", message: "Lokatsiya muvaffaqiyatli saqlandi." });
  }

  function handleLogout() {
    Alert.alert("Chiqish", "Usta profilidan chiqishni tasdiqlaysizmi?", [
      { text: "Bekor qilish", style: "cancel" },
      {
        text: "Chiqish",
        style: "destructive",
        onPress: () => logout()
      }
    ]);
  }

  function confirmDeleteAccount() {
    if (deletingAccount) return;

    Alert.alert(
      "Akkauntni o'chirish",
      "Usta profilingiz katalogdan olib tashlanadi, shaxsiy ma'lumotlar anonimlashtiriladi va barcha sessiyalar yopiladi. Buyurtma va chat tarixi anonim ko'rinishda saqlanishi mumkin.",
      [
        { text: "Bekor qilish", style: "cancel" },
        {
          text: "Davom etish",
          style: "destructive",
          onPress: () => {
            Alert.alert("Qayta tiklab bo'lmaydi", "Akkauntni o'chirishni aniq tasdiqlaysizmi?", [
              { text: "Yo'q", style: "cancel" },
              {
                text: "Akkauntni o'chirish",
                style: "destructive",
                onPress: handleDeleteAccount
              }
            ]);
          }
        }
      ]
    );
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    const result = await deleteAccount();

    if (!result.ok) {
      setDeletingAccount(false);
      Alert.alert(
        "Akkaunt o'chirilmadi",
        result.code === "DEMO_ACCOUNT_PROTECTED"
          ? "Demo akkauntni o'chirib bo'lmaydi. Bu akkaunt App Store tekshiruvi uchun saqlanadi."
          : result.message || "Qayta urinib ko'ring."
      );
      return;
    }

    clearUserData();
    Alert.alert("Akkaunt o'chirildi", "Shaxsiy ma'lumotlaringiz anonimlashtirildi.");
  }

  async function handleRefresh() {
    setRefreshing(true);
    await syncWorkerFromApi();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0F80B7" colors={["#0F80B7"]} />
        }
      >
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            {profileImageUrl ? (
              <Image source={{ uri: profileImageUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitials}>{getInitials(name || phone)}</Text>
            )}
          </View>
          <View style={styles.headerBody}>
            <View style={[styles.statusBadge, { backgroundColor: `${statusMeta.color}18` }]}>
              <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
            <Text style={styles.profileName} numberOfLines={1}>
              {name || "Usta profili"}
            </Text>
            <Text style={styles.profilePhone} numberOfLines={1}>
              {phone}
            </Text>
          </View>
          <Pressable
            style={styles.notificationButton}
            onPress={() => navigation.navigate(ROUTES.NOTIFICATIONS)}
            hitSlop={8}
          >
            <Bell size={21} color={colors.text} strokeWidth={2.7} />
            {unreadNotifications > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={[styles.statusCard, { borderColor: statusMeta.color }]}>
          <ShieldCheck size={20} color={statusMeta.color} strokeWidth={2.6} />
          <View style={styles.flex}>
            <Text style={styles.statusTitle}>{statusMeta.title}</Text>
            <Text style={styles.statusText}>{statusMeta.text}</Text>
          </View>
        </View>

        {isApproved ? (
          <View style={styles.readOnlyNotice}>
            <ShieldCheck size={20} color={colors.primary} strokeWidth={2.6} />
            <Text style={styles.readOnlyNoticeText}>
              Profilingiz tasdiqlangan. Ma'lumotlarni o'zgartirish uchun qo'llab-quvvatlashga murojaat qiling.
            </Text>
          </View>
        ) : null}

        <SectionCard title="Profil rasmi">
          <View style={styles.photoRow}>
            <View style={styles.photoPreview}>
              {profileImageUrl ? (
                <Image source={{ uri: profileImageUrl }} style={styles.avatarImage} />
              ) : (
                <UserRound size={28} color={colors.white} strokeWidth={2.6} />
              )}
            </View>
            <View style={styles.flex}>
              <Text style={styles.photoTitle}>{profileImageUrl ? "Rasm yuklangan" : "Rasm yuklanmagan"}</Text>
              <Text style={styles.photoText}>
                {isApproved
                  ? "Tasdiqlangan profilda rasmni o'zgartirish uchun yordamga murojaat qiling."
                  : "Admin tekshiruvi uchun aniq profil rasmi kerak."}
              </Text>
              {!isApproved ? (
                <Pressable
                  onPress={handlePickImage}
                  disabled={uploadingImage}
                  style={[styles.secondaryButton, uploadingImage && styles.controlDisabled]}
                >
                  <Camera size={17} color={colors.primary} strokeWidth={2.6} />
                  <Text style={styles.secondaryButtonText}>
                    {uploadingImage ? "Yuklanmoqda..." : profileImageUrl ? "Rasmni almashtirish" : "Rasm yuklash"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </SectionCard>

        <SectionCard title="Profil ma'lumotlari">
          <Field label="Ism" value={name} onChangeText={setName} placeholder="Masalan: Ism" editable={!isApproved} />

          <Text style={styles.inputLabel}>Shahar</Text>
          {isApproved ? (
            <ReadOnlyValue value={cityName(cityId)} />
          ) : (
            <View style={styles.chips}>
              {CITIES.map((city) => {
                const active = city.id === cityId;
                return (
                  <Pressable
                    key={city.id}
                    onPress={() => setCityId(city.id)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{city.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={styles.inputLabel}>Xizmat sohalari</Text>
          {isApproved ? (
            <ReadOnlyValue value={servicesText} />
          ) : (
            <View style={styles.chips}>
              {serviceOptions.map((service) => {
                const active = selectedServices.includes(service);
                return (
                  <Pressable
                    key={service}
                    onPress={() => toggleService(service)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{service}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Field
            label="Tajriba"
            value={experienceYears}
            onChangeText={setExperienceYears}
            placeholder="8"
            keyboardType="number-pad"
            editable={!isApproved}
          />
          <Field
            label="Boshlang'ich narx"
            value={basePrice}
            onChangeText={setBasePrice}
            placeholder="100000"
            keyboardType="number-pad"
            editable={!isApproved}
            helper={isApproved ? priceText : undefined}
          />

          <Text style={styles.inputLabel}>Tavsif</Text>
          <TextInput
            editable={!isApproved}
            multiline
            value={bio}
            onChangeText={setBio}
            placeholder="Tajriba, ish uslubi va kafolat haqida qisqa yozing"
            placeholderTextColor={colors.subtle}
            style={[styles.input, styles.textArea, isApproved && styles.inputDisabled]}
          />
        </SectionCard>

        <SectionCard title="Xizmat ko'rsatishni boshlaydigan joy">
          <Text style={styles.locationDescription}>
            Mijozlarga taxminiy masofani ko'rsatish uchun ishlatiladi. Aniq manzilingiz mijozlarga ko'rsatilmaydi.
          </Text>

          <View style={styles.locationStatusCard}>
            <View style={styles.locationIcon}>
              <MapPin size={22} color={colors.primary} strokeWidth={2.6} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.locationStatusTitle}>
                {pendingServiceLocation
                  ? "Yangi nuqta tanlandi"
                  : savedServiceLocation
                    ? "Lokatsiya belgilangan"
                    : "Lokatsiya belgilanmagan"}
              </Text>
              {pendingServiceLocation ? (
                <Text style={styles.locationStatusText}>
                  Tanlangan nuqtani saqlash uchun quyidagi tugmani bosing.
                </Text>
              ) : locationUpdatedAt ? (
                <Text style={styles.locationStatusText}>{`Yangilangan: ${locationUpdatedAt}`}</Text>
              ) : null}
            </View>
          </View>

          {locationFeedback ? (
            <Text style={locationFeedback.type === "error" ? styles.locationError : styles.locationSuccess}>
              {locationFeedback.message}
            </Text>
          ) : null}

          {profileSyncStatus.isStale ? (
            <Text style={styles.locationError}>
              {t("Profil serverdan yangilanmadi. Ko'rsatilgan lokatsiya eski bo'lishi mumkin.")}
            </Text>
          ) : null}

          <View style={styles.locationActions}>
            <Pressable
              onPress={openServiceLocationPicker}
              disabled={locationSaving || saving}
              style={[
                styles.secondaryButton,
                styles.locationButton,
                (locationSaving || saving) && styles.controlDisabled
              ]}
            >
              <MapPin size={17} color={colors.primary} strokeWidth={2.6} />
              <Text style={styles.secondaryButtonText}>
                {savedServiceLocation || pendingServiceLocation ? "Lokatsiyani o'zgartirish" : "Lokatsiyani belgilash"}
              </Text>
            </Pressable>

            {pendingServiceLocation ? (
              <Pressable
                onPress={handleSaveServiceLocation}
                disabled={locationSaving || saving}
                style={[styles.locationSaveButton, (locationSaving || saving) && styles.controlDisabled]}
              >
                <CheckCircle2 size={18} color={colors.white} strokeWidth={2.6} />
                <Text style={styles.locationSaveText}>
                  {locationSaving ? "Lokatsiya saqlanmoqda..." : "Tanlangan nuqtani saqlash"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </SectionCard>

        <LanguageSelector />

        <SectionCard title="Qo'llab-quvvatlash va huquqiy ma'lumotlar">
          <ProfileAction
            icon={CircleHelp}
            label="Qo'llab-quvvatlash"
            onPress={() => navigation.navigate(ROUTES.WORKER_SUPPORT_TAB)}
          />
          <ProfileAction icon={Shield} label="Maxfiylik siyosati" onPress={openPrivacyPolicy} />
          <ProfileAction icon={FileText} label="Foydalanish shartlari" onPress={openTerms} />
        </SectionCard>

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Xavfli amallar</Text>
          <ProfileAction danger icon={LogOut} label="Chiqish" onPress={handleLogout} />
          <ProfileAction
            danger
            icon={Trash2}
            label={deletingAccount ? "Akkaunt o'chirilmoqda..." : "Akkauntni o'chirish"}
            onPress={confirmDeleteAccount}
          />
        </View>

        {!isApproved ? (
          <Pressable
            onPress={handleSubmit}
            disabled={saving || locationSaving}
            style={[styles.submitButton, (saving || locationSaving) && styles.controlDisabled]}
          >
            <CheckCircle2 size={21} color={colors.white} strokeWidth={2.6} />
            <Text style={styles.submitText}>{saving ? "Yuborilmoqda..." : "Admin tekshiruviga yuborish"}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionCard({ title, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ReadOnlyValue({ value }) {
  return (
    <View style={styles.readOnlyValueBox}>
      <Text style={styles.readOnlyValueText} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Field({ label, editable = true, helper, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        editable={editable}
        placeholderTextColor={colors.subtle}
        style={[styles.input, !editable && styles.inputDisabled]}
        {...props}
      />
      {helper ? <Text style={styles.helperText}>{helper}</Text> : null}
    </View>
  );
}

function ProfileAction({ icon: Icon, label, onPress, danger = false }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.profileAction, pressed && styles.profileActionPressed]}
    >
      <View style={[styles.profileActionIcon, danger && styles.profileActionIconDanger]}>
        <Icon size={20} color={danger ? colors.danger : colors.primary} strokeWidth={2.5} />
      </View>
      <Text style={[styles.profileActionText, danger && styles.profileActionDanger]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 112,
    gap: 14
  },
  headerCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    ...shadow
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  avatarImage: {
    width: "100%",
    height: "100%"
  },
  avatarInitials: {
    color: colors.white,
    fontSize: 18,
    fontFamily: "Inter_800ExtraBold"
  },
  headerBody: {
    flex: 1,
    minWidth: 0
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_800ExtraBold"
  },
  profileName: {
    marginTop: 7,
    color: colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontFamily: "Inter_800ExtraBold"
  },
  profilePhone: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold"
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border
  },
  notificationBadge: {
    position: "absolute",
    top: -5,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5
  },
  notificationBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "900"
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    ...shadow
  },
  flex: {
    flex: 1,
    minWidth: 0
  },
  statusTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: "Inter_800ExtraBold"
  },
  statusText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_600SemiBold"
  },
  readOnlyNotice: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#BEE7F3",
    backgroundColor: "#EAF8FC",
    padding: 13,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  readOnlyNoticeText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_700Bold"
  },
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    padding: 16,
    gap: 13,
    ...shadow
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontFamily: "Inter_800ExtraBold"
  },
  photoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 12
  },
  photoPreview: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  photoTitle: {
    color: colors.text,
    fontSize: 14,
    fontFamily: "Inter_800ExtraBold"
  },
  photoText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_600SemiBold"
  },
  secondaryButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    minHeight: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontFamily: "Inter_800ExtraBold"
  },
  locationDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_600SemiBold"
  },
  locationStatusCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  locationIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF8FC"
  },
  locationStatusTitle: {
    color: colors.text,
    fontSize: 14,
    fontFamily: "Inter_800ExtraBold"
  },
  locationStatusText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_600SemiBold"
  },
  locationActions: {
    gap: 10
  },
  locationButton: {
    alignSelf: "stretch",
    marginTop: 0,
    justifyContent: "center"
  },
  locationSaveButton: {
    minHeight: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.secondary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14
  },
  locationSaveText: {
    color: colors.white,
    fontSize: 13,
    fontFamily: "Inter_800ExtraBold"
  },
  locationSuccess: {
    color: colors.success,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_700Bold"
  },
  locationError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_700Bold"
  },
  field: {
    gap: 6
  },
  inputLabel: {
    color: colors.text,
    fontSize: 12,
    fontFamily: "Inter_800ExtraBold"
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold"
  },
  inputDisabled: {
    backgroundColor: "#EEF2F7",
    color: colors.muted
  },
  controlDisabled: {
    opacity: 0.65
  },
  textArea: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: "top"
  },
  helperText: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold"
  },
  readOnlyValueBox: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#EEF2F7",
    paddingHorizontal: 12,
    justifyContent: "center"
  },
  readOnlyValueText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Inter_700Bold"
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: "center"
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  chipText: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: "Inter_800ExtraBold"
  },
  chipTextActive: {
    color: colors.white
  },
  profileAction: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  profileActionPressed: {
    opacity: 0.75
  },
  profileActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#EAF8FC",
    alignItems: "center",
    justifyContent: "center"
  },
  profileActionIconDanger: {
    backgroundColor: "#FEECEC"
  },
  profileActionText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold"
  },
  profileActionDanger: {
    color: colors.danger
  },
  dangerCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: colors.white,
    padding: 16,
    gap: 13
  },
  dangerTitle: {
    color: "#991B1B",
    fontSize: 18,
    fontFamily: "Inter_800ExtraBold"
  },
  submitButton: {
    minHeight: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  submitText: {
    color: colors.white,
    fontSize: 15,
    fontFamily: "Inter_800ExtraBold"
  }
});
