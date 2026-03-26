import { getSupabaseAdminClient } from "~/lib/supabase/server";
import type { Profile, ProfileUpdate, ListFilters } from "~/types/database";

const admin = () => getSupabaseAdminClient();

export async function listUsers(filters: ListFilters = {}) {
  const { search, is_active, page = 1, pageSize = 25 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin()
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  if (is_active !== undefined) {
    query = query.eq("is_active", is_active);
  }

  const { data, count, error } = await query;

  if (error) throw new Error(error.message);
  return { data: data as Profile[], count: count ?? 0 };
}

export async function getUser(id: string) {
  const { data, error } = await admin()
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function updateUser(id: string, updates: ProfileUpdate) {
  const { data, error } = await admin()
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function toggleUserActive(id: string, is_active: boolean) {
  return updateUser(id, { is_active });
}

export async function deleteUser(id: string) {
  const db = admin();

  // Get profile to find auth_user_id
  const { data: profile, error: fetchError } = await db
    .from("profiles")
    .select("auth_user_id")
    .eq("id", id)
    .single();

  if (fetchError || !profile) {
    throw new Error("User not found");
  }

  // Delete profile first
  const { error: profileError } = await db
    .from("profiles")
    .delete()
    .eq("id", id);

  if (profileError) {
    throw new Error(`Failed to delete profile: ${profileError.message}`);
  }

  // Delete auth user
  if (profile.auth_user_id) {
    const { error: authError } = await db.auth.admin.deleteUser(profile.auth_user_id);
    if (authError) {
      throw new Error(`Profile deleted but auth user removal failed: ${authError.message}`);
    }
  }

  return { success: true };
}
