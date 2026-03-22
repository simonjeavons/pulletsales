import { getSupabaseServerClient, getSupabaseAdminClient } from "~/lib/supabase/server";
import type { Profile, UserRole } from "~/types/database";

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
 * Request password reset — sends email via Supabase's built-in flow.
 */
export async function requestPasswordReset(request: Request, email: string) {
  const { supabase } = getSupabaseServerClient(request);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${import.meta.env.VITE_APP_URL ?? process.env.VITE_APP_URL}/auth/reset-password`,
  });

  // Update password_reset_requested_at
  const admin = getSupabaseAdminClient();
  await admin
    .from("profiles")
    .update({ password_reset_requested_at: new Date().toISOString() })
    .eq("email", email);

  if (error) {
    return { error: error.message };
  }
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
 * Invite a new user — creates auth user and profile, sends invite email.
 */
export async function inviteUser(params: {
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
}) {
  const admin = getSupabaseAdminClient();

  // Create auth user with invite
  const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(
    params.email,
    {
      data: { full_name: params.full_name },
      redirectTo: `${import.meta.env.VITE_APP_URL ?? process.env.VITE_APP_URL}/auth/set-password`,
    }
  );

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
    // Rollback auth user if profile creation fails
    await admin.auth.admin.deleteUser(authData.user.id);
    return { error: profileError.message };
  }

  return { success: true, userId: authData.user.id };
}

/**
 * Resend invite email for an existing user.
 */
export async function resendInvite(profileId: string) {
  const admin = getSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("email, auth_user_id")
    .eq("id", profileId)
    .single();

  if (!profile) {
    return { error: "User not found" };
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(profile.email, {
    redirectTo: `${import.meta.env.VITE_APP_URL ?? process.env.VITE_APP_URL}/auth/set-password`,
  });

  if (error) {
    return { error: error.message };
  }

  await admin
    .from("profiles")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", profileId);

  return { success: true };
}
