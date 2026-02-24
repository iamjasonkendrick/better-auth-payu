import { paramsToUdf, subscriptionUdf } from "./metadata";
import type {
  PayUOptions,
  PayUSubscriptionStatus,
  PayUWebhookEvent,
  Subscription,
} from "./types";

type Adapter = {
  // biome-ignore lint/suspicious/noExplicitAny: adapter args vary by method
  findOne: (args: any) => Promise<any>;
  // biome-ignore lint/suspicious/noExplicitAny: adapter args vary by method
  create: (args: any) => Promise<any>;
  // biome-ignore lint/suspicious/noExplicitAny: adapter args vary by method
  update: (args: any) => Promise<any>;
};

type HookContext = {
  context: {
    adapter: Adapter;
    logger: {
      warn: (msg: string) => void;
      error: (msg: string) => void;
      info: (msg: string) => void;
    };
  };
};

// ─── Helper: Find subscription by PayU txnid ─────────────────────────────────

async function findSubscriptionByTxnId(
  adapter: Adapter,
  txnid: string,
): Promise<Subscription | null> {
  const result = await adapter.findOne({
    model: "subscription",
    where: [{ field: "payuTransactionId", value: txnid }],
  });
  return result as Subscription | null;
}

async function findSubscriptionByUdf(
  adapter: Adapter,
  event: PayUWebhookEvent,
): Promise<Subscription | null> {
  const udf = paramsToUdf(event as unknown as Record<string, string>);
  const subUdf = subscriptionUdf.get(udf);

  if (subUdf.subscriptionId) {
    const result = await adapter.findOne({
      model: "subscription",
      where: [{ field: "id", value: subUdf.subscriptionId }],
    });
    return result as Subscription | null;
  }

  return null;
}

async function findSubscription(
  adapter: Adapter,
  event: PayUWebhookEvent,
): Promise<Subscription | null> {
  // First try by txnid, then by UDF subscription ID
  const byTxn = await findSubscriptionByTxnId(adapter, event.txnid);
  if (byTxn) return byTxn;
  return findSubscriptionByUdf(adapter, event);
}

// ─── Webhook Handlers ────────────────────────────────────────────────────────

