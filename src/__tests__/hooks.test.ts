import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  onMandateModified,
  onMandateRevoked,
  onPaymentFailure,
  onPaymentSuccess,
  onSubscriptionActivated,
  onSubscriptionCancelled,
  onSubscriptionCharged,
  onSubscriptionCompleted,
  onSubscriptionHalted,
  onSubscriptionPaused,
  onSubscriptionPending,
  onSubscriptionResumed,
} from "../hooks";
import type { PayUOptions, PayUWebhookEvent, Subscription } from "../types";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const mockSubscription: Subscription = {
  id: "sub_123",
  plan: "Monthly",
  referenceId: "user_123",
  payuCustomerId: "cust_123",
  payuSubscriptionId: "payu_sub_123",
  payuMandateType: "card",
  payuTransactionId: "txn_123",
  payuMihpayid: null,
  status: "active",
  currentPeriodStart: new Date(),
  currentPeriodEnd: null,
  cancelledAt: null,
  endedAt: null,
  pausedAt: null,
  totalCount: 12,
  paidCount: 3,
  remainingCount: 9,
  quantity: 1,
  seats: null,
  trialStart: null,
  trialEnd: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockEvent: PayUWebhookEvent = {
  mihpayid: "mih_123",
  status: "success",
  txnid: "txn_123",
  amount: "499",
  productinfo: "Monthly",
  firstname: "user_123",
  email: "test@test.com",
  phone: "9999999999",
  hash: "test_hash",
  key: "testKey",
  mode: "CC",
  unmappedstatus: "captured",
  field9: "",
  error: "",
  bank_ref_num: "ref123",
  addedon: "2024-01-15",
  payment_source: "payu",
};

const mockAdapter = {
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

const mockLogger = {
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

const mockCtx = {
  context: {
    adapter: mockAdapter,
    logger: mockLogger,
  },
};

const baseOptions: PayUOptions = {
  merchantKey: "testKey",
  merchantSalt: "testSalt",
  subscription: {
    enabled: true,
    plans: [
      {
        planId: "plan_monthly",
        name: "Monthly",
        amount: "499",
        billingCycle: "MONTHLY" as const,
        billingInterval: 1,
        totalCount: 12,
      },
    ],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── onPaymentSuccess ────────────────────────────────────────────────────────

describe("onPaymentSuccess", () => {
  it("should update subscription on payment success", async () => {
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onPaymentSuccess(mockCtx, baseOptions, mockEvent);

    expect(mockAdapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "subscription",
        update: expect.objectContaining({
          status: "active",
          payuMihpayid: "mih_123",
          paidCount: 4,
        }),
      }),
    );
  });

  it("should warn when subscription not found", async () => {
    mockAdapter.findOne.mockResolvedValue(null);

    await onPaymentSuccess(mockCtx, baseOptions, mockEvent);

    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("should call onPaymentSuccess callback", async () => {
    const callback = vi.fn();
    const opts = {
      ...baseOptions,
      subscription: {
        ...baseOptions.subscription!,
        onPaymentSuccess: callback,
      },
    };
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onPaymentSuccess(mockCtx, opts, mockEvent);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription: mockSubscription,
        event: mockEvent,
      }),
    );
  });

  it("should do nothing when subscription not enabled", async () => {
    const opts: PayUOptions = {
      merchantKey: "key",
      merchantSalt: "salt",
      subscription: { enabled: false },
    };

    await onPaymentSuccess(mockCtx, opts, mockEvent);

    expect(mockAdapter.findOne).not.toHaveBeenCalled();
  });

  it("should handle errors gracefully", async () => {
    mockAdapter.findOne.mockRejectedValue(new Error("DB error"));

    await onPaymentSuccess(mockCtx, baseOptions, mockEvent);

    expect(mockLogger.error).toHaveBeenCalled();
  });
});

// ─── onPaymentFailure ────────────────────────────────────────────────────────

describe("onPaymentFailure", () => {
  it("should update subscription to pending on failure", async () => {
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onPaymentFailure(mockCtx, baseOptions, {
      ...mockEvent,
      status: "failure",
    });

    expect(mockAdapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "pending" }),
      }),
    );
  });

  it("should call onPaymentFailure callback", async () => {
    const callback = vi.fn();
    const opts = {
      ...baseOptions,
      subscription: {
        ...baseOptions.subscription!,
        onPaymentFailure: callback,
      },
    };
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onPaymentFailure(mockCtx, opts, {
      ...mockEvent,
      error: "Card declined",
    });

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Card declined",
      }),
    );
  });
});

// ─── onSubscriptionActivated ─────────────────────────────────────────────────

