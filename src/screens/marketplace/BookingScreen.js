import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ClipboardList,
  Home,
  MapPin,
  MessageCircle,
  UserRound
} from "lucide-react-native";
import { ROUTES } from "../../constants/routes";
import { WORKER_STATUS } from "../../constants/workerStatus";
import { useClientStore } from "../../store/clientStore";
import { Alert, Text, TextInput } from "../../i18n/native";

const font = {
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extra: "Inter_800ExtraBold"
};

const problemPresets = {
  electric: [
    "Lyustra ulash",
    "Rozetka ishlamayapti",
    "Patron almashtirish",
    "Sim tortish",
    "Avtomat urib tashlayapti",
    "Boshqa"
  ],
  plumbing: [
    "Kran oqyapti",
    "Unitaz tiqilib qolgan",
    "Truba yorilgan",
    "Rakovina oqyapti",
    "Suv bosimi past",
    "Boshqa"
  ],
  ac: ["Sovutmayapti", "Gaz tugagan", "O'rnatish kerak", "Tozalash kerak", "Shovqin chiqaryapti", "Boshqa"],
  washer: [
    "Suv olmayapti",
    "Suv chiqarmayapti",
    "Aylanmayapti",
    "Eshigi ochilmayapti",
    "Xato kodi chiqyapti",
    "Boshqa"
  ],
  tv: ["Yonmayapti", "Ekran qoraygan", "Ovoz chiqmayapti", "Signal yo'q", "Devorga o'rnatish kerak", "Boshqa"]
};

const defaultProblems = [
  "Ta'mirlash kerak",
  "Ishlamayapti",
  "O'rnatish kerak",
  "Almashtirish kerak",
  "Tekshirib berish kerak",
  "Boshqa"
];

function getWorkerText(worker) {
  return `${worker?.specialty || ""} ${worker?.profession || ""} ${worker?.professions?.join(" ") || ""}`.toLowerCase();
}

function getProblemOptions(worker) {
  const text = getWorkerText(worker);
  if (text.includes("elektr")) return problemPresets.electric;
  if (text.includes("santex") || text.includes("kran") || text.includes("truba")) return problemPresets.plumbing;
  if (text.includes("konditsioner") || text.includes(" конди") || text.includes("ac")) return problemPresets.ac;
  if (text.includes("kir yuv") || text.includes("stiral")) return problemPresets.washer;
  if (text.includes("tv") || text.includes("televizor")) return problemPresets.tv;
  return defaultProblems;
}

function getDefaultAddress(addresses) {
  return addresses.find((address) => address.isDefault) || addresses[0];
}

