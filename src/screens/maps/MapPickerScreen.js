import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
import * as Location from "expo-location";
import { ArrowLeft, Crosshair, LocateFixed, MapPin } from "lucide-react-native";
import { colors, radius, shadow, spacing } from "../../theme";
import { Alert, Text } from "../../i18n/native";
import { reverseGeocodeLocation } from "../../services/location/reverseGeocodeLocation";
import {
  coordinatesMatch,
  createLatestReverseGeocodeController
} from "../../services/location/reverseGeocodeModel.mjs";
import {
  DEFAULT_ZOOM,
  toCanonicalCoordinate,
  toYandexInitialRegion,
  toYandexPoint
} from "../../services/maps/yandexMapAdapter.mjs";
import { loadYandexMapKit } from "../../services/maps/yandexMapKit";
import { IOS_YANDEX_LOCALE_RELAUNCH_REQUIRED } from "../../services/maps/yandexLocaleLifecycle.mjs";
import { useUiStore } from "../../store/uiStore";

const TASHKENT_REGION = {
  latitude: 41.311081,
  longitude: 69.240562,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012
};

const ADDRESS_STATUS = Object.freeze({ IDLE: 0, LOADING: 1, SUCCESS: 2, FAILURE: 3 });

function toRegion(coordinate) {
  const canonical = toCanonicalCoordinate(coordinate);
  if (!canonical) return TASHKENT_REGION;

  return {
    latitude: canonical.latitude,
    longitude: canonical.longitude,
    latitudeDelta: coordinate.latitudeDelta || TASHKENT_REGION.latitudeDelta,
    longitudeDelta: coordinate.longitudeDelta || TASHKENT_REGION.longitudeDelta
  };
}

function toCoordinate(region) {
  return toCanonicalCoordinate(region) || toCanonicalCoordinate(TASHKENT_REGION);
}

