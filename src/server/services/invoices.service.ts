import { getSupabaseAdminClient } from "~/lib/supabase/server";
import type { Invoice, InvoiceWithRelations, InvoiceStatus, ListFilters } from "~/types/database";

const admin = () => getSupabaseAdminClient();

// ─── Generate invoice number ─────────────────────────────
async function nextInvoiceNumber(): Promise<string> {
  const { data: raw } = await admin()
    .from("invoices")
    .select("invoice_number")
    .order("created_at", { ascending: false })
    .limit(1);

  const last = raw?.[0]?.invoice_number;
  const num = last ? parseInt(last.replace("INV-", ""), 10) + 1 : 10001;
  return `INV-${num}`;
}

// ─── List invoices ───────────────────────────────────────
export async function listInvoices(filters: ListFilters & { status?: InvoiceStatus; customer_id?: string } = {}) {
  const { search, status, customer_id, page = 1, pageSize = 25 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin()
    .from("invoices")
    .select(
      "*, order:orders(id, order_number), customer:customers(id, company_name, customer_unique_id)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`invoice_number.ilike.%${search}%`);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (customer_id) {
    query = query.eq("customer_id", customer_id);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { data: data as InvoiceWithRelations[], count: count ?? 0 };
}

// ─── Create invoice from completed order ─────────────────
export async function createInvoice(orderId: string) {
  const db = admin();

  // Validate order is completed
  const { data: order } = await db
    .from("orders")
    .select("id, status, customer_id")
    .eq("id", orderId)
    .single();

  if (!order) throw new Error("Order not found");
  if (order.status !== "completed") {
    throw new Error("Can only create invoices for completed orders");
  }

  // Check no existing invoice
  const { data: existing } = await db
    .from("invoices")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing) throw new Error("Invoice already exists for this order");

  const invoiceNumber = await nextInvoiceNumber();

  const { data: invoice, error } = await db
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      order_id: orderId,
      customer_id: order.customer_id,
      status: "draft",
      export_status: "pending",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Transition order to invoiced
  await db.from("orders").update({ status: "invoiced" }).eq("id", orderId);

  return invoice as Invoice;
}

// ─── Finalise invoice ────────────────────────────────────
export async function finaliseInvoice(id: string) {
  const { error } = await admin()
    .from("invoices")
    .update({ status: "finalised" })
    .eq("id", id)
    .eq("status", "draft");

  if (error) throw new Error(error.message);
}

// ─── Export invoices ─────────────────────────────────────
export async function exportInvoices(invoiceIds: string[], exportedBy?: string) {
  const db = admin();
  const batchRef = `EXP-${Date.now()}`;

  // Create export batch
  const { data: batch, error: batchError } = await db
    .from("invoice_exports")
    .insert({
      batch_reference: batchRef,
      exported_by: exportedBy || null,
      status: "exported",
      file_name: `invoices-${batchRef}.csv`,
    })
    .select()
    .single();

  if (batchError) throw new Error(batchError.message);

  // Link invoices to batch
  const { error: linkError } = await db.from("invoice_export_items").insert(
    invoiceIds.map((invoice_id) => ({
      invoice_export_id: batch.id,
      invoice_id,
    }))
  );
  if (linkError) throw new Error(linkError.message);

  // Update invoices
  const now = new Date().toISOString();
  for (const id of invoiceIds) {
    await db
      .from("invoices")
      .update({
        status: "exported",
        export_status: "exported",
        export_batch_reference: batchRef,
        exported_at: now,
      })
      .eq("id", id);
  }

  return batch;
}

// ─── Generate CSV data for export ────────────────────────
export async function generateInvoiceCsvData(invoiceIds: string[]) {
  const db = admin();

  const rows = [];

  for (const invoiceId of invoiceIds) {
    const { data: invoice } = await db
      .from("invoices")
      .select("*, customer:customers(*), order:orders(order_number)")
      .eq("id", invoiceId)
      .single();

    if (!invoice) continue;

    // Get despatch lines for this order
    const { data: despatch } = await db
      .from("despatches")
      .select("id")
      .eq("order_id", invoice.order_id)
      .single();

    if (!despatch) continue;

    const { data: lines } = await db
      .from("despatch_lines")
      .select("*, breed:breeds(breed_name)")
      .eq("despatch_id", despatch.id);

    for (const line of lines ?? []) {
      rows.push({
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        customer_id: (invoice as any).customer?.customer_unique_id || "",
        customer_name: (invoice as any).customer?.company_name || "",
        order_number: (invoice as any).order?.order_number || "",
        breed: (line as any).breed?.breed_name || "",
        quantity: line.quantity,
        price: line.price,
        food_clause_value: line.food_clause_value,
        line_total: (line.quantity * line.price).toFixed(2),
      });
    }
  }

  return rows;
}
