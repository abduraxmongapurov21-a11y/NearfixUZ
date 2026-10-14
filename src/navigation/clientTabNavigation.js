import { ROUTES } from "../constants/routes";

export function openClientTab(navigation, screen, params) {
  // StackRouter v7 navigate creates a new tabs route from a detail screen.
  // Pop to the existing tabs so old profiles/bookings are removed.
  navigation.popTo(ROUTES.CLIENT_TABS, { screen, ...(params ? { params } : {}) });
}
