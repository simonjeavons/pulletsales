import { getSupabaseAdminClient } from "~/lib/supabase/server";
import type { Rearer, RearerInsert, RearerUpdate, ListFilters } from "~/types/database";

const admin = () => getSupabaseAdminClient();

export async function listRearers(filters: ListFilters = {}) {
  const { search, is_active, page = 1, pageSize = 25 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin()
    .from("rearers")
    .select("*", { count: "exact" })
    .order("name", { ascending: true })
    .range(from, to);

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,post_code.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  if (is_active !== undefined) {
    query = query.eq("is_active", is_active);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { data: data as Rearer[], count: count ?? 0 };
}

export async function getRearer(id: string) {
  const { data, error } = await admin()
    .from("rearers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as Rearer;
}

export async function createRearer(input: RearerInsert) {
  const { data, error } = await admin()
    .from("rearers")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Rearer;
}

export async function updateRearer(id: string, updates: RearerUpdate) {
  const { data, error } = await admin()
    .from("rearers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Rearer;
}

export async function toggleRearerActive(id: string, is_active: boolean) {
  return updateRearer(id, { is_active });
}
