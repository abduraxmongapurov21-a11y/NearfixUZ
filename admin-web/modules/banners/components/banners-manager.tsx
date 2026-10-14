"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/shared/components/data-table";
import { adminLabel } from "@/lib/admin-labels";
import { hasPermission } from "@/shared/auth/permissions";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import { useBanners } from "../hooks/use-banners";
import { useCategories } from "@/modules/categories/hooks/use-categories";
import {
  createBanner,
  deleteBanner,
  reorderBanners,
  updateBanner,
  uploadBannerMedia
} from "../services/banners-service";
import type { AdminBanner, BannerInput, BannerPlacement, BannerTargetType } from "../types/banner";

const emptyDraft = (placement: BannerPlacement): BannerInput => ({
  title: "",
  imageUrl: "",
  placement,
  mediaType: "IMAGE",
  targetType: "NONE",
  targetValue: "",
  isActive: true
});

function toDraft(banner: AdminBanner): BannerInput {
  return {
    title: banner.title,
    imageUrl: banner.imageUrl,
    placement: banner.placement,
    mediaType: banner.mediaType || "IMAGE",
    targetType: banner.targetType,
    targetValue: banner.targetValue || "",
    sortOrder: banner.sortOrder,
    isActive: banner.isActive
  };
}

function normalizeDraft(draft: BannerInput): BannerInput {
  return {
    ...draft,
    title: draft.title.trim(),
    imageUrl: draft.imageUrl.trim(),
    targetValue: draft.targetType === "NONE" ? undefined : draft.targetValue?.trim()
  };
}

