import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import { getOrderFn, transitionOrderFn } from "~/server/functions/orders";
import {
  getDespatchFn,
  saveDespatchFn,
  completeDespatchFn,
  copyOrderLinesToDespatchFn,
} from "~/server/functions/despatches";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { Badge } from "~/components/ui/Badge";
import { ConfirmModal } from "~/components/ui/Modal";
import {
  FormField,
  inputClasses,
  selectClasses,
  checkboxClasses,
  textareaClasses,
} from "~/components/forms/FormField";
import type { OrderStatus, OrderWithRelations } from "~/types/database";
import type { DespatchLineInput } from "~/lib/validation/schemas";
import { pdf } from "@react-pdf/renderer";
import { OrderConfirmationPdf } from "~/lib/pdf/OrderConfirmationPdf";
import { DeliveryAdvicePdf } from "~/lib/pdf/DeliveryAdvicePdf";
import { DespatchNotePdf } from "~/lib/pdf/DespatchNotePdf";
import { SalmonellaFormPdf } from "~/lib/pdf/SalmonellaFormPdf";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  component: OrderDetailPage,
});

const statusColors: Record<OrderStatus, "success" | "warning" | "danger" | "info" | "neutral"> = {
  draft: "neutral",
  confirmed: "info",
  amended: "warning",
  pending_despatch: "warning",
  ready_for_despatch: "warning",
  completed: "success",
  cancelled: "danger",
  invoiced: "success",
};

const statusLabels: Record<OrderStatus, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  amended: "Amended",
  pending_despatch: "Pending Despatch",
  ready_for_despatch: "Ready for Despatch",
  completed: "Completed",
  cancelled: "Cancelled",
  invoiced: "Invoiced",
};

