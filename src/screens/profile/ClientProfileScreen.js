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
import { Ban, Bell, CircleHelp, Edit3, FileText, LogOut, MapPin, Plus, Shield, Trash2 } from "lucide-react-native";
import { ROUTES } from "../../constants/routes";
import { fetchUnreadNotificationCountApi } from "../../services/notifications/notificationService";
import { useAuthStore } from "../../store/authStore";
import { useClientStore } from "../../store/clientStore";
import { openPrivacyPolicy, openTerms } from "../../utils/legalLinks";
import { SupportRequestModal } from "../../components/support/SupportRequestModal";
import { LanguageSelector } from "../../components/profile/LanguageSelector";
import { fetchBlockedUsersApi, unblockUserApi } from "../../services/moderation/moderationService";
import { Alert, Text, TextInput } from "../../i18n/native";

const font = {
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extra: "Inter_800ExtraBold"
};

const addressNameSuggestions = ["Uy", "Ofis", "Ish", "Ota-ona uyi"];

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
  const session = useAuthStore((state) => state.session);
  const logout = useAuthStore((state) => state.logout);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const user = useClientStore((state) => state.user);
  const savedAddresses = useClientStore((state) => state.savedAddresses);
  const addressStatus = useClientStore((state) => state.addressStatus);
  const loadAddresses = useClientStore((state) => state.loadAddresses);
  const createAddress = useClientStore((state) => state.createAddress);
  const updateAddress = useClientStore((state) => state.updateAddress);
  const removeAddress = useClientStore((state) => state.removeAddress);
  const syncClientProfileFromApi = useClientStore((state) => state.syncClientProfileFromApi);
  const clearUserData = useClientStore((state) => state.clearUserData);
  const [nameDraft, setNameDraft] = useState(session?.name || user.name || "");
  const [savingProfile, setSavingProfile] = useState(false);
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
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude
    }));
    setAddressModalOpen(true);
    navigation.setParams({ selectedLocation: undefined });
  }, [navigation, route?.params?.selectedLocation]);

  function handleLogout() {
    Alert.alert("Chiqish", "Akkauntingizdan chiqmoqchimisiz?", [
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

    clearUserData();
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
      title: address.title || address.label || "",
      address: address.address || address.addressText || "",
      latitude: address.latitude ?? address.lat ?? null,
      longitude: address.longitude ?? address.lng ?? null
    });
    setAddressModalOpen(true);
  }

  function handlePickAddressLocation() {
    openAddressPicker(
      typeof addressDraft.latitude === "number" && typeof addressDraft.longitude === "number"
        ? { latitude: addressDraft.latitude, longitude: addressDraft.longitude }
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

    setSavingAddress(true);
    const payload = {
      title: cleanTitle,
      address: cleanTitle,
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0F80B7" colors={["#0F80B7"]} />
        }
      >
        <View style={styles.headerCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{getInitials(profile.name || profile.phone)}</Text>
          </View>
          <View style={styles.headerBody}>
            <Text style={styles.headerLabel}>Profil</Text>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile.name}
            </Text>
            <Text style={styles.profilePhone} numberOfLines={1}>
              {profile.phone}
            </Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Mijoz</Text>
            </View>
          </View>
          <Pressable
            style={styles.notificationButton}
            onPress={() => navigation.navigate(ROUTES.NOTIFICATIONS)}
            hitSlop={8}
          >
            <Bell size={23} color="#273248" strokeWidth={2.6} />
            {unreadNotifications > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <SectionCard title="Hisob ma'lumotlari">
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
          <Pressable
            onPress={handleSaveProfile}
            disabled={savingProfile}
            style={[styles.primaryButton, savingProfile && styles.buttonMuted]}
          >
            <Text style={styles.primaryButtonText}>{savingProfile ? "Saqlanmoqda..." : "Saqlash"}</Text>
          </Pressable>
        </SectionCard>

        <SectionCard
          title="Mening manzillarim"
          subtitle={`${savedAddresses.length} ta manzil`}
          action={
            <Pressable onPress={handleCreateAddressPress} style={styles.sectionIconButton}>
              <Plus size={18} color="#FFFFFF" strokeWidth={2.8} />
            </Pressable>
          }
        >
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

        <LanguageSelector />

        <SectionCard title="Qo'llab-quvvatlash">
          <ActionRow icon={CircleHelp} label="Yordam so'rash" onPress={() => setSupportOpen(true)} />
          <ActionRow icon={Ban} label="Bloklangan foydalanuvchilar" danger onPress={openBlockedUsers} />
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
          <Text style={styles.dangerTitle}>Xavfli amallar</Text>
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
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}>
      <View style={[styles.actionIcon, danger && styles.actionIconDanger]}>
        <Icon size={20} color={danger ? "#EF4444" : "#0F80B7"} strokeWidth={2.6} />
      </View>
      <Text style={[styles.actionLabel, danger && styles.actionLabelDanger]} numberOfLines={1}>
        {label}
      </Text>
      {badge > 0 ? (
        <View style={styles.inlineBadge}>
          <Text style={styles.inlineBadgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function BlockedUsersModal({ visible, loading, blocks, onUnblock, onClose }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.blockedSheet}>
          <Text style={styles.modalTitle}>Bloklangan foydalanuvchilar</Text>
          {loading ? <ActivityIndicator color="#0F80B7" /> : null}
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
      <Pressable onPress={onAdd} style={styles.addAddressButton}>
        <Plus size={18} color="#FFFFFF" strokeWidth={2.8} />
        <Text style={styles.addAddressText}>Yangi manzil qo'shish</Text>
      </Pressable>
      {loading ? (
        <View style={styles.addressStateBox}>
          <ActivityIndicator color="#0F80B7" />
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
            <MapPin size={18} color="#0F80B7" strokeWidth={2.7} />
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
            <Text style={styles.addressDistrict} numberOfLines={1}>
              {typeof address.lat === "number" && typeof address.lng === "number"
                ? `${address.lat.toFixed(6)}, ${address.lng.toFixed(6)}`
                : "Koordinata yo'q"}
            </Text>
            <View style={styles.addressActionsRow}>
              <Pressable onPress={() => onEdit(address)} style={styles.addressTextButton}>
                <Edit3 size={13} color="#0F80B7" strokeWidth={2.6} />
                <Text style={styles.addressTextButtonLabel}>Tahrirlash</Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(address.id)}
                style={[styles.addressTextButton, styles.addressDeleteTextButton]}
              >
                <Trash2 size={13} color="#EF4444" strokeWidth={2.6} />
                <Text style={[styles.addressTextButtonLabel, styles.addressDeleteText]}>O'chirish</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function AddressFormModal({ visible, draft, saving, mode, onChange, onClose, onPickLocation, onSave }) {
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
              {addressNameSuggestions.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => {
                    Keyboard.dismiss();
                    onChange((current) => ({ ...current, title: name }));
                  }}
                  style={[styles.addressSuggestionChip, draft.title === name && styles.addressSuggestionChipActive]}
                >
                  <Text
                    style={[styles.addressSuggestionText, draft.title === name && styles.addressSuggestionTextActive]}
                  >
                    {name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.coordinateBox}>
              <Text style={styles.coordinateLabel}>Xaritadan tanlangan koordinata</Text>
              <Text style={styles.coordinateText} numberOfLines={1}>
                {typeof draft.latitude === "number" && typeof draft.longitude === "number"
                  ? `${draft.latitude.toFixed(6)}, ${draft.longitude.toFixed(6)}`
                  : "Koordinata tanlanmagan"}
              </Text>
            </View>
            <Pressable onPress={onPickLocation} disabled={saving} style={styles.pickLocationButton}>
              <MapPin size={17} color="#0F80B7" strokeWidth={2.7} />
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
                  <ActivityIndicator color="#FFFFFF" />
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
  screen: {
    flex: 1,
    backgroundColor: "#F0F9FB"
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 112,
    gap: 14
  },
  headerCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    shadowColor: "#0F719D",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 5
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#0F80B7",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: font.extra
  },
  headerBody: {
    flex: 1,
    minWidth: 0
  },
  headerLabel: {
    color: "#0F80B7",
    fontSize: 12,
    fontFamily: font.extra
  },
  profileName: {
    marginTop: 3,
    color: "#273248",
    fontSize: 22,
    lineHeight: 27,
    fontFamily: font.extra
  },
  profilePhone: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 13,
    fontFamily: font.semi
  },
  roleBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#EAF8FC",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  roleBadgeText: {
    color: "#0F80B7",
    fontSize: 11,
    fontFamily: font.extra
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F8FCFE",
    borderWidth: 1,
    borderColor: "#DCECF3",
    alignItems: "center",
    justifyContent: "center"
  },
  notificationBadge: {
    position: "absolute",
    top: -5,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2CD8A5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: font.extra
  },
  sectionCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 12,
    shadowColor: "#0F719D",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    elevation: 4
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
    color: "#273248",
    fontSize: 18,
    lineHeight: 23,
    fontFamily: font.extra
  },
  sectionSubtitle: {
    marginTop: 2,
    color: "#6B7280",
    fontSize: 12,
    fontFamily: font.semi
  },
  sectionIconButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#0F80B7",
    alignItems: "center",
    justifyContent: "center"
  },
  formGroup: {
    gap: 7
  },
  fieldLabel: {
    color: "#273248",
    fontSize: 12,
    fontFamily: font.extra
  },
  profileInput: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCECF3",
    backgroundColor: "#F8FCFE",
    paddingHorizontal: 13,
    color: "#273248",
    fontSize: 15,
    fontFamily: font.semi
  },
  readOnlyField: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5EEF3",
    backgroundColor: "#F6F8FB",
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: 4
  },
  readOnlyValue: {
    color: "#6B7280",
    fontSize: 14,
    fontFamily: font.semi
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: "#0F80B7",
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: font.extra
  },
  buttonMuted: {
    opacity: 0.65
  },
  actionRow: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: "#F8FCFE",
    borderWidth: 1,
    borderColor: "#E5EEF3",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  rowPressed: {
    opacity: 0.76
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#EAF8FC",
    alignItems: "center",
    justifyContent: "center"
  },
  actionIconDanger: {
    backgroundColor: "#FEECEC"
  },
  actionLabel: {
    flex: 1,
    color: "#273248",
    fontSize: 14,
    fontFamily: font.bold
  },
  actionLabelDanger: {
    color: "#EF4444"
  },
  inlineBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2CD8A5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  inlineBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: font.extra
  },
  dangerCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 12
  },
  dangerTitle: {
    color: "#991B1B",
    fontSize: 18,
    fontFamily: font.extra
  },
  addressManager: {
    gap: 10
  },
  addAddressButton: {
    minHeight: 44,
    borderRadius: 15,
    backgroundColor: "#0F80B7",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  addAddressText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: font.extra
  },
  addressEmpty: {
    borderRadius: 16,
    backgroundColor: "#F6F8FB",
    padding: 14
  },
  addressStateBox: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: "#F6F8FB",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10
  },
  addressStateText: {
    color: "#6B7280",
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
    fontFamily: font.extra
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
    color: "#0F80B7",
    fontSize: 12,
    fontFamily: font.extra
  },
  addressEmptyTitle: {
    color: "#273248",
    fontSize: 15,
    fontFamily: font.extra
  },
  addressEmptyText: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: font.medium
  },
  addressItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5EEF3",
    backgroundColor: "#F8FCFE",
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11
  },
  addressPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EAF8FC",
    alignItems: "center",
    justifyContent: "center"
  },
  addressItemBody: {
    flex: 1,
    minWidth: 0
  },
  addressLabel: {
    color: "#273248",
    fontSize: 14,
    fontFamily: font.extra
  },
  addressText: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: font.semi
  },
  addressDistrict: {
    marginTop: 4,
    color: "#0F80B7",
    fontSize: 11,
    fontFamily: font.extra
  },
  addressActionsRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  addressTextButton: {
    minHeight: 32,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5EEF3",
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
    color: "#0F80B7",
    fontSize: 11,
    fontFamily: font.extra
  },
  addressDeleteText: {
    color: "#EF4444"
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
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 10
  },
  blockedSheet: {
    marginHorizontal: 16,
    marginBottom: 22,
    maxHeight: "70%",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 10
  },
  blockedEmpty: {
    color: "#6B7280",
    paddingVertical: 18,
    textAlign: "center",
    fontFamily: font.semi
  },
  blockedRow: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5EEF3",
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
    color: "#273248",
    fontFamily: font.extra
  },
  blockedRole: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 12,
    fontFamily: font.semi
  },
  unblockButton: {
    minHeight: 34,
    borderRadius: 11,
    backgroundColor: "#EAF8FC",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  unblockText: {
    color: "#0F80B7",
    fontSize: 11,
    fontFamily: font.extra
  },
  modalTitle: {
    color: "#273248",
    fontSize: 19,
    fontFamily: font.extra
  },
  modalHint: {
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: font.semi
  },
  modalInput: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCECF3",
    backgroundColor: "#F8FCFE",
    paddingHorizontal: 13,
    color: "#273248",
    fontSize: 15,
    fontFamily: font.semi
  },
  addressSuggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  addressSuggestionChip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DCECF3",
    backgroundColor: "#F8FCFE",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  addressSuggestionChipActive: {
    borderColor: "#0F80B7",
    backgroundColor: "#EAF8FC"
  },
  addressSuggestionText: {
    color: "#6B7280",
    fontSize: 12,
    fontFamily: font.extra
  },
  addressSuggestionTextActive: {
    color: "#0F80B7"
  },
  coordinateBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCECF3",
    backgroundColor: "#F8FCFE",
    paddingHorizontal: 13,
    paddingVertical: 10
  },
  coordinateLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontFamily: font.semi
  },
  coordinateText: {
    marginTop: 4,
    color: "#273248",
    fontSize: 13,
    fontFamily: font.extra
  },
  pickLocationButton: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CFE8F0",
    backgroundColor: "#EAF8FC",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  pickLocationText: {
    color: "#0F80B7",
    fontSize: 13,
    fontFamily: font.extra
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
    borderColor: "#DCECF3",
    alignItems: "center",
    justifyContent: "center"
  },
  modalCancelText: {
    color: "#6B7280",
    fontSize: 14,
    fontFamily: font.extra
  },
  modalSaveButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#2CD8A5",
    alignItems: "center",
    justifyContent: "center"
  },
  modalSaveText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: font.extra
  }
});
