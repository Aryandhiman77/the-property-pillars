"use client";

import * as Select from "@radix-ui/react-select";
import {all} from "country-codes-list";
import {getCountries} from "libphonenumber-js/min";
import {Check, ChevronDown} from "lucide-react";
import "flag-icons/css/flag-icons.min.css";

import styles from "./auth-access.module.css";

const supportedCountries = new Set<string>(getCountries());
const countries = all().filter(({countryCode, countryCallingCode}) => supportedCountries.has(countryCode) && countryCallingCode)
  .sort((a, b) => a.countryNameEn.localeCompare(b.countryNameEn, "en"));

function CountryFlag({country}: {country: string}) {
  return <span className={`fi fi-${country.toLowerCase()} ${styles.countryFlag}`} aria-hidden="true" />;
}

export function CountryCallingCode({value, onChange, invalid, errorId}: {
  value: string;
  onChange: (country: string) => void;
  invalid: boolean;
  errorId?: string;
}) {
  const country = countries.find(({countryCode}) => countryCode === value);
  return (
    <Select.Root name="mobileCountry" value={value} onValueChange={onChange} required>
      <Select.Trigger className={styles.countryTrigger} aria-label="Country calling code" aria-invalid={invalid} aria-describedby={errorId} dir="ltr">
        <CountryFlag country={value} />
        <Select.Value aria-label={country ? `${country.countryNameEn} +${country.countryCallingCode}` : undefined}>
          {country ? `+${country.countryCallingCode}` : "Code"}
        </Select.Value>
        <Select.Icon asChild><ChevronDown size={14} aria-hidden="true" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className={styles.countryOptions} position="popper" align="start" sideOffset={6} dir="ltr">
          <Select.Viewport>
            {countries.map(({countryCode, countryNameEn, countryCallingCode}) => (
              <Select.Item className={styles.countryOption} key={countryCode} value={countryCode}>
                <CountryFlag country={countryCode} />
                <Select.ItemText>{countryNameEn} +{countryCallingCode}</Select.ItemText>
                <Select.ItemIndicator className={styles.countryCheck}><Check size={15} aria-hidden="true" /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
