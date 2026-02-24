import { describe, expect, it } from "vitest";
import { PAYU_ERROR_CODES } from "../error-codes";

describe("PAYU_ERROR_CODES", () => {
  it("should be defined", () => {
    expect(PAYU_ERROR_CODES).toBeDefined();
  });

  it("should contain all expected error codes", () => {
    const expectedCodes = [
      "UNAUTHORIZED",
      "INVALID_REQUEST_BODY",
      "SUBSCRIPTION_NOT_FOUND",
      "SUBSCRIPTION_PLAN_NOT_FOUND",
      "ALREADY_SUBSCRIBED_PLAN",
      "REFERENCE_ID_NOT_ALLOWED",
      "SUBSCRIPTION_NOT_ACTIVE",
      "SUBSCRIPTION_ALREADY_CANCELLED",
      "SUBSCRIPTION_ALREADY_PAUSED",
      "SUBSCRIPTION_NOT_PAUSED",
      "SUBSCRIPTION_IN_TERMINAL_STATE",
      "CUSTOMER_NOT_FOUND",
      "UNABLE_TO_CREATE_CUSTOMER",
      "WEBHOOK_HASH_NOT_FOUND",
      "WEBHOOK_SECRET_NOT_FOUND",
      "WEBHOOK_ERROR",
      "FAILED_TO_VERIFY_WEBHOOK",
      "HASH_GENERATION_FAILED",
      "HASH_VERIFICATION_FAILED",
      "MANDATE_NOT_FOUND",
      "MANDATE_REVOKE_FAILED",
      "MANDATE_MODIFY_FAILED",
      "MANDATE_STATUS_CHECK_FAILED",
      "PAYMENT_INITIATION_FAILED",
      "PAYMENT_VERIFICATION_FAILED",
      "PAYMENT_NOT_FOUND",
      "REFUND_INITIATION_FAILED",
      "REFUND_STATUS_CHECK_FAILED",
      "TRANSACTION_NOT_FOUND",
      "TRANSACTION_DETAILS_FAILED",
      "PRE_DEBIT_NOTIFICATION_FAILED",
      "ORGANIZATION_ON_ACTIVE_SUBSCRIPTION",
      "ORGANIZATION_NOT_FOUND",
      "SI_UPDATE_FAILED",
      "INVALID_SI_PARAMS",
      "VPA_VALIDATION_FAILED",
      "INVALID_VPA",
    ];

    for (const code of expectedCodes) {
      expect(PAYU_ERROR_CODES).toHaveProperty(code);
    }
  });

  it("should have 37 error codes", () => {
    expect(Object.keys(PAYU_ERROR_CODES).length).toBe(37);
  });

  it("should have non-empty string values for all codes", () => {
    for (const [key, value] of Object.entries(PAYU_ERROR_CODES)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it("should follow naming conventions (SCREAMING_SNAKE_CASE keys)", () => {
    for (const key of Object.keys(PAYU_ERROR_CODES)) {
      expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });
});
