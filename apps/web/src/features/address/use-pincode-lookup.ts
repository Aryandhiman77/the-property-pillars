"use client";

import {useEffect, useRef, useState} from "react";

import {ApiClientError, apiRequest} from "@/lib/api/client";

export const indianPincodePattern = /^[1-9]\d{5}$/;

export type PincodeLocation = {
  pincode: string;
  city: string;
  state: string;
  stateCode: string | null;
  area: string | null;
  areas: string[];
};

export type PincodeLookupStatus = "idle" | "loading" | "resolved" | "not-found" | "error";

export type PincodeLookupState = {
  status: PincodeLookupStatus;
  location: PincodeLocation | null;
  message: string;
};

type PincodeLookupOptions = {
  debounceMs?: number;
  manualAddress?: boolean;
  onResolved?: (location: PincodeLocation) => void;
};

const idleState: PincodeLookupState = {status: "idle", location: null, message: ""};
type InternalLookupState = PincodeLookupState & {pincode: string};

export function usePincodeLookup(pincode: string, options: PincodeLookupOptions = {}): PincodeLookupState & {retry: () => void} {
  const {debounceMs = 350, manualAddress = true, onResolved} = options;
  const onResolvedRef = useRef(onResolved);
  const [lookup, setLookup] = useState<InternalLookupState>({...idleState, pincode: ""});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onResolvedRef.current = onResolved;
  }, [onResolved]);

  useEffect(() => {
    const normalizedPincode = pincode.trim().replace(/[\s-]/g, "");
    if (!indianPincodePattern.test(normalizedPincode)) {
      setLookup({...idleState, pincode: normalizedPincode});
      return;
    }

    const controller = new AbortController();
    let current = true;
    setLookup({status: "loading", location: null, message: "Checking this PIN code…", pincode: normalizedPincode});

    const timeout = window.setTimeout(() => {
      void apiRequest<PincodeLocation>(`/locations/pincode/${encodeURIComponent(normalizedPincode)}`, {
        signal: controller.signal,
      }).then((location) => {
        if (!current || controller.signal.aborted || location.pincode !== normalizedPincode) return;
        const result = {...location, area: location.area ?? null, areas: location.areas ?? []};
        setLookup({
          status: "resolved",
          location: result,
          message: [result.state, result.city, result.area].filter(Boolean).join(", ") + " found.",
          pincode: normalizedPincode,
        });
        onResolvedRef.current?.(result);
      }).catch((error: unknown) => {
        if (!current || controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        if (error instanceof ApiClientError && error.status === 404) {
          setLookup({
            status: "not-found",
            location: null,
            message: manualAddress ? "PIN code was not found. Enter the state, city and area manually." : "PIN code was not found. Check the six digits.",
            pincode: normalizedPincode,
          });
          return;
        }
        setLookup({
          status: "error",
          location: null,
          message: manualAddress ? "PIN lookup is unavailable. You can enter the address manually." : "PIN lookup is temporarily unavailable.",
          pincode: normalizedPincode,
        });
      });
    }, Math.max(0, debounceMs));

    return () => {
      current = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt, debounceMs, manualAddress, pincode]);

  const state = lookup.pincode === pincode.trim().replace(/[\s-]/g, "") ? lookup : idleState;
  return {...state, retry: () => setAttempt((value) => value + 1)};
}
