import {
  CreateCardRequest,
  CreateKycSessionRequest,
  CreateUserRequest,
  UpdateUserKycDetailsRequest,
  UpdateUserRequest,
} from "./u54ApiService.request.types";
import {
  ApiResponse,
  CreateUserData,
  GetUserData,
  GetUserKycDetailsResponse,
  GetWalletResponse,
  GetWalletData,
  UpdateUserResponse,
  UpdateUserKycDetailsResponse,
  GetCardResponse,
  CreateCardResponse,
  GetCardPublicKeyData,
  GetEncryptedPANResponse,
  GetEncryptedCVVResponse,
  GetTransactionsData,
  GetTransactionData,
  CreateKycSessionData,
  CreateCardData,
} from "./u54ApiService.response.types";

type LoggedError = Error & { u54Logged?: boolean };

class U54ApiService {
  private readonly baseApiUrl: string;
  private readonly apiKey: string;

  constructor(baseApiUrl: string, apiKey: string) {
    this.baseApiUrl = `${baseApiUrl}`;
    this.apiKey = apiKey;
  }

  private getHeaders() {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const method = init?.method ?? "GET";
    const url = `${this.baseApiUrl}${path}`;
    const startMs = Date.now();

    console.info("[U54ApiService] Request started", {
      method,
      path,
      url,
    });

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
        ...init,
      });
      const durationMs = Date.now() - startMs;
      const rawBody = await response.text();
      let responseBody: unknown = {};

      if (rawBody) {
        try {
          responseBody = JSON.parse(rawBody);
        } catch {
          responseBody = { raw: rawBody };
        }
      }

      if (!response.ok) {
        const bodyAsRecord =
          responseBody && typeof responseBody === "object"
            ? (responseBody as Record<string, unknown>)
            : undefined;
        const errorMessage =
          (typeof bodyAsRecord?.error === "string" ? bodyAsRecord.error : "") ||
          (typeof bodyAsRecord?.message === "string"
            ? bodyAsRecord.message
            : "") ||
          `U54 request failed: ${response.status}`;
        console.error("[U54ApiService] Request failed", {
          method,
          path,
          url,
          status: response.status,
          durationMs,
          errorMessage,
          responseBody: JSON.stringify(responseBody),
        });
        const requestError: LoggedError = new Error(errorMessage);
        requestError.u54Logged = true;
        throw requestError;
      }

      console.info("[U54ApiService] Request completed", {
        method,
        path,
        url,
        status: response.status,
        durationMs,
      });
      return responseBody as T;
    } catch (error) {
      const durationMs = Date.now() - startMs;
      const typedError = error as LoggedError;
      if (!typedError?.u54Logged) {
        console.error("[U54ApiService] Request error", {
          method,
          path,
          url,
          durationMs,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  private async requestData<T>(path: string, init?: RequestInit): Promise<T> {
    const json = await this.request<ApiResponse<T>>(path, init);
    return json.data;
  }

  async createUser(data: CreateUserRequest): Promise<CreateUserData> {
    return this.requestData<CreateUserData>(`/user/`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getUser(userId: string): Promise<GetUserData> {
    return this.requestData<GetUserData>(`/user/${userId}`);
  }

  async updateUser(
    userId: string,
    data: UpdateUserRequest,
  ): Promise<UpdateUserResponse> {
    return this.requestData<UpdateUserResponse>(`/user/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getUserKycDetails(userId: string): Promise<GetUserKycDetailsResponse> {
    return this.request(`/user/${userId}/kyc`);
  }

  async updateUserKycDetails(
    userId: string,
    data: UpdateUserKycDetailsRequest,
  ): Promise<UpdateUserKycDetailsResponse> {
    return this.request(`/user/${userId}/kyc`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async createCard(data: CreateCardRequest): Promise<CreateCardData> {
    return this.requestData("/card", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getCard(cardId: string): Promise<GetCardResponse> {
    return this.requestData<GetCardResponse>(`/card/${cardId}`);
  }

  async stopCard(cardId: string) {
    return this.request(`/card/${cardId}/stop`, {
      method: "PATCH",
    });
  }

  async freezeCard(cardId: string) {
    return this.request(`/card/${cardId}/freeze`, {
      method: "PATCH",
    });
  }

  async unfreezeCard(cardId: string) {
    return this.request(`/card/${cardId}/unfreeze`, {
      method: "PATCH",
    });
  }

  async getPartnerWallet(): Promise<GetWalletResponse> {
    return this.request("/wallet/PARTNER", { method: "GET" });
  }

  async getUserWallets(
    limit: number = 100,
    cursor?: string,
  ): Promise<GetWalletData> {
    return this.requestData<GetWalletData>(
      `/wallets/USER?limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`,
      {
        method: "GET",
      },
    );
  }

  async getCardPublicKey(): Promise<GetCardPublicKeyData> {
    return this.requestData<GetCardPublicKeyData>("/card/public-key", {
      method: "GET",
    });
  }

  async getEncryptedPAN(
    cardId: string,
    sessionId: string,
  ): Promise<GetEncryptedPANResponse> {
    return this.requestData<GetEncryptedPANResponse>(`/card/${cardId}/pan`, {
      method: "GET",
      headers: {
        ...this.getHeaders(),
        "x-session-id": sessionId,
      },
    });
  }

  async getEncryptedCVV(
    cardId: string,
    sessionId: string,
  ): Promise<GetEncryptedCVVResponse> {
    return this.requestData<GetEncryptedCVVResponse>(`/card/${cardId}/cvv`, {
      method: "GET",
      headers: {
        ...this.getHeaders(),
        "x-session-id": sessionId,
      },
    });
  }

  async getTransactions(
    walletId: string,
    limit: number = 50,
    lek?: string,
  ): Promise<GetTransactionsData> {
    return this.requestData<GetTransactionsData>(
      `/wallet/${walletId}/transactions?limit=${limit}${lek ? `&cursor=${lek}` : ""}`,
      {
        method: "GET",
      },
    );
  }

  async getTransaction(transactionId: string): Promise<GetTransactionData> {
    return this.requestData<GetTransactionData>(
      `/transaction/${transactionId}`,
      { method: "GET" },
    );
  }

  async createKycSession(
    data: CreateKycSessionRequest,
  ): Promise<CreateKycSessionData> {
    return this.requestData(`/kyc/session`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

export const u54ApiService = new U54ApiService(
  process.env.U54_BASE_API_URL!,
  process.env.U54_API_KEY!,
);
