import { useState } from 'react';
import type { VirtualCard } from '../api/client';

interface VirtualCardProps {
  card: VirtualCard;
}

function formatExpiry(month: number, year: number): string {
  const m = String(month).padStart(2, '0');
  const y = String(year).padStart(2, '0');
  return `${m}/${y}`;
}

export default function VirtualCard({ card }: VirtualCardProps) {
  const [cvvRevealed, setCvvRevealed] = useState(false);

  const cardNumber = `•••• •••• •••• ${card.lastFour}`;
  const cvvDisplay = cvvRevealed ? card.cvvRevealed : card.maskedCvv;

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 min-h-[180px] flex flex-col justify-between"
      style={{
        background:
          'linear-gradient(135deg, #1e3a5f 0%, #0f172a 50%, #1e293b 100%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      {/* Brand label */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
          {card.brand}
        </span>
      </div>

      {/* Card number */}
      <p className="font-mono text-xl tracking-[0.25em] text-slate-100">
        {cardNumber}
      </p>

      {/* Bottom row: name, expiry, CVV */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">
            Cardholder
          </p>
          <p className="text-slate-100 font-medium">{card.holderName}</p>
        </div>
        <div className="flex items-end gap-6">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">
              Expires
            </p>
            <p className="text-slate-100 font-mono">
              {formatExpiry(card.expiryMonth, card.expiryYear)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">
              CVV
            </p>
            <div className="flex items-center gap-2">
              <span className="text-slate-100 font-mono">{cvvDisplay}</span>
              <button
                type="button"
                onClick={() => setCvvRevealed((v) => !v)}
                className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                {cvvRevealed ? 'Hide' : 'Reveal'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
