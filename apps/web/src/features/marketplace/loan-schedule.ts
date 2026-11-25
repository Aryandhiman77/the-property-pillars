export const defaultLoanTerms = {annualInterestRate: 8.5, tenureYears: 20} as const;

type Installment = {
  period: number;
  principal: number;
  interest: number;
  payment: number;
  balance: number;
};

export function calculateLoanSchedule(
  principalAmount: number,
  annualInterestRate: number,
  tenureYears: number,
  minorUnit: number,
) {
  const principal = Math.round(principalAmount * minorUnit);
  const term = tenureYears * 12;
  const rate = annualInterestRate / 1200;
  const exactPayment = rate === 0
    ? principal / term
    : principal * rate / -Math.expm1(-term * Math.log1p(rate));
  const roundedPayment = Math.round(exactPayment);
  const payment = rate === 0 && roundedPayment * (term - 1) >= principal
    ? Math.floor(exactPayment)
    : roundedPayment;

  const monthly: Installment[] = [];
  const yearly: Installment[] = [];
  let balance = principal;
  let totalInterest = 0;

  // Keep the ledger in minor units so every row ties back to the summary.
  for (let period = 1; period <= term && balance > 0; period += 1) {
    const interest = Math.round(balance * rate);
    const due = balance + interest;
    const amountPaid = period === term ? due : Math.min(payment, due);
    const principalPaid = amountPaid - interest;
    balance -= principalPaid;
    totalInterest += interest;
    monthly.push({period, principal: principalPaid, interest, payment: amountPaid, balance});

    const yearIndex = Math.floor((period - 1) / 12);
    const year = yearly[yearIndex];
    if (year) {
      year.principal += principalPaid;
      year.interest += interest;
      year.payment += amountPaid;
      year.balance = balance;
    } else {
      yearly.push({period: yearIndex + 1, principal: principalPaid, interest, payment: amountPaid, balance});
    }
  }

  return {principal, payment, totalInterest, total: principal + totalInterest, monthly, yearly};
}
