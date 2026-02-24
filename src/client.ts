import type { BetterAuthClientPlugin } from "better-auth/client";
import type { payu } from "./index";
import type { PayUPlan } from "./types";

export const payuClient = <
  O extends {
    subscription: boolean;
  },
>(
  options?: O | undefined,
) => {
  return {
    id: "payu-client",
    $InferServerPlugin: {} as ReturnType<
      typeof payu<
        O["subscription"] extends true
          ? {
              merchantKey: string;
              merchantSalt: string;
              subscription: {
                enabled: true;
                plans: PayUPlan[];
              };
            }
          : {
              merchantKey: string;
              merchantSalt: string;
            }
      >
    >,
    pathMethods: {
      // Subscription
      "/payu/subscription/create": "POST",
      "/payu/subscription/pay-and-subscribe": "POST",
      "/payu/subscription/cancel": "POST",
      "/payu/subscription/pause": "POST",
      "/payu/subscription/resume": "POST",
      "/payu/subscription/list": "GET",
      "/payu/subscription/get": "GET",
      "/payu/subscription/update": "POST",
      "/payu/subscription/pre-debit-notify": "POST",
      "/payu/subscription/charge": "POST",
      "/payu/subscription/update-si": "POST",

      // Mandate
      "/payu/mandate/status": "GET",
      "/payu/mandate/modify": "POST",

      // Payment
      "/payu/payment/initiate": "POST",
      "/payu/payment/verify": "POST",
      "/payu/payment/check": "POST",

      // Refund
      "/payu/refund/initiate": "POST",
      "/payu/refund/status": "GET",
      "/payu/refund/list": "POST",

      // Transaction
      "/payu/transaction/info": "GET",
      "/payu/transaction/details": "GET",

      // Utility
      "/payu/upi/validate-vpa": "POST",
      "/payu/plan/list": "GET",
      "/payu/plan/get": "GET",
    },
  } satisfies BetterAuthClientPlugin;
};

export * from "./error-codes";
