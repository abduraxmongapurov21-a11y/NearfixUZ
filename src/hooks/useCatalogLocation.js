import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import * as Location from "expo-location";
import { getCatalogDeviceLocation } from "../services/location/catalogDeviceLocation.mjs";

export function useCatalogLocation() {
  const isFocused = useIsFocused();
  const generation = useRef(0);
  const pendingRequest = useRef(0);
  const [state, setState] = useState({ coordinates: null, loading: true, error: null });
  const refreshLocation = useCallback(async (options) => {
    const request = ++generation.current;
    pendingRequest.current = request;
    setState({ coordinates: null, loading: true, error: null });
    const result = await getCatalogDeviceLocation(Location, options);
    if (pendingRequest.current === request) pendingRequest.current = 0;
    if (request !== generation.current) return { ...result, ok: false, stale: true };
    setState({ coordinates: result.ok ? result.coordinates : null, loading: false, error: result.ok ? null : result.code });
    return result;
  }, []);

  useEffect(() => {
    if (!isFocused) return undefined;
    refreshLocation();
    const subscription = AppState.addEventListener("change", (value) => {
      if (value === "active" && !pendingRequest.current) refreshLocation({ requestPermission: false });
    });
    return () => { generation.current += 1; subscription.remove(); };
  }, [isFocused, refreshLocation]);

  return { ...state, refreshLocation };
}
