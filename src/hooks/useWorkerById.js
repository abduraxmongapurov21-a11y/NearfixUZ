import { useClientStore } from "../store/clientStore";

export function useWorkerById(workerId) {
  return useClientStore((state) => state.getWorkerById(workerId));
}
