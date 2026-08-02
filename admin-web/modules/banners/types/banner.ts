export type BannerTargetType = "NONE" | "CATEGORY" | "URL";

export type AdminBanner = {
  id: string;
  title: string;
  imageUrl: string;
  targetType: BannerTargetType;
  targetValue?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BannerInput = {
  title: string;
  imageUrl: string;
  targetType: BannerTargetType;
  targetValue?: string;
  sortOrder?: number;
  isActive: boolean;
};
