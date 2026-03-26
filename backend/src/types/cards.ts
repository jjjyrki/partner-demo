export type CardType = "VIRTUAL" | "PHYSICAL";
export type BillingAddress = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode?: string;
  country: string;
};
