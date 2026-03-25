import { createServerFn } from "@tanstack/react-start";
import * as emailDocService from "~/server/services/email-documents.service";

/**
 * Send document PDFs via email.
 * PDFs are generated client-side, base64-encoded, and sent here for emailing.
 */
export const sendDocumentEmailFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      to: string[];
      subject: string;
      body: string;
      attachments: Array<{
        filename: string;
        base64: string;
      }>;
    }) => data
  )
  .handler(async ({ data }) => {
    return emailDocService.sendDocumentEmail(data);
  });
