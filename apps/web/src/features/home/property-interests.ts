"use client";

import {useEffect} from "react";
import {propertyBudgetTiers, type PropertyBudgetTier} from "@the-property-pillar/contracts";
import type {AuthSession} from "@/features/auth/types";
import {apiRequest} from "@/lib/api/client";

type Place = {kind: "city" | "state" | "locality"; value: string; country?: string; context?: string};
export type PropertyInterest = {
  places: Place[]; intent?: "SALE" | "RENT"; country?: string; currency?: string; minPrice?: number; maxPrice?: number;
  budget?: PropertyBudgetTier;
  propertyIds: string[]; searchedAt: string;
};
const key = "tpp-property-interests";
const route = "/workspace/property-interests";
const retained = 12;
const canonical = (value: string) => value.trim().normalize("NFKD").replace(/\p{Mark}/gu, "").toLowerCase();

export function browserPropertyInterests(): PropertyInterest[] {
  try {
    const values = JSON.parse(localStorage.getItem(key) ?? "[]") as PropertyInterest[];
    return Array.isArray(values) ? values.filter((value) => Array.isArray(value?.places) && Date.parse(value.searchedAt) >= Date.now() - 90 * 86_400_000).slice(0, retained) : [];
  } catch {return [];}
}

export function clearBrowserPropertyInterests() {
  try {localStorage.removeItem(key);} catch {}
}

function signature({places, intent, country, currency, minPrice, maxPrice, budget}: PropertyInterest) {
  return JSON.stringify([places.map(({kind, value, context, country}) => [kind, canonical(value), canonical(context ?? ""), country]).sort(), intent, country, currency, minPrice, maxPrice, ...(budget ? [budget] : [])]);
}

export function rememberPropertySearch(params: URLSearchParams, items: {id: string; data: Record<string, unknown>}[], session: AuthSession | null) {
  const country = params.get("country") || undefined;
  const currency = params.get("currency") || undefined;
  const intent = params.get("intent");
  const amount = (key: string) => params.has(key) ? Number(params.get(key)) : undefined;
  const minPrice = amount("minPrice");
  const maxPrice = amount("maxPrice");
  const budget = propertyBudgetTiers.find((tier) => tier === params.get("budget"));
  const places = params.getAll("place").flatMap((serialized) => {
    try {
      const place: Place = JSON.parse(serialized);
      return ["city", "state", "locality"].includes(place.kind) && place.value ? [place] : [];
    } catch {return [];}
  });
  const location = params.get("location") || params.get("city");
  if (location && !places.length) places.push({kind: "city", value: location, country});
  const term = canonical(params.get("q") ?? "");
  if (term && !places.length) {
    const match = items.find(({data}) => ["city", "state", "locality"].some((field) => typeof data[field] === "string" && canonical(data[field]).startsWith(term)));
    if (match) {
      const {data} = match;
      const kind = (["locality", "city", "state"] as const).find((field) => typeof data[field] === "string" && canonical(data[field]).startsWith(term));
      if (kind) places.push({kind, value: String(data[kind]), country: typeof data.countryCode === "string" ? data.countryCode : country,
        context: kind === "city" && typeof data.state === "string" ? data.state : kind === "locality" && typeof data.city === "string" ? data.city : undefined});
    }
  }
  if ((!places.length && !country && !budget && minPrice === undefined && maxPrice === undefined) ||
      [minPrice, maxPrice].some((value) => value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1e15))) return;
  const entry: PropertyInterest = {places: places.slice(0, 8), country, currency, budget,
    intent: intent === "SALE" || intent === "RENT" ? intent : undefined, minPrice, maxPrice,
    propertyIds: items.slice(0, 20).map(({id}) => id), searchedAt: new Date().toISOString()};
  if (session) {
    void apiRequest(route, {method: "POST", body: {interests: [entry]}}).catch(() => {});
    return;
  }
  try {localStorage.setItem(key, JSON.stringify([entry, ...browserPropertyInterests().filter((value) => signature(value) !== signature(entry))].slice(0, retained)));}
  catch {}
}

export function useSyncPropertyInterests(session: AuthSession | null) {
  useEffect(() => {
    if (!session) return;
    const interests = browserPropertyInterests();
    if (!interests.length) return;
    const controller = new AbortController();
    void apiRequest(route, {method: "POST", body: {interests}, signal: controller.signal}).then(() => {
      if (!controller.signal.aborted && JSON.stringify(browserPropertyInterests()) === JSON.stringify(interests)) clearBrowserPropertyInterests();
    }, () => {});
    return () => controller.abort();
  }, [session]);
}