export function BookingScreen({ navigation, route }) {
  const savedAddresses = useClientStore((state) => state.savedAddresses);
  const selectedWorkerId = useClientStore((state) => state.selectedWorkerId);
  const selectWorker = useClientStore((state) => state.selectWorker);
  const updateOrderDraft = useClientStore((state) => state.updateOrderDraft);
  const resetOrderDraft = useClientStore((state) => state.resetOrderDraft);
  const createOrderFromDraft = useClientStore((state) => state.createOrderFromDraft);
  const syncClientProfileFromApi = useClientStore((state) => state.syncClientProfileFromApi);
  const getSelectedWorker = useClientStore((state) => state.getSelectedWorker);
  const worker = getSelectedWorker();

  const [selectedProblem, setSelectedProblem] = useState("");
  const [otherProblem, setOtherProblem] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState(getDefaultAddress(savedAddresses)?.id);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (route.params?.workerId && route.params.workerId !== selectedWorkerId) {
      selectWorker(route.params.workerId);
    }
  }, [route.params?.workerId, selectWorker, selectedWorkerId]);

  useEffect(() => {
    syncClientProfileFromApi();
  }, [syncClientProfileFromApi]);

  useEffect(() => {
    if (!selectedAddressId && savedAddresses.length) {
      setSelectedAddressId(getDefaultAddress(savedAddresses)?.id);
    }
  }, [savedAddresses, selectedAddressId]);

  const problemOptions = useMemo(() => getProblemOptions(worker), [worker]);
  const selectedAddress = useMemo(
    () => savedAddresses.find((address) => address.id === selectedAddressId) || getDefaultAddress(savedAddresses),
    [savedAddresses, selectedAddressId]
  );
  const isOtherProblem = selectedProblem === "Boshqa";

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

    if (!selectedAddress) {
      Alert.alert("Manzil kerak", "Buyurtma uchun manzil tanlang.");
      return false;
    }

    return true;
  }

  async function handleSubmit() {
    if (submitting || !validate()) return;

    setSubmitting(true);

    try {
      const problemTitle = isOtherProblem ? otherProblem.trim() : selectedProblem;
      const backendAddressId = selectedAddress.addressText ? selectedAddress.id : undefined;

      updateOrderDraft({
        selectedWorkerId: worker.id,
        problemTitle,
        description: undefined,
        addressId: backendAddressId,
        address: selectedAddress.addressText || selectedAddress.address
      });

      const result = await createOrderFromDraft();

      if (!result.ok) {
        throw new Error(result.message || "Buyurtma yaratilmadi");
      }

      resetOrderDraft({
        selectedWorkerId: worker.id,
        serviceId: worker.specialty,
        addressId: backendAddressId,
        address: selectedAddress.addressText || selectedAddress.address
      });

      navigation.navigate(ROUTES.CLIENT_TABS, { screen: ROUTES.ORDERS_TAB });
    } catch (error) {
      Alert.alert(
        "Buyurtma yuborilmadi",
        error?.message || "Internet yoki server holatini tekshirib qayta urinib ko'ring."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={22} color="#273248" strokeWidth={2.7} />
        </Pressable>
        <Text style={styles.headerTitle}>Buyurtma berish</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0F80B7" colors={["#0F80B7"]} />
        }
      >
        <View style={styles.formCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Adres</Text>
            <Pressable onPress={() => setAddressModalOpen(true)}>
              <Text style={styles.addText}>O'zgartirish</Text>
            </Pressable>
          </View>
          <Pressable style={styles.addressBox} onPress={() => setAddressModalOpen(true)}>
            <View style={styles.addressIcon}>
              <MapPin size={22} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2.6} />
            </View>
            <View style={styles.addressTextWrap}>
              <Text style={styles.addressTitle}>{selectedAddress?.label || "Manzil"}</Text>
              <Text style={styles.addressText} numberOfLines={1}>
                {selectedAddress?.addressText || selectedAddress?.address || "Manzil tanlang"}
              </Text>
            </View>
            <ChevronRight size={22} color="#A3ABB8" strokeWidth={2.6} />
          </Pressable>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Muammo tanlang</Text>
          <View style={styles.problemGrid}>
            {problemOptions.map((problem) => {
              const active = selectedProblem === problem;
              return (
                <Pressable
                  key={problem}
                  style={[styles.problemChip, active && styles.problemChipActive]}
                  onPress={() => setSelectedProblem(problem)}
                >
                  <Text style={[styles.problemText, active && styles.problemTextActive]}>{problem}</Text>
                </Pressable>
              );
            })}
          </View>
          {isOtherProblem ? (
            <TextInput
              value={otherProblem}
              onChangeText={(value) => setOtherProblem(value.slice(0, 80))}
              placeholder="Muammoni qisqa yozing"
              placeholderTextColor="#A3ABB8"
              style={styles.otherInput}
            />
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <Pressable
          style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmText}>Tasdiqlash</Text>}
        </Pressable>
      </View>

      <AddressModal
        visible={addressModalOpen}
        addresses={savedAddresses}
        selectedAddressId={selectedAddress?.id}
        onClose={() => setAddressModalOpen(false)}
        onSelect={(address) => {
          setSelectedAddressId(address.id);
          setAddressModalOpen(false);
        }}
      />

      <ScreenBottomNav navigation={navigation} />
    </View>
  );
}

