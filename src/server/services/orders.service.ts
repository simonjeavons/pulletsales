import { getSupabaseAdminClient } from "~/lib/supabase/server";
import type {
  Order,
  OrderWithRelations,
  OrderStatus,
  OrderListFilters,
} from "~/types/database";
import type { OrderInput } from "~/lib/validation/schemas";

const admin = () => getSupabaseAdminClient();

// ─── Valid status transitions ────────────────────────────
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["pending_despatch", "cancelled"],
  pending_despatch: ["ready_for_despatch", "cancelled"],
  ready_for_despatch: ["completed", "cancelled"],
  completed: ["invoiced"],
  cancelled: [],
  invoiced: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Generate order number ───────────────────────────────
async function nextOrderNumber(): Promise<string> {
  const { data: raw } = await admin()
    .from("orders")
    .select("order_number")
    .order("created_at", { ascending: false })
    .limit(1);
  const last = raw?.[0]?.order_number;
  const num = last ? parseInt(last.replace("ORD-", ""), 10) + 1 : 1001;
  return `ORD-${num}`;
}

// ─── List orders ─────────────────────────────────────────
export async function listOrders(filters: OrderListFilters = {}) {
  const { search, status, customer_id, date_from, date_to, page = 1, pageSize = 25 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin()
    .from("orders")
    .select(
      "*, customer:customers(id, company_name, customer_unique_id), rep:reps(id, name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(
      `order_number.ilike.%${search}%`
    );
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (customer_id) {
    query = query.eq("customer_id", customer_id);
  }

  if (date_from) {
    query = query.gte("requested_delivery_week_commencing", date_from);
  }

  if (date_to) {
    query = query.lte("requested_delivery_week_commencing", date_to);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { data: data ?? [], count: count ?? 0 };
}

// ─── Get order with full relations ───────────────────────
export async function getOrder(id: string): Promise<OrderWithRelations> {
  const db = admin();

  // Order header with customer, rep, delivery address
  const { data: order, error } = await db
    .from("orders")
    .select(`
      *,
      customer:customers(*),
      rep:reps(id, name),
      delivery_address:customer_delivery_addresses(*)
    `)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);

  // Order lines with breed and line extras
  const { data: lines } = await db
    .from("order_lines")
    .select(`
      *,
      breed:breeds(*),
      order_line_extras(extra_id, extras:extras(*))
    `)
    .eq("order_id", id)
    .order("created_at");

  // Order-level extras
  const { data: orderExtras } = await db
    .from("order_extras")
    .select("extra_id, extras:extras(*)")
    .eq("order_id", id);

  // Despatch if exists
  const { data: despatch } = await db
    .from("despatches")
    .select("*")
    .eq("order_id", id)
    .maybeSingle();

  const formattedLines = (lines ?? []).map((line: any) => ({
    ...line,
    breed: line.breed,
    extras: (line.order_line_extras ?? []).map((ole: any) => ole.extras).filter(Boolean),
    order_line_extras: undefined,
  }));

  const formattedExtras = (orderExtras ?? []).map((oe: any) => oe.extras).filter(Boolean);

  return {
    ...order,
    lines: formattedLines,
    extras: formattedExtras,
    despatch: despatch ?? null,
  } as OrderWithRelations;
}

// ─── Create order ────────────────────────────────────────
export async function createOrder(input: OrderInput, createdBy?: string) {
  const db = admin();
  const orderNumber = await nextOrderNumber();

  // Insert order header
  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_id: input.customer_id,
      delivery_address_id: input.delivery_address_id || null,
      rep_id: input.rep_id || null,
      requested_delivery_week_commencing: input.requested_delivery_week_commencing || null,
      customer_notes: input.customer_notes || null,
      internal_notes: input.internal_notes || null,
      status: "draft" as OrderStatus,
      created_by: createdBy || null,
    })
    .select()
    .single();

  if (orderError) throw new Error(orderError.message);

  // Insert lines
  for (const line of input.lines) {
    const { data: orderLine, error: lineError } = await db
      .from("order_lines")
      .insert({
        order_id: order.id,
        breed_id: line.breed_id,
        quantity: line.quantity,
        price: line.price,
        food_clause_value: line.food_clause_value,
      })
      .select()
      .single();

    if (lineError) throw new Error(lineError.message);

    // Insert line extras
    if (line.extra_ids.length > 0) {
      const { error: leError } = await db.from("order_line_extras").insert(
        line.extra_ids.map((extra_id) => ({
          order_line_id: orderLine.id,
          extra_id,
        }))
      );
      if (leError) throw new Error(leError.message);
    }
  }

  // Insert order-level extras
  if (input.extra_ids.length > 0) {
    const { error: oeError } = await db.from("order_extras").insert(
      input.extra_ids.map((extra_id) => ({
        order_id: order.id,
        extra_id,
      }))
    );
    if (oeError) throw new Error(oeError.message);
  }

  return order as Order;
}

// ─── Update order ────────────────────────────────────────
export async function updateOrder(id: string, input: OrderInput) {
  const db = admin();

  // Update header
  const { error: orderError } = await db
    .from("orders")
    .update({
      customer_id: input.customer_id,
      delivery_address_id: input.delivery_address_id || null,
      rep_id: input.rep_id || null,
      requested_delivery_week_commencing: input.requested_delivery_week_commencing || null,
      customer_notes: input.customer_notes || null,
      internal_notes: input.internal_notes || null,
    })
    .eq("id", id);

  if (orderError) throw new Error(orderError.message);

  // Replace lines: delete all existing, re-insert
  await db.from("order_lines").delete().eq("order_id", id);

  for (const line of input.lines) {
    const { data: orderLine, error: lineError } = await db
      .from("order_lines")
      .insert({
        order_id: id,
        breed_id: line.breed_id,
        quantity: line.quantity,
        price: line.price,
        food_clause_value: line.food_clause_value,
      })
      .select()
      .single();

    if (lineError) throw new Error(lineError.message);

    if (line.extra_ids.length > 0) {
      await db.from("order_line_extras").insert(
        line.extra_ids.map((extra_id) => ({
          order_line_id: orderLine.id,
          extra_id,
        }))
      );
    }
  }

  // Replace order-level extras
  await db.from("order_extras").delete().eq("order_id", id);
  if (input.extra_ids.length > 0) {
    await db.from("order_extras").insert(
      input.extra_ids.map((extra_id) => ({
        order_id: id,
        extra_id,
      }))
    );
  }

  return getOrder(id);
}

// ─── Transition status ───────────────────────────────────
export async function transitionOrder(id: string, newStatus: OrderStatus) {
  const db = admin();

  const { data: order } = await db
    .from("orders")
    .select("status")
    .eq("id", id)
    .single();

  if (!order) throw new Error("Order not found");

  if (!canTransition(order.status as OrderStatus, newStatus)) {
    throw new Error(`Cannot transition from ${order.status} to ${newStatus}`);
  }

  const updates: Record<string, any> = { status: newStatus };

  if (newStatus === "confirmed") {
    // Validate has at least one line
    const { count } = await db
      .from("order_lines")
      .select("id", { count: "exact", head: true })
      .eq("order_id", id);

    if (!count || count === 0) {
      throw new Error("Cannot confirm order without at least one line");
    }

    updates.confirmed_at = new Date().toISOString();
  }

  const { error } = await db.from("orders").update(updates).eq("id", id);
  if (error) throw new Error(error.message);

  return getOrder(id);
}
