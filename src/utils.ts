import { APIError } from "better-call";
import { createHmac } from "crypto";
import type {
  PayUOptions,
  PayUPlan,
  PayUSubscriptionStatus,
  Subscription,
} from "./types";

// ─── API Error Helper ────────────────────────────────────────────────────────

export function createAPIError(
  status: ConstructorParameters<typeof APIError>[0],
  message: string,
): APIError {
  return new APIError(status, { body: { message, code: message } });
}

// ─── Hash Generation ─────────────────────────────────────────────────────────

/**
 * Generate PayU hash using HMAC-SHA256 with merchant salt.
 * Hash formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|...|udf10||salt)
 */
export function generatePayUHash(
  params: {
    key: string;
    txnid: string;
    amount: string;
    productinfo: string;
    firstname: string;
    email: string;
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
    udf6?: string;
    udf7?: string;
    udf8?: string;
    udf9?: string;
    udf10?: string;
  },
  salt: string,
): string {
  const hashString = [
    params.key,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    params.udf1 || "",
    params.udf2 || "",
    params.udf3 || "",
    params.udf4 || "",
    params.udf5 || "",
    params.udf6 || "",
    params.udf7 || "",
    params.udf8 || "",
    params.udf9 || "",
    params.udf10 || "",
    salt,
  ].join("|");

  return createHmac("sha512", "").update(hashString).digest("hex");
}

/**
 * Verify PayU webhook/response hash.
 * Reverse hash: sha512(salt|status||||||||||udf10|udf9|...|udf1|email|firstname|productinfo|amount|txnid|key)
 */
export function verifyPayUHash(
  params: {
    key: string;
    txnid: string;
    amount: string;
    productinfo: string;
    firstname: string;
    email: string;
    status: string;
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
    udf6?: string;
    udf7?: string;
    udf8?: string;
    udf9?: string;
    udf10?: string;
  },
  salt: string,
  receivedHash: string,
): boolean {
  const reverseHashString = [
    salt,
    params.status,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    params.udf10 || "",
    params.udf9 || "",
    params.udf8 || "",
    params.udf7 || "",
    params.udf6 || "",
    params.udf5 || "",
    params.udf4 || "",
    params.udf3 || "",
    params.udf2 || "",
    params.udf1 || "",
    params.email,
    params.firstname,
    params.productinfo,
    params.amount,
    params.txnid,
    params.key,
  ].join("|");

  const computedHash = createHmac("sha512", "")
    .update(reverseHashString)
    .digest("hex");

  return computedHash === receivedHash;
}

// ─── Plan Lookup Helpers ─────────────────────────────────────────────────────

export async function getPlans(
  subscriptionOptions: PayUOptions["subscription"],
): Promise<PayUPlan[]> {
  if (subscriptionOptions?.enabled) {
    return typeof subscriptionOptions.plans === "function"
      ? await subscriptionOptions.plans()
      : subscriptionOptions.plans || [];
  }
  throw new Error("Subscriptions are not enabled in the PayU options.");
}

export async function getPlanByName(
  options: PayUOptions,
  name: string,
): Promise<PayUPlan | undefined> {
  return await getPlans(options.subscription).then((res) =>
    res.find((plan) => plan.name.toLowerCase() === name.toLowerCase()),
  );
}

export async function getPlanByPlanId(
  options: PayUOptions,
  planId: string,
): Promise<PayUPlan | undefined> {
  return await getPlans(options.subscription).then((res) =>
    res.find((plan) => plan.planId === planId || plan.annualPlanId === planId),
  );
}

// ─── Status Checkers ─────────────────────────────────────────────────────────

export function isActive(sub: Subscription | { status: string }): boolean {
  return sub.status === "active";
}

export function isAuthenticated(
  sub: Subscription | { status: string },
): boolean {
  return sub.status === "authenticated";
}

export function isPaused(sub: Subscription | { status: string }): boolean {
  return sub.status === "paused";
}

export function isCancelled(sub: Subscription | { status: string }): boolean {
  return sub.status === "cancelled";
}

export function isTerminal(sub: Subscription | { status: string }): boolean {
  return (
    sub.status === "cancelled" ||
    sub.status === "completed" ||
    sub.status === "expired"
  );
}

export function isUsable(sub: Subscription | { status: string }): boolean {
  return sub.status === "active" || sub.status === "authenticated";
}

export function hasPaymentIssue(
  sub: Subscription | { status: string },
): boolean {
  return sub.status === "pending" || sub.status === "halted";
}

// ─── Date Helpers ────────────────────────────────────────────────────────────

export function timestampToDate(
  timestamp: number | null | undefined,
): Date | undefined {
  return timestamp ? new Date(timestamp * 1000) : undefined;
}

export function dateStringToDate(
  dateStr: string | null | undefined,
): Date | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? undefined : d;
}

// ─── Status Mapper ───────────────────────────────────────────────────────────

export function toSubscriptionStatus(status: string): PayUSubscriptionStatus {
  const validStatuses: PayUSubscriptionStatus[] = [
    "created",
    "authenticated",
    "active",
    "pending",
    "halted",
    "cancelled",
    "completed",
    "expired",
    "paused",
  ];
  if (validStatuses.includes(status as PayUSubscriptionStatus)) {
    return status as PayUSubscriptionStatus;
  }
  return "created";
}

// ─── PayU API Command Hash ───────────────────────────────────────────────────

/**
 * Generate hash for PayU API commands (verify_payment, cancel_refund, etc.)
 * Hash formula: sha512(key|command|var1|salt)
 */
export function generateCommandHash(
  key: string,
  command: string,
  var1: string,
  salt: string,
): string {
  const hashString = `${key}|${command}|${var1}|${salt}`;
  return createHmac("sha512", "").update(hashString).digest("hex");
}
