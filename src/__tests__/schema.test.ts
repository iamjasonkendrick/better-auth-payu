import { describe, expect, it } from "vitest";
import { getSchema, organization, subscriptions, user } from "../schema";
import type { PayUOptions } from "../types";

describe("Schema Definitions", () => {
  describe("subscriptions schema", () => {
    it("should have subscription model", () => {
      expect(subscriptions.subscription).toBeDefined();
    });

    it("should have required fields", () => {
      const fields = subscriptions.subscription.fields;
      expect(fields.plan.required).toBe(true);
      expect(fields.referenceId.required).toBe(true);
    });

    it("should have PayU-specific fields", () => {
      const fields = subscriptions.subscription.fields;
      expect(fields.payuCustomerId).toBeDefined();
      expect(fields.payuSubscriptionId).toBeDefined();
      expect(fields.payuMandateType).toBeDefined();
      expect(fields.payuTransactionId).toBeDefined();
      expect(fields.payuMihpayid).toBeDefined();
    });

    it("should have default values", () => {
      const fields = subscriptions.subscription.fields;
      expect(fields.status.defaultValue).toBe("created");
      expect(fields.quantity.defaultValue).toBe(1);
      expect(fields.paidCount.defaultValue).toBe(0);
      expect(fields.cancelAtCycleEnd.defaultValue).toBe(false);
    });

    it("should have date fields", () => {
      const fields = subscriptions.subscription.fields;
      expect(fields.currentStart.type).toBe("date");
      expect(fields.currentEnd.type).toBe("date");
      expect(fields.endedAt.type).toBe("date");
      expect(fields.cancelledAt.type).toBe("date");
      expect(fields.pausedAt.type).toBe("date");
      expect(fields.trialStart.type).toBe("date");
      expect(fields.trialEnd.type).toBe("date");
    });

    it("should have seats and metadata fields", () => {
      const fields = subscriptions.subscription.fields;
      expect(fields.seats).toBeDefined();
      expect(fields.metadata).toBeDefined();
    });
  });

  describe("user schema", () => {
    it("should have payuCustomerId field", () => {
      expect(user.user.fields.payuCustomerId).toBeDefined();
      expect(user.user.fields.payuCustomerId.type).toBe("string");
      expect(user.user.fields.payuCustomerId.required).toBe(false);
    });
  });

  describe("organization schema", () => {
    it("should have payuCustomerId field", () => {
      expect(organization.organization.fields.payuCustomerId).toBeDefined();
      expect(organization.organization.fields.payuCustomerId.type).toBe(
        "string",
      );
      expect(organization.organization.fields.payuCustomerId.required).toBe(
        false,
      );
      expect(organization.organization.fields.payuCustomerId.required).toBe(
        false,
      );
    });
  });
});

describe("getSchema", () => {
  it("should include user schema by default", () => {
    const options: PayUOptions = {
      merchantKey: "key",
      merchantSalt: "salt",
    };
    const schema = getSchema(options);
    expect(schema).toHaveProperty("user");
  });

  it("should include subscription schema when enabled", () => {
    const options: PayUOptions = {
      merchantKey: "key",
      merchantSalt: "salt",
      subscription: { enabled: true },
    };
    const schema = getSchema(options);
    expect(schema).toHaveProperty("subscription");
    expect(schema).toHaveProperty("user");
  });

  it("should not include subscription when disabled", () => {
    const options: PayUOptions = {
      merchantKey: "key",
      merchantSalt: "salt",
      subscription: { enabled: false },
    };
    const schema = getSchema(options);
    expect(schema).not.toHaveProperty("subscription");
  });

  it("should include organization schema when enabled", () => {
    const options: PayUOptions = {
      merchantKey: "key",
      merchantSalt: "salt",
      organization: { enabled: true },
    };
    const schema = getSchema(options);
    expect(schema).toHaveProperty("organization");
  });

  it("should not include organization when disabled", () => {
    const options: PayUOptions = {
      merchantKey: "key",
      merchantSalt: "salt",
      organization: { enabled: false },
    };
    const schema = getSchema(options);
    expect(schema).not.toHaveProperty("organization");
  });

  it("should combine subscription and organization when both enabled", () => {
    const options: PayUOptions = {
      merchantKey: "key",
      merchantSalt: "salt",
      subscription: { enabled: true },
      organization: { enabled: true },
    };
    const schema = getSchema(options);
    expect(schema).toHaveProperty("subscription");
    expect(schema).toHaveProperty("user");
    expect(schema).toHaveProperty("organization");
  });
});
