export type OtpDeliveryResult = {
  providerMessageId?: string;
};

export interface OtpDeliveryProvider {
  sendOtp(phone: string, code?: string): Promise<OtpDeliveryResult | void>;
}

export type AuthProvider = OtpDeliveryProvider;
