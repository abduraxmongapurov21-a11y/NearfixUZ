import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  Ban,
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleHelp,
  Edit3,
  FileText,
  Globe2,
  Languages,
  LogOut,
  MapPin,
  Plus,
  Shield,
  Trash2,
  X
} from "lucide-react-native";
import { ROUTES } from "../../constants/routes";
import { fetchUnreadNotificationCountApi } from "../../services/notifications/notificationService";
import { useAuthStore } from "../../store/authStore";
import { useClientStore } from "../../store/clientStore";
import { openPrivacyPolicy, openTerms } from "../../utils/legalLinks";
import { SupportRequestModal } from "../../components/support/SupportRequestModal";
import {
  applyCountrySelection,
  COUNTRIES,
  OPERATIONAL_COUNTRY_CODE
} from "../../components/profile/countrySelectorModel.mjs";
import { LANGUAGES, SUPPORTED_LOCALES } from "../../i18n";
import { useUiStore } from "../../store/uiStore";
import { colors, font, shadow, CLIENT_CONTENT_BOTTOM } from "../../theme/clientTheme";
import { ClientHeader } from "../../components/client/ClientHeader";
import { GlassSurface } from "../../components/client/GlassSurface";
import { fetchBlockedUsersApi, unblockUserApi } from "../../services/moderation/moderationService";
import { Alert, Text, TextInput } from "../../i18n/native";
import { useTranslation } from "react-i18next";
import {
  ADDRESS_PRESET_IDS,
  applyAddressPreset,
  getAddressPresetLabel,
  isAddressPresetActive,
  localizeLegacyAddressPresetTitle
} from "./addressPresets.mjs";

