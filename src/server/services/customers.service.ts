import { getSupabaseAdminClient } from "~/lib/supabase/server";
import type {
  Customer,
  CustomerWithRep,
  CustomerInsert,
  CustomerUpdate,
  DeliveryAddress,
  DeliveryAddressInsert,
  DeliveryAddressUpdate,
  ListFilters,
} from "~/types/database";

const admin = () => getSupabaseAdminClient();

// ─── Customers ───────────────────────────────────────────
export async function listCustomers(
  filters: ListFilters & { rep_id?: string } = {}
) {
  const { search, is_active, rep_id, page = 1, pageSize = 25 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin()
    .from("customers")
    .select("*, rep:reps(id, name)", { count: "exact" })
    .order("company_name", { ascending: true })
    .range(from, to);

  if (search) {
    query = query.or(
      `customer_unique_id.ilike.%${search}%,company_name.ilike.%${search}%,post_code.ilike.%${search}%`
    );
  }

  if (is_active !== undefined) {
    query = query.eq("is_active", is_active);
  }

  if (rep_id) {
    query = query.eq("rep_id", rep_id);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { data: data as CustomerWithRep[], count: count ?? 0 };
}

export async function getCustomer(id: string) {
  const { data, error } = await admin()
    .from("customers")
    .select("*, rep:reps(id, name)")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as CustomerWithRep;
}

export async function createCustomer(input: CustomerInsert) {
  // Check uniqueness of customer_unique_id
  const { data: existing } = await admin()
    .from("customers")
    .select("id")
    .eq("customer_unique_id", input.customer_unique_id)
    .maybeSingle();

  if (existing) {
    throw new Error("Customer ID already exists");
  }

  const { data, error } = await admin()
    .from("customers")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Customer;
}

export async function updateCustomer(id: string, updates: CustomerUpdate) {
  // If updating customer_unique_id, check uniqueness
  if (updates.customer_unique_id) {
    const { data: existing } = await admin()
      .from("customers")
      .select("id")
      .eq("customer_unique_id", updates.customer_unique_id)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      throw new Error("Customer ID already exists");
    }
  }

  const { data, error } = await admin()
    .from("customers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Customer;
}

export async function toggleCustomerActive(id: string, is_active: boolean) {
  return updateCustomer(id, { is_active });
}

// ─── Delivery Addresses ──────────────────────────────────
export async function listDeliveryAddresses(customerId: string) {
  const { data, error } = await admin()
    .from("customer_delivery_addresses")
    .select("*")
    .eq("customer_id", customerId)
    .order("label");

  if (error) throw new Error(error.message);
  return data as DeliveryAddress[];
}

export async function createDeliveryAddress(
  customerId: string,
  input: DeliveryAddressInsert
) {
  const { data, error } = await admin()
    .from("customer_delivery_addresses")
    .insert({ ...input, customer_id: customerId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as DeliveryAddress;
}

export async function updateDeliveryAddress(
  id: string,
  updates: DeliveryAddressUpdate
) {
  const { data, error } = await admin()
    .from("customer_delivery_addresses")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as DeliveryAddress;
}

export async function toggleDeliveryAddressActive(
  id: string,
  is_active: boolean
) {
  return updateDeliveryAddress(id, { is_active });
}
