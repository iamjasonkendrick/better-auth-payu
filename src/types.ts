import type { BetterAuthPlugin } from "better-auth";

// ─── Subscription Status ─────────────────────────────────────────────────────

export type PayUSubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired"
  | "paused";

// ─── Standing Instruction Parameters ─────────────────────────────────────────

export type PayUBillingCycle =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "YEARLY"
  | "ADHOC"
  | "ASPRESENTED"
  | "BIMONTHLY"
  | "BI_YEARLY"
  | "FORTNIGHTLY"
  | "QUARTERLY";

export type PayUMandateType = "card" | "upi" | "netbanking";

export interface PayUSIParams {
  /** Maximum amount that can be debited in a billing cycle */
  billingAmount: string;
  /** Frequency of billing cycles */
  billingCycle: PayUBillingCycle;
  /** Number of billing cycles between charges */
  billingInterval: number;
  /** Mandate start date (YYYY-MM-DD) */
  paymentStartDate: string;
  /** Mandate end date (YYYY-MM-DD) */
  paymentEndDate: string;
  /** Total number of recurring payments allowed */
  recurringCount?: number;
  /** Fixed amount per recurring charge, if applicable */
  recurringAmount?: string;
}

// ─── Plan Configuration ──────────────────────────────────────────────────────

