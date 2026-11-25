"use client";

import {useState, type FormEvent} from "react";
import {Button, LinearProgress, TextField, ToggleButton, ToggleButtonGroup} from "@mui/material";
import {Check} from "lucide-react";
import {homeLoanOffers} from "@/config/home-loan-rates";
import styles from "./home-loan-guide.module.css";

const examples = {
  Home: {years: 20, rate: 8.5}, Car: {years: 5, rate: 9},
  Personal: {years: 5, rate: 12}, Education: {years: 10, rate: 10}, Business: {years: 7, rate: 11},
};
type LoanType = keyof typeof examples;
const bands = [
  {label: "750 and above — excellent", share: 55}, {label: "700–749", share: 50},
  {label: "Below 700 or no score", share: 40},
];

function estimate(age: number, endAge: number, income: number, commitments: number, share: number, years: number, rate: number) {
  const months = Math.max(0, Math.min(years, endAge - age)) * 12;
  const payment = months ? Math.max(0, income * share / 100 - commitments) : 0;
  const monthlyRate = rate / 1200;
  const principal = monthlyRate ? payment * -Math.expm1(-months * Math.log1p(monthlyRate)) / monthlyRate : payment * months;
  const total = payment * months;
  return {months, payment, principal, total, interest: total - principal, rate, share, endAge};
}

export function LoanEligibility({locale}: {locale: string}) {
  const [type, setType] = useState<LoanType>("Home");
  const [endAge, setEndAge] = useState(60);
  const [rate, setRate] = useState("8.5");
  const [years, setYears] = useState("20");
  const [result, setResult] = useState(() => estimate(30, 60, 50000, 0, 55, 20, 8.5));
  const [changed, setChanged] = useState(false);
  const money = new Intl.NumberFormat(locale === "en" ? "en-IN" : locale, {style: "currency", currency: "INR", maximumFractionDigits: 0});
  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const num = (name: string) => Number(data.get(name));
    setResult(estimate(num("age"), endAge, num("income"), num("commitments"), num("share"), Number(years), Number(rate)));
    setChanged(false);
  }
  const divisor = result.principal >= 10000000 ? 10000000 : 100000;
  const amount = result.principal < 100000 ? money.format(result.principal) :
    new Intl.NumberFormat(locale, {style: "currency", currency: "INR"}).format(result.principal / divisor) + (divisor === 100000 ? " Lac" : " Cr");
  const fieldSlots = {input: {disableUnderline: true}, inputLabel: {shrink: true}};
  const selectSlots = {...fieldSlots, select: {native: true}};
  return <section id="eligibility" className={`${styles.panel} ${styles.eligibility}`} aria-labelledby="eligibility-title">
    <form className={styles.inputs} onSubmit={calculate} onChange={() => setChanged(true)}>
      <h2 id="eligibility-title">Check Your Loan Eligibility</h2>
      <div className={styles.pair}>
        <TextField variant="filled" label="Age" name="age" type="number" defaultValue="30" required
          slotProps={{...fieldSlots, htmlInput: {min: 18, max: 100}}} />
        <fieldset className={styles.choice}><legend>Employment Type</legend>
          <ToggleButtonGroup fullWidth exclusive aria-label="Employment type" value={endAge}
            onChange={(_, value: number | null) => {if (value !== null) {setEndAge(value); setChanged(true);}}}>
            <ToggleButton value={60}>Salaried</ToggleButton><ToggleButton value={65}>Self-employed</ToggleButton>
          </ToggleButtonGroup>
        </fieldset>
      </div>
      <TextField variant="filled" label="Net Monthly Income (₹)" type="number" name="income" defaultValue="50000" required
        slotProps={{...fieldSlots, htmlInput: {min: 1, max: 1000000000, step: "0.01"}}} />
      <TextField variant="filled" label="Ongoing Monthly EMIs (₹)" type="number" name="commitments" defaultValue="0" required
        slotProps={{...fieldSlots, htmlInput: {min: 0, max: 1000000000, step: "0.01"}}} />
      <TextField variant="filled" select label="Credit Score Band" name="share" defaultValue={55} slotProps={selectSlots}>
        {bands.map(b => <option key={b.share} value={b.share}>{b.label}</option>)}
      </TextField>
      <fieldset className={styles.choice}><legend>Loan Type</legend>
        <ToggleButtonGroup fullWidth exclusive aria-label="Loan type" value={type}
          onChange={(_, next: LoanType | null) => {
            if (!next) return;
            setType(next); setRate(String(examples[next].rate)); setYears(String(examples[next].years)); setChanged(true);
          }}>
          {Object.keys(examples).map(option => <ToggleButton key={option} value={option}>{option}</ToggleButton>)}
        </ToggleButtonGroup>
      </fieldset>
      <div className={styles.pair}>
        <TextField variant="filled" select label="Loan Tenure" value={years} onChange={e => setYears(e.target.value)} slotProps={selectSlots}>
          {Array.from({length: 40}, (_, i) => i + 1).map(year => <option key={year} value={year}>{year} {year === 1 ? "Year" : "Years"}</option>)}
        </TextField>
        <TextField variant="filled" label="Interest Rate (% p.a.)" type="number" required value={rate} onChange={e => setRate(e.target.value)}
          slotProps={{...fieldSlots, htmlInput: {min: 0, max: 40, step: "0.01"}}} />
      </div>
      <Button variant="contained" type="submit">Check Eligibility</Button>
    </form>
    <aside className={styles.estimate} aria-label="Loan eligibility result">
      <div aria-live="polite" aria-atomic="true">
        <div className={styles.metrics}>
          <div><span>Estimated eligible amount</span><strong className={styles.amount}>{amount}</strong></div>
          <div><span>Monthly EMI</span><strong>{money.format(result.payment)}</strong></div>
        </div>
        {changed && <p className={styles.note}>Select Check Eligibility to update this estimate.</p>}
        <dl>{[
          ["Tenure used in calculation", result.months / 12 + " yrs · " + result.months + " mo"],
          ["Interest rate applied", result.rate + "% p.a."], ["Total interest payable", money.format(result.interest)],
          ["Total repayment", money.format(result.total)],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <div className={styles.shareLabel}><span>Income committed to EMIs (FOIR)</span><span>{result.share}%</span></div>
        <LinearProgress variant="determinate" value={result.share} aria-label="Income limit for all EMIs" />
        {result.payment === 0 && <p className={styles.note}>These inputs leave no borrowing capacity.</p>}
      </div>
      <div className={styles.benefits}>
        <h3>Why The Property Pillar?</h3>
        <ul>{[`Compare home loans from ${homeLoanOffers.length} banks`, "See interest rates and processing fees", "Apply directly with the bank"].map(line =>
          <li key={line}><Check size={13} strokeWidth={3} aria-hidden="true" />{line}</li>)}</ul>
        <Button variant="outlined" href="#bank-offers">Check Bank Offers</Button>
      </div>
      <p className={styles.note}>Estimate assumes repayment by age {result.endAge}. Each lender sets its own eligibility rules.</p>
    </aside>
  </section>;
}