function AddressModal({ visible, addresses, selectedAddressId, onClose, onSelect }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.modalTitle}>Manzil tanlang</Text>
          {!addresses.length ? (
            <View style={styles.modalEmpty}>
              <Text style={styles.modalEmptyTitle}>Manzillar yo'q</Text>
              <Text style={styles.modalEmptyText}>
                Profilingizda manzil qo'shilgandan keyin buyurtmaga ulash mumkin bo'ladi.
              </Text>
            </View>
          ) : null}
          {addresses.map((address) => {
            const active = selectedAddressId === address.id;

            return (
              <Pressable
                key={address.id}
                style={[styles.optionRow, active && styles.optionRowActive]}
                onPress={() => onSelect(address)}
              >
                <View style={styles.optionIcon}>
                  <MapPin size={19} color="#0F80B7" strokeWidth={2.6} />
                </View>
                <View style={styles.optionBody}>
                  <Text style={styles.optionTitle}>{address.label || "Manzil"}</Text>
                  <Text style={styles.optionText} numberOfLines={2}>
                    {address.addressText || address.address}
                  </Text>
                </View>
                {active ? <Check size={22} color="#2CD8A5" strokeWidth={3} /> : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ScreenBottomNav({ navigation }) {
  function goTab(screen) {
    navigation.navigate(ROUTES.CLIENT_TABS, { screen });
  }

  return (
    <View style={styles.bottomNav}>
      <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.HOME_TAB)}>
        <Home size={24} color="#0F80B7" fill="#0F80B7" />
        <Text style={[styles.navLabel, styles.navLabelActive]}>Uy</Text>
      </Pressable>
      <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.ORDERS_TAB)}>
        <ClipboardList size={24} color="#A0A7B3" />
        <Text style={styles.navLabel}>Buyurtmalar</Text>
      </Pressable>
      <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.CHATS_TAB)}>
        <MessageCircle size={24} color="#A0A7B3" />
        <Text style={styles.navLabel}>Chatlar</Text>
      </Pressable>
      <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.PROFILE_TAB)}>
        <UserRound size={24} color="#A0A7B3" />
        <Text style={styles.navLabel}>Profil</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F0F9FB"
  },
  header: {
    height: 112,
    paddingTop: 30,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backButton: {
    width: 43,
    height: 43,
    borderRadius: 21.5,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F719D",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 15,
    elevation: 4
  },
  headerTitle: {
    color: "#273248",
    fontSize: 23,
    fontFamily: font.extra
  },
  headerSpacer: {
    width: 43
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 176,
    gap: 20
  },
  formCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 20,
    shadowColor: "#0F719D",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 24,
    elevation: 6
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 19
  },
  cardTitle: {
    color: "#273248",
    fontSize: 21,
    fontFamily: font.extra
  },
  problemGrid: {
    marginTop: 18,
    gap: 10
  },
  problemChip: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D8E2EA",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    justifyContent: "center"
  },
  problemChipActive: {
    borderColor: "#2CD8A5",
    backgroundColor: "#F0FFF9"
  },
  problemText: {
    color: "#273248",
    fontSize: 16,
    fontFamily: font.extra
  },
  problemTextActive: {
    color: "#0F80B7"
  },
  otherInput: {
    marginTop: 12,
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D8E2EA",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    color: "#273248",
    fontSize: 16,
    fontFamily: font.medium
  },
  addText: {
    color: "#2CD8A5",
    fontSize: 15,
    fontFamily: font.extra
  },
  addressBox: {
    minHeight: 74,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#CFE8F0",
    backgroundColor: "#EEF9FC",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  addressIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1597A9",
    alignItems: "center",
    justifyContent: "center"
  },
  addressTextWrap: {
    flex: 1
  },
  addressTitle: {
    color: "#273248",
    fontSize: 19,
    fontFamily: font.extra
  },
  addressText: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 15,
    fontFamily: font.medium
  },
  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 82,
    height: 82,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopWidth: 1,
    borderTopColor: "#E5EEF3",
    paddingHorizontal: 24,
    justifyContent: "center"
  },
  confirmButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "#2CD8A5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2CD8A5",
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    elevation: 7
  },
  confirmButtonDisabled: {
    opacity: 0.68
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: font.extra
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(39,50,72,0.36)"
  },
  modalSheet: {
    marginHorizontal: 16,
    marginBottom: 26,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 18,
    gap: 10
  },
  modalTitle: {
    color: "#273248",
    fontSize: 21,
    fontFamily: font.extra,
    marginBottom: 4
  },
  modalEmpty: {
    borderRadius: 18,
    backgroundColor: "#F6F8FB",
    padding: 16
  },
  modalEmptyTitle: {
    color: "#273248",
    fontSize: 16,
    fontFamily: font.extra
  },
  modalEmptyText: {
    marginTop: 6,
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: font.medium
  },
  optionRow: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EEF1F4",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  optionRowActive: {
    borderColor: "#2CD8A5",
    backgroundColor: "#F0FFF9"
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EAF8FC",
    alignItems: "center",
    justifyContent: "center"
  },
  optionBody: {
    flex: 1
  },
  optionTitle: {
    color: "#273248",
    fontSize: 16,
    fontFamily: font.extra
  },
  optionText: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: font.medium
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 86,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    shadowColor: "#0F719D",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -10 },
    shadowRadius: 18,
    elevation: 10
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5
  },
  navLabel: {
    color: "#A0A7B3",
    fontSize: 14,
    fontFamily: font.bold
  },
  navLabelActive: {
    color: "#0F80B7"
  }
});
