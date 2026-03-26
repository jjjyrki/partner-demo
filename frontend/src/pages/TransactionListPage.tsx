import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import {
  getWallet,
  getTransactions,
  getTransaction,
  type WalletType,
} from "../api/client";
import type { Transaction } from "../api/client";

function formatTransactionDate(tx: Transaction): string {
  const dateStr = tx.created ?? tx.createdAt;
  if (!dateStr || typeof dateStr !== "string") return "—";
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function TransactionListPage() {
  const { user } = useAuth();
  const [walletType, setWalletType] = useState<WalletType>("USER");
  const [selectedTransactionId, setSelectedTransactionId] = useState<
    string | null
  >(null);

  const closeModal = useCallback(() => setSelectedTransactionId(null), []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    if (selectedTransactionId) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [selectedTransactionId, closeModal]);

  const {
    data: selectedTransaction,
    isLoading: transactionDetailLoading,
    error: transactionDetailError,
  } = useQuery({
    queryKey: ["transaction", selectedTransactionId],
    queryFn: () => getTransaction(selectedTransactionId!),
    enabled: !!selectedTransactionId,
  });

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["wallet"],
    queryFn: getWallet,
    enabled: !!user,
  });

  const canFetchUser = !!wallet?.wallet_id;
  const canFetchPartner = !!wallet?.partner_wallet_available;
  const canFetchTransactions =
    (walletType === "USER" && canFetchUser) ||
    (walletType === "PARTNER" && canFetchPartner);

  const {
    data: transactions,
    isLoading: transactionsLoading,
    error,
  } = useQuery({
    queryKey: ["transactions", walletType],
    queryFn: () => getTransactions(walletType),
    enabled: !!user && canFetchTransactions,
    refetchInterval: 2000,
  });

  const isLoading = walletLoading || transactionsLoading;

  if (!user) {
    return (
      <div className="text-center py-12 text-slate-400">
        Please log in to view your transactions.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Transactions</h1>
        <div className="flex rounded-lg bg-slate-800/60 p-1 border border-slate-700/50">
          <button
            type="button"
            onClick={() => setWalletType("USER")}
            disabled={!canFetchUser}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              walletType === "USER"
                ? "bg-slate-700 text-slate-100"
                : canFetchUser
                  ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                  : "text-slate-600 cursor-not-allowed"
            }`}
          >
            User wallet
          </button>
          <button
            type="button"
            onClick={() => setWalletType("PARTNER")}
            disabled={!canFetchPartner}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              walletType === "PARTNER"
                ? "bg-slate-700 text-slate-100"
                : canFetchPartner
                  ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                  : "text-slate-600 cursor-not-allowed"
            }`}
          >
            Partner wallet
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="text-slate-400 py-12 text-center">
          Loading transactions...
        </div>
      )}
      {error && (
        <div className="text-red-400 py-4 bg-red-950/30 rounded-lg px-4">
          {error instanceof Error
            ? error.message
            : "Failed to load transactions"}
        </div>
      )}
      {!walletLoading && walletType === "USER" && !canFetchUser && (
        <div className="text-slate-500 py-12 text-center rounded-lg border border-dashed border-slate-700">
          Link your partner account to view user wallet transactions.
        </div>
      )}
      {!walletLoading && walletType === "PARTNER" && !canFetchPartner && (
        <div className="text-slate-500 py-12 text-center rounded-lg border border-dashed border-slate-700">
          Partner wallet is not configured.
        </div>
      )}
      {canFetchTransactions &&
        transactions &&
        transactions.length === 0 &&
        !transactionsLoading && (
          <div className="text-slate-500 py-12 text-center rounded-lg border border-dashed border-slate-700">
            No transactions
          </div>
        )}
      {transactions && transactions.length > 0 && (
        <ul className="space-y-3">
          {transactions.map((tx) => (
            <li
              key={tx.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedTransactionId(tx.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedTransactionId(tx.id);
                }
              }}
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 cursor-pointer hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-100 capitalize">
                    {tx.status}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatTransactionDate(tx)}
                  </p>
                </div>
                <span
                  className={`font-semibold ${
                    tx.direction?.toLowerCase() === "out" ||
                    (tx.amount < 0 && !tx.direction)
                      ? "text-red-400"
                      : "text-emerald-400"
                  }`}
                >
                  {tx.direction?.toLowerCase() === "out" ||
                  (tx.amount < 0 && !tx.direction)
                    ? "-"
                    : "+"}
                  ${(Math.abs(tx.amount) / 100).toFixed(2)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selectedTransactionId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="transaction-modal-title"
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h2
                id="transaction-modal-title"
                className="text-lg font-semibold text-slate-100"
              >
                Transaction details
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {transactionDetailLoading && (
                <div className="text-slate-400 py-8 text-center">
                  Loading transaction...
                </div>
              )}
              {transactionDetailError && (
                <div className="text-red-400 py-4 bg-red-950/30 rounded-lg px-4">
                  {transactionDetailError instanceof Error
                    ? transactionDetailError.message
                    : "Failed to load transaction"}
                </div>
              )}
              {selectedTransaction && (
                <pre className="text-sm text-slate-300 font-mono bg-slate-950/50 p-4 rounded-lg">
                  {JSON.stringify(selectedTransaction, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
