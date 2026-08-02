import { resolveCatalogOriginAddressId } from "../services/catalog/catalogDistance.mjs";

export function reconcileCatalogAddressState(state, addresses) {
  const catalogOriginAddressId = resolveCatalogOriginAddressId(state.catalogOriginAddressId, addresses);
  return {
    savedAddresses: addresses,
    catalogOriginAddressId,
    catalogSort: catalogOriginAddressId ? state.catalogSort : "recommended"
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
