export type KycStatus =
  | "pending"
  | "processing"
  | "approved"
  | "awaiting_input"
  | "declined"
  | "review"
  | "abandoned"
  | "error"
  | "expired"
  | "sanction_list_hit";

export type ApiResponse<T> = {
  message: string;
  data: T;
};

export type CreateUserData = {
  userId: string;
  firstName: string;
  lastName: string;
  dob: string;
  country: string;
  phoneNumber: string;
  email?: string;
  tpin?: string;
  token: string;
  workflowRunId: string;
  kycUrl: string;
};

export type CreateUserResponse = ApiResponse<CreateUserData>;

export type GetUserData = {
  userId: string;
  firstName: string;
  lastName: string;
  dob: string;
  country: string;
  phoneNumber?: string;
  email?: string;
  tpin?: string;
  kycStatus: KycStatus;
  token?: string;
  workflowRunId?: string;
  kycUrl?: string;
};

export type GetUserResponse = ApiResponse<GetUserData>;

type DeclineReason = {
  errorCode: string;
  userFriendlyMessage: string;
};

export type GetUserKycDetailsData = {
  kycStatus: KycStatus;
  kycDocExpiryDate?: string;
  declineReasons?: DeclineReason[];
};

export type GetUserKycDetailsResponse = ApiResponse<GetUserKycDetailsData>;

/** USER wallet type – response shape when walletType is USER in GET /wallets/{walletType} */
export type UserWallet = {
  id: string;
  currency: "USD";
  userId: string;
};

export type GetWalletData = {
  wallets: UserWallet[];
  cursor?: string;
};

export type GetWalletResponse = ApiResponse<GetWalletData>;

export type UpdateUserKycDetailsData = {
  userId: string;
  firstName: string;
  lastName: string;
  dob: string;
  country: string;
  tpin?: string;
  kycStatus: KycStatus;
  token: string;
  workflowRunId: string;
  kycUrl: string;
};

export type UpdateUserKycDetailsResponse =
  ApiResponse<UpdateUserKycDetailsData>;

export type UpdateUserData = {
  userId: string;
  firstName: string;
  lastName: string;
  dob: string;
  country: string;
  phoneNumber?: string;
  email?: string;
  tpin?: string;
};
export type UpdateUserResponse = ApiResponse<UpdateUserData>;

export type GetCardData = {
  cardType: string;
  embossName: string;
  expiry: string;
  id: string;
  last4Digits: string;
  status: string;
};

export type GetCardResponse = ApiResponse<GetCardData>;

export type CreateCardData = {
  cardType: string;
  embossName: string;
  expiry: string;
  id: string;
  last4Digits: string;
  status: string;
};

export type CreateCardResponse = ApiResponse<CreateCardData>;

export type GetCardPublicKeyData = {
  publicKey: string;
};

export type GetCardPublicKeyResponse = ApiResponse<GetCardPublicKeyData>;

export type GetEncryptedPANData = {
  iv: string;
  secret: string;
};

export type GetEncryptedPANResponse = ApiResponse<GetEncryptedPANData>;

export type GetEncryptedCVVData = {
  iv: string;
  secret: string;
};

export type GetEncryptedCVVResponse = ApiResponse<GetEncryptedCVVData>;

export type Transaction = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt?: string;
  created?: string;
  direction?: string;
};

export type TransactionStatus = "pending" | "success" | "canceled" | "declined";

export type TransactionDirection = "in" | "out";

export type TransactionType =
  | "card"
  | "card-replacement"
  | "card-not-settled-refund"
  | "partner-balance"
  | "partner-card-issuance-fee"
  | "partner-card-decline-fee"
  | "partner-card-transaction-fee"
  | "partner-card-termination-fee";

/** Transaction detail from GET /v1/transaction/{id} */
export type TransactionDetail = {
  id: string;
  currency: "USD";
  fee: number;
  amount: number;
  totalAmount: number;
  status: TransactionStatus;
  created: string;
  direction: TransactionDirection;
  type: TransactionType;
};

export type GetTransactionsData = {
  transactions: Transaction[];
};

export type GetTransactionsResponse = ApiResponse<GetTransactionsData>;

export type GetTransactionData = TransactionDetail;

export type GetTransactionResponse = ApiResponse<GetTransactionData>;

export type CreateKycSessionData = {
  userId: string;
  firstName: string;
  lastName: string;
  dob: string;
  country: string;
  tpin?: string;
  email?: string;
  phoneNumber?: string;
  kycStatus: KycStatus;
  token: string;
  workflowRunId: string;
  kycUrl: string;
};
