import type { BetterAuthPlugin } from "better-auth";
import type { Organization } from "better-auth/plugins/organization";
import { PAYU_ERROR_CODES } from "./error-codes";
import { createRoutes } from "./routes";
import { getSchema } from "./schema";
import type { PayUOptions, Subscription } from "./types";
import { createAPIError, isActive } from "./utils";

declare module "@better-auth/core" {
  interface BetterAuthPluginRegistry<AuthOptions, Options> {
    payu: {
      creator: typeof payu;
    };
  }
}

export const payu = <O extends PayUOptions>(options: O) => {
  const routes = createRoutes(options);

  const subscriptionEndpoints = {
    payuCreateSubscription: routes.createSubscription,
    payuPayAndSubscribe: routes.payAndSubscribe,
    payuCancelSubscription: routes.cancelSubscription,
    payuPauseSubscription: routes.pauseSubscription,
    payuResumeSubscription: routes.resumeSubscription,
    payuListSubscriptions: routes.listSubscriptions,
    payuGetSubscription: routes.getSubscription,
    payuUpdateSubscription: routes.updateSubscription,
    payuPreDebitNotify: routes.preDebitNotify,
    payuChargeSubscription: routes.chargeSubscription,
    payuUpdateSI: routes.updateSI,
  };

  const mandateEndpoints = {
    payuMandateStatus: routes.mandateStatus,
    payuMandateModify: routes.mandateModify,
  };

  const paymentEndpoints = {
    payuInitiatePayment: routes.initiatePayment,
    payuVerifyPayment: routes.verifyPayment,
    payuCheckPayment: routes.checkPayment,
  };

  const refundEndpoints = {
    payuInitiateRefund: routes.initiateRefund,
    payuRefundStatus: routes.refundStatus,
    payuListRefunds: routes.listRefunds,
  };

  const transactionEndpoints = {
    payuTransactionInfo: routes.transactionInfo,
    payuTransactionDetails: routes.transactionDetails,
  };

  const utilityEndpoints = {
    payuValidateVpa: routes.validateVpa,
    payuListPlans: routes.listPlans,
    payuGetPlan: routes.getPlan,
  };

  return {
    id: "payu",
    endpoints: {
      payuWebhook: routes.webhook,
      ...paymentEndpoints,
      ...refundEndpoints,
      ...transactionEndpoints,
      ...utilityEndpoints,
      ...mandateEndpoints,
      ...((options.subscription?.enabled
        ? subscriptionEndpoints
        : {}) as O["subscription"] extends {
        enabled: true;
      }
        ? typeof subscriptionEndpoints
        : {}),
    },
    init(ctx) {
      if (options.organization?.enabled) {
        const orgPlugin = ctx.getPlugin("organization");
        if (!orgPlugin) {
          ctx.logger.error(`Organization plugin not found`);
          return;
        }

        const existingHooks = orgPlugin.options?.organizationHooks ?? {};

        /**
         * Block organization deletion when there's an active subscription
         */
        const beforeDeletePayUOrg = async (data: {
          organization: Organization;
        }) => {
          const subscription = (await ctx.adapter.findOne({
            model: "subscription",
            where: [
              {
                field: "referenceId",
                value: data.organization.id,
              },
            ],
          })) as Subscription | null;

          if (subscription && isActive(subscription)) {
            throw createAPIError(
              "BAD_REQUEST",
              PAYU_ERROR_CODES.ORGANIZATION_ON_ACTIVE_SUBSCRIPTION,
            );
          }
        };

        orgPlugin.options = {
          ...orgPlugin.options,
          organizationHooks: {
            ...existingHooks,
            beforeDeleteOrganization: async (data: {
              organization: Organization;
            }) => {
              if (existingHooks.beforeDeleteOrganization) {
                await existingHooks.beforeDeleteOrganization(data);
              }
              await beforeDeletePayUOrg(data);
            },
          },
        };
      }
    },
    schema: getSchema(options),
    hooks: {
      after: [
        {
          matcher(context) {
            return context.path === "/user/update";
          },
          async handler(ctx) {
            // Sync user updates if needed
          },
        },
      ],
    },
  } satisfies BetterAuthPlugin;
};

// Export types and utilities
export { PAYU_ERROR_CODES } from "./error-codes";
export {
  customerUdf,
  paramsToUdf,
  subscriptionUdf,
  udfToParams,
} from "./metadata";
export type {
  PayUTransactionResponse,
  PayUWebhookEvent,
  Subscription,
  SubscriptionCallbackData,
  SubscriptionOptions,
} from "./types";
export {
  dateStringToDate,
  generateCommandHash,
  generatePayUHash,
  hasPaymentIssue,
  isActive,
  isAuthenticated,
  isCancelled,
  isPaused,
  isTerminal,
  isUsable,
  timestampToDate,
  toSubscriptionStatus,
  verifyPayUHash,
} from "./utils";
