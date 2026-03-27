import { getSupabaseServerClient, getSupabaseAdminClient } from "~/lib/supabase/server";
import { sendEmail } from "~/lib/email";
import { getEmailTemplateByKey } from "~/server/services/email-templates.service";
import type { Profile, UserRole } from "~/types/database";

const APP_URL = import.meta.env.VITE_APP_URL ?? process.env.VITE_APP_URL ?? "https://pullets.lloydsanimalfeeds.com";
const APP_NAME = "Country Fresh Pullets";

/**
 * Get the currently authenticated user's profile, or null.
 */
export async function getCurrentUser(request: Request): Promise<Profile | null> {
  const { supabase } = getSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  return profile;
}

/**
 * Require an authenticated user. Throws if not authenticated.
 */
export async function requireAuth(request: Request): Promise<Profile> {
  const profile = await getCurrentUser(request);
  if (!profile) {
    throw new Error("Unauthorized");
  }
  if (!profile.is_active) {
    throw new Error("Account deactivated");
  }
  return profile;
}

/**
 * Require an admin user. Throws if not admin.
 */
export async function requireAdmin(request: Request): Promise<Profile> {
  const profile = await requireAuth(request);
  if (profile.role !== "admin") {
    throw new Error("Forbidden: admin access required");
  }
  return profile;
}

/**
 * Sign in with email/password.
 */
export async function signIn(request: Request, email: string, password: string) {
  const { supabase, headers } = getSupabaseServerClient(request);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message, headers };
  }

  // Update last_login_at
  if (data.user) {
    await supabase
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("auth_user_id", data.user.id);
  }

  return { user: data.user, session: data.session, headers };
}

/**
 * Sign out.
 */
export async function signOut(request: Request) {
  const { supabase, headers } = getSupabaseServerClient(request);
  await supabase.auth.signOut();
  return { headers };
}

/**
 * Request password reset — generates link via Supabase, sends email via Resend.
 */
