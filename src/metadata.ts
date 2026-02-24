import { defu } from "defu";

// ─── PayU Notes (UDF Fields) ─────────────────────────────────────────────────
// PayU uses User Defined Fields (udf1-udf10) instead of Razorpay's notes object.
// We reserve:
//   udf1 → customerType ("user" | "organization")
//   udf2 → userId
//   udf3 → organizationId (if applicable)
//   udf4 → subscriptionId
//   udf5 → referenceId
//   udf6-udf10 → user-provided metadata

type PayUUdf = Record<string, string | undefined>;

type CustomerInternalUdf =
  | { customerType: "user"; userId: string }
  | { customerType: "organization"; organizationId: string };

type SubscriptionInternalUdf = {
  userId: string;
  subscriptionId: string;
  referenceId: string;
};

// ─── Customer UDF Helpers ────────────────────────────────────────────────────

export const customerUdf = {
  /** Internal keys used for customer tracking */
  keys: ["customerType", "userId", "organizationId"] as const,

  /**
   * Set customer UDFs by mapping internal fields to udf slots.
   * Internal fields take priority over user-provided values.
   */
  set(internalFields: CustomerInternalUdf, userUdf?: PayUUdf): PayUUdf {
    const internal: PayUUdf = {
      udf1: internalFields.customerType,
      udf2: "userId" in internalFields ? internalFields.userId : undefined,
      udf3:
        "organizationId" in internalFields
          ? internalFields.organizationId
          : undefined,
    };
    return defu(internal, userUdf || {}) as PayUUdf;
  },

  /**
   * Extract customer-specific fields from UDF values.
   */
  get(udf: PayUUdf | null | undefined) {
    if (!udf) {
      return {
        userId: undefined,
        organizationId: undefined,
        customerType: undefined as
          | CustomerInternalUdf["customerType"]
          | undefined,
      };
    }
    return {
      userId: udf.udf2,
      organizationId: udf.udf3,
      customerType: udf.udf1 as CustomerInternalUdf["customerType"] | undefined,
    };
  },
};

// ─── Subscription UDF Helpers ────────────────────────────────────────────────

export const subscriptionUdf = {
  /** Internal keys used for subscription tracking */
  keys: ["userId", "subscriptionId", "referenceId"] as const,

  /**
   * Set subscription UDFs by mapping internal fields to udf slots.
   * Internal fields take priority over user-provided values.
   */
  set(internalFields: SubscriptionInternalUdf, userUdf?: PayUUdf): PayUUdf {
    const internal: PayUUdf = {
      udf2: internalFields.userId,
      udf4: internalFields.subscriptionId,
      udf5: internalFields.referenceId,
    };
    return defu(internal, userUdf || {}) as PayUUdf;
  },

  /**
   * Extract subscription-specific fields from UDF values.
   */
  get(udf: PayUUdf | null | undefined) {
    if (!udf) {
      return {
        userId: undefined,
        subscriptionId: undefined,
        referenceId: undefined,
      };
    }
    return {
      userId: udf.udf2,
      subscriptionId: udf.udf4,
      referenceId: udf.udf5,
    };
  },
};

// ─── UDF Serialization ──────────────────────────────────────────────────────

/**
 * Convert a PayUUdf object to individual udf params for API calls.
 */
export function udfToParams(udf: PayUUdf): Record<string, string> {
  const params: Record<string, string> = {};
  for (let i = 1; i <= 10; i++) {
    const key = `udf${i}`;
    if (udf[key]) {
      params[key] = udf[key]!;
    }
  }
  return params;
}

/**
 * Extract UDF fields from a PayU response/webhook into a PayUUdf object.
 */
export function paramsToUdf(
  params: Record<string, string | undefined>,
): PayUUdf {
  const udf: PayUUdf = {};
  for (let i = 1; i <= 10; i++) {
    const key = `udf${i}`;
    if (params[key]) {
      udf[key] = params[key];
    }
  }
  return udf;
}
