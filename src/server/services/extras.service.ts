import { getSupabaseAdminClient } from "~/lib/supabase/server";
import type { Extra, ExtraInsert, ExtraUpdate, ListFilters } from "~/types/database";

const admin = () => getSupabaseAdminClient();

export async function listExtras(filters: ListFilters & { is_available?: boolean } = {}) {
  const { search, is_available, page = 1, pageSize = 25 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin()
    .from("extras")
    .select("*", { count: "exact" })
    .order("name", { ascending: true })
    .range(from, to);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  if (is_available !== undefined) {
    query = query.eq("is_available", is_available);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { data: data as Extra[], count: count ?? 0 };
}

export async function getAvailableExtras() {
  const { data, error } = await admin()
    .from("extras")
    .select("id, name")
    .eq("is_available", true)
    .order("name");

  if (error) throw new Error(error.message);
  return data;
}

export async function getExtra(id: string) {
  const { data, error } = await admin()
    .from("extras")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as Extra;
}

export async function createExtra(input: ExtraInsert) {
  const { data, error } = await admin()
    .from("extras")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Extra;
}

export async function updateExtra(id: string, updates: ExtraUpdate) {
  const { data, error } = await admin()
    .from("extras")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Extra;
}

export async function toggleExtraAvailable(id: string, is_available: boolean) {
  return updateExtra(id, { is_available });
}