export async function requestPasswordReset(request: Request, email: string) {
  const admin = getSupabaseAdminClient();

  // Check user exists
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("email", email)
    .single();

  // Always return success to prevent email enumeration
  if (!profile) {
    return { success: true };
  }

  // Generate OTP token for password reset
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (linkError) {
    return { error: linkError.message };
  }

  // Build a direct link to our app with the OTP — bypasses Supabase's verify endpoint
  const otp = (linkData as any).email_otp || linkData.properties?.email_otp;
  const resetUrl = `${APP_URL}/auth/reset-password?otp=${otp}&email=${encodeURIComponent(email)}`;

  // Send via Resend using DB template
  await sendTemplatedAuthEmail({
    templateKey: "password_reset",
    to: email,
    vars: { name: profile.full_name, action_url: resetUrl },
    actionUrl: resetUrl,
    buttonLabel: "Reset Password",
    fallbackSubject: `Reset your ${APP_NAME} password`,
    fallbackBody: `Hello ${profile.full_name},\n\nWe received a request to reset your password.\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
  });

  // Update timestamp
  await admin
    .from("profiles")
    .update({ password_reset_requested_at: new Date().toISOString() })
    .eq("email", email);

  return { success: true };
}

/**
 * Update password (from reset flow).
 */
export async function updatePassword(request: Request, newPassword: string) {
  const { supabase, headers } = getSupabaseServerClient(request);

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { error: error.message, headers };
  }
  return { success: true, headers };
}

/**
 * Invite a new user — creates auth user and profile, sends invite email via Resend.
 */
export async function inviteUser(params: {
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
}) {
  const admin = getSupabaseAdminClient();

  // Create auth user with confirmed email (we handle invites ourselves via Resend)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: params.email,
    email_confirm: true,
    user_metadata: { full_name: params.full_name },
  });

  if (authError) {
    return { error: authError.message };
  }

  // Create profile
  const { error: profileError } = await admin.from("profiles").insert({
    auth_user_id: authData.user.id,
    full_name: params.full_name,
    email: params.email,
    phone: params.phone || null,
    role: params.role,
    is_active: true,
    invited_at: new Date().toISOString(),
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return { error: profileError.message };
  }

  // Generate OTP for the user to set their password
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: params.email,
  });

  if (linkError) {
    return { error: `User created but invite email failed: ${linkError.message}` };
  }

  // Build a direct link to our app with the OTP — bypasses Supabase's verify endpoint
  const otp = (linkData as any).email_otp || linkData.properties?.email_otp;
  const setPasswordUrl = `${APP_URL}/auth/set-password?otp=${otp}&email=${encodeURIComponent(params.email)}&type=invite`;

  const emailResult = await sendInviteEmail({
    to: params.email,
    name: params.full_name,
    setPasswordUrl,
  });

  if (!emailResult.success) {
    return { error: `User created but email failed: ${emailResult.error}` };
  }

  return { success: true, userId: authData.user.id };
}

/**
 * Resend invite email for an existing user via Resend.
 */
export async function resendInvite(profileId: string) {
  const admin = getSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name, auth_user_id")
    .eq("id", profileId)
    .single();

  if (!profile) {
    return { error: "User not found" };
  }

  // Generate a fresh OTP for the user to set their password
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: profile.email,
  });

  if (linkError) {
    return { error: linkError.message };
  }

  const otp = (linkData as any).email_otp || linkData.properties?.email_otp;
  const setPasswordUrl = `${APP_URL}/auth/set-password?otp=${otp}&email=${encodeURIComponent(profile.email)}&type=invite`;

  const emailResult = await sendInviteEmail({
    to: profile.email,
    name: profile.full_name,
    setPasswordUrl,
  });

  if (!emailResult.success) {
    return { error: emailResult.error || "Failed to send email" };
  }

  await admin
    .from("profiles")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", profileId);

  return { success: true };
}

// ─── Email helpers ──────────────────────────────────────

function applyPlaceholders(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

function wrapInHtmlEmail(body: string, actionUrl?: string, buttonLabel?: string): string {
  const bodyHtml = body.split("\n").map(line => {
    if (line.trim() === "") return "<br/>";
    if (actionUrl && line.includes(actionUrl)) {
      return `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${actionUrl}"
             style="background-color: #e89a2e; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
            ${buttonLabel || "Click Here"}
          </a>
        </div>
        <p style="color: #888; font-size: 13px; word-break: break-all;">${actionUrl}</p>`;
    }
    return `<p style="color: #333; font-size: 15px; line-height: 1.6; margin: 4px 0;">${line}</p>`;
  }).join("\n");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a; margin-bottom: 24px;">${APP_NAME}</h2>
      ${bodyHtml}
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
      <p style="color: #999; font-size: 12px;">${APP_NAME}</p>
    </div>`;
}

async function sendTemplatedAuthEmail(params: {
  templateKey: string;
  to: string;
  vars: Record<string, string>;
  actionUrl: string;
  buttonLabel: string;
  fallbackSubject: string;
  fallbackBody: string;
}) {
  const template = await getEmailTemplateByKey(params.templateKey);

  const subject = template
    ? applyPlaceholders(template.subject, params.vars)
    : params.fallbackSubject;

  const bodyText = template
    ? applyPlaceholders(template.body, params.vars)
    : params.fallbackBody;

  return sendEmail({
    to: params.to,
    subject,
    html: wrapInHtmlEmail(bodyText, params.actionUrl, params.buttonLabel),
    text: bodyText,
  });
}

async function sendInviteEmail(params: {
  to: string;
  name: string;
  setPasswordUrl: string;
}) {
  return sendTemplatedAuthEmail({
    templateKey: "user_invite",
    to: params.to,
    vars: { name: params.name, action_url: params.setPasswordUrl },
    actionUrl: params.setPasswordUrl,
    buttonLabel: "Set Your Password",
    fallbackSubject: `You've been invited to ${APP_NAME}`,
    fallbackBody: `Hello ${params.name},\n\nYou've been invited to join ${APP_NAME}.\n\n${params.setPasswordUrl}\n\nKind regards,\n${APP_NAME}`,
  });
}
