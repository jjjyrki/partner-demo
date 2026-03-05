/**
 * Mock virtual card data for UI display only.
 * Exposed via API endpoint; no real card details.
 */

export interface VirtualCardData {
  lastFour: string;
  brand: string;
  holderName: string;
  expiryMonth: number;
  expiryYear: number;
  maskedCvv: string;
  cvvRevealed: string;
}

const MOCK_VIRTUAL_CARD: Omit<VirtualCardData, 'holderName'> = {
  lastFour: '4242',
  brand: 'Visa',
  expiryMonth: 12,
  expiryYear: 28,
  maskedCvv: '•••',
  cvvRevealed: '123',
};

const DEFAULT_HOLDER_NAME = 'Jane Doe';

export function getMockVirtualCard(displayName?: string | null): VirtualCardData {
  const holderName = displayName?.trim() || DEFAULT_HOLDER_NAME;
  return {
    ...MOCK_VIRTUAL_CARD,
    holderName,
  };
}
