"use client";

import {LoadingRows, Skeleton, SkeletonStatus} from "@/components/ui/loading-skeleton";
import {useTranslations} from "next-intl";

import {Children, cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {canPayToFeature, listingFeaturePriceId} from "@the-property-pillar/contracts";
import {toast} from "react-hot-toast";
import {
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CreditCard,
  Download,
  FileText,
  History,
  LoaderCircle,
  MapPin,
  ReceiptIndianRupee,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";

import type {UserRole} from "@/features/auth/types";
import {indianPincodePattern, usePincodeLookup} from "@/features/address/use-pincode-lookup";
import type {PincodeLocation} from "@/features/address/use-pincode-lookup";
import type {WorkspaceCollection} from "@/features/dashboard/types";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import {focusInvalidControl, splitFieldErrors} from "@/lib/form-validation";
import {loadRazorpayCheckout} from "./razorpay";
import {PhoneInput} from "@/components/ui/phone-input";
import type {
  BillingCatalog,
  BillingPlan,
  BillingSnapshot,
  BillingStatusEvent,
  CheckoutResponse,
  FeaturePayment,
  OrderDetail,
  OrdersPage,
  OrderStatus,
  OrderSummary,
  RazorpaySuccess,
  VerifyResponse,
} from "./types";
import {PlanAdmin} from "./plan-admin";
import styles from "./billing.module.css";

const orderStatuses: OrderStatus[] = ["CREATING", "PAYMENT_PENDING", "CAPTURED", "FAILED", "REFUNDED"];

const statusCopy: Record<OrderStatus, {label: string; description: string}> = {
  CREATING: {label: "Creating", description: "The secure provider order is being prepared."},
  PAYMENT_PENDING: {label: "Payment pending", description: "Checkout has not yet been confirmed by the server."},
  CAPTURED: {label: "Paid", description: "Payment was captured and confirmed by the server."},
  FAILED: {label: "Failed", description: "The payment could not be completed."},
  REFUNDED: {label: "Refunded", description: "The captured amount has been returned."},
};

const targetCollections = {
  AD_CAMPAIGN: "adCampaigns",
  JOB: "jobs",
};

const gstStates = [
  ["01", "Jammu and Kashmir"], ["02", "Himachal Pradesh"], ["03", "Punjab"], ["04", "Chandigarh"],
  ["05", "Uttarakhand"], ["06", "Haryana"], ["07", "Delhi"], ["08", "Rajasthan"],
  ["09", "Uttar Pradesh"], ["10", "Bihar"], ["11", "Sikkim"], ["12", "Arunachal Pradesh"],
  ["13", "Nagaland"], ["14", "Manipur"], ["15", "Mizoram"], ["16", "Tripura"],
  ["17", "Meghalaya"], ["18", "Assam"], ["19", "West Bengal"], ["20", "Jharkhand"],
  ["21", "Odisha"], ["22", "Chhattisgarh"], ["23", "Madhya Pradesh"], ["24", "Gujarat"],
  ["26", "Dadra and Nagar Haveli and Daman and Diu"], ["27", "Maharashtra"], ["29", "Karnataka"],
  ["30", "Goa"], ["31", "Lakshadweep"], ["32", "Kerala"], ["33", "Tamil Nadu"],
  ["34", "Puducherry"], ["35", "Andaman and Nicobar Islands"], ["36", "Telangana"],
  ["37", "Andhra Pradesh"], ["38", "Ladakh"],
] as const;

const gstStateCodes = new Set<string>(gstStates.map(([code]) => code));

type BillingViewProps = {
  role: UserRole;
  memberName: string;
  collections: WorkspaceCollection[];
  onSessionExpired: () => Promise<void>;
};

type Notice = {tone: "warning" | "error"; message: string};

function requestMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error ? error.message : "The billing service could not complete this request.";
}

const billingErrorCopy: Record<string, string> = {
  INVALID_PAYMENT_SIGNATURE: "Secure payment validation failed. The callback was rejected and the order was not changed.",
  PAYMENT_ORDER_MISMATCH: "The provider callback belongs to a different order. Nothing was confirmed for this order.",
  PAYMENT_VERIFICATION_FAILED: "Razorpay has not confirmed a captured payment matching this order.",
  ORDER_ALREADY_PAID: "This order is already linked to a different payment. Do not attempt another payment for it.",
  ORDER_STATE_CONFLICT: "The order changed while payment was being confirmed. Refresh it before taking another action.",
  PAYMENT_PROVIDER_UNAVAILABLE: "Razorpay confirmation is temporarily unavailable. Avoid creating another order until this one is refreshed.",
  PAYMENT_PROVIDER_ERROR: "Razorpay could not confirm this payment right now. Avoid creating another order until this one is refreshed.",
  CHECKOUT_UNAVAILABLE: "Secure checkout is not configured right now. No payment can be started.",
  PLAN_NOT_AVAILABLE_FOR_ROLE: "This plan is not available for the signed-in account role.",
  VERIFIED_DEALER_PROFILE_REQUIRED: "A verified dealer profile is required before purchasing Dealer Pro.",
  TARGET_REQUIRED: "Select an eligible record before continuing.",
  TARGET_NOT_ALLOWED: "This plan does not accept a target record.",
  ELIGIBLE_TARGET_NOT_FOUND: "The selected record is no longer eligible for this plan. Refresh the workspace and choose another.",
  IDEMPOTENCY_KEY_REUSED: "This checkout request changed after it was started. Review the details and try again.",
};

function billingRequestMessage(error: unknown) {
  if (error instanceof ApiClientError && error.code && billingErrorCopy[error.code]) {
    return billingErrorCopy[error.code];
  }
  return requestMessage(error);
}

function money(paise: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

function dateTime(value?: string | null) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {dateStyle: "medium", timeStyle: "short"}).format(parsed);
}

function humanLabel(value?: string | null) {
  if (!value) return "Not recorded";
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function eventCopy(eventType: string) {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("refund")) return {label: "Refund processed", tone: styles.timelineRefund};
  if (normalized.includes("fail")) return {label: "Payment failed", tone: styles.timelineDanger};
  if (normalized.includes("captur") || normalized.includes("verified") || normalized === "order.paid") {
    return {label: normalized.includes("verified") ? "Payment verified" : "Payment captured", tone: styles.timelineGood};
  }
  if (normalized.includes("authoriz") || normalized.includes("pending")) {
    return {label: "Payment pending", tone: styles.timelinePending};
  }
  return {label: humanLabel(eventType), tone: styles.timelineNeutral};
}

function statusTone(status: OrderStatus) {
  if (status === "CAPTURED") return styles.statusGood;
  if (status === "PAYMENT_PENDING" || status === "CREATING") return styles.statusPending;
  if (status === "FAILED") return styles.statusDanger;
  return styles.statusNeutral;
}

