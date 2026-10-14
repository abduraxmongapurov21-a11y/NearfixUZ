import { resolveCatalogRequestOrigin } from "../services/catalog/catalogDistance.mjs";

export function reconcileCatalogAddressState(state, addresses) {
  const { originAddressId: catalogOriginAddressId } = resolveCatalogRequestOrigin({ ...state, savedAddresses: addresses });
  return {
    savedAddresses: addresses,
    catalogOriginAddressId,
    catalogSort: state.catalogUseDeviceLocation || catalogOriginAddressId ? state.catalogSort : "recommended"
  };
}

export function replaceOptimisticAddress(addresses, temporaryId, serverAddress) {
  return addresses.map((address) => {
    if (address.id === temporaryId) return serverAddress;
    if (serverAddress.isDefault) return { ...address, isDefault: false };
    return address;
  });
}

export function replaceUpdatedAddress(addresses, addressId, serverAddress) {
  return addresses.map((address) => {
    if (address.id === addressId) return serverAddress;
    if (serverAddress.isDefault) return { ...address, isDefault: false };
    return address;
  });
}
