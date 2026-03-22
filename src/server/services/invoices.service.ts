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

// ─── Generate TAS CSV data for export ────────────────────
export async function generateInvoiceCsvData(invoiceIds: string[]) {
  const db = admin();

  // Get TAS settings
  const { data: settings } = await db.from("system_settings").select("key, value").in("key", ["tas_nominal", "tas_depot"]);
  const settingsMap = Object.fromEntries((settings ?? []).map((s: any) => [s.key, s.value]));
  const nominal = settingsMap["tas_nominal"] || "32000";
  const depot = settingsMap["tas_depot"] || "100";

  const rows = [];

  for (const invoiceId of invoiceIds) {
    const { data: invoice } = await db
      .from("invoices")
      .select("*, customer:customers(*), order:orders(order_number), vat_rate:vat_rates(rate)")
      .eq("id", invoiceId)
      .single();

    if (!invoice) continue;

    // Get despatch lines for this order (final quantities)
    let lines: any[] = [];
    if (invoice.order_id) {
      const { data: despatch } = await db
        .from("despatches")
        .select("id")
        .eq("order_id", invoice.order_id)
        .single();

      if (despatch) {
        const { data: dLines } = await db
          .from("despatch_lines")
          .select("*, breed:breeds(breed_name)")
          .eq("despatch_id", despatch.id);
        lines = dLines ?? [];
      }
    }

    // Format date as DD/MM/YYYY
    const dateParts = invoice.invoice_date.split("-");
    const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

    const vatRate = Number((invoice as any).vat_rate?.rate ?? 0);
    const vatCode = vatRate === 0 ? "T0" : vatRate === 20 ? "T1" : "T0";

    // One row per despatch line (or one row for ad-hoc)
    if (lines.length > 0) {
      for (const line of lines) {
        const grandTotal = (line.quantity * Number(line.price)).toFixed(2);
        const taxAmount = (Number(grandTotal) * (vatRate / 100)).toFixed(2);

        rows.push({
          type: "SI",
          customer_ref: (invoice as any).customer?.customer_unique_id || "",
          nominal,
          depot,
          invoice_date: formattedDate,
          invoice_number: invoice.invoice_number,
          details: `${line.quantity} ${(line as any).breed?.breed_name || "Pullets"}`,
          grand_total: grandTotal,
          vat_code: vatCode,
          tax_amount: taxAmount,
        });
      }
    } else {
      // Ad-hoc invoice with no lines
      rows.push({
        type: "SI",
        customer_ref: (invoice as any).customer?.customer_unique_id || "",
        nominal,
        depot,
        invoice_date: formattedDate,
        invoice_number: invoice.invoice_number,
        details: "Ad-hoc Invoice",
        grand_total: "0.00",
        vat_code: vatCode,
        tax_amount: "0.00",
      });
    }
  }

  return rows;
}
