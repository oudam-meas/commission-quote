// The loan amount is in cents, which is what the vendor takes. The field names
// are the vendor's own.
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

export type VendorClient = {
  requestQuote: (loanDetails: LoanDetails) => Promise<Quote>;
};

export type VendorClientDependencies = {
  // fetch comes in as a dependency, the same way the vendor client itself does,
  // so a hand-written double can prove the url, the header and the body with no
  // network and no mocking library.
  fetch: typeof fetch;
  vendorUrl: string;
  vendorApiKey: string;
};

export type AppDependencies = {
  vendorClient: VendorClient;
};
