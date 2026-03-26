import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { Onfido } from "onfido-sdk-ui";
import {
  patchMe,
  createPartnerUser,
  getPartnerUser,
  getWallet,
  createPartnerCard,
  getPartnerCard,
  freezePartnerCard,
  unfreezePartnerCard,
  updatePartnerUser,
  updatePartnerUserKyc,
  type CreatePartnerUserInput,
  type CreatePartnerCardBillingAddress,
  startKycSession,
} from "../api/client";
import { getDecryptedPAN, getDecryptedCVV } from "../api/cardDecryption";

const ONFIDO_CONTAINER_ID = "onfido-mount";

function normalizeDateInput(value: string) {
  return value.includes("T") ? value.split("T")[0] : value;
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isPartnerDialogOpen, setIsPartnerDialogOpen] = useState(false);
  const [isPartnerUpdateDialogOpen, setIsPartnerUpdateDialogOpen] =
    useState(false);
  const [isCreateCardDialogOpen, setIsCreateCardDialogOpen] = useState(false);
  const [isKycMethodDialogOpen, setIsKycMethodDialogOpen] = useState(false);
  const [isOnfidoDialogOpen, setIsOnfidoDialogOpen] = useState(false);
  const [onfidoError, setOnfidoError] = useState("");
  const [kycStatusOverride, setKycStatusOverride] = useState<string | null>(
    null,
  );
  const [kycSession, setKycSession] = useState<{
    token: string;
    workflowRunId: string;
    kycUrl: string;
  } | null>(null);
  const onfidoHandleRef = useRef<{ tearDown: () => Promise<void> } | null>(
    null,
  );
  const [partnerForm, setPartnerForm] = useState<CreatePartnerUserInput>({
    firstName: "",
    lastName: "",
    dob: "",
    country: "",
    phoneNumber: "",
    email: "",
    tpin: "",
  });
  const [partnerUpdateForm, setPartnerUpdateForm] = useState({
    email: "",
    phoneNumber: "",
  });
  const [billingAddressForm, setBillingAddressForm] =
    useState<CreatePartnerCardBillingAddress>({
      addressLine1: "",
      addressLine2: "",
      city: "",
      country: "",
      postalCode: "",
    });
  const [revealedPAN, setRevealedPAN] = useState<string | null>(null);
  const [revealedCVV, setRevealedCVV] = useState<string | null>(null);
  const [panLoading, setPanLoading] = useState(false);
  const [cvvLoading, setCvvLoading] = useState(false);

  const partnerUserQuery = useQuery({
    queryKey: ["partner-user", user?.partner_user_id],
    queryFn: getPartnerUser,
    enabled: !!user?.partner_user_id,
    retry: false,
  });

  const walletQuery = useQuery({
    queryKey: ["wallet"],
    queryFn: getWallet,
    enabled: !!user,
  });

  const patchMutation = useMutation({
    mutationFn: patchMe,
    onSuccess: async () => {
      await refreshUser();
      setSuccess("Profile updated");
      setPassword("");
      setConfirmPassword("");
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Update failed");
    },
  });

  const createPartnerUserMutation = useMutation({
    mutationFn: createPartnerUser,
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["partner-user"] });
      setSuccess("Partner user created and linked");
      setError("");
      setIsPartnerDialogOpen(false);
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : "Failed to create partner user",
      );
    },
  });

  const updatePartnerUserMutation = useMutation({
    mutationFn: updatePartnerUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-user"] });
      setSuccess("Partner user updated");
      setError("");
      setIsPartnerUpdateDialogOpen(false);
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : "Failed to update partner user",
      );
    },
  });

  const updateKycMutation = useMutation({
    mutationFn: startKycSession,
    onSuccess: (response) => {
      setKycSession(response);
      setIsKycMethodDialogOpen(true);
      setSuccess("");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["partner-user"] });
    },
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : "Failed to prepare KYC session",
      );
    },
  });

  const partnerUser = partnerUserQuery.data?.partner_user;
  const serverKycStatus =
    partnerUser?.kycStatus ?? user?.kyc_status ?? "pending";
  const displayedKycStatus =
    kycStatusOverride === "processing" && serverKycStatus === "pending"
      ? "processing"
      : serverKycStatus;
  const isKycApproved = displayedKycStatus === "approved";

  const partnerCardQuery = useQuery({
    queryKey: ["partner-card", user?.id],
    queryFn: getPartnerCard,
    enabled: !!user?.partner_user_id && isKycApproved,
    retry: false,
  });

  const createPartnerCardMutation = useMutation({
    mutationFn: createPartnerCard,
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["partner-card"] });
      setSuccess("Card created successfully");
      setError("");
      setIsCreateCardDialogOpen(false);
      setBillingAddressForm({ addressLine1: "", city: "", country: "" });
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to create card");
    },
  });

  const freezePartnerCardMutation = useMutation({
    mutationFn: freezePartnerCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-card"] });
      setSuccess("Card frozen");
      setError("");
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to freeze card");
    },
  });

  const unfreezePartnerCardMutation = useMutation({
    mutationFn: unfreezePartnerCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-card"] });
      setSuccess("Card unfrozen");
      setError("");
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to unfreeze card");
    },
  });

  useEffect(() => {
    if (displayedKycStatus !== "processing") {
      return;
    }

    let isCancelled = false;
    let intervalId: number | undefined;

    const syncKycState = async () => {
      try {
        await refreshUser();
        await queryClient.invalidateQueries({ queryKey: ["me"] });
        await queryClient.invalidateQueries({ queryKey: ["partner-user"] });
      } catch {
        // Keep polling even if one refresh fails transiently.
      }
    };

    const timeoutId = window.setTimeout(() => {
      if (isCancelled) {
        return;
      }

      void syncKycState();
      intervalId = window.setInterval(() => {
        void syncKycState();
      }, 1000);
    }, 1000);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [displayedKycStatus, queryClient, refreshUser]);

  useEffect(() => {
    if (
      !isOnfidoDialogOpen ||
      !kycSession?.token ||
      !kycSession?.workflowRunId
    ) {
      return;
    }

    try {
      onfidoHandleRef.current = Onfido.init({
        token: kycSession.token,
        workflowRunId: kycSession.workflowRunId,
        containerId: ONFIDO_CONTAINER_ID,
        onComplete: () => {
          setKycStatusOverride("processing");
          setSuccess(
            "Verification submitted. KYC status updates after provider processing.",
          );
          setError("");
          setIsOnfidoDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ["me"] });
          queryClient.invalidateQueries({ queryKey: ["partner-user"] });
          setTimeout(() => setSuccess(""), 5000);
        },
        onError: (sdkError: { message?: string }) => {
          setOnfidoError(sdkError?.message || "Onfido flow failed to start");
        },
      });
    } catch (sdkInitError) {
      const message =
        sdkInitError instanceof Error
          ? sdkInitError.message
          : "Unable to initialize Onfido SDK";
      window.setTimeout(() => setOnfidoError(message), 0);
    }

    return () => {
      const handle = onfidoHandleRef.current;
      onfidoHandleRef.current = null;
      if (handle) {
        void handle.tearDown().catch(() => undefined);
      }
    };
  }, [
    isOnfidoDialogOpen,
    kycSession?.token,
    kycSession?.workflowRunId,
    queryClient,
  ]);

  const handleStartKyc = () => {
    const existingPartnerUser = partnerUserQuery.data?.partner_user;
    if (!existingPartnerUser) {
      setError("Partner user details are unavailable");
      return;
    }
    const nextTpin = existingPartnerUser.tpin?.trim();
    if (nextTpin && nextTpin.length !== 10) {
      setError("TPIN must be exactly 10 characters when provided");
      return;
    }

    setError("");
    setSuccess("");
    setOnfidoError("");
    setIsOnfidoDialogOpen(false);
    setIsKycMethodDialogOpen(false);
    setKycSession(null);

    updateKycMutation.mutate({
      firstName: existingPartnerUser.firstName.trim(),
      lastName: existingPartnerUser.lastName.trim(),
      dob: normalizeDateInput(existingPartnerUser.dob),
      country: existingPartnerUser.country.trim(),
      tpin: nextTpin,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    const updates: { username?: string; password?: string } = {};
    const nextUsername = (username || user?.username || "").trim();
    if (nextUsername !== user?.username) updates.username = nextUsername;
    if (password) updates.password = password;
    if (Object.keys(updates).length === 0) {
      setError("No changes to save");
      return;
    }
    patchMutation.mutate(updates);
  };

  const handlePartnerFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    createPartnerUserMutation.mutate({
      firstName: partnerForm.firstName.trim(),
      lastName: partnerForm.lastName.trim(),
      dob: partnerForm.dob.trim(),
      country: partnerForm.country.trim(),
      phoneNumber: partnerForm.phoneNumber.trim(),
      email: partnerForm.email.trim(),
      tpin: partnerForm.tpin?.trim() || undefined,
    });
  };

  const handleCreateCardFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    createPartnerCardMutation.mutate({
      addressLine1: billingAddressForm.addressLine1.trim(),
      city: billingAddressForm.city.trim(),
      country: billingAddressForm.country.trim(),
    });
  };

  const handlePartnerUpdateFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const existingPartnerUser = partnerUserQuery.data?.partner_user;
    if (!existingPartnerUser) {
      setError("Partner user details are unavailable");
      return;
    }

    const updates: { email?: string; phoneNumber?: string } = {};
    const nextEmail = partnerUpdateForm.email.trim();
    const nextPhoneNumber = partnerUpdateForm.phoneNumber.trim();

    if (nextEmail !== (existingPartnerUser.email ?? "")) {
      updates.email = nextEmail;
    }
    if (nextPhoneNumber !== (existingPartnerUser.phoneNumber ?? "")) {
      updates.phoneNumber = nextPhoneNumber;
    }

    if (Object.keys(updates).length === 0) {
      setError("No changes to submit");
      return;
    }

    updatePartnerUserMutation.mutate(updates);
  };

  if (!user) {
    return (
      <div className="text-center py-12 text-slate-400">
        Please log in to view your profile.
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Profile</h1>

      <div className="mb-8 p-4 rounded-xl bg-slate-900/60 border border-slate-700/50">
        <h2 className="text-sm font-medium text-slate-400 mb-2">Account</h2>
        <div className="space-y-2">
          {!user.partner_user_id && (
            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setPartnerForm({
                  firstName: user.username,
                  lastName: "",
                  dob: "",
                  country: "",
                  phoneNumber: "",
                  email: `${user.username.toLowerCase()}@example.com`,
                  tpin: "",
                });
                setIsPartnerDialogOpen(true);
              }}
              disabled={createPartnerUserMutation.isPending}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50"
            >
              {createPartnerUserMutation.isPending
                ? "Creating..."
                : "Create user"}
            </button>
          )}
          {user.partner_user_id && partnerUserQuery.isLoading && (
            <p className="text-slate-400 text-sm">Loading partner user...</p>
          )}
          {partnerUserQuery.data?.partner_user && (
            <div className="rounded-lg bg-slate-800/80 border border-slate-700 p-3 text-sm text-slate-300 space-y-1">
              <p>
                Partner User ID:{" "}
                <span className="text-slate-100 font-mono">
                  {partnerUserQuery.data.partner_user.userId}
                </span>
              </p>
              <p>
                KYC Status:{" "}
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    displayedKycStatus === "approved"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {displayedKycStatus}
                </span>
              </p>
              <p>
                Name:{" "}
                <span className="text-slate-100">
                  {partnerUserQuery.data.partner_user.firstName}{" "}
                  {partnerUserQuery.data.partner_user.lastName}
                </span>
              </p>
              <p>
                Phone:{" "}
                <span className="text-slate-100">
                  {partnerUserQuery.data.partner_user.phoneNumber}
                </span>
              </p>
              <p>
                Country:{" "}
                <span className="text-slate-100">
                  {partnerUserQuery.data.partner_user.country}
                </span>
              </p>
              <p>
                DOB:{" "}
                <span className="text-slate-100">
                  {partnerUserQuery.data.partner_user.dob}
                </span>
              </p>
              <p>
                TPIN:{" "}
                <span className="text-slate-100">
                  {partnerUserQuery.data.partner_user.tpin}
                </span>
              </p>
              {displayedKycStatus !== "approved" && (
                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      const partnerUser = partnerUserQuery.data?.partner_user;
                      if (!partnerUser) return;
                      setError("");
                      setSuccess("");
                      setPartnerUpdateForm({
                        email: partnerUser.email ?? "",
                        phoneNumber: partnerUser.phoneNumber ?? "",
                      });
                      setIsPartnerUpdateDialogOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium"
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    onClick={handleStartKyc}
                    disabled={updateKycMutation.isPending}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium disabled:opacity-50"
                  >
                    {updateKycMutation.isPending ? "Preparing..." : "Start KYC"}
                  </button>
                </div>
              )}
            </div>
          )}
          {user.partner_user_id &&
            partnerUserQuery.isError &&
            !partnerUserQuery.data?.partner_user && (
              <p className="text-amber-400 text-sm">
                Partner user is linked, but details are unavailable right now.
              </p>
            )}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700/60">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Wallet</h3>
          {walletQuery.isLoading && (
            <p className="text-slate-400 text-sm">Loading wallet...</p>
          )}
          {walletQuery.isError && (
            <p className="text-amber-400 text-sm">
              Failed to load wallet details.
            </p>
          )}
          {walletQuery.data && (
            <div className="rounded-lg bg-slate-800/80 border border-slate-700 p-3 text-sm text-slate-300 space-y-1">
              <p>
                Available:{" "}
                <span className="text-amber-400 font-medium">
                  ${(walletQuery.data.available_balance / 100).toFixed(2)}
                </span>
              </p>
              <p>
                Locked:{" "}
                <span className="text-slate-400">
                  ${(walletQuery.data.locked_balance / 100).toFixed(2)}
                </span>
              </p>
              <p>
                Status:{" "}
                <span className="text-slate-100">
                  {walletQuery.data.status}
                </span>
              </p>
              {walletQuery.data.wallet_id && (
                <p>
                  Wallet ID:{" "}
                  <span className="text-slate-100 font-mono">
                    {walletQuery.data.wallet_id}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        {user.partner_user_id && (
          <div className="mt-4 pt-4 border-t border-slate-700/60">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Card</h3>
            {!isKycApproved && (
              <p className="text-slate-400 text-sm">
                KYC must be approved before creating a card.
              </p>
            )}
            {isKycApproved && partnerCardQuery.isLoading && (
              <p className="text-slate-400 text-sm">Loading card...</p>
            )}
            {isKycApproved && partnerCardQuery.data?.card && (
              <div className="rounded-lg bg-slate-800/80 border border-slate-700 p-3 text-sm text-slate-300 space-y-1">
                <p>
                  Card ID:{" "}
                  <span className="text-slate-100 font-mono">
                    {partnerCardQuery.data.card.id}
                  </span>
                </p>
                <p>
                  Type:{" "}
                  <span className="text-slate-100">
                    {partnerCardQuery.data.card.cardType}
                  </span>
                </p>
                <p>
                  Expiry:{" "}
                  <span className="text-slate-100">
                    {partnerCardQuery.data.card.expiry}
                  </span>
                </p>
                <p>
                  Status:{" "}
                  <span className="text-slate-100">
                    {partnerCardQuery.data.card.status}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  Card number:{" "}
                  <span className="text-slate-100 font-mono">
                    {revealedPAN !== null
                      ? revealedPAN
                          .replace(/\s/g, "")
                          .replace(/(.{4})/g, "$1 ")
                          .trim()
                      : `**** ${partnerCardQuery.data.card.last4Digits}`}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (revealedPAN !== null) {
                        setRevealedPAN(null);
                        return;
                      }
                      setPanLoading(true);
                      setError("");
                      try {
                        const pan = await getDecryptedPAN();
                        setRevealedPAN(pan);
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Failed to load PAN",
                        );
                      } finally {
                        setPanLoading(false);
                      }
                    }}
                    disabled={panLoading}
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs disabled:opacity-50"
                  >
                    {panLoading
                      ? "Loading..."
                      : revealedPAN !== null
                        ? "Hide"
                        : "Reveal"}
                  </button>
                </p>
                <p className="flex items-center gap-2">
                  CVV:{" "}
                  <span className="text-slate-100 font-mono">
                    {revealedCVV !== null ? revealedCVV : "***"}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (revealedCVV !== null) {
                        setRevealedCVV(null);
                        return;
                      }
                      setCvvLoading(true);
                      setError("");
                      try {
                        const cvv = await getDecryptedCVV();
                        setRevealedCVV(cvv);
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Failed to load CVV",
                        );
                      } finally {
                        setCvvLoading(false);
                      }
                    }}
                    disabled={cvvLoading}
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs disabled:opacity-50"
                  >
                    {cvvLoading
                      ? "Loading..."
                      : revealedCVV !== null
                        ? "Hide"
                        : "Reveal"}
                  </button>
                </p>
                <div className="pt-2 flex gap-2">
                  {partnerCardQuery.data.card.status?.toLowerCase() ===
                  "frozen" ? (
                    <button
                      type="button"
                      onClick={() => unfreezePartnerCardMutation.mutate()}
                      disabled={unfreezePartnerCardMutation.isPending}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-50"
                    >
                      {unfreezePartnerCardMutation.isPending
                        ? "Unfreezing..."
                        : "Unfreeze"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => freezePartnerCardMutation.mutate()}
                      disabled={
                        freezePartnerCardMutation.isPending ||
                        partnerCardQuery.data.card.status?.toLowerCase() ===
                          "stopped"
                      }
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium disabled:opacity-50"
                    >
                      {freezePartnerCardMutation.isPending
                        ? "Freezing..."
                        : "Freeze"}
                    </button>
                  )}
                </div>
              </div>
            )}
            {isKycApproved &&
              partnerCardQuery.isError &&
              (partnerCardQuery.error instanceof Error
                ? !partnerCardQuery.error.message.includes("Card not created")
                : true) && (
                <p className="text-red-400 text-sm">
                  {partnerCardQuery.error instanceof Error
                    ? partnerCardQuery.error.message
                    : "Failed to load card"}
                </p>
              )}
            {isKycApproved && !partnerCardQuery.data?.card && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setBillingAddressForm((prev) => ({
                    ...prev,
                    country: partnerUser?.country ?? prev.country,
                  }));
                  setIsCreateCardDialogOpen(true);
                }}
                disabled={createPartnerCardMutation.isPending}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {createPartnerCardMutation.isPending
                  ? "Creating..."
                  : "Create card"}
              </button>
            )}
          </div>
        )}
      </div>

      {isPartnerDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-700 p-5">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">
              Create partner user
            </h2>
            <form onSubmit={handlePartnerFormSubmit} className="space-y-3">
              <input
                required
                value={partnerForm.firstName}
                onChange={(e) =>
                  setPartnerForm((prev) => ({
                    ...prev,
                    firstName: e.target.value,
                  }))
                }
                placeholder="First name"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100"
              />
              <input
                required
                value={partnerForm.lastName}
                onChange={(e) =>
                  setPartnerForm((prev) => ({
                    ...prev,
                    lastName: e.target.value,
                  }))
                }
                placeholder="Last name"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100"
              />
              <input
                required
                type="date"
                value={partnerForm.dob}
                onChange={(e) =>
                  setPartnerForm((prev) => ({ ...prev, dob: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100"
              />
              <input
                required
                value={partnerForm.country}
                onChange={(e) =>
                  setPartnerForm((prev) => ({
                    ...prev,
                    country: e.target.value,
                  }))
                }
                placeholder="Country (e.g. ZM)"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100"
              />
              <input
                required
                value={partnerForm.phoneNumber}
                onChange={(e) =>
                  setPartnerForm((prev) => ({
                    ...prev,
                    phoneNumber: e.target.value,
                  }))
                }
                placeholder="Phone number"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100"
              />
              <input
                required
                type="email"
                value={partnerForm.email}
                onChange={(e) =>
                  setPartnerForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="Email"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100"
              />
              <input
                value={partnerForm.tpin || ""}
                onChange={(e) =>
                  setPartnerForm((prev) => ({ ...prev, tpin: e.target.value }))
                }
                placeholder="TPIN (optional)"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPartnerDialogOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPartnerUserMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
                >
                  {createPartnerUserMutation.isPending
                    ? "Creating..."
                    : "Create partner user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCreateCardDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-700 p-5">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">
              Billing address
            </h2>
            <p className="text-slate-400 text-sm mb-4">
              Enter your billing address for the card.
            </p>
            <form onSubmit={handleCreateCardFormSubmit} className="space-y-3">
              <input
                required
                value={billingAddressForm.addressLine1}
                onChange={(e) =>
                  setBillingAddressForm((prev) => ({
                    ...prev,
                    addressLine1: e.target.value,
                  }))
                }
                placeholder="Address line 1"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100"
              />
              <input
                required
                value={billingAddressForm.addressLine2}
                onChange={(e) =>
                  setBillingAddressForm((prev) => ({
                    ...prev,
                    addressLine2: e.target.value,
                  }))
                }
                placeholder="Address line 2"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100"
              />
              <input
                required
                value={billingAddressForm.city}
                onChange={(e) =>
                  setBillingAddressForm((prev) => ({
                    ...prev,
                    city: e.target.value,
                  }))
                }
                placeholder="City"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100"
              />
              <input
                required
                value={billingAddressForm.postalCode}
                onChange={(e) =>
                  setBillingAddressForm((prev) => ({
                    ...prev,
                    postalCode: e.target.value,
                  }))
                }
                placeholder="Postal code"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100"
              />
              <input
                required
                value={billingAddressForm.country}
                onChange={(e) =>
                  setBillingAddressForm((prev) => ({
                    ...prev,
                    country: e.target.value,
                  }))
                }
                placeholder="Country (e.g. ZM)"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateCardDialogOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPartnerCardMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
                >
                  {createPartnerCardMutation.isPending
                    ? "Creating..."
                    : "Create card"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPartnerUpdateDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-700 p-5">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">
              Update user details
            </h2>
            <form
              onSubmit={handlePartnerUpdateFormSubmit}
              className="space-y-3"
            >
              <input
                type="email"
                value={partnerUpdateForm.email}
                onChange={(e) =>
                  setPartnerUpdateForm((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                placeholder="Email"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100"
              />
              <input
                value={partnerUpdateForm.phoneNumber}
                onChange={(e) =>
                  setPartnerUpdateForm((prev) => ({
                    ...prev,
                    phoneNumber: e.target.value,
                  }))
                }
                placeholder="Phone number"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPartnerUpdateDialogOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatePartnerUserMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
                >
                  {updatePartnerUserMutation.isPending
                    ? "Submitting..."
                    : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isOnfidoDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-slate-900 border border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-100">
                KYC verification
              </h2>
              <button
                type="button"
                onClick={() => setIsOnfidoDialogOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium"
              >
                Close
              </button>
            </div>
            {onfidoError && (
              <p className="mb-3 text-sm text-red-400 bg-red-950/30 px-3 py-2 rounded-lg">
                {onfidoError}
              </p>
            )}
            <div
              id={ONFIDO_CONTAINER_ID}
              className="min-h-[520px] rounded-lg overflow-hidden bg-slate-950"
            />
          </div>
        </div>
      )}

      {isKycMethodDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-700 p-5">
            <h2 className="text-lg font-semibold text-slate-100 mb-2">
              Choose KYC method
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Continue with hosted web verification or in-app SDK flow.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsKycMethodDialogOpen(false);
                  setKycSession(null);
                }}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!kycSession?.kycUrl) {
                    setError("KYC web URL is unavailable");
                    return;
                  }
                  window.location.assign(kycSession.kycUrl);
                }}
                disabled={!kycSession?.kycUrl}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm disabled:opacity-50"
              >
                Web
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!kycSession?.token || !kycSession?.workflowRunId) {
                    setError("KYC SDK details are unavailable");
                    return;
                  }
                  setOnfidoError("");
                  setIsKycMethodDialogOpen(false);
                  setIsOnfidoDialogOpen(true);
                }}
                disabled={!kycSession?.token || !kycSession?.workflowRunId}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
              >
                SDK
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Username
          </label>
          <input
            type="text"
            value={username || user.username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            New password (leave blank to keep current)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Min 6 characters"
          />
        </div>
        {password && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        )}
        {success && (
          <p className="text-sm text-emerald-400 bg-emerald-950/30 px-3 py-2 rounded-lg">
            {success}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-400 bg-red-950/30 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={patchMutation.isPending}
          className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-50"
        >
          {patchMutation.isPending ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
