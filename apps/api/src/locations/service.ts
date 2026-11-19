import { z } from "zod";

import { gstStateNames } from "../billing/gst-states.js";
import { ApiError } from "../utils/api-error.js";

const PINCODE_PATTERN = /^[1-9]\d{5}$/;
const POSTAL_API_BASE = "https://api.postalpincode.in/pincode";
const DEFAULT_TIMEOUT_MS = 4_000;

const optionalPostalText = z.string().trim().max(200).nullish();
const postOfficeSchema = z
  .object({
    Name: optionalPostalText,
    BranchType: optionalPostalText,
    DeliveryStatus: optionalPostalText,
    District: optionalPostalText,
    Block: optionalPostalText,
    Division: optionalPostalText,
    Region: optionalPostalText,
    Circle: optionalPostalText,
    State: optionalPostalText,
    Country: optionalPostalText,
    Pincode: optionalPostalText,
  })
  .passthrough();

const postalEnvelopeSchema = z
  .array(
    z
      .object({
        Status: z.string().trim().min(1).max(50),
        Message: z.string().trim().max(500).nullish(),
        PostOffice: z.array(postOfficeSchema).nullable().optional(),
      })
      .passthrough(),
  )
  .min(1)
  .max(10);

type PostOffice = z.infer<typeof postOfficeSchema>;

export type PincodeLocation = {
  pincode: string;
  city: string;
  state: string;
  stateCode: string | null;
  area: string | null;
  areas: string[];
};

export interface PincodeLookupService {
  lookup(pincode: string): Promise<PincodeLocation>;
}

function normalizedName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const stateAliases: Readonly<Record<string, string>> = {
  "andaman nicobar islands": "35",
  "andaman and nicobar": "35",
  chattisgarh: "22",
  "dadra nagar haveli daman diu": "26",
  "dadra and nagar haveli": "26",
  "daman and diu": "26",
  "jammu kashmir": "01",
  "nct delhi": "07",
  "nct of delhi": "07",
  "new delhi": "07",
  orissa: "21",
  pondicherry: "34",
  telengana: "36",
  uttaranchal: "05",
};

const stateCodeByName = new Map<string, string>([
  ...Object.entries(gstStateNames).map(
    ([code, name]) => [normalizedName(name), code] as const,
  ),
  ...Object.entries(stateAliases),
]);

function canonicalState(rawState: string): {
  state: string;
  stateCode: string | null;
} {
  const stateCode = stateCodeByName.get(normalizedName(rawState)) ?? null;
  return {
    state: stateCode
      ? (gstStateNames[stateCode] ?? rawState.trim())
      : rawState.trim(),
    stateCode,
  };
}

function usefulText(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!text || /^(?:n\/?a|na|nil|none|not available)$/i.test(text)) return null;
  return text;
}

function cityFor(postOffice: PostOffice): string | null {
  const district = usefulText(postOffice.District);
  const block = usefulText(postOffice.Block);
  const city =
    (block &&
    district &&
    normalizedName(block).startsWith(normalizedName(district) + " ")
      ? district
      : (block ?? district)) ??
    usefulText(postOffice.Division) ??
    usefulText(postOffice.Region) ??
    usefulText(postOffice.Name);
  if (!city) return null;
  const key = normalizedName(city);
  if (
    key === "s a s nagar mohali" ||
    key === "sas nagar mohali" ||
    key === "sahibzada ajit singh nagar"
  )
    return "Mohali";
  if (key === "bangalore") return "Bengaluru";
  return city;
}

function candidateScore(postOffice: PostOffice): number {
  const delivery =
    normalizedName(postOffice.DeliveryStatus ?? "") === "delivery";
  const branch = normalizedName(postOffice.BranchType ?? "");
  const headOffice = branch === "head post office" || branch === "head office";
  return (
    (delivery ? 100 : 0) +
    (headOffice ? 40 : 0) +
    (usefulText(postOffice.District) ? 20 : 0) +
    (usefulText(postOffice.Block) ? 5 : 0)
  );
}

