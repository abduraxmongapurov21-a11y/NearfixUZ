import React from "react";
import { ClientDock } from "../client/ClientDock";
import { useAuthStore } from "../../store/authStore";
import { ROUTES } from "../../constants/routes";
import { requireAuthentication } from "../../navigation/protectedActions";

export function BottomTabBar({ state, navigation }) {
  const session = useAuthStore((store) => store.session);
  function select(name) {
    const route = state.routes.find((item) => item.name === name);
    if (!route) return;
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (event.defaultPrevented) return;
    if (!session && name !== ROUTES.HOME_TAB && name !== ROUTES.PROFILE_TAB) {
      requireAuthentication(navigation.getParent(), { kind: "PROTECTED_ROUTE", routeName: name });
      return;
    }
    if (state.routes[state.index].name !== name) navigation.navigate(name);
  }
  return (
    <ClientDock
      navigation={navigation}
      activeRoute={state.routes[state.index].name}
      onSelect={select}
      onLongPress={(name) => {
        const route = state.routes.find((item) => item.name === name);
        if (route) navigation.emit({ type: "tabLongPress", target: route.key });
      }}
    />
  );
}
