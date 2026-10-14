import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { ArrowRight, Bell, ChevronRight, Ellipsis, Search, Wrench, X, ClipboardList } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ROUTES } from "../../constants/routes";
import { getInitials } from "../../services/images/imageService";
import { useAuthStore } from "../../store/authStore";
import { useClientStore } from "../../store/clientStore";
import { Text, TextInput } from "../../i18n/native";
import { categoryName } from "../../services/content/categoryService";
import { resolveCategoryIcon, resolveCategoryIconColor } from "../../constants/categoryIcons";
import { CategoryAvailabilityState } from "../../components/category/CategoryAvailabilityState";
import { visibleHomeCategoryItems } from "../../services/content/categoryAvailability.mjs";
import { requireAuthentication } from "../../navigation/protectedActions";
import { colors, font, shadow, CLIENT_CONTENT_BOTTOM } from "../../theme/clientTheme";
import { GlassSurface } from "../../components/client/GlassSurface";
import { BannerCarousel } from "../../components/marketplace/BannerCarousel";
import { bannersForPlacement } from "../../services/content/bannerModel.mjs";

const moreCategoryItem = { id: "more", title: "Ko'proq", icon: Ellipsis, muted: true };

export function HomeScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const categories = useClientStore((state) => state.categories);
  const activeOrder = useClientStore((state) => state.activeOrder);
  const categoryStatus = useClientStore((state) => state.categoryStatus);
  const categoryError = useClientStore((state) => state.categoryError);
  const syncCategoriesFromApi = useClientStore((state) => state.syncCategoriesFromApi);
  const syncOrdersFromApi = useClientStore((state) => state.syncOrdersFromApi);
  const banners = useClientStore((state) => state.banners);
  const syncBannersFromApi = useClientStore((state) => state.syncBannersFromApi);
  const heroBanners = useMemo(() => bannersForPlacement(banners, "HOME"), [banners]);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const greetingName = session?.name?.trim();
  const categoryItems = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        title: categoryName(category, i18n.language),
        icon: resolveCategoryIcon(category.iconKey)
      })),
    [categories, i18n.language]
  );
  const matchingCategories = categoryItems.filter((category) =>
    category.title.toLowerCase().includes(search.trim().toLowerCase())
  );
  const visibleCategoryItems = search.trim()
    ? matchingCategories
    : visibleHomeCategoryItems(categoryItems, moreCategoryItem, showAllCategories);

  useEffect(() => {
    syncCategoriesFromApi();
    syncOrdersFromApi();
    syncBannersFromApi("HOME");
  }, [syncCategoriesFromApi, syncOrdersFromApi, syncBannersFromApi]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([syncOrdersFromApi(), syncCategoriesFromApi(), syncBannersFromApi("HOME")]);
    } finally {
      setRefreshing(false);
    }
  }
  function openCategory(category) {
    if (category.id === "more") {
      setShowAllCategories(true);
      return;
    }
    navigation.navigate(ROUTES.CATEGORY, { categoryId: category.id });
  }
  function openCatalog() {
    navigation.navigate(ROUTES.CATEGORY, { categoryId: null, searchQuery: search.trim() });
  }
  function openNotifications() {
    const root = navigation.getParent() || navigation;
    if (!session) {
      requireAuthentication(root, { kind: "PROTECTED_ROUTE", routeName: ROUTES.NOTIFICATIONS });
      return;
    }
    root.navigate(ROUTES.NOTIFICATIONS);
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
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <Wrench size={23} color={colors.white} strokeWidth={1.8} />
            </View>
            <View>
              <Text translate={false} style={styles.logoText}>
                Near
                <Text translate={false} style={styles.logoAccent}>
                  FIX
                </Text>
              </Text>
              <Text style={styles.tagline}>Sizga yaqin yordam</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <GlassSurface style={styles.iconSurface}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Bildirishnomalar")}
                onPress={openNotifications}
                style={styles.iconButton}
              >
                <Bell size={20} strokeWidth={1.8} color={colors.text} />
              </Pressable>
            </GlassSurface>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Profil")}
              onPress={() => navigation.navigate(ROUTES.PROFILE_TAB)}
              style={styles.avatar}
            >
              <Text translate={false} style={styles.avatarText}>
                {getInitials(greetingName || "NF")}
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.heroCopy}>
          <Text translate={false} style={styles.greeting}>
            {greetingName ? t("Xayrli kun, {{value0}}!", { value0: greetingName }) : t("Xayrli kun!")}
          </Text>
          <Text style={styles.headline}>Qanday xizmat kerak?</Text>
        </View>
        <View style={styles.searchBox}>
          <Search size={20} color={colors.primary} strokeWidth={1.8} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Xizmatlarni qidirish..."
            accessibilityLabel="Xizmatlarni qidirish"
            placeholderTextColor={colors.subtle}
            returnKeyType="search"
            onSubmitEditing={openCatalog}
            style={styles.searchInput}
          />
          {search ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Qidiruvni tozalash")}
              onPress={() => setSearch("")}
              style={styles.clearButton}
            >
              <X size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        {session && activeOrder ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate(ROUTES.ORDERS_TAB, { orderId: activeOrder.id })}
            style={styles.activeOrder}
          >
            <View style={styles.activeIcon}>
              <ClipboardList size={20} color={colors.primary} strokeWidth={1.8} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.activeTitle}>Faol buyurtma</Text>
              <Text style={styles.activeCopy}>Buyurtma holatini ko'rish</Text>
            </View>
            <ChevronRight size={20} color={colors.primary} />
          </Pressable>
        ) : null}
        {!search.trim() ? heroBanners.length ? (
          <BannerCarousel banners={heroBanners} categories={categories} navigation={navigation} placement="HOME" />
        ) : (
          <View style={styles.introCard}>
            <View style={styles.introTop}>
              <Text style={styles.introEyebrow}>NEARFIX</Text>
              <View style={styles.introIcon}>
                <Wrench size={20} color={colors.secondary} strokeWidth={1.6} />
              </View>
            </View>
            <Text style={styles.introTitle}>Kerakli usta, sizga yaqin.</Text>
            <Text style={styles.introCopy}>Xizmatni tanlang, ustalarni solishtiring va buyurtma bering.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={openCatalog}
              style={({ pressed }) => [styles.introButton, pressed && styles.pressed]}
            >
              <Text style={styles.introButtonText}>Usta topish</Text>
              <ArrowRight size={18} color={colors.primaryDark} strokeWidth={1.8} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Kategoriyalar</Text>
          <Pressable accessibilityRole="button" onPress={openCatalog} style={styles.sectionAction}>
            <Text style={styles.sectionActionText}>Barchasi</Text>
            <ChevronRight size={15} color={colors.primary} />
          </Pressable>
        </View>
        <CategoryAvailabilityState
          status={categoryStatus}
          error={categoryError}
          hasData={categories.length > 0}
          onRetry={syncCategoriesFromApi}
        />
        {categories.length ? (
          <View style={styles.categoryGrid}>
            {visibleCategoryItems.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.muted ? t(item.title) : item.title}
                onPress={() => openCategory(item)}
                style={({ pressed }) => [styles.categoryItem, pressed && styles.pressed]}
              >
                <GlassSurface style={[styles.categoryIconBox, item.muted && styles.categoryIconMuted]} intensity={25}>
                  <item.icon size={25} color={item.muted ? colors.muted : resolveCategoryIconColor(item.iconKey)} strokeWidth={1.8} />
                </GlassSurface>
                <Text translate={Boolean(item.muted)} style={styles.categoryLabel}>
                  {item.title}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {categories.length > 0 && search.trim() && !matchingCategories.length ? (
          <View style={styles.emptySearch}>
            <Text style={styles.emptyTitle}>Xizmat topilmadi</Text>
            <Text style={styles.emptyCopy}>Boshqa nom bilan qidirib ko'ring.</Text>
            <Pressable accessibilityRole="button" onPress={openCatalog} style={styles.sectionAction}>
              <Text style={styles.sectionActionText}>Barcha ustalarni ko'rish</Text>
              <ArrowRight size={16} color={colors.primary} />
            </Pressable>
          </View>
        ) : null}
        {showAllCategories && !search.trim() ? (
          <Pressable accessibilityRole="button" onPress={() => setShowAllCategories(false)} style={styles.collapse}>
            <Text style={styles.sectionActionText}>Kamroq ko'rsatish</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingTop: 20,
    paddingBottom: CLIENT_CONTENT_BOTTOM + 12
  },
  header: {
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  logoText: { color: colors.text, fontSize: 23, lineHeight: 27, fontFamily: font.bold, letterSpacing: -0.8 },
  logoAccent: { color: colors.primary },
  tagline: { color: colors.muted, fontSize: 10, lineHeight: 15, fontFamily: font.medium },
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  iconSurface: { width: 44, height: 44, borderRadius: 16 },
  iconButton: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white
  },
  avatarText: { color: colors.primaryDark, fontSize: 13, fontFamily: font.bold },
  heroCopy: { paddingHorizontal: 22, marginTop: 28 },
  greeting: { color: colors.muted, fontSize: 13, lineHeight: 19, fontFamily: font.medium },
  headline: {
    color: colors.text,
    fontSize: 31,
    lineHeight: 39,
    fontFamily: font.bold,
    letterSpacing: -1.1,
    marginTop: 4
  },
  searchBox: {
    marginTop: 20,
    marginHorizontal: 22,
    minHeight: 56,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 6,
    gap: 11,
    ...shadow
  },
  searchInput: { flex: 1, minWidth: 0, height: 54, color: colors.text, fontSize: 14, fontFamily: font.regular },
  clearButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  introCard: {
    marginTop: 20,
    marginHorizontal: 22,
    backgroundColor: colors.primaryDark,
    borderRadius: 25,
    padding: 22
  },
  introTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  introEyebrow: { color: colors.secondary, fontSize: 10, letterSpacing: 2.2, fontFamily: font.semi },
  introIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center"
  },
  introTitle: {
    color: colors.white,
    fontSize: 23,
    lineHeight: 30,
    letterSpacing: -0.7,
    fontFamily: font.bold,
    marginTop: 7
  },
  introCopy: { color: "#D6EDEC", fontSize: 13, lineHeight: 20, fontFamily: font.regular, marginTop: 8, maxWidth: 290 },
  introButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: colors.secondary,
    marginTop: 18,
    paddingHorizontal: 15,
    flexDirection: "row",
    gap: 18,
    alignItems: "center"
  },
  introButtonText: { color: colors.primaryDark, fontSize: 13, fontFamily: font.bold },
  sectionHeader: {
    marginTop: 23,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: { color: colors.text, fontSize: 20, fontFamily: font.bold, letterSpacing: -0.5 },
  sectionAction: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 3 },
  sectionActionText: { color: colors.primary, fontSize: 12, fontFamily: font.semi },
  categoryGrid: {
    marginTop: 12,
    paddingHorizontal: 22,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 19
  },
  categoryItem: { width: "23%", alignItems: "center", gap: 9, minHeight: 96 },
  categoryIconBox: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  categoryIconMuted: { backgroundColor: colors.surface },
  categoryLabel: { color: colors.text, fontSize: 11, lineHeight: 16, textAlign: "center", fontFamily: font.medium },
  activeOrder: {
    marginTop: 18,
    marginHorizontal: 22,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  activeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  flex: { flex: 1 },
  activeTitle: { fontFamily: font.semi, fontSize: 14, color: colors.text },
  activeCopy: { marginTop: 3, fontSize: 12, fontFamily: font.regular, color: colors.muted },
  emptySearch: {
    margin: 22,
    padding: 20,
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border
  },
  emptyTitle: { color: colors.text, fontFamily: font.semi, fontSize: 17 },
  emptyCopy: { marginTop: 6, color: colors.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  collapse: { alignItems: "center", minHeight: 44, justifyContent: "center", marginTop: 12 },
  pressed: { opacity: 0.72 }
});
