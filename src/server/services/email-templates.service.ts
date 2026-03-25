import { getSupabaseAdminClient as admin } from "~/lib/supabase/server";

export async function listEmailTemplates() {
  const { data, error } = await admin()
    .from("email_templates")
    .select("*")
    .order("label");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getEmailTemplate(id: string) {
  const { data: template, error } = await admin()
    .from("email_templates")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return template;
}

export async function getEmailTemplateByKey(key: string) {
  const { data: template, error } = await admin()
    .from("email_templates")
    .select("*")
    .eq("template_key", key)
    .single();
  if (error) return null;
  return template;
}

export async function updateEmailTemplate(id: string, subject: string, body: string) {
  const { error } = await admin()
    .from("email_templates")
    .update({ subject, body, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}