async function downloadPdf(element: React.ReactElement, filename: string) {
  try {
    const blob = await pdf(element).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("PDF generation failed:", err);
  }
}

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"order" | "despatch">("order");
  const [confirmAction, setConfirmAction] = useState<{
    status: OrderStatus;
    label: string;
  } | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrderFn({ data: { id: orderId } }),
  });

  const transitionMut = useMutation({
    mutationFn: transitionOrderFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", orderId], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["orders"], refetchType: "all" });
      setConfirmAction(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!order) return <div className="p-8 text-gray-500">Order not found</div>;

  const canConfirm = (order.status === "draft" || order.status === "amended") && order.lines.length > 0;
  const canDespatch = ["confirmed", "amended", "pending_despatch", "ready_for_despatch"].includes(order.status);
  const canCancel = ["draft", "confirmed", "amended"].includes(order.status);
  const isAmended = order.status === "amended";
  const canGenerateConfirmationPdf = ["confirmed", "amended", "pending_despatch", "ready_for_despatch", "completed", "invoiced"].includes(order.status);

  const handleOrderConfirmationPdf = () => {
    const repName = order.rep?.name || "";
    const isAmendedPdf = order.status === "amended" || (order.amendment_count ?? 0) > 0;
    const confirmDate = order.confirmed_at
      ? new Date(order.confirmed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

    downloadPdf(
      <OrderConfirmationPdf data={{
        isAmended: isAmendedPdf,
        date: confirmDate,
        orderNumber: order.order_number,
        repName,
        customer: {
          company_name: order.customer?.company_name || "",
          address_line_1: order.customer?.address_line_1 || undefined,
          address_line_2: order.customer?.address_line_2 || undefined,
          town_city: order.customer?.town_city || undefined,
          post_code: order.customer?.post_code || undefined,
        },
        lines: order.lines.map((l, i) => ({
          itemNumber: i + 1,
          deliveryDate: order.requested_delivery_week_commencing
            ? new Date(order.requested_delivery_week_commencing).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
            : "TBC",
          quantity: l.quantity,
          breed: l.breed?.breed_name || "",
          age: l.age_weeks,
          price: Number(l.price),
          foodClause: Number(l.food_clause_value),
          deliveryAddress: order.delivery_address ? {
            label: order.delivery_address.label,
            address_line_1: order.delivery_address.address_line_1 || undefined,
            town_city: order.delivery_address.town_city || undefined,
            post_code: order.delivery_address.post_code || undefined,
          } : undefined,
          extras: l.extras.map((e) => e.name),
        })),
      }} />,
      `Order_Confirmation_${order.order_number}.pdf`
    );
  };

  return (
    <div>
      <PageHeader
        title={`Order ${order.order_number}`}
        description={order.customer?.company_name}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={statusColors[order.status]}>
              {statusLabels[order.status]}
            </Badge>
            {canGenerateConfirmationPdf && (
              <Button size="sm" variant="secondary" onClick={handleOrderConfirmationPdf}>
                📄 Order Confirmation PDF
              </Button>
            )}
            {canConfirm && (
              <Button
                size="sm"
                onClick={() =>
                  setConfirmAction({ status: "confirmed", label: isAmended ? "Re-confirm Order" : "Confirm Order" })
                }
              >
                {isAmended ? "Re-confirm Order" : "Confirm Order"}
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  setConfirmAction({ status: "cancelled", label: "Cancel Order" })
                }
              >
                Cancel
              </Button>
            )}
          </div>
        }
      />

      {/* ─── Tabs ────────────────────────────────────── */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          <button
            onClick={() => setTab("order")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "order"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Order Details
          </button>
          <button
            onClick={() => setTab("despatch")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "despatch"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Despatch
          </button>
        </nav>
      </div>

      {tab === "order" && <OrderTab order={order} />}
      {tab === "despatch" && (
        <DespatchTab
          orderId={orderId}
          order={order}
          canDespatch={canDespatch}
        />
      )}

      <ConfirmModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() =>
          confirmAction &&
          transitionMut.mutate({
            data: { id: orderId, status: confirmAction.status },
          })
        }
        title={confirmAction?.label || ""}
        message={`Are you sure you want to ${confirmAction?.label.toLowerCase()}?`}
        confirmLabel={confirmAction?.label || "Confirm"}
        confirmVariant={confirmAction?.status === "cancelled" ? "danger" : "primary"}
        loading={transitionMut.isPending}
      />
    </div>
  );
}

// ─── Order Tab ───────────────────────────────────────────
function OrderTab({ order }: { order: OrderWithRelations }) {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block">Customer</span>
            <span className="font-medium">{order.customer?.company_name}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Delivery Address</span>
            <span className="font-medium">
              {order.delivery_address
                ? `${order.delivery_address.label} — ${order.delivery_address.town_city || ""}`
                : "—"}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block">Rep</span>
            <span className="font-medium">{order.rep?.name || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Requested W/C</span>
            <span className="font-medium">
              {order.requested_delivery_week_commencing
                ? new Date(order.requested_delivery_week_commencing).toLocaleDateString()
                : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Lines</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500 uppercase text-xs">
              <th className="pb-2">Breed</th>
              <th className="pb-2">Rearer</th>
              <th className="pb-2">Age (wks)</th>
              <th className="pb-2">Qty</th>
              <th className="pb-2">Price</th>
              <th className="pb-2">Food Clause</th>
              <th className="pb-2">Line Total</th>
              <th className="pb-2">Extras</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {order.lines.map((line) => (
              <tr key={line.id}>
                <td className="py-3 font-medium">{line.breed?.breed_name}</td>
                <td className="py-3">{(line as any).rearer?.name || "—"}</td>
                <td className="py-3">{line.age_weeks ?? "—"}</td>
                <td className="py-3">{line.quantity.toLocaleString()}</td>
                <td className="py-3">£{Number(line.price).toFixed(2)}</td>
                <td className="py-3">{Number(line.food_clause_value).toFixed(2)}</td>
                <td className="py-3 font-medium">
                  £{(line.quantity * Number(line.price)).toFixed(2)}
                </td>
                <td className="py-3">
                  {line.extras.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {line.extras.map((ex) => (
                        <Badge key={ex.id} variant="info">
                          {ex.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Order-level extras */}
      {order.extras.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Extras</h3>
          <div className="flex flex-wrap gap-2">
            {order.extras.map((ex) => (
              <Badge key={ex.id} variant="info">{ex.name}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {(order.customer_notes || order.internal_notes) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {order.customer_notes && (
              <div>
                <span className="text-gray-500 block mb-1">Customer Notes</span>
                <p className="text-gray-700 whitespace-pre-wrap">{order.customer_notes}</p>
              </div>
            )}
            {order.internal_notes && (
              <div>
                <span className="text-gray-500 block mb-1">Internal Notes</span>
                <p className="text-gray-700 whitespace-pre-wrap">{order.internal_notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Despatch Tab ────────────────────────────────────────
function DespatchTab({
  orderId,
  order,
  canDespatch,
}: {
  orderId: string;
  order: OrderWithRelations;
  canDespatch: boolean;
}) {
  const qc = useQueryClient();
  const supabase = getSupabaseBrowserClient();
  const [transporters, setTransporters] = useState<any[]>([]);
  const [extras, setExtras] = useState<any[]>([]);

  const [deliveryDate, setDeliveryDate] = useState("");
  const [unloadingTime, setUnloadingTime] = useState("");
  const [transporterId, setTransporterId] = useState("");
  const [adviceSalutation, setAdviceSalutation] = useState("");
  const [adviceBody, setAdviceBody] = useState("");
  const [adviceDate, setAdviceDate] = useState("");
  const [isDeliveryAmended, setIsDeliveryAmended] = useState(false);
  const [despatchNotes, setDespatchNotes] = useState("");
  const [rearers, setRearers] = useState<any[]>([]);
  const [lines, setLines] = useState<
    Array<{
      order_line_id: string | null;
      breed_id: string;
      breed_name: string;
      rearer_id: string;
      rearer_name: string;
      age_weeks: string;
      quantity: string;
      price: string;
      food_clause_value: string;
      extra_ids: string[];
    }>
  >([]);
  const [despatchExtraIds, setDespatchExtraIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Load lookups
  useEffect(() => {
    async function load() {
      const [t, e, r] = await Promise.all([
        supabase.from("transporters").select("id, transporter_name").eq("is_active", true).order("transporter_name"),
        supabase.from("extras").select("id, name").eq("is_available", true).order("name"),
        supabase.from("rearers").select("id, name").eq("is_active", true).order("name"),
      ]);
      setTransporters(t.data ?? []);
      setExtras(e.data ?? []);
      setRearers(r.data ?? []);
    }
    load();
  }, []);

  // Load existing despatch or copy from order
  const { data: existingDespatch } = useQuery({
    queryKey: ["despatch", orderId],
    queryFn: () => getDespatchFn({ data: { orderId } }),
  });

  useEffect(() => {
    if (initialized) return;

    if (existingDespatch) {
      setDeliveryDate(existingDespatch.actual_delivery_date || "");
      setUnloadingTime(existingDespatch.proposed_unloading_time || "");
      setTransporterId(existingDespatch.transporter_id || "");
      setAdviceSalutation(existingDespatch.advice_salutation || "");
      setAdviceBody(existingDespatch.advice_body || "");
      setAdviceDate(existingDespatch.advice_date || "");
      setIsDeliveryAmended(existingDespatch.is_delivery_amended || false);
      setDespatchNotes(existingDespatch.despatch_notes || "");
      setLines(
        existingDespatch.lines.map((l: any) => ({
          order_line_id: l.order_line_id,
          breed_id: l.breed_id,
          breed_name: l.breed?.breed_name || "",
          rearer_id: l.rearer_id || "",
          rearer_name: l.rearer?.name || "",
          age_weeks: l.age_weeks != null ? String(l.age_weeks) : "",
          quantity: String(l.quantity),
          price: String(l.price),
          food_clause_value: String(l.food_clause_value),
          extra_ids: l.extras.map((e: any) => e.id),
        }))
      );
      setDespatchExtraIds(existingDespatch.extras.map((e: any) => e.id));
      setInitialized(true);
    } else if (existingDespatch === null && order.lines.length > 0) {
      // Copy from order lines
      setLines(
        order.lines.map((l) => ({
          order_line_id: l.id,
          breed_id: l.breed_id,
          breed_name: l.breed?.breed_name || "",
          rearer_id: (l as any).rearer_id || "",
          rearer_name: (l as any).rearer?.name || "",
          age_weeks: l.age_weeks != null ? String(l.age_weeks) : "",
          quantity: String(l.quantity),
          price: String(Number(l.price)),
          food_clause_value: String(Number(l.food_clause_value)),
          extra_ids: l.extras.map((e) => e.id),
        }))
      );
      setDespatchExtraIds(order.extras.map((e) => e.id));

      // Auto-populate advice text with placeholders
      const totalQty = order.lines.reduce((s, l) => s + l.quantity, 0);
      const firstBreed = order.lines[0]?.breed?.breed_name || "pullets";
      const firstAge = order.lines[0]?.age_weeks;
      const wcDate = order.requested_delivery_week_commencing
        ? new Date(order.requested_delivery_week_commencing).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        : "TBC";

      setAdviceSalutation(`Dear Sir/Madam`);
      setAdviceBody(
        `With further reference to your order for ${totalQty.toLocaleString()} pullets to be supplied during the week commencing ${wcDate}${firstAge ? ` at ${firstAge} weeks old` : ""}.\n\nWe have pleasure in advising you that delivery has been arranged as follows:`
      );
      setAdviceDate(new Date().toISOString().split("T")[0]);
      setInitialized(true);
    }
  }, [existingDespatch, order, initialized]);

  const updateLine = (idx: number, field: string, value: any) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const toggleLineExtra = (idx: number, extraId: string) => {
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              extra_ids: l.extra_ids.includes(extraId)
                ? l.extra_ids.filter((id) => id !== extraId)
                : [...l.extra_ids, extraId],
            }
          : l
      )
    );
  };

  const saveMut = useMutation({
    mutationFn: saveDespatchFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despatch", orderId] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    },
    onError: (err: any) => setError(err.message),
  });

  const completeMut = useMutation({
    mutationFn: completeDespatchFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despatch", orderId] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    },
    onError: (err: any) => setError(err.message),
  });

  const handleSave = () => {
    setError("");
    if (!deliveryDate) {
      setError("Delivery date is required");
      return;
    }
    if (!transporterId) {
      setError("Select a transporter");
      return;
    }

    const validLines = lines.filter((l) => l.breed_id && l.quantity);
    if (validLines.length === 0) {
      setError("At least one despatch line is required");
      return;
    }

    saveMut.mutate({
      data: {
        orderId,
        despatch: {
          actual_delivery_date: deliveryDate,
          proposed_unloading_time: unloadingTime || undefined,
          transporter_id: transporterId,
          advice_salutation: adviceSalutation || undefined,
          advice_body: adviceBody || undefined,
          advice_date: adviceDate || undefined,
          is_delivery_amended: isDeliveryAmended,
          despatch_notes: despatchNotes || undefined,
          lines: validLines.map((l) => ({
            order_line_id: l.order_line_id || null,
            breed_id: l.breed_id,
            rearer_id: l.rearer_id || null,
            age_weeks: l.age_weeks ? parseInt(l.age_weeks, 10) : null,
            quantity: parseInt(l.quantity, 10),
            price: parseFloat(l.price || "0"),
            food_clause_value: parseFloat(l.food_clause_value || "0"),
            extra_ids: l.extra_ids,
          })),
          extra_ids: despatchExtraIds,
        },
      },
    });
  };

  if (!canDespatch && !existingDespatch) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500">
          Despatch is available after the order is confirmed.
        </p>
      </div>
    );
  }

  if (order.status === "completed" || order.status === "invoiced") {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 text-sm">
          This order has been completed and despatched.
        </div>
        {existingDespatch && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="grid grid-cols-3 gap-4 text-sm mb-6">
              <div>
                <span className="text-gray-500 block">Delivery Date</span>
                <span className="font-medium">
                  {existingDespatch.actual_delivery_date
                    ? new Date(existingDespatch.actual_delivery_date).toLocaleDateString()
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Transporter</span>
                <span className="font-medium">
                  {existingDespatch.transporter?.transporter_name || "—"}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Completed</span>
                <span className="font-medium">
                  {existingDespatch.completed_at
                    ? new Date(existingDespatch.completed_at).toLocaleString()
                    : "—"}
                </span>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 uppercase text-xs">
                  <th className="pb-2">Breed</th>
                  <th className="pb-2">Rearer</th>
                  <th className="pb-2">Age (wks)</th>
                  <th className="pb-2">Qty</th>
                  <th className="pb-2">Price</th>
                  <th className="pb-2">Food Clause</th>
                  <th className="pb-2">Extras</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {existingDespatch.lines.map((l: any) => (
                  <tr key={l.id}>
                    <td className="py-2 font-medium">{l.breed?.breed_name}</td>
                    <td className="py-2">{l.rearer?.name || "—"}</td>
                    <td className="py-2">{l.age_weeks ?? "—"}</td>
                    <td className="py-2">{l.quantity}</td>
                    <td className="py-2">£{Number(l.price).toFixed(2)}</td>
                    <td className="py-2">{Number(l.food_clause_value).toFixed(2)}</td>
                    <td className="py-2">
                      {l.extras?.length > 0
                        ? l.extras.map((e: any) => e.name).join(", ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PDF buttons for completed orders */}
        {existingDespatch && (
          <CompletedPdfButtons order={order} despatch={existingDespatch} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* Despatch Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Despatch Details
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Actual Delivery Date" required>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className={inputClasses}
            />
          </FormField>
          <FormField label="Proposed Unloading Time">
            <input
              type="time"
              value={unloadingTime}
              onChange={(e) => setUnloadingTime(e.target.value)}
              className={inputClasses}
            />
          </FormField>
          <FormField label="Transporter" required>
            <select
              value={transporterId}
              onChange={(e) => setTransporterId(e.target.value)}
              className={selectClasses}
            >
              <option value="">— Select transporter —</option>
              {transporters.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.transporter_name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </div>

      {/* Delivery Advice Text */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Delivery Advice Text
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Edit the salutation and body text that will appear on the Delivery Advice PDF. Placeholders are auto-filled from order data.
        </p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField label="Advice Date">
            <input type="date" value={adviceDate} onChange={(e) => setAdviceDate(e.target.value)} className={inputClasses} />
          </FormField>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm pb-2">
              <input type="checkbox" checked={isDeliveryAmended} onChange={(e) => setIsDeliveryAmended(e.target.checked)} className={checkboxClasses} />
              Delivery Amended
            </label>
          </div>
        </div>
        <FormField label="Salutation" className="mb-4">
          <input type="text" value={adviceSalutation} onChange={(e) => setAdviceSalutation(e.target.value)} className={inputClasses} placeholder="e.g. Dear Mr. Smith" />
        </FormField>
        <FormField label="Body Text">
          <textarea value={adviceBody} onChange={(e) => setAdviceBody(e.target.value)} className={textareaClasses} rows={4} placeholder="With further reference to your order..." />
        </FormField>
        <FormField label="Despatch Notes" className="mt-4">
          <textarea value={despatchNotes} onChange={(e) => setDespatchNotes(e.target.value)} className={textareaClasses} rows={2} placeholder="Additional notes for the despatch..." />
        </FormField>
      </div>

      {/* Despatch Lines */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Final Despatch Lines
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Copied from order lines. Edit quantities, prices, or extras as needed
          for the final despatch.
        </p>

        <div className="space-y-4">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className="border border-gray-200 rounded-lg p-4 bg-gray-50"
            >
              <div className="grid grid-cols-6 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Breed
                  </label>
                  <p className="text-sm font-medium">{line.breed_name}</p>
                </div>
                <FormField label="Rearer">
                  <select
                    value={line.rearer_id}
                    onChange={(e) => updateLine(idx, "rearer_id", e.target.value)}
                    className={selectClasses}
                  >
                    <option value="">— Rearer —</option>
                    {rearers.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Age (weeks)">
                  <input
                    type="number"
                    min="0"
                    value={line.age_weeks}
                    onChange={(e) => updateLine(idx, "age_weeks", e.target.value)}
                    className={inputClasses}
                    placeholder="e.g. 16"
                  />
                </FormField>
                <FormField label="Final Quantity">
                  <input
                    type="number"
                    min="1"
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                    className={inputClasses}
                  />
                </FormField>
                <FormField label="Final Price (£)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.price}
                    onChange={(e) => updateLine(idx, "price", e.target.value)}
                    className={inputClasses}
                  />
                </FormField>
                <FormField label="Final Food Clause">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.food_clause_value}
                    onChange={(e) =>
                      updateLine(idx, "food_clause_value", e.target.value)
                    }
                    className={inputClasses}
                  />
                </FormField>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-xs font-medium text-gray-500 uppercase">
                  Extras:
                </span>
                {extras.map((ex) => (
                  <label
                    key={ex.id}
                    className="flex items-center gap-1.5 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={line.extra_ids.includes(ex.id)}
                      onChange={() => toggleLineExtra(idx, ex.id)}
                      className={checkboxClasses}
                    />
                    {ex.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Despatch-level extras */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Despatch-Level Extras
        </h3>
        <div className="flex flex-wrap gap-4">
          {extras.map((ex) => (
            <label
              key={ex.id}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={despatchExtraIds.includes(ex.id)}
                onChange={() =>
                  setDespatchExtraIds((prev) =>
                    prev.includes(ex.id)
                      ? prev.filter((id) => id !== ex.id)
                      : [...prev, ex.id]
                  )
                }
                className={checkboxClasses}
              />
              {ex.name}
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <Button onClick={handleSave} loading={saveMut.isPending}>
          Save Despatch
        </Button>
        <Button
          variant="primary"
          onClick={() => completeMut.mutate({ data: { orderId } })}
          loading={completeMut.isPending}
          disabled={!existingDespatch}
        >
          Mark Completed
        </Button>

        {/* PDF buttons — only show after despatch is saved */}
        {existingDespatch && (
          <>
            <div className="border-l border-gray-300 mx-1" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDeliveryAdvicePdf(existingDespatch)}
            >
              📄 Delivery Advice
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDespatchNotePdf(existingDespatch)}
            >
              📄 Despatch Note
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSalmonellaFormPdf(existingDespatch)}
            >
              📄 Salmonella Form
            </Button>
          </>
        )}
      </div>
    </div>
  );

  // ─── PDF handlers ──────────────────────────────────────
  function handleDeliveryAdvicePdf(desp: any) {
    const repName = order.rep?.name || "";
    const totalQty = lines.reduce((s, l) => s + (parseInt(l.quantity || "0", 10) || 0), 0);
    const firstBreed = lines[0]?.breed_name || "Pullets";
    const firstAge = lines[0]?.age_weeks ? parseInt(lines[0].age_weeks, 10) : null;
    const wcDate = order.requested_delivery_week_commencing
      ? new Date(order.requested_delivery_week_commencing).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "TBC";
    const advDateFormatted = adviceDate
      ? new Date(adviceDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const delivDateFormatted = deliveryDate
      ? new Date(deliveryDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "2-digit" })
      : "TBC";
    const transporterName = transporters.find((t) => t.id === transporterId)?.transporter_name || "";

    const pdfTitle = isDeliveryAmended ? "AMENDED DELIVERY ADVICE" : "DELIVERY ADVICE";

    downloadPdf(
      <DeliveryAdvicePdf data={{
        date: advDateFormatted,
        orderNumber: order.order_number,
        repName,
        customer: {
          company_name: order.customer?.company_name || "",
          address_line_1: order.customer?.address_line_1 || undefined,
          address_line_2: order.customer?.address_line_2 || undefined,
          town_city: order.customer?.town_city || undefined,
          post_code: order.customer?.post_code || undefined,
        },
        totalQuantity: totalQty,
        breed: firstBreed,
        age: firstAge,
        weekCommencing: wcDate,
        lines: lines.map((l) => ({
          deliveryDate: delivDateFormatted,
          quantity: parseInt(l.quantity || "0", 10),
          breed: l.breed_name,
          transporter: transporterName,
          unloadingTime: unloadingTime || "TBC",
          deliveryTo: {
            name: order.delivery_address?.label || order.customer?.company_name || "",
            address_line_1: order.delivery_address?.address_line_1 || order.customer?.address_line_1 || undefined,
            address_line_2: order.delivery_address?.address_line_2 || undefined,
            town_city: order.delivery_address?.town_city || order.customer?.town_city || undefined,
            post_code: order.delivery_address?.post_code || order.customer?.post_code || undefined,
          },
        })),
        extras: extras.filter((e) => despatchExtraIds.includes(e.id)).map((e) => e.name),
      }} />,
      `Delivery_Advice_${order.order_number}.pdf`
    );
  }

  function handleDespatchNotePdf(desp: any) {
    const repName = order.rep?.name || "";
    const totalQty = lines.reduce((s, l) => s + (parseInt(l.quantity || "0", 10) || 0), 0);
    const firstBreed = lines[0]?.breed_name || "Pullets";
    const firstAge = lines[0]?.age_weeks ? parseInt(lines[0].age_weeks, 10) : null;
    const firstRearer = lines[0]?.rearer_id ? rearers.find((r) => r.id === lines[0].rearer_id)?.name || "" : "";
    const transporterName = transporters.find((t) => t.id === transporterId)?.transporter_name || "";
    const delivDateFormatted = deliveryDate
      ? new Date(deliveryDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "2-digit" })
      : "TBC";

    downloadPdf(
      <DespatchNotePdf data={{
        despatchNumber: desp.despatch_number || "",
        orderNumber: order.order_number,
        repName,
        customer: {
          company_name: order.delivery_address?.label || order.customer?.company_name || "",
          address_line_1: order.delivery_address?.address_line_1 || order.customer?.address_line_1 || undefined,
          address_line_2: order.delivery_address?.address_line_2 || undefined,
          town_city: order.delivery_address?.town_city || order.customer?.town_city || undefined,
          post_code: order.delivery_address?.post_code || order.customer?.post_code || undefined,
          phone: undefined,
        },
        rearerName: firstRearer,
        quantity: parseInt(lines[0]?.quantity || "0", 10),
        totalPullets: totalQty,
        breed: firstBreed,
        age: firstAge,
        deliveryDate: delivDateFormatted,
        unloadingTime: unloadingTime || "TBC",
        transporter: transporterName,
        extras: extras.filter((e) => despatchExtraIds.includes(e.id)).map((e) => e.name),
      }} />,
      `Despatch_Note_${desp.despatch_number || order.order_number}.pdf`
    );
  }

  function handleSalmonellaFormPdf(desp: any) {
    const firstRearer = lines[0]?.rearer_id ? rearers.find((r) => r.id === lines[0].rearer_id)?.name || "" : "";
    const firstAge = lines[0]?.age_weeks ? parseInt(lines[0].age_weeks, 10) : null;
    const transporterName = transporters.find((t) => t.id === transporterId)?.transporter_name || "";
    const delivDateFormatted = deliveryDate
      ? new Date(deliveryDate + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
      : "";

    downloadPdf(
      <SalmonellaFormPdf data={{
        despatchNumber: desp.despatch_number || "",
        rearerName: firstRearer,
        customerName: order.customer?.company_name || "",
        customerPostCode: order.customer?.post_code || order.delivery_address?.post_code || "",
        transporter: transporterName,
        age: firstAge,
        deliveryDate: delivDateFormatted,
      }} />,
      `Salmonella_Form_${desp.despatch_number || order.order_number}.pdf`
    );
  }
}

// ─── PDF buttons for completed orders (uses despatch data directly) ──
function CompletedPdfButtons({ order, despatch }: { order: OrderWithRelations; despatch: any }) {
  const repName = order.rep?.name || "";
  const dLines = despatch.lines || [];
  const totalQty = dLines.reduce((s: number, l: any) => s + (l.quantity || 0), 0);
  const firstBreed = dLines[0]?.breed?.breed_name || "Pullets";
  const firstAge = dLines[0]?.age_weeks ?? null;
  const firstRearer = dLines[0]?.rearer?.name || "";
  const transporterName = despatch.transporter?.transporter_name || "";
  const dExtras = (despatch.extras || []).map((e: any) => e.name);

  const wcDate = order.requested_delivery_week_commencing
    ? new Date(order.requested_delivery_week_commencing).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "TBC";
  const delivDateFormatted = despatch.actual_delivery_date
    ? new Date(despatch.actual_delivery_date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "2-digit" })
    : "TBC";
  const advDateFormatted = despatch.advice_date
    ? new Date(despatch.advice_date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const genAdvice = () => downloadPdf(
    <DeliveryAdvicePdf data={{
      date: advDateFormatted,
      orderNumber: order.order_number,
      repName,
      customer: {
        company_name: order.customer?.company_name || "",
        address_line_1: order.customer?.address_line_1 || undefined,
        town_city: order.customer?.town_city || undefined,
        post_code: order.customer?.post_code || undefined,
      },
      totalQuantity: totalQty,
      breed: firstBreed,
      age: firstAge,
      weekCommencing: wcDate,
      lines: dLines.map((l: any) => ({
        deliveryDate: delivDateFormatted,
        quantity: l.quantity,
        breed: l.breed?.breed_name || "",
        transporter: transporterName,
        unloadingTime: despatch.proposed_unloading_time || "TBC",
        deliveryTo: {
          name: order.delivery_address?.label || order.customer?.company_name || "",
          address_line_1: order.delivery_address?.address_line_1 || order.customer?.address_line_1 || undefined,
          town_city: order.delivery_address?.town_city || order.customer?.town_city || undefined,
          post_code: order.delivery_address?.post_code || order.customer?.post_code || undefined,
        },
      })),
      extras: dExtras,
    }} />,
    `Delivery_Advice_${order.order_number}.pdf`
  );

  const genDespatch = () => downloadPdf(
    <DespatchNotePdf data={{
      despatchNumber: despatch.despatch_number || "",
      orderNumber: order.order_number,
      repName,
      customer: {
        company_name: order.delivery_address?.label || order.customer?.company_name || "",
        address_line_1: order.delivery_address?.address_line_1 || order.customer?.address_line_1 || undefined,
        town_city: order.delivery_address?.town_city || order.customer?.town_city || undefined,
        post_code: order.delivery_address?.post_code || order.customer?.post_code || undefined,
      },
      rearerName: firstRearer,
      quantity: dLines[0]?.quantity || 0,
      totalPullets: totalQty,
      breed: firstBreed,
      age: firstAge,
      deliveryDate: delivDateFormatted,
      unloadingTime: despatch.proposed_unloading_time || "TBC",
      transporter: transporterName,
      extras: dExtras,
    }} />,
    `Despatch_Note_${despatch.despatch_number || order.order_number}.pdf`
  );

  const genSalmonella = () => downloadPdf(
    <SalmonellaFormPdf data={{
      despatchNumber: despatch.despatch_number || "",
      rearerName: firstRearer,
      customerName: order.customer?.company_name || "",
      customerPostCode: order.customer?.post_code || order.delivery_address?.post_code || "",
      transporter: transporterName,
      age: firstAge,
      deliveryDate: despatch.actual_delivery_date
        ? new Date(despatch.actual_delivery_date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
        : "",
    }} />,
    `Salmonella_Form_${despatch.despatch_number || order.order_number}.pdf`
  );

  return (
    <div className="flex gap-3 flex-wrap">
      <Button variant="secondary" size="sm" onClick={genAdvice}>📄 Delivery Advice</Button>
      <Button variant="secondary" size="sm" onClick={genDespatch}>📄 Despatch Note</Button>
      <Button variant="secondary" size="sm" onClick={genSalmonella}>📄 Salmonella Form</Button>
    </div>
  );
}
