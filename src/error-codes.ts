import { defineErrorCodes } from "better-auth";

export const PAYU_ERROR_CODES = defineErrorCodes({
  // ─── Auth & Request ────────────────────────────────────────────────
  UNAUTHORIZED: "Unauthorized access",
  INVALID_REQUEST_BODY: "Invalid request body",

  // ─── Subscription ─────────────────────────────────────────────────
  SUBSCRIPTION_NOT_FOUND: "Subscription not found",
  SUBSCRIPTION_PLAN_NOT_FOUND: "Subscription plan not found",
  ALREADY_SUBSCRIBED_PLAN: "You're already subscribed to this plan",
  REFERENCE_ID_NOT_ALLOWED: "Reference id is not allowed",
  SUBSCRIPTION_NOT_ACTIVE: "Subscription is not active",
  SUBSCRIPTION_ALREADY_CANCELLED: "Subscription is already cancelled",
  SUBSCRIPTION_ALREADY_PAUSED: "Subscription is already paused",
  SUBSCRIPTION_NOT_PAUSED: "Subscription is not paused to resume",
  SUBSCRIPTION_IN_TERMINAL_STATE: "Subscription is in a terminal state",

  // ─── Customer ─────────────────────────────────────────────────────
  CUSTOMER_NOT_FOUND: "PayU customer not found for this user",
  UNABLE_TO_CREATE_CUSTOMER: "Unable to create PayU customer",

  // ─── Webhook ──────────────────────────────────────────────────────
  WEBHOOK_HASH_NOT_FOUND: "PayU webhook hash not found",
  WEBHOOK_SECRET_NOT_FOUND: "PayU webhook secret not found",
  WEBHOOK_ERROR: "PayU webhook error",
  FAILED_TO_VERIFY_WEBHOOK: "Failed to verify PayU webhook hash",

  // ─── Hash & Signature ─────────────────────────────────────────────
  HASH_GENERATION_FAILED: "Failed to generate PayU hash",
  HASH_VERIFICATION_FAILED: "PayU hash verification failed",

  // ─── Mandate ──────────────────────────────────────────────────────
  MANDATE_NOT_FOUND: "Mandate not found",
  MANDATE_REVOKE_FAILED: "Failed to revoke mandate",
  MANDATE_MODIFY_FAILED: "Failed to modify mandate",
  MANDATE_STATUS_CHECK_FAILED: "Failed to check mandate status",

  // ─── Payment ──────────────────────────────────────────────────────
  PAYMENT_INITIATION_FAILED: "Failed to initiate payment",
  PAYMENT_VERIFICATION_FAILED: "Failed to verify payment",
  PAYMENT_NOT_FOUND: "Payment not found",

  // ─── Refund ───────────────────────────────────────────────────────
  REFUND_INITIATION_FAILED: "Failed to initiate refund",
  REFUND_STATUS_CHECK_FAILED: "Failed to check refund status",

  // ─── Transaction ──────────────────────────────────────────────────
  TRANSACTION_NOT_FOUND: "Transaction not found",
  TRANSACTION_DETAILS_FAILED: "Failed to get transaction details",

  // ─── Pre-Debit ────────────────────────────────────────────────────
  PRE_DEBIT_NOTIFICATION_FAILED: "Failed to send pre-debit notification",

  // ─── Organization ─────────────────────────────────────────────────
  ORGANIZATION_ON_ACTIVE_SUBSCRIPTION:
    "Organization has an active subscription and cannot be deleted",
  ORGANIZATION_NOT_FOUND: "Organization not found",

  // ─── SI / Standing Instruction ────────────────────────────────────
  SI_UPDATE_FAILED: "Failed to update standing instruction",
  INVALID_SI_PARAMS: "Invalid standing instruction parameters",

  // ─── VPA ──────────────────────────────────────────────────────────
  VPA_VALIDATION_FAILED: "Failed to validate VPA",
  INVALID_VPA: "Invalid VPA address",
} as const);