export function MapPickerScreen({ navigation, route, onSelect }) {
  const mapRef = useRef(null);
  const mountedRef = useRef(true);
  const geocoderRef = useRef(null);
  const programmaticCoordinateRef = useRef(null);
  const locale = useUiStore((state) => state.locale);
  const mapKit = useMemo(() => loadYandexMapKit(locale), [locale]);
  const previousLocaleRef = useRef(locale);
  const [mapKitInitialized, setMapKitInitialized] = useState(false);
  const [mapKitInitializationFailed, setMapKitInitializationFailed] = useState(false);
  const autoLocate = route?.params?.autoLocate !== false;
  const [region, setRegion] = useState(() => toRegion(route?.params?.initialCoordinate));
  const initialYandexRegionRef = useRef(toYandexInitialRegion(region));
  const [selectedCoordinate, setSelectedCoordinate] = useState(() =>
    toCoordinate(toRegion(route?.params?.initialCoordinate))
  );
  const selectedCoordinateRef = useRef(selectedCoordinate);
  const resolvedLocationRef = useRef(
    typeof route?.params?.initialCoordinate?.address === "string"
      ? {
          coordinate: selectedCoordinate,
          location: {
            address: route.params.initialCoordinate.address,
            ...(route.params.initialCoordinate.city ? { city: route.params.initialCoordinate.city } : {}),
            ...(route.params.initialCoordinate.district ? { district: route.params.initialCoordinate.district } : {}),
            ...(route.params.initialCoordinate.street ? { street: route.params.initialCoordinate.street } : {}),
            ...(route.params.initialCoordinate.postalCode
              ? { postalCode: route.params.initialCoordinate.postalCode }
              : {})
          }
        }
      : null
  );
  const [loadingLocation, setLoadingLocation] = useState(autoLocate);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [addressState, setAddressState] = useState(() => ({
    status: resolvedLocationRef.current ? ADDRESS_STATUS.SUCCESS : ADDRESS_STATUS.IDLE,
    coordinate: selectedCoordinate,
    location: resolvedLocationRef.current?.location || null,
    code: null
  }));

  if (!geocoderRef.current) {
    geocoderRef.current = createLatestReverseGeocodeController(reverseGeocodeLocation);
  }

  useEffect(() => {
    if (!mapKit.ready) return undefined;

    let active = true;
    void mapKit.initialization
      .then(() => {
        if (active) setMapKitInitialized(true);
      })
      .catch(() => {
        if (active) setMapKitInitializationFailed(true);
      });

    return () => {
      active = false;
    };
  }, [mapKit]);

  const readableAddress = useMemo(() => {
    if (addressState.location && coordinatesMatch(addressState.coordinate, selectedCoordinate)) {
      return addressState.location.address;
    }
    return null;
  }, [addressState, selectedCoordinate]);

  useEffect(() => {
    mountedRef.current = true;
    if (autoLocate) centerOnCurrentLocation();
    else resolveSelectedAddress(selectedCoordinateRef.current);

    return () => {
      mountedRef.current = false;
      geocoderRef.current?.invalidate();
    };
    // Route configuration is immutable while this picker instance is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (previousLocaleRef.current === locale) return;
    previousLocaleRef.current = locale;
    geocoderRef.current?.invalidate();
    resolvedLocationRef.current = null;
    void resolveSelectedAddress(selectedCoordinateRef.current);
    // The active app locale must invalidate any in-flight device-locale result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  function selectCoordinate(coordinate) {
    const selected = toCoordinate(coordinate);
    if (!coordinatesMatch(selectedCoordinateRef.current, selected)) {
      resolvedLocationRef.current = null;
    }
    selectedCoordinateRef.current = selected;
    setSelectedCoordinate(selected);
    return selected;
  }

  async function resolveSelectedAddress(coordinate) {
    const selected = toCoordinate(coordinate);
    const preservedLocation = coordinatesMatch(resolvedLocationRef.current?.coordinate, selected)
      ? resolvedLocationRef.current.location
      : null;
    setAddressState({ status: ADDRESS_STATUS.LOADING, coordinate: selected, location: preservedLocation, code: null });

    const result = await geocoderRef.current.resolve({ ...selected, locale });
    if (!mountedRef.current || result.stale || !coordinatesMatch(selectedCoordinateRef.current, result.coordinate)) {
      return { ...result, stale: true };
    }

    if (result.ok) {
      resolvedLocationRef.current = { coordinate: result.coordinate, location: result.location };
      setAddressState({
        status: ADDRESS_STATUS.SUCCESS,
        coordinate: result.coordinate,
        location: result.location,
        code: null
      });
    } else {
      setAddressState({
        status: ADDRESS_STATUS.FAILURE,
        coordinate: result.coordinate,
        location: preservedLocation,
        code: result.code || null
      });
    }

    return result;
  }

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
      const selected = selectCoordinate(nextRegion);
      programmaticCoordinateRef.current = selected;
      mapRef.current?.setCenter(toYandexPoint(selected), DEFAULT_ZOOM, 0, 0, 0.45);
      await resolveSelectedAddress(selected);
    } catch {
      setLocationPermissionGranted(false);
      Alert.alert("Lokatsiya topilmadi", "Joriy joylashuvni olishda xatolik yuz berdi.");
    } finally {
      setLoadingLocation(false);
    }
  }

  function handleCameraPositionChangeEnd(event) {
    const nextCoordinate = toCanonicalCoordinate(event);
    if (!nextCoordinate) return;

    setRegion((current) => ({ ...current, ...nextCoordinate }));
    const selected = selectCoordinate(nextCoordinate);
    if (coordinatesMatch(programmaticCoordinateRef.current, selected)) {
      programmaticCoordinateRef.current = null;
      return;
    }

    programmaticCoordinateRef.current = null;
    resolveSelectedAddress(selected);
  }

  async function handleConfirm() {
    if (confirming) return;
    setConfirming(true);

    let selected = selectedCoordinateRef.current || toCoordinate(region);
    let result = await resolveSelectedAddress(selected);

    if (result.stale || !coordinatesMatch(selected, selectedCoordinateRef.current)) {
      selected = selectedCoordinateRef.current;
      result = await resolveSelectedAddress(selected);
    }

    if (!mountedRef.current || result.stale || !coordinatesMatch(selected, selectedCoordinateRef.current)) {
      if (mountedRef.current) setConfirming(false);
      return;
    }

    if (result.code === IOS_YANDEX_LOCALE_RELAUNCH_REQUIRED) {
      Alert.alert(
        "Til xarita uchun saqlandi",
        "Yandex xarita va manzil tilini yangilash uchun NearFIX ilovasini yoping va qayta oching."
      );
      setConfirming(false);
      return;
    }

    const matchingLocation = result.ok
      ? result.location
      : coordinatesMatch(resolvedLocationRef.current?.coordinate, selected)
        ? resolvedLocationRef.current.location
        : null;
    const confirmedSelection = matchingLocation ? { ...selected, ...matchingLocation } : selected;

    if (typeof onSelect === "function") {
      onSelect(confirmedSelection);
      setConfirming(false);
      return;
    }

    if (route?.params?.returnTo) {
      if (route.params.returnScreen) {
        navigation.navigate(route.params.returnTo, {
          screen: route.params.returnScreen,
          params: {
            [route.params.returnParamKey || "selectedLocation"]: confirmedSelection
          }
        });
        return;
      }

      navigation.navigate(route.params.returnTo, {
        [route.params.returnParamKey || "selectedLocation"]: confirmedSelection
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
          MapPickerScreen Yandex MapKit orqali Android va iOS uchun tayyorlangan.
        </Text>
      </View>
    );
  }

  if (!mapKit.ready) {
    return (
      <View style={styles.unsupported}>
        <Text style={styles.unsupportedTitle}>Yandex xarita sozlanmagan</Text>
        <Text style={styles.unsupportedText}>
          {mapKit.reason === "missing-key"
            ? "Native builddan oldin YANDEX_MAPKIT_API_KEY muhit o'zgaruvchisini kiriting."
            : "Yandex MapKit Expo Go'da ishlamaydi. Native development buildni o'rnating."}
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.unavailableButton}>
          <Text style={styles.unavailableButtonText}>Orqaga</Text>
        </Pressable>
      </View>
    );
  }

  if (!mapKitInitialized || mapKitInitializationFailed) {
    return (
      <View style={styles.unsupported}>
        {mapKitInitializationFailed ? (
          <Text style={styles.unsupportedText}>Yandex MapKit ishga tushmadi.</Text>
        ) : (
          <ActivityIndicator color={colors.primary} size="large" />
        )}
      </View>
    );
  }

  const YandexMap = mapKit.MapComponent;

  return (
    <View style={styles.screen}>
      <YandexMap
        ref={mapRef}
        style={styles.map}
        initialRegion={initialYandexRegionRef.current}
        showUserPosition={locationPermissionGranted && !permissionDenied}
        followUser={false}
        onCameraPositionChangeEnd={handleCameraPositionChangeEnd}
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
            {addressState.status === ADDRESS_STATUS.LOADING ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Crosshair size={19} color={colors.primary} strokeWidth={2.7} />
            )}
          </View>
          <View style={styles.coordinateBody}>
            <Text style={styles.coordinateLabel}>Tanlangan manzil</Text>
            <Text style={styles.coordinateText} translate={!readableAddress} numberOfLines={2}>
              {readableAddress ||
                (addressState.status === ADDRESS_STATUS.LOADING
                  ? "Manzil aniqlanmoqda..."
                  : addressState.status === ADDRESS_STATUS.FAILURE
                    ? addressState.code === IOS_YANDEX_LOCALE_RELAUNCH_REQUIRED
                      ? "Xarita tilini yangilash uchun ilovani yoping va qayta oching."
                      : "Manzil aniqlanmadi. Koordinata saqlanadi."
                    : route?.params?.selectionDescription || "Manzil aniqlanmoqda...")}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={handleConfirm}
          disabled={confirming}
          style={({ pressed }) => [styles.confirmButton, (pressed || confirming) && styles.pressed]}
        >
          <Text style={styles.confirmText}>{confirming ? "Manzil tekshirilmoqda..." : "Tanlash"}</Text>
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
  },
  unavailableButton: {
    minWidth: 120,
    minHeight: 46,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.secondary
  },
  unavailableButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "900"
  }
});
