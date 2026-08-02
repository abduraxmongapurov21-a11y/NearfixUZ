import React, { useEffect, useState } from "react";
import { ImageBackground, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  Brush,
  Ellipsis,
  Flame,
  Hammer,
  PaintRoller,
  Search,
  SlidersHorizontal,
  Snowflake,
  Wrench,
  Zap
} from "lucide-react-native";
import { ROUTES } from "../../constants/routes";
import { CitySelector } from "../../components/catalog/CitySelector";
import { getInitials } from "../../services/images/imageService";
import { useAuthStore } from "../../store/authStore";
import { useClientStore } from "../../store/clientStore";
import { Text } from "../../i18n/native";

const categoryItems = [
  { id: "plumbing", title: "Santexnik", icon: Wrench, color: "#0F80B7" },
  { id: "electric", title: "Elektrik", icon: Zap, color: "#2CD8A5" },
  { id: "welding", title: "Payvandchi", icon: Flame, color: "#F97316" },
  { id: "repair", title: "Usta", icon: Hammer, color: "#2D3748" },
  { id: "ac", title: "Konditsioner", icon: Snowflake, color: "#60A5FA" },
  { id: "renovation", title: "Ta'mirlash", icon: PaintRoller, color: "#A855F7" },
  { id: "cleaning", title: "Tozalash", icon: Brush, color: "#20BFA5" }
];

const moreCategoryItem = { id: "more", title: "Ko'proq", icon: Ellipsis, color: "#9CA3AF", muted: true };

