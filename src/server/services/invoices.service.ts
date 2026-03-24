import { getSupabaseAdminClient } from "~/lib/supabase/server";
import type { Invoice, InvoiceWithRelations, InvoiceStatus, ListFilters } from "~/types/database";

const admin = () => getSupabaseAdminClient();

// ─── Generate invoice number ─────────────────────────────
async function nextInvoiceNumber(): Promise<string> {
  const db = admin();
  const { data: setting } = await db
    .from("system_settings")
    .select("value")
    .eq("key", "next_invoice_number")
    .single();

  const current = parseInt(setting?.value || "41000", 10);
  await db
    .from("system_settings")
    .update({ value: String(current + 1), updated_at: new Date().toISOString() })
    .eq("key", "next_invoice_number");

  return String(current);
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
    .select("*, customer:customers(*), rep:reps(name), delivery_address:customer_delivery_addresses(*)")
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

  // Get despatch + lines
  const { data: despatch } = await db
    .from("despatches")
    .select("*, transporter:transporters(transporter_name)")
    .eq("order_id", orderId)
    .single();

  let despatchLines: any[] = [];
  if (despatch) {
    const { data: dl } = await db
      .from("despatch_lines")
      .select("*, breed:breeds(breed_name), rearer:rearers(name)")
      .eq("despatch_id", despatch.id);
    let rawLines = dl ?? [];

    // Consolidate if flag is set
    if (despatch.consolidate_invoice && rawLines.length > 0) {
      const grouped = new Map<string, any>();
      const unlinked: any[] = [];
      for (const line of rawLines) {
        if (!line.order_line_id) { unlinked.push(line); continue; }
        const ex = grouped.get(line.order_line_id);
        if (ex) {
          ex.quantity += line.quantity;
        } else {
          grouped.set(line.order_line_id, { ...line, rearer: null, rearer_id: null });
        }
      }
      rawLines = [...grouped.values(), ...unlinked];
    }
    despatchLines = rawLines;
  }

  // Get order lines for food clause comparison
  const { data: orderLines } = await db.from("order_lines").select("id, food_clause_value").eq("order_id", orderId);

  // Get food clause multiplier
  const { data: fcSetting } = await db.from("system_settings").select("value").eq("key", "food_clause_multiplier").single();
  const multiplier = parseFloat(fcSetting?.value || "0.60");

  // Get default VAT rate
  const { data: defaultVat } = await db.from("vat_rates").select("id, rate").eq("is_default", true).maybeSingle();

  const invoiceNumber = await nextInvoiceNumber();
  const today = new Date().toISOString().split("T")[0];

  const { data: invoice, error } = await db
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      order_id: orderId,
      customer_id: order.customer_id,
      invoice_date: today,
      vat_rate_id: defaultVat?.id || null,
      status: "draft",
      export_status: "pending",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Build invoice lines from despatch data
  const customer = order.customer as any;
  const deliveryAddr = order.delivery_address as any;
  const taxRate = Number(defaultVat?.rate ?? 0);
  const deliveryDate = despatch?.actual_delivery_date
    ? new Date(despatch.actual_delivery_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
    : "";

  const invoiceLines: Array<{
    invoice_id: string;
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
  }> = [];

  for (const dl of despatchLines) {
    // Build description like the PDF does
    const breedName = dl.breed?.breed_name || "Pullets";
    const age = dl.age_weeks ? `${dl.age_weeks} wks old` : "";
    const desc = [`${breedName} ${age}`.trim()];
    if (deliveryAddr) {
      desc.push(`Delivered to: ${deliveryAddr.label || ""}`);
      if (customer?.company_name) desc.push(customer.company_name);
      if (deliveryAddr.address_line_1) desc.push(deliveryAddr.address_line_1);
      if (deliveryAddr.town_city) desc.push(deliveryAddr.town_city);
      if (deliveryAddr.post_code) desc.push(deliveryAddr.post_code);
    }

    invoiceLines.push({
      invoice_id: invoice.id,
      description: desc.join("\n"),
      quantity: dl.quantity,
      unit_price: Number(dl.price),
      vat_rate: taxRate,
    });
  }

  // Add food clause adjustment line if applicable
  let totalFoodClauseAdj = 0;
  let totalFoodClauseQty = 0;
  for (const dl of despatchLines) {
    const ol = (orderLines ?? []).find((o: any) => o.id === dl.order_line_id);
    const orderFeed = ol ? Number(ol.food_clause_value || 0) : 0;
    const despatchFeed = Number(dl.food_clause_value || 0);
    const changePerTon = despatchFeed - orderFeed;
    const adjPerPullet = (changePerTon * multiplier) / 100;
    totalFoodClauseAdj += adjPerPullet * dl.quantity;
    totalFoodClauseQty += dl.quantity;
  }

  if (totalFoodClauseAdj !== 0 && totalFoodClauseQty > 0) {
    const perPullet = totalFoodClauseAdj / totalFoodClauseQty;
    invoiceLines.push({
      invoice_id: invoice.id,
      description: "Food Clause Adjustment",
      quantity: totalFoodClauseQty,
      unit_price: Number(perPullet.toFixed(4)),
      vat_rate: taxRate,
    });
  }

  if (invoiceLines.length > 0) {
    await db.from("invoice_lines").insert(invoiceLines);
  }

  // Transition order to invoiced
  await db.from("orders").update({ status: "invoiced" }).eq("id", orderId);

  return invoice as Invoice;
}

// ─── Create ad-hoc invoice ────────────────────────────────
export async function createAdHocInvoice(input: {
  customer_id: string;
  invoice_date: string;
  vat_rate_id?: string;
}) {
  const db = admin();
  const invoiceNumber = await nextInvoiceNumber();

  const { data: invoice, error } = await db
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      order_id: null,
      customer_id: input.customer_id,
      invoice_date: input.invoice_date,
      vat_rate_id: input.vat_rate_id || null,
      status: "draft",
      export_status: "pending",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return invoice as Invoice;
}

// ─── Get invoice with relations ──────────────────────────
export async function getInvoice(id: string) {
  const db = admin();

  const { data: invoice, error } = await db
    .from("invoices")
    .select("*, customer:customers(*), order:orders(order_number, rep:reps(name)), vat_rate:vat_rates(name, rate)")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);

  // Get invoice lines
  const { data: lines } = await db
    .from("invoice_lines")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at");

  return { ...invoice, lines: lines ?? [] };
}

