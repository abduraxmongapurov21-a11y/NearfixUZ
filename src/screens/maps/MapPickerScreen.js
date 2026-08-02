import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
import * as Location from "expo-location";
import { ArrowLeft, Crosshair, LocateFixed, MapPin } from "lucide-react-native";
import MapView from "react-native-maps";
import { colors, radius, shadow, spacing } from "../../theme";
import { Alert, Text } from "../../i18n/native";

const TASHKENT_REGION = {
  latitude: 41.311081,
  longitude: 69.240562,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012
};

function toRegion(coordinate) {
  if (typeof coordinate?.latitude !== "number" || typeof coordinate?.longitude !== "number") return TASHKENT_REGION;

  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    latitudeDelta: coordinate.latitudeDelta || TASHKENT_REGION.latitudeDelta,
    longitudeDelta: coordinate.longitudeDelta || TASHKENT_REGION.longitudeDelta
  };
}

function toCoordinate(region) {
  return {
    latitude: Number(region.latitude.toFixed(7)),
    longitude: Number(region.longitude.toFixed(7))
  };
}

export function MapPickerScreen({ navigation, route, onSelect }) {
  const mapRef = useRef(null);
  const autoLocate = route?.params?.autoLocate !== false;
  const showCoordinateText = route?.params?.showCoordinateText !== false;
  const [region, setRegion] = useState(() => toRegion(route?.params?.initialCoordinate));
  const [selectedCoordinate, setSelectedCoordinate] = useState(() =>
    toCoordinate(toRegion(route?.params?.initialCoordinate))
  );
  const [loadingLocation, setLoadingLocation] = useState(autoLocate);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const coordinateText = useMemo(
    () => `${selectedCoordinate.latitude.toFixed(6)}, ${selectedCoordinate.longitude.toFixed(6)}`,
    [selectedCoordinate]
  );

  useEffect(() => {
    if (autoLocate) centerOnCurrentLocation();
  }, [autoLocate]);

  async function centerOnCurrentLocation() {
    setLoadingLocation(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        setLocationPermissionGranted(false);
        setPermissionDenied(true);
        Alert.alert(
          "Lokatsiya ruxsati kerak",
          "Joriy lokatsiya uchun ruxsat berilmadi. Xaritani qo'lda siljitib nuqta tanlashingiz mumkin."
        );
        return;
      }

      setLocationPermissionGranted(true);
      setPermissionDenied(false);
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      const nextRegion = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: TASHKENT_REGION.latitudeDelta,
        longitudeDelta: TASHKENT_REGION.longitudeDelta
      };

      setRegion(nextRegion);
      setSelectedCoordinate(toCoordinate(nextRegion));
      mapRef.current?.animateToRegion(nextRegion, 450);
    } catch (error) {
      setLocationPermissionGranted(false);
      Alert.alert("Lokatsiya topilmadi", error?.message || "Joriy joylashuvni olishda xatolik yuz berdi.");
    } finally {
      setLoadingLocation(false);
    }
  }

  function handleRegionChangeComplete(nextRegion) {
    setRegion(nextRegion);
    setSelectedCoordinate(toCoordinate(nextRegion));
  }

  function handleConfirm() {
    const selected = selectedCoordinate || toCoordinate(region);

    if (typeof onSelect === "function") {
      onSelect(selected);
      return;
    }

    if (route?.params?.returnTo) {
      if (route.params.returnScreen) {
        navigation.navigate(route.params.returnTo, {
          screen: route.params.returnScreen,
          params: {
            [route.params.returnParamKey || "selectedLocation"]: selected
          }
        });
        return;
      }

      navigation.navigate(route.params.returnTo, {
        [route.params.returnParamKey || "selectedLocation"]: selected
      });
      return;
    }

    navigation.goBack();
  }

  if (Platform.OS === "web") {
    return (
      <View style={styles.unsupported}>
        <Text style={styles.unsupportedTitle}>Xarita mobil ilovada ishlaydi</Text>
        <Text style={styles.unsupportedText}>
          MapPickerScreen react-native-maps orqali Android va iOS uchun tayyorlangan.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        showsUserLocation={locationPermissionGranted && !permissionDenied}
        showsMyLocationButton={false}
        onRegionChangeComplete={handleRegionChangeComplete}
      />

      <View pointerEvents="none" style={styles.centerPinWrap}>
        <View style={styles.centerPinShadow}>
          <MapPin size={44} color={colors.primary} fill={colors.primary} strokeWidth={2.4} />
        </View>
        <View style={styles.centerDot} />
      </View>

      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <ArrowLeft size={22} color={colors.text} strokeWidth={2.7} />
        </Pressable>
        <Text style={styles.headerTitle}>{route?.params?.title || "Lokatsiyani tanlang"}</Text>
        <Pressable onPress={centerOnCurrentLocation} style={styles.iconButton}>
          {loadingLocation ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <LocateFixed size={22} color={colors.primary} strokeWidth={2.7} />
          )}
        </Pressable>
      </View>

      <View style={styles.footer}>
        <View style={styles.coordinateRow}>
          <View style={styles.coordinateIcon}>
            <Crosshair size={19} color={colors.primary} strokeWidth={2.7} />
          </View>
          <View style={styles.coordinateBody}>
            <Text style={styles.coordinateLabel}>Tanlangan nuqta</Text>
            <Text style={styles.coordinateText} translate={!showCoordinateText}>
              {showCoordinateText
                ? coordinateText
                : route?.params?.selectionDescription || "Xarita markazidagi pin xizmat boshlash nuqtasini belgilaydi."}
            </Text>
          </View>
        </View>
        <Pressable onPress={handleConfirm} style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}>
          <Text style={styles.confirmText}>Tanlash</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  map: {
    ...StyleSheet.absoluteFillObject
  },
  header: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    ...shadow
  },
  headerTitle: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    textAlignVertical: "center",
    paddingTop: Platform.OS === "ios" ? 13 : 0,
    ...shadow
  },
  centerPinWrap: {
    position: "absolute",
    left: "50%",
    top: "50%",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -22 }, { translateY: -44 }]
  },
  centerPinShadow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 7
  },
  centerDot: {
    width: 8,
    height: 8,
    marginTop: -3,
    borderRadius: 4,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary
  },
  footer: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow
  },
  coordinateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  coordinateIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF8FC"
  },
  coordinateBody: {
    flex: 1
  },
  coordinateLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  coordinateText: {
    marginTop: 3,
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  confirmButton: {
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.secondary
  },
  confirmText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.75
  },
  unsupported: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.background
  },
  unsupportedTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center"
  },
  unsupportedText: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center"
  }
});