export function HomeScreen({ navigation }) {
  const session = useAuthStore((state) => state.session);
  const banners = useClientStore((state) => state.banners);
  const selectedCityId = useClientStore((state) => state.selectedCityId);
  const setSelectedCity = useClientStore((state) => state.setSelectedCity);
  const syncBannersFromApi = useClientStore((state) => state.syncBannersFromApi);
  const syncCatalogFromApi = useClientStore((state) => state.syncCatalogFromApi);
  const syncOrdersFromApi = useClientStore((state) => state.syncOrdersFromApi);
  const hasCategoryOverflow = categoryItems.length > 8;
  const visibleCategoryItems = hasCategoryOverflow ? [...categoryItems.slice(0, 7), moreCategoryItem] : categoryItems;
  const greetingName = session?.name?.trim();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    syncCatalogFromApi();
    syncOrdersFromApi();
    syncBannersFromApi();
  }, [selectedCityId, syncBannersFromApi, syncCatalogFromApi, syncOrdersFromApi]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([syncCatalogFromApi(), syncOrdersFromApi(), syncBannersFromApi()]);
    setRefreshing(false);
  }

  function openCategory(title) {
    if (title === "Ko'proq" && !hasCategoryOverflow) return;
    navigation.navigate(ROUTES.CATEGORY, title === "Ko'proq" ? undefined : { profession: title });
  }

  function resolveCategoryTarget(value) {
    const cleanValue = String(value || "")
      .trim()
      .toLowerCase();
    const category = categoryItems.find(
      (item) => item.id.toLowerCase() === cleanValue || item.title.toLowerCase() === cleanValue
    );
    return category?.title || value;
  }

  async function handleBannerPress(banner) {
    if (banner.targetType === "CATEGORY" && banner.targetValue) {
      navigation.navigate(ROUTES.CATEGORY, { profession: resolveCategoryTarget(banner.targetValue) });
      return;
    }

    if (banner.targetType === "URL" && banner.targetValue) {
      try {
        const canOpen = await Linking.canOpenURL(banner.targetValue);
        if (canOpen) await Linking.openURL(banner.targetValue);
      } catch {
        // Ignore invalid or unsupported external URLs so Home remains stable.
      }
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0F80B7" colors={["#0F80B7"]} />
        }
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <Wrench size={22} color="#FFFFFF" strokeWidth={3.4} />
            </View>
            <View>
              <Text style={styles.logoText}>
                Near<Text style={styles.logoAccent}>FIX</Text>
              </Text>
              <Text style={styles.logoTagline}>Sizga yaqin{"\n"}yordam</Text>
            </View>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(greetingName || session?.phone || "NF")}</Text>
          </View>
        </View>

        <View style={styles.heroCopy}>
          <Text style={styles.greeting}>{greetingName ? `Xayrli kun, ${greetingName}!` : "Xayrli kun!"}</Text>
          <Text style={styles.locationText}>Qanday xizmat kerak?</Text>
        </View>

        <View style={styles.citySelectorWrap}>
          <CitySelector selectedCityId={selectedCityId} onSelectCity={setSelectedCity} />
        </View>

        {banners.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.bannerTrack}
          >
            {banners.map((banner) => (
              <BannerCard key={banner.id} banner={banner} onPress={() => handleBannerPress(banner)} />
            ))}
          </ScrollView>
        ) : null}

        <Pressable onPress={() => navigation.navigate(ROUTES.CATEGORY)} style={styles.searchBox}>
          <Search size={24} color="#75B6D0" strokeWidth={2.7} />
          <Text style={styles.searchText}>Qanday xizmat kerak?</Text>
          <View style={styles.searchDivider} />
          <SlidersHorizontal size={24} color="#2CD8A5" strokeWidth={2.8} />
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Kategoriyalar</Text>
          <Pressable onPress={() => navigation.navigate(ROUTES.CATEGORY)}>
            <Text style={styles.sectionAction}>Barchasi</Text>
          </Pressable>
        </View>

        <View style={styles.categoryGrid}>
          {visibleCategoryItems.map((item) => (
            <Pressable key={item.id} onPress={() => openCategory(item.title)} style={styles.categoryItem}>
              <View style={[styles.categoryIconBox, item.muted && styles.categoryIconMuted]}>
                <item.icon size={27} color={item.color} strokeWidth={3.5} />
              </View>
              <Text style={[styles.categoryLabel, item.muted && styles.categoryLabelMuted]}>{item.title}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function BannerCard({ banner, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.promoCard, pressed && styles.pressed]}>
      {banner.imageUrl ? (
        <ImageBackground source={{ uri: banner.imageUrl }} resizeMode="cover" style={styles.bannerImage}>
          <View style={styles.bannerScrim} />
          <Text style={styles.bannerTitle} numberOfLines={2}>
            {banner.title}
          </Text>
        </ImageBackground>
      ) : (
        <View style={styles.bannerFallback}>
          <Text style={styles.bannerTitle} numberOfLines={2}>
            {banner.title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extra: "Inter_800ExtraBold"
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F0F9FB"
  },
  content: {
    paddingTop: 32,
    paddingBottom: 96,
    backgroundColor: "#F0F9FB"
  },
  header: {
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1597A9",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1597A9",
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 8
  },
  logoText: {
    color: "#273248",
    fontSize: 27,
    lineHeight: 29,
    fontFamily: font.extra
  },
  logoAccent: {
    color: "#2CD8A5"
  },
  logoTagline: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 16,
    lineHeight: 17,
    fontFamily: font.semi
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E6F4F8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2D3748",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 5
  },
  avatarText: {
    color: "#0F80B7",
    fontSize: 15,
    fontFamily: font.extra
  },
  heroCopy: {
    paddingHorizontal: 24,
    marginTop: 30
  },
  citySelectorWrap: {
    marginTop: 18,
    paddingHorizontal: 24
  },
  greeting: {
    color: "#273248",
    fontSize: 28,
    lineHeight: 34,
    fontFamily: font.extra
  },
  locationText: {
    marginTop: 10,
    color: "#6B7280",
    fontSize: 18,
    lineHeight: 22,
    fontFamily: font.bold
  },
  bannerTrack: {
    marginTop: 28,
    paddingLeft: 24,
    paddingRight: 24,
    gap: 20
  },
  promoCard: {
    width: 290,
    height: 190,
    borderRadius: 22,
    backgroundColor: "#19A4B4",
    overflow: "hidden"
  },
  bannerImage: {
    flex: 1,
    padding: 22,
    justifyContent: "flex-end"
  },
  bannerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(31,78,106,0.22)"
  },
  bannerFallback: {
    flex: 1,
    padding: 22,
    justifyContent: "flex-end",
    backgroundColor: "#19A4B4"
  },
  bannerTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 31,
    fontFamily: font.extra
  },
  pressed: {
    opacity: 0.78
  },
  promoSecondary: {
    width: 215,
    backgroundColor: "#1F4E6A"
  },
  promoBadge: {
    alignSelf: "flex-start",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 13,
    paddingVertical: 6
  },
  promoBadgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    letterSpacing: 0,
    fontFamily: font.extra
  },
  promoTitle: {
    marginTop: 18,
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 31,
    fontFamily: font.extra
  },
  promoBody: {
    marginTop: 8,
    color: "rgba(255,255,255,0.92)",
    fontSize: 17,
    lineHeight: 23,
    fontFamily: font.medium
  },
  promoButton: {
    marginTop: 18,
    width: 118,
    height: 40,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  promoButtonDark: {
    backgroundColor: "#2CD8A5"
  },
  promoButtonText: {
    color: "#0F719D",
    fontSize: 14,
    fontFamily: font.extra
  },
  decorCircleLarge: {
    position: "absolute",
    right: -14,
    bottom: -11,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.12)"
  },
  decorCircleSmall: {
    position: "absolute",
    right: 52,
    bottom: 64,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.12)"
  },
  decorStripe: {
    position: "absolute",
    right: -16,
    bottom: -16,
    width: 38,
    height: 146,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
    transform: [{ rotate: "45deg" }]
  },
  searchBox: {
    marginHorizontal: 24,
    marginTop: 28,
    height: 56,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(44,216,165,0.18)",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0F719D",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 28,
    elevation: 8
  },
  searchText: {
    flex: 1,
    marginLeft: 14,
    color: "#A3ABB8",
    fontSize: 18,
    fontFamily: font.bold
  },
  searchDivider: {
    width: 1.5,
    height: 30,
    marginRight: 16,
    backgroundColor: "#E5E7EB"
  },
  sectionHeader: {
    marginTop: 32,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: "#273248",
    fontSize: 25,
    lineHeight: 30,
    fontFamily: font.extra
  },
  sectionAction: {
    color: "#2CD8A5",
    fontSize: 17,
    fontFamily: font.extra
  },
  categoryGrid: {
    marginTop: 22,
    paddingHorizontal: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 22
  },
  categoryItem: {
    width: "23%",
    alignItems: "center"
  },
  categoryIconBox: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F719D",
    shadowOpacity: 0.055,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 4
  },
  categoryIconMuted: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  categoryLabel: {
    marginTop: 10,
    color: "#273248",
    fontSize: 14,
    lineHeight: 17,
    textAlign: "center",
    fontFamily: font.extra
  },
  categoryLabelMuted: {
    color: "#818A99"
  }
});
