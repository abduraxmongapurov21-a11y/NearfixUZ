import { Router } from "express";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import { createAddressSchema, updateAddressSchema } from "./address.contracts.js";
import { createAddress, deleteAddress, listAddresses, updateAddress } from "./address.service.js";

export const addressRouter = Router();

addressRouter.use(authenticate);

function toPublicAddress(address: any) {
  return {
    id: address.id,
    title: address.label,
    address: address.addressText,
    lat: address.lat === null || address.lat === undefined ? null : Number(address.lat),
    lng: address.lng === null || address.lng === undefined ? null : Number(address.lng),
    isDefault: Boolean(address.isDefault),
    createdAt: address.createdAt,
    updatedAt: address.updatedAt
  };
}

addressRouter.get("/", async (request, response, next) => {
  try {
    const addresses = await listAddresses(request.user!.id);
    response.json({ ok: true, addresses: addresses.map(toPublicAddress) });
  } catch (error) {
    next(error);
  }
});

addressRouter.post("/", async (request, response, next) => {
  try {
    const input = createAddressSchema.parse(request.body);
    const address = await createAddress(request.user!.id, input);
    response.status(201).json({ ok: true, address: toPublicAddress(address) });
  } catch (error) {
    next(error);
  }
});

addressRouter.patch("/:addressId", async (request, response, next) => {
  try {
    const input = updateAddressSchema.parse(request.body);
    const address = await updateAddress(request.user!.id, request.params.addressId, input);
    response.json({ ok: true, address: toPublicAddress(address) });
  } catch (error) {
    next(error);
  }
});

addressRouter.delete("/:addressId", async (request, response, next) => {
  try {
    await deleteAddress(request.user!.id, request.params.addressId);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
