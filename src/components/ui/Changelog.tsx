import { useState } from "react";
import { Button } from "./Button";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.3.0",
    date: "25 March 2026",
    changes: [
      "Email documents directly from orders, despatch, and invoices with PDF attachments",
      "Personalised email greetings — each recipient gets their own name in the greeting",
      "Editable email templates in Admin with placeholder support",
      "Customer contact name and email fields added to customer records",
      "Order list now shows Qty and Value columns",
      "Order list columns reordered: Order #, Order Date, Customer, W/C, Rep",
      "Improved admin navigation icons (breeds, reps, extras, rearers)",
      "Invoice address now correctly uses customer billing address, not delivery address",
    ],
  },
  {
    version: "1.2.0",
    date: "24 March 2026",
    changes: [
      "Despatch line splitting — split order lines across multiple rearers",
      "Food clause adjustment calculation with configurable multiplier",
      "Consolidation checkboxes on despatch (Delivery Advice, Despatch Note, Invoice)",
      "Invoice PDF now prints 3 copies: Customer, Invoice, and Rep",
      "Invoice detail page redesigned with locked view and edit mode",
      "Payment terms per customer with system-wide default fallback",
      "Auto-populate invoice lines from order and despatch data",
      "Default age set to 16 weeks on new order lines",
      "Order list searchable by customer name",
      "Inline line extras restored with pill-style toggles",
    ],
  },
  {
    version: "1.1.0",
    date: "22 March 2026",
    changes: [
      "Full Phase 2: Orders, Despatch, and Invoicing workflow",
      "Order creation with breeds, quantities, prices, food clause, and extras",
      "Order confirmation with PDF generation",
      "Amended order flow with re-confirmation",
      "Despatch module with delivery advice, despatch note, and salmonella form PDFs",
      "Invoice creation from completed orders with TAS CSV export",
      "Ad-hoc invoice support with editable generic line items",
      "VAT rates management with configurable rates",
      "Trading companies admin module",
      "Configurable order numbering via system settings",
      "Rearer and age fields on order and despatch lines",
      "Data-driven dashboard with order stats, top reps, customers, and breeds",
      "Professional order creation UI redesign",
      "Country Fresh Pullets branding with logo and diamond favicon",
    ],
  },
  {
    version: "1.0.0",
    date: "22 March 2026",
    changes: [
      "Initial release — Phase 1 master data management",
      "Authentication with login, forgot password, and invite flows",
      "User management with role-based access control (admin / standard user)",
      "Reps management module",
      "Customers management with delivery addresses",
      "Breeds management with linked extras",
      "Extras management with availability toggle",
      "Rearers management module",
      "Transporters management module",
      "System settings for company details and configuration",
      "Responsive admin layout with collapsible sidebar navigation",
    ],
  },
];

const CURRENT_VERSION = CHANGELOG[0].version;

export function VersionBadge() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-brand-600 transition-colors cursor-pointer"
        title="View changelog"
      >
        Country Fresh Pullets v{CURRENT_VERSION}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Changelog</h2>
                <p className="text-xs text-gray-400">Country Fresh Pullets Order System</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4">
              <div className="space-y-6">
                {CHANGELOG.map((entry, idx) => (
                  <div key={entry.version}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                        v{entry.version}
                      </span>
                      <span className="text-sm text-gray-500">{entry.date}</span>
                      {idx === 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                          Current
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1 ml-1">
                      {entry.changes.map((change, ci) => (
                        <li key={ci} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="text-brand-400 mt-1.5 flex-shrink-0">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 8 8">
                              <circle cx="4" cy="4" r="3" />
                            </svg>
                          </span>
                          {change}
                        </li>
                      ))}
                    </ul>
                    {idx < CHANGELOG.length - 1 && (
                      <div className="border-b border-gray-100 mt-4" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
