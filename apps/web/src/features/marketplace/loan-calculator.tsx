"use client";

import {MaterialInput, MaterialSelect} from "@/components/ui/material-fields";
import Slider from "@mui/material/Slider";
import MuiButton from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import {ArrowUpRight, Calculator, ChevronDown, Table2} from "lucide-react";
import Link from "next/link";
import {useTranslations} from "next-intl";
import {useId, useMemo, useState, type CSSProperties} from "react";
import {listingCurrencies} from "@/config/listing-geography";
import {publicTaskHref} from "@/config/public-tasks";
import {fieldAttributes} from "@/lib/form-validation";
import {calculateLoanSchedule, defaultLoanTerms, loanRangeLabels, principalRange} from "./loan-schedule";
import styles from "./loan-calculator.module.css";

import {BankOfferComparison} from "./bank-offer-comparison";
import {HomeLoanMarquee} from "./home-loan-marquee";

const fields = {
  principalAmount: {label: "loanAmount", ...principalRange, step: 1},
  annualInterestRate: {label: "interestRate", min: 0, max: 30, step: 0.01},
  tenureYears: {label: "loanTenure", min: 1, max: 40, step: 1},
} as const;
type LoanField = keyof typeof fields;
const fieldNames = Object.keys(fields) as LoanField[];
const initialLoan: Record<LoanField, number> = {
  principalAmount: 5_000_000,
  ...defaultLoanTerms,
};

// Keep the full supported amount range usable for both small and large loans.
const amountSliderSteps = 1000;
const amountRange = fields.principalAmount;
const amountRatio = amountRange.max / amountRange.min;

function amountToSlider(amount: number) {
  return Math.round((Math.log(amount / amountRange.min) / Math.log(amountRatio)) * amountSliderSteps);
}

function sliderToAmount(step: number) {
  const amount = amountRange.min * amountRatio ** (step / amountSliderSteps);
  const increment = 10 ** Math.max(0, Math.floor(Math.log10(amount)) - 2);
  return Math.min(amountRange.max, Math.round(amount / increment) * increment);
}

function readValue(name: LoanField, text: string) {
  const rate = name === "annualInterestRate";
  const raw = text.trim();
  const normalized = name === "principalAmount" ? raw.replaceAll(",", "") : raw.replace(",", ".");
  const pattern = rate ? /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/ : /^\d+$/;
  const value = Number(normalized);
  const {min, max} = fields[name];
  return pattern.test(normalized) && value >= min && value <= max ? value : null;
}

