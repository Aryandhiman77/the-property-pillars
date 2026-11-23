"use client";

import {all} from "country-codes-list";
import {getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode} from "libphonenumber-js/min";
import {useState, type ComponentProps} from "react";
import {ChevronDown} from "lucide-react";
import {useSiteLocation} from "@/features/location/site-location";
import "flag-icons/css/flag-icons.min.css";
import styles from "./phone-input.module.css";

const countries = new Set<string>(getCountries());
const options = all().filter(({countryCode, countryCallingCode}) => countries.has(countryCode) && countryCallingCode)
  .sort((a, b) => a.countryNameEn.localeCompare(b.countryNameEn, "en"));
const validCountry = (code?: string): CountryCode | undefined => code && countries.has(code) ? code as CountryCode : undefined;

export function internationalPhone(value: string, country?: string) {
  const raw = value.trim();
  if (!raw || raw.startsWith("+")) return raw;
  const region = validCountry(country) ?? "IN";
  const parsed = parsePhoneNumberFromString(raw, {defaultCountry: region, extract: false});
  return parsed?.number ?? `+${getCountryCallingCode(region)} ${raw}`;
}

export function formPhone(values: FormData, name = "phone") {
  return internationalPhone(String(values.get(name) ?? ""), String(values.get(`${name}Country`) ?? ""));
}

type Props = Omit<ComponentProps<"input">, "onChange" | "type" | "value" | "defaultValue"> & {
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (number: string) => void;
  preferredCountry?: string;
};

export function PhoneInput({name, value, defaultValue, onChange, preferredCountry, ...attributes}: Props) {
  const {place} = useSiteLocation();
  const [selected, setSelected] = useState<CountryCode>();
  const [draft, setDraft] = useState<{number: string; display: string}>();
  const stored = value ?? defaultValue ?? "";
  const parsed = stored.startsWith("+") ? parsePhoneNumberFromString(stored, {extract: false}) : undefined;
  const country = selected ?? parsed?.country ?? validCountry(preferredCountry) ?? validCountry(place?.countryCode) ?? "IN";
  const display = draft && (value === undefined || draft.number === value) ? draft.display : parsed?.nationalNumber ?? stored;

  function update(raw: string, region: CountryCode) {
    const pasted = raw.trim().startsWith("+") ? parsePhoneNumberFromString(raw, {extract: false}) : undefined;
    if (pasted?.country) setSelected(pasted.country);
    const number = internationalPhone(raw, region);
    setDraft({number, display: pasted?.nationalNumber ?? raw});
    onChange?.(number);
  }

  return <span className={styles.phone} dir="ltr">
    <span className={styles.code}>
      <span aria-hidden="true" className={`fi fi-${country.toLowerCase()}`} />
      <span aria-hidden="true">+{getCountryCallingCode(country)}</span>
      <ChevronDown size={12} aria-hidden="true" />
      <select aria-label="Country calling code" name={`${name}Country`} value={country} disabled={attributes.disabled}
        onChange={(event) => {
          const next = event.target.value as CountryCode;
          setSelected(next);
          update(display, next);
        }}>
        {options.map(({countryCode, countryNameEn, countryCallingCode}) =>
          <option key={countryCode} value={countryCode}>{countryNameEn} +{countryCallingCode}</option>)}
      </select>
    </span>
    <input {...attributes} name={name} type="tel" inputMode="tel" autoComplete="tel-national" maxLength={25}
      value={display} onChange={(event) => update(event.target.value, country)} />
  </span>;
}
