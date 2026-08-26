import { Brush, Flame, Grid2X2, Hammer, PaintRoller, Snowflake, Sparkles, Wrench, Zap } from "lucide-react-native";

export const CATEGORY_ICONS = Object.freeze({
  wrench: Wrench,
  zap: Zap,
  flame: Flame,
  hammer: Hammer,
  snowflake: Snowflake,
  paint: PaintRoller,
  sparkles: Sparkles,
  brush: Brush,
  grid: Grid2X2
});

export function resolveCategoryIcon(iconKey) {
  return CATEGORY_ICONS[iconKey] || Grid2X2;
}

const iconColors = Object.freeze({ wrench: "#0F80B7", zap: "#2CD8A5", flame: "#F97316", hammer: "#2D3748", snowflake: "#60A5FA", paint: "#A855F7", sparkles: "#20BFA5", brush: "#20BFA5", grid: "#9CA3AF" });

export function resolveCategoryIconColor(iconKey) {
  return iconColors[iconKey] || iconColors.grid;
}
