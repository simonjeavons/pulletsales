import { Link, useRouter } from "@tanstack/react-router";
import type { Profile } from "~/types/database";

interface NavItem {
  label: string;
  to: string;
  icon: string;
  adminOnly?: boolean;
  section?: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { label: "Orders", to: "/orders", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", section: "Operations" },
  { label: "Invoices", to: "/invoices", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z", section: "Operations" },
  { label: "Users", to: "/admin/users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z", adminOnly: true, section: "Admin" },
  { label: "Reps", to: "/admin/reps", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", adminOnly: true, section: "Admin" },
  { label: "Customers", to: "/admin/customers", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", adminOnly: true, section: "Admin" },
  { label: "Extras", to: "/admin/extras", icon: "M12 6v6m0 0v6m0-6h6m-6 0H6", adminOnly: true, section: "Admin" },
  { label: "Breeds", to: "/admin/breeds", icon: "M4 6h16M4 10h16M4 14h16M4 18h16", adminOnly: true, section: "Admin" },
  { label: "Rearers", to: "/admin/rearers", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z", adminOnly: true, section: "Admin" },
  { label: "Transporters", to: "/admin/transporters", icon: "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0", adminOnly: true, section: "Admin" },
];

interface SidebarProps {
  user: Profile;
}

export function Sidebar({ user }: SidebarProps) {
  const router = useRouter();
  const currentPath = router.state.location.pathname;

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || user.role === "admin"
  );

  // Group by section
  const sections: Record<string, typeof navItems> = {};
  const noSection: typeof navItems = [];
  visibleItems.forEach((item) => {
    if (item.section) {
      if (!sections[item.section]) sections[item.section] = [];
      sections[item.section].push(item);
    } else {
      noSection.push(item);
    }
  });

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col min-h-screen">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-gray-200">
        <img
          src="/logo.png"
          alt="Country Fresh Pullets"
          className="h-10 w-auto"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {/* Items without section */}
        <div className="space-y-1 mb-4">
          {noSection.map((item) => {
            const isActive = currentPath === item.to || currentPath.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Sections */}
        {Object.entries(sections).map(([section, items]) => (
          <div key={section} className="mb-4">
            <p className="px-3 mb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {section}
            </p>
            <div className="space-y-1">
              {items.map((item) => {
                const isActive = currentPath === item.to || currentPath.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <svg
                      className="w-5 h-5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-400">
        Lloyds Pullet Sales v1.0
      </div>
    </aside>
  );
}
