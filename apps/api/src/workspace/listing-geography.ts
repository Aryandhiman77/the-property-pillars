import {all} from "country-codes-list";
import {listingCurrencyCodes} from "@the-property-pillar/contracts";
import {z} from "zod";
import {findDeliveryCities, getDeliveryCity} from "../locations/delivery-cities.js";

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

export function applyCatalogLocation(data: Record<string, unknown>) {
  if (!data.placeCityId) {
    if (typeof data.city !== "string" || typeof data.state !== "string") return data;
    const choices = findDeliveryCities(data.city, data.countryCode ?? defaultListingCountry, data.state)
      .filter((city) => city.region.toLowerCase() === String(data.state).trim().toLowerCase());
    if (choices.length !== 1) return data;
    return {...data, placeCityId: choices[0].id, city: choices[0].name, state: choices[0].region, countryCode: choices[0].countryCode};
  }
  const city = getDeliveryCity(data.placeCityId);
  if (!city || city.countryCode !== (data.countryCode ?? defaultListingCountry)) {
    throw new z.ZodError([{code: "custom", path: ["city"], message: "Choose a city from the selected country."}]);
  }
  return {...data, city: city.name, state: city.region, countryCode: city.countryCode};
}
