import { CardType } from "../types/cards";

export type CreateUserRequest = {
  firstName: string;
  lastName: string;
  dob: string;
  country: string;
  phoneNumber: string;
  email?: string;
  tpin?: string;
};

export type UpdateUserRequest = {
  email?: string;
  phoneNumber?: string;
};

export type UpdateUserKycDetailsRequest = {
  firstName: string;
  lastName: string;
  dob: string;
  country: string;
  tpin: string;
};

export type CreateCardRequest = {
  userId: string;
  cardType: CardType;
  billingAddress: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postalCode?: string;
    country: string;
  };
};

export type CreateKycSessionRequest = {
  userId: string;
  firstName: string;
  lastName: string;
  dob: string;
  country: string;
  tpin?: string;
};