function targetOptions(plan: BillingPlan | undefined, collections: WorkspaceCollection[]) {
  if (!plan?.targetKind) return [];
  if (plan.targetKind === "LISTING") return collections.filter(c => (plan.purpose !== "PROPERTY_FEATURE" || c.key === "properties") && (!plan.excludeProperties || c.key !== "properties")).flatMap(({key, items}) => items.filter(({status}) => canPayToFeature(key, status)));
  const key = targetCollections[plan.targetKind];
  const items = collections.find((collection) => collection.key === key)?.items ?? [];
  if (plan.targetKind === "JOB") return items.filter((item) => item.status === "PUBLISHED");
  return items.filter((item) => ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "ACTIVE", "PAUSED"].includes(item.status));
}

function invoiceHref(invoiceId: string) {
  return `/api/v1/invoices/${encodeURIComponent(invoiceId)}/download`;
}

export function BillingView({role, memberName, collections, onSessionExpired}: BillingViewProps) {
  const t = useTranslations("Site");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = role === "ADMIN";

  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [ordersState, setOrdersState] = useState<"loading" | "ready" | "error">("loading");
  const [ordersError, setOrdersError] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [ordersAttempt, setOrdersAttempt] = useState(0);

  const [statusFilter, setStatusFilter] = useState(searchParams.get("billingStatus") ?? "ALL");
  const [planFilter, setPlanFilter] = useState(searchParams.get("billingPlan") ?? "ALL");
  const [query, setQuery] = useState(searchParams.get("billingQuery") ?? "");
  const selectedOrderId = searchParams.get("order");
  const requestedTarget = searchParams.get("feature");

  const [selectedPlanId, setSelectedPlanId] = useState(searchParams.get("plan") ?? (requestedTarget ? listingFeaturePriceId : ""));
  const [targetId, setTargetId] = useState(requestedTarget ?? "");
  const [featureState, setFeatureState] = useState<{targetId: string; payment: FeaturePayment | null} | null>(null);
  const [billing, setBilling] = useState<BillingSnapshot>({
    legalName: memberName,
    billingEmail: "",
    billingMobile: "",
    gstin: "",
    addressLine1: "",
    addressLine2: "",
    locality: "",
    city: "",
    stateCode: "",
    postalCode: "",
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const ordersPanelRef = useRef<HTMLElement>(null);
  const confirmedOrderIdRef = useRef<string | null>(null);
  const checkoutAttemptRef = useRef<{fingerprint: string; key: string} | null>(null);
  const addressEditRevisionRef = useRef({city: 0, stateCode: 0, locality: 0});
  const pincodeBaselineRef = useRef({pincode: "", city: 0, stateCode: 0, locality: 0, localityValue: ""});
  const autoFilledAddressRef = useRef<{city?: string; stateCode?: string; locality?: string}>({});

  const applyPincodeLocation = useCallback((location: PincodeLocation) => {
    const baseline = pincodeBaselineRef.current;
    if (baseline.pincode !== location.pincode) return;
    const fillCity = addressEditRevisionRef.current.city === baseline.city && location.city.trim().length > 0;
    const fillState = addressEditRevisionRef.current.stateCode === baseline.stateCode
      && Boolean(location.stateCode && gstStateCodes.has(location.stateCode));
    const suggestedArea = (location.area ?? location.areas[0] ?? "").trim();
    const fillLocality = addressEditRevisionRef.current.locality === baseline.locality
      && baseline.localityValue.trim().length === 0
      && suggestedArea.length > 0;
    if (!fillCity && !fillState && !fillLocality) return;
    const values = {
      ...(fillCity ? {city: location.city} : {}),
      ...(fillState && location.stateCode ? {stateCode: location.stateCode} : {}),
      ...(fillLocality ? {locality: suggestedArea} : {}),
    };
    autoFilledAddressRef.current = values;

    setBilling((current) => current.postalCode === location.pincode ? {...current, ...values} : current);
    setFieldErrors((current) => {
      const next = {...current};
      if (fillCity) delete next.city;
      if (fillState) delete next.stateCode;
      if (fillLocality) delete next.locality;
      return next;
    });
  }, []);

  const pincodeLookup = usePincodeLookup(billing.postalCode, {onResolved: applyPincodeLocation});
  const areaSuggestions = useMemo(() => {
    if (pincodeLookup.status !== "resolved" || !pincodeLookup.location) return [];
    return Array.from(new Set([
      pincodeLookup.location.area,
      ...pincodeLookup.location.areas,
    ].map((area) => area?.trim()).filter((area): area is string => Boolean(area))));
  }, [pincodeLookup.location, pincodeLookup.status]);

  const replaceBillingQuery = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", "billing");
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(`${pathname}?${next.toString()}`, {scroll: false});
  }, [pathname, router, searchParams]);

  const handleUnauthorised = useCallback(async (error: unknown) => {
    if (error instanceof ApiClientError && error.status === 401) {
      await onSessionExpired();
      return true;
    }
    return false;
  }, [onSessionExpired]);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError("");
    void apiRequest<BillingCatalog>("/catalog/plans", {signal: controller.signal})
      .then((result) => setCatalog(result))
      .catch(async (error: unknown) => {
        if (controller.signal.aborted || await handleUnauthorised(error)) return;
        setCatalogError(requestMessage(error));
      });
    return () => controller.abort();
  }, [catalogAttempt, ordersAttempt, handleUnauthorised]);

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({limit: "25"});
    if (statusFilter !== "ALL") parameters.set("status", statusFilter);
    setOrdersState("loading");
    setOrdersError("");
    void apiRequest<OrdersPage>(`/orders?${parameters.toString()}`, {signal: controller.signal})
      .then(async (result) => {
        const confirmedOrderId = confirmedOrderIdRef.current;
        const items = [...result.items];
        if (confirmedOrderId && statusFilter === "ALL" && !items.some((order) => order.id === confirmedOrderId)) {
          const confirmedOrder = await apiRequest<OrderDetail>(`/orders/${encodeURIComponent(confirmedOrderId)}`, {signal: controller.signal});
          items.unshift(confirmedOrder);
        }
        if (controller.signal.aborted) return;
        setOrders(items);
        setNextCursor(result.nextCursor);
        setOrdersState("ready");
      })
      .catch(async (error: unknown) => {
        if (controller.signal.aborted || await handleUnauthorised(error)) return;
        setOrdersError(requestMessage(error));
        setOrdersState("error");
      });
    return () => controller.abort();
  }, [handleUnauthorised, ordersAttempt, statusFilter]);

  useEffect(() => {
    if (!catalog) return;
    if (!catalog?.plans.length) {
      setSelectedPlanId("");
      return;
    }
    if (!catalog.plans.some((plan) => plan.priceId === selectedPlanId)) {
      const featurePlan = requestedTarget && catalog.plans.find(plan => plan.targetKind === "LISTING" && targetOptions(plan, collections).some(item => item.id === requestedTarget));
      setSelectedPlanId(featurePlan ? featurePlan.priceId : catalog.plans[0].priceId);
    }
  }, [catalog, selectedPlanId, requestedTarget, collections]);

  const selectedPlan = catalog?.plans.find((plan) => plan.priceId === selectedPlanId);
  const eligibleTargets = useMemo(() => targetOptions(selectedPlan, collections), [collections, selectedPlan]);
  const verifiedDealerProfile = collections.find((collection) => collection.key === "dealerProfiles")?.items.some((item) => item.status === "VERIFIED") === true;
  const selectedPlanBlocked = selectedPlan?.priceId === "DEALER_PRO_30D" && !verifiedDealerProfile;
  const featureTarget = selectedPlan?.targetKind === "LISTING" ? targetId : "";
  const currentFeature = featureState?.targetId === featureTarget ? featureState.payment : null;
  const featureInvoiceId = currentFeature?.active ? currentFeature.invoice?.id : null;
  const checkingFeature = Boolean(featureTarget && featureState?.targetId !== featureTarget);

  useEffect(() => {
    if (!featureTarget) return;
    const controller = new AbortController();
    void apiRequest<FeaturePayment>(`/feature-payments/${encodeURIComponent(featureTarget)}`, {signal: controller.signal})
      .then((payment) => {if (!controller.signal.aborted) setFeatureState({targetId: featureTarget, payment});},
        () => {if (!controller.signal.aborted) setFeatureState({targetId: featureTarget, payment: null});});
    return () => controller.abort();
  }, [featureTarget, ordersAttempt]);

  useEffect(() => {
    if (!catalog) return;
    if (!selectedPlan?.requiresTarget) {
      setTargetId("");
      return;
    }
    if (targetId && !eligibleTargets.some((item) => item.id === targetId)) setTargetId("");
  }, [catalog, eligibleTargets, selectedPlan, targetId]);

  const planOptions = useMemo(() => Array.from(new Map(orders.map((order) => [order.priceId, order.planName])).entries()), [orders]);
  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (planFilter !== "ALL" && order.priceId !== planFilter) return false;
      if (!normalized) return true;
      return [order.id, order.planName, order.priceId, order.targetId, order.providerOrderId, order.invoiceId]
        .some((value) => value?.toLowerCase().includes(normalized));
    });
  }, [orders, planFilter, query]);

  function changeStatusFilter(value: string) {
    confirmedOrderIdRef.current = null;
    setStatusFilter(value);
    replaceBillingQuery({billingStatus: value === "ALL" ? null : value, order: null});
  }

  function changePlanFilter(value: string) {
    confirmedOrderIdRef.current = null;
    setPlanFilter(value);
    replaceBillingQuery({billingPlan: value === "ALL" ? null : value});
  }

  function changeQuery(value: string) {
    confirmedOrderIdRef.current = null;
    setQuery(value);
    replaceBillingQuery({billingQuery: value.trim() || null});
  }

  function openOrder(orderId: string) {
    replaceBillingQuery({order: orderId});
  }

  function closeOrder() {
    replaceBillingQuery({order: null});
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const parameters = new URLSearchParams({limit: "25", cursor: nextCursor});
    if (statusFilter !== "ALL") parameters.set("status", statusFilter);
    try {
      const result = await apiRequest<OrdersPage>(`/orders?${parameters.toString()}`);
      setOrders((current) => [...current, ...result.items.filter((next) => !current.some((item) => item.id === next.id))]);
      setNextCursor(result.nextCursor);
    } catch (error) {
      if (!await handleUnauthorised(error)) setOrdersError(requestMessage(error));
    } finally {
      setLoadingMore(false);
    }
  }

  function refreshOrders() {
    setOrdersAttempt((current) => current + 1);
  }

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = {...current};
      delete next[field];
      return next;
    });
  }

  function showFieldErrors(form: HTMLFormElement, errors: Record<string, string>) {
    setFieldErrors(errors);
    if (Object.keys(errors).length) focusInvalidControl(form);
  }

  function updateBilling(field: keyof BillingSnapshot, value: string) {
    if (field === "city" || field === "stateCode" || field === "locality") {
      addressEditRevisionRef.current[field] += 1;
      delete autoFilledAddressRef.current[field];
    }
    setBilling((current) => ({...current, [field]: field === "stateCode" || field === "gstin" ? value.toUpperCase() : value}));
    clearFieldError(field);
    if (field === "stateCode") clearFieldError("gstin");
  }

  function updatePincode(value: string) {
    const pincode = value.replace(/\D/g, "").slice(0, 6);
    if (pincode === billing.postalCode) return;
    const previous = autoFilledAddressRef.current;
    const clearsAutoLocality = Boolean(previous.locality && billing.locality === previous.locality);
    autoFilledAddressRef.current = {};
    pincodeBaselineRef.current = {
      pincode,
      city: addressEditRevisionRef.current.city,
      stateCode: addressEditRevisionRef.current.stateCode,
      locality: addressEditRevisionRef.current.locality,
      localityValue: clearsAutoLocality ? "" : billing.locality ?? "",
    };
    updateBilling("postalCode", pincode);
    setBilling((current) => ({
      ...current,
      ...(previous.city && current.city === previous.city ? {city: ""} : {}),
      ...(previous.stateCode && current.stateCode === previous.stateCode ? {stateCode: ""} : {}),
      ...(previous.locality && current.locality === previous.locality ? {locality: ""} : {}),
    }));
  }

  function confirmPayment(order: OrderSummary, message: string) {
    checkoutAttemptRef.current = null;
    confirmedOrderIdRef.current = order.id;
    setNotice(null);
    setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
    setStatusFilter("ALL");
    setPlanFilter("ALL");
    setQuery(order.id);
    replaceBillingQuery({billingStatus: null, billingPlan: null, billingQuery: order.id, order: null});
    toast.success(message, {id: `payment-${order.id}`});
    refreshOrders();
    requestAnimationFrame(() => ordersPanelRef.current?.scrollIntoView({block: "start"}));
  }

  async function verifyCheckout(orderId: string, response: RazorpaySuccess) {
    setNotice({tone: "warning", message: "Checkout returned successfully. Confirming the payment with the server…"});
    try {
      const result = await apiRequest<VerifyResponse>(`/orders/${encodeURIComponent(orderId)}/verify`, {
        method: "POST",
        body: response,
      });
      if (result.order.status !== "CAPTURED" || !result.invoice?.id || !result.entitlement?.id) {
        setNotice({
          tone: "warning",
          message: "The checkout callback was received, but the server did not return a complete captured order, invoice and entitlement. Refresh this order before taking another action.",
        });
        refreshOrders();
        openOrder(result.order.id || orderId);
        return;
      }
      confirmPayment({...result.order, invoiceId: result.invoice.id}, `Payment confirmed. Invoice ${result.invoice.invoiceNumber} is ready.`);
    } catch (error) {
      if (await handleUnauthorised(error)) return;
      setNotice({
        tone: "error",
        message: `Checkout responded, but the server has not confirmed payment. ${billingRequestMessage(error)} Refresh the order before taking another action.`,
      });
      refreshOrders();
      openOrder(orderId);
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function startCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlan || !catalog?.checkoutAvailable || checkoutBusy) return;
    const form = event.currentTarget;
    setNotice(null);
    if (selectedPlanBlocked) {
      setNotice({tone: "error", message: "A verified dealer profile is required before purchasing Dealer Pro."});
      return;
    }
    const fieldIssues: Record<string, string> = {};
    for (const control of form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[name], select[name]")) {
      if (control.disabled) continue;
      const value = control.value.trim();
      if (control.validity.valueMissing || (control.required && !value)) {
        fieldIssues[control.name] = "This field is required.";
      } else if (control instanceof HTMLInputElement && value && control.minLength > 0 && value.length < control.minLength) {
        fieldIssues[control.name] = `Enter at least ${control.minLength} characters.`;
      } else if (!control.validity.valid) {
        fieldIssues[control.name] = control.validationMessage;
      }
    }
    if (selectedPlan.requiresTarget && !targetId) fieldIssues.targetId = "Select an eligible record before continuing.";
    if (!termsAccepted) fieldIssues.termsAccepted = "Accept the billing terms before continuing.";
    if (fieldIssues.postalCode && billing.postalCode) fieldIssues.postalCode = "Enter a valid six-digit Indian PIN code.";
    if (fieldIssues.gstin) fieldIssues.gstin = "Enter a 15-character GSTIN beginning with a two-digit state code.";
    showFieldErrors(form, fieldIssues);
    if (Object.keys(fieldIssues).length) return;

    setCheckoutBusy(true);
    const cleanBilling: BillingSnapshot = {
      legalName: billing.legalName.trim(),
      billingEmail: billing.billingEmail.trim(),
      billingMobile: billing.billingMobile.trim(),
      ...(billing.gstin?.trim() ? {gstin: billing.gstin.trim()} : {}),
      addressLine1: billing.addressLine1.trim(),
      ...(billing.addressLine2?.trim() ? {addressLine2: billing.addressLine2.trim()} : {}),
      ...(billing.locality?.trim() ? {locality: billing.locality.trim()} : {}),
      city: billing.city.trim(),
      stateCode: billing.stateCode.trim().toUpperCase(),
      postalCode: billing.postalCode.trim(),
    };
    const checkoutBody = {
      priceId: selectedPlan.priceId,
      ...(selectedPlan.requiresTarget ? {targetId} : {}),
      billing: cleanBilling,
      termsAccepted: true as const,
    };
    const fingerprint = JSON.stringify(checkoutBody);
    if (checkoutAttemptRef.current?.fingerprint !== fingerprint) {
      checkoutAttemptRef.current = {fingerprint, key: crypto.randomUUID()};
    }

    try {
      const result = await apiRequest<CheckoutResponse>("/checkouts", {
        method: "POST",
        headers: {"Idempotency-Key": checkoutAttemptRef.current.key},
        body: checkoutBody,
      });
      setOrders((current) => [result.order, ...current.filter((order) => order.id !== result.order.id)]);

      if (!result.checkout) {
        if (result.order.status === "CAPTURED") {
          confirmPayment(result.order, result.order.invoiceId ? "Payment is already confirmed and its invoice is ready." : "Payment is already confirmed. Open the order to check the invoice status.");
          setCheckoutBusy(false);
          return;
        } else if (result.order.status === "CREATING") {
          setNotice({
            tone: "warning",
            message: "This same order is still being reconciled with Razorpay. No checkout window was opened. Refresh this order before retrying; the current request reference will be reused so a second order is not created.",
          });
        } else if (result.order.status === "PAYMENT_PENDING") {
          setNotice({
            tone: "warning",
            message: "This order is pending, but secure checkout details are not available. Refresh it before taking another action; do not create a replacement order.",
          });
        } else {
          checkoutAttemptRef.current = null;
          setNotice({tone: "error", message: `Secure checkout could not be opened because this order is ${statusCopy[result.order.status].label.toLowerCase()}. Review its detail before trying again.`});
        }
        refreshOrders();
        openOrder(result.order.id);
        setCheckoutBusy(false);
        return;
      }

      const Razorpay = await loadRazorpayCheckout();
      let callbackReceived = false;
      let paymentFailed = false;
      const checkout = new Razorpay({
        key: result.checkout.keyId,
        amount: result.checkout.amount,
        currency: result.checkout.currency,
        name: "ThePropertyPillar",
        description: selectedPlan.name,
        order_id: result.checkout.orderId,
        prefill: {name: cleanBilling.legalName, email: cleanBilling.billingEmail, contact: cleanBilling.billingMobile},
        theme: {color: "#cc3038"},
        handler: (response) => {
          callbackReceived = true;
          void verifyCheckout(result.order.id, response);
        },
        modal: {
          ondismiss: () => {
            if (callbackReceived) return;
            setCheckoutBusy(false);
            if (!paymentFailed) setNotice({tone: "warning", message: "Checkout was closed. The order remains pending until payment is confirmed."});
            refreshOrders();
          },
        },
      });
      checkout.on("payment.failed", () => {
        paymentFailed = true;
        setNotice({tone: "error", message: "Razorpay did not complete the payment. The server will keep the order pending or mark it failed."});
        refreshOrders();
      });
      checkout.open();
    } catch (error) {
      if (!await handleUnauthorised(error)) {
        const names = ["priceId", ...Array.from(form.elements).map((element) => element.getAttribute("name") ?? "")];
        const {fields, general} = splitFieldErrors(error instanceof ApiClientError ? error.fieldErrors : {}, names);
        if (error instanceof ApiClientError && selectedPlan.requiresTarget && (error.code === "TARGET_REQUIRED" || error.code === "ELIGIBLE_TARGET_NOT_FOUND")) {
          fields.targetId = billingRequestMessage(error);
        }
        if (error instanceof ApiClientError && (error.code === "PLAN_NOT_FOUND" || error.code === "PLAN_NOT_AVAILABLE_FOR_ROLE")) {
          fields.priceId = billingRequestMessage(error);
        }
        showFieldErrors(form, fields);
        if (general || !Object.keys(fields).length) setNotice({tone: "error", message: general || billingRequestMessage(error)});
      }
      setCheckoutBusy(false);
    }
  }

  const capturedCount = orders.filter((order) => order.status === "CAPTURED").length;
  const pendingCount = orders.filter((order) => order.status === "PAYMENT_PENDING" || order.status === "CREATING").length;
  const invoicedCount = orders.filter((order) => Boolean(order.invoiceId)).length;
  const pincodeFormatInvalid = billing.postalCode.length > 0
    && (billing.postalCode.startsWith("0") || (billing.postalCode.length === 6 && !indianPincodePattern.test(billing.postalCode)));
  const pincodeFeedback = billing.postalCode.length === 0
    ? "Enter a 6-digit PIN to look up the city and GST state."
    : pincodeFormatInvalid
      ? "A valid Indian PIN code cannot begin with zero."
      : billing.postalCode.length < 6
        ? `Enter ${6 - billing.postalCode.length} more ${billing.postalCode.length === 5 ? "digit" : "digits"} to look up this address.`
        : pincodeLookup.status === "resolved"
          ? `${pincodeLookup.message}${pincodeLookup.location?.stateCode ? " You can edit the city and state." : " Select the GST state manually."}`
          : pincodeLookup.message || "Checking this PIN code…";
  const pincodeFeedbackTone = pincodeFormatInvalid || pincodeLookup.status === "not-found" || pincodeLookup.status === "error"
    ? styles.lookupError
    : pincodeLookup.status === "resolved"
      ? styles.lookupSuccess
      : styles.lookupNeutral;

  return (
    <section className={styles.billing} aria-labelledby="billing-title">
      <header className={styles.hero}>
        <div>
          <h1 id="billing-title">{t("billing")}</h1>
          <span>{isAdmin ? "Review workspace orders, payment status and issued invoices." : "Pay for eligible plans and download your invoices here."}</span>
        </div>
        <button className={styles.refreshButton} disabled={ordersState === "loading"} onClick={refreshOrders} type="button">
          <RefreshCcw className={ordersState === "loading" ? styles.spin : ""} size={16} /> Refresh
        </button>
      </header>

      {isAdmin && <PlanAdmin/>}
      {!isAdmin && catalog?.balance && (["OWNER","DEALER","BUILDER"].includes(role) || catalog.balance.active.length > 0) && <section className={styles.plansPanel}>
        {["OWNER","DEALER","BUILDER"].includes(role) && <><h2>Property posting credits</h2><p><strong>{catalog.balance.remaining} available</strong> &middot; {catalog.balance.freeRemaining} free remaining &middot; {catalog.balance.posted} properties submitted</p></>}
        {catalog.balance.active.map(grant=><p key={grant.orderId}><strong>{grant.name}</strong> &middot; Expires {dateTime(grant.endsAt)}{grant.type==="POSTING_CREDITS" && ` / ${grant.remaining} credits left`}</p>)}
      </section>}
      {ordersState === "loading" ? <SkeletonStatus className={styles.metrics} label="Loading billing summary">
        {[0, 1, 2, 3].map((index) => <div className={styles.metricSkeleton} aria-hidden="true" key={index}><Skeleton /><Skeleton /></div>)}
      </SkeletonStatus> : ordersState === "ready" && <div className={styles.metrics} aria-label="Loaded billing summary">
        <div><span><ReceiptIndianRupee size={18} /></span><strong>{orders.length}</strong><small>Orders loaded</small></div>
        <div><span><CheckCircle2 size={18} /></span><strong>{capturedCount}</strong><small>Captured</small></div>
        <div><span><Clock3 size={18} /></span><strong>{pendingCount}</strong><small>Pending confirmation</small></div>
        <div><span><FileText size={18} /></span><strong>{invoicedCount}</strong><small>Invoices ready</small></div>
      </div>}

      {notice ? (
        <div className={`${styles.notice} ${styles[`notice_${notice.tone}`]}`} role={notice.tone === "error" ? "alert" : "status"}>
          <CircleAlert size={18} />
          <span>{notice.message}</span>
          <button aria-label="Dismiss message" onClick={() => setNotice(null)} type="button"><X size={15} /></button>
        </div>
      ) : null}

      {!isAdmin ? (
        <div className={styles.purchaseGrid}>
          <section className={styles.plansPanel} aria-labelledby="plans-title">
            <div className={styles.sectionHeading}>
              <div><p>Available for your role</p><h2 id="plans-title">Plans</h2></div>
              <Sparkles size={20} aria-hidden="true" />
            </div>
            {catalogError ? (
              <ErrorCard message={catalogError} onRetry={() => setCatalogAttempt((current) => current + 1)} />
            ) : !catalog ? (
              <LoadingCard label="Loading plans…" />
            ) : catalog.plans.length === 0 ? (
              <div className={styles.emptyCompact}><ShieldCheck size={24} /><strong>No paid plan is required for this role</strong><p>Your payment and invoice history remains available below.</p></div>
            ) : (
              <div className={styles.planList}>
                {catalog.plans.map((plan) => {
                  const active = plan.priceId === selectedPlanId;
                  return (
                    <button aria-pressed={active}
                      aria-describedby={active && fieldErrors.priceId ? "billing-plan-error" : undefined}
                      className={active ? styles.planActive : ""} key={plan.priceId} onClick={() => {setSelectedPlanId(plan.priceId); setTargetId(""); clearFieldError("targetId"); clearFieldError("priceId"); setNotice(null);}} type="button">
                      <span className={styles.planIcon}>{plan.targetKind === "JOB" ? <BadgeCheck size={19} /> : <Sparkles size={19} />}</span>
                      <span><strong>{plan.name}</strong><small>{plan.description}</small><em>{plan.entitlementDays} days{Boolean(plan.postingCredits) && ` / ${plan.postingCredits} properties`}</em></span>
                      <span className={styles.planPrice}><strong>{money(plan.totalPaise, plan.currency)}</strong><small>incl. tax</small></span>
                    </button>
                  );
                })}
              </div>
            )}
            {fieldErrors.priceId && <small className={styles.fieldError} id="billing-plan-error" role="alert">{fieldErrors.priceId}</small>}
            {catalog && !catalog.checkoutAvailable ? (
              <div className={styles.checkoutUnavailable}><CircleAlert size={17} /><span><strong>Checkout unavailable</strong> Payment settings are not configured. No payment can be started right now.</span></div>
            ) : null}
          </section>

          <section className={styles.checkoutPanel} aria-labelledby="checkout-title">
            <div className={styles.sectionHeading}>
              <div><p>Secure order</p><h2 id="checkout-title">Billing details</h2></div>
              <CreditCard size={20} aria-hidden="true" />
            </div>
            {selectedPlan?.purpose && <div className={styles.orderSummary}><div><strong>{selectedPlan.name}</strong>
              <a href={pathname.replace(/\/dashboard\/?$/, "/plans/")+encodeURIComponent(selectedPlan.priceId)}>Plan details</a></div>
              {!!selectedPlan.highlights?.length && <ul>{selectedPlan.highlights.map(h=><li key={h}>{h}</li>)}</ul>}
              {selectedPlan.aboutHtml && <div dangerouslySetInnerHTML={{__html:selectedPlan.aboutHtml}}/>}</div>}
            {featureInvoiceId ? <div className={styles.emptyCompact}>
              <FileText size={24} /><strong>Featuring invoice</strong>
              <a className={styles.invoiceLink} href={invoiceHref(featureInvoiceId)} download><Download size={15} /> Download invoice</a>
              <label>Listing to feature<select value={targetId} onChange={(event) => {setTargetId(event.target.value); setNotice(null);}}>
                <option value="">Choose another listing</option>
                {eligibleTargets.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select></label>
            </div> : selectedPlan ? (
              <form className={styles.checkoutForm} noValidate onSubmit={startCheckout}>
                <div className={styles.orderSummary}>
                  <div><strong>{selectedPlan.name}</strong><span>{selectedPlan.entitlementDays}-day entitlement</span></div>
                  <dl>
                    <div><dt>Base</dt><dd>{money(selectedPlan.basePaise, selectedPlan.currency)}</dd></div>
                    <div><dt>Tax</dt><dd>{money(selectedPlan.taxPaise, selectedPlan.currency)}</dd></div>
                    <div><dt>Total</dt><dd>{money(selectedPlan.totalPaise, selectedPlan.currency)}</dd></div>
                  </dl>
                </div>


                {selectedPlanBlocked ? (
                  <div className={`${styles.eligibilityWarning} ${styles.wideField}`}><CircleAlert size={16} /><span>A verified dealer profile is required before this plan can be purchased.</span></div>
                ) : null}

                {selectedPlan.requiresTarget ? (
                  <BillingField className={styles.wideField} error={fieldErrors.targetId} label={selectedPlan.targetKind === "LISTING" ? "Listing to feature" : selectedPlan.targetKind === "JOB" ? "Job to feature" : "Ad campaign"} name="targetId" required>
                    <select aria-describedby={eligibleTargets.length === 0 ? "billing-target-help" : undefined} disabled={eligibleTargets.length === 0} onChange={(event) => {setTargetId(event.target.value); clearFieldError("targetId");}} required value={targetId}>
                      <option value="">Select an eligible record</option>
                      {eligibleTargets.map((item) => <option key={item.id} value={item.id}>{item.title} — {item.status.replaceAll("_", " ")}</option>)}
                    </select>
                    {eligibleTargets.length === 0 ? <small id="billing-target-help">{selectedPlan.targetKind === "LISTING" ? "Submit a listing first." : "Create an eligible record before purchasing this plan."}</small> : null}
                  </BillingField>
                ) : null}
                {selectedPlan.targetKind === "LISTING" && <p className={`${styles.securityCopy} ${styles.wideField}`}>One payment covers {selectedPlan.entitlementDays} days from payment confirmation. The listing is featured while it is publicly visible.</p>}

                <BillingField error={fieldErrors.legalName} label="Legal billing name" name="legalName" required>
                  <input autoComplete="name" maxLength={160} minLength={2} onChange={(event) => updateBilling("legalName", event.target.value)} required value={billing.legalName} />
                </BillingField>
                <BillingField error={fieldErrors.billingEmail} label="Billing email" name="billingEmail" required>
                  <input autoComplete="email" maxLength={254} onChange={(event) => updateBilling("billingEmail", event.target.value)} required type="email" value={billing.billingEmail} />
                </BillingField>
                <BillingField error={fieldErrors.billingMobile} label="Billing mobile" name="billingMobile" required>
                  <PhoneInput name="billingMobile" aria-label="Billing mobile" onChange={(value) => updateBilling("billingMobile", value)} required value={billing.billingMobile} />
                </BillingField>
                <BillingField error={fieldErrors.gstin} label="GSTIN (optional)" name="gstin">
                  <input autoCapitalize="characters" maxLength={15} onChange={(event) => updateBilling("gstin", event.target.value)} pattern="[0-9]{2}[A-Za-z0-9]{13}" placeholder="15-character GSTIN" value={billing.gstin ?? ""} />
                </BillingField>
                <BillingField className={styles.wideField} error={fieldErrors.addressLine1} label="Address line 1" name="addressLine1" required>
                  <input autoComplete="address-line1" maxLength={240} minLength={3} onChange={(event) => updateBilling("addressLine1", event.target.value)} required value={billing.addressLine1} />
                </BillingField>
                <BillingField className={styles.wideField} error={fieldErrors.addressLine2} label="Address line 2 (optional)" name="addressLine2">
                  <input autoComplete="address-line2" maxLength={240} onChange={(event) => updateBilling("addressLine2", event.target.value)} value={billing.addressLine2 ?? ""} />
                </BillingField>
                <BillingField className={styles.pincodeField} error={fieldErrors.postalCode} label="PIN code" name="postalCode" required>
                  <input aria-describedby={fieldErrors.postalCode ? undefined : "billing-pincode-feedback"} aria-invalid={pincodeFormatInvalid || undefined} autoComplete="postal-code" inputMode="numeric" onChange={(event) => updatePincode(event.target.value)} pattern="[1-9][0-9]{5}" placeholder="6-digit PIN" required value={billing.postalCode} />
                  {!fieldErrors.postalCode ? <small aria-live="polite" className={`${styles.lookupFeedback} ${pincodeFeedbackTone}`} id="billing-pincode-feedback" role="status">
                    {pincodeLookup.status === "loading" ? <LoaderCircle className={styles.spin} size={13} /> : pincodeLookup.status === "resolved" ? <CheckCircle2 size={13} /> : pincodeFormatInvalid || pincodeLookup.status === "not-found" || pincodeLookup.status === "error" ? <CircleAlert size={13} /> : <MapPin size={13} />}
                    <span>{pincodeFeedback}</span>
                  </small> : null}
                </BillingField>
                <BillingField error={fieldErrors.stateCode} label="GST state code" name="stateCode" required>
                  <select autoComplete="address-level1" onChange={(event) => updateBilling("stateCode", event.target.value)} required value={billing.stateCode}>
                    <option value="">Select state / union territory</option>
                    {gstStates.map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
                  </select>
                </BillingField>
                <BillingField error={fieldErrors.city} label="City" name="city" required>
                  <input autoComplete="address-level2" maxLength={120} minLength={2} onChange={(event) => updateBilling("city", event.target.value)} required value={billing.city} />
                </BillingField>
                <BillingField className={styles.wideField} error={fieldErrors.locality} label="Area (optional)" name="locality">
                  <input
                    aria-describedby="billing-area-feedback"
                    autoComplete="address-level3"
                    list="billing-area-suggestions"
                    maxLength={160}
                    onChange={(event) => updateBilling("locality", event.target.value)}
                    placeholder="Neighbourhood, sector or locality"
                    value={billing.locality ?? ""}
                  />
                  <datalist id="billing-area-suggestions">
                    {areaSuggestions.map((area) => <option key={area} value={area} />)}
                  </datalist>
                  <small aria-live="polite" className={styles.areaHint} id="billing-area-feedback">
                    {pincodeLookup.status === "resolved"
                      ? areaSuggestions.length > 1
                        ? `${areaSuggestions.length} areas found for this PIN. Choose one or type another area.`
                        : areaSuggestions.length === 1
                          ? "An area was suggested from the PIN. You can replace it with your exact locality."
                          : "No area suggestion was returned. Enter it manually if needed."
                      : "Enter a PIN first for area suggestions, or type the area manually."}
                  </small>
                </BillingField>

                <label className={`${styles.termsField} ${styles.wideField}`}>
                  <input aria-describedby={fieldErrors.termsAccepted ? "billing-terms-error" : undefined} aria-invalid={Boolean(fieldErrors.termsAccepted) || undefined} checked={termsAccepted} name="termsAccepted" onChange={(event) => {setTermsAccepted(event.target.checked); clearFieldError("termsAccepted");}} required type="checkbox" />
                  <span>I confirm this billing snapshot is accurate and accept the payment and entitlement terms for this order.</span>
                  {fieldErrors.termsAccepted ? <small className={styles.fieldError} id="billing-terms-error" role="alert">{fieldErrors.termsAccepted}</small> : null}
                </label>
                <button className={`${styles.payButton} ${styles.wideField}`} disabled={checkoutBusy || checkingFeature || !catalog?.checkoutAvailable || selectedPlanBlocked || (selectedPlan.requiresTarget && !eligibleTargets.length)} type="submit">
                  {checkoutBusy ? <LoaderCircle className={styles.spin} size={17} /> : <CreditCard size={17} />}
                  {checkoutBusy ? "Opening secure checkout…" : `Pay ${money(selectedPlan.totalPaise, selectedPlan.currency)}`}
                </button>
                <p className={`${styles.securityCopy} ${styles.wideField}`}><ShieldCheck size={14} /> Card, UPI and banking details are entered only in Razorpay Checkout. ThePropertyPillar confirms payment on the server before activating any benefit.</p>
              </form>
            ) : (
              <div className={styles.emptyCompact}><CreditCard size={24} /><strong>Select an available plan</strong><p>Its exact amount and billing form will appear here.</p></div>
            )}
          </section>
        </div>
      ) : null}

      <section className={styles.ordersPanel} aria-labelledby="orders-title" ref={ordersPanelRef}>
        <div className={styles.ordersHeader}>
          <h2 id="orders-title">Orders &amp; invoices</h2>
          <span aria-live="polite">{filteredOrders.length} shown / {orders.length} loaded{nextCursor ? " · more available" : ""}</span>
        </div>
        <div className={styles.filters}>
          <label className={styles.searchField}><Search size={16} /><input aria-label="Search loaded orders" onChange={(event) => changeQuery(event.target.value)} placeholder="Order, plan, target or invoice" value={query} /></label>
          <label><span>Status</span><select onChange={(event) => changeStatusFilter(event.target.value)} value={statusFilter}><option value="ALL">All statuses</option>{orderStatuses.map((status) => <option key={status} value={status}>{statusCopy[status].label}</option>)}</select></label>
          <label><span>Plan</span><select onChange={(event) => changePlanFilter(event.target.value)} value={planFilter}><option value="ALL">All loaded plans</option>{planOptions.map(([priceId, name]) => <option key={priceId} value={priceId}>{name}</option>)}</select></label>
        </div>

        {ordersState === "loading" ? <LoadingCard label="Loading orders…" /> : ordersState === "error" ? (
          <ErrorCard message={ordersError} onRetry={refreshOrders} />
        ) : filteredOrders.length === 0 ? (
          <div className={styles.emptyOrders}><ReceiptIndianRupee size={28} /><h3>No matching orders</h3><p>{orders.length ? "Clear or change the loaded-order filters." : "Server-created orders and issued invoices will appear here."}</p></div>
        ) : (
          <div className={styles.tableWrap}>
            <table aria-label="Payment orders" className={styles.ordersTable} role="table">
              <thead role="rowgroup"><tr role="row"><th scope="col">Order</th><th scope="col">Plan</th><th scope="col">Status</th><th scope="col">Amount</th><th scope="col">Created</th><th scope="col">Invoice</th><th scope="col"><span className={styles.srOnly}>Actions</span></th></tr></thead>
              <tbody role="rowgroup">{filteredOrders.map((order) => (
                <tr key={order.id} role="row">
                  <td data-label="Order" role="cell"><strong>{order.id}</strong>{order.providerOrderId ? <small>{order.providerOrderId}</small> : null}</td>
                  <td data-label="Plan" role="cell"><strong>{order.planName}</strong><small>{order.targetId ? `Target ${order.targetId}` : order.priceId}</small></td>
                  <td data-label="Status" role="cell"><span className={`${styles.status} ${statusTone(order.status)}`}>{statusCopy[order.status].label}</span></td>
                  <td data-label="Amount" role="cell"><strong>{money(order.totalPaise, order.currency)}</strong><small>{money(order.taxPaise, order.currency)} tax</small></td>
                  <td data-label="Created" role="cell"><time dateTime={order.createdAt}>{dateTime(order.createdAt)}</time></td>
                  <td data-label="Invoice" role="cell">{order.invoiceId ? <a className={styles.invoiceLink} download href={invoiceHref(order.invoiceId)}><Download size={14} /> Download</a> : <span className={styles.mutedValue}>Not issued</span>}</td>
                  <td data-label="" role="cell"><button aria-label={`Review order ${order.id}`} className={styles.detailButton} onClick={() => openOrder(order.id)} type="button">Review</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {loadingMore && <LoadingRows label="Loading more orders" count={2} />}
        {nextCursor ? <div className={styles.loadMore}><button disabled={loadingMore} onClick={() => void loadMore()} type="button">Load more orders</button></div> : null}
        {ordersError && ordersState !== "error" ? <p className={styles.inlineError} role="alert">{ordersError}</p> : null}
      </section>

      {selectedOrderId ? (
        <OrderDetailDialog
          key={selectedOrderId}
          isAdmin={isAdmin}
          onClose={closeOrder}
          onOrdersChanged={refreshOrders}
          onSessionExpired={onSessionExpired}
          orderId={selectedOrderId}
        />
      ) : null}
    </section>
  );
}

function BillingField({name, label, error, required = false, className = "", children}: {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [control, ...help] = Children.toArray(children);
  const errorId = error ? `billing-${name}-error` : undefined;
  return (
    <label className={className}>
      <span>{label} {required ? <b>*</b> : null}</span>
      {isValidElement<Pick<React.InputHTMLAttributes<HTMLInputElement>, "aria-describedby" | "aria-invalid" | "name">>(control)
        ? cloneElement(control, {
          name,
          "aria-invalid": error ? true : control.props["aria-invalid"],
          "aria-describedby": [errorId, control.props["aria-describedby"]].filter(Boolean).join(" ") || undefined,
        })
        : control}
      {error ? <small className={styles.fieldError} id={errorId} role="alert">{error}</small> : null}
      {help}
    </label>
  );
}

function LoadingCard({label}: {label: string}) {
  return <LoadingRows label={label} />;
}

function ErrorCard({message, onRetry}: {message: string; onRetry: () => void}) {
  return <div className={styles.errorCard} role="alert"><CircleAlert size={20} /><span><strong>Unable to load</strong><small>{message}</small></span><button onClick={onRetry} type="button">Try again</button></div>;
}

function PaymentTimeline({events, currency}: {events: BillingStatusEvent[]; currency: string}) {
  if (events.length === 0) {
    return <div className={styles.timelineEmpty}><History size={18} /><span><strong>No provider activity yet</strong><small>Status events appear here after Razorpay reports payment or refund activity.</small></span></div>;
  }

  return (
    <ol className={styles.timeline}>
      {events.map((event, index) => {
        const copy = eventCopy(event.eventType);
        const refundKind = event.fullyRefunded === true ? "Full " : event.fullyRefunded === false ? "Partial " : "";
        const details = [
          event.paymentMethod ? `Method: ${humanLabel(event.paymentMethod)}` : null,
          event.refundAmount !== null ? `${refundKind}refund: ${money(event.refundAmount, currency)}` : null,
          event.providerPaymentId ? `Payment ref: ${event.providerPaymentId}` : null,
        ].filter((detail): detail is string => Boolean(detail));
        return (
          <li key={`${event.processedAt}-${event.eventType}-${event.providerPaymentId ?? index}`}>
            <span className={`${styles.timelineDot} ${copy.tone}`} aria-hidden="true" />
            <div>
              <strong>{copy.label}</strong>
              <small>{details.length > 0 ? details.join(" / ") : "No additional provider details were exposed."}</small>
            </div>
            <time dateTime={event.processedAt}>{dateTime(event.processedAt)}</time>
          </li>
        );
      })}
    </ol>
  );
}

function OrderDetailDialog({orderId, isAdmin, onClose, onOrdersChanged, onSessionExpired}: {
  orderId: string;
  isAdmin: boolean;
  onClose: () => void;
  onOrdersChanged: () => void;
  onSessionExpired: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    queueMicrotask(() => closeRef.current?.focus());
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setError("");
    void apiRequest<OrderDetail>(`/orders/${encodeURIComponent(orderId)}`, {signal: controller.signal})
      .then((result) => {setOrder(result); setState("ready");})
      .catch(async (requestError: unknown) => {
        if (controller.signal.aborted) return;
        if (requestError instanceof ApiClientError && requestError.status === 401) {
          await onSessionExpired();
          return;
        }
        setError(requestMessage(requestError));
        setState("error");
      });
    return () => controller.abort();
  }, [attempt, onSessionExpired, orderId]);

  async function refresh() {
    if (!order) {
      setAttempt((current) => current + 1);
      return;
    }
    setRefreshing(true);
    try {
      const result = await apiRequest<OrderDetail>(`/orders/${encodeURIComponent(orderId)}/reconcile`, {
        method: "POST",
      });
      setOrder(result);
      onOrdersChanged();
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        await onSessionExpired();
        return;
      }
      toast.error(billingRequestMessage(requestError));
    } finally {
      setRefreshing(false);
    }
  }

  const invoiceId = order?.invoice?.id ?? order?.invoiceId;

  return (
    <dialog className={styles.detailDialog} data-motion="dialog" onCancel={(event) => {event.preventDefault(); onClose();}} ref={dialogRef}>
      <div className={styles.detailHeader}>
        <div><p>{isAdmin ? "Tenant order review" : "Order detail"}</p><h2>{order?.planName ?? "Billing order"}</h2><span>{orderId}</span></div>
        <button aria-label="Close order detail" onClick={onClose} ref={closeRef} type="button"><X size={19} /></button>
      </div>
      <div className={styles.detailBody}>
        {state === "loading" ? <LoadingCard label="Loading order detail…" /> : state === "error" ? <ErrorCard message={error} onRetry={refresh} /> : order ? (
          <>
            <section className={styles.detailStatus}>
              <span className={`${styles.status} ${statusTone(order.status)}`}>{statusCopy[order.status].label}</span>
              <div><strong>{statusCopy[order.status].description}</strong><small>Last checked from the billing server now.</small></div>
              <button disabled={refreshing} onClick={refresh} type="button"><RefreshCcw size={15} /> {refreshing ? "Checking…" : "Refresh"}</button>
            </section>

            <section className={styles.detailSection}>
              <div className={styles.detailSectionHeading}><h3>Order snapshot</h3><ReceiptIndianRupee size={17} /></div>
              <dl className={styles.detailGrid}>
                <div><dt>Plan</dt><dd>{order.planName}</dd></div>
                <div><dt>Price ID</dt><dd>{order.priceId}</dd></div>
                <div><dt>Target</dt><dd>{order.targetId ?? "No target required"}</dd></div>
                <div><dt>Created</dt><dd>{dateTime(order.createdAt)}</dd></div>
                 <div><dt>Payment method</dt><dd>{humanLabel(order.paymentMethod)}</dd></div>
                 <div><dt>Provider payment</dt><dd>{order.providerPaymentId ?? "Not assigned"}</dd></div>
                <div><dt>Base</dt><dd>{money(order.basePaise, order.currency)}</dd></div>
                <div><dt>Tax</dt><dd>{money(order.taxPaise, order.currency)}</dd></div>
                <div className={styles.detailWide}><dt>Total</dt><dd>{money(order.totalPaise, order.currency)}</dd></div>
              </dl>
            </section>

             {order.failure ? (
               <section className={styles.failureCard} role="note">
                 <CircleAlert size={19} />
                 <div>
                   <strong>{order.failure.description ?? "The payment provider reported an issue with this order."}</strong>
                   <small>{order.failure.code ? `Server reason: ${humanLabel(order.failure.code)}` : "No provider reason code was exposed."}</small>
                 </div>
               </section>
             ) : null}

            <section className={styles.detailSection}>
              <div className={styles.detailSectionHeading}><h3>Billing identity</h3><ShieldCheck size={17} /></div>
              <dl className={styles.detailGrid}>
                <div><dt>Legal name</dt><dd>{order.billing.legalName}</dd></div>
                <div><dt>Billing email</dt><dd>{order.billing.billingEmail}</dd></div>
                <div><dt>Mobile</dt><dd>{order.billing.billingMobile}</dd></div>
                <div><dt>GSTIN</dt><dd>{order.billing.gstin ?? "Not supplied"}</dd></div>
                <div className={styles.detailWide}><dt>Address</dt><dd>{[order.billing.addressLine1, order.billing.addressLine2, order.billing.locality, order.billing.city, order.billing.stateCode, order.billing.postalCode].filter(Boolean).join(", ")}</dd></div>
              </dl>
            </section>

            {order.entitlement ? (
              <section className={styles.detailSection}>
                <div className={styles.detailSectionHeading}><h3>Entitlement</h3><BadgeCheck size={17} /></div>
                <dl className={styles.detailGrid}>
                  <div><dt>Type</dt><dd>{order.entitlement.type.replaceAll("_", " ")}</dd></div>
                  <div><dt>Status</dt><dd>{order.entitlement.status.replaceAll("_", " ")}</dd></div>
                  <div><dt>Starts</dt><dd>{dateTime(order.entitlement.startsAt)}</dd></div>
                  <div><dt>Ends</dt><dd>{dateTime(order.entitlement.endsAt)}</dd></div>
                </dl>
              </section>
            ) : null}

             <section className={styles.detailSection}>
               <div className={styles.detailSectionHeading}>
                 <div><h3>Payment activity</h3><small>Newest first / up to 20 server-sanitized events</small></div>
                 <WalletCards size={17} />
               </div>
               <PaymentTimeline currency={order.currency} events={order.statusEvents ?? []} />
             </section>

            <section className={styles.invoiceCard}>
              <span><FileText size={20} /></span>
              <div><strong>{order.invoice?.invoiceNumber ?? (invoiceId ? "Invoice issued" : "Invoice not issued")}</strong><small>{order.invoice ? `Issued ${dateTime(order.invoice.issuedAt)}` : order.status === "CAPTURED" ? "Captured orders should include an invoice. Refresh before contacting support." : "An invoice is issued only after server-confirmed capture."}</small></div>
              {invoiceId ? <a download href={invoiceHref(invoiceId)}><Download size={15} /> Download PDF</a> : null}
            </section>
          </>
        ) : null}
      </div>
    </dialog>
  );
}