export function BannersManager({ placement }: { placement: BannerPlacement }) {
  const canManage = useAdminSessionStore((state) => hasPermission(state.session, "content.manage"));
  const { data = [], isPending, isError } = useBanners(placement);
  const isHome = placement === "HOME";
  const { data: categoryData } = useCategories();
  const categories = categoryData?.categories || [];
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<BannerInput>(() => emptyDraft(placement));
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [previewErrors, setPreviewErrors] = useState<Record<string, true>>({});
  const previewKey = `${previewRevision}:${draft.mediaType}:${draft.imageUrl}`;
  const previewFailed = Boolean(previewErrors[previewKey]);
  const sortedBanners = useMemo(
    () => data.filter((banner) => banner.placement === placement).sort((a, b) => a.sortOrder - b.sortOrder),
    [data, placement]
  );

  const saveMutation = useMutation({
    mutationFn: (input: BannerInput) =>
      editingBannerId ? updateBanner(editingBannerId, input) : createBanner(input),
    onMutate: () => {
      setMessage(null);
      setErrorMessage(null);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Banner saqlanmadi");
    },
    onSuccess: async () => {
      setMessage(editingBannerId ? "Banner yangilandi." : "Banner yaratildi.");
      setDraft(emptyDraft(placement));
      setEditingBannerId(null);
      setPreviewRevision((current) => current + 1);
      setPreviewErrors({});
      await queryClient.invalidateQueries({ queryKey: ["banners"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBanner,
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Banner o'chirilmadi");
    },
    onSuccess: async () => {
      setMessage("Banner o'chirildi.");
      await queryClient.invalidateQueries({ queryKey: ["banners"] });
    }
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) => reorderBanners(items, placement),
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Banner tartibi saqlanmadi");
    },
    onSuccess: async () => {
      setMessage("Banner tartibi yangilandi.");
      await queryClient.invalidateQueries({ queryKey: ["banners"] });
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ bannerId, isActive }: { bannerId: string; isActive: boolean }) =>
      updateBanner(bannerId, { isActive }),
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Banner holati saqlanmadi");
    },
    onSuccess: async () => {
      setMessage("Banner holati yangilandi.");
      await queryClient.invalidateQueries({ queryKey: ["banners"] });
    }
  });

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!canManage || !file || uploadingImage || saveMutation.isPending) return;

    setUploadingImage(true);
    setErrorMessage(null);
    try {
      const media = await uploadBannerMedia(file);
      setDraft((current) => ({ ...current, ...media }));
      setPreviewRevision((current) => current + 1);
      setPreviewErrors({});
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Fayl yuklanmadi");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || uploadingImage || saveMutation.isPending || previewFailed) return;
    saveMutation.mutate(normalizeDraft({ ...draft, placement }));
  }

  function handleEdit(banner: AdminBanner) {
    if (!canManage || uploadingImage || saveMutation.isPending || banner.placement !== placement) return;
    setEditingBannerId(banner.id);
    setDraft(toDraft(banner));
    setMessage(null);
    setErrorMessage(null);
    setPreviewRevision((current) => current + 1);
    setPreviewErrors({});
  }

  function handleDelete(banner: AdminBanner) {
    if (!canManage) return;
    if (!window.confirm(`"${banner.title}" banneri o'chirilsinmi?`)) return;
    deleteMutation.mutate(banner.id);
  }

  function handleCancelEdit() {
    if (!canManage || uploadingImage || saveMutation.isPending) return;
    setEditingBannerId(null);
    setDraft(emptyDraft(placement));
    setPreviewRevision((current) => current + 1);
    setPreviewErrors({});
  }

  function moveBanner(banner: AdminBanner, direction: -1 | 1) {
    if (!canManage) return;
    const currentIndex = sortedBanners.findIndex((item) => item.id === banner.id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sortedBanners.length) return;

    const nextItems = [...sortedBanners];
    [nextItems[currentIndex], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[currentIndex]];
    reorderMutation.mutate(nextItems.map((item, index) => ({ id: item.id, sortOrder: index })));
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        {message ? (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {message}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        ) : null}
        {isError ? <p role="alert" className="text-sm text-red-700">Bannerlarni yuklab bo'lmadi. Sahifani yangilab qayta urining.</p> : null}
        {!isError || sortedBanners.length > 0 ? <DataTable
          columns={[
            {
              id: "preview",
              header: "Ko'rinishi",
              cell: ({ row }) => (
                <div className="h-12 w-20 overflow-hidden rounded-md border bg-muted">
                  {row.original.mediaType === "VIDEO" ? (
                    <video src={row.original.imageUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  ) : row.original.imageUrl ? (
                    <div
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url("${row.original.imageUrl}")` }}
                    />
                  ) : null}
                </div>
              )
            },
            { accessorKey: "title", header: "Sarlavha" },
            { accessorKey: "placement", header: "Joylashuvi", cell: ({ row }) => row.original.placement === "CATEGORY" ? "Kategoriya" : "Bosh sahifa" },
            { accessorKey: "mediaType", header: "Media", cell: ({ row }) => row.original.mediaType === "VIDEO" ? "Video" : "Rasm" },
            { accessorKey: "targetType", header: "Yo'naltirish turi", cell: ({ row }) => adminLabel(row.original.targetType) },
            {
              accessorKey: "targetValue",
              header: "Yo'naltirish manzili",
              cell: ({ row }) => <span className="line-clamp-1 max-w-xs">{row.original.targetValue || "-"}</span>
            },
            {
              accessorKey: "isActive",
              header: "Holat",
              cell: ({ row }) => (
                <Badge variant={row.original.isActive ? "success" : "secondary"}>
                  {row.original.isActive ? "Faol" : "Nofaol"}
                </Badge>
              )
            },
            {
              id: "actions",
              header: "Amallar",
              cell: ({ row }) => {
                const index = sortedBanners.findIndex((item) => item.id === row.original.id);
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      aria-label="Yuqoriga"
                      disabled={!canManage || reorderMutation.isPending || index <= 0}
                      onClick={() => moveBanner(row.original, -1)}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label="Pastga"
                      disabled={!canManage || reorderMutation.isPending || index === sortedBanners.length - 1}
                      onClick={() => moveBanner(row.original, 1)}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      disabled={!canManage || toggleMutation.isPending}
                      onClick={() => { if (canManage) toggleMutation.mutate({ bannerId: row.original.id, isActive: !row.original.isActive }); }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {row.original.isActive ? "Nofaol qilish" : "Faollashtirish"}
                    </Button>
                    <Button aria-label="Bannerni tahrirlash" disabled={!canManage || uploadingImage || saveMutation.isPending} onClick={() => handleEdit(row.original)} size="icon" type="button" variant="outline">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label="Bannerni o'chirish"
                      disabled={!canManage || deleteMutation.isPending}
                      onClick={() => handleDelete(row.original)}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              }
            }
          ]}
          data={sortedBanners}
          emptyDescription={isPending ? "Bannerlar yuklanmoqda..." : "Ushbu joylashuvga hali banner qo'shilmagan."}
          emptyTitle={isHome ? "Main hero bannerlari" : "Category bannerlari"}
        /> : null}
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{editingBannerId ? "Bannerni tahrirlash" : "Banner yaratish"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <fieldset className="space-y-4" disabled={!canManage}>
            <div>
              <p className="text-sm font-medium">{isHome ? "Main hero — bosh sahifa" : "Category page — kategoriya sahifalari"}</p>
              <p className="mt-2 text-xs text-muted-foreground">{isHome
                ? "Bosh sahifaning yuqorisidagi banner, balandligi 200 dp. Tayyorlash uchun tavsiya: 1200 × 720 px."
                : "Saralash tugmalari ostidagi banner, balandligi 64 dp. Tayyorlash uchun tavsiya: 1200 × 240 px."}</p>
              <p className="mt-2 text-xs text-muted-foreground">Mobil tasma eni: min(ekran eni, 640) − 46 dp. Rasm va video markazdan kesib to'ldiriladi; kengroq ekranda ko'rinadigan qism o'zgaradi. Muhim yozuvlarni media chetlariga joylamang.</p>
            </div>
            <div>
              <label htmlFor="banner-title" className="text-sm font-medium">Sarlavha</label>
              <Input
                id="banner-title"
                minLength={2}
                maxLength={120}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                required
                value={draft.title}
              />
            </div>
            <div>
              <label htmlFor="banner-media" className="text-sm font-medium">Rasm yoki video yuklash</label>
              <Input id="banner-media" accept="image/jpeg,image/png,image/webp,video/mp4" disabled={!canManage || uploadingImage || saveMutation.isPending} onChange={handleImageChange} type="file" />
              <p className="mt-2 text-xs text-muted-foreground">JPG, PNG, WebP — 10 MB gacha. MP4 (H.264) — 30 MB gacha. Video ovozsiz ijro etiladi.</p>
              {uploadingImage ? <p className="mt-2 text-sm text-muted-foreground">Yuklanmoqda...</p> : null}
              {draft.imageUrl ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Mobil preview: 360 dp ekran uchun 314 × {isHome ? 200 : 64} dp. Shrift qurilmada biroz farq qilishi mumkin.</p>
                  <div className="overflow-x-auto">
                    <div className="relative shrink-0 overflow-hidden" style={{ width: 314, height: isHome ? 200 : 64, borderRadius: isHome ? 25 : 14, backgroundColor: "#075E68" }}>
                      {draft.mediaType === "VIDEO" ? (
                        <video key={previewKey} src={draft.imageUrl} className="absolute inset-0 h-full w-full object-cover object-center" controls autoPlay loop muted playsInline onError={() => setPreviewErrors((current) => ({ ...current, [previewKey]: true }))} />
                      ) : (
                        // Uploaded media is previewed directly so browser load errors can guard saving.
                        <img key={previewKey} src={draft.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-center" onError={() => setPreviewErrors((current) => ({ ...current, [previewKey]: true }))} />
                      )}
                      <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: "rgba(7, 35, 43, 0.66)" }} />
                      <div className={`pointer-events-none absolute inset-0 flex ${isHome ? "items-end" : "items-center"}`} style={{ padding: isHome ? 22 : 12, paddingBottom: isHome ? 30 : 12 }}>
                        <p className="line-clamp-2 font-bold text-white" style={{ paddingRight: 44, fontSize: isHome ? 23 : 14, lineHeight: isHome ? "30px" : "18px" }}>{draft.title}</p>
                      </div>
                      <span className="pointer-events-none absolute font-medium text-white" style={{ top: 6, right: 10, fontSize: 9, opacity: 0.9 }}>Reklama</span>
                    </div>
                  </div>
                  {previewFailed ? <p role="alert" className="text-sm text-red-700">Media ochilmadi. Faylni qayta yuklang yoki tahrirlashni qayta oching. Bu media bilan saqlash bloklandi.</p> : null}
                </div>
              ) : null}
            </div>
            <div>
              <label htmlFor="banner-target-type" className="text-sm font-medium">Yo'naltirish turi</label>
              <select
                id="banner-target-type"
                className="flex h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    targetType: event.target.value as BannerTargetType,
                    targetValue: ""
                  }))
                }
                value={draft.targetType}
              >
                <option value="NONE">Yo'naltirishsiz</option>
                <option value="CATEGORY">Kategoriya</option>
                <option value="URL">Havola</option>
              </select>
            </div>
            <div>
              <label htmlFor="banner-target-value" className="text-sm font-medium">Yo'naltirish manzili</label>
              {draft.targetType === "CATEGORY" ? (
                <select id="banner-target-value" aria-label="Yo'naltirish kategoriyasi" required className="flex h-10 w-full rounded-md border bg-card px-3 text-sm"
                  value={draft.targetValue || ""} onChange={(event) => setDraft((current) => ({ ...current, targetValue: event.target.value }))}>
                  <option value="">Kategoriyani tanlang</option>
                  {draft.targetValue && !categories.some((item) => item.id === draft.targetValue) ? <option value={draft.targetValue}>{draft.targetValue}</option> : null}
                  {categories.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.nameUz}</option>)}
                </select>
              ) : <Input
                id="banner-target-value"
                disabled={draft.targetType === "NONE"}
                type={draft.targetType === "URL" ? "url" : "text"}
                onChange={(event) => setDraft((current) => ({ ...current, targetValue: event.target.value }))}
                placeholder={draft.targetType === "URL" ? "https://..." : ""}
                required={draft.targetType !== "NONE"}
                value={draft.targetValue || ""}
              />}
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                checked={draft.isActive}
                onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
                type="checkbox"
              />
              Faol
            </label>
            <div className="flex gap-2">
              <Button disabled={!canManage || saveMutation.isPending || uploadingImage || !draft.imageUrl || previewFailed} type="submit">
                {saveMutation.isPending ? "Saqlanmoqda..." : editingBannerId ? "Saqlash" : "Yaratish"}
              </Button>
              {editingBannerId ? (
                <Button disabled={!canManage || uploadingImage || saveMutation.isPending} onClick={handleCancelEdit} type="button" variant="outline">
                  Bekor qilish
                </Button>
              ) : null}
            </div>
            </fieldset>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
