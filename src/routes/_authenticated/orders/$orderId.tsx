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
  const [breeds, setBreeds] = useState<any[]>([]);

  const [consolidateAdvice, setConsolidateAdvice] = useState(false);
  const [consolidateDespatch, setConsolidateDespatch] = useState(false);
  const [consolidateInvoice, setConsolidateInvoice] = useState(false);

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

  const [foodClauseMultiplier, setFoodClauseMultiplier] = useState(0.60);

  // Load lookups
  useEffect(() => {
    async function load() {
      const [t, e, r, b, s] = await Promise.all([
        supabase.from("transporters").select("id, transporter_name").eq("is_active", true).order("transporter_name"),
        supabase.from("extras").select("id, name").eq("is_available", true).order("name"),
        supabase.from("rearers").select("id, name").eq("is_active", true).order("name"),
        supabase.from("breeds").select("id, breed_name").eq("is_available", true).order("breed_name"),
        supabase.from("system_settings").select("value").eq("key", "food_clause_multiplier").single(),
      ]);
      setTransporters(t.data ?? []);
      setExtras(e.data ?? []);
      setRearers(r.data ?? []);
      setBreeds(b.data ?? []);
      if (s.data?.value) setFoodClauseMultiplier(parseFloat(s.data.value));
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
      setConsolidateInvoice(existingDespatch.consolidate_invoice || false);
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
          consolidate_invoice: consolidateInvoice,
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
        <div className="grid grid-cols-4 gap-4">
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
          <FormField label="Advice Date">
            <input type="date" value={adviceDate} onChange={(e) => setAdviceDate(e.target.value)} className={inputClasses} />
          </FormField>
        </div>
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isDeliveryAmended} onChange={(e) => setIsDeliveryAmended(e.target.checked)} className={checkboxClasses} />
            Delivery Amended
          </label>
        </div>
      </div>


      {/* Despatch Lines */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Final Despatch Lines</h3>
            <p className="text-sm text-gray-500">Split lines across multiple rearers as needed. Click "+ Split" to add a sub-line.</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">{lines.length} line(s)</span>
            <span className="font-semibold text-gray-900">
              {lines.reduce((s, l) => s + (parseInt(l.quantity || "0", 10) || 0), 0).toLocaleString()} pullets
            </span>
          </div>
        </div>

        {/* Group lines by order_line_id */}
        {(() => {
          // Get unique order line IDs (preserving order) + any with null order_line_id
          const orderLineIds = [...new Set(lines.filter(l => l.order_line_id).map(l => l.order_line_id!))];
          const unlinkedLines = lines.map((l, idx) => ({ ...l, _idx: idx })).filter(l => !l.order_line_id);

          return (
            <div className="space-y-3">
              {orderLineIds.map((olId) => {
                const groupLines = lines.map((l, idx) => ({ ...l, _idx: idx })).filter(l => l.order_line_id === olId);
                const orderLine = order.lines.find(l => l.id === olId);
                const originalQty = orderLine?.quantity || 0;
                const allocatedQty = groupLines.reduce((s, l) => s + (parseInt(l.quantity || "0", 10) || 0), 0);
                const breedName = groupLines[0]?.breed_name || orderLine?.breed?.breed_name || "Unknown";
                const qtyMatch = allocatedQty === originalQty;
                const qtyOver = allocatedQty > originalQty;

                return (
                  <div key={olId} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Order line header */}
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-semibold text-gray-700">{breedName}</span>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-500">Ordered: <span className="font-medium text-gray-700">{originalQty.toLocaleString()}</span></span>
                        <span className="text-gray-400">|</span>
                        <span className={qtyMatch ? "text-green-600 font-medium" : qtyOver ? "text-red-600 font-medium" : "text-amber-600 font-medium"}>
                          Allocated: {allocatedQty.toLocaleString()}
                          {!qtyMatch && ` (${qtyOver ? "+" : ""}${(allocatedQty - originalQty).toLocaleString()})`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          // Add a new split line copying breed/price/extras from first line in group
                          const source = groupLines[0];
                          const newLine = {
                            order_line_id: olId,
                            breed_id: source.breed_id,
                            breed_name: source.breed_name,
                            rearer_id: "",
                            rearer_name: "",
                            age_weeks: source.age_weeks,
                            quantity: "",
                            price: source.price,
                            food_clause_value: source.food_clause_value,
                            extra_ids: [...source.extra_ids],
                          };
                          // Insert after the last line in this group
                          const lastIdx = groupLines[groupLines.length - 1]._idx;
                          setLines(prev => [...prev.slice(0, lastIdx + 1), newLine, ...prev.slice(lastIdx + 1)]);
                        }}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        + Split
                      </button>
                    </div>

                    {/* Sub-lines */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase bg-gray-50/50">
                          <th className="px-3 py-1.5 text-left font-medium" style={{width: '20%'}}>Rearer</th>
                          <th className="px-3 py-1.5 text-right font-medium" style={{width: '10%'}}>Age</th>
                          <th className="px-3 py-1.5 text-right font-medium" style={{width: '14%'}}>Qty</th>
                          <th className="px-3 py-1.5 text-right font-medium" style={{width: '14%'}}>Price (£)</th>
                          <th className="px-3 py-1.5 text-right font-medium" style={{width: '14%'}}>Food Clause</th>
                          <th className="px-3 py-1.5 text-left font-medium">Extras</th>
                          <th className="px-3 py-1.5 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupLines.map((line) => (
                          <tr key={line._idx} className="border-t border-gray-100 hover:bg-gray-50/50">
                            <td className="px-2 py-1.5">
                              <select value={line.rearer_id} onChange={(e) => updateLine(line._idx, "rearer_id", e.target.value)} className={selectClasses + " text-xs py-1.5"}>
                                <option value="">— Rearer —</option>
                                {rearers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" min="0" value={line.age_weeks} onChange={(e) => updateLine(line._idx, "age_weeks", e.target.value)} className={inputClasses + " text-xs text-right py-1.5"} placeholder="16" />
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" min="0" value={line.quantity} onChange={(e) => updateLine(line._idx, "quantity", e.target.value)} className={inputClasses + " text-xs text-right py-1.5 font-medium"} placeholder="0" />
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" step="0.01" min="0" value={line.price} onChange={(e) => updateLine(line._idx, "price", e.target.value)} className={inputClasses + " text-xs text-right py-1.5"} placeholder="0.00" />
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" step="0.01" min="0" value={line.food_clause_value} onChange={(e) => updateLine(line._idx, "food_clause_value", e.target.value)} className={inputClasses + " text-xs text-right py-1.5"} placeholder="0.00" />
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-1 flex-wrap">
                                {extras.map((ex) => {
                                  const sel = line.extra_ids.includes(ex.id);
                                  return (
                                    <button key={ex.id} type="button" onClick={() => toggleLineExtra(line._idx, ex.id)}
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${sel ? "bg-brand-50 text-brand-700 border-brand-300" : "bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:border-gray-300"}`}>
                                      {sel && <svg className="w-2.5 h-2.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                      {ex.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-2 py-1.5">
                              {groupLines.length > 1 && (
                                <button type="button" onClick={() => setLines(prev => prev.filter((_, i) => i !== line._idx))} className="text-gray-300 hover:text-red-500" title="Remove split line">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}

              {/* Unlinked lines (added manually, not from order) */}
              {unlinkedLines.length > 0 && (
                <div className="border border-dashed border-gray-300 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-600">
                    Additional Lines
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {unlinkedLines.map((line) => (
                        <tr key={line._idx} className="border-t border-gray-100">
                          <td className="px-2 py-1.5" style={{width: '15%'}}>
                            <select value={line.breed_id} onChange={(e) => {
                              const breed = breeds.find(b => b.id === e.target.value);
                              updateLine(line._idx, "breed_id", e.target.value);
                              if (breed) updateLine(line._idx, "breed_name", breed.breed_name);
                            }} className={selectClasses + " text-xs py-1.5"}>
                              <option value="">— Breed —</option>
                              {breeds.map((b) => <option key={b.id} value={b.id}>{b.breed_name}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5" style={{width: '15%'}}>
                            <select value={line.rearer_id} onChange={(e) => updateLine(line._idx, "rearer_id", e.target.value)} className={selectClasses + " text-xs py-1.5"}>
                              <option value="">— Rearer —</option>
                              {rearers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5"><input type="number" min="0" value={line.age_weeks} onChange={(e) => updateLine(line._idx, "age_weeks", e.target.value)} className={inputClasses + " text-xs text-right py-1.5"} placeholder="Age" /></td>
                          <td className="px-2 py-1.5"><input type="number" min="0" value={line.quantity} onChange={(e) => updateLine(line._idx, "quantity", e.target.value)} className={inputClasses + " text-xs text-right py-1.5 font-medium"} placeholder="Qty" /></td>
                          <td className="px-2 py-1.5"><input type="number" step="0.01" min="0" value={line.price} onChange={(e) => updateLine(line._idx, "price", e.target.value)} className={inputClasses + " text-xs text-right py-1.5"} placeholder="Price" /></td>
                          <td className="px-2 py-1.5"><input type="number" step="0.01" min="0" value={line.food_clause_value} onChange={(e) => updateLine(line._idx, "food_clause_value", e.target.value)} className={inputClasses + " text-xs text-right py-1.5"} placeholder="Food Clause" /></td>
                          <td className="px-2 py-1.5">
                            <button type="button" onClick={() => setLines(prev => prev.filter((_, i) => i !== line._idx))} className="text-gray-300 hover:text-red-500" title="Remove line">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                type="button"
                onClick={() => setLines(prev => [...prev, {
                  order_line_id: null,
                  breed_id: "",
                  breed_name: "",
                  rearer_id: "",
                  rearer_name: "",
                  age_weeks: "",
                  quantity: "",
                  price: "",
                  food_clause_value: "0",
                  extra_ids: [],
                }])}
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                + Add additional line
              </button>
            </div>
          );
        })()}

        {/* Consolidation options */}
        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 rounded-b-xl flex items-center gap-6">
          <span className="text-xs font-medium text-gray-500 uppercase">Consolidate lines on:</span>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={consolidateAdvice} onChange={(e) => setConsolidateAdvice(e.target.checked)} className={checkboxClasses} />
            Delivery Advice
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={consolidateDespatch} onChange={(e) => setConsolidateDespatch(e.target.checked)} className={checkboxClasses} />
            Despatch Note
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={consolidateInvoice} onChange={(e) => setConsolidateInvoice(e.target.checked)} className={checkboxClasses} />
            Invoice
          </label>
        </div>
      </div>

      {/* Food Clause Adjustment Summary */}
      {(() => {
        const adjustments = lines
          .map((line, idx) => {
            if (!line.order_line_id || !line.quantity) return null;
            const orderLine = order.lines.find((l) => l.id === line.order_line_id);
            if (!orderLine) return null;
            const orderFeed = Number(orderLine.food_clause_value) || 0;
            const despatchFeed = parseFloat(line.food_clause_value) || 0;
            if (orderFeed === 0 && despatchFeed === 0) return null;
            const changePerTon = despatchFeed - orderFeed;
            const changePerPulletPence = changePerTon * foodClauseMultiplier;
            const changePerPulletPounds = changePerPulletPence / 100;
            const qty = parseInt(line.quantity, 10) || 0;
            const totalAdj = changePerPulletPounds * qty;
            return {
              idx,
              breedName: line.breed_name,
              orderFeed,
              despatchFeed,
              changePerTon,
              multiplier: foodClauseMultiplier,
              changePerPulletPence,
              changePerPulletPounds,
              qty,
              totalAdj,
            };
          })
          .filter(Boolean) as Array<{
            idx: number; breedName: string; orderFeed: number; despatchFeed: number;
            changePerTon: number; multiplier: number; changePerPulletPence: number;
            changePerPulletPounds: number; qty: number; totalAdj: number;
          }>;

        const totalFoodClauseAdj = adjustments.reduce((s, a) => s + a.totalAdj, 0);
        const hasAnyChange = adjustments.some((a) => a.changePerTon !== 0);

        if (adjustments.length === 0) return null;

        return (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Food Clause Adjustment</h3>
            <p className="text-xs text-gray-400 mb-4">
              Calculated as: (Feed at delivery − Feed at order) × multiplier ({foodClauseMultiplier}) ÷ 100 = adjustment per pullet
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-gray-200">
                  <th className="pb-2 text-left">Line</th>
                  <th className="pb-2 text-right">Feed at Order (£/t)</th>
                  <th className="pb-2 text-right">Feed at Delivery (£/t)</th>
                  <th className="pb-2 text-right">Change (£/t)</th>
                  <th className="pb-2 text-right">× Multiplier</th>
                  <th className="pb-2 text-right">Per Pullet (p)</th>
                  <th className="pb-2 text-right">Per Pullet (£)</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right font-semibold">Total Adj.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {adjustments.map((a) => (
                  <tr key={a.idx} className={a.changePerTon !== 0 ? "" : "text-gray-400"}>
                    <td className="py-2 font-medium">{a.breedName}</td>
                    <td className="py-2 text-right">{a.orderFeed.toFixed(2)}</td>
                    <td className="py-2 text-right">{a.despatchFeed.toFixed(2)}</td>
                    <td className={`py-2 text-right font-medium ${a.changePerTon > 0 ? "text-red-600" : a.changePerTon < 0 ? "text-green-600" : ""}`}>
                      {a.changePerTon > 0 ? "+" : ""}{a.changePerTon.toFixed(2)}
                    </td>
                    <td className="py-2 text-right text-gray-400">× {a.multiplier}</td>
                    <td className="py-2 text-right">{a.changePerPulletPence.toFixed(2)}p</td>
                    <td className="py-2 text-right">£{a.changePerPulletPounds.toFixed(4)}</td>
                    <td className="py-2 text-right">{a.qty.toLocaleString()}</td>
                    <td className={`py-2 text-right font-semibold ${a.totalAdj > 0 ? "text-red-600" : a.totalAdj < 0 ? "text-green-600" : ""}`}>
                      {a.totalAdj >= 0 ? "£" : "-£"}{Math.abs(a.totalAdj).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {adjustments.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300">
                    <td colSpan={8} className="py-2 text-right font-semibold text-gray-700">Total Food Clause Adjustment</td>
                    <td className={`py-2 text-right font-bold text-lg ${totalFoodClauseAdj > 0 ? "text-red-600" : totalFoodClauseAdj < 0 ? "text-green-600" : ""}`}>
                      {totalFoodClauseAdj >= 0 ? "£" : "-£"}{Math.abs(totalFoodClauseAdj).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            {!hasAnyChange && (
              <p className="text-xs text-gray-400 mt-2 italic">No feed price change — no adjustment required.</p>
            )}
          </div>
        );
      })()}

      {/* Final Order Extras */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Final Order Extras
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

      {/* Despatch Notes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Despatch Notes
        </h3>
        <textarea
          value={despatchNotes}
          onChange={(e) => setDespatchNotes(e.target.value)}
          className={textareaClasses}
          rows={3}
          placeholder="Any additional notes for this despatch..."
        />
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
  // Consolidate split lines back to one line per order_line_id
  function consolidateLines(inputLines: typeof lines) {
    const grouped = new Map<string, typeof lines[0]>();
    const unlinked: typeof lines = [];
    for (const line of inputLines) {
      if (!line.order_line_id) {
        unlinked.push(line);
        continue;
      }
      const existing = grouped.get(line.order_line_id);
      if (existing) {
        // Sum quantity, keep same breed/price/food_clause/extras
        existing.quantity = String(
          (parseInt(existing.quantity || "0", 10) || 0) + (parseInt(line.quantity || "0", 10) || 0)
        );
      } else {
        grouped.set(line.order_line_id, {
          ...line,
          rearer_id: "", // omit rearer on consolidated
          rearer_name: "",
        });
      }
    }
    return [...grouped.values(), ...unlinked];
  }

  function handleDeliveryAdvicePdf(desp: any) {
    const pdfLines = consolidateAdvice ? consolidateLines(lines) : lines;
    const repName = order.rep?.name || "";
    const totalQty = pdfLines.reduce((s, l) => s + (parseInt(l.quantity || "0", 10) || 0), 0);
    const firstBreed = pdfLines[0]?.breed_name || "Pullets";
    const firstAge = pdfLines[0]?.age_weeks ? parseInt(pdfLines[0].age_weeks, 10) : null;
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
        lines: pdfLines.map((l) => ({
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
    const pdfLines = consolidateDespatch ? consolidateLines(lines) : lines;
    const repName = order.rep?.name || "";
    const totalQty = pdfLines.reduce((s, l) => s + (parseInt(l.quantity || "0", 10) || 0), 0);
    const firstBreed = pdfLines[0]?.breed_name || "Pullets";
    const firstAge = pdfLines[0]?.age_weeks ? parseInt(pdfLines[0].age_weeks, 10) : null;
    const firstRearer = pdfLines[0]?.rearer_id ? rearers.find((r) => r.id === pdfLines[0].rearer_id)?.name || "" : "";
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
        quantity: parseInt(pdfLines[0]?.quantity || "0", 10),
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
