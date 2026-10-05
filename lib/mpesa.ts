import type { PayState } from './types';

export const PLAN = {
  name: 'MovieShop Access Pass',
  priceBob: 100,
  currency: 'Bob',
  cadence: 'Month',
} as const;

/** The USSD string a real Safaricom STK push would ask the user to enter. */
export const STK_PROMPT = '*334*100#';

/** Kenyan mobile numbers: 07XXXXXXXX, 01XXXXXXXX or 2547XXXXXXXX. */
const PHONE_PATTERN = /^(?:0[17]\d{8}|2547\d{8})$/;

export function normalisePhone(raw: string): string {
  return raw.replace(/[\s()-]/g, '');
}

export function validatePhone(raw: string): { valid: boolean; error?: string } {
  const value = normalisePhone(raw);
  if (!value) {
    return { valid: false, error: 'Enter your Safaricom M-Pesa number.' };
  }
  if (!PHONE_PATTERN.test(value)) {
    return { valid: false, error: 'Use a valid number: 07XX, 01XX or 2547XX.' };
  }
  return { valid: true };
}

export function maskPhone(raw: string): string {
  const value = normalisePhone(raw).replace(/^\+/, '');
  if (value.length <= 6) return value;
  return `${value.slice(0, value.length - 6)}••••${value.slice(-3)}`;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function checkoutId(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MS-${new Date().getFullYear()}-${rand}`;
}

/**
 * Simulated M-Pesa STK Push round trip.
 *
 * Safaricom's Daraja integration issues an STK push, then delivers the result
 * asynchronously to a registered callback URL. This walks the same state
 * machine locally so the UI is representative of the real integration point —
 * swap `stkPush` for a POST to your own `/api/mpesa/stkpush` route to go live.
 */
export async function stkPush(
  rawPhone: string,
  onUpdate: (state: PayState) => void,
): Promise<{ ok: boolean; checkoutRequestId: string }> {
  const checkoutRequestId = checkoutId();
  const phone = normalisePhone(rawPhone);

  const { valid, error } = validatePhone(phone);
  if (!valid) {
    onUpdate({ status: 'error', message: error });
    return { ok: false, checkoutRequestId };
  }

  try {
    onUpdate({
      status: 'authorizing',
      message: `Sending STK push to ${maskPhone(phone)}…`,
      checkoutRequestId,
    });
    await wait(900);

    onUpdate({
      status: 'awaiting',
      message: `Approve ${STK_PROMPT} on your handset to pay ${PLAN.priceBob} ${PLAN.currency}.`,
      checkoutRequestId,
    });
    await wait(2600);

    onUpdate({
      status: 'processing',
      message: 'Payment received — confirming with Safaricom…',
      checkoutRequestId,
    });
    await wait(1800);

    onUpdate({
      status: 'success',
      message: 'Payment confirmed. Access Pass activated.',
      checkoutRequestId,
    });
    return { ok: true, checkoutRequestId };
  } catch (err) {
    onUpdate({
      status: 'error',
      message: err instanceof Error ? err.message : 'STK push failed. Try again.',
      checkoutRequestId,
    });
    return { ok: false, checkoutRequestId };
  }
}
