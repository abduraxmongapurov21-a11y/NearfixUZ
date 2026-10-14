import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { AdminAccountRole, UserRole } from "@prisma/client";
import { prisma } from "../src/db/prisma.js";
import { env } from "../src/config/env.js";
import { createApp } from "../src/http/app.js";
import { deleteMediaObject } from "../src/storage/media.storage.js";
import { hashPassword } from "../src/modules/auth/password.js";
import { createAccessToken } from "../src/modules/auth/session.js";

async function main() {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const uploads: string[] = [];
  async function request(method: string, path: string, token?: string, body?: unknown) {
    const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  }
  async function upload(token: string | undefined, mime: string, bytes: Buffer, name: string) {
    const body = new FormData(); body.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), name);
    const response = await fetch(base + "/admin/banners/upload", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body });
    const payload = await response.json() as any;
    if (payload.imageUrl) uploads.push(new URL(payload.imageUrl).pathname.replace(/^\/uploads\//, ""));
    return { status: response.status, body: payload };
  }
  try {
    const login = await request("POST", "/admin/auth/login", undefined, { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD });
    assert.equal(login.status, 200); const token = login.body.token;
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jzaQAAAAASUVORK5CYII=", "base64");
    assert.equal((await upload(undefined, "image/png", png, "test.png")).status, 401);
    assert.equal((await upload(token, "text/html", Buffer.from("<script>bad</script>"), "test.html")).status, 415);
    const picture = await upload(token, "image/png", png, "banner.png");
    assert.equal(picture.status, 200); assert.equal(picture.body.mediaType, "IMAGE");
    const fetchedImage = await fetch(picture.body.imageUrl);
    assert.equal(fetchedImage.status, 200); assert.match(fetchedImage.headers.get("content-type")!, /^image\/png/);
    assert.deepEqual(Buffer.from(await fetchedImage.arrayBuffer()), png, "stored PNG bytes must be unchanged");
    // Tiny JPEG/WebP fixtures were encoded and software-decoded with an existing
    // local FFmpeg binary. Runtime validation below is only a header check.
    const jpeg = Buffer.from("/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzU4LjQyLjEwMgD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABMAAEBAAAAAAAAAAAAAAAAAAAABwEBAQAAAAAAAAAAAAAAAAAABQcQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/wAARCAAIAAgDASIAAhEAAxEA/9oADAMBAAIRAxEAPwCOAL+Lf//Z", "base64");
    const webp = Buffer.from("UklGRjgAAABXRUJQVlA4ICwAAACQAQCdASoIAAgAAgA0JaACdLoAA5gA/vmTb/+QH/+QH/+QH/8gP+IXeyAwAA==", "base64");
    for (const [mime, bytes, extension, normalized] of [
      ["image/jpeg", jpeg, ".jpg", "image/jpeg"], ["image/jpg", jpeg, ".jpg", "image/jpeg"],
      ["image/pjpeg", jpeg, ".jpg", "image/jpeg"], ["image/x-png", png, ".png", "image/png"],
      ["image/webp", webp, ".webp", "image/webp"]
    ] as const) {
      const accepted = await upload(token, mime, bytes, "original.html");
      assert.equal(accepted.status, 200); assert.equal(accepted.body.mediaType, "IMAGE");
      assert.ok(new URL(accepted.body.imageUrl).pathname.endsWith(extension));
      const downloaded = await fetch(accepted.body.imageUrl);
      assert.equal(downloaded.status, 200); assert.ok(downloaded.headers.get("content-type")?.startsWith(normalized));
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes, `${mime} bytes must be unchanged`);
      console.log(`[F4] valid media ${mime}: PASS unchanged bytes, normalized MIME/extension`);
    }
    // Transport fixture; native playback is verified separately with a playable MP4.
    const mp4Header = Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex");
    const clip = await upload(token, "video/mp4", mp4Header, "banner.mp4");
    assert.equal(clip.status, 200); assert.equal(clip.body.mediaType, "VIDEO");
    const range = await fetch(clip.body.imageUrl, { headers: { Range: "bytes=0-7" } });
    assert.equal(range.status, 206); assert.match(range.headers.get("content-type")!, /^video\/mp4/);
    assert.deepEqual(Buffer.from(await range.arrayBuffer()), mp4Header.subarray(0, 8));
    const freeBox = Buffer.from("0000000866726565", "hex");
    const skipBox = Buffer.from("00000008736b6970", "hex");
    // Header/range transport only; decoded real-file compatibility fixtures are
    // independently checked without adding dated artifact dependencies here.
    for (const [label, padding] of [["free", freeBox], ["skip", skipBox], ["free+skip", Buffer.concat([freeBox, skipBox])]] as const) {
      const paddedHeader = Buffer.concat([padding, mp4Header]);
      const accepted = await upload(token, "video/mp4", paddedHeader, "padded.mp4");
      assert.equal(accepted.status, 200); assert.equal(accepted.body.mediaType, "VIDEO");
      const downloaded = await fetch(accepted.body.imageUrl);
      assert.equal(downloaded.status, 200);
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), paddedHeader);
      console.log(`[F4] MP4 leading ${label}: PASS unchanged bytes, header transport only`);
    }
    const rejectedMedia: string[] = [];
    const arbitrary = Buffer.from("not an image or a video");
    const forgedWebp = Buffer.from(webp);
    for (const offset of [0, 1, 2, 3, 8, 9, 10, 11]) forgedWebp[offset] |= 0x80;
    const forgedMp4Type = Buffer.from(mp4Header);
    for (let offset = 4; offset < 8; offset += 1) forgedMp4Type[offset] |= 0x80;
    const forgedMp4Brands = Buffer.from(mp4Header);
    for (const offset of [8, 9, 10, 11, 16, 17, 18, 19, 20, 21, 22, 23]) forgedMp4Brands[offset] |= 0x80;
    const shortFtyp = Buffer.from(mp4Header); shortFtyp.writeUInt32BE(12, 0);
    const oversizedFtyp = Buffer.from(mp4Header); oversizedFtyp.writeUInt32BE(32, 0);
    const unalignedFtyp = Buffer.from(mp4Header); unalignedFtyp.writeUInt32BE(21, 0);
    for (const [label, mime, bytes] of [
      ["empty JPEG", "image/jpeg", Buffer.alloc(0)], ["empty PNG", "image/png", Buffer.alloc(0)],
      ["empty WebP", "image/webp", Buffer.alloc(0)], ["empty MP4", "video/mp4", Buffer.alloc(0)],
      ["random JPEG", "image/jpeg", arbitrary], ["random PNG", "image/png", arbitrary],
      ["random WebP", "image/webp", arbitrary], ["random MP4", "video/mp4", arbitrary],
      ["PNG declared JPEG", "image/jpeg", png], ["PNG declared WebP", "image/webp", png],
      ["PNG declared MP4", "video/mp4", png], ["JPEG declared PNG", "image/png", jpeg],
      ["WebP declared PNG", "image/png", webp], ["MP4 declared PNG", "image/png", mp4Header],
      ["HEIF ftyp declared MP4", "video/mp4", Buffer.from("000000186674797068656963000000006d69663168656963", "hex")],
      ["forged high-bit WebP tags", "image/webp", forgedWebp], ["forged high-bit MP4 type", "video/mp4", forgedMp4Type],
      ["forged high-bit MP4 brands", "video/mp4", forgedMp4Brands],
      ["truncated JPEG header", "image/jpeg", jpeg.subarray(0, 2)], ["truncated PNG header", "image/png", png.subarray(0, 7)],
      ["truncated WebP header", "image/webp", webp.subarray(0, 11)], ["truncated MP4 header", "video/mp4", mp4Header.subarray(0, 15)],
      ["short MP4 ftyp size", "video/mp4", shortFtyp], ["MP4 ftyp exceeds file", "video/mp4", oversizedFtyp],
      ["unaligned MP4 ftyp size", "video/mp4", unalignedFtyp],
      ["zero-size leading free", "video/mp4", Buffer.concat([Buffer.from("0000000066726565", "hex"), mp4Header])],
      ["unsupported extended-size free", "video/mp4", Buffer.concat([Buffer.from("0000000166726565", "hex"), mp4Header])],
      ["undersized leading free", "video/mp4", Buffer.concat([Buffer.from("0000000766726565", "hex"), mp4Header])],
      ["leading free exceeds file", "video/mp4", Buffer.concat([Buffer.from("0000008066726565", "hex"), mp4Header])],
      ["unknown leading box", "video/mp4", Buffer.concat([Buffer.from("000000086a756e6b", "hex"), mp4Header])],
      ["free without ftyp", "video/mp4", freeBox], ["truncated leading box", "video/mp4", freeBox.subarray(0, 7)],
      ["free then HEIF ftyp", "video/mp4", Buffer.concat([freeBox, Buffer.from("000000186674797068656963000000006d69663168656963", "hex")])],
      ["free then truncated ftyp", "video/mp4", Buffer.concat([freeBox, mp4Header.subarray(0, 15)])],
      ["free then malformed ftyp", "video/mp4", Buffer.concat([freeBox, oversizedFtyp])]
    ] as const) {
      const invalid = await upload(token, mime, bytes, "mismatch.bin");
      const rejected = invalid.status === 415 && invalid.body.code === "UNSUPPORTED_MEDIA_TYPE";
      console.log(`[F4] signature ${label}: ${rejected ? "PASS" : "FAIL"} expected415 actual${invalid.status}`);
      if (!rejected) rejectedMedia.push(label);
    }
    assert.deepEqual(rejectedMedia, [], "empty or mismatched declared media must be rejected before storage");
    assert.equal((await upload(token, "image/png", Buffer.alloc(10 * 1024 * 1024 + 1), "large.png")).status, 413);
    const password = randomUUID(); const passwordHash = await hashPassword(password);
    for (const [label, permissions, role, readStatus, uploadStatus] of [
      ["DB superadmin", [], AdminAccountRole.SUPER_ADMIN, 200, 200],
      ["DB manage only", ["content.manage"], AdminAccountRole.ADMIN, 403, 200],
      ["DB read only", ["content.read"], AdminAccountRole.ADMIN, 200, 403],
      ["DB no permission", [], AdminAccountRole.ADMIN, 403, 403]
    ] as const) {
      const account = await prisma.adminAccount.create({ data: {
        username: `banner-${randomUUID()}`, passwordHash, role, mustChangePassword: false,
        permissions: { create: permissions.map((permission) => ({ permission })) }
      } });
      const auth = await request("POST", "/admin/auth/login", undefined, { username: account.username, password });
      assert.equal(auth.status, 200);
      assert.equal((await request("GET", "/admin/banners", auth.body.token)).status, readStatus);
      assert.equal((await upload(auth.body.token, "image/png", png, "rbac.png")).status, uploadStatus);
      console.log(`[F4] banner RBAC ${label}: PASS read${readStatus} upload${uploadStatus}`);
    }
    for (const [index, role] of [UserRole.CLIENT, UserRole.PROVIDER].entries()) {
      const user = await prisma.user.create({ data: { phone: `+99800000991${index}`, role } });
      const session = await prisma.session.create({ data: { userId: user.id, refreshToken: randomUUID(), expiresAt: new Date(Date.now() + 86_400_000) } });
      const mobileToken = createAccessToken({ userId: user.id, sessionId: session.id, sessionVersion: user.sessionVersion });
      assert.equal((await upload(mobileToken, "image/png", png, "mobile.png")).status, 401);
      console.log(`[F4] banner RBAC mobile ${role}: PASS upload401`);
    }
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    const home = await request("POST", "/admin/banners", token, { title: "Home compatibility", imageUrl: picture.body.imageUrl });
    assert.equal(home.status, 201); assert.equal(home.body.banner.placement, "HOME"); assert.equal(home.body.banner.mediaType, "IMAGE");
    const categoryAd = await request("POST", "/admin/banners", token, { title: "Category image", imageUrl: picture.body.imageUrl, placement: "CATEGORY", targetType: "CATEGORY", targetValue: category.id });
    assert.equal(categoryAd.status, 201);
    assert.equal(categoryAd.body.banner.sortOrder, 0, "category starts its own ordering, independent of HOME");
    const video = await request("POST", "/admin/banners", token, { title: "Category video", imageUrl: clip.body.imageUrl, mediaType: "VIDEO", placement: "CATEGORY", targetType: "URL", targetValue: "https://example.com/offer" });
    assert.equal(video.status, 201);
    const secondHome = await request("POST", "/admin/banners", token, { title: "Main hero video", imageUrl: clip.body.imageUrl, mediaType: "VIDEO", placement: "HOME", targetType: "CATEGORY", targetValue: category.id });
    assert.equal(secondHome.status, 201);
    assert.equal(secondHome.body.banner.sortOrder, home.body.banner.sortOrder + 1, "category creation must not advance HOME ordering");
    assert.equal((await request("GET", "/admin/banners?placement=HOME")).status, 401);
    assert.equal((await request("GET", "/admin/banners?placement=UNKNOWN", token)).status, 400);
    for (const placement of ["HOME", "CATEGORY"]) {
      const adminFeed = await request("GET", `/admin/banners?placement=${placement}`, token);
      assert.equal(adminFeed.status, 200);
      assert.equal(adminFeed.body.banners.length, 2);
      assert.ok(adminFeed.body.banners.every((item: any) => item.placement === placement));
    }
    assert.equal((await request("PATCH", `/admin/banners/${home.body.banner.id}`, token, { placement: "HOME", title: "Updated main hero" })).status, 200);
    assert.equal((await request("PATCH", `/admin/banners/${home.body.banner.id}`, token, { placement: "CATEGORY" })).status, 400, "editing must not silently move a hero to category");
    assert.equal((await request("GET", "/content/banners?placement=HOME")).body.banners.find((item: any) => item.id === home.body.banner.id).title, "Updated main hero");
    assert.equal((await request("POST", "/admin/banners", token, { title: "Bad URL", imageUrl: picture.body.imageUrl, targetType: "URL", targetValue: "javascript:alert(1)" })).status, 400);
    assert.equal((await request("GET", "/content/banners?placement=UNKNOWN")).status, 400);
    const defaultFeed = await request("GET", "/content/banners");
    assert.ok(defaultFeed.body.banners.some((item: any) => item.id === home.body.banner.id));
    assert.ok(defaultFeed.body.banners.every((item: any) => item.placement === "HOME"), "old clients only receive home banners");
    const feed = await request("GET", "/content/banners?placement=CATEGORY");
    assert.deepEqual(new Set(feed.body.banners.map((item: any) => item.id)), new Set([categoryAd.body.banner.id, video.body.banner.id]));
    const videoId = video.body.banner.id;
    assert.equal((await request("PATCH", `/admin/banners/${videoId}`, token, { targetValue: "https://example.com/updated" })).status, 200);
    assert.equal((await request("PATCH", `/admin/banners/${videoId}`, token, { targetValue: null })).status, 400);
    assert.equal((await request("PATCH", `/admin/banners/${videoId}`, token, { isActive: false })).status, 200);
    assert.equal((await request("GET", "/content/banners?placement=CATEGORY")).body.banners.length, 1);
    const noTarget = await request("PATCH", `/admin/banners/${videoId}`, token, { targetType: "NONE", isActive: true });
    assert.equal(noTarget.status, 200); assert.equal(noTarget.body.banner.targetValue, null);
    const categoryOrder = await request("PATCH", "/admin/banners/reorder", token, { placement: "CATEGORY", items: [{ id: videoId, sortOrder: 0 }, { id: categoryAd.body.banner.id, sortOrder: 1 }] });
    assert.equal(categoryOrder.status, 200);
    assert.ok(categoryOrder.body.banners.every((item: any) => item.placement === "CATEGORY"));
    const failedOrder = await request("PATCH", "/admin/banners/reorder", token, { placement: "CATEGORY", items: [{ id: videoId, sortOrder: 20 }, { id: home.body.banner.id, sortOrder: 30 }] });
    assert.equal(failedOrder.status, 400);
    assert.equal(failedOrder.body.code, "BANNER_PLACEMENT_MISMATCH");
    assert.equal((await request("GET", "/admin/banners?placement=CATEGORY", token)).body.banners.find((item: any) => item.id === videoId).sortOrder, 0, "cross-placement reorder must roll back all changes");
    assert.equal((await request("PATCH", "/admin/banners/reorder", token, { placement: "HOME", items: [{ id: home.body.banner.id, sortOrder: 0 }, { id: home.body.banner.id, sortOrder: 1 }] })).status, 400);
    assert.equal((await request("PATCH", "/admin/banners/reorder", token, { placement: "HOME", items: [{ id: secondHome.body.banner.id, sortOrder: 0 }, { id: home.body.banner.id, sortOrder: 1 }] })).status, 200);
    assert.equal((await request("GET", "/content/banners?placement=HOME")).body.banners[0].id, secondHome.body.banner.id);
    assert.equal((await request("GET", "/content/banners?placement=CATEGORY")).body.banners[0].id, videoId);
    assert.equal((await request("DELETE", `/admin/banners/${videoId}`, token)).status, 200);
    assert.equal((await request("GET", "/content/banners?placement=CATEGORY")).body.banners.length, 1);
    assert.equal((await request("GET", "/content/banners?placement=HOME")).body.banners.length, 2, "category deletion must not affect heroes");
    assert.equal((await request("PATCH", `/admin/banners/${secondHome.body.banner.id}`, token, { isActive: false })).status, 200);
    assert.equal((await request("GET", "/content/banners?placement=HOME")).body.banners.length, 1);
    assert.equal((await request("GET", "/content/banners?placement=CATEGORY")).body.banners.length, 1);
    for (const placement of ["HOME", "CATEGORY"]) {
      const fixture = await request("POST", "/admin/banners", token, {
        title: "IPv6 local serializer", placement, imageUrl: "http://[::1]:4000/uploads/banners/serializer-fixture.png"
      });
      assert.equal(fixture.status, 201);
      const feed = await request("GET", `/content/banners?placement=${placement}`);
      const entry = feed.body.banners.find((item: any) => item.id === fixture.body.banner.id);
      assert.equal(entry.imageUrl, `${base}/uploads/banners/serializer-fixture.png`);
      console.log(`[F4] ${placement} IPv6 local serializer: PASS actual HTTP+DB`);
    }
    console.log("Banner image/video upload, local range playback transport, placement isolation, targets, CRUD and authorization tests passed.");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const objectKey of uploads) await deleteMediaObject({ provider: "local", objectKey });
  }
}
main().finally(() => prisma.$disconnect());
