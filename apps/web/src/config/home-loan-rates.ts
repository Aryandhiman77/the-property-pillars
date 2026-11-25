// A dated comparison of the products and borrower bands published by each lender.
export const ratesReviewedOn = "2026-11-25";

interface HomeLoanOffer {
  name: string;
  logo: string;
  rate: string;
  terms: string;
  rateUrl: string;
  applyUrl: string;
  fee: {details: string; source: string; label: string; estimate: (principal: number) => number; validThrough?: string};
  loanPageUrl?: string;
  validThrough?: string;
}

function bounded(amount: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, amount));
}

export function offerExpired(validThrough: string | undefined, now: Date) {
  return Boolean(validThrough && now.getTime() >= Date.parse(validThrough + "T24:00:00+05:30"));
}

export const homeLoanOffers: readonly HomeLoanOffer[] = [
  {
    logo: "/images/banks/sbi.webp",
    name: "State Bank of India", rate: "7.50%+", terms: "Starting rate for SBI home loans",
    fee: {
      details: "Regular card fee 0.35%, ₹2,000–₹10,000 before concessions. SBI lists a 50% concession and selected full waivers.",
      source: "https://sbi.bank.in/web/interest-rates/interest-rates/processing-fees",
      label: "Card fee", estimate: n => bounded(n * .0035, 2000, 10000),
    },
    rateUrl: "https://sbi.bank.in/web/interest-rates/interest-rates/loan-schemes-interest-rates/home-loans-interest-rates-current",
    applyUrl: "https://onlineapply.sbi.bank.in/personal-banking/home-loan?se=SBI-Microsite&cp=Homeloan&Ag=SBI-Microsite",
  },
  {
    logo: "/images/banks/hdfc.webp",
    name: "HDFC Bank", rate: "8.10%+", terms: "Adjustable-rate home loans",
    fee: {
      details: "Salaried applicants and self-employed professionals. Up to 0.50%, minimum ₹3,000.",
      source: "https://homeloans.hdfc.bank.in/checklist/documents-charges",
      label: "Up to", estimate: n => Math.max(3000, n * .005),
    },
    rateUrl: "https://homeloans.hdfc.bank.in/checklist/home-loan-interest-rates",
    applyUrl: "https://portal.hdfc.bank.in/?ref_code=HDFC_W",
  },
  {
    logo: "/images/banks/icici.webp",
    name: "ICICI Bank", rate: "8.75–9.65%", terms: "Salaried borrowers · up to ₹35 lakh",
    fee: {
      details: "Published processing fee ceiling of 2% of the loan amount. The bank confirms your fee at application.",
      source: "https://www.icici.bank.in/personal-banking/loans/home-loan/service-charges",
      label: "Up to", estimate: n => n * .02,
    },
    validThrough: "2026-11-30",
    rateUrl: "https://www.icici.bank.in/personal-banking/loans/home-loan/interest-rates",
    applyUrl: "https://buy.icici.bank.in/ucj/HomeLoan/personal?iup=UCJHL1000480&ius=IS83006US",
  },
  {
    logo: "/images/banks/pnb.webp",
    name: "Punjab National Bank", rate: "7.45%", terms: "Over ₹30 lakh · up to 80% financing · credit score 800+",
    fee: {
      details: "Utsav home-loan processing fee waived through 31 Dec 2026.",
      source: "https://pnb.bank.in/service-charges-related-to-retail-advances.html",
      label: "Waiver", estimate: () => 0, validThrough: "2026-12-31",
    },
    validThrough: "2026-12-31",
    rateUrl: "https://www.pnb.bank.in/Retail-Advances-interst-rate-on-advances-linked-to-mclr.html",
    applyUrl: "https://digihome.pnb.bank.in/pnb/hl/",
  },
  {
    logo: "/images/banks/axis.webp",
    name: "Axis Bank", rate: "8.35%+", terms: "Floating-rate home loans",
    fee: {
      details: "Up to 1%, minimum ₹10,000. ₹5,000 collected upfront towards this fee.",
      source: "https://www.axis.bank.in/loans/home-loan/interest-rates-charges",
      label: "Up to", estimate: n => Math.max(10000, n * .01),
    },
    rateUrl: "https://www.axis.bank.in/interest-rates-and-charges",
    applyUrl: "https://application.axis.bank.in/webforms/onlineform/home-loan/web/homeLoan.aspx",
  },
  {
    logo: "/images/banks/bob.webp",
    name: "Bank of Baroda", rate: "7.40–9.15%", terms: "Baroda Home Loan · floating rate",
    fee: {
      details: "Up to ₹50 lakh, 0.50% with a ₹15,000 cap. Above ₹50 lakh, 0.25% with a ₹25,000 cap. Minimum ₹8,500.",
      source: "https://bankofbaroda.bank.in/interest-rate-and-service-charges/service-charges",
      label: "Unified fee", estimate: n => n <= 5000000 ? bounded(n * .005, 8500, 15000) : bounded(n * .0025, 8500, 25000),
    },
    rateUrl: "https://bankofbaroda.bank.in/loans/home-loan/baroda-home-loan",
    loanPageUrl: "https://bankofbaroda.bank.in/loans/home-loan/baroda-home-loan",
    applyUrl: "https://dil.bankofbaroda.bank.in/homeloan?utm_source=website&utm_medium=organic&utm_campaign=pp&lt=homeloan",
  },
  {
    logo: "/images/banks/canara.webp",
    name: "Canara Bank", rate: "7.40%", terms: "Women borrowers · over ₹1 crore · credit grade CS1",
    fee: {
      details: "Standard fee 0.50%, ₹1,500–₹10,000. Salary-package concessions may apply.",
      source: "https://www.canarabank.bank.in/pages/housing-loan",
      label: "Standard", estimate: n => bounded(n * .005, 1500, 10000),
    },
    rateUrl: "https://www.canarabank.bank.in/pages/rates-of-interest-for-retail-lending-schemes-linked-to-rllr",
    applyUrl: "https://portal.digiloans.canarabank.bank.in/LoanPortal",
  },
  {
    logo: "/images/banks/indian.webp",
    name: "Indian Bank", rate: "7.35–8.80%", terms: "IB Home Loan · resident and NRI borrowers",
    fee: {
      details: "Resident borrowers pay ₹1,500 up to ₹25 lakh, ₹2,500 up to ₹75 lakh, then ₹5,000. NRI applicants pay ₹25,000.",
      source: "https://indianbank.bank.in/en/processing-fee-on-personal-segment-loan-products",
      label: "Resident", estimate: n => n <= 2500000 ? 1500 : n <= 7500000 ? 2500 : 5000,
    },
    rateUrl: "https://indianbank.bank.in/en/interest-rates-on-personal-segment-loan-products",
    applyUrl: "https://dlp.indianbank.bank.in/loanPortalHL/",
  },
  {
    logo: "/images/banks/iob.webp",
    name: "Indian Overseas Bank", rate: "7.45%", terms: "Salaried borrowers · credit score 800+",
    fee: {
      details: "0.50%, capped at ₹20,000 up to ₹75 lakh or ₹25,000 above. Air Force personnel qualify for a waiver.",
      source: "https://www.iob.bank.in/documents/d/guest/revision_of_service_charges_01042026",
      label: "Standard", estimate: n => Math.min(n * .005, n <= 7500000 ? 20000 : 25000),
    },
    rateUrl: "https://www.iob.bank.in/en/lending-interest-rates",
    applyUrl: "https://digitalloans.iob.bank.in:4843/lendperfect/landing",
  },
  {
    logo: "/images/banks/union.webp",
    name: "Union Bank of India", rate: "7.40%", terms: "Union Home · credit score 825+",
    fee: {
      details: "0.50% of the loan, capped at ₹15,000.",
      source: "https://www.unionbankofindia.bank.in/pdf/service-charges.pdf",
      label: "Standard", estimate: n => Math.min(n * .005, 15000),
    },
    rateUrl: "https://www.unionbankofindia.bank.in/pdf/retail_roi.pdf",
    applyUrl: "https://dbp.unionbankofindia.bank.in/assets/home-loan/landing",
  },
  {
    logo: "/images/banks/rbl.webp",
    name: "RBL Bank", rate: "9.00%+", terms: "Starting rate for RBL housing loans",
    fee: {
      details: "2% or ₹15,000, whichever is higher. Separate ₹5,000 application fee.",
      source: "https://webassets.rbl.bank.in/document/Service%20Charges/Charges20131130.pdf",
      label: "Processing", estimate: n => Math.max(n * .02, 15000),
    },
    rateUrl: "https://www.rbl.bank.in/personal-banking/loans/housing-loan",
    applyUrl: "https://www.rbl.bank.in/personal-banking/loans/housing-loan",
  },
  {
    logo: "/images/banks/bandhan.webp",
    name: "Bandhan Bank", rate: "8.80–13.77%", terms: "Suraksha Home Loan · floating rate",
    fee: {
      details: "0–1% depending on the scheme. A separate non-refundable login charge can be up to ₹4,000.",
      source: "https://www.bandhan.bank.in/sites/default/files/2026-07/Schedule-of-Charges-of-Home-Loan-and-LAP-03072026.pdf",
      label: "Up to", estimate: n => n * .01,
    },
    rateUrl: "https://www.bandhan.bank.in/rates-charges",
    applyUrl: "https://www.bandhan.bank.in/personal/home-loan/suraksha",
  },
  {
    logo: "/images/banks/idbi.webp",
    name: "IDBI Bank", rate: "7.50–9.15%", terms: "Salaried and self-employed professionals",
    fee: {
      details: "Salaried and self-employed professionals pay ₹10,000 up to ₹75 lakh, then ₹15,000.",
      source: "https://www.idbi.bank.in/pdf/soc/Loan-Accounts-Structured-retail-asset-products.pdf",
      label: "Standard", estimate: n => n <= 7500000 ? 10000 : 15000,
    },
    rateUrl: "https://www.idbi.bank.in/interest-rates.aspx",
    applyUrl: "https://apps.idbi.bank.in/IDBIRetailLoans/retail-loan-application-form.aspx",
  },
  {
    logo: "/images/banks/kotak.webp",
    name: "Kotak Mahindra Bank", rate: "7.70–12.00%", terms: "Salaried borrowers · floating rate",
    fee: {
      details: "0.50% for salaried borrowers, 1% for self-employed borrowers. ₹5,000 upfront towards processing.",
      source: "https://www.kotak.bank.in/content/dam/Kotak/gsfcfiles/loan/general-schdeule-of-fees-and-charges-dtd-18-02-25.pdf",
      label: "Salaried", estimate: n => n * .005,
    },
    rateUrl: "https://www.kotak.bank.in/en/rates.html",
    applyUrl: "https://homeloans.kotak.bank.in/loginDetail?flow=apply&pn=HL&cid=HL001",
  },
  {
    logo: "/images/banks/idfc.webp",
    name: "IDFC FIRST Bank", rate: "7.75%+", terms: "Starting rate in the bank’s home loan rate table",
    fee: {
      details: "Up to 3% of the sanctioned loan amount.",
      source: "https://www.idfcfirst.bank.in/personal-banking/loans/home-loan/home-loan-interest-rates",
      label: "Up to", estimate: n => n * .03,
    },
    rateUrl: "https://www.idfcfirst.bank.in/personal-banking/loans/home-loan/home-loan-interest-rates",
    applyUrl: "https://www.idfcfirst.bank.in/personal-banking/loans/home-loan/application",
  },
];
