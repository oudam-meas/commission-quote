export type LoanDetails = {
  loanAmount: number;
  loanTermInMonths: number;
  riskBand: string;
};

export type Quote = {
  quoteId: string;
  commissionRate: number;
  totalCommission: number;
};

export type QuoteFormProps = {
  onSubmit: (loanDetails: LoanDetails) => void;
  disabled?: boolean;
};
