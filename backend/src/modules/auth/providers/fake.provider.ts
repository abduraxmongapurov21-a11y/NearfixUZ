import type { AuthProvider } from "./auth-provider.interface.js";

export class FakeAuthProvider implements AuthProvider {
  async sendOtp(_phone: string, _code?: string) {
    return undefined;
  }
}
