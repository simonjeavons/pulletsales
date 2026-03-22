/**
 * Email provider abstraction layer.
 * Swap out the implementation by changing the provider in email/index.ts
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ success: boolean; error?: string }>;
}
