import { useClientStore } from "../store/clientStore";

export function useSelectedWorker() {
  return useClientStore((state) => state.getSelectedWorker());
}
