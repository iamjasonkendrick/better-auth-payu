import { PAYU_ERROR_CODES } from "./error-codes";
import type { PayUOptions } from "./types";
import { createAPIError } from "./utils";

type Context = {
  context: {
    session?: {
      user?: { id: string };
    } | null;
  };
  query?: Record<string, string>;
  body?: Record<string, unknown>;
};

/**
 * Middleware to extract and validate the authenticated session.
 * Returns the user from the session or throws UNAUTHORIZED.
 */
export function payuSessionMiddleware(ctx: Context) {
  const user = ctx.context.session?.user;
  if (!user) {
    throw createAPIError("UNAUTHORIZED", PAYU_ERROR_CODES.UNAUTHORIZED);
  }
  return user;
}

/**
 * Middleware factory to authorize a reference (user or organization) for
 * subscription actions. Supports org-based subscriptions.
 */
export function referenceMiddleware(options: PayUOptions) {
  return async (ctx: Context) => {
    const user = payuSessionMiddleware(ctx);
    const referenceId =
      (ctx.body as Record<string, string>)?.referenceId ??
      ctx.query?.referenceId ??
      user.id;

    // If referenceId matches the user, it's a user-level subscription
    if (referenceId === user.id) {
      return { referenceId, type: "user" as const, userId: user.id };
    }

    // If organizations are enabled, check authorization
    if (options.organization?.enabled) {
      const authorizeReference = options.organization.authorizeReference;

      if (authorizeReference) {
        const allowed = await authorizeReference({
          action: "list-subscriptions",
          organizationId: referenceId,
          userId: user.id,
          role: undefined,
        });

        if (!allowed) {
          throw createAPIError(
            "FORBIDDEN",
            PAYU_ERROR_CODES.REFERENCE_ID_NOT_ALLOWED,
          );
        }
      }

      return {
        referenceId,
        type: "organization" as const,
        userId: user.id,
      };
    }

    // referenceId doesn't match user and orgs are disabled
    throw createAPIError(
      "FORBIDDEN",
      PAYU_ERROR_CODES.REFERENCE_ID_NOT_ALLOWED,
    );
  };
}
