import {all} from "country-codes-list";
import {listingCurrencyCodes} from "@the-property-pillar/contracts";

export const defaultListingCountry = "IN";
const countries = all();
const currencyNames = new Map(countries.map(({currencyCode, currencyNameEn}) => [currencyCode, currencyNameEn]));

export const listingCountries = countries.map(({countryCode, countryNameEn}) => ({
  value: countryCode,
  label: countryNameEn,
})).sort((first, second) => first.label < second.label ? -1 : first.label > second.label ? 1 : 0);

export const listingCurrencies = listingCurrencyCodes.map((value) => ({
  value,
  label: currencyNames.get(value) ? `${value} · ${currencyNames.get(value)}` : value,
}));

export function countryName(code: unknown) {
  return listingCountries.find(({value}) => value === code)?.label ?? "";
}

export function currencyForCountry(code: string) {
  const currency = countries.find(({countryCode}) => countryCode === code)?.currencyCode;
  return listingCurrencies.find(({value}) => value === currency)?.value ?? "";
}
