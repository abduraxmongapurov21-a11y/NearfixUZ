import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { BriefcaseBusiness, MapPin, SlidersHorizontal, Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { colors } from "../../theme/clientTheme";
import { BannerCarousel } from "../../components/marketplace/BannerCarousel";
import { ClientDock } from "../../components/client/ClientDock";
import { ClientHeader } from "../../components/client/ClientHeader";
import { ROUTES } from "../../constants/routes";
import { WORKER_STATUS } from "../../constants/workerStatus";
import { EmptyState } from "../../components/ui/EmptyState";
import { useClientStore } from "../../store/clientStore";
import { WorkerAvatar } from "../../components/ui/WorkerAvatar";
import { Text } from "../../i18n/native";
import { useAuthStore } from "../../store/authStore";
import { useCatalogLocation } from "../../hooks/useCatalogLocation";
import { formatApproximateDistance } from "../../services/catalog/catalogDistance.mjs";
import { sortCatalogWorkers } from "../../services/catalog/catalogSorting.mjs";
import { categoryName, workerCategoryLabel } from "../../services/content/categoryService";
import { CategoryAvailabilityState } from "../../components/category/CategoryAvailabilityState";
import { resolveCategoryRoute } from "../../services/content/categoryAvailability.mjs";
import { workerExperienceLabel } from "../../utils/workerExperience.mjs";

const font = {
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extra: "Inter_800ExtraBold"
};

function hasCategory(worker, categoryId) {
  return !categoryId || (worker.categoryIds || []).includes(categoryId);
}

export function CategoryScreen({ navigation, route }) {
  const { i18n } = useTranslation();
  const allCategories = route.params?.categoryId === null;
  const accountId = useAuthStore((state) => state.session?.userId || null);
  const categories = useClientStore((state) => state.categories);
  const syncCategoriesFromApi = useClientStore((state) => state.syncCategoriesFromApi);
  const categoryStatus = useClientStore((state) => state.categoryStatus);
  const categoryError = useClientStore((state) => state.categoryError);
  const categoriesLastLoadedAt = useClientStore((state) => state.categoriesLastLoadedAt);
  const categoryResolution = allCategories
    ? { kind: "ready", categoryId: undefined, category: undefined }
    : resolveCategoryRoute(
        { categories, status: categoryStatus, lastLoadedAt: categoriesLastLoadedAt },
        route.params?.categoryId
      );
  const categoryId = categoryResolution.kind === "ready" ? categoryResolution.categoryId : undefined;
  const category = categoryResolution.kind === "ready" ? categoryResolution.category : undefined;
  const displayName = allCategories ? "Barchasi" : categoryName(category, i18n.language) || "Category";
  const workers = useClientStore((state) => state.workers);
  const catalogQuery = allCategories ? route.params?.searchQuery || "" : "";
  const categoryBanners = useClientStore((state) => state.categoryBanners);
  const syncBannersFromApi = useClientStore((state) => state.syncBannersFromApi);
  const selectWorker = useClientStore((state) => state.selectWorker);
  const syncCatalogFromApi = useClientStore((state) => state.syncCatalogFromApi);
  const setCatalogDeviceLocation = useClientStore((state) => state.setCatalogDeviceLocation);
  const catalogSort = useClientStore((state) => state.catalogSort);
  const setCatalogSort = useClientStore((state) => state.setCatalogSort);
  const catalogLoading = useClientStore((state) => state.catalogLoading);
  const catalogError = useClientStore((state) => state.apiStatus.lastError);
  const [refreshing, setRefreshing] = useState(false);
  const { coordinates: currentLocation, loading: locationLoading, error: locationError, refreshLocation } = useCatalogLocation();

  useEffect(() => {
    syncCategoriesFromApi();
  }, [syncCategoriesFromApi]);

  useEffect(() => {
    setCatalogDeviceLocation(currentLocation, { preserveSort: locationLoading });
  }, [accountId, currentLocation, locationLoading, setCatalogDeviceLocation]);

  useEffect(() => {
    if (categoryResolution.kind === "ready" && !locationLoading) syncCatalogFromApi(categoryId);
  }, [accountId, catalogSort, categoryResolution.kind, categoryId, currentLocation?.lat, currentLocation?.lng, locationLoading, syncCatalogFromApi]);

  useEffect(() => {
    syncBannersFromApi("CATEGORY");
  }, [syncBannersFromApi, categoryId]);

  const visibleWorkers = useMemo(() => {
    const cleanQuery = catalogQuery.trim().toLowerCase();

    const filteredWorkers = workers
      .filter((worker) => hasCategory(worker, categoryId))
      .filter((worker) => [WORKER_STATUS.AVAILABLE, WORKER_STATUS.BUSY].includes(worker.availability))
      .filter((worker) => {
        if (!cleanQuery) return true;
        return `${worker.name} ${workerCategoryLabel(worker, i18n.language).label}`.toLowerCase().includes(cleanQuery);
      });

    return sortCatalogWorkers(filteredWorkers, catalogSort);
  }, [catalogQuery, catalogSort, categoryId, i18n.language, workers]);

  function openWorker(workerId) {
    selectWorker(workerId);
    navigation.navigate(ROUTES.WORKER_PROFILE, { workerId, categoryId });
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const location = await refreshLocation();
      if (location.stale) return;
      setCatalogDeviceLocation(location.ok ? location.coordinates : null);
      await Promise.all([syncCategoriesFromApi(), syncCatalogFromApi(categoryId), syncBannersFromApi("CATEGORY")]);
    } finally { setRefreshing(false); }
  }

  async function chooseNearestSort() {
    if (!currentLocation) {
      const location = await refreshLocation();
      if (!location.ok || location.stale) return;
      setCatalogDeviceLocation(location.coordinates);
    }
    setCatalogSort("nearest");
  }

  if (categoryResolution.kind !== "ready") {
    const pending = categoryResolution.kind === "pending";
    const empty = categoryResolution.reason === "empty";
    return (
      <View style={styles.screen}>
        <ClientHeader title="Kategoriya" onBack={() => navigation.goBack()} />
        <CategoryAvailabilityState
          status={pending ? "loading" : empty ? "empty" : "error"}
          error={categoryResolution.reason === "invalid" ? "Bu kategoriya faol emas yoki mavjud emas." : categoryError}
          onRetry={syncCategoriesFromApi}
        />
      </View>
    );
  }
  return (
    <View style={styles.screen}>
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
        <ClientHeader title={displayName} subtitle="O'zingizga mos ustani tanlang" onBack={() => navigation.goBack()} />
        <CategoryAvailabilityState
          status={categoryStatus}
          error={categoryError}
          hasData={categories.length > 0}
          onRetry={handleRefresh}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <FilterChip
            active={catalogSort === "recommended"}
            icon={SlidersHorizontal}
            label="Tavsiya etilgan"
            onPress={() => setCatalogSort("recommended")}
          />
          <FilterChip active={catalogSort === "nearest"} icon={MapPin} label="Eng yaqin" onPress={chooseNearestSort} disabled={locationLoading} />
          <FilterChip
            active={catalogSort === "rating"}
            icon={Star}
            label="Reyting"
            onPress={() => setCatalogSort("rating")}
          />
          <FilterChip
            active={catalogSort === "price"}
            icon={BriefcaseBusiness}
            label="Narx"
            onPress={() => setCatalogSort("price")}
          />
        </ScrollView>

        <BannerCarousel banners={categoryBanners} categories={categories} navigation={navigation} placement="CATEGORY" />

        {locationError ? (
          <Pressable style={styles.locationNotice} onPress={handleRefresh} disabled={refreshing || locationLoading} accessibilityRole="button">
            <Text style={styles.locationNoticeText}>
              {locationError === "LOCATION_PERMISSION_DENIED"
                ? "Masofani ko'rsatish uchun joylashuvga ruxsat bering."
                : "Joriy joylashuv aniqlanmadi. GPSni yoqib, qayta urinib ko'ring."}
            </Text>
            <Text style={styles.locationRetry}>Qayta urinish</Text>
          </Pressable>
        ) : null}

        {catalogError ? (
          <Pressable style={styles.catalogError} onPress={handleRefresh} disabled={catalogLoading || refreshing}>
            <Text style={styles.catalogErrorText}>Katalogni yuklashda xatolik yuz berdi. Qayta urinib ko'ring.</Text>
          </Pressable>
        ) : null}

        <View style={styles.list}>
          {locationLoading || (catalogLoading && !visibleWorkers.length) ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>{locationLoading ? "Joylashuv aniqlanmoqda..." : "Ustalar yuklanmoqda..."}</Text>
            </View>
          ) : visibleWorkers.length ? (
            visibleWorkers.map((worker, index) => (
              <WorkerListCard key={worker.id} worker={worker} index={index} onPress={() => openWorker(worker.id)} />
            ))
          ) : (
            <EmptyState
              title="Ustalar topilmadi"
              text={
                catalogQuery.trim()
                  ? "Boshqa nom bilan qidirib ko'ring."
                  : currentLocation
                    ? "100 km radiusda mos va faol ustalar topilmadi."
                    : "Mos va faol ustalar topilmadi."
              }
            />
          )}
        </View>
      </ScrollView>

      <ClientDock navigation={navigation} activeRoute={ROUTES.HOME_TAB} />
    </View>
  );
}