export function LoanCalculator({locale, headingAs: Heading = "h2", amount, initialRange, homepage = false}: {
  locale: string; headingAs?: "h2" | "h3"; amount?: string; initialRange: ReturnType<typeof loanRangeLabels>; homepage?: boolean;
}) {
  const t = useTranslations("Site");
  const id = useId();
  const [loan, setLoan] = useState(() => ({...initialLoan, principalAmount: readValue("principalAmount", amount ?? "") ?? initialLoan.principalAmount}));
  const [drafts, setDrafts] = useState<Partial<Record<LoanField, string>>>({});
  const [currency, setCurrency] = useState(initialRange.currency);
  const [showSchedule, setShowSchedule] = useState(false);
  const [period, setPeriod] = useState<"yearly" | "monthly">("yearly");

  const moneyLocale = currency === "INR" && locale === "en" ? "en-IN" : locale;
  const money = useMemo(() => new Intl.NumberFormat(moneyLocale, {style: "currency", currency}), [moneyLocale, currency]);
  const minorUnit = 10 ** (money.resolvedOptions().maximumFractionDigits ?? 2);
  const amountFormatter = useMemo(() => new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US"), [currency]);
  // The server and browser may ship different ICU compact currency patterns.
  const range = useMemo(() => currency === initialRange.currency ? initialRange : loanRangeLabels(locale, currency),
    [initialRange, locale, currency]);
  const symbol = money.formatToParts(0).find((part) => part.type === "currency")?.value ?? currency;
  const schedule = useMemo(() => calculateLoanSchedule(
    loan.principalAmount, loan.annualInterestRate, loan.tenureYears, minorUnit,
  ), [loan, minorUnit]);
  const formatMoney = (amount: number) => money.format(amount / minorUnit);
  const principalShare = (100 * schedule.principal) / schedule.total;
  const lastPayment = schedule.monthly.at(-1);
  const priorPayments = schedule.monthly.length - 1;
  const values = {
    principalAmount: drafts.principalAmount ?? amountFormatter.format(loan.principalAmount),
    annualInterestRate: drafts.annualInterestRate ?? String(loan.annualInterestRate),
    tenureYears: drafts.tenureYears ?? String(loan.tenureYears),
  };

  function updateDraft(name: LoanField, text: string) {
    setDrafts((previous) => ({...previous, [name]: text}));
    const value = readValue(name, text);
    if (value !== null) setLoan((previous) => ({...previous, [name]: value}));
  }

  function clearDraft(name: LoanField) {
    setDrafts((previous) => ({...previous, [name]: undefined}));
  }

  function updateSlider(name: LoanField, value: number) {
    setLoan((previous) => ({...previous, [name]: name === "principalAmount" ? sliderToAmount(value) : value}));
    clearDraft(name);
  }

  return (<>
    <div className={`${styles.calculator} ${homepage ? styles.homeCalculator : styles.financeCalculator}`} id="emi-calculator">
      <div className={styles.overview}>
        <div className={styles.inputColumn}>
        <form aria-labelledby={`${id}-title`} className={styles.form} noValidate onSubmit={(event) => event.preventDefault()}>
          <div className={styles.formHeader}>
            <div className={styles.formTitle}>
              <span className={styles.icon}><Calculator size={20} aria-hidden="true" /></span>
              <Heading id={`${id}-title`}>{t(homepage ? "loanDetails" : "loanCalculator")}</Heading>
            </div>
            <label className={styles.currency}>
              {t("currency")}
              <span>
                <MaterialSelect name="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
                  {listingCurrencies.map(({value, label}) => <option key={value} value={value} title={label}>{value}</option>)}
                </MaterialSelect>
              </span>
            </label>
          </div>

          {fieldNames.map((name) => {
            const {label: labelKey, min, max, step} = fields[name];
            const label = t(labelKey);
            const isAmount = name === "principalAmount";
            const isRate = name === "annualInterestRate";
            const fieldId = `${id}-${name}-input`;
            const describe = (value: number) => isAmount ? money.format(value) : isRate ? `${value}%` : `${value} ${t(value === 1 ? "year" : "years")}`;
            const issue = readValue(name, values[name]) !== null ? undefined
              : !values[name].trim() ? `Enter the ${label.toLowerCase()}.`
              : `Enter a value from ${describe(min)} to ${describe(max)}${isRate ? " with up to two decimal places" : " as a whole number"}.`;
            const sliderMin = isAmount ? 0 : min;
            const sliderMax = isAmount ? amountSliderSteps : max;
            const sliderValue = isAmount ? amountToSlider(loan[name]) : loan[name];

            return (
              <div className={styles.field} key={name}>
                <label htmlFor={fieldId}>{label}</label>
                <div className={styles.valueBox}>
                  {isAmount && <span className={styles.symbol} aria-hidden="true">{symbol}</span>}
                  <MaterialInput {...fieldAttributes(id, name, issue)} id={fieldId} required
                    inputMode={isRate ? "decimal" : "numeric"} value={values[name]}
                    onChange={(event) => updateDraft(name, event.target.value)}
                    onBlur={() => { if (!issue) clearDraft(name); }} />
                  <span className={styles.unit} aria-hidden="true">{isAmount ? currency : isRate ? "%" : t("years")}</span>
                </div>
                {issue && <small className={styles.fieldError} id={`${id}-${name}`} role="alert">{issue}</small>}
                <Slider size="small" aria-label={`${label} slider`} getAriaValueText={() => describe(loan[name])}
                  min={sliderMin} max={sliderMax} step={step} value={sliderValue}
                  onChange={(_, value) => {if (typeof value === "number") updateSlider(name, value);}} />
                <div className={styles.bounds} aria-hidden="true">
                  <span>{isAmount ? range.min : describe(min)}</span>
                  <span>{isAmount ? range.max : describe(max)}</span>
                </div>
              </div>
            );
          })}
        </form>
        </div>

        <section className={styles.result} aria-labelledby={`${id}-results`}>
          {!homepage && <div className={styles.emiHighlight} aria-live="polite">
            <span>{t("monthlyPayment")}</span><strong>{formatMoney(schedule.payment)}</strong>
          </div>}
          <div className={styles.chart}>
            <Heading id={`${id}-results`}>{t("repayment")}</Heading>
            <div className={styles.donut} role="img"
              aria-label={`${t("principal")} ${Math.round(principalShare)}%, ${t("interest")} ${100 - Math.round(principalShare)}%`}
              style={{"--principal-share": `${principalShare}%`} as CSSProperties} />
            <ul className={styles.legend}>
              <li><span className={styles.principalSwatch} />{t("principal")}</li>
              <li><span className={styles.interestSwatch} />{t("interest")}</li>
            </ul>
          </div>

          <dl className={styles.totals} aria-live="polite">
            {homepage && <div className={styles.monthlyTotal}><dt>{t("monthlyPayment")}</dt><dd>{formatMoney(schedule.payment)}</dd></div>}
            <div><dt>{t("principalAmount")}</dt><dd>{formatMoney(schedule.principal)}</dd></div>
            <div><dt>{t("totalInterest")}</dt><dd>{formatMoney(schedule.totalInterest)}</dd></div>
            <div><dt>{t("totalRepayment")}</dt><dd>{formatMoney(schedule.total)}</dd></div>
          </dl>
          {lastPayment && lastPayment.payment !== schedule.payment && (
            <p className={styles.rounding}>
              {priorPayments} payments of {formatMoney(schedule.payment)}, then a final payment of {formatMoney(lastPayment.payment)}.
            </p>
          )}
        </section>
      </div>

      {homepage && <HomeLoanMarquee />}
      <details className={styles.schedule} onToggle={(event) => setShowSchedule(event.currentTarget.open)}>
        <summary>
          <Table2 size={19} aria-hidden="true" />
          <span>{t("amortization")}</span>
          <ChevronDown className={styles.chevron} size={18} aria-hidden="true" />
        </summary>
        {showSchedule && (
          <div className={styles.scheduleBody} data-motion="popover">
            <div className={styles.periodSwitch} role="group" aria-label="Schedule period">
              <MuiButton type="button" aria-pressed={period === "yearly"} onClick={() => setPeriod("yearly")}>{t("yearly")}</MuiButton>
              <MuiButton type="button" aria-pressed={period === "monthly"} onClick={() => setPeriod("monthly")}>{t("monthly")}</MuiButton>
            </div>
            <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Repayment schedule table">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell component="th" scope="col">{t(period === "yearly" ? "year" : "month")}</TableCell>
                    <TableCell component="th" scope="col">{t("principal")}</TableCell>
                    <TableCell component="th" scope="col">{t("interest")}</TableCell>
                    <TableCell component="th" scope="col">{t("payment")}</TableCell>
                    <TableCell component="th" scope="col">{t("remainingBalance")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {schedule[period].map((row) => (
                    <TableRow key={row.period}>
                      <TableCell component="th" scope="row">{row.period}</TableCell>
                      <TableCell>{formatMoney(row.principal)}</TableCell>
                      <TableCell>{formatMoney(row.interest)}</TableCell>
                      <TableCell>{formatMoney(row.payment)}</TableCell>
                      <TableCell>{formatMoney(row.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </details>

      <div className={styles.footer}>
        <p>Estimates use monthly interest and rounding to the currency’s smallest unit. Actual terms depend on your lender.</p>
        <Link href={homepage ? publicTaskHref(locale, "finance-services/apply") : "#loan-enquiry"} className={styles.enquiry}>{t("loanEnquiry")} <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
      {!homepage && <HomeLoanMarquee />}
    </div>
    {!homepage && <BankOfferComparison principal={currency === "INR" ? loan.principalAmount : undefined} />}
  </>);
}
