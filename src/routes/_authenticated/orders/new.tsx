import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import { createOrderFn } from "~/server/functions/orders";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { FormField, inputClasses, selectClasses, textareaClasses, checkboxClasses } from "~/components/forms/FormField";
import type { OrderLineInput } from "~/lib/validation/schemas";

export const Route = createFileRoute("/_authenticated/orders/new")({
  component: OrderCreatePage,
});

interface LineEntry {
  breed_id: string;
  rearer_id: string;
  quantity: string;
  price: string;
  food_clause_value: string;
  age_weeks: string;
  extra_ids: string[];
}

const emptyLine = (): LineEntry => ({
  breed_id: "",
  rearer_id: "",
  quantity: "",
  price: "",
  food_clause_value: "0",
  age_weeks: "",
  extra_ids: [],
});

function OrderCreatePage() {
  const navigate = useNavigate();
  const supabase = getSupabaseBrowserClient();

  // ─── Lookups ─────────────────────────────────────────
  const [customers, setCustomers] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [breeds, setBreeds] = useState<any[]>([]);
  const [extras, setExtras] = useState<any[]>([]);
  const [rearers, setRearers] = useState<any[]>([]);
  const [tradingCompanies, setTradingCompanies] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const [c, r, b, e, re, tc] = await Promise.all([
        supabase.from("customers").select("id, company_name, customer_unique_id, rep_id").eq("is_active", true).order("company_name"),
        supabase.from("reps").select("id, name").eq("is_active", true).order("name"),
        supabase.from("breeds").select("id, breed_name").eq("is_available", true).order("breed_name"),
        supabase.from("extras").select("id, name").eq("is_available", true).order("name"),
        supabase.from("rearers").select("id, name").eq("is_active", true).order("name"),
        supabase.from("trading_companies").select("id, code, name, is_default").eq("is_active", true).order("code"),
      ]);
      setCustomers(c.data ?? []);
      setReps(r.data ?? []);
      setBreeds(b.data ?? []);
      setExtras(e.data ?? []);
      setRearers(re.data ?? []);
      setTradingCompanies(tc.data ?? []);
      // Set default trading company
      const defaultTc = (tc.data ?? []).find((t: any) => t.is_default);
      if (defaultTc) setTradingCompanyId(defaultTc.id);
    }
    load();
  }, []);

  // ─── Form state ──────────────────────────────────────
  const [tradingCompanyId, setTradingCompanyId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [deliveryAddressId, setDeliveryAddressId] = useState("");
  const [repId, setRepId] = useState("");
  const [wcDate, setWcDate] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [lines, setLines] = useState<LineEntry[]>([emptyLine()]);
  const [orderExtraIds, setOrderExtraIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  // Load delivery addresses when customer changes
  useEffect(() => {
    if (!customerId) {
      setAddresses([]);
      setDeliveryAddressId("");
      return;
    }
    // Auto-fill rep
    const cust = customers.find((c) => c.id === customerId);
    if (cust?.rep_id) setRepId(cust.rep_id);

    supabase
      .from("customer_delivery_addresses")
      .select("id, label, address_line_1, town_city, post_code")
      .eq("customer_id", customerId)
      .eq("is_active", true)
      .order("label")
      .then(({ data }) => setAddresses(data ?? []));
  }, [customerId]);

  // ─── Line management ────────────────────────────────
  const updateLine = (idx: number, field: keyof LineEntry, value: any) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
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

  const toggleOrderExtra = (extraId: string) => {
    setOrderExtraIds((prev) =>
      prev.includes(extraId)
        ? prev.filter((id) => id !== extraId)
        : [...prev, extraId]
    );
  };

  // ─── Submit ──────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: createOrderFn,
    onSuccess: (order: any) => {
      navigate({ to: `/orders/${order.id}` });
    },
    onError: (err: any) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!customerId) {
      setError("Select a customer");
      return;
    }

    const validLines = lines.filter((l) => l.breed_id && l.quantity);
    if (validLines.length === 0) {
      setError("Add at least one order line");
      return;
    }

    const parsedLines: OrderLineInput[] = validLines.map((l) => ({
      breed_id: l.breed_id,
      rearer_id: l.rearer_id || null,
      quantity: parseInt(l.quantity, 10),
      price: parseFloat(l.price || "0"),
      food_clause_value: parseFloat(l.food_clause_value || "0"),
      age_weeks: l.age_weeks ? parseInt(l.age_weeks, 10) : null,
      extra_ids: l.extra_ids,
    }));

    createMut.mutate({
      data: {
        order: {
          customer_id: customerId,
          delivery_address_id: deliveryAddressId || undefined,
          rep_id: repId || undefined,
          requested_delivery_week_commencing: wcDate || undefined,
          customer_notes: customerNotes || undefined,
          internal_notes: internalNotes || undefined,
          lines: parsedLines,
          extra_ids: orderExtraIds,
        },
      },
    });
  };

  return (
    <div>
      <PageHeader title="New Order" description="Create a new pullet sales order." />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {/* ─── Context Bar ─────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Details</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <FormField label="Trading Company">
              <select
                value={tradingCompanyId}
                onChange={(e) => setTradingCompanyId(e.target.value)}
                className={selectClasses}
              >
                <option value="">— Select —</option>
                {tradingCompanies.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.code} — {tc.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Customer" required>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className={selectClasses}
                required
              >
                <option value="">— Select customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_unique_id} — {c.company_name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Delivery Address">
              <select
                value={deliveryAddressId}
                onChange={(e) => setDeliveryAddressId(e.target.value)}
                className={selectClasses}
                disabled={!customerId}
              >
                <option value="">— Select address —</option>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {a.town_city} {a.post_code}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Rep">
              <select
                value={repId}
                onChange={(e) => setRepId(e.target.value)}
                className={selectClasses}
              >
                <option value="">— Select rep —</option>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Requested W/C Date">
              <input
                type="date"
                value={wcDate}
                onChange={(e) => setWcDate(e.target.value)}
                className={inputClasses}
              />
            </FormField>
          </div>
        </div>

        {/* ─── Order Lines ─────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Order Lines</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addLine}>
              + Add Line
            </Button>
          </div>

          <div className="space-y-4">
            {lines.map((line, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
              >
                <div className="grid grid-cols-7 gap-3 mb-3">
                  <FormField label="Breed" required>
                    <select
                      value={line.breed_id}
                      onChange={(e) => updateLine(idx, "breed_id", e.target.value)}
                      className={selectClasses}
                    >
                      <option value="">— Breed —</option>
                      {breeds.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.breed_name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Rearer">
                    <select
                      value={line.rearer_id}
                      onChange={(e) => updateLine(idx, "rearer_id", e.target.value)}
                      className={selectClasses}
                    >
                      <option value="">— Rearer —</option>
                      {rearers.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Quantity" required>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                      className={inputClasses}
                      placeholder="0"
                    />
                  </FormField>

                  <FormField label="Price (£)">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.price}
                      onChange={(e) => updateLine(idx, "price", e.target.value)}
                      className={inputClasses}
                      placeholder="0.00"
                    />
                  </FormField>

                  <FormField label="Food Clause (£)">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.food_clause_value}
                      onChange={(e) =>
                        updateLine(idx, "food_clause_value", e.target.value)
                      }
                      className={inputClasses}
                      placeholder="0.00"
                    />
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Line Total</label>
                    <div className="px-3 py-2 text-sm bg-gray-100 rounded-lg font-medium text-gray-900">
                      £{((parseInt(line.quantity || "0", 10) || 0) * (parseFloat(line.price || "0") || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Line Extras */}
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-xs font-medium text-gray-500 uppercase">
                    Line Extras:
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
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="ml-auto text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Order-Level Extras ───────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Order-Level Extras
          </h2>
          <div className="flex flex-wrap gap-4">
            {extras.map((ex) => (
              <label
                key={ex.id}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={orderExtraIds.includes(ex.id)}
                  onChange={() => toggleOrderExtra(ex.id)}
                  className={checkboxClasses}
                />
                {ex.name}
              </label>
            ))}
          </div>
        </div>

        {/* ─── Notes ───────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Customer Notes">
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className={textareaClasses}
                rows={3}
                placeholder="Notes visible to customer..."
              />
            </FormField>
            <FormField label="Internal Notes">
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                className={textareaClasses}
                rows={3}
                placeholder="Internal notes only..."
              />
            </FormField>
          </div>
        </div>

        {/* ─── Actions ─────────────────────────────────── */}
        <div className="flex gap-3">
          <Button type="submit" loading={createMut.isPending}>
            Save Draft
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate({ to: "/orders" })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
