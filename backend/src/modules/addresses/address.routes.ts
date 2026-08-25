import { Router } from "express";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import { createAddressSchema, updateAddressSchema } from "./address.contracts.js";
import { createAddress, deleteAddress, listAddresses, updateAddress } from "./address.service.js";
import { toAddressDto } from "./address.dto.js";

export const addressRouter = Router();

addressRouter.use(authenticate);

addressRouter.get("/", async (request, response, next) => {
  try {
    const addresses = await listAddresses(request.user!.id);
    response.json({ ok: true, addresses: addresses.map(toAddressDto) });
  } catch (error) {
    next(error);
  }
});

addressRouter.post("/", async (request, response, next) => {
  try {
    const input = createAddressSchema.parse(request.body);
    const address = await createAddress(request.user!.id, input);
    response.status(201).json({ ok: true, address: toAddressDto(address) });
  } catch (error) {
    next(error);
  }
});

addressRouter.patch("/:addressId", async (request, response, next) => {
  try {
    const input = updateAddressSchema.parse(request.body);
    const address = await updateAddress(request.user!.id, request.params.addressId, input);
    response.json({ ok: true, address: toAddressDto(address) });
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
