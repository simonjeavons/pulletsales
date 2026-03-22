import { getSupabaseAdminClient } from "~/lib/supabase/server";
import type { DespatchWithRelations } from "~/types/database";
import type { DespatchInput } from "~/lib/validation/schemas";

const admin = () => getSupabaseAdminClient();

// ─── Get despatch for an order ───────────────────────────
export async function getDespatch(orderId: string): Promise<DespatchWithRelations | null> {
  const db = admin();

  const { data: despatch } = await db
    .from("despatches")
    .select(`
      *,
      transporter:transporters(*)
    `)
    .eq("order_id", orderId)
    .maybeSingle();

  if (!despatch) return null;

  // Despatch lines with breed and extras
  const { data: lines } = await db
    .from("despatch_lines")
    .select(`
      *,
      breed:breeds(*),
      rearer:rearers(id, name),
      despatch_line_extras(extra_id, extras:extras(*))
    `)
    .eq("despatch_id", despatch.id)
    .order("created_at");

  // Despatch-level extras
  const { data: despatchExtras } = await db
    .from("despatch_extras")
    .select("extra_id, extras:extras(*)")
    .eq("despatch_id", despatch.id);

  const formattedLines = (lines ?? []).map((line: any) => ({
    ...line,
    breed: line.breed,
    rearer: line.rearer ?? null,
    extras: (line.despatch_line_extras ?? []).map((dle: any) => dle.extras).filter(Boolean),
    despatch_line_extras: undefined,
  }));

  const formattedExtras = (despatchExtras ?? []).map((de: any) => de.extras).filter(Boolean);

  return {
    ...despatch,
    lines: formattedLines,
    extras: formattedExtras,
  } as DespatchWithRelations;
}

// ─── Create or update despatch ───────────────────────────
export async function saveDespatch(orderId: string, input: DespatchInput, createdBy?: string) {
  const db = admin();

  // Check order exists and is in a valid state
  const { data: order } = await db
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();

  if (!order) throw new Error("Order not found");

  const validStatuses = ["confirmed", "pending_despatch", "ready_for_despatch"];
  if (!validStatuses.includes(order.status)) {
    throw new Error(`Cannot create despatch for order in status: ${order.status}`);
  }

  // Check if despatch already exists
  const { data: existing } = await db
    .from("despatches")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();

  let despatchId: string;

  if (existing) {
    // Update existing
    const { error } = await db
      .from("despatches")
      .update({
        actual_delivery_date: input.actual_delivery_date,
        proposed_unloading_time: input.proposed_unloading_time || null,
        transporter_id: input.transporter_id,
        advice_salutation: input.advice_salutation || null,
        advice_body: input.advice_body || null,
        advice_date: input.advice_date || null,
        is_delivery_amended: input.is_delivery_amended || false,
        despatch_notes: input.despatch_notes || null,
      })
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
    despatchId = existing.id;

    // Clear existing lines and extras
    await db.from("despatch_lines").delete().eq("despatch_id", despatchId);
    await db.from("despatch_extras").delete().eq("despatch_id", despatchId);
  } else {
    // Generate despatch number
    const { data: dnSetting } = await db.from("system_settings").select("value").eq("key", "next_despatch_number").single();
    const dnCurrent = parseInt(dnSetting?.value || "20700", 10);
    await db.from("system_settings").update({ value: String(dnCurrent + 1), updated_at: new Date().toISOString() }).eq("key", "next_despatch_number");

    // Create new
    const { data: despatch, error } = await db
      .from("despatches")
      .insert({
        order_id: orderId,
        despatch_number: String(dnCurrent),
        actual_delivery_date: input.actual_delivery_date,
        proposed_unloading_time: input.proposed_unloading_time || null,
        transporter_id: input.transporter_id,
        advice_salutation: input.advice_salutation || null,
        advice_body: input.advice_body || null,
        advice_date: input.advice_date || null,
        is_delivery_amended: input.is_delivery_amended || false,
        despatch_notes: input.despatch_notes || null,
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    despatchId = despatch.id;
  }

  // Insert despatch lines
  for (const line of input.lines) {
    const { data: despatchLine, error: lineError } = await db
      .from("despatch_lines")
      .insert({
        despatch_id: despatchId,
        order_line_id: line.order_line_id || null,
        breed_id: line.breed_id,
        rearer_id: line.rearer_id || null,
        quantity: line.quantity,
        price: line.price,
        food_clause_value: line.food_clause_value,
        age_weeks: line.age_weeks ?? null,
      })
      .select()
      .single();

    if (lineError) throw new Error(lineError.message);

    // Line extras
    if (line.extra_ids.length > 0) {
      await db.from("despatch_line_extras").insert(
        line.extra_ids.map((extra_id) => ({
          despatch_line_id: despatchLine.id,
          extra_id,
        }))
      );
    }
  }

  // Despatch-level extras
  if (input.extra_ids.length > 0) {
    await db.from("despatch_extras").insert(
      input.extra_ids.map((extra_id) => ({
        despatch_id: despatchId,
        extra_id,
      }))
    );
  }

  // Transition order to pending_despatch if it was confirmed
  if (order.status === "confirmed") {
    await db.from("orders").update({ status: "pending_despatch" }).eq("id", orderId);
  }

  return getDespatch(orderId);
}

// ─── Complete despatch (mark order completed) ────────────
export async function completeDespatch(orderId: string) {
  const db = admin();

  const despatch = await getDespatch(orderId);
  if (!despatch) throw new Error("No despatch found for this order");

  if (!despatch.actual_delivery_date) {
    throw new Error("Actual delivery date is required");
  }
  if (!despatch.transporter_id) {
    throw new Error("Transporter is required");
  }
  if (despatch.lines.length === 0) {
    throw new Error("At least one despatch line is required");
  }

  // Mark despatch as completed
  await db
    .from("despatches")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", despatch.id);

  // Transition order to completed
  await db
    .from("orders")
    .update({ status: "completed" })
    .eq("id", orderId);

  return getDespatch(orderId);
}

// ─── Copy order lines into despatch lines ────────────────
export async function copyOrderLinesToDespatch(orderId: string): Promise<DespatchInput> {
  const db = admin();

  // Get order lines with extras
  const { data: lines } = await db
    .from("order_lines")
    .select("*, order_line_extras(extra_id)")
    .eq("order_id", orderId)
    .order("created_at");

  // Get order-level extras
  const { data: orderExtras } = await db
    .from("order_extras")
    .select("extra_id")
    .eq("order_id", orderId);

  return {
    actual_delivery_date: "",
    transporter_id: "",
    lines: (lines ?? []).map((line: any) => ({
      order_line_id: line.id,
      breed_id: line.breed_id,
      rearer_id: line.rearer_id || null,
      quantity: line.quantity,
      price: line.price,
      food_clause_value: line.food_clause_value,
      age_weeks: line.age_weeks ?? null,
      extra_ids: (line.order_line_extras ?? []).map((ole: any) => ole.extra_id),
    })),
    extra_ids: (orderExtras ?? []).map((oe: any) => oe.extra_id),
  };
}
