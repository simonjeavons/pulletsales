import { getSupabaseAdminClient } from "~/lib/supabase/server";
import type { Rep, RepInsert, RepUpdate, ListFilters } from "~/types/database";

const admin = () => getSupabaseAdminClient();

export async function listReps(filters: ListFilters = {}) {
  const { search, is_active, page = 1, pageSize = 25 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin()
    .from("reps")
    .select("*", { count: "exact" })
    .order("name", { ascending: true })
    .range(from, to);

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  if (is_active !== undefined) {
    query = query.eq("is_active", is_active);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { data: data as Rep[], count: count ?? 0 };
}

export async function getActiveReps() {
  const { data, error } = await admin()
    .from("reps")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);
  return data;
}

export async function getRep(id: string) {
  const { data, error } = await admin()
    .from("reps")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as Rep;
}

export async function createRep(input: RepInsert) {
  const { data, error } = await admin()
    .from("reps")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Rep;
}

export async function updateRep(id: string, updates: RepUpdate) {
  const { data, error } = await admin()
    .from("reps")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Rep;
}

export async function toggleRepActive(id: string, is_active: boolean) {
  return updateRep(id, { is_active });
}
