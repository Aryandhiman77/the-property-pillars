"use client";

import {MaterialInput, MaterialSelect, MaterialTextarea} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";

import {useLocale, useTranslations} from "next-intl";

import {ArrowRight, LoaderCircle} from "lucide-react";
import {useId, useRef, useState, type ComponentProps, type FormEvent, type RefObject} from "react";
import {leadVisitorLabels, leadVisitorTypes, normalizeContactPhone} from "@the-property-pillar/contracts";
import {PhoneInput, formPhone} from "@/components/ui/phone-input";
import {listingCurrencies} from "@/config/listing-geography";
import {loanTypeOptions} from "@/features/dashboard/collection-config";
import type {WorkspaceMutation} from "@/features/dashboard/workspace-form";
import {ApiClientError} from "@/lib/api/client";
import {clearChangedField, fieldAttributes, focusInvalidControl, invalidControls, splitFieldErrors} from "@/lib/form-validation";
import styles from "./public-task.module.css";

const textFields = ["fullName", "phone", "email", "visitorType", "loanType", "city", "currency", "loanAmount", "propertyValue", "monthlyIncome"] as const;
const moneyFields = ["loanAmount", "propertyValue", "monthlyIncome"] as const;
const formFields = [...textFields, "description", "consentAccepted"];

function readEnquiry(form: HTMLFormElement) {
  const values = new FormData(form);
  const field = (name: string) => name === "phone" ? formPhone(values) : String(values.get(name) ?? "");
  const data = {
    ...Object.fromEntries(textFields.map((name) => [name, field(name)])),
    consentAccepted: values.has("consentAccepted"),
  } as Record<(typeof textFields)[number], string> & {consentAccepted: boolean};
  return {data, description: field("description"), title: ""};
}

