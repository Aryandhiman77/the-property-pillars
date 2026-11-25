"use client";

import Button from "@mui/material/Button";
import {ArrowUpRight} from "lucide-react";
import Image from "next/image";
import {useLocale, useNow} from "next-intl";
import {homeLoanOffers, offerExpired} from "@/config/home-loan-rates";
import styles from "./home-loan-guide.module.css";

export function BankOfferComparison({principal}: {principal?: number}) {
  const now = useNow({updateInterval: 60_000});
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-IN" : locale, {style: "currency", currency: "INR", maximumFractionDigits: 0});
  const date = new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeZone: "Asia/Kolkata"});
  const [lowest] = homeLoanOffers
    .filter(offer => !offerExpired(offer.validThrough, now))
    .map(offer => ({bank: offer.name, rate: Number.parseFloat(offer.rate)}))
    .filter(offer => Number.isFinite(offer.rate))
    .sort((a, b) => a.rate - b.rate);
  return <section id="bank-offers" className={styles.panel} aria-labelledby="bank-offers-title">
    <header className={styles.intro}><h2 id="bank-offers-title">Compare home loan offers</h2>
      {lowest && <p>Lowest listed rate: <strong>{lowest.rate.toFixed(2)}% p.a.</strong> from {lowest.bank}.</p>}
      <p>{principal ? `Processing estimates use your ${money.format(principal)} loan amount.` : "Indian banks quote processing fees in rupees. Select INR in the calculator for a fee estimate."} Applicable taxes and separate charges are extra.</p>
    </header>
    <div className={styles.columnHeads} aria-hidden="true"><span>Bank</span><span>Annual interest</span><span>Processing fee</span><span /></div>
    <ul className={styles.offers}>{homeLoanOffers.map(bank => {
      const expired = offerExpired(bank.validThrough, now);
      const feeExpired = offerExpired(bank.fee.validThrough, now);
      return <li key={bank.name}>
        <h3 className={styles.bankIdentity}>
          <Image src={bank.logo} width={128} height={32} alt="" unoptimized />
          {bank.name}
        </h3>
        <div><span className={styles.mobileLabel}>Annual interest</span>
          <a href={bank.rateUrl} target="_blank" rel="noreferrer">{expired ? "Check latest rate" : bank.rate + " p.a."}</a>
          <p>{bank.terms}</p>
          {bank.validThrough && <small>Quoted through {date.format(new Date(bank.validThrough))}</small>}
        </div>
        <div><span className={styles.mobileLabel}>Processing fee</span>
          <strong>{feeExpired ? "Check latest fee" : principal ? `${bank.fee.label} · ${money.format(bank.fee.estimate(principal))}` : "Fee schedule"}</strong>
          {!feeExpired && <p>{bank.fee.details}</p>}
          <a className={styles.source} href={bank.fee.source} target="_blank" rel="noreferrer">Official fee schedule</a>
        </div>
        <div><Button size="small" variant="outlined" href={bank.loanPageUrl ?? bank.applyUrl} target="_blank" rel="noreferrer"
          aria-label={`Apply now with ${bank.name}`} endIcon={<ArrowUpRight size={14} />}>Apply now</Button>
          {bank.loanPageUrl && <a className={styles.source} href={bank.applyUrl} target="_blank" rel="noreferrer">Direct application portal</a>}
        </div>
      </li>;
    })}</ul>
  </section>;
}
