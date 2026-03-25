/**
 * Email provider abstraction layer.
 * Swap out the implementation by changing the provider in email/index.ts
 */

export interface EmailAttachment {
  filename: string;
  content: Buffer | Uint8Array | string;
  contentType?: string;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ success: boolean; error?: string }>;
}
