"use client";

import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import {all} from "country-codes-list";
import {getCountries} from "libphonenumber-js/min";
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
  return <Select size="small" name="mobileCountry" value={value} onChange={event => onChange(event.target.value)}
    required error={invalid} dir="ltr" inputProps={{"aria-label": "Country calling code", "aria-describedby": errorId}}
    MenuProps={{disablePortal: true, slotProps: {paper: {sx: {maxHeight: 320}}}}}
    renderValue={() => <span className={styles.countryValue}><CountryFlag country={value} />
      {country ? `+${country.countryCallingCode}` : "Code"}</span>}>
    {countries.map(({countryCode, countryNameEn, countryCallingCode}) => <MenuItem key={countryCode} value={countryCode} dir="ltr">
      <span className={styles.countryValue}><CountryFlag country={countryCode} />{countryNameEn} +{countryCallingCode}</span>
    </MenuItem>)}
  </Select>;
}