export function selectPincodeLocation(
  pincode: string,
  postOffices: readonly PostOffice[],
): PincodeLocation | null {
  const candidates = postOffices
    .filter((postOffice) => {
      const country = usefulText(postOffice.Country);
      return (
        usefulText(postOffice.Pincode) === pincode &&
        Boolean(usefulText(postOffice.State)) &&
        Boolean(cityFor(postOffice)) &&
        (!country || normalizedName(country) === "india")
      );
    })
    .map((postOffice, index) => ({ postOffice, index }))
    .sort(
      (left, right) =>
        candidateScore(right.postOffice) - candidateScore(left.postOffice) ||
        left.index - right.index,
    );

  const selected = candidates[0]?.postOffice;
  if (!selected) return null;
  const city = cityFor(selected);
  const rawState = usefulText(selected.State);
  if (!city || !rawState) return null;

  const seenAreas = new Set<string>();
  const areas: string[] = [];
  for (const { postOffice } of candidates) {
    const name = usefulText(postOffice.Name);
    if (!name || name.length > 160) continue;
    const key = normalizedName(name);
    if (!key || seenAreas.has(key)) continue;
    seenAreas.add(key);
    areas.push(name);
  }
  const area =
    areas.find((name) => normalizedName(name) !== normalizedName(city)) ??
    areas[0] ??
    null;

  return { pincode, city, ...canonicalState(rawState), area, areas };
}

function isNotFoundEnvelope(
  envelopes: z.infer<typeof postalEnvelopeSchema>,
): boolean {
  return envelopes.every((envelope) => {
    const status = normalizedName(envelope.Status);
    const message = normalizedName(envelope.Message ?? "");
    return (
      status === "error" &&
      /(?:no records?|not found|invalid pincode)/.test(message)
    );
  });
}

function upstreamUnavailable(): ApiError {
  return new ApiError(
    502,
    "PINCODE_UPSTREAM_UNAVAILABLE",
    "PIN code lookup is temporarily unavailable.",
  );
}

export function createPincodeLookupService(options?: {
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
}): PincodeLookupService {
  const fetchImplementation =
    options?.fetchImplementation ?? ((input, init) => fetch(input, init));
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async lookup(pincode: string): Promise<PincodeLocation> {
      if (!PINCODE_PATTERN.test(pincode)) {
        throw new ApiError(
          400,
          "INVALID_PINCODE",
          "PIN code must contain exactly 6 digits and cannot start with zero.",
        );
      }

      let response: Response;
      try {
        response = await fetchImplementation(`${POSTAL_API_BASE}/${pincode}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          redirect: "error",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        if (name === "AbortError" || name === "TimeoutError") {
          throw new ApiError(
            504,
            "PINCODE_UPSTREAM_TIMEOUT",
            "PIN code lookup timed out.",
          );
        }
        throw upstreamUnavailable();
      }

      if (response.status === 404) {
        throw new ApiError(404, "PINCODE_NOT_FOUND", "PIN code was not found.");
      }
      if (!response.ok) throw upstreamUnavailable();

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw upstreamUnavailable();
      }
      const parsed = postalEnvelopeSchema.safeParse(payload);
      if (!parsed.success) throw upstreamUnavailable();
      if (isNotFoundEnvelope(parsed.data)) {
        throw new ApiError(404, "PINCODE_NOT_FOUND", "PIN code was not found.");
      }

      const successful = parsed.data.filter(
        (envelope) => normalizedName(envelope.Status) === "success",
      );
      if (successful.length === 0) throw upstreamUnavailable();

      const location = selectPincodeLocation(
        pincode,
        successful.flatMap((envelope) => envelope.PostOffice ?? []),
      );
      if (!location) throw upstreamUnavailable();
      return location;
    },
  };
}

export const postalPincodeService = createPincodeLookupService();
