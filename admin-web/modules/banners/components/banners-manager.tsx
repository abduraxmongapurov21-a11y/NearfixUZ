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
import { useBanners } from "../hooks/use-banners";
import {
  createBanner,
  deleteBanner,
  reorderBanners,
  updateBanner,
  uploadBannerImage
} from "../services/banners-service";
import type { AdminBanner, BannerInput, BannerTargetType } from "../types/banner";

const emptyDraft: BannerInput = {
  title: "",
  imageUrl: "",
  targetType: "NONE",
  targetValue: "",
  isActive: true
};

function toDraft(banner: AdminBanner): BannerInput {
  return {
    title: banner.title,
    imageUrl: banner.imageUrl,
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

export function BannersManager() {
  const { data = [] } = useBanners();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<BannerInput>(emptyDraft);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const sortedBanners = useMemo(
    () => [...data].sort((a, b) => a.sortOrder - b.sortOrder),
    [data]
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
      setDraft(emptyDraft);
      setEditingBannerId(null);
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
    mutationFn: reorderBanners,
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
    if (!file) return;

    setUploadingImage(true);
    setErrorMessage(null);
    try {
      const imageUrl = await uploadBannerImage(file);
      setDraft((current) => ({ ...current, imageUrl }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Rasm yuklanmadi");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMutation.mutate(normalizeDraft(draft));
  }

  function handleEdit(banner: AdminBanner) {
    setEditingBannerId(banner.id);
    setDraft(toDraft(banner));
    setMessage(null);
    setErrorMessage(null);
  }

  function handleDelete(banner: AdminBanner) {
    if (!window.confirm(`"${banner.title}" banneri o'chirilsinmi?`)) return;
    deleteMutation.mutate(banner.id);
  }

  function handleCancelEdit() {
    setEditingBannerId(null);
    setDraft(emptyDraft);
  }

  function moveBanner(banner: AdminBanner, direction: -1 | 1) {
    const currentIndex = sortedBanners.findIndex((item) => item.id === banner.id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sortedBanners.length) return;

    const nextItems = [...sortedBanners];
    [nextItems[currentIndex], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[currentIndex]];
    reorderMutation.mutate(nextItems.map((item, index) => ({ id: item.id, sortOrder: index })));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
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
        <DataTable
          columns={[
            {
              id: "preview",
              header: "Preview",
              cell: ({ row }) => (
                <div className="h-12 w-20 overflow-hidden rounded-md border bg-muted">
                  {row.original.imageUrl ? (
                    <div
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url("${row.original.imageUrl}")` }}
                    />
                  ) : null}
                </div>
              )
            },
            { accessorKey: "title", header: "Title" },
            { accessorKey: "targetType", header: "Target Type" },
            {
              accessorKey: "targetValue",
              header: "Target Value",
              cell: ({ row }) => <span className="line-clamp-1 max-w-xs">{row.original.targetValue || "-"}</span>
            },
            {
              accessorKey: "isActive",
              header: "Active",
              cell: ({ row }) => (
                <Badge variant={row.original.isActive ? "success" : "secondary"}>
                  {row.original.isActive ? "Active" : "Inactive"}
                </Badge>
              )
            },
            {
              id: "actions",
              header: "Actions",
              cell: ({ row }) => {
                const index = sortedBanners.findIndex((item) => item.id === row.original.id);
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      disabled={reorderMutation.isPending || index <= 0}
                      onClick={() => moveBanner(row.original, -1)}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      disabled={reorderMutation.isPending || index === sortedBanners.length - 1}
                      onClick={() => moveBanner(row.original, 1)}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      disabled={toggleMutation.isPending}
                      onClick={() => toggleMutation.mutate({ bannerId: row.original.id, isActive: !row.original.isActive })}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {row.original.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button onClick={() => handleEdit(row.original)} size="icon" type="button" variant="outline">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      disabled={deleteMutation.isPending}
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
          emptyDescription="Hali banner qo'shilmagan."
          emptyTitle="Bannerlar yo'q"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingBannerId ? "Edit banner" : "Create banner"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                required
                value={draft.title}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Image Upload</label>
              <Input accept="image/jpeg,image/png,image/webp" disabled={uploadingImage} onChange={handleImageChange} type="file" />
              {uploadingImage ? <p className="mt-2 text-sm text-muted-foreground">Uploading...</p> : null}
              {draft.imageUrl ? (
                <div className="mt-3 overflow-hidden rounded-md border bg-muted">
                  <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url("${draft.imageUrl}")` }} />
                </div>
              ) : null}
            </div>
            <div>
              <label className="text-sm font-medium">Target Type</label>
              <select
                className="flex h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    targetType: event.target.value as BannerTargetType,
                    targetValue: event.target.value === "NONE" ? "" : current.targetValue
                  }))
                }
                value={draft.targetType}
              >
                <option value="NONE">NONE</option>
                <option value="CATEGORY">CATEGORY</option>
                <option value="URL">URL</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Target Value</label>
              <Input
                disabled={draft.targetType === "NONE"}
                onChange={(event) => setDraft((current) => ({ ...current, targetValue: event.target.value }))}
                placeholder={draft.targetType === "CATEGORY" ? "Santexnik yoki plumbing" : draft.targetType === "URL" ? "https://..." : ""}
                required={draft.targetType !== "NONE"}
                value={draft.targetValue || ""}
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                checked={draft.isActive}
                onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
                type="checkbox"
              />
              Active
            </label>
            <div className="flex gap-2">
              <Button disabled={saveMutation.isPending || uploadingImage || !draft.imageUrl} type="submit">
                {saveMutation.isPending ? "Saving..." : editingBannerId ? "Save" : "Create"}
              </Button>
              {editingBannerId ? (
                <Button onClick={handleCancelEdit} type="button" variant="outline">
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
