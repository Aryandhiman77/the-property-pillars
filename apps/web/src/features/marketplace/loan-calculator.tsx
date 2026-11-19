"use client";

import Link from "next/link";
import {ArrowUpRight, Calculator} from "lucide-react";
import {useId, useState, type FormEvent} from "react";
import {Button} from "@/components/ui/button";
import {listingCurrencies} from "@/config/listing-geography";
import {publicTaskHref} from "@/config/public-tasks";
import {clearChangedField, fieldAttributes, focusInvalidControl, invalidControls} from "@/lib/form-validation";
import styles from "./directory.module.css";

function numberFormat(currency: string, locale: string) {
  return new Intl.NumberFormat(currency === "INR" && locale === "en" ? "en-IN" : locale, {style: "currency", currency});
}

function estimate(principal: number, rate: number, years: number, minorUnit: number) {
  const monthlyRate = rate / 1200;
  const months = years * 12;
  if (monthlyRate !== 0) {
    const payment = principal * monthlyRate / (1 - (1 + monthlyRate) ** (-months));
    const total = payment * months;
    return {payment, total, interest: total - principal, months, installments: null};
  }

  const principalInMinorUnits = Math.round(principal * minorUnit);
  const regularCount = months - 1;
  const roundedPayment = Math.round(principalInMinorUnits / months);
  const regularPayment = roundedPayment * regularCount >= principalInMinorUnits
    ? Math.floor(principalInMinorUnits / months) : roundedPayment;
  const regularTotal = regularPayment * regularCount;
  const finalPayment = principalInMinorUnits - regularTotal;
  const installments = finalPayment === regularPayment ? null : {
    regularCount,
    regularTotal: regularTotal / minorUnit,
    finalPayment: finalPayment / minorUnit,
  };

  return {payment: regularPayment / minorUnit, total: principalInMinorUnits / minorUnit, interest: 0, months, installments};
}

export function LoanCalculator({locale, headingAs: Heading = "h2"}: {locale: string; headingAs?: "h2" | "h3"}) {
  const formTitleId = useId();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState(() => ({...estimate(5000000, 8.5, 20, 100), currency: "INR"}));
  const {payment, total, interest, months, installments} = result;
  const money = numberFormat(result.currency, locale);

  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const issues = invalidControls(form);
    setErrors(issues);
    if (Object.keys(issues).length) {
      focusInvalidControl(form);
      return;
    }
    const data = new FormData(form);
    const currency = String(data.get("currency") ?? "INR");
    const minorUnit = 10 ** (numberFormat(currency, locale).resolvedOptions().maximumFractionDigits ?? 2);
    setResult({...estimate(Number(data.get("principalAmount")), Number(data.get("annualInterestRate")), Number(data.get("tenureYears")), minorUnit), currency});
  }

  function field(name: string) { return fieldAttributes(formTitleId, name, errors[name]); }
  function issue(name: string) { return errors[name] && <small className={styles.inlineError} id={`${formTitleId}-${name}`} role="alert">{errors[name]}</small>; }

  return (
    <div className={styles.calculator}>
      <form aria-labelledby={formTitleId} className={`${styles.surface} ${styles.calculatorForm}`} noValidate onSubmit={calculate} onChange={(event) => clearChangedField(event, setErrors)}>
        <Heading className={styles.calculatorFormTitle} id={formTitleId}>Loan details</Heading>
        <label>Currency<select {...field("currency")} defaultValue="INR" required>{listingCurrencies.map(({value, label}) => <option key={value} value={value}>{label}</option>)}</select>{issue("currency")}</label>
        <label>Loan amount<input {...field("principalAmount")} type="number" defaultValue={5000000} min={1000} max={1000000000} step={1} required />{issue("principalAmount")}</label>
        <label>Annual interest rate (%)<input {...field("annualInterestRate")} type="number" defaultValue={8.5} min={0} max={30} step={0.01} required />{issue("annualInterestRate")}</label>
        <label>Loan tenure (years)<input {...field("tenureYears")} type="number" defaultValue={20} min={1} max={40} required />{issue("tenureYears")}</label>
        <Button className={styles.primaryButton} type="submit"><Calculator size={16} aria-hidden="true" />Calculate EMI</Button>
      </form>
      <section className={`${styles.surface} ${styles.calculatorResult}`} aria-live="polite">
        <span>{installments ? `Total repayment across ${months} installments` : "Estimated monthly payment"}</span>
        <strong>{money.format(installments ? total : payment)}</strong>
        <dl className={styles.facts}>
          {installments ? (
            <>
              <div><dt>First {installments.regularCount} payments × {money.format(payment)}</dt><dd>{money.format(installments.regularTotal)}</dd></div>
              <div><dt>Final payment ({months} of {months})</dt><dd>{money.format(installments.finalPayment)}</dd></div>
            </>
          ) : <div><dt>Total repayment</dt><dd>{money.format(total)}</dd></div>}
          <div><dt>Total interest</dt><dd>{money.format(interest)}</dd></div>
        </dl>
        {installments && <p>The final payment adjusts for rounding in {result.currency}.</p>}
        {interest > 0 && <p>Totals use the unrounded payment estimate. Actual terms depend on your lender.</p>}
        <Link href={publicTaskHref(locale, "finance-services/apply")} className={styles.secondaryButton}>Submit a loan enquiry<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </section>
    </div>
  );
}
