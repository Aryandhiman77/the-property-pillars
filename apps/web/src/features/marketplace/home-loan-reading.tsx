import Link from "next/link";
import {getTranslations} from "next-intl/server";
import {ArticleCard} from "@/features/articles/article-cards";
import {publicArticleRequest} from "@/features/articles/article-api";
import type {ArticleCardData} from "@/features/articles/types";
import styles from "./home-loan-guide.module.css";

const questions = [
  ["Why does a longer tenure lower my monthly EMI?",
    "Spreading the same principal over more months generally reduces each payment. At the same positive interest rate, the outstanding balance also accrues interest for longer. Try both tenures in the calculator, then compare the monthly EMI and total interest together before choosing a repayment period."],
  ["What does the eligibility estimate take into account?",
    "The estimate starts with your take-home income and deducts existing EMIs from a modelled repayment budget. It then converts the remaining monthly payment into a loan amount using your selected rate and tenure. A lender also reviews income documents, credit history and the property before making an offer."],
  ["Which costs should I compare beyond the interest rate?",
    "Look at the processing fee in rupees for your loan amount. Check whether the lender applies a minimum, a cap or an upfront charge, and ask which taxes, valuation and legal costs are separate. The fee schedule beside each bank explains how its published charges work."],
  ["What should I prepare before applying?",
    "Start with identity and address documents, recent bank statements and proof of income. Salaried applicants may need payslips, while self-employed applicants may need tax returns and business financials. The lender will also request property papers appropriate to the purchase or construction and provide its own document checklist."],
];
export async function getHomeLoanArticles(locale: string) {
  const feed = await publicArticleRequest<{items: ArticleCardData[]}>(`?locale=${locale}&topic=LOANS&limit=3`).catch(() => null);
  return feed?.items ?? [];
}

export async function HomeLoanArticlesLink({articles}: {articles: Promise<ArticleCardData[]>}) {
  if (!(await articles).length) return null;
  const t = await getTranslations("Articles");
  return <a href="#loan-articles">{t("title")}</a>;
}

export async function HomeLoanReading({locale, articles}: {locale: string; articles: Promise<ArticleCardData[]>}) {
  const [items, t] = await Promise.all([articles, getTranslations("Articles")]);
  const schema = {"@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: questions.map(([name, text]) => ({"@type": "Question", name, acceptedAnswer: {"@type": "Answer", text}}))};
  return <>
    <section id="loan-faqs" className={styles.panel} aria-labelledby="loan-faq-title">
      <h2 id="loan-faq-title">Home loan FAQs</h2>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema).replace(/</g, "\\u003c")}} />
      {questions.map(([question, answer]) => <details key={question} className={styles.faq}>
        <summary>{question}</summary><p>{answer}</p></details>)}
    </section>
    {items.length > 0 && <section id="loan-articles" className={styles.panel} aria-labelledby="loan-articles-title">
      <header className={styles.readingHeader}><h2 id="loan-articles-title">Home loan articles</h2>
        <Link className="market-text-link" href={`/${locale}/articles?topic=LOANS`}>{t("viewAll")}</Link>
      </header>
      <div className={styles.reading}>
        {items.map(article => <ArticleCard key={article.id} article={article} locale={locale} compact showSummary />)}
      </div>
    </section>}
  </>;
}