function getInitials(value) {
  return String(value || "NF")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ClientProfileScreen({ navigation, route }) {
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const logout = useAuthStore((state) => state.logout);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const setExperienceMode = useAuthStore((state) => state.setExperienceMode);
  const user = useClientStore((state) => state.user);
  const savedAddresses = useClientStore((state) => state.savedAddresses);
  const addressStatus = useClientStore((state) => state.addressStatus);
  const loadAddresses = useClientStore((state) => state.loadAddresses);
  const createAddress = useClientStore((state) => state.createAddress);
  const updateAddress = useClientStore((state) => state.updateAddress);
  const removeAddress = useClientStore((state) => state.removeAddress);
  const syncClientProfileFromApi = useClientStore((state) => state.syncClientProfileFromApi);
  const [nameDraft, setNameDraft] = useState(session?.name || user.name || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [addressFormMode, setAddressFormMode] = useState("create");
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [addressDraft, setAddressDraft] = useState({
    title: "",
    address: "",
    district: null,
    latitude: null,
    longitude: null
  });

  const profile = useMemo(
    () => ({
      name: session?.name || user.name || "Ism kiritilmagan",
      phone: session?.phone || "Telefon kiritilmagan"
    }),
    [session?.name, session?.phone, user.name]
  );

  useEffect(() => {
    setNameDraft(session?.name || user.name || "");
  }, [session?.name, user.name]);

  useEffect(() => {
    syncClientProfileFromApi();
  }, [syncClientProfileFromApi]);

  const loadUnreadNotifications = useCallback(async () => {
    if (!session?.token) {
      setUnreadNotifications(0);
      return;
    }

    const result = await fetchUnreadNotificationCountApi(session.token);
    if (result.ok) setUnreadNotifications(result.count);
  }, [session?.token]);

  useFocusEffect(
    useCallback(() => {
      loadUnreadNotifications();
    }, [loadUnreadNotifications])
  );

  useEffect(() => {
    const selectedLocation = route?.params?.selectedLocation;
    if (!selectedLocation) return;

    setAddressDraft((current) => ({
      ...current,
      address: typeof selectedLocation.address === "string" ? selectedLocation.address : "",
      district: selectedLocation.district || null,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude
    }));
    setAddressModalOpen(true);
    navigation.setParams({ selectedLocation: undefined });
  }, [navigation, route?.params?.selectedLocation]);

  function handleLogout() {
    Alert.confirm("Chiqish", "Akkauntingizdan chiqmoqchimisiz?", [
      { text: "Bekor qilish", style: "cancel" },
      {
        text: "Chiqish",
        style: "destructive",
        onPress: logout
      }
    ]);
  }

  function confirmDeleteAccount() {
    if (deletingAccount) return;

    Alert.alert(
      "Akkauntni o'chirish",
      "Profil ma'lumotlari anonimlashtiriladi. Saqlangan manzillar, sevimlilar va faol sessiyalar o'chiriladi. Buyurtma va chat tarixi qonuniy yoki operatsion zarurat uchun anonim ko'rinishda saqlanishi mumkin.",
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

    Alert.alert("Akkaunt o'chirildi", "Shaxsiy ma'lumotlaringiz anonimlashtirildi.");
  }

  async function handleSaveProfile() {
    const cleanName = nameDraft.trim();
    if (cleanName.length < 2) {
      Alert.alert("Ism kerak", "Kamida 2 ta belgidan iborat ism kiriting.");
      return;
    }

    setSavingProfile(true);
    const result = await updateProfile({ name: cleanName });
    setSavingProfile(false);
    if (result.ok) setEditingProfile(false);

    Alert.alert(
      result.ok ? "Saqlandi" : "Xatolik",
      result.ok ? "Hisob ma'lumotlari yangilandi." : result.message || "Profil saqlanmadi."
    );
  }

  async function handleRefresh() {
    setRefreshing(true);
    await syncClientProfileFromApi();
    setRefreshing(false);
  }

  function makeEmptyAddressDraft() {
    return {
      title: "",
      address: "",
      district: null,
      latitude: null,
      longitude: null
    };
  }

  function openAddressPicker(initialCoordinate) {
    setAddressModalOpen(false);
    navigation.navigate(ROUTES.MAP_PICKER, {
      returnTo: ROUTES.CLIENT_TABS,
      returnScreen: ROUTES.PROFILE_TAB,
      returnParamKey: "selectedLocation",
      initialCoordinate
    });
  }

  function handleCreateAddressPress() {
    setAddressFormMode("create");
    setEditingAddressId(null);
    setAddressDraft(makeEmptyAddressDraft());
    setAddressModalOpen(true);
  }

  function handleEditAddressPress(address) {
    setAddressFormMode("edit");
    setEditingAddressId(address.id);
    setAddressDraft({
      title: localizeLegacyAddressPresetTitle(address.title || address.label || "", t),
      address: address.address || address.addressText || "",
      district: address.district || null,
      latitude: address.latitude ?? address.lat ?? null,
      longitude: address.longitude ?? address.lng ?? null
    });
    setAddressModalOpen(true);
  }

  function handlePickAddressLocation() {
    openAddressPicker(
      typeof addressDraft.latitude === "number" && typeof addressDraft.longitude === "number"
        ? {
            latitude: addressDraft.latitude,
            longitude: addressDraft.longitude,
            ...(addressDraft.address ? { address: addressDraft.address } : {}),
            ...(addressDraft.district ? { district: addressDraft.district } : {})
          }
        : undefined
    );
  }

  async function handleSaveAddress() {
    const cleanTitle = addressDraft.title.trim() || `Manzil ${savedAddresses.length + 1}`;

    if (cleanTitle.length < 2) {
      Alert.alert("Nom kerak", "Masalan: Uy, Ofis yoki Ish deb yozing.");
      return;
    }

    if (
      addressFormMode === "create" &&
      (typeof addressDraft.latitude !== "number" || typeof addressDraft.longitude !== "number")
    ) {
      Alert.alert("Lokatsiya kerak", "Manzilni saqlash uchun xaritadan nuqta tanlang.");
      return;
    }

    const cleanAddress = addressDraft.address.trim();
    if (
      typeof addressDraft.latitude === "number" &&
      typeof addressDraft.longitude === "number" &&
      cleanAddress.length < 4
    ) {
      Alert.alert(
        "Manzil aniqlanmadi",
        "Tanlangan koordinata uchun manzilni aniqlab bo'lmadi. Xaritadan qayta tanlang."
      );
      return;
    }

    setSavingAddress(true);
    const payload = {
      title: cleanTitle,
      ...(cleanAddress ? { address: cleanAddress } : {}),
      ...(addressDraft.district ? { district: addressDraft.district } : {}),
      ...(typeof addressDraft.latitude === "number" && typeof addressDraft.longitude === "number"
        ? {
            lat: addressDraft.latitude,
            lng: addressDraft.longitude
          }
        : {})
    };
    const result =
      addressFormMode === "edit" && editingAddressId
        ? await updateAddress(editingAddressId, payload)
        : await createAddress(payload);
    setSavingAddress(false);

    if (!result.ok) {
      Alert.alert(
        addressFormMode === "edit" ? "Manzil saqlanmadi" : "Manzil qo'shilmadi",
        result.message || "Qayta urinib ko'ring."
      );
      return;
    }

    setAddressModalOpen(false);
  }

  function confirmDeleteAddress(addressId) {
    Alert.alert("Manzil o'chirilsinmi?", "Bu manzil profil ro'yxatidan olib tashlanadi.", [
      { text: "Bekor qilish", style: "cancel" },
      {
        text: "O'chirish",
        style: "destructive",
        onPress: async () => {
          const result = await removeAddress(addressId);
          if (!result.ok) Alert.alert("Manzil o'chirilmadi", result.message || "Qayta urinib ko'ring.");
        }
      }
    ]);
  }

  async function openBlockedUsers() {
    setBlockedOpen(true);
    if (!session?.token) return;
    setBlockedLoading(true);
    const result = await fetchBlockedUsersApi(session.token);
    setBlockedLoading(false);
    if (result.ok) setBlockedUsers(result.blocks);
  }

  async function handleUnblock(blockedUserId) {
    const result = await unblockUserApi(session?.token, blockedUserId);
    if (!result.ok) {
      Alert.alert("Blokdan chiqarilmadi", result.message || "Qayta urinib ko'ring.");
      return;
    }
    setBlockedUsers((current) => current.filter((item) => item.blockedUserId !== blockedUserId));
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ClientHeader
        title="Profil"
        right={
          <GlassSurface style={styles.notificationGlass}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Bildirishnomalar")}
              style={styles.notificationButton}
              onPress={() => navigation.navigate(ROUTES.NOTIFICATIONS)}
            >
              <Bell size={22} color={colors.text} strokeWidth={1.8} />
              {unreadNotifications > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </GlassSurface>
        }
      />
      <ScrollView
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
        <View style={styles.headerCard}>
          <View style={styles.avatarCircle}>
            <Text translate={false} style={styles.avatarInitials}>{getInitials(profile.name || profile.phone)}</Text>
          </View>
          <View style={styles.headerBody}>
            <Text translate={!session?.name && !user.name} style={styles.profileName} numberOfLines={1}>
              {profile.name}
            </Text>
            <Text translate={!session?.phone} style={styles.profilePhone} numberOfLines={1}>
              {profile.phone}
            </Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Mijoz</Text>
            </View>
          </View>
        </View>

        <SectionCard
          title="Hisob ma'lumotlari"
          action={
            !editingProfile ? (
              <Pressable accessibilityRole="button" onPress={() => setEditingProfile(true)} style={styles.editButton}>
                <Edit3 size={16} color={colors.primary} strokeWidth={1.8} />
                <Text style={styles.editButtonText}>Tahrirlash</Text>
              </Pressable>
            ) : null
          }
        >
          {editingProfile ? (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Ism</Text>
                <TextInput
                  autoCapitalize="words"
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  placeholder="Ism"
                  placeholderTextColor="#A0A7B3"
                  style={styles.profileInput}
                />
              </View>
              <View style={styles.readOnlyField}>
                <Text style={styles.fieldLabel}>Telefon raqam</Text>
                <Text style={styles.readOnlyValue} numberOfLines={1}>
                  {profile.phone}
                </Text>
              </View>
              <View style={styles.profileEditActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setNameDraft(session?.name || user.name || "");
                    setEditingProfile(false);
                  }}
                  disabled={savingProfile}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Bekor qilish</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                  style={[styles.primaryButton, savingProfile && styles.buttonMuted]}
                >
                  {savingProfile ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Saqlash</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.profileSummary}>
              <View style={styles.summaryField}>
                <Text style={styles.fieldLabel}>Ism</Text>
                <Text translate={!session?.name && !user.name} style={styles.summaryValue}>{profile.name}</Text>
              </View>
              <View style={styles.summaryField}>
                <Text style={styles.fieldLabel}>Telefon raqam</Text>
                <Text translate={false} style={styles.summaryValue}>
                  {profile.phone}
                </Text>
              </View>
            </View>
          )}
        </SectionCard>

        <SectionCard title="Mening manzillarim" subtitle={`${savedAddresses.length} ta manzil`}>
          <AddressManager
            addresses={savedAddresses}
            loading={addressStatus.loading}
            error={addressStatus.error}
            onAdd={handleCreateAddressPress}
            onEdit={handleEditAddressPress}
            onDelete={confirmDeleteAddress}
            onRetry={loadAddresses}
          />
        </SectionCard>

        <ClientPreferences />

        <SectionCard title="Professional imkoniyatlar">
          {session?.role === "provider" ? (
            <ActionRow
              icon={BriefcaseBusiness}
              label="Usta rejimiga o'tish"
              onPress={() => setExperienceMode("worker")}
            />
          ) : (
            <ActionRow
              icon={BriefcaseBusiness}
              label="Usta bo'lish"
              onPress={() => navigation.navigate(ROUTES.BECOME_WORKER)}
            />
          )}
        </SectionCard>

        <SectionCard title="Qo'llab-quvvatlash">
          <ActionRow icon={CircleHelp} label="Yordam so'rash" onPress={() => setSupportOpen(true)} />
          <ActionRow icon={Ban} label="Bloklangan foydalanuvchilar" onPress={openBlockedUsers} />
          <ActionRow
            icon={Bell}
            label="Bildirishnomalar"
            onPress={() => navigation.navigate(ROUTES.NOTIFICATIONS)}
            badge={unreadNotifications}
          />
        </SectionCard>

        <SectionCard title="Huquqiy ma'lumotlar">
          <ActionRow icon={Shield} label="Maxfiylik siyosati" onPress={openPrivacyPolicy} />
          <ActionRow icon={FileText} label="Foydalanish shartlari" onPress={openTerms} />
        </SectionCard>

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Hisob boshqaruvi</Text>
          <ActionRow icon={LogOut} label="Chiqish" danger onPress={handleLogout} />
          <ActionRow
            icon={Trash2}
            label={deletingAccount ? "Akkaunt o'chirilmoqda..." : "Akkauntni o'chirish"}
            danger
            onPress={confirmDeleteAccount}
          />
        </View>
      </ScrollView>
      <AddressFormModal
        visible={addressModalOpen}
        draft={addressDraft}
        saving={savingAddress}
        onChange={setAddressDraft}
        onClose={() => setAddressModalOpen(false)}
        onPickLocation={handlePickAddressLocation}
        onSave={handleSaveAddress}
        mode={addressFormMode}
      />
      <SupportRequestModal
        visible={supportOpen}
        initialReason="Ilova bo'yicha yordam"
        onClose={() => setSupportOpen(false)}
        onSuccess={() => Alert.alert("Murojaat yuborildi", "Yordam jamoasi murojaatingizni ko'rib chiqadi.")}
      />
      <BlockedUsersModal
        visible={blockedOpen}
        loading={blockedLoading}
        blocks={blockedUsers}
        onUnblock={handleUnblock}
        onClose={() => setBlockedOpen(false)}
      />
    </SafeAreaView>
  );
}

function SectionCard({ title, subtitle, action, children }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

function ActionRow({ icon: Icon, label, onPress, danger = false, badge = 0 }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
    >
      <View style={[styles.actionIcon, danger && styles.actionIconDanger]}>
        <Icon size={20} color={danger ? colors.danger : colors.primary} strokeWidth={1.8} />
      </View>
      <Text style={[styles.actionLabel, danger && styles.actionLabelDanger]} numberOfLines={1}>
        {label}
      </Text>
      {badge > 0 ? (
        <View style={styles.inlineBadge}>
          <Text style={styles.inlineBadgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
      <ChevronRight size={18} color={danger ? colors.danger : colors.subtle} strokeWidth={1.7} />
    </Pressable>
  );
}

function ClientPreferences() {
  const { t } = useTranslation();
  const locale = useUiStore((state) => state.locale);
  const setLocale = useUiStore((state) => state.setLocale);
  const [countryOpen, setCountryOpen] = useState(false);

  function selectCountry(countryCode) {
    applyCountrySelection(countryCode, {
      closeSelector: () => setCountryOpen(false),
      showUnavailable: () => Alert.alert("Tez orada", "NearFIX bu mamlakatda hali mavjud emas.")
    });
  }

  return (
    <>
      <SectionCard title="Ilova sozlamalari">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Mamlakat yoki hudud")}
          onPress={() => setCountryOpen(true)}
          style={styles.actionRow}
        >
          <View style={styles.actionIcon}>
            <Globe2 size={20} color={colors.primary} strokeWidth={1.8} />
          </View>
          <View style={styles.preferenceBody}>
            <Text style={styles.actionLabel}>Mamlakat yoki hudud</Text>
            <Text style={styles.preferenceValue}>O'zbekiston</Text>
          </View>
          <ChevronRight size={18} color={colors.subtle} strokeWidth={1.7} />
        </Pressable>
        <View style={styles.preferenceTitle}>
          <View style={styles.actionIcon}>
            <Languages size={20} color={colors.primary} strokeWidth={1.8} />
          </View>
          <View style={styles.preferenceBody}>
            <Text style={styles.actionLabel}>Til</Text>
            <Text style={styles.preferenceValue}>Ilova tilini tanlang</Text>
          </View>
        </View>
        <View accessibilityRole="radiogroup" style={styles.languageOptions}>
          {SUPPORTED_LOCALES.map((language) => (
            <Pressable
              key={language}
              accessibilityRole="radio"
              accessibilityState={{ checked: locale === language }}
              accessibilityLabel={LANGUAGES[language]}
              onPress={() => setLocale(language)}
              style={[styles.languageOption, locale === language && styles.languageSelected]}
            >
              <Text translate={false} style={[styles.languageText, locale === language && styles.languageTextSelected]}>
                {LANGUAGES[language]}
              </Text>
              {locale === language ? <Check size={15} color={colors.primary} strokeWidth={2} /> : null}
            </Pressable>
          ))}
        </View>
      </SectionCard>
      <Modal visible={countryOpen} transparent animationType="slide" onRequestClose={() => setCountryOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Yopish")}
            style={StyleSheet.absoluteFill}
            onPress={() => setCountryOpen(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.modalTitle}>Mamlakat yoki hudud</Text>
                <Text style={styles.modalHint}>NearFIX ishlaydigan hududni ko'ring</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Yopish")}
                onPress={() => setCountryOpen(false)}
                style={styles.modalCloseButton}
              >
                <X size={20} color={colors.text} strokeWidth={1.8} />
              </Pressable>
            </View>
            <View accessibilityRole="radiogroup" style={styles.countryList}>
              {COUNTRIES.map((country) => (
                <Pressable
                  key={country.code}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: country.code === OPERATIONAL_COUNTRY_CODE }}
                  onPress={() => selectCountry(country.code)}
                  style={[styles.countryRow, country.available && styles.countryRowActive]}
                >
                  <Text translate={false} style={styles.countryFlag}>
                    {country.flag}
                  </Text>
                  <View style={styles.preferenceBody}>
                    <Text style={styles.actionLabel}>{country.nameKey}</Text>
                    <Text style={styles.preferenceValue}>{country.statusKey}</Text>
                  </View>
                  {country.available ? <Check size={20} color={colors.primary} strokeWidth={2} /> : null}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function BlockedUsersModal({ visible, loading, blocks, onUnblock, onClose }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.blockedSheet}>
          <Text style={styles.modalTitle}>Bloklangan foydalanuvchilar</Text>
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
          {!loading && !blocks.length ? (
            <Text style={styles.blockedEmpty}>Bloklangan foydalanuvchilar yo'q.</Text>
          ) : null}
          {blocks.map((block) => (
            <View key={block.blockedUserId} style={styles.blockedRow}>
              <View style={styles.blockedBody}>
                <Text style={styles.blockedName} numberOfLines={1}>
                  {block.blockedUser?.name || "Foydalanuvchi"}
                </Text>
                <Text style={styles.blockedRole}>
                  {block.blockedUser?.role === "PROVIDER" ? "Usta" : "Foydalanuvchi"}
                </Text>
              </View>
              <Pressable onPress={() => onUnblock(block.blockedUserId)} style={styles.unblockButton}>
                <Text style={styles.unblockText}>Blokdan chiqarish</Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={onClose} style={styles.modalCancelButton}>
            <Text style={styles.modalCancelText}>Yopish</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function AddressManager({ addresses, loading, error, onAdd, onEdit, onDelete, onRetry }) {
  return (
    <View style={styles.addressManager}>
      {loading ? (
        <View style={styles.addressStateBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.addressStateText}>Manzillar yuklanmoqda...</Text>
        </View>
      ) : null}
      {error ? (
        <Pressable onPress={onRetry} style={styles.addressError}>
          <Text style={styles.addressErrorTitle}>Manzillar yuklanmadi</Text>
          <Text style={styles.addressErrorText}>{error}</Text>
          <Text style={styles.addressRetryText}>Qayta urinish</Text>
        </Pressable>
      ) : null}
      {!loading && !error && !addresses.length ? (
        <View style={styles.addressEmpty}>
          <Text style={styles.addressEmptyTitle}>Hali manzil qo'shilmagan</Text>
          <Text style={styles.addressEmptyText}>Buyurtma berish uchun xaritadan manzil qo'shing.</Text>
        </View>
      ) : null}
      {addresses.map((address) => (
        <View key={address.id} style={styles.addressItem}>
          <View style={styles.addressPin}>
            <MapPin size={18} color={colors.primary} strokeWidth={1.8} />
          </View>
          <View style={styles.addressItemBody}>
            <Text style={styles.addressLabel} numberOfLines={1}>
              {address.title || address.label || "Manzil"}
            </Text>
            {(address.addressText || address.address) &&
            (address.addressText || address.address) !== (address.title || address.label) ? (
              <Text style={styles.addressText} numberOfLines={2}>
                {address.addressText || address.address}
              </Text>
            ) : null}
            {address.district ? (
              <Text style={styles.addressDistrict} numberOfLines={1}>
                {address.district}
              </Text>
            ) : null}
            <View style={styles.addressActionsRow}>
              <Pressable onPress={() => onEdit(address)} style={styles.addressTextButton}>
                <Edit3 size={13} color={colors.primary} strokeWidth={1.8} />
                <Text style={styles.addressTextButtonLabel}>Tahrirlash</Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(address.id)}
                style={[styles.addressTextButton, styles.addressDeleteTextButton]}
              >
                <Trash2 size={13} color={colors.danger} strokeWidth={1.8} />
                <Text style={[styles.addressTextButtonLabel, styles.addressDeleteText]}>O'chirish</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
      <Pressable accessibilityRole="button" onPress={onAdd} style={styles.addAddressButton}>
        <Plus size={18} color={colors.primary} strokeWidth={1.8} />
        <Text style={styles.addAddressText}>Yangi manzil qo'shish</Text>
      </Pressable>
    </View>
  );
}

function AddressFormModal({ visible, draft, saving, mode, onChange, onClose, onPickLocation, onSave }) {
  const { t } = useTranslation();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={24}
      >
        <Pressable style={styles.modalOverlay} onPress={Keyboard.dismiss}>
          <Pressable
            style={styles.modalSheet}
            onPress={(event) => {
              event.stopPropagation();
              Keyboard.dismiss();
            }}
          >
            <Text style={styles.modalTitle}>{mode === "edit" ? "Manzilni tahrirlash" : "Yangi manzil"}</Text>
            <Text style={styles.modalHint}>Manzil nomini kiriting va lokatsiyani xaritadan tanlang.</Text>
            <TextInput
              value={draft.title}
              onChangeText={(title) => onChange((current) => ({ ...current, title }))}
              placeholder="Uy, Ofis, Ish..."
              placeholderTextColor="#A0A7B3"
              style={styles.modalInput}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
            />
            <View style={styles.addressSuggestionRow}>
              {ADDRESS_PRESET_IDS.map((presetId) => {
                const label = getAddressPresetLabel(presetId, t);
                const active = isAddressPresetActive(draft.title, presetId, t);
                return (
                  <Pressable
                    key={presetId}
                    onPress={() => {
                      Keyboard.dismiss();
                      onChange((current) => applyAddressPreset(current, presetId, t));
                    }}
                    style={[styles.addressSuggestionChip, active && styles.addressSuggestionChipActive]}
                  >
                    <Text
                      translate={false}
                      style={[styles.addressSuggestionText, active && styles.addressSuggestionTextActive]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.coordinateBox}>
              <Text style={styles.coordinateLabel}>Xaritadan tanlangan manzil</Text>
              <Text style={styles.coordinateText} numberOfLines={2} translate={!draft.address}>
                {draft.address ||
                  (typeof draft.latitude === "number" && typeof draft.longitude === "number"
                    ? "Manzil aniqlanmadi. Koordinata saqlanadi."
                    : "Manzil tanlanmagan")}
              </Text>
            </View>
            <Pressable onPress={onPickLocation} disabled={saving} style={styles.pickLocationButton}>
              <MapPin size={17} color={colors.primary} strokeWidth={1.8} />
              <Text style={styles.pickLocationText}>
                {typeof draft.latitude === "number" && typeof draft.longitude === "number"
                  ? "Lokatsiyani o'zgartirish"
                  : "Xaritadan lokatsiya tanlash"}
              </Text>
            </Pressable>
            <View style={styles.modalActions}>
              <Pressable onPress={onClose} disabled={saving} style={styles.modalCancelButton}>
                <Text style={styles.modalCancelText}>Bekor qilish</Text>
              </Pressable>
              <Pressable
                onPress={onSave}
                disabled={saving}
                style={[styles.modalSaveButton, saving && styles.buttonMuted]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>{mode === "edit" ? "Saqlash" : "Qo'shish"}</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  notificationGlass: { width: 46, height: 46, borderRadius: 17 },
  editButton: {
    minHeight: 44,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.primarySoft
  },
  editButtonText: { color: colors.primary, fontSize: 11, fontFamily: font.semi },
  profileSummary: { gap: 14 },
  summaryField: { gap: 4 },
  summaryValue: { color: colors.text, fontSize: 14, lineHeight: 20, fontFamily: font.medium },
  profileEditActions: { flexDirection: "row", gap: 10 },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: { color: colors.muted, fontSize: 13, fontFamily: font.semi },
  preferenceBody: { flex: 1, minWidth: 0 },
  preferenceValue: { marginTop: 3, color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: font.regular },
  preferenceTitle: { flexDirection: "row", gap: 11, alignItems: "center", paddingHorizontal: 2 },
  languageOptions: { flexDirection: "row", gap: 6 },
  languageOption: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background
  },
  languageSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  languageText: { color: colors.muted, fontSize: 11, fontFamily: font.medium },
  languageTextSelected: { color: colors.primary, fontFamily: font.semi },
  countryList: { gap: 8, marginTop: 12 },
  countryRow: {
    minHeight: 66,
    padding: 12,
    borderRadius: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border
  },
  countryRowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  countryFlag: { fontSize: 22 },
  modalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center"
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: CLIENT_CONTENT_BOTTOM,
    gap: 14
  },
  headerCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    ...shadow
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarInitials: {
    color: colors.primary,
    fontSize: 22,
    fontFamily: font.bold
  },
  headerBody: {
    flex: 1,
    minWidth: 0
  },
  headerLabel: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: font.bold
  },
  profileName: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 27,
    fontFamily: font.bold
  },
  profilePhone: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 13,
    fontFamily: font.semi
  },
  roleBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  roleBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: font.bold
  },
  notificationButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center"
  },
  notificationBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5
  },
  notificationBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: font.bold
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 18,
    gap: 12,
    ...shadow
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sectionTitleWrap: {
    flex: 1,
    minWidth: 0
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: font.bold
  },
  sectionSubtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    fontFamily: font.semi
  },
  sectionIconButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  formGroup: {
    gap: 7
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 12,
    fontFamily: font.bold
  },
  profileInput: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 13,
    color: colors.text,
    fontSize: 15,
    fontFamily: font.semi
  },
  readOnlyField: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: 4
  },
  readOnlyValue: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: font.semi
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: font.bold
  },
  buttonMuted: {
    opacity: 0.65
  },
  actionRow: {
    minHeight: 54,
    borderRadius: 15,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  rowPressed: {
    opacity: 0.76
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  actionIconDanger: {
    backgroundColor: "#FEECEC"
  },
  actionLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: font.medium
  },
  actionLabelDanger: {
    color: colors.danger
  },
  inlineBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  inlineBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: font.bold
  },
  dangerCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 18,
    gap: 12
  },
  dangerTitle: {
    color: colors.text,
    fontSize: 16,
    fontFamily: font.bold
  },
  addressManager: {
    gap: 10
  },
  addAddressButton: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  addAddressText: {
    color: colors.primary,
    fontSize: 13,
    fontFamily: font.bold
  },
  addressEmpty: {
    borderRadius: 16,
    backgroundColor: colors.background,
    padding: 14
  },
  addressStateBox: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: colors.background,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10
  },
  addressStateText: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: font.semi
  },
  addressError: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    padding: 14
  },
  addressErrorTitle: {
    color: "#991B1B",
    fontSize: 15,
    fontFamily: font.bold
  },
  addressErrorText: {
    marginTop: 4,
    color: "#B91C1C",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: font.semi
  },
  addressRetryText: {
    marginTop: 8,
    color: colors.primary,
    fontSize: 12,
    fontFamily: font.bold
  },
  addressEmptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: font.bold
  },
  addressEmptyText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: font.medium
  },
  addressItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11
  },
  addressPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  addressItemBody: {
    flex: 1,
    minWidth: 0
  },
  addressLabel: {
    color: colors.text,
    fontSize: 14,
    fontFamily: font.bold
  },
  addressText: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: font.semi
  },
  addressDistrict: {
    marginTop: 4,
    color: colors.primary,
    fontSize: 11,
    fontFamily: font.bold
  },
  addressActionsRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  addressTextButton: {
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  addressDeleteTextButton: {
    borderColor: "#FECACA",
    backgroundColor: "#FFF7F7"
  },
  addressTextButtonLabel: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: font.bold
  },
  addressDeleteText: {
    color: colors.danger
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(39,50,72,0.36)"
  },
  keyboardAvoidingView: {
    flex: 1
  },
  modalSheet: {
    marginHorizontal: 16,
    marginBottom: 22,
    borderRadius: 20,
    backgroundColor: colors.white,
    padding: 16,
    gap: 10
  },
  blockedSheet: {
    marginHorizontal: 16,
    marginBottom: 22,
    maxHeight: "70%",
    borderRadius: 20,
    backgroundColor: colors.white,
    padding: 16,
    gap: 10
  },
  blockedEmpty: {
    color: colors.muted,
    paddingVertical: 18,
    textAlign: "center",
    fontFamily: font.semi
  },
  blockedRow: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  blockedBody: {
    flex: 1,
    minWidth: 0
  },
  blockedName: {
    color: colors.text,
    fontFamily: font.bold
  },
  blockedRole: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontFamily: font.semi
  },
  unblockButton: {
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  unblockText: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: font.bold
  },
  modalTitle: {
    color: colors.text,
    fontSize: 19,
    fontFamily: font.bold
  },
  modalHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: font.semi
  },
  modalInput: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 13,
    color: colors.text,
    fontSize: 15,
    fontFamily: font.semi
  },
  addressSuggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  addressSuggestionChip: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  addressSuggestionChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  addressSuggestionText: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: font.bold
  },
  addressSuggestionTextActive: {
    color: colors.primary
  },
  coordinateBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 13,
    paddingVertical: 10
  },
  coordinateLabel: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: font.semi
  },
  coordinateText: {
    marginTop: 4,
    color: colors.text,
    fontSize: 13,
    fontFamily: font.bold
  },
  pickLocationButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CFE8F0",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  pickLocationText: {
    color: colors.primary,
    fontSize: 13,
    fontFamily: font.bold
  },
  modalActions: {
    flexDirection: "row",
    gap: 10
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  modalCancelText: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: font.bold
  },
  modalSaveButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  modalSaveText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: font.bold
  }
});
