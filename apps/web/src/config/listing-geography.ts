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

const localizedCountryLists = new Map<string, typeof listingCountries>();

export function countriesForLocale(locale: string) {
  const cached = localizedCountryLists.get(locale);
  if (cached) return cached;
  const names = new Intl.DisplayNames(locale, {type: "region", fallback: "none"});
  const compare = new Intl.Collator(locale).compare;
  const options = listingCountries.map(({value, label}) => ({value, label: names.of(value) ?? label}))
    .sort((left, right) => compare(left.label, right.label));
  localizedCountryLists.set(locale, options);
  return options;
}

export function countryName(code: unknown, options = listingCountries) {
  return options.find(({value}) => value === code)?.label ?? "";
}

export function currencyForCountry(code: string) {
  const currency = countries.find(({countryCode}) => countryCode === code)?.currencyCode;
  return listingCurrencies.find(({value}) => value === currency)?.value ?? "";
}
