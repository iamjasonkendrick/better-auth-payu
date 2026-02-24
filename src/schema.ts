import type { BetterAuthPluginDBSchema } from "@better-auth/core/db";
import { mergeSchema } from "better-auth/db";
import type { PayUOptions } from "./types";

export const subscriptions = {
  subscription: {
    fields: {
      plan: {
        type: "string",
        required: true,
      },
      referenceId: {
        type: "string",
        required: true,
      },
      payuCustomerId: {
        type: "string",
        required: false,
      },
      payuSubscriptionId: {
        type: "string",
        required: false,
      },
      payuMandateType: {
        type: "string",
        required: false,
      },
      payuTransactionId: {
        type: "string",
        required: false,
      },
      payuMihpayid: {
        type: "string",
        required: false,
      },
      status: {
        type: "string",
        defaultValue: "created",
      },
      currentStart: {
        type: "date",
        required: false,
      },
      currentEnd: {
        type: "date",
        required: false,
      },
      endedAt: {
        type: "date",
        required: false,
      },
      quantity: {
        type: "number",
        required: false,
        defaultValue: 1,
      },
      totalCount: {
        type: "number",
        required: false,
      },
      paidCount: {
        type: "number",
        required: false,
        defaultValue: 0,
      },
      remainingCount: {
        type: "number",
        required: false,
      },
      cancelledAt: {
        type: "date",
        required: false,
      },
      pausedAt: {
        type: "date",
        required: false,
      },
      cancelAtCycleEnd: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      billingPeriod: {
        type: "string",
        required: false,
      },
      seats: {
        type: "number",
        required: false,
      },
      trialStart: {
        type: "date",
        required: false,
      },
      trialEnd: {
        type: "date",
        required: false,
      },
      metadata: {
        type: "string",
        required: false,
      },
    },
  },
} satisfies BetterAuthPluginDBSchema;

export const user = {
  user: {
    fields: {
      payuCustomerId: {
        type: "string",
        required: false,
      },
    },
  },
} satisfies BetterAuthPluginDBSchema;

export const organization = {
  organization: {
    fields: {
      payuCustomerId: {
        type: "string",
        required: false,
      },
    },
  },
} satisfies BetterAuthPluginDBSchema;

type GetSchemaResult<O extends PayUOptions> = typeof user &
  (O["subscription"] extends { enabled: true } ? typeof subscriptions : {}) &
  (O["organization"] extends { enabled: true } ? typeof organization : {});

export const getSchema = <O extends PayUOptions>(
  options: O,
): GetSchemaResult<O> => {
  let baseSchema: BetterAuthPluginDBSchema = {};

  if (options.subscription?.enabled) {
    baseSchema = {
      ...subscriptions,
      ...user,
    };
  } else {
    baseSchema = {
      ...user,
    };
  }

  if (options.organization?.enabled) {
    baseSchema = {
      ...baseSchema,
      ...organization,
    };
  }

  if (
    options.schema &&
    !options.subscription?.enabled &&
    "subscription" in options.schema
  ) {
    const { subscription: _subscription, ...restSchema } = options.schema;
    return mergeSchema(baseSchema, restSchema) as GetSchemaResult<O>;
  }

  return mergeSchema(baseSchema, options.schema) as GetSchemaResult<O>;
};
