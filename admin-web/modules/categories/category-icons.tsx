import { Brush, Flame, Grid2X2, Hammer, PaintRoller, Snowflake, Sparkles, Wrench, Zap, type LucideIcon } from "lucide-react";

export const categoryIcons: Record<string, LucideIcon> = {
  wrench: Wrench,
  zap: Zap,
  flame: Flame,
  hammer: Hammer,
  snowflake: Snowflake,
  paint: PaintRoller,
  sparkles: Sparkles,
  brush: Brush,
  grid: Grid2X2
};

export function resolveCategoryIcon(iconKey: string): LucideIcon {
  return categoryIcons[iconKey] || Grid2X2;
}
