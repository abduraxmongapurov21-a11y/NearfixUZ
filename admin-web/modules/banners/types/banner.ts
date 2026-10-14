export type BannerTargetType = "NONE" | "CATEGORY" | "URL";
export type BannerPlacement = "HOME" | "CATEGORY";
export type BannerMediaType = "IMAGE" | "VIDEO";

export type AdminBanner = {
  id: string;
  title: string;
  imageUrl: string;
  placement: BannerPlacement;
  mediaType: BannerMediaType;
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
  placement: BannerPlacement;
  mediaType: BannerMediaType;
  targetType: BannerTargetType;
  targetValue?: string;
  sortOrder?: number;
  isActive: boolean;
};
