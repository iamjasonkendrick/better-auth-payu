import { describe, expect, it } from "vitest";
import type { PayUOptions, PayUPlan } from "../types";
import {
  createAPIError,
  dateStringToDate,
  generateCommandHash,
  generatePayUHash,
  getPlanByName,
  getPlanByPlanId,
  getPlans,
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
} from "../utils";

// ─── Test Plans ──────────────────────────────────────────────────────────────

const testPlans: PayUPlan[] = [
  {
    planId: "plan_monthly",
    name: "Monthly",
    amount: "499",
    billingCycle: "MONTHLY",
    billingInterval: 1,
    totalCount: 12,
    annualPlanId: "plan_annual",
  },
  {
    planId: "plan_annual",
    name: "Annual",
    amount: "4999",
    billingCycle: "YEARLY",
    billingInterval: 1,
    totalCount: 1,
  },
];

const testOptions: PayUOptions = {
  merchantKey: "testKey",
  merchantSalt: "testSalt",
  subscription: {
    enabled: true,
    plans: testPlans,
  },
};

// ─── createAPIError ──────────────────────────────────────────────────────────

describe("createAPIError", () => {
  it("should create an APIError with correct status and body", () => {
    const err = createAPIError("BAD_REQUEST", "Test error message");
    expect(err).toBeDefined();
    expect(err.status).toBe("BAD_REQUEST");
    expect(err.body).toBeDefined();
  });

  it("should create an APIError with different statuses", () => {
    const notFound = createAPIError("NOT_FOUND", "Not found");
    expect(notFound.status).toBe("NOT_FOUND");

    const unauthorized = createAPIError("UNAUTHORIZED", "Unauthorized");
    expect(unauthorized.status).toBe("UNAUTHORIZED");
  });
});

// ─── generatePayUHash ────────────────────────────────────────────────────────

