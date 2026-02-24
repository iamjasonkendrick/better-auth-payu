import { createAuthEndpoint } from "@better-auth/core/api";
import { z } from "zod";
import { PAYU_ERROR_CODES } from "./error-codes";
import {
  onMandateModified,
  onMandateRevoked,
  onPaymentFailure,
  onPaymentSuccess,
  onSubscriptionActivated,
  onSubscriptionCancelled,
  onSubscriptionCompleted,
  onSubscriptionHalted,
  onSubscriptionPaused,
  onSubscriptionPending,
  onSubscriptionResumed,
} from "./hooks";
import { subscriptionUdf } from "./metadata";
import { payuSessionMiddleware, referenceMiddleware } from "./middleware";
import type { PayUOptions, PayUWebhookEvent, Subscription } from "./types";
import {
  createAPIError,
  generateCommandHash,
  generatePayUHash,
  getPlanByName,
  getPlanByPlanId,
  getPlans,
  isActive,
  isCancelled,
  isPaused,
  isTerminal,
  verifyPayUHash,
} from "./utils";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createSubscriptionBodySchema = z.object({
  plan: z.string(),
  referenceId: z.string().optional(),
  customerType: z.enum(["user", "organization"]).optional(),
  mandateType: z.enum(["card", "upi", "netbanking"]).optional(),
});

const cancelSubscriptionBodySchema = z.object({
  referenceId: z.string().optional(),
  customerType: z.enum(["user", "organization"]).optional(),
  cancelAtCycleEnd: z.boolean().optional(),
});

const pauseSubscriptionBodySchema = z.object({
  referenceId: z.string().optional(),
  customerType: z.enum(["user", "organization"]).optional(),
});

const resumeSubscriptionBodySchema = z.object({
  referenceId: z.string().optional(),
  customerType: z.enum(["user", "organization"]).optional(),
});

const listSubscriptionsQuerySchema = z.object({
  referenceId: z.string().optional(),
  customerType: z.enum(["user", "organization"]).optional(),
});

const updateSubscriptionBodySchema = z.object({
  referenceId: z.string().optional(),
  customerType: z.enum(["user", "organization"]).optional(),
  plan: z.string().optional(),
  quantity: z.number().optional(),
});

const chargeSubscriptionBodySchema = z.object({
  subscriptionId: z.string(),
  amount: z.string(),
  txnid: z.string(),
});

const preDebitNotifyBodySchema = z.object({
  subscriptionId: z.string(),
  amount: z.string(),
  txnid: z.string(),
  debitDate: z.string(),
});

const fetchSubscriptionQuerySchema = z.object({
  subscriptionId: z.string(),
});

const mandateStatusQuerySchema = z.object({
  subscriptionId: z.string(),
  mandateType: z.enum(["card", "upi", "netbanking"]).optional(),
});

const mandateModifyBodySchema = z.object({
  subscriptionId: z.string(),
  amount: z.string(),
  mandateType: z.enum(["card", "upi", "netbanking"]).optional(),
});

const initiatePaymentBodySchema = z.object({
  txnid: z.string(),
  amount: z.string(),
  productinfo: z.string(),
  firstname: z.string(),
  email: z.string(),
  phone: z.string(),
  referenceId: z.string().optional(),
});

const verifyPaymentBodySchema = z.object({
  txnid: z.string(),
});

const initiateRefundBodySchema = z.object({
  mihpayid: z.string(),
  amount: z.string(),
  tokenId: z.string(),
});

const refundStatusQuerySchema = z.object({
  requestId: z.string().optional(),
  mihpayid: z.string().optional(),
});

const transactionInfoQuerySchema = z.object({
  txnid: z.string(),
});

const transactionDetailsQuerySchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
});

const validateVpaBodySchema = z.object({
  vpa: z.string(),
});

const updateSIBodySchema = z.object({
  subscriptionId: z.string(),
  billingAmount: z.string().optional(),
  billingCycle: z.string().optional(),
  billingInterval: z.number().optional(),
  paymentEndDate: z.string().optional(),
});

const fetchPlanQuerySchema = z.object({
  planId: z.string(),
});

const payAndSubscribeBodySchema = z.object({
  plan: z.string(),
  referenceId: z.string().optional(),
  customerType: z.enum(["user", "organization"]).optional(),
  mandateType: z.enum(["card", "upi", "netbanking"]).optional(),
  initialAmount: z.string().optional(),
});

// ─── Route Factory ───────────────────────────────────────────────────────────

