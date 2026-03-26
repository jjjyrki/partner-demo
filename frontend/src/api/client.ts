const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

function getToken(): string | null {
  return localStorage.getItem("token");
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data as T;
}

// Auth
export interface AuthUser {
  id: number;
  username: string;
  kyc_status: string;
  partner_user_id: string | null;
  partner_card_id?: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export function register(username: string, password: string) {
  return api<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function login(username: string, password: string) {
  return api<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export interface MeResponse extends AuthUser {
  wallet: {
    available_balance: number;
    locked_balance: number;
    status: string;
  } | null;
}

export function getMe() {
  return api<MeResponse>("/auth/me");
}

// Users
export interface VirtualCard {
  lastFour: string;
  brand: string;
  holderName: string;
  expiryMonth: number;
  expiryYear: number;
  maskedCvv: string;
  cvvRevealed: string;
}

export function getVirtualCard() {
  return api<VirtualCard>("/users/me/virtual-card");
}

export function patchMe(data: { username?: string; password?: string }) {
  return api<AuthUser>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export interface CreatePartnerUserInput {
  firstName: string;
  lastName: string;
  dob: string;
  country: string;
  phoneNumber: string;
  email: string;
  tpin?: string;
}

export interface UpdatePartnerUserInput {
  email?: string;
  phoneNumber?: string;
}

export interface CreatePartnerUserData {
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
}

export interface PartnerUser extends CreatePartnerUserData {
  kycStatus: string;
}

export function createPartnerUser(data: CreatePartnerUserInput) {
  return api<{ partner_user_id: string; partner_user: CreatePartnerUserData }>(
    "/users/me/create-partner-user",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export function updatePartnerUser(data: UpdatePartnerUserInput) {
  return api<{ partner_user_id: string; partner_user: PartnerUser }>(
    "/users/me/partner-user",
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
}

export function getPartnerUser() {
  return api<{ partner_user_id: string; partner_user: PartnerUser }>(
    "/users/me/partner-user",
  );
}

export interface PartnerCard {
  cardType: string;
  embossName: string;
  expiry: string;
  id: string;
  last4Digits: string;
  status: string;
}

export function getPartnerCard() {
  return api<{ card_id: string; card: PartnerCard }>("/card");
}

export interface CreatePartnerCardBillingAddress {
  addressLine1: string;
  addressLine2?: string;
  postalCode?: string;
  city: string;
  country: string;
}

export function createPartnerCard(
  billingAddress: CreatePartnerCardBillingAddress,
) {
  return api<{ card_id: string; card: PartnerCard }>("/card", {
    method: "POST",
    body: JSON.stringify({ billingAddress }),
  });
}

export function freezePartnerCard() {
  return api<{ message: string; data?: unknown }>("/card/freeze", {
    method: "PATCH",
  });
}

export function unfreezePartnerCard() {
  return api<{ message: string; data?: unknown }>("/card/unfreeze", {
    method: "PATCH",
  });
}

export function stopPartnerCard() {
  return api<{ message: string; data?: unknown }>("/card/stop", {
    method: "PATCH",
  });
}

export interface CardPublicKeyData {
  publicKey: string;
}

export interface CardPublicKeyResponse {
  data: CardPublicKeyData;
}

export async function getCardPublicKey(): Promise<CardPublicKeyData> {
  const response = await api<CardPublicKeyResponse>("/card/public-key");
  return response.data;
}

export interface EncryptedCardData {
  iv: string;
  secret: string;
}

export interface EncryptedCardDataResponse {
  data: EncryptedCardData;
}

export function getEncryptedPAN(sessionId: string): Promise<EncryptedCardData> {
  return api<EncryptedCardDataResponse>("/card/pan", {
    headers: { "x-session-id": sessionId },
  }).then((r) => r.data);
}

export function getEncryptedCVV(sessionId: string): Promise<EncryptedCardData> {
  return api<EncryptedCardDataResponse>("/card/cvv", {
    headers: { "x-session-id": sessionId },
  }).then((r) => r.data);
}

export function updatePartnerUserKyc(data: UpdatePartnerUserKycInput) {
  return api<
    { partner_user_id: string; partner_user: PartnerUser } | PartnerUser
  >("/users/me/kyc", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function startKycSession(data: StartKycSessionInput) {
  return api<StartKycSessionResponse>("/kyc/session", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface StartKycSessionInput {
  firstName: string;
  lastName: string;
  dob: string;
  country: string;
  tpin?: string;
}

export interface StartKycSessionResponse {
  token: string;
  workflowRunId: string;
  kycUrl: string;
}
export interface UpdatePartnerUserKycInput {
  firstName: string;
  lastName: string;
  dob: string;
  country: string;
  tpin?: string;
}

export interface Wallet {
  available_balance: number;
  locked_balance: number;
  status: string;
  wallet_id?: string;
  partner_wallet_available?: boolean;
}

export type WalletType = "USER" | "PARTNER";

export function getWallet() {
  return api<Wallet>("/wallet");
}

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt?: string;
  created?: string;
  direction?: string;
}

export interface TransactionDetail {
  id: string;
  currency: "USD";
  fee: number;
  amount: number;
  totalAmount: number;
  status: "pending" | "success" | "canceled" | "declined";
  created: string;
  direction: "in" | "out";
  type:
    | "card"
    | "card-replacement"
    | "card-not-settled-refund"
    | "partner-balance"
    | "partner-card-issuance-fee"
    | "partner-card-decline-fee"
    | "partner-card-transaction-fee"
    | "partner-card-termination-fee";
}

export function getTransactions(walletType: WalletType) {
  return api<Transaction[]>(
    `/wallet/transactions?walletType=${encodeURIComponent(walletType)}`,
  );
}

export function getTransaction(id: string) {
  return api<TransactionDetail>(
    `/wallet/transactions/${encodeURIComponent(id)}`,
  );
}

// Tasks
export interface TaskStep {
  id: number;
  task_id: number;
  step_order: number;
  label: string;
}

export interface TaskUser {
  id: number;
  username: string;
}

export interface TaskSubmission {
  id: number;
  task_id: number;
  completer_user_id: number;
  completed_step_ids: number[];
  submitted_at: string;
  approved_at: string | null;
  User?: TaskUser;
}

export interface Task {
  id: number;
  owner_user_id: number;
  title: string;
  description: string | null;
  reward_amount: number;
  status: "open" | "in_review" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  User?: TaskUser;
  TaskSteps?: TaskStep[];
  TaskSubmission?: TaskSubmission | null;
}

export function getTasks(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return api<Task[]>(`/tasks${q}`);
}

export function getTask(id: number) {
  return api<Task>(`/tasks/${id}`);
}

export function createTask(data: {
  title: string;
  description?: string;
  steps: { label: string }[];
  reward_amount: number;
}) {
  return api<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTask(
  id: number,
  data: {
    title?: string;
    description?: string;
    steps?: { label: string }[];
    reward_amount?: number;
  },
) {
  return api<Task>(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function cancelTask(id: number) {
  return api<{ message: string }>(`/tasks/${id}`, {
    method: "DELETE",
  });
}

export function submitTask(id: number, completed_step_ids: number[]) {
  return api<Task>(`/tasks/${id}/submit`, {
    method: "POST",
    body: JSON.stringify({ completed_step_ids }),
  });
}

export function approveTask(id: number) {
  return api<Task>(`/tasks/${id}/approve`, {
    method: "POST",
  });
}

// Messages
export interface TaskMessage {
  id: number;
  task_id: number;
  author_user_id: number;
  body: string;
  created_at: string;
  User?: TaskUser;
}

export function getMessages(taskId: number) {
  return api<TaskMessage[]>(`/tasks/${taskId}/messages`);
}

export function postMessage(taskId: number, body: string) {
  return api<TaskMessage>(`/tasks/${taskId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}