export async function onPaymentSuccess(
  ctx: HookContext,
  options: PayUOptions,
  event: PayUWebhookEvent,
): Promise<void> {
  if (!options.subscription?.enabled) return;
  if (!event.txnid) return;

  try {
    const sub = await findSubscription(ctx.context.adapter, event);

    if (sub) {
      await ctx.context.adapter.update({
        model: "subscription",
        where: [{ field: "id", value: sub.id }],
        update: {
          status: "active" as PayUSubscriptionStatus,
          payuMihpayid: event.mihpayid,
          paidCount: (sub.paidCount || 0) + 1,
          remainingCount:
            sub.totalCount != null
              ? Math.max((sub.totalCount || 0) - ((sub.paidCount || 0) + 1), 0)
              : null,
          updatedAt: new Date(),
        },
      });

      const plan = options.subscription.plans
        ? (typeof options.subscription.plans === "function"
            ? await options.subscription.plans()
            : options.subscription.plans
          ).find((p) => p.name === sub.plan)
        : undefined;

      await options.subscription.onPaymentSuccess?.({
        subscription: sub,
        plan,
        event,
      });
    } else {
      ctx.context.logger.warn(
        `PayU: payment success for txnid ${event.txnid} but subscription not found`,
      );
    }
  } catch (err) {
    ctx.context.logger.error(
      `PayU onPaymentSuccess error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function onPaymentFailure(
  ctx: HookContext,
  options: PayUOptions,
  event: PayUWebhookEvent,
): Promise<void> {
  if (!options.subscription?.enabled) return;

  try {
    const sub = await findSubscription(ctx.context.adapter, event);

    if (sub) {
      await ctx.context.adapter.update({
        model: "subscription",
        where: [{ field: "id", value: sub.id }],
        update: {
          status: "pending" as PayUSubscriptionStatus,
          updatedAt: new Date(),
        },
      });
    }

    await options.subscription.onPaymentFailure?.({
      event,
      error: event.error || event.field9 || "Payment failed",
    });
  } catch (err) {
    ctx.context.logger.error(
      `PayU onPaymentFailure error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function onSubscriptionActivated(
  ctx: HookContext,
  options: PayUOptions,
  event: PayUWebhookEvent,
): Promise<void> {
  if (!options.subscription?.enabled) return;
  if (!event.txnid) return;

  try {
    const sub = await findSubscription(ctx.context.adapter, event);

    if (sub) {
      await ctx.context.adapter.update({
        model: "subscription",
        where: [{ field: "id", value: sub.id }],
        update: {
          status: "active" as PayUSubscriptionStatus,
          payuMihpayid: event.mihpayid,
          currentStart: new Date(),
          updatedAt: new Date(),
        },
      });

      const plan = options.subscription.plans
        ? (typeof options.subscription.plans === "function"
            ? await options.subscription.plans()
            : options.subscription.plans
          ).find((p) => p.name === sub.plan)
        : undefined;

      await options.subscription.onSubscriptionActivated?.({
        subscription: sub,
        plan,
        event,
      });
    } else {
      ctx.context.logger.warn(
        `PayU: subscription activated for txnid ${event.txnid} but subscription not found`,
      );
    }
  } catch (err) {
    ctx.context.logger.error(
      `PayU onSubscriptionActivated error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function onSubscriptionCharged(
  ctx: HookContext,
  options: PayUOptions,
  event: PayUWebhookEvent,
): Promise<void> {
  if (!options.subscription?.enabled) return;
  if (!event.txnid) return;

  try {
    const sub = await findSubscription(ctx.context.adapter, event);

    if (sub) {
      const newPaidCount = (sub.paidCount || 0) + 1;
      const newRemainingCount =
        sub.totalCount != null
          ? Math.max((sub.totalCount || 0) - newPaidCount, 0)
          : null;

      await ctx.context.adapter.update({
        model: "subscription",
        where: [{ field: "id", value: sub.id }],
        update: {
          status: "active" as PayUSubscriptionStatus,
          paidCount: newPaidCount,
          remainingCount: newRemainingCount,
          payuMihpayid: event.mihpayid,
          updatedAt: new Date(),
        },
      });

      const plan = options.subscription.plans
        ? (typeof options.subscription.plans === "function"
            ? await options.subscription.plans()
            : options.subscription.plans
          ).find((p) => p.name === sub.plan)
        : undefined;

      await options.subscription.onSubscriptionCharged?.({
        subscription: sub,
        plan,
        event,
      });
    } else {
      ctx.context.logger.warn(
        `PayU: subscription charged for txnid ${event.txnid} but subscription not found`,
      );
    }
  } catch (err) {
    ctx.context.logger.error(
      `PayU onSubscriptionCharged error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function onSubscriptionPending(
  ctx: HookContext,
  options: PayUOptions,
  event: PayUWebhookEvent,
): Promise<void> {
  if (!options.subscription?.enabled) return;

  try {
    const sub = await findSubscription(ctx.context.adapter, event);

    if (sub) {
      await ctx.context.adapter.update({
        model: "subscription",
        where: [{ field: "id", value: sub.id }],
        update: {
          status: "pending" as PayUSubscriptionStatus,
          updatedAt: new Date(),
        },
      });

      const plan = options.subscription.plans
        ? (typeof options.subscription.plans === "function"
            ? await options.subscription.plans()
            : options.subscription.plans
          ).find((p) => p.name === sub.plan)
        : undefined;

      await options.subscription.onSubscriptionPending?.({
        subscription: sub,
        plan,
        event,
      });
    }
  } catch (err) {
    ctx.context.logger.error(
      `PayU onSubscriptionPending error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function onSubscriptionHalted(
  ctx: HookContext,
  options: PayUOptions,
  event: PayUWebhookEvent,
): Promise<void> {
  if (!options.subscription?.enabled) return;

  try {
    const sub = await findSubscription(ctx.context.adapter, event);

    if (sub) {
      await ctx.context.adapter.update({
        model: "subscription",
        where: [{ field: "id", value: sub.id }],
        update: {
          status: "halted" as PayUSubscriptionStatus,
          updatedAt: new Date(),
        },
      });

      const plan = options.subscription.plans
        ? (typeof options.subscription.plans === "function"
            ? await options.subscription.plans()
            : options.subscription.plans
          ).find((p) => p.name === sub.plan)
        : undefined;

      await options.subscription.onSubscriptionHalted?.({
        subscription: sub,
        plan,
        event,
      });
    }
  } catch (err) {
    ctx.context.logger.error(
      `PayU onSubscriptionHalted error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function onSubscriptionCompleted(
  ctx: HookContext,
  options: PayUOptions,
  event: PayUWebhookEvent,
): Promise<void> {
  if (!options.subscription?.enabled) return;

  try {
    const sub = await findSubscription(ctx.context.adapter, event);

    if (sub) {
      await ctx.context.adapter.update({
        model: "subscription",
        where: [{ field: "id", value: sub.id }],
        update: {
          status: "completed" as PayUSubscriptionStatus,
          endedAt: new Date(),
          remainingCount: 0,
          updatedAt: new Date(),
        },
      });

      const plan = options.subscription.plans
        ? (typeof options.subscription.plans === "function"
            ? await options.subscription.plans()
            : options.subscription.plans
          ).find((p) => p.name === sub.plan)
        : undefined;

      await options.subscription.onSubscriptionCompleted?.({
        subscription: sub,
        plan,
        event,
      });
    }
  } catch (err) {
    ctx.context.logger.error(
      `PayU onSubscriptionCompleted error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function onSubscriptionCancelled(
  ctx: HookContext,
  options: PayUOptions,
  event: PayUWebhookEvent,
): Promise<void> {
  if (!options.subscription?.enabled) return;

  try {
    const sub = await findSubscription(ctx.context.adapter, event);

    if (sub) {
      await ctx.context.adapter.update({
        model: "subscription",
        where: [{ field: "id", value: sub.id }],
        update: {
          status: "cancelled" as PayUSubscriptionStatus,
          cancelledAt: new Date(),
          endedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const plan = options.subscription.plans
        ? (typeof options.subscription.plans === "function"
            ? await options.subscription.plans()
            : options.subscription.plans
          ).find((p) => p.name === sub.plan)
        : undefined;

      await options.subscription.onSubscriptionCancelled?.({
        subscription: sub,
        plan,
        event,
      });
    } else {
      ctx.context.logger.warn(
        `PayU: subscription cancelled for txnid ${event.txnid} but subscription not found`,
      );
    }
  } catch (err) {
    ctx.context.logger.error(
      `PayU onSubscriptionCancelled error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function onSubscriptionPaused(
  ctx: HookContext,
  options: PayUOptions,
  event: PayUWebhookEvent,
): Promise<void> {
  if (!options.subscription?.enabled) return;

  try {
    const sub = await findSubscription(ctx.context.adapter, event);

    if (sub) {
      await ctx.context.adapter.update({
        model: "subscription",
        where: [{ field: "id", value: sub.id }],
        update: {
          status: "paused" as PayUSubscriptionStatus,
          pausedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const plan = options.subscription.plans
        ? (typeof options.subscription.plans === "function"
            ? await options.subscription.plans()
            : options.subscription.plans
          ).find((p) => p.name === sub.plan)
        : undefined;

      await options.subscription.onSubscriptionPaused?.({
        subscription: sub,
        plan,
        event,
      });
    }
  } catch (err) {
    ctx.context.logger.error(
      `PayU onSubscriptionPaused error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function onSubscriptionResumed(
  ctx: HookContext,
  options: PayUOptions,
  event: PayUWebhookEvent,
): Promise<void> {
  if (!options.subscription?.enabled) return;

  try {
    const sub = await findSubscription(ctx.context.adapter, event);

    if (sub) {
      await ctx.context.adapter.update({
        model: "subscription",
        where: [{ field: "id", value: sub.id }],
        update: {
          status: "active" as PayUSubscriptionStatus,
          pausedAt: null,
          updatedAt: new Date(),
        },
      });

      const plan = options.subscription.plans
        ? (typeof options.subscription.plans === "function"
            ? await options.subscription.plans()
            : options.subscription.plans
          ).find((p) => p.name === sub.plan)
        : undefined;

      await options.subscription.onSubscriptionResumed?.({
        subscription: sub,
        plan,
        event,
      });
    }
  } catch (err) {
    ctx.context.logger.error(
      `PayU onSubscriptionResumed error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function onMandateRevoked(
  ctx: HookContext,
  options: PayUOptions,
  event: PayUWebhookEvent,
): Promise<void> {
  if (!options.subscription?.enabled) return;

  try {
    const sub = await findSubscription(ctx.context.adapter, event);

    if (sub) {
      await ctx.context.adapter.update({
        model: "subscription",
        where: [{ field: "id", value: sub.id }],
        update: {
          status: "cancelled" as PayUSubscriptionStatus,
          cancelledAt: new Date(),
          endedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const plan = options.subscription.plans
        ? (typeof options.subscription.plans === "function"
            ? await options.subscription.plans()
            : options.subscription.plans
          ).find((p) => p.name === sub.plan)
        : undefined;

      await options.subscription.onMandateRevoked?.({
        subscription: sub,
        plan,
        event,
      });
    }
  } catch (err) {
    ctx.context.logger.error(
      `PayU onMandateRevoked error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function onMandateModified(
  ctx: HookContext,
  options: PayUOptions,
  event: PayUWebhookEvent,
): Promise<void> {
  if (!options.subscription?.enabled) return;

  try {
    const sub = await findSubscription(ctx.context.adapter, event);

    if (sub) {
      await ctx.context.adapter.update({
        model: "subscription",
        where: [{ field: "id", value: sub.id }],
        update: {
          updatedAt: new Date(),
        },
      });

      const plan = options.subscription.plans
        ? (typeof options.subscription.plans === "function"
            ? await options.subscription.plans()
            : options.subscription.plans
          ).find((p) => p.name === sub.plan)
        : undefined;

      await options.subscription.onMandateModified?.({
        subscription: sub,
        plan,
        event,
      });
    }
  } catch (err) {
    ctx.context.logger.error(
      `PayU onMandateModified error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
