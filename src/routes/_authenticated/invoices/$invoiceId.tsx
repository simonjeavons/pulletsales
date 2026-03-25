import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInvoiceFn,
  saveInvoiceLinesFn,
  finaliseInvoiceFn,
  getInvoicePdfDataFn,
} from "~/server/functions/invoices";
import { pdf } from "@react-pdf/renderer";
import { InvoicePdf } from "~/lib/pdf/InvoicePdf";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { Badge } from "~/components/ui/Badge";
import { FormField, inputClasses } from "~/components/forms/FormField";
import { EmailModal, type EmailRecipient, type EmailAttachment as EmailAtt } from "~/components/ui/EmailModal";
import { getEmailTemplateByKeyFn } from "~/server/functions/email-templates";
import type { InvoiceStatus } from "~/types/database";

export const Route = createFileRoute("/_authenticated/invoices/$invoiceId")({
  component: InvoiceDetailPage,
});

const statusColors: Record<InvoiceStatus, "success" | "warning" | "info" | "neutral" | "danger"> = {
  draft: "neutral",
  finalised: "info",
  exported: "success",
  void: "danger",
};

interface LineEntry {
  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
}

const emptyLine = (): LineEntry => ({
  description: "",
  quantity: "1",
  unit_price: "0.00",
  vat_rate: "0",
});

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => getInvoiceFn({ data: { id: invoiceId } }),
  });

  const isOrderBased = !!invoice?.order_id;

  // Always fetch PDF data for order-based invoices
  const { data: pdfData, isLoading: pdfLoading } = useQuery({
    queryKey: ["invoicePdfData", invoiceId],
    queryFn: () => getInvoicePdfDataFn({ data: { invoiceId } }),
    enabled: isOrderBased,
  });

  // Editable lines state (ad-hoc invoices or when editing order-based)
  const [lines, setLines] = useState<LineEntry[]>([emptyLine()]);
  const [linesInitialized, setLinesInitialized] = useState(false);

  useEffect(() => {
    if (invoice && !linesInitialized) {
      if (invoice.lines && invoice.lines.length > 0) {
        setLines(
          invoice.lines.map((l: any) => ({
            description: l.description,
            quantity: String(l.quantity),
            unit_price: String(l.unit_price),
            vat_rate: String(l.vat_rate),
          }))
        );
      } else {
        setLines([emptyLine()]);
      }
      setLinesInitialized(true);
    }
  }, [invoice, linesInitialized]);

  const saveLinesMut = useMutation({
    mutationFn: saveInvoiceLinesFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoicePdfData", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setEditing(false);
    },
  });

  const finaliseMut = useMutation({
    mutationFn: finaliseInvoiceFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const updateLine = (idx: number, field: keyof LineEntry, value: string) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveLines = () => {
    const validLines = lines.filter((l) => l.description.trim());
    saveLinesMut.mutate({
      data: {
        invoiceId,
        lines: validLines.map((l) => ({
          description: l.description,
          quantity: parseFloat(l.quantity || "1"),
          unit_price: parseFloat(l.unit_price || "0"),
          vat_rate: parseFloat(l.vat_rate || "0"),
        })),
      },
    });
  };

  const handlePrintPdf = async () => {
    try {
      const data = pdfData || (await getInvoicePdfDataFn({ data: { invoiceId } }));
      const blob = await pdf(<InvoicePdf data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice_${data.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Invoice PDF failed:", err);
    }
  };

  const [showEmailModal, setShowEmailModal] = useState(false);

  const getInvoiceEmailRecipients = (): EmailRecipient[] => {
    const recipients: EmailRecipient[] = [];
    const orderObj = (invoice as any)?.order;
    const customerObj = (invoice as any)?.customer;
    if (orderObj?.rep?.email) {
      recipients.push({ label: "Rep", email: orderObj.rep.email, name: orderObj.rep.name || "Sir/Madam" });
    }
    if (customerObj?.email) {
      recipients.push({ label: "Customer", email: customerObj.email, name: customerObj.contact_name || customerObj.company_name || "Sir/Madam" });
    }
    return recipients;
  };

  const generateInvoiceBase64 = async (): Promise<string> => {
    const data = pdfData || (await getInvoicePdfDataFn({ data: { invoiceId } }));
    const blob = await pdf(<InvoicePdf data={data} />).toBlob();
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  if (isLoading || !invoice) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const isDraft = invoice.status === "draft";

  // Calculate totals from lines
  const netTotal = lines.reduce((s, l) => s + parseFloat(l.quantity || "0") * parseFloat(l.unit_price || "0"), 0);
  const vatTotal = lines.reduce((s, l) => {
    const net = parseFloat(l.quantity || "0") * parseFloat(l.unit_price || "0");
    return s + net * (parseFloat(l.vat_rate || "0") / 100);
  }, 0);

  return (
    <div>
      <PageHeader
        title={`Invoice ${invoice.invoice_number}`}
        description={`${(invoice as any).customer?.company_name || "Ad-hoc"} ${(invoice as any).order ? `— Order ${(invoice as any).order.order_number}` : ""}`}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={statusColors[invoice.status as InvoiceStatus]}>
              {invoice.status}
            </Badge>
            {invoice.exported_at && <Badge variant="success">Exported</Badge>}
            <Button variant="secondary" size="sm" onClick={handlePrintPdf}>
              📄 Print Invoice
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowEmailModal(true)}>
              ✉️ Email Invoice
            </Button>
            {isDraft && (
              <Button size="sm" onClick={() => finaliseMut.mutate({ data: { id: invoiceId } })} loading={finaliseMut.isPending}>
                Finalise
              </Button>
            )}
          </div>
        }
      />

      {/* Invoice Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 max-w-5xl">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block">Invoice Number</span>
            <span className="font-medium">{invoice.invoice_number}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Date</span>
            <span className="font-medium">{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Customer</span>
            <span className="font-medium">{(invoice as any).customer?.company_name || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 block">VAT Rate</span>
            <span className="font-medium">{(invoice as any).vat_rate ? `${(invoice as any).vat_rate.name} (${Number((invoice as any).vat_rate.rate).toFixed(2)}%)` : "Zero Rate"}</span>
          </div>
        </div>
      </div>

      {/* ─── Order-based invoice: despatch breakdown (read-only) ─── */}
      {isOrderBased && !editing && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 max-w-5xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Invoice Details</h3>
              <p className="text-xs text-gray-400">Generated from despatch data.</p>
            </div>
            {isDraft && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                ✏️ Edit Lines
              </Button>
            )}
          </div>

          {pdfLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-4 border-brand-500 border-t-transparent rounded-full" />
            </div>
          )}

          {pdfData && (
            <>
              {/* Delivery To */}
              <div className="mb-3 text-sm">
                <span className="text-gray-500 font-medium">To: </span>
                <span className="font-semibold">{pdfData.customer.company_name}</span>
                {pdfData.customer.address_line_1 && <span className="text-gray-600">, {pdfData.customer.address_line_1}</span>}
                {pdfData.customer.town_city && <span className="text-gray-600">, {pdfData.customer.town_city}</span>}
                {pdfData.customer.post_code && <span className="text-gray-600">, {pdfData.customer.post_code}</span>}
              </div>

              {/* Order info */}
              <div className="mb-4 text-sm">
                <span className="text-gray-500 font-medium">Order No: </span>
                <span className="font-semibold">{pdfData.orderNumber}/{pdfData.repName}</span>
              </div>

              {/* Lines table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-xs text-gray-500 uppercase">
                    <th className="pb-2 text-left" style={{ width: "12%" }}>Delivery Date</th>
                    <th className="pb-2 text-left" style={{ width: "10%" }}>Despatch No.</th>
                    <th className="pb-2 text-right" style={{ width: "8%" }}>Number</th>
                    <th className="pb-2 text-left pl-4">Details</th>
                    <th className="pb-2 text-right" style={{ width: "10%" }}>Price</th>
                    <th className="pb-2 text-right" style={{ width: "8%" }}>Tax Rate</th>
                    <th className="pb-2 text-right" style={{ width: "12%" }}>£</th>
                  </tr>
                </thead>
                <tbody>
                  {pdfData.lines.map((line: any, i: number) => (
                    <tr key={i} className="border-b border-gray-100 align-top">
                      <td className="py-3 text-gray-700">{line.deliveryDate}</td>
                      <td className="py-3 text-gray-700">{line.despatchNumber}</td>
                      <td className="py-3 text-right font-medium">{line.quantity.toLocaleString()}</td>
                      <td className="py-3 pl-4">
                        {line.details.map((d: string, j: number) => (
                          <div key={j} className={j === 0 ? "font-medium text-gray-900" : "text-gray-500 text-xs"}>
                            {d}
                          </div>
                        ))}
                      </td>
                      <td className="py-3 text-right font-medium">{line.price.toFixed(4)}</td>
                      <td className="py-3 text-right text-gray-500">{line.taxRate.toFixed(2)}</td>
                      <td className="py-3 text-right font-medium">
                        {line.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}

                  {/* Food clause adjustment */}
                  {pdfData.foodClauseAdjustment !== 0 && (
                    <tr className="border-b border-gray-100 align-top">
                      <td className="py-3"></td>
                      <td className="py-3"></td>
                      <td className="py-3"></td>
                      <td className="py-3 pl-4 font-medium text-gray-900">Food Clause Adjustment</td>
                      <td className={`py-3 text-right font-medium ${pdfData.foodClauseAdjustment < 0 ? "text-green-600" : "text-red-600"}`}>
                        {pdfData.foodClauseAdjustment.toFixed(4)}
                      </td>
                      <td className="py-3 text-right text-gray-500">{pdfData.foodClauseTaxRate.toFixed(2)}</td>
                      <td className={`py-3 text-right font-medium ${pdfData.foodClauseAdjustment < 0 ? "text-green-600" : "text-red-600"}`}>
                        {(() => {
                          const totalQty = pdfData.lines.reduce((s: number, l: any) => s + l.quantity, 0);
                          const adj = totalQty * pdfData.foodClauseAdjustment;
                          return `${adj < 0 ? "-" : ""}${Math.abs(adj).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
                        })()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Totals */}
              <div className="border-t-2 border-gray-300 mt-4 pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total VAT</span>
                      <span></span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Strictly Net</span>
                      <span className="font-medium">{pdfData.totalVat.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-gray-300 pt-2">
                      <span>Invoice Total</span>
                      <span>£{pdfData.invoiceTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-sm text-gray-500">
                <span className="font-medium">Payment Due By:</span> {pdfData.paymentDueDate}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Editable lines (ad-hoc OR when editing order-based) ─── */}
      {(!isOrderBased || editing) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 max-w-5xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Invoice Lines</h3>
            <div className="flex items-center gap-2">
              {editing && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
              {isDraft && (
                <Button type="button" variant="secondary" size="sm" onClick={addLine}>
                  + Add Line
                </Button>
              )}
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-12 gap-3 mb-2">
            <div className="col-span-5 text-xs font-medium text-gray-500 uppercase">Description</div>
            <div className="col-span-2 text-xs font-medium text-gray-500 uppercase">Quantity</div>
            <div className="col-span-2 text-xs font-medium text-gray-500 uppercase">Unit Price (£)</div>
            <div className="col-span-1 text-xs font-medium text-gray-500 uppercase">VAT %</div>
            <div className="col-span-1 text-xs font-medium text-gray-500 uppercase text-right">Total</div>
            <div className="col-span-1"></div>
          </div>

          <div className="space-y-2">
            {lines.map((line, idx) => {
              const lineTotal = parseFloat(line.quantity || "0") * parseFloat(line.unit_price || "0");
              return (
                <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(idx, "description", e.target.value)}
                      className={inputClasses}
                      placeholder="e.g. Commission, Consultancy, etc."
                      disabled={!isDraft}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                      className={inputClasses}
                      disabled={!isDraft}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.unit_price}
                      onChange={(e) => updateLine(idx, "unit_price", e.target.value)}
                      className={inputClasses}
                      disabled={!isDraft}
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      step="0.01"
                      value={line.vat_rate}
                      onChange={(e) => updateLine(idx, "vat_rate", e.target.value)}
                      className={inputClasses}
                      disabled={!isDraft}
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-sm font-medium text-gray-700">£{lineTotal.toFixed(2)}</span>
                  </div>
                  <div className="col-span-1 text-center">
                    {isDraft && lines.length > 1 && (
                      <button
                        onClick={() => removeLine(idx)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="Remove line"
                      >
                        <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="border-t border-gray-200 mt-6 pt-4">
            <div className="flex justify-end">
              <div className="w-60 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Net Total</span>
                  <span className="font-medium">£{netTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">VAT</span>
                  <span className="font-medium">£{vatTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-gray-300 pt-2">
                  <span>Total</span>
                  <span>£{(netTotal + vatTotal).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {isDraft && (
            <div className="mt-4">
              <Button onClick={handleSaveLines} loading={saveLinesMut.isPending}>
                Save Lines
              </Button>
            </div>
          )}
        </div>
      )}

      <Link to="/invoices" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
        ← Back to Invoices
      </Link>

      {showEmailModal && (
        <EmailModal
          open={true}
          onClose={() => setShowEmailModal(false)}
          title="Email Invoice"
          defaultSubject={`Invoice ${invoice.invoice_number} — ${(invoice as any).customer?.company_name || ""}`}
          recipients={getInvoiceEmailRecipients()}
          attachments={[
            {
              label: "Invoice",
              filename: `Invoice_${invoice.invoice_number}.pdf`,
              generateBase64: generateInvoiceBase64,
              selected: true,
            },
          ]}
          defaultBody={`Please find attached Invoice ${invoice.invoice_number}.`}
          loadTemplate={async () => {
            try {
              const t = await getEmailTemplateByKeyFn({ data: { key: "invoice" } });
              if (!t) return null;
              const vars: Record<string, string> = {
                invoice_number: String(invoice.invoice_number),
                order_number: String((invoice as any).order?.order_number || ""),
                customer_name: (invoice as any).customer?.company_name || "",
                rep_name: (invoice as any).order?.rep?.name || "",
              };
              let subject = t.subject;
              let body = t.body;
              for (const [k, v] of Object.entries(vars)) {
                subject = subject.replaceAll(`{{${k}}}`, v);
                body = body.replaceAll(`{{${k}}}`, v);
              }
              return { subject, body };
            } catch { return null; }
          }}
        />
      )}
    </div>
  );
}