export function createRoutes(options: PayUOptions) {
  const getReference = referenceMiddleware(options);

  return {
    // ─── Subscription: Create ──────────────────────────────────────────
    createSubscription: createAuthEndpoint(
      "/payu/subscription/create",
      {
        method: "POST",
        body: createSubscriptionBodySchema,
      },
      async (ctx) => {
        const user = payuSessionMiddleware(ctx);
        const ref = await getReference(ctx);
        const body = ctx.body;

        if (!options.subscription?.enabled) {
          throw createAPIError(
            "BAD_REQUEST",
            PAYU_ERROR_CODES.INVALID_REQUEST_BODY,
          );
        }

        const plan = await getPlanByName(options, body.plan);
        if (!plan) {
          throw createAPIError(
            "NOT_FOUND",
            PAYU_ERROR_CODES.SUBSCRIPTION_PLAN_NOT_FOUND,
          );
        }

        // Check for existing active subscription
        const existing = (await ctx.context.adapter.findOne({
          model: "subscription",
          where: [
            { field: "referenceId", value: ref.referenceId },
            {
              field: "status",
              operator: "in",
              value: ["active", "authenticated"],
            },
          ],
        })) as Subscription | null;

        if (existing && existing.plan === body.plan) {
          throw createAPIError(
            "CONFLICT",
            PAYU_ERROR_CODES.ALREADY_SUBSCRIBED_PLAN,
          );
        }

        // Create subscription record
        const subscription = await ctx.context.adapter.create({
          model: "subscription",
          data: {
            plan: plan.name,
            referenceId: ref.referenceId,
            payuCustomerId: null,
            payuSubscriptionId: `payu_sub_${Date.now()}`,
            payuMandateType: body.mandateType || "card",
            payuTransactionId: null,
            payuMihpayid: null,
            status: "created",
            currentStart: null,
            currentEnd: null,
            endedAt: null,
            quantity: 1,
            totalCount: plan.totalCount,
            paidCount: 0,
            remainingCount: plan.totalCount,
            cancelledAt: null,
            pausedAt: null,
            cancelAtCycleEnd: false,
            billingPeriod: plan.billingCycle,
            seats: null,
            trialStart: null,
            trialEnd: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Generate hash for PayU payment form
        const txnid = `txn_${Date.now()}_${(subscription as Record<string, unknown>).id}`;
        const hash = generatePayUHash(
          {
            key: options.merchantKey,
            txnid,
            amount: plan.amount,
            productinfo: plan.name,
            firstname: user.id,
            email: "",
            ...subscriptionUdf.set({
              userId: user.id,
              subscriptionId: (subscription as Record<string, unknown>)
                .id as string,
              referenceId: ref.referenceId,
            }),
          },
          options.merchantSalt,
        );

        return ctx.json({
          subscription,
          paymentParams: {
            key: options.merchantKey,
            txnid,
            amount: plan.amount,
            productinfo: plan.name,
            hash,
            mandateType: body.mandateType || "card",
          },
        });
      },
    ),

    // ─── Subscription: Pay and Subscribe ────────────────────────────────
    payAndSubscribe: createAuthEndpoint(
      "/payu/subscription/pay-and-subscribe",
      {
        method: "POST",
        body: payAndSubscribeBodySchema,
      },
      async (ctx) => {
        const user = payuSessionMiddleware(ctx);
        const ref = await getReference(ctx);
        const body = ctx.body;

        if (!options.subscription?.enabled) {
          throw createAPIError(
            "BAD_REQUEST",
            PAYU_ERROR_CODES.INVALID_REQUEST_BODY,
          );
        }

        const plan = await getPlanByName(options, body.plan);
        if (!plan) {
          throw createAPIError(
            "NOT_FOUND",
            PAYU_ERROR_CODES.SUBSCRIPTION_PLAN_NOT_FOUND,
          );
        }

        const subscription = await ctx.context.adapter.create({
          model: "subscription",
          data: {
            plan: plan.name,
            referenceId: ref.referenceId,
            payuSubscriptionId: `payu_sub_${Date.now()}`,
            payuMandateType: body.mandateType || "card",
            status: "created",
            quantity: 1,
            totalCount: plan.totalCount,
            paidCount: 0,
            remainingCount: plan.totalCount,
            billingPeriod: plan.billingCycle,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const txnid = `txn_${Date.now()}_${(subscription as Record<string, unknown>).id}`;
        const initialAmount = body.initialAmount || plan.amount;
        const hash = generatePayUHash(
          {
            key: options.merchantKey,
            txnid,
            amount: initialAmount,
            productinfo: plan.name,
            firstname: user.id,
            email: "",
          },
          options.merchantSalt,
        );

        return ctx.json({
          subscription,
          paymentParams: {
            key: options.merchantKey,
            txnid,
            amount: initialAmount,
            productinfo: plan.name,
            hash,
            mandateType: body.mandateType || "card",
          },
        });
      },
    ),

    // ─── Subscription: Cancel ──────────────────────────────────────────
    cancelSubscription: createAuthEndpoint(
      "/payu/subscription/cancel",
      {
        method: "POST",
        body: cancelSubscriptionBodySchema,
      },
      async (ctx) => {
        const ref = await getReference(ctx);

        const subscription = (await ctx.context.adapter.findOne({
          model: "subscription",
          where: [
            { field: "referenceId", value: ref.referenceId },
            {
              field: "status",
              operator: "in",
              value: ["active", "authenticated"],
            },
          ],
        })) as Subscription | null;

        if (!subscription) {
          throw createAPIError(
            "NOT_FOUND",
            PAYU_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
          );
        }

        if (isCancelled(subscription)) {
          throw createAPIError(
            "BAD_REQUEST",
            PAYU_ERROR_CODES.SUBSCRIPTION_ALREADY_CANCELLED,
          );
        }

        if (isTerminal(subscription)) {
          throw createAPIError(
            "BAD_REQUEST",
            PAYU_ERROR_CODES.SUBSCRIPTION_IN_TERMINAL_STATE,
          );
        }

        // For cancel at cycle end, just mark it
        if (ctx.body.cancelAtCycleEnd) {
          await ctx.context.adapter.update({
            model: "subscription",
            where: [{ field: "id", value: subscription.id }],
            update: {
              cancelAtCycleEnd: true,
              updatedAt: new Date(),
            },
          });
          return ctx.json({ success: true, cancelAtCycleEnd: true });
        }

        // Call PayU mandate revoke API based on mandate type
        const apiUrl = options.apiBaseUrl || "https://info.payu.in";
        const command =
          subscription.payuMandateType === "upi"
            ? "upi_mandate_revoke"
            : "mandate_revoke";

        const hash = generateCommandHash(
          options.merchantKey,
          command,
          subscription.payuTransactionId || "",
          options.merchantSalt,
        );

        const response = await fetch(`${apiUrl}/merchant/${command}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            key: options.merchantKey,
            command,
            var1: subscription.payuTransactionId || "",
            hash,
          }),
        });

        const result = await response.json();

        if (result.status === 0 || result.error) {
          throw createAPIError(
            "INTERNAL_SERVER_ERROR",
            PAYU_ERROR_CODES.MANDATE_REVOKE_FAILED,
          );
        }

        await ctx.context.adapter.update({
          model: "subscription",
          where: [{ field: "id", value: subscription.id }],
          update: {
            status: "cancelled",
            cancelledAt: new Date(),
            endedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        return ctx.json({ success: true });
      },
    ),

    // ─── Subscription: Pause ────────────────────────────────────────────
    pauseSubscription: createAuthEndpoint(
      "/payu/subscription/pause",
      {
        method: "POST",
        body: pauseSubscriptionBodySchema,
      },
      async (ctx) => {
        const ref = await getReference(ctx);

        const subscription = (await ctx.context.adapter.findOne({
          model: "subscription",
          where: [
            { field: "referenceId", value: ref.referenceId },
            { field: "status", value: "active" },
          ],
        })) as Subscription | null;

        if (!subscription) {
          throw createAPIError(
            "NOT_FOUND",
            PAYU_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
          );
        }

        if (!isActive(subscription)) {
          throw createAPIError(
            "BAD_REQUEST",
            PAYU_ERROR_CODES.SUBSCRIPTION_NOT_ACTIVE,
          );
        }

        if (isPaused(subscription)) {
          throw createAPIError(
            "BAD_REQUEST",
            PAYU_ERROR_CODES.SUBSCRIPTION_ALREADY_PAUSED,
          );
        }

        await ctx.context.adapter.update({
          model: "subscription",
          where: [{ field: "id", value: subscription.id }],
          update: {
            status: "paused",
            pausedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        return ctx.json({ success: true });
      },
    ),

    // ─── Subscription: Resume ───────────────────────────────────────────
    resumeSubscription: createAuthEndpoint(
      "/payu/subscription/resume",
      {
        method: "POST",
        body: resumeSubscriptionBodySchema,
      },
      async (ctx) => {
        const ref = await getReference(ctx);

        const subscription = (await ctx.context.adapter.findOne({
          model: "subscription",
          where: [
            { field: "referenceId", value: ref.referenceId },
            { field: "status", value: "paused" },
          ],
        })) as Subscription | null;

        if (!subscription) {
          throw createAPIError(
            "NOT_FOUND",
            PAYU_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
          );
        }

        if (!isPaused(subscription)) {
          throw createAPIError(
            "BAD_REQUEST",
            PAYU_ERROR_CODES.SUBSCRIPTION_NOT_PAUSED,
          );
        }

        await ctx.context.adapter.update({
          model: "subscription",
          where: [{ field: "id", value: subscription.id }],
          update: {
            status: "active",
            pausedAt: null,
            updatedAt: new Date(),
          },
        });

        return ctx.json({ success: true });
      },
    ),

    // ─── Subscription: List ─────────────────────────────────────────────
    listSubscriptions: createAuthEndpoint(
      "/payu/subscription/list",
      {
        method: "GET",
        query: listSubscriptionsQuerySchema,
      },
      async (ctx) => {
        const ref = await getReference(ctx);

        const subscriptions = await ctx.context.adapter.findOne({
          model: "subscription",
          where: [{ field: "referenceId", value: ref.referenceId }],
        });

        return ctx.json({
          subscriptions: subscriptions ? [subscriptions] : [],
        });
      },
    ),

    // ─── Subscription: Get ──────────────────────────────────────────────
    getSubscription: createAuthEndpoint(
      "/payu/subscription/get",
      {
        method: "GET",
        query: fetchSubscriptionQuerySchema,
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const { subscriptionId } = ctx.query;

        const subscription = await ctx.context.adapter.findOne({
          model: "subscription",
          where: [{ field: "id", value: subscriptionId }],
        });

        if (!subscription) {
          throw createAPIError(
            "NOT_FOUND",
            PAYU_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
          );
        }

        return ctx.json({ subscription });
      },
    ),

    // ─── Subscription: Update ───────────────────────────────────────────
    updateSubscription: createAuthEndpoint(
      "/payu/subscription/update",
      {
        method: "POST",
        body: updateSubscriptionBodySchema,
      },
      async (ctx) => {
        const ref = await getReference(ctx);
        const body = ctx.body;

        const subscription = (await ctx.context.adapter.findOne({
          model: "subscription",
          where: [
            { field: "referenceId", value: ref.referenceId },
            {
              field: "status",
              operator: "in",
              value: ["active", "authenticated"],
            },
          ],
        })) as Subscription | null;

        if (!subscription) {
          throw createAPIError(
            "NOT_FOUND",
            PAYU_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
          );
        }

        const updateData: Record<string, unknown> = { updatedAt: new Date() };

        if (body.plan) {
          const plan = await getPlanByName(options, body.plan);
          if (!plan) {
            throw createAPIError(
              "NOT_FOUND",
              PAYU_ERROR_CODES.SUBSCRIPTION_PLAN_NOT_FOUND,
            );
          }
          updateData.plan = plan.name;
          updateData.billingPeriod = plan.billingCycle;
          updateData.totalCount = plan.totalCount;
        }

        if (body.quantity !== undefined) {
          updateData.quantity = body.quantity;
        }

        await ctx.context.adapter.update({
          model: "subscription",
          where: [{ field: "id", value: subscription.id }],
          update: updateData,
        });

        return ctx.json({ success: true });
      },
    ),

    // ─── Pre-Debit Notification ─────────────────────────────────────────
    preDebitNotify: createAuthEndpoint(
      "/payu/subscription/pre-debit-notify",
      {
        method: "POST",
        body: preDebitNotifyBodySchema,
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const body = ctx.body;

        const subscription = (await ctx.context.adapter.findOne({
          model: "subscription",
          where: [{ field: "id", value: body.subscriptionId }],
        })) as Subscription | null;

        if (!subscription) {
          throw createAPIError(
            "NOT_FOUND",
            PAYU_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
          );
        }

        const apiUrl = options.apiBaseUrl || "https://info.payu.in";
        const hash = generateCommandHash(
          options.merchantKey,
          "pre_debit_SI",
          body.txnid,
          options.merchantSalt,
        );

        const response = await fetch(`${apiUrl}/merchant/pre_debit_SI`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            key: options.merchantKey,
            command: "pre_debit_SI",
            var1: body.txnid,
            var2: body.amount,
            var3: body.debitDate,
            hash,
          }),
        });

        const result = await response.json();

        if (result.status === 0 || result.error) {
          throw createAPIError(
            "INTERNAL_SERVER_ERROR",
            PAYU_ERROR_CODES.PRE_DEBIT_NOTIFICATION_FAILED,
          );
        }

        return ctx.json({ success: true, result });
      },
    ),

    // ─── Subscription: Charge (Recurring Payment) ───────────────────────
    chargeSubscription: createAuthEndpoint(
      "/payu/subscription/charge",
      {
        method: "POST",
        body: chargeSubscriptionBodySchema,
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const body = ctx.body;

        const subscription = (await ctx.context.adapter.findOne({
          model: "subscription",
          where: [{ field: "id", value: body.subscriptionId }],
        })) as Subscription | null;

        if (!subscription) {
          throw createAPIError(
            "NOT_FOUND",
            PAYU_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
          );
        }

        if (!isActive(subscription)) {
          throw createAPIError(
            "BAD_REQUEST",
            PAYU_ERROR_CODES.SUBSCRIPTION_NOT_ACTIVE,
          );
        }

        const apiUrl = options.apiBaseUrl || "https://info.payu.in";
        const hash = generateCommandHash(
          options.merchantKey,
          "si_transaction",
          body.txnid,
          options.merchantSalt,
        );

        const response = await fetch(`${apiUrl}/merchant/si_transaction`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            key: options.merchantKey,
            command: "si_transaction",
            var1: body.txnid,
            var2: body.amount,
            hash,
          }),
        });

        const result = await response.json();

        if (result.status === 0 || result.error) {
          throw createAPIError(
            "INTERNAL_SERVER_ERROR",
            PAYU_ERROR_CODES.PAYMENT_INITIATION_FAILED,
          );
        }

        return ctx.json({ success: true, result });
      },
    ),

    // ─── Update Standing Instruction ────────────────────────────────────
    updateSI: createAuthEndpoint(
      "/payu/subscription/update-si",
      {
        method: "POST",
        body: updateSIBodySchema,
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const body = ctx.body;

        const subscription = (await ctx.context.adapter.findOne({
          model: "subscription",
          where: [{ field: "id", value: body.subscriptionId }],
        })) as Subscription | null;

        if (!subscription) {
          throw createAPIError(
            "NOT_FOUND",
            PAYU_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
          );
        }

        const apiUrl = options.apiBaseUrl || "https://info.payu.in";
        const hash = generateCommandHash(
          options.merchantKey,
          "update_si",
          subscription.payuTransactionId || "",
          options.merchantSalt,
        );

        const params: Record<string, string> = {
          key: options.merchantKey,
          command: "update_si",
          var1: subscription.payuTransactionId || "",
          hash,
        };

        if (body.billingAmount) params.var2 = body.billingAmount;
        if (body.billingCycle) params.var3 = body.billingCycle;
        if (body.billingInterval !== undefined)
          params.var4 = String(body.billingInterval);
        if (body.paymentEndDate) params.var5 = body.paymentEndDate;

        const response = await fetch(`${apiUrl}/merchant/update_si`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(params),
        });

        const result = await response.json();

        if (result.status === 0 || result.error) {
          throw createAPIError(
            "INTERNAL_SERVER_ERROR",
            PAYU_ERROR_CODES.SI_UPDATE_FAILED,
          );
        }

        return ctx.json({ success: true, result });
      },
    ),

    // ─── Mandate: Status ────────────────────────────────────────────────
    mandateStatus: createAuthEndpoint(
      "/payu/mandate/status",
      {
        method: "GET",
        query: mandateStatusQuerySchema,
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const { subscriptionId, mandateType } = ctx.query;

        const subscription = (await ctx.context.adapter.findOne({
          model: "subscription",
          where: [{ field: "id", value: subscriptionId }],
        })) as Subscription | null;

        if (!subscription) {
          throw createAPIError(
            "NOT_FOUND",
            PAYU_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
          );
        }

        const apiUrl = options.apiBaseUrl || "https://info.payu.in";
        const mType = mandateType || subscription.payuMandateType || "card";
        let command: string;

        if (mType === "upi") {
          command = "upi_mandate_status";
        } else if (mType === "netbanking") {
          command = "net_banking_mandate_status";
        } else {
          command = "check_mandate_status";
        }

        const hash = generateCommandHash(
          options.merchantKey,
          command,
          subscription.payuTransactionId || "",
          options.merchantSalt,
        );

        const response = await fetch(`${apiUrl}/merchant/${command}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            key: options.merchantKey,
            command,
            var1: subscription.payuTransactionId || "",
            hash,
          }),
        });

        const result = await response.json();

        if (result.status === 0 || result.error) {
          throw createAPIError(
            "INTERNAL_SERVER_ERROR",
            PAYU_ERROR_CODES.MANDATE_STATUS_CHECK_FAILED,
          );
        }

        return ctx.json({ mandate: result });
      },
    ),

    // ─── Mandate: Modify ────────────────────────────────────────────────
    mandateModify: createAuthEndpoint(
      "/payu/mandate/modify",
      {
        method: "POST",
        body: mandateModifyBodySchema,
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const body = ctx.body;

        const subscription = (await ctx.context.adapter.findOne({
          model: "subscription",
          where: [{ field: "id", value: body.subscriptionId }],
        })) as Subscription | null;

        if (!subscription) {
          throw createAPIError(
            "NOT_FOUND",
            PAYU_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
          );
        }

        const apiUrl = options.apiBaseUrl || "https://info.payu.in";
        const mType =
          body.mandateType || subscription.payuMandateType || "card";
        let command: string;

        if (mType === "upi") {
          command = "upi_mandate_modify";
        } else {
          command = "mandate_modify";
        }

        const hash = generateCommandHash(
          options.merchantKey,
          command,
          subscription.payuTransactionId || "",
          options.merchantSalt,
        );

        const response = await fetch(`${apiUrl}/merchant/${command}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            key: options.merchantKey,
            command,
            var1: subscription.payuTransactionId || "",
            var2: body.amount,
            hash,
          }),
        });

        const result = await response.json();

        if (result.status === 0 || result.error) {
          throw createAPIError(
            "INTERNAL_SERVER_ERROR",
            PAYU_ERROR_CODES.MANDATE_MODIFY_FAILED,
          );
        }

        return ctx.json({ success: true, result });
      },
    ),

    // ─── Payment: Initiate ──────────────────────────────────────────────
    initiatePayment: createAuthEndpoint(
      "/payu/payment/initiate",
      {
        method: "POST",
        body: initiatePaymentBodySchema,
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const body = ctx.body;

        const hash = generatePayUHash(
          {
            key: options.merchantKey,
            txnid: body.txnid,
            amount: body.amount,
            productinfo: body.productinfo,
            firstname: body.firstname,
            email: body.email,
          },
          options.merchantSalt,
        );

        return ctx.json({
          paymentParams: {
            key: options.merchantKey,
            txnid: body.txnid,
            amount: body.amount,
            productinfo: body.productinfo,
            firstname: body.firstname,
            email: body.email,
            phone: body.phone,
            hash,
            surl: `${options.apiBaseUrl || ""}/payu/webhook`,
            furl: `${options.apiBaseUrl || ""}/payu/webhook`,
          },
        });
      },
    ),

    // ─── Payment: Verify ────────────────────────────────────────────────
    verifyPayment: createAuthEndpoint(
      "/payu/payment/verify",
      {
        method: "POST",
        body: verifyPaymentBodySchema,
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const { txnid } = ctx.body;

        const apiUrl = options.apiBaseUrl || "https://info.payu.in";
        const hash = generateCommandHash(
          options.merchantKey,
          "verify_payment",
          txnid,
          options.merchantSalt,
        );

        const response = await fetch(`${apiUrl}/merchant/postservice?form=2`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            key: options.merchantKey,
            command: "verify_payment",
            var1: txnid,
            hash,
          }),
        });

        const result = await response.json();

        if (result.status === 0 || result.error) {
          throw createAPIError(
            "INTERNAL_SERVER_ERROR",
            PAYU_ERROR_CODES.PAYMENT_VERIFICATION_FAILED,
          );
        }

        return ctx.json({ transaction: result });
      },
    ),

    // ─── Payment: Check ─────────────────────────────────────────────────
    checkPayment: createAuthEndpoint(
      "/payu/payment/check",
      {
        method: "POST",
        body: z.object({ mihpayid: z.string() }),
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const { mihpayid } = ctx.body;

        const apiUrl = options.apiBaseUrl || "https://info.payu.in";
        const hash = generateCommandHash(
          options.merchantKey,
          "check_payment",
          mihpayid,
          options.merchantSalt,
        );

        const response = await fetch(`${apiUrl}/merchant/postservice?form=2`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            key: options.merchantKey,
            command: "check_payment",
            var1: mihpayid,
            hash,
          }),
        });

        const result = await response.json();

        return ctx.json({ transaction: result });
      },
    ),

    // ─── Refund: Initiate ───────────────────────────────────────────────
    initiateRefund: createAuthEndpoint(
      "/payu/refund/initiate",
      {
        method: "POST",
        body: initiateRefundBodySchema,
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const body = ctx.body;

        const apiUrl = options.apiBaseUrl || "https://info.payu.in";
        const hash = generateCommandHash(
          options.merchantKey,
          "cancel_refund_transaction",
          body.mihpayid,
          options.merchantSalt,
        );

        const response = await fetch(`${apiUrl}/merchant/postservice?form=2`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            key: options.merchantKey,
            command: "cancel_refund_transaction",
            var1: body.mihpayid,
            var2: body.tokenId,
            var3: body.amount,
            hash,
          }),
        });

        const result = await response.json();

        if (result.status === 0 || result.error) {
          throw createAPIError(
            "INTERNAL_SERVER_ERROR",
            PAYU_ERROR_CODES.REFUND_INITIATION_FAILED,
          );
        }

        return ctx.json({ success: true, refund: result });
      },
    ),

    // ─── Refund: Status ─────────────────────────────────────────────────
    refundStatus: createAuthEndpoint(
      "/payu/refund/status",
      {
        method: "GET",
        query: refundStatusQuerySchema,
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const { requestId, mihpayid } = ctx.query;

        const apiUrl = options.apiBaseUrl || "https://info.payu.in";
        let command: string;
        let var1: string;

        if (requestId) {
          command = "check_action_status";
          var1 = requestId;
        } else if (mihpayid) {
          command = "check_action_status";
          var1 = mihpayid;
        } else {
          throw createAPIError(
            "BAD_REQUEST",
            PAYU_ERROR_CODES.INVALID_REQUEST_BODY,
          );
        }

        const hash = generateCommandHash(
          options.merchantKey,
          command,
          var1,
          options.merchantSalt,
        );

        const response = await fetch(`${apiUrl}/merchant/postservice?form=2`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            key: options.merchantKey,
            command,
            var1,
            hash,
          }),
        });

        const result = await response.json();

        return ctx.json({ refundStatus: result });
      },
    ),

    // ─── Refund: List ───────────────────────────────────────────────────
    listRefunds: createAuthEndpoint(
      "/payu/refund/list",
      {
        method: "POST",
        body: z.object({ mihpayids: z.array(z.string()) }),
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const { mihpayids } = ctx.body;

        const apiUrl = options.apiBaseUrl || "https://info.payu.in";
        const var1 = mihpayids.join("|");
        const hash = generateCommandHash(
          options.merchantKey,
          "get_all_refunds_from_transaction_ids",
          var1,
          options.merchantSalt,
        );

        const response = await fetch(`${apiUrl}/merchant/postservice?form=2`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            key: options.merchantKey,
            command: "get_all_refunds_from_transaction_ids",
            var1,
            hash,
          }),
        });

        const result = await response.json();

        return ctx.json({ refunds: result });
      },
    ),

    // ─── Transaction: Info ──────────────────────────────────────────────
    transactionInfo: createAuthEndpoint(
      "/payu/transaction/info",
      {
        method: "GET",
        query: transactionInfoQuerySchema,
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const { txnid } = ctx.query;

        const apiUrl = options.apiBaseUrl || "https://info.payu.in";
        const hash = generateCommandHash(
          options.merchantKey,
          "get_transaction_info",
          txnid,
          options.merchantSalt,
        );

        const response = await fetch(`${apiUrl}/merchant/postservice?form=2`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            key: options.merchantKey,
            command: "get_transaction_info",
            var1: txnid,
            hash,
          }),
        });

        const result = await response.json();

        return ctx.json({ transaction: result });
      },
    ),

    // ─── Transaction: Details ───────────────────────────────────────────
    transactionDetails: createAuthEndpoint(
      "/payu/transaction/details",
      {
        method: "GET",
        query: transactionDetailsQuerySchema,
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const { startDate, endDate } = ctx.query;

        const apiUrl = options.apiBaseUrl || "https://info.payu.in";
        const hash = generateCommandHash(
          options.merchantKey,
          "get_Transaction_Details",
          startDate,
          options.merchantSalt,
        );

        const response = await fetch(`${apiUrl}/merchant/postservice?form=2`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            key: options.merchantKey,
            command: "get_Transaction_Details",
            var1: startDate,
            var2: endDate,
            hash,
          }),
        });

        const result = await response.json();

        return ctx.json({ transactions: result });
      },
    ),

    // ─── VPA: Validate ──────────────────────────────────────────────────
    validateVpa: createAuthEndpoint(
      "/payu/upi/validate-vpa",
      {
        method: "POST",
        body: validateVpaBodySchema,
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const { vpa } = ctx.body;

        const apiUrl = options.apiBaseUrl || "https://info.payu.in";
        const hash = generateCommandHash(
          options.merchantKey,
          "validateVPA",
          vpa,
          options.merchantSalt,
        );

        const response = await fetch(`${apiUrl}/merchant/postservice?form=2`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            key: options.merchantKey,
            command: "validateVPA",
            var1: vpa,
            hash,
          }),
        });

        const result = await response.json();

        if (result.status === 0 || result.isVPAValid === 0) {
          throw createAPIError("BAD_REQUEST", PAYU_ERROR_CODES.INVALID_VPA);
        }

        return ctx.json({ valid: true, result });
      },
    ),

    // ─── Plan: List ─────────────────────────────────────────────────────
    listPlans: createAuthEndpoint(
      "/payu/plan/list",
      {
        method: "GET",
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);

        if (!options.subscription?.enabled) {
          return ctx.json({ plans: [] });
        }

        const plans = await getPlans(options.subscription);
        return ctx.json({ plans });
      },
    ),

    // ─── Plan: Get ──────────────────────────────────────────────────────
    getPlan: createAuthEndpoint(
      "/payu/plan/get",
      {
        method: "GET",
        query: fetchPlanQuerySchema,
      },
      async (ctx) => {
        payuSessionMiddleware(ctx);
        const { planId } = ctx.query;

        const plan = await getPlanByPlanId(options, planId);
        if (!plan) {
          throw createAPIError(
            "NOT_FOUND",
            PAYU_ERROR_CODES.SUBSCRIPTION_PLAN_NOT_FOUND,
          );
        }

        return ctx.json({ plan });
      },
    ),

    // ─── Webhook ────────────────────────────────────────────────────────
    webhook: createAuthEndpoint(
      "/payu/webhook",
      {
        method: "POST",
      },
      async (ctx) => {
        const body = ctx.body as Record<string, string>;

        if (!body || !body.hash) {
          throw createAPIError(
            "BAD_REQUEST",
            PAYU_ERROR_CODES.WEBHOOK_HASH_NOT_FOUND,
          );
        }

        // Verify hash
        const isValid = verifyPayUHash(
          {
            key: body.key || options.merchantKey,
            txnid: body.txnid || "",
            amount: body.amount || "",
            productinfo: body.productinfo || "",
            firstname: body.firstname || "",
            email: body.email || "",
            status: body.status || "",
            udf1: body.udf1,
            udf2: body.udf2,
            udf3: body.udf3,
            udf4: body.udf4,
            udf5: body.udf5,
            udf6: body.udf6,
            udf7: body.udf7,
            udf8: body.udf8,
            udf9: body.udf9,
            udf10: body.udf10,
          },
          options.merchantSalt,
          body.hash,
        );

        if (!isValid) {
          throw createAPIError(
            "UNAUTHORIZED",
            PAYU_ERROR_CODES.FAILED_TO_VERIFY_WEBHOOK,
          );
        }

        const event: PayUWebhookEvent = {
          mihpayid: body.mihpayid || "",
          status: body.status || "",
          txnid: body.txnid || "",
          amount: body.amount || "",
          productinfo: body.productinfo || "",
          firstname: body.firstname || "",
          email: body.email || "",
          phone: body.phone || "",
          hash: body.hash,
          key: body.key || "",
          mode: body.mode || "",
          unmappedstatus: body.unmappedstatus || "",
          field9: body.field9 || "",
          error: body.error_Message || body.error || "",
          bank_ref_num: body.bank_ref_num || "",
          addedon: body.addedon || "",
          payment_source: body.payment_source || "",
          udf1: body.udf1,
          udf2: body.udf2,
          udf3: body.udf3,
          udf4: body.udf4,
          udf5: body.udf5,
          udf6: body.udf6,
          udf7: body.udf7,
          udf8: body.udf8,
          udf9: body.udf9,
          udf10: body.udf10,
          notificationType: body.notificationType,
        };

        // Route based on status and notification type
        const status = body.status?.toLowerCase();
        const notifType = body.notificationType?.toLowerCase();

        if (notifType === "mandate_revoked" || notifType === "si_cancelled") {
          await onMandateRevoked(ctx, options, event);
        } else if (
          notifType === "mandate_modified" ||
          notifType === "si_modified"
        ) {
          await onMandateModified(ctx, options, event);
        } else if (status === "success" || status === "captured") {
          await onPaymentSuccess(ctx, options, event);
          await onSubscriptionActivated(ctx, options, event);
        } else if (status === "failure" || status === "failed") {
          await onPaymentFailure(ctx, options, event);
        } else if (status === "pending") {
          await onSubscriptionPending(ctx, options, event);
        } else if (status === "cancelled") {
          await onSubscriptionCancelled(ctx, options, event);
        } else if (status === "halted") {
          await onSubscriptionHalted(ctx, options, event);
        } else if (status === "completed") {
          await onSubscriptionCompleted(ctx, options, event);
        } else if (status === "paused") {
          await onSubscriptionPaused(ctx, options, event);
        } else if (status === "resumed" || status === "active") {
          await onSubscriptionResumed(ctx, options, event);
        }

        return ctx.json({ success: true });
      },
    ),
  };
}
