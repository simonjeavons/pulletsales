import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import { createOrderFn } from "~/server/functions/orders";
import { Button } from "~/components/ui/Button";
import { checkboxClasses } from "~/components/forms/FormField";
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
  breed_id: "", rearer_id: "", quantity: "", price: "", food_clause_value: "0", age_weeks: "", extra_ids: [],
});

// Compact select styling
const sel = "w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white";
const inp = "w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500";
const lbl = "block text-xs font-medium text-gray-500 mb-0.5";

function OrderCreatePage() {
  const navigate = useNavigate();
  const supabase = getSupabaseBrowserClient();
  const lastLineRef = useRef<HTMLSelectElement>(null);

  // ─── Lookups ─────────────────────────────────────────
  const [customers, setCustomers] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [breeds, setBreeds] = useState<any[]>([]);
  const [extras, setExtras] = useState<any[]>([]);
  const [rearers, setRearers] = useState<any[]>([]);
  const [tradingCompanies, setTradingCompanies] = useState<any[]>([]);
  const [ready, setReady] = useState(false);

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
      const defaultTc = (tc.data ?? []).find((t: any) => t.is_default);
      if (defaultTc) setTradingCompanyId(defaultTc.id);
      setReady(true);
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
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    if (!customerId) { setAddresses([]); setDeliveryAddressId(""); return; }
    const cust = customers.find((c) => c.id === customerId);
    if (cust?.rep_id) setRepId(cust.rep_id);
    supabase.from("customer_delivery_addresses").select("id, label, address_line_1, town_city, post_code")
      .eq("customer_id", customerId).eq("is_active", true).order("label")
      .then(({ data }) => setAddresses(data ?? []));
  }, [customerId]);

  // ─── Line management ────────────────────────────────
  const updateLine = (idx: number, field: keyof LineEntry, value: any) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, emptyLine()]);
    // Focus the breed select of new line after render
    setTimeout(() => lastLineRef.current?.focus(), 50);
  }, []);

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleLineExtra = (idx: number, extraId: string) => {
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? { ...l, extra_ids: l.extra_ids.includes(extraId) ? l.extra_ids.filter((id) => id !== extraId) : [...l.extra_ids, extraId] }
          : l
      )
    );
  };

  const toggleOrderExtra = (extraId: string) => {
    setOrderExtraIds((prev) => prev.includes(extraId) ? prev.filter((id) => id !== extraId) : [...prev, extraId]);
  };

  // Handle Enter on last field to add new line
  const handleLineKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter" && idx === lines.length - 1) {
      e.preventDefault();
      addLine();
    }
  };

  // ─── Submit ──────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: createOrderFn,
    onSuccess: (order: any) => navigate({ to: `/orders/${order.id}` }),
    onError: (err: any) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!customerId) { setError("Select a customer"); return; }
    const validLines = lines.filter((l) => l.breed_id && l.quantity);
    if (validLines.length === 0) { setError("Add at least one order line"); return; }

    createMut.mutate({
      data: {
        order: {
          customer_id: customerId,
          delivery_address_id: deliveryAddressId || undefined,
          rep_id: repId || undefined,
          requested_delivery_week_commencing: wcDate || undefined,
          customer_notes: customerNotes || undefined,
          internal_notes: internalNotes || undefined,
          lines: validLines.map((l): OrderLineInput => ({
            breed_id: l.breed_id,
            rearer_id: l.rearer_id || null,
            quantity: parseInt(l.quantity, 10),
            price: parseFloat(l.price || "0"),
            food_clause_value: parseFloat(l.food_clause_value || "0"),
            age_weeks: l.age_weeks ? parseInt(l.age_weeks, 10) : null,
            extra_ids: l.extra_ids,
          })),
          extra_ids: orderExtraIds,
        },
      },
    });
  };

  // ─── Totals ──────────────────────────────────────────
  const orderTotal = lines.reduce((s, l) => s + (parseInt(l.quantity || "0", 10) || 0) * (parseFloat(l.price || "0") || 0), 0);
  const totalQty = lines.reduce((s, l) => s + (parseInt(l.quantity || "0", 10) || 0), 0);

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Order</h1>
          <p className="text-sm text-gray-500">Tab through fields · Enter on last line adds a new row</p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate({ to: "/orders" })}>Cancel</Button>
          <Button onClick={handleSubmit} loading={createMut.isPending}>Save Draft</Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ─── Order Header ──────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="grid grid-cols-5 gap-4">
            <div>
              <label className={lbl}>Trading Co.</label>
              <select value={tradingCompanyId} onChange={(e) => setTradingCompanyId(e.target.value)} className={sel} tabIndex={1}>
                {tradingCompanies.map((tc) => (
                  <option key={tc.id} value={tc.id}>{tc.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Customer *</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={sel} required tabIndex={2} autoFocus>
                <option value="">— Select —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.customer_unique_id} — {c.company_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Delivery Address</label>
              <select value={deliveryAddressId} onChange={(e) => setDeliveryAddressId(e.target.value)} className={sel} disabled={!customerId} tabIndex={3}>
                <option value="">— Select —</option>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}{a.post_code ? ` (${a.post_code})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Rep</label>
              <select value={repId} onChange={(e) => setRepId(e.target.value)} className={sel} tabIndex={4}>
                <option value="">— Select —</option>
                {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>W/C Date</label>
              <input type="date" value={wcDate} onChange={(e) => setWcDate(e.target.value)} className={inp} tabIndex={5} />
            </div>
          </div>
        </div>

        {/* ─── Order Lines (table style) ─────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 mb-4">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Order Lines</h2>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{lines.filter((l) => l.breed_id).length} line(s)</span>
              <span className="font-medium text-gray-700">{totalQty.toLocaleString()} pullets</span>
              <span className="font-semibold text-gray-900">£{orderTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-3 py-2 text-left font-semibold w-8">#</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ minWidth: 150 }}>Breed *</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ minWidth: 140 }}>Rearer</th>
                  <th className="px-3 py-2 text-right font-semibold w-20">Age</th>
                  <th className="px-3 py-2 text-right font-semibold w-24">Qty *</th>
                  <th className="px-3 py-2 text-right font-semibold w-24">Price (£)</th>
                  <th className="px-3 py-2 text-right font-semibold w-24">Food Cl.</th>
                  <th className="px-3 py-2 text-right font-semibold w-28">Total</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const lineTotal = (parseInt(line.quantity || "0", 10) || 0) * (parseFloat(line.price || "0") || 0);
                  const tabBase = 10 + idx * 6;
                  return (
                    <React.Fragment key={idx}>
                    <tr className="border-t border-gray-100 hover:bg-gray-50/50 group">
                      <td className="px-3 py-1.5 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-2 py-1">
                        <select
                          ref={idx === lines.length - 1 ? lastLineRef : undefined}
                          value={line.breed_id}
                          onChange={(e) => updateLine(idx, "breed_id", e.target.value)}
                          className={`${sel} text-xs`}
                          tabIndex={tabBase}
                        >
                          <option value="">—</option>
                          {breeds.map((b) => <option key={b.id} value={b.id}>{b.breed_name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={line.rearer_id}
                          onChange={(e) => updateLine(idx, "rearer_id", e.target.value)}
                          className={`${sel} text-xs`}
                          tabIndex={tabBase + 1}
                        >
                          <option value="">—</option>
                          {rearers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number" min="0" value={line.age_weeks}
                          onChange={(e) => updateLine(idx, "age_weeks", e.target.value)}
                          className={`${inp} text-right text-xs`}
                          placeholder="16"
                          tabIndex={tabBase + 2}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number" min="1" value={line.quantity}
                          onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                          className={`${inp} text-right text-xs font-medium`}
                          placeholder="0"
                          tabIndex={tabBase + 3}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number" step="0.01" min="0" value={line.price}
                          onChange={(e) => updateLine(idx, "price", e.target.value)}
                          className={`${inp} text-right text-xs`}
                          placeholder="0.00"
                          tabIndex={tabBase + 4}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number" step="0.01" min="0" value={line.food_clause_value}
                          onChange={(e) => updateLine(idx, "food_clause_value", e.target.value)}
                          onKeyDown={(e) => handleLineKeyDown(e, idx)}
                          className={`${inp} text-right text-xs`}
                          placeholder="0.00"
                          tabIndex={tabBase + 5}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium text-xs text-gray-900">
                        £{lineTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-1">
                        {lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(idx)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove line">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                    {/* Inline line extras — shown when breed is selected and extras exist */}
                    {line.breed_id && extras.length > 0 && (
                      <tr key={`extras-${idx}`} className="bg-gray-50/40">
                        <td className="px-3 py-1"></td>
                        <td colSpan={8} className="px-2 py-1.5">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mr-1">Extras:</span>
                            {extras.map((ex) => {
                              const selected = line.extra_ids.includes(ex.id);
                              return (
                                <button
                                  key={ex.id}
                                  type="button"
                                  onClick={() => toggleLineExtra(idx, ex.id)}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                                    selected
                                      ? "bg-brand-50 text-brand-700 border-brand-300"
                                      : "bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:border-gray-300"
                                  }`}
                                >
                                  {selected && (
                                    <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  {ex.name}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={4} className="px-3 py-2">
                    <button type="button" onClick={addLine} className="text-brand-600 hover:text-brand-700 text-xs font-medium">
                      + Add line
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
                    {totalQty.toLocaleString()}
                  </td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
                    £{orderTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

        </div>

        {/* ─── Order Extras + Notes (compact row) ────────── */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Order-level extras */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Order Extras</h3>
            <div className="flex flex-wrap gap-3">
              {extras.map((ex) => (
                <label key={ex.id} className="flex items-center gap-1.5 text-sm cursor-pointer text-gray-600 hover:text-gray-900">
                  <input type="checkbox" checked={orderExtraIds.includes(ex.id)} onChange={() => toggleOrderExtra(ex.id)} className={checkboxClasses} />
                  {ex.name}
                </label>
              ))}
              {extras.length === 0 && <span className="text-xs text-gray-400">No extras available</span>}
            </div>
          </div>

          {/* Notes toggle */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase">Notes</h3>
              {!showNotes && (
                <button type="button" onClick={() => setShowNotes(true)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                  + Add notes
                </button>
              )}
            </div>
            {showNotes ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Customer</label>
                  <textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} className={`${inp} resize-none`} rows={2} placeholder="Visible to customer..." />
                </div>
                <div>
                  <label className={lbl}>Internal</label>
                  <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} className={`${inp} resize-none`} rows={2} placeholder="Internal only..." />
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No notes added</p>
            )}
          </div>
        </div>

        {/* ─── Bottom Actions ────────────────────────────── */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-3">
          <div className="text-sm text-gray-500">
            {lines.filter((l) => l.breed_id).length} line(s) · {totalQty.toLocaleString()} pullets · <span className="font-semibold text-gray-900">£{orderTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate({ to: "/orders" })}>Cancel</Button>
            <Button type="submit" loading={createMut.isPending}>Save Draft</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