describe("onSubscriptionActivated", () => {
  it("should update subscription to active", async () => {
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onSubscriptionActivated(mockCtx, baseOptions, mockEvent);

    expect(mockAdapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "active",
          payuMihpayid: "mih_123",
        }),
      }),
    );
  });

  it("should call onSubscriptionActivated callback", async () => {
    const callback = vi.fn();
    const opts = {
      ...baseOptions,
      subscription: {
        ...baseOptions.subscription!,
        onSubscriptionActivated: callback,
      },
    };
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onSubscriptionActivated(mockCtx, opts, mockEvent);

    expect(callback).toHaveBeenCalled();
  });
});

// ─── onSubscriptionCharged ───────────────────────────────────────────────────

describe("onSubscriptionCharged", () => {
  it("should increment paidCount and decrement remainingCount", async () => {
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onSubscriptionCharged(mockCtx, baseOptions, mockEvent);

    expect(mockAdapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          paidCount: 4,
          remainingCount: 8,
        }),
      }),
    );
  });
});

// ─── onSubscriptionPending ───────────────────────────────────────────────────

describe("onSubscriptionPending", () => {
  it("should update status to pending", async () => {
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onSubscriptionPending(mockCtx, baseOptions, mockEvent);

    expect(mockAdapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "pending" }),
      }),
    );
  });
});

// ─── onSubscriptionHalted ────────────────────────────────────────────────────

describe("onSubscriptionHalted", () => {
  it("should update status to halted", async () => {
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onSubscriptionHalted(mockCtx, baseOptions, mockEvent);

    expect(mockAdapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "halted" }),
      }),
    );
  });
});

// ─── onSubscriptionCompleted ─────────────────────────────────────────────────

describe("onSubscriptionCompleted", () => {
  it("should update status to completed with endedAt", async () => {
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onSubscriptionCompleted(mockCtx, baseOptions, mockEvent);

    expect(mockAdapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "completed",
          remainingCount: 0,
        }),
      }),
    );
  });
});

// ─── onSubscriptionCancelled ─────────────────────────────────────────────────

describe("onSubscriptionCancelled", () => {
  it("should update status to cancelled with cancelledAt", async () => {
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onSubscriptionCancelled(mockCtx, baseOptions, mockEvent);

    expect(mockAdapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "cancelled" }),
      }),
    );
  });

  it("should warn when subscription not found", async () => {
    mockAdapter.findOne.mockResolvedValue(null);

    await onSubscriptionCancelled(mockCtx, baseOptions, mockEvent);

    expect(mockLogger.warn).toHaveBeenCalled();
  });
});

// ─── onSubscriptionPaused ────────────────────────────────────────────────────

describe("onSubscriptionPaused", () => {
  it("should update status to paused with pausedAt", async () => {
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onSubscriptionPaused(mockCtx, baseOptions, mockEvent);

    expect(mockAdapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "paused" }),
      }),
    );
  });
});

// ─── onSubscriptionResumed ───────────────────────────────────────────────────

describe("onSubscriptionResumed", () => {
  it("should update status to active and clear pausedAt", async () => {
    mockAdapter.findOne.mockResolvedValue({
      ...mockSubscription,
      status: "paused",
    });
    mockAdapter.update.mockResolvedValue({});

    await onSubscriptionResumed(mockCtx, baseOptions, mockEvent);

    expect(mockAdapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "active",
          pausedAt: null,
        }),
      }),
    );
  });
});

// ─── onMandateRevoked ────────────────────────────────────────────────────────

describe("onMandateRevoked", () => {
  it("should cancel subscription when mandate is revoked", async () => {
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onMandateRevoked(mockCtx, baseOptions, mockEvent);

    expect(mockAdapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "cancelled" }),
      }),
    );
  });

  it("should call onMandateRevoked callback", async () => {
    const callback = vi.fn();
    const opts = {
      ...baseOptions,
      subscription: {
        ...baseOptions.subscription!,
        onMandateRevoked: callback,
      },
    };
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onMandateRevoked(mockCtx, opts, mockEvent);

    expect(callback).toHaveBeenCalled();
  });
});

// ─── onMandateModified ───────────────────────────────────────────────────────

describe("onMandateModified", () => {
  it("should update subscription when mandate is modified", async () => {
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onMandateModified(mockCtx, baseOptions, mockEvent);

    expect(mockAdapter.update).toHaveBeenCalled();
  });

  it("should call onMandateModified callback", async () => {
    const callback = vi.fn();
    const opts = {
      ...baseOptions,
      subscription: {
        ...baseOptions.subscription!,
        onMandateModified: callback,
      },
    };
    mockAdapter.findOne.mockResolvedValue(mockSubscription);
    mockAdapter.update.mockResolvedValue({});

    await onMandateModified(mockCtx, opts, mockEvent);

    expect(callback).toHaveBeenCalled();
  });
});
