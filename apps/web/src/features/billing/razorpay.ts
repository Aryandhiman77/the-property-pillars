import type {RazorpaySuccess} from "./types";

const razorpayCheckoutUrl = "https://checkout.razorpay.com/v1/checkout.js";

export type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {name: string; email: string; contact: string};
  theme: {color: string};
  handler: (response: RazorpaySuccess) => void;
  modal: {ondismiss: () => void};
};

type RazorpayFailure = {
  error?: {description?: string};
};

export type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", callback: (failure: RazorpayFailure) => void) => void;
};

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let checkoutScript: Promise<RazorpayConstructor> | null = null;

export function loadRazorpayCheckout(): Promise<RazorpayConstructor> {
  if (typeof window === "undefined") return Promise.reject(new Error("Secure checkout is only available in a browser."));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (checkoutScript) return checkoutScript;

  checkoutScript = new Promise<RazorpayConstructor>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${razorpayCheckoutUrl}"]`);
    const script = existing ?? document.createElement("script");

    const loaded = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Secure checkout loaded without an available payment window."));
    };
    const failed = () => {
      checkoutScript = null;
      reject(new Error("Secure checkout could not be loaded. Check your connection and try again."));
    };

    script.addEventListener("load", loaded, {once: true});
    script.addEventListener("error", failed, {once: true});
    if (!existing) {
      script.src = razorpayCheckoutUrl;
      script.async = true;
      script.dataset.propertyPillarCheckout = "true";
      document.head.appendChild(script);
    }
  });

  return checkoutScript;
}
