import { createServerFn } from "@tanstack/react-start";
import * as emailTemplatesService from "~/server/services/email-templates.service";

export const listEmailTemplatesFn = createServerFn({ method: "GET" })
  .handler(async () => {
    return emailTemplatesService.listEmailTemplates();
  });

export const getEmailTemplateFn = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    return emailTemplatesService.getEmailTemplate(data.id);
  });

export const getEmailTemplateByKeyFn = createServerFn({ method: "GET" })
  .validator((data: { key: string }) => data)
  .handler(async ({ data }) => {
    return emailTemplatesService.getEmailTemplateByKey(data.key);
  });

export const updateEmailTemplateFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; subject: string; body: string }) => data)
  .handler(async ({ data }) => {
    return emailTemplatesService.updateEmailTemplate(data.id, data.subject, data.body);
  });
