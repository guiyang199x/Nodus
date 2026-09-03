/**
 * Login form state shared by the server actions and the client components.
 * It lives outside actions.ts because a 'use server' module may only export
 * async functions.
 */
export type LoginStatus = 'idle' | 'invalid' | 'sent' | 'error';

export type LoginState = {
  status: LoginStatus;
  message: string;
  /** Kept so a failed or invalid submission never clears what was typed. */
  email: string;
  /** Drives the 30 second resend delay on the client. */
  sentAt: number | null;
};

export type GoogleState = { status: 'idle' | 'error'; message: string };

export const initialLoginState: LoginState = {
  status: 'idle',
  message: '',
  email: '',
  sentAt: null,
};

export const initialGoogleState: GoogleState = { status: 'idle', message: '' };
