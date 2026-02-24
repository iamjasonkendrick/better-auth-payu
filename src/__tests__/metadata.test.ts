import { describe, expect, it } from "vitest";
import {
  customerUdf,
  paramsToUdf,
  subscriptionUdf,
  udfToParams,
} from "../metadata";

// ─── customerUdf ─────────────────────────────────────────────────────────────

describe("customerUdf", () => {
  describe("keys", () => {
    it("should have the correct internal keys", () => {
      expect(customerUdf.keys).toEqual([
        "customerType",
        "userId",
        "organizationId",
      ]);
    });
  });

  describe("set", () => {
    it("should set user customer UDFs", () => {
      const udf = customerUdf.set({ customerType: "user", userId: "user_123" });
      expect(udf.udf1).toBe("user");
      expect(udf.udf2).toBe("user_123");
      expect(udf.udf3).toBeUndefined();
    });

    it("should set organization customer UDFs", () => {
      const udf = customerUdf.set({
        customerType: "organization",
        organizationId: "org_456",
      });
      expect(udf.udf1).toBe("organization");
      expect(udf.udf2).toBeUndefined();
      expect(udf.udf3).toBe("org_456");
    });

    it("should merge with user-provided UDFs (internal wins)", () => {
      const udf = customerUdf.set(
        { customerType: "user", userId: "user_123" },
        { udf1: "should_be_overridden", udf6: "custom_value" },
      );
      expect(udf.udf1).toBe("user");
      expect(udf.udf6).toBe("custom_value");
    });

    it("should handle undefined user UDF", () => {
      const udf = customerUdf.set(
        { customerType: "user", userId: "user_123" },
        undefined,
      );
      expect(udf.udf1).toBe("user");
      expect(udf.udf2).toBe("user_123");
    });
  });

  describe("get", () => {
    it("should extract user fields from UDFs", () => {
      const result = customerUdf.get({ udf1: "user", udf2: "user_123" });
      expect(result.customerType).toBe("user");
      expect(result.userId).toBe("user_123");
      expect(result.organizationId).toBeUndefined();
    });

    it("should extract organization fields from UDFs", () => {
      const result = customerUdf.get({
        udf1: "organization",
        udf3: "org_456",
      });
      expect(result.customerType).toBe("organization");
      expect(result.organizationId).toBe("org_456");
    });

    it("should handle null input", () => {
      const result = customerUdf.get(null);
      expect(result.customerType).toBeUndefined();
      expect(result.userId).toBeUndefined();
      expect(result.organizationId).toBeUndefined();
    });

    it("should handle undefined input", () => {
      const result = customerUdf.get(undefined);
      expect(result.customerType).toBeUndefined();
    });
  });
});

// ─── subscriptionUdf ─────────────────────────────────────────────────────────

describe("subscriptionUdf", () => {
  describe("keys", () => {
    it("should have the correct internal keys", () => {
      expect(subscriptionUdf.keys).toEqual([
        "userId",
        "subscriptionId",
        "referenceId",
      ]);
    });
  });

  describe("set", () => {
    it("should set subscription UDFs", () => {
      const udf = subscriptionUdf.set({
        userId: "user_123",
        subscriptionId: "sub_456",
        referenceId: "ref_789",
      });
      expect(udf.udf2).toBe("user_123");
      expect(udf.udf4).toBe("sub_456");
      expect(udf.udf5).toBe("ref_789");
    });

    it("should merge with user-provided UDFs", () => {
      const udf = subscriptionUdf.set(
        {
          userId: "user_123",
          subscriptionId: "sub_456",
          referenceId: "ref_789",
        },
        { udf6: "custom_data" },
      );
      expect(udf.udf2).toBe("user_123");
      expect(udf.udf6).toBe("custom_data");
    });
  });

  describe("get", () => {
    it("should extract subscription fields from UDFs", () => {
      const result = subscriptionUdf.get({
        udf2: "user_123",
        udf4: "sub_456",
        udf5: "ref_789",
      });
      expect(result.userId).toBe("user_123");
      expect(result.subscriptionId).toBe("sub_456");
      expect(result.referenceId).toBe("ref_789");
    });

    it("should handle null input", () => {
      const result = subscriptionUdf.get(null);
      expect(result.userId).toBeUndefined();
      expect(result.subscriptionId).toBeUndefined();
      expect(result.referenceId).toBeUndefined();
    });
  });
});

// ─── udfToParams ─────────────────────────────────────────────────────────────

describe("udfToParams", () => {
  it("should convert UDF object to params", () => {
    const params = udfToParams({ udf1: "value1", udf5: "value5" });
    expect(params).toEqual({ udf1: "value1", udf5: "value5" });
  });

  it("should skip undefined values", () => {
    const params = udfToParams({ udf1: "value1", udf2: undefined });
    expect(params).toEqual({ udf1: "value1" });
  });

  it("should return empty object for empty input", () => {
    const params = udfToParams({});
    expect(params).toEqual({});
  });
});

// ─── paramsToUdf ─────────────────────────────────────────────────────────────

describe("paramsToUdf", () => {
  it("should extract UDF fields from params", () => {
    const udf = paramsToUdf({
      udf1: "value1",
      udf5: "value5",
      other: "ignored",
    });
    expect(udf.udf1).toBe("value1");
    expect(udf.udf5).toBe("value5");
    expect((udf as Record<string, unknown>).other).toBeUndefined();
  });

  it("should skip undefined UDF values", () => {
    const udf = paramsToUdf({ udf1: "value1", udf2: undefined });
    expect(udf.udf1).toBe("value1");
    expect(udf.udf2).toBeUndefined();
  });

  it("should return empty object when no UDFs present", () => {
    const udf = paramsToUdf({ key: "value", amount: "100" });
    expect(Object.keys(udf)).toHaveLength(0);
  });
});