function FilterChip({ active = false, icon: Icon, label, onPress, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Icon size={15} color={active ? colors.white : colors.muted} strokeWidth={1.8} />
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

function WorkerListCard({ worker, onPress }) {
  const { t, i18n } = useTranslation();
  const rating = Number(worker.rating) || 0;
  const topWorker = rating >= 4.85;
  const isBusy = worker.availability === WORKER_STATUS.BUSY;
  const price = worker.basePriceValue
    ? `${Number(worker.basePriceValue).toLocaleString(i18n.language)} ${t("so'm")}`
    : worker.price;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.workerCard, pressed && styles.pressed]}
    >
      {topWorker ? (
        <View style={styles.topBadge}>
          <Text style={styles.topBadgeText}>TOP USTA</Text>
        </View>
      ) : null}
      <WorkerAvatar worker={worker} size={68} radius={16} style={styles.workerImage} />
      <View style={styles.workerInfo}>
        <Text translate={false} style={styles.workerName}>{worker.name}</Text>
        <Text translate={false} style={styles.experience}>{t("Tajriba:")} {workerExperienceLabel(worker.experience, t)}</Text>
        {isBusy ? (
          <View style={styles.busyBadge}>
            <View style={styles.busyDot} />
            <Text style={styles.busyText}>Hozir band</Text>
          </View>
        ) : null}
        <View style={styles.ratingRow}>
          <Star
            size={15}
            color={rating > 0 ? "#A46714" : colors.subtle}
            fill={rating > 0 ? "#F5CE83" : "transparent"}
            strokeWidth={1.7}
          />
          {rating > 0 ? (
            <Text translate={false} style={styles.ratingValue}>
              {rating.toFixed(1)}
            </Text>
          ) : (
            <Text style={styles.reviewCount}>Yangi usta</Text>
          )}
          <Text style={styles.reviewCount}>{Number(worker.completedOrders || 0)} ta ish</Text>
        </View>
        <View style={styles.workerBottom}>
          <View style={styles.distanceRow}>
            <MapPin size={15} color={colors.primary} fill="transparent" strokeWidth={1.8} />
            <Text style={styles.distanceText}>{formatApproximateDistance(worker.distanceMeters)}</Text>
          </View>
          <Text style={styles.priceText}>{price}</Text>
          <Text style={styles.priceMuted}>Boshlang'ich narx</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 640, alignSelf: "center", paddingTop: 0, paddingBottom: 116 },
  header: {
    paddingHorizontal: 22,
    paddingTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  },
  title: { color: colors.text, fontSize: 25, fontFamily: font.bold },
  headerSpacer: { width: 46 },
  locationNotice: { marginTop: 12, marginHorizontal: 22, padding: 12, borderRadius: 14, backgroundColor: colors.primarySoft, gap: 5 },
  locationNoticeText: { color: colors.primaryDark, fontSize: 12, lineHeight: 18, fontFamily: font.medium },
  locationRetry: { color: colors.primary, fontSize: 12, fontFamily: font.semi },
  filterRow: { marginTop: 16, paddingHorizontal: 22, gap: 8 },
  filterChip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.muted, fontSize: 12, fontFamily: font.semi },
  filterTextActive: { color: colors.white },
  list: { paddingHorizontal: 22, paddingTop: 24, gap: 16 },
  loading: { padding: 28, gap: 12, alignItems: "center" },
  loadingText: { color: colors.muted, fontSize: 13, fontFamily: font.medium },
  catalogError: {
    marginTop: 16,
    marginHorizontal: 22,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#F1CFD1",
    backgroundColor: "#FFF3F3",
    padding: 14
  },
  catalogErrorText: { color: colors.danger, fontSize: 13, lineHeight: 20, fontFamily: font.medium },
  workerCard: {
    minHeight: 142,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 16,
    flexDirection: "row",
    gap: 14
  },
  topBadge: {
    position: "absolute",
    right: 16,
    top: -9,
    borderRadius: 8,
    backgroundColor: colors.mintSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#D1EBDC"
  },
  topBadgeText: { color: colors.success, fontSize: 9, fontFamily: font.bold, letterSpacing: 0.6 },
  workerImage: { width: 68, height: 68, borderRadius: 20, backgroundColor: colors.surface },
  workerInfo: { flex: 1, minWidth: 0 },
  workerName: { color: colors.text, fontSize: 17, lineHeight: 24, fontFamily: font.bold },
  experience: { marginTop: 4, color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: font.medium },
  busyBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    borderRadius: 8,
    backgroundColor: "#FFF5E4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  busyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning },
  busyText: { color: colors.warning, fontSize: 10, fontFamily: font.semi },
  ratingRow: { marginTop: 9, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5 },
  ratingValue: { color: colors.text, fontSize: 12, fontFamily: font.semi },
  reviewCount: { color: colors.muted, fontSize: 11, fontFamily: font.medium, marginLeft: 3 },
  workerBottom: { marginTop: 12, gap: 5 },
  distanceRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  distanceText: { flexShrink: 1, color: colors.muted, fontSize: 11, lineHeight: 16, fontFamily: font.medium },
  priceText: { maxWidth: "100%", color: colors.primaryDark, fontSize: 14, fontFamily: font.bold },
  priceMuted: { color: colors.muted, fontSize: 11, fontFamily: font.medium },
  pressed: { opacity: 0.7 }
});
