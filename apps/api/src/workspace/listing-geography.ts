import {all} from "country-codes-list";
import {listingCurrencyCodes} from "@the-property-pillar/contracts";
import {z} from "zod";

export const defaultListingCountry = "IN";
const countryCodes = new Set(all().map(({countryCode}) => countryCode));
const currencyCodes = new Set(listingCurrencyCodes);

export const listingCountry = z.string().trim().toUpperCase()
  .refine((value) => countryCodes.has(value), "Choose a valid country or territory.");

export const listingCurrency = z.string().trim().toUpperCase()
  .refine((value) => currencyCodes.has(value), "Choose a valid currency.");

export const internationalPostalCode = z.string().trim().min(1).max(16)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, "Enter a valid postal or ZIP code.");

const indianPostalCode = z.string({required_error: "Enter the Indian PIN code.", invalid_type_error: "Enter the Indian PIN code."})
  .regex(/^[1-9]\d{5}$/, "Enter a valid six-digit Indian PIN code.");
const indianPostalAddress = z.object({postalCode: indianPostalCode});

export function validateListingPostalCode(data: {countryCode?: unknown; postalCode?: unknown}) {
  if ((data.countryCode ?? defaultListingCountry) === defaultListingCountry) indianPostalAddress.parse(data);
}