describe("generatePayUHash", () => {
  it("should generate a hash string", () => {
    const hash = generatePayUHash(
      {
        key: "testKey",
        txnid: "txn123",
        amount: "100",
        productinfo: "TestProduct",
        firstname: "John",
        email: "john@test.com",
      },
      "testSalt",
    );
    expect(hash).toBeDefined();
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("should produce consistent hashes for same input", () => {
    const params = {
      key: "testKey",
      txnid: "txn123",
      amount: "100",
      productinfo: "TestProduct",
      firstname: "John",
      email: "john@test.com",
    };
    const hash1 = generatePayUHash(params, "testSalt");
    const hash2 = generatePayUHash(params, "testSalt");
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different salts", () => {
    const params = {
      key: "testKey",
      txnid: "txn123",
      amount: "100",
      productinfo: "TestProduct",
      firstname: "John",
      email: "john@test.com",
    };
    const hash1 = generatePayUHash(params, "salt1");
    const hash2 = generatePayUHash(params, "salt2");
    expect(hash1).not.toBe(hash2);
  });

  it("should include udf fields in hash", () => {
    const hashWithUdf = generatePayUHash(
      {
        key: "testKey",
        txnid: "txn123",
        amount: "100",
        productinfo: "TestProduct",
        firstname: "John",
        email: "john@test.com",
        udf1: "custom1",
      },
      "testSalt",
    );
    const hashWithoutUdf = generatePayUHash(
      {
        key: "testKey",
        txnid: "txn123",
        amount: "100",
        productinfo: "TestProduct",
        firstname: "John",
        email: "john@test.com",
      },
      "testSalt",
    );
    expect(hashWithUdf).not.toBe(hashWithoutUdf);
  });
});

// ─── verifyPayUHash ──────────────────────────────────────────────────────────

describe("verifyPayUHash", () => {
  it("should return false for mismatched hash", () => {
    const result = verifyPayUHash(
      {
        key: "testKey",
        txnid: "txn123",
        amount: "100",
        productinfo: "TestProduct",
        firstname: "John",
        email: "john@test.com",
        status: "success",
      },
      "testSalt",
      "invalid_hash",
    );
    expect(result).toBe(false);
  });

  it("should produce consistent results", () => {
    const params = {
      key: "testKey",
      txnid: "txn123",
      amount: "100",
      productinfo: "TestProduct",
      firstname: "John",
      email: "john@test.com",
      status: "success",
    };
    const result1 = verifyPayUHash(params, "testSalt", "hash1");
    const result2 = verifyPayUHash(params, "testSalt", "hash1");
    expect(result1).toBe(result2);
  });
});

// ─── generateCommandHash ────────────────────────────────────────────────────

describe("generateCommandHash", () => {
  it("should generate a hash for a command", () => {
    const hash = generateCommandHash("key", "verify_payment", "txn123", "salt");
    expect(hash).toBeDefined();
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("should produce consistent hashes", () => {
    const hash1 = generateCommandHash(
      "key",
      "verify_payment",
      "txn123",
      "salt",
    );
    const hash2 = generateCommandHash(
      "key",
      "verify_payment",
      "txn123",
      "salt",
    );
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different commands", () => {
    const hash1 = generateCommandHash(
      "key",
      "verify_payment",
      "txn123",
      "salt",
    );
    const hash2 = generateCommandHash("key", "check_payment", "txn123", "salt");
    expect(hash1).not.toBe(hash2);
  });
});

// ─── getPlans ────────────────────────────────────────────────────────────────

describe("getPlans", () => {
  it("should return plans when subscription is enabled", async () => {
    const plans = await getPlans({ enabled: true, plans: testPlans });
    expect(plans).toEqual(testPlans);
  });

  it("should handle async plan function", async () => {
    const plans = await getPlans({
      enabled: true,
      plans: async () => testPlans,
    });
    expect(plans).toEqual(testPlans);
  });

  it("should return empty array when plans are undefined", async () => {
    const plans = await getPlans({ enabled: true });
    expect(plans).toEqual([]);
  });

  it("should throw when subscription is not enabled", async () => {
    await expect(getPlans({ enabled: false })).rejects.toThrow(
      "Subscriptions are not enabled",
    );
  });

  it("should throw when subscription is undefined", async () => {
    await expect(getPlans(undefined)).rejects.toThrow(
      "Subscriptions are not enabled",
    );
  });
});

// ─── getPlanByName ───────────────────────────────────────────────────────────

describe("getPlanByName", () => {
  it("should find a plan by name (case-insensitive)", async () => {
    const plan = await getPlanByName(testOptions, "monthly");
    expect(plan?.planId).toBe("plan_monthly");
  });

  it("should find a plan with different casing", async () => {
    const plan = await getPlanByName(testOptions, "ANNUAL");
    expect(plan?.planId).toBe("plan_annual");
  });

  it("should return undefined for non-existent plan", async () => {
    const plan = await getPlanByName(testOptions, "nonexistent");
    expect(plan).toBeUndefined();
  });
});

// ─── getPlanByPlanId ─────────────────────────────────────────────────────────

describe("getPlanByPlanId", () => {
  it("should find a plan by planId", async () => {
    const plan = await getPlanByPlanId(testOptions, "plan_monthly");
    expect(plan?.name).toBe("Monthly");
  });

  it("should find a plan by annualPlanId", async () => {
    const plan = await getPlanByPlanId(testOptions, "plan_annual");
    expect(plan).toBeDefined();
  });

  it("should return undefined for non-existent planId", async () => {
    const plan = await getPlanByPlanId(testOptions, "plan_nonexistent");
    expect(plan).toBeUndefined();
  });
});

// ─── Status Checkers ─────────────────────────────────────────────────────────

describe("isActive", () => {
  it("returns true for active status", () => {
    expect(isActive({ status: "active" })).toBe(true);
  });
  it("returns false for other statuses", () => {
    expect(isActive({ status: "paused" })).toBe(false);
    expect(isActive({ status: "cancelled" })).toBe(false);
    expect(isActive({ status: "created" })).toBe(false);
  });
});

describe("isAuthenticated", () => {
  it("returns true for authenticated status", () => {
    expect(isAuthenticated({ status: "authenticated" })).toBe(true);
  });
  it("returns false for other statuses", () => {
    expect(isAuthenticated({ status: "active" })).toBe(false);
  });
});

describe("isPaused", () => {
  it("returns true for paused status", () => {
    expect(isPaused({ status: "paused" })).toBe(true);
  });
  it("returns false for other statuses", () => {
    expect(isPaused({ status: "active" })).toBe(false);
  });
});

describe("isCancelled", () => {
  it("returns true for cancelled status", () => {
    expect(isCancelled({ status: "cancelled" })).toBe(true);
  });
  it("returns false for other statuses", () => {
    expect(isCancelled({ status: "active" })).toBe(false);
  });
});

describe("isTerminal", () => {
  it("returns true for cancelled, completed, expired", () => {
    expect(isTerminal({ status: "cancelled" })).toBe(true);
    expect(isTerminal({ status: "completed" })).toBe(true);
    expect(isTerminal({ status: "expired" })).toBe(true);
  });
  it("returns false for non-terminal statuses", () => {
    expect(isTerminal({ status: "active" })).toBe(false);
    expect(isTerminal({ status: "paused" })).toBe(false);
    expect(isTerminal({ status: "pending" })).toBe(false);
  });
});

describe("isUsable", () => {
  it("returns true for active and authenticated", () => {
    expect(isUsable({ status: "active" })).toBe(true);
    expect(isUsable({ status: "authenticated" })).toBe(true);
  });
  it("returns false for other statuses", () => {
    expect(isUsable({ status: "paused" })).toBe(false);
    expect(isUsable({ status: "cancelled" })).toBe(false);
  });
});

describe("hasPaymentIssue", () => {
  it("returns true for pending and halted", () => {
    expect(hasPaymentIssue({ status: "pending" })).toBe(true);
    expect(hasPaymentIssue({ status: "halted" })).toBe(true);
  });
  it("returns false for other statuses", () => {
    expect(hasPaymentIssue({ status: "active" })).toBe(false);
    expect(hasPaymentIssue({ status: "cancelled" })).toBe(false);
  });
});

// ─── timestampToDate ─────────────────────────────────────────────────────────

describe("timestampToDate", () => {
  it("should convert a Unix timestamp to Date", () => {
    const date = timestampToDate(1700000000);
    expect(date).toBeInstanceOf(Date);
    expect(date!.getTime()).toBe(1700000000 * 1000);
  });

  it("should return undefined for null", () => {
    expect(timestampToDate(null)).toBeUndefined();
  });

  it("should return undefined for undefined", () => {
    expect(timestampToDate(undefined)).toBeUndefined();
  });

  it("should return undefined for 0", () => {
    expect(timestampToDate(0)).toBeUndefined();
  });
});

// ─── dateStringToDate ────────────────────────────────────────────────────────

describe("dateStringToDate", () => {
  it("should parse a valid date string", () => {
    const date = dateStringToDate("2024-01-15");
    expect(date).toBeInstanceOf(Date);
  });

  it("should return undefined for null", () => {
    expect(dateStringToDate(null)).toBeUndefined();
  });

  it("should return undefined for undefined", () => {
    expect(dateStringToDate(undefined)).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(dateStringToDate("")).toBeUndefined();
  });

  it("should return undefined for invalid date string", () => {
    expect(dateStringToDate("not-a-date")).toBeUndefined();
  });
});

// ─── toSubscriptionStatus ────────────────────────────────────────────────────

describe("toSubscriptionStatus", () => {
  it("should return valid statuses as-is", () => {
    expect(toSubscriptionStatus("created")).toBe("created");
    expect(toSubscriptionStatus("authenticated")).toBe("authenticated");
    expect(toSubscriptionStatus("active")).toBe("active");
    expect(toSubscriptionStatus("pending")).toBe("pending");
    expect(toSubscriptionStatus("halted")).toBe("halted");
    expect(toSubscriptionStatus("cancelled")).toBe("cancelled");
    expect(toSubscriptionStatus("completed")).toBe("completed");
    expect(toSubscriptionStatus("expired")).toBe("expired");
    expect(toSubscriptionStatus("paused")).toBe("paused");
  });

  it("should default to 'created' for unknown statuses", () => {
    expect(toSubscriptionStatus("unknown")).toBe("created");
    expect(toSubscriptionStatus("")).toBe("created");
    expect(toSubscriptionStatus("ACTIVE")).toBe("created");
  });
});
