"use client";

import {useState, type FormEvent} from "react";
import {Button, LinearProgress, MenuItem, TextField} from "@mui/material";
import {ArrowRight, SlidersHorizontal, Wallet} from "lucide-react";
import styles from "./home-loan-guide.module.css";

const examples = {
  Home: {years: 20, rate: 8.5}, Car: {years: 5, rate: 9},
  Personal: {years: 5, rate: 12}, Education: {years: 10, rate: 10}, Business: {years: 7, rate: 11},
};
type LoanType = keyof typeof examples;
const bands = [
  {label: "750 and above", share: 55}, {label: "700–749", share: 50},
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
  const [rate, setRate] = useState("8.5");
  const [years, setYears] = useState("20");
  const [result, setResult] = useState(() => estimate(30, 60, 50000, 0, 55, 20, 8.5));
  const [changed, setChanged] = useState(false);
  const money = new Intl.NumberFormat(locale === "en" ? "en-IN" : locale, {style: "currency", currency: "INR", maximumFractionDigits: 0});
  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const num = (name: string) => Number(data.get(name));
    setResult(estimate(num("age"), num("endAge"), num("income"), num("commitments"), num("share"), Number(years), Number(rate)));
    setChanged(false);
  }
  return <section id="eligibility" className={styles.panel} aria-labelledby="eligibility-title">
    <header className={styles.intro}><h2 id="eligibility-title">Check your loan eligibility</h2>
      <p>Estimate how much you could borrow based on your income, existing EMIs and repayment term.</p></header>
    <div className={styles.eligibility}>
      <form className={styles.inputs} onSubmit={calculate} onChange={() => setChanged(true)}>
        <fieldset className={styles.fieldGroup}>
          <legend><Wallet size={18} aria-hidden="true" />Your finances</legend>
          <div className={styles.fieldGrid}>
            <TextField label="Age in years" name="age" type="number" defaultValue="30" required slotProps={{htmlInput: {min: 18, max: 100}}} />
            <TextField select label="Employment type" name="endAge" defaultValue={60} onChange={() => setChanged(true)}>
              <MenuItem value={60}>Salaried</MenuItem><MenuItem value={65}>Self-employed</MenuItem>
            </TextField>
            <TextField label="Net monthly income (₹)" type="number" name="income" defaultValue="50000" required slotProps={{htmlInput: {min: 1, max: 1000000000, step: "0.01"}}} />
            <TextField label="Ongoing monthly EMIs (₹)" type="number" name="commitments" defaultValue="0" required slotProps={{htmlInput: {min: 0, max: 1000000000, step: "0.01"}}} />
          </div>
        </fieldset>
        <fieldset className={styles.fieldGroup}>
          <legend><SlidersHorizontal size={18} aria-hidden="true" />Loan assumptions</legend>
          <div className={styles.fieldGrid}>
            <TextField select label="Credit score band" name="share" defaultValue={55} onChange={() => setChanged(true)}>
              {bands.map(b => <MenuItem key={b.share} value={b.share}>{b.label}</MenuItem>)}
            </TextField>
            <TextField select label="Loan type" value={type} onChange={event => {
              const next = event.target.value as LoanType;
              setType(next); setRate(String(examples[next].rate)); setYears(String(examples[next].years)); setChanged(true);
            }}>{Object.keys(examples).map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}</TextField>
            <TextField label="Loan tenure (years)" type="number" required value={years} onChange={e => setYears(e.target.value)} slotProps={{htmlInput: {min: 1, max: 40}}} />
            <TextField label="Annual interest rate (%)" type="number" required value={rate} onChange={e => setRate(e.target.value)} slotProps={{htmlInput: {min: 0, max: 40, step: "0.01"}}} />
          </div>
        </fieldset>
        <Button variant="contained" type="submit" endIcon={<ArrowRight size={17} />}>Check eligibility</Button>
      </form>
      <div className={styles.estimate} aria-live="polite">
        <div className={styles.estimateHero}>
          <h3>{changed ? "Previous borrowing estimate" : "Estimated borrowing amount"}</h3>
          <strong className={styles.amount}>{money.format(result.principal)}</strong>
          <p>{changed ? "Select Check eligibility to update these figures." : `Based on a ${result.months / 12}-year term at ${result.rate}% p.a.`}</p>
        </div>
        <div className={styles.estimateBody}>
          <div className={styles.emiMetric}><span>Monthly EMI available</span><strong>{money.format(result.payment)}</strong></div>
          <dl>{[
            ["Repayment tenure", result.months / 12 + " years"], ["Annual rate used", result.rate + "%"],
            ["Total interest", money.format(result.interest)], ["Total repayment", money.format(result.total)],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <div className={styles.shareLabel}>Income limit for all EMIs <strong>{result.share}%</strong></div>
          <LinearProgress variant="determinate" value={result.share} aria-label="Income limit for all EMIs" />
          <p>{result.payment === 0 ? "These inputs leave no borrowing capacity. " : ""}Assumes repayment by age {result.endAge}. Each lender sets its own eligibility rules.</p>
          <Button href="#bank-offers" endIcon={<ArrowRight size={15} />}>Compare home loan offers</Button>
        </div>
      </div>
    </div>
  </section>;
}