export interface PayUPlan {
  /** Unique plan identifier */
  planId: string;
  /** Human-readable plan name */
  name: string;
  /** Amount per billing cycle */
  amount: string;
  /** Billing cycle period */
  billingCycle: PayUBillingCycle;
  /** Interval between billing cycles (1 = every cycle) */
  billingInterval: number;
  /** Total number of charges (0 = unlimited) */
  totalCount: number;
  /** Optional annual plan variant ID */
  annualPlanId?: string;
  /** Trial period in days */
  trialDays?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ─── Database Subscription Record ────────────────────────────────────────────

export interface Subscription {
  id: string;
  plan: string;
  referenceId: string;
  payuCustomerId: string | null;
  payuSubscriptionId: string;
  payuMandateType: PayUMandateType | null;
  payuTransactionId: string | null;
  payuMihpayid: string | null;
  status: PayUSubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelledAt: Date | null;
  endedAt: Date | null;
  pausedAt: Date | null;
  totalCount: number | null;
  paidCount: number | null;
  remainingCount: number | null;
  quantity: number | null;
  seats: number | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── PayU Transaction Response ───────────────────────────────────────────────

export interface PayUTransactionResponse {
  mihpayid: string;
  status: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  hash: string;
  key: string;
  mode: string;
  unmappedstatus: string;
  field9: string;
  error_Message: string;
  bank_ref_num: string;
  cardCategory: string;
  addedon: string;
  payment_source: string;
  card_type: string;
  name_on_card: string;
  cardnum: string;
  issuing_bank: string;
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
  si?: PayUSIResponseDetails;
}

export interface PayUSIResponseDetails {
  status: string;
  paymentMode: string;
  startDate: string;
  endDate: string;
  maxAmount: string;
  frequency: string;
  mandateId?: string;
  tokenValue?: string;
}

// ─── Webhook Event ───────────────────────────────────────────────────────────

export interface PayUWebhookEvent {
  mihpayid: string;
  status: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  hash: string;
  key: string;
  mode: string;
  unmappedstatus: string;
  field9: string;
  error: string;
  bank_ref_num: string;
  addedon: string;
  payment_source: string;
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
  si?: PayUSIResponseDetails;
  /** Webhook notification type */
  notificationType?: string;
}

// ─── Mandate Status Response ─────────────────────────────────────────────────

export interface PayUMandateStatusResponse {
  mandateId: string;
  status: string;
  mandateType: string;
  startDate: string;
  endDate: string;
  maxAmount: string;
  frequency: string;
  umrn?: string;
  tokenValue?: string;
  bankName?: string;
}

// ─── Refund ──────────────────────────────────────────────────────────────────

export interface PayURefundResponse {
  mihpayid: string;
  request_id: string;
  bank_ref_num: string;
  amt: string;
  mode: string;
  action: string;
  token: string;
  status: string;
  error_code?: number;
  msg?: string;
}

// ─── Callback Types ──────────────────────────────────────────────────────────

export type CustomerType = "user" | "organization";

export interface SubscriptionCallbackData {
  subscription: Subscription;
  plan: PayUPlan | undefined;
  event: PayUWebhookEvent;
}

export interface SubscriptionOptions {
  enabled: boolean;
  plans?: PayUPlan[] | (() => Promise<PayUPlan[]> | PayUPlan[]);
  defaultPlan?: string;
  startOnConsent?: boolean;
  requireOrganization?: boolean;
  onSubscriptionActivated?: (
    data: SubscriptionCallbackData,
  ) => void | Promise<void>;
  onSubscriptionCharged?: (
    data: SubscriptionCallbackData,
  ) => void | Promise<void>;
  onSubscriptionPending?: (
    data: SubscriptionCallbackData,
  ) => void | Promise<void>;
  onSubscriptionHalted?: (
    data: SubscriptionCallbackData,
  ) => void | Promise<void>;
  onSubscriptionCompleted?: (
    data: SubscriptionCallbackData,
  ) => void | Promise<void>;
  onSubscriptionCancelled?: (
    data: SubscriptionCallbackData,
  ) => void | Promise<void>;
  onSubscriptionPaused?: (
    data: SubscriptionCallbackData,
  ) => void | Promise<void>;
  onSubscriptionResumed?: (
    data: SubscriptionCallbackData,
  ) => void | Promise<void>;
  onSubscriptionAuthenticated?: (
    data: SubscriptionCallbackData,
  ) => void | Promise<void>;
  onPaymentSuccess?: (data: SubscriptionCallbackData) => void | Promise<void>;
  onPaymentFailure?: (data: {
    event: PayUWebhookEvent;
    error: string;
  }) => void | Promise<void>;
  onMandateRevoked?: (data: SubscriptionCallbackData) => void | Promise<void>;
  onMandateModified?: (data: SubscriptionCallbackData) => void | Promise<void>;
  onRefundComplete?: (data: {
    event: PayUWebhookEvent;
    refund: PayURefundResponse;
  }) => void | Promise<void>;
}

// ─── Authorization ───────────────────────────────────────────────────────────

export type AuthorizeReferenceAction =
  | "create-subscription"
  | "cancel-subscription"
  | "pause-subscription"
  | "resume-subscription"
  | "update-subscription"
  | "list-subscriptions"
  | "get-subscription"
  | "check-mandate-status"
  | "modify-mandate"
  | "initiate-payment"
  | "verify-payment"
  | "initiate-refund"
  | "check-refund-status"
  | "list-refunds";

export interface OrganizationOptions {
  enabled: boolean;
  creatorRole?: string;
  memberRole?: string;
  organizationLimit?: number;
  seatManagement?: boolean;
  authorizeReference?: (params: {
    action: AuthorizeReferenceAction;
    organizationId: string;
    userId: string;
    role: string | undefined;
  }) => boolean | Promise<boolean>;
}

// ─── Main Plugin Options ─────────────────────────────────────────────────────

export interface PayUOptions {
  /** PayU Merchant Key */
  merchantKey: string;
  /** PayU Merchant Salt (V2 recommended) */
  merchantSalt: string;
  /** PayU API base URL (production or test) */
  apiBaseUrl?: string;
  /** Webhook secret for verifying webhook signatures */
  webhookSecret?: string;
  /** Subscription / Standing Instruction configuration */
  subscription?: SubscriptionOptions;
  /** Organization support configuration */
  organization?: OrganizationOptions;
  /** Custom schema overrides */
  schema?: Record<string, Record<string, unknown>>;
}

// ─── PayU API URLs ───────────────────────────────────────────────────────────

export const PAYU_PRODUCTION_URL = "https://info.payu.in";
export const PAYU_TEST_URL = "https://test.payu.in";
export const PAYU_PRODUCTION_PAYMENT_URL = "https://secure.payu.in/_payment";
export const PAYU_TEST_PAYMENT_URL = "https://test.payu.in/_payment";

// ─── Plugin Type ─────────────────────────────────────────────────────────────

export type PayUPlugin = BetterAuthPlugin;