// ─── Save invoice lines ─────────────────────────────────
export async function saveInvoiceLines(invoiceId: string, lines: Array<{
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
}>) {
  const db = admin();

  // Delete existing and re-insert
  await db.from("invoice_lines").delete().eq("invoice_id", invoiceId);

  if (lines.length > 0) {
    const { error } = await db.from("invoice_lines").insert(
      lines.map((l) => ({
        invoice_id: invoiceId,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        vat_rate: l.vat_rate,
      }))
    );
    if (error) throw new Error(error.message);
  }

  // Recalculate totals
  const netTotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const vatTotal = lines.reduce((s, l) => s + l.quantity * l.unit_price * (l.vat_rate / 100), 0);

  await db.from("invoices").update({
    net_total: netTotal,
    vat_total: vatTotal,
    grand_total: netTotal + vatTotal,
  }).eq("id", invoiceId);

  return getInvoice(invoiceId);
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

// ─── Get invoice PDF data ────────────────────────────────
export async function getInvoicePdfData(invoiceId: string) {
  const db = admin();

  const { data: invoice } = await db
    .from("invoices")
    .select("*, customer:customers(*), order:orders(*, rep:reps(name), delivery_address:customer_delivery_addresses(*))")
    .eq("id", invoiceId)
    .single();

  if (!invoice) throw new Error("Invoice not found");

  // Get system settings
  const { data: settings } = await db.from("system_settings").select("key, value");
  const sm = Object.fromEntries((settings ?? []).map((s: any) => [s.key, s.value]));

  // Get despatch + lines
  let despatch: any = null;
  let despatchLines: any[] = [];
  if (invoice.order_id) {
    const { data: d } = await db.from("despatches").select("*, transporter:transporters(transporter_name)").eq("order_id", invoice.order_id).single();
    despatch = d;
    if (d) {
      const { data: dl } = await db.from("despatch_lines").select("*, breed:breeds(breed_name), rearer:rearers(name)").eq("despatch_id", d.id);
      let rawLines = dl ?? [];
      // Consolidate if flag is set on despatch
      if (d.consolidate_invoice && rawLines.length > 0) {
        const grouped = new Map<string, any>();
        const unlinked: any[] = [];
        for (const line of rawLines) {
          if (!line.order_line_id) { unlinked.push(line); continue; }
          const existing = grouped.get(line.order_line_id);
          if (existing) {
            existing.quantity += line.quantity;
          } else {
            grouped.set(line.order_line_id, { ...line, rearer: null, rearer_id: null });
          }
        }
        rawLines = [...grouped.values(), ...unlinked];
      }
      despatchLines = rawLines;
    }
  }

  // Get VAT rate
  const { data: vatRate } = invoice.vat_rate_id
    ? await db.from("vat_rates").select("rate").eq("id", invoice.vat_rate_id).single()
    : { data: null };
  const taxRate = Number(vatRate?.rate ?? 0);

  const order = invoice.order as any;
  const customer = invoice.customer as any;
  const repName = order?.rep?.name || "";
  const deliveryAddr = order?.delivery_address;

  // Build lines
  const pdfLines = despatchLines.map((l: any) => {
    const amount = l.quantity * Number(l.price);
    const details = [
      `${l.breed?.breed_name || "Pullets"} ${l.age_weeks ? l.age_weeks + " wks old" : ""}`.trim(),
    ];
    if (deliveryAddr) {
      details.push(`Delivered to:${deliveryAddr.label || ""}`);
      if (customer?.company_name) details.push(customer.company_name);
      if (deliveryAddr.address_line_1) details.push(deliveryAddr.address_line_1);
      if (deliveryAddr.address_line_2) details.push(deliveryAddr.address_line_2);
      if (deliveryAddr.town_city) details.push(deliveryAddr.town_city + ",");
      if (deliveryAddr.post_code) details.push(deliveryAddr.post_code);
    }
    return {
      deliveryDate: despatch?.actual_delivery_date
        ? new Date(despatch.actual_delivery_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
        : "",
      despatchNumber: despatch?.despatch_number || "",
      quantity: l.quantity,
      details,
      price: Number(l.price),
      taxRate,
      amount,
    };
  });

  // Food clause adjustment — calculated using multiplier
  // (despatch_feed - order_feed) × multiplier / 100 = adjustment per pullet in £
  const foodClauseMultiplier = parseFloat(sm["food_clause_multiplier"] || "0.60");

  // Get order lines to compare food clause values
  let orderLines: any[] = [];
  if (invoice.order_id) {
    const { data: ol } = await db.from("order_lines").select("id, food_clause_value").eq("order_id", invoice.order_id);
    orderLines = ol ?? [];
  }

  let totalFoodClauseAdj = 0;
  let foodClausePricePerPullet = 0;
  let totalFoodClauseQty = 0;

  despatchLines.forEach((dl: any) => {
    const orderLine = orderLines.find((ol: any) => ol.id === dl.order_line_id);
    const orderFeed = orderLine ? Number(orderLine.food_clause_value || 0) : 0;
    const despatchFeed = Number(dl.food_clause_value || 0);
    const changePerTon = despatchFeed - orderFeed;
    const adjPerPulletPounds = (changePerTon * foodClauseMultiplier) / 100;
    totalFoodClauseAdj += adjPerPulletPounds * dl.quantity;
    totalFoodClauseQty += dl.quantity;
  });

  // Per-pullet adjustment for display on invoice
  if (totalFoodClauseQty > 0) {
    foodClausePricePerPullet = totalFoodClauseAdj / totalFoodClauseQty;
  }

  const lineTotal = pdfLines.reduce((s, l) => s + l.amount, 0);
  const strictlyNet = lineTotal + totalFoodClauseAdj;
  const totalVat = strictlyNet * (taxRate / 100);
  const invoiceTotal = strictlyNet + totalVat;

  const paymentTermsDays = parseInt(sm["payment_terms_days"] || "7", 10);
  const invoiceDateObj = new Date(invoice.invoice_date);
  const dueDate = new Date(invoiceDateObj);
  dueDate.setDate(dueDate.getDate() + paymentTermsDays);

  return {
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoiceDateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
    orderNumber: order?.order_number || "",
    repName,
    vatRegistration: sm["vat_registration"] || "",
    customer: {
      company_name: deliveryAddr?.label || customer?.company_name || "",
      address_line_1: deliveryAddr?.address_line_1 || customer?.address_line_1 || undefined,
      address_line_2: deliveryAddr?.address_line_2 || customer?.address_line_2 || undefined,
      town_city: deliveryAddr?.town_city || customer?.town_city || undefined,
      post_code: deliveryAddr?.post_code || customer?.post_code || undefined,
    },
    lines: pdfLines,
    foodClauseAdjustment: foodClausePricePerPullet,
    foodClauseTaxRate: taxRate,
    totalVat,
    strictlyNet,
    invoiceTotal,
    paymentDueDate: dueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
    paymentTermsDays,
    bankName: sm["bank_name"] || "",
    bankSortCode: sm["bank_sort_code"] || "",
    bankAccountNo: sm["bank_account_no"] || "",
  };
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
