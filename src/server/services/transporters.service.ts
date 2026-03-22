import { getSupabaseAdminClient } from "~/lib/supabase/server";
import type { Transporter, TransporterInsert, TransporterUpdate, ListFilters } from "~/types/database";

const admin = () => getSupabaseAdminClient();

export async function listTransporters(filters: ListFilters = {}) {
  const { search, is_active, page = 1, pageSize = 25 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin()
    .from("transporters")
    .select("*", { count: "exact" })
    .order("transporter_name", { ascending: true })
    .range(from, to);

  if (search) {
    query = query.or(
      `transporter_name.ilike.%${search}%,post_code.ilike.%${search}%`
    );
  }

  if (is_active !== undefined) {
    query = query.eq("is_active", is_active);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { data: data as Transporter[], count: count ?? 0 };
}

export async function getTransporter(id: string) {
  const { data, error } = await admin()
    .from("transporters")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as Transporter;
}

export async function createTransporter(input: TransporterInsert) {
  const { data, error } = await admin()
    .from("transporters")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Transporter;
}

export async function updateTransporter(id: string, updates: TransporterUpdate) {
  const { data, error } = await admin()
    .from("transporters")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Transporter;
}

export async function toggleTransporterActive(id: string, is_active: boolean) {
  return updateTransporter(id, { is_active });
}