export function LoanEnquiryForm({initial, canSubmit, guestLead, contactDefaults, requestAccess, draftRef, onSave}: {
  initial: WorkspaceMutation;
  canSubmit: boolean;
  guestLead?: boolean;
  contactDefaults?: {fullName: string; phone: string; email: string};
  requestAccess: () => void;
  draftRef: RefObject<WorkspaceMutation | null>;
  onSave: (payload: WorkspaceMutation) => Promise<void | false>;
}) {
  const t = useTranslations("Site");
  const locale = useLocale();
  const id = useId();
  const initialValue = (name: string) => String(initial.data?.[name] ?? (name === "fullName" ? contactDefaults?.fullName : name === "phone" ? contactDefaults?.phone : name === "email" ? contactDefaults?.email : "") ?? "");
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  function issue(name: string) {
    return errors[name] && <small id={`${id}-${name}`} className={styles.loanError} role="alert">{errors[name]}</small>;
  }

  function input(name: string, label: string, props: ComponentProps<"input"> = {}) {
    return <label className={styles.loanField}>
      <span>{label} {props.required ? <b aria-hidden="true">*</b> : <small>Optional</small>}</span>
      <MaterialInput {...props} {...fieldAttributes(id, name, errors[name])} defaultValue={initialValue(name)} />
      {issue(name)}
    </label>;
  }

  function select(name: string, label: string, options: {value: string; label: string}[]) {
    return <label className={styles.loanField}>
      <span>{label} <b aria-hidden="true">*</b></span>
      <MaterialSelect {...fieldAttributes(id, name, errors[name])} defaultValue={initialValue(name)} required>
        <option value="" disabled>Select {label.toLowerCase()}</option>
        {options.map(({value, label}) => <option key={value} value={value}>{label}</option>)}
      </MaterialSelect>
      {issue(name)}
    </label>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    const form = event.currentTarget;
    const entry = readEnquiry(form);
    draftRef.current = entry;
    setMessage("");
    const {data} = entry;
    const invalid = invalidControls(form);
    const name = data.fullName.trim();
    const city = data.city.trim();
    const phone = normalizeContactPhone(data.phone);
    if (name.length < 2) invalid.fullName = "Enter your full name.";
    if (!city) invalid.city = "Enter the city where the property is located.";
    if (!phone) invalid.phone = "Enter a phone number with 7 to 15 digits, including the country code if needed.";
    if (!data.consentAccepted) invalid.consentAccepted = "Confirm that we can contact you about this enquiry.";
    for (const key of moneyFields) {
      if (!data[key]) continue;
      const amount = Number(data[key]);
      if (!Number.isFinite(amount) || amount <= 0) invalid[key] = "Enter an amount greater than zero.";
    }
    if (!invalid.loanAmount && !invalid.propertyValue && data.propertyValue && Number(data.loanAmount) > Number(data.propertyValue)) {
      invalid.loanAmount = "Loan amount must not exceed the property value.";
    }
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      focusInvalidControl(form);
      return;
    }
    if (!canSubmit) {
      requestAccess();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const loanType = loanTypeOptions.find(({value}) => value === data.loanType)?.label ?? "Loan enquiry";
      await onSave({
        title: `${loanType} · ${city}`,
        description: entry.description.trim() || undefined,
        data: {
          fullName: name,
          phone,
          ...(guestLead ? {visitorType: data.visitorType} : {}),
          email: data.email.trim() || undefined,
          loanType: data.loanType,
          city,
          currency: data.currency,
          loanAmount: Number(data.loanAmount),
          propertyValue: data.propertyValue ? Number(data.propertyValue) : undefined,
          monthlyIncome: data.monthlyIncome ? Number(data.monthlyIncome) : undefined,
          consentAccepted: data.consentAccepted,
        },
      });
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fieldErrors).length > 0) {
        const {fields, general} = splitFieldErrors(error.fieldErrors, formFields);
        setErrors(fields);
        setMessage(general);
        focusInvalidControl(form);
      } else {
        setMessage(error instanceof Error ? error.message : "Your enquiry could not be sent. Please try again.");
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return <form className={styles.loanForm} aria-label={t("loanEnquiry")} aria-busy={saving}
    data-public-task="loanInquiries" noValidate onSubmit={submit} onChange={(event) => {
      draftRef.current = readEnquiry(event.currentTarget);
      clearChangedField(event, setErrors);
    }}>
    <fieldset className={styles.loanGroup} disabled={saving}>
      <legend>{t("contactDetails")}</legend>
      <div className={styles.loanGrid}>
        {input("fullName", t("fullName"), {autoComplete: "name", placeholder: locale === "en" ? "Enter your full name" : t("fullName"), required: true, maxLength: 100})}
        <div className={styles.loanField}><label htmlFor={`${id}-phone-input`}>{t("phoneNumber")} <b aria-hidden="true">*</b></label>
          <PhoneInput {...fieldAttributes(id, "phone", errors.phone)} name="phone" id={`${id}-phone-input`} required placeholder="Mobile number" defaultValue={initialValue("phone")} />
          {issue("phone")}
        </div>
        {input("email", t("email"), {type: "email", autoComplete: "email", placeholder: "you@example.com", maxLength: 254})}
        {guestLead && select("visitorType", "Which best describes you?", leadVisitorTypes.map((value) => ({value, label: leadVisitorLabels[value]})))}
      </div>
    </fieldset>
    <fieldset className={styles.loanGroup} disabled={saving}>
      <legend>{t("loanDetails")}</legend>
      <div className={styles.loanGrid}>
        {select("loanType", "Loan type", loanTypeOptions)}
        {input("city", locale === "en" ? "Property city" : t("city"), {placeholder: "e.g. Ambala", required: true, maxLength: 120})}
        {select("currency", t("currency"), listingCurrencies)}
        {input("loanAmount", locale === "en" ? "Requested loan amount" : t("loanAmount"), {type: "number", inputMode: "decimal", min: 0, step: "any", placeholder: "4000000", required: true})}
        {input("propertyValue", "Property value", {type: "number", inputMode: "decimal", min: 0, step: "any", placeholder: "e.g. 5000000"})}
        {input("monthlyIncome", "Net monthly income", {type: "number", inputMode: "decimal", min: 0, step: "any"})}
        <label className={`${styles.loanField} ${styles.loanWide}`}>
          <span>{locale === "en" ? "Additional details" : t("description")} <small>{t("optional")}</small></span>
          <MaterialTextarea {...fieldAttributes(id, "description", errors.description)} defaultValue={initial.description ?? ""} rows={3}
            maxLength={5000} placeholder="Tell us anything that will help us follow up, such as the best time to call." />
          {issue("description")}
        </label>
      </div>
    </fieldset>
    <div className={styles.loanSubmit}>
      <div className={styles.loanConsent}>
        <label>
          <MaterialInput {...fieldAttributes(id, "consentAccepted", errors.consentAccepted)} type="checkbox" required
            disabled={saving} defaultChecked={initial.data?.consentAccepted === true} />
          <span>I agree to be contacted about this loan enquiry. <b aria-hidden="true">*</b></span>
        </label>
        {issue("consentAccepted")}
      </div>
      {message && <p className={styles.loanError} role="alert">{message}</p>}
      <MuiButton variant="contained" className="market-button" type="submit" disabled={saving}>
        {saving ? <LoaderCircle className={styles.loanSpinner} size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
        {locale === "en" ? (saving ? "Sending enquiry…" : canSubmit ? "Send loan enquiry" : "Sign in to send enquiry")
          : t(saving ? "saving" : canSubmit ? "submit" : "signIn")}
      </MuiButton>
    </div>
  </form>;
}
