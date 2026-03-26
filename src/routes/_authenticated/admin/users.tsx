import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listUsersFn, createUserFn, updateUserFn, toggleUserActiveFn, resendInviteFn, deleteUserFn } from "~/server/functions/users";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { DataTable } from "~/components/ui/DataTable";
import { SearchBar, StatusFilter } from "~/components/ui/SearchBar";
import { StatusBadge, Badge } from "~/components/ui/Badge";
import { Modal, ConfirmModal } from "~/components/ui/Modal";
import { FormField, inputClasses, selectClasses } from "~/components/forms/FormField";
import type { Profile, UserRole } from "~/types/database";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Profile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users", search, statusFilter],
    queryFn: () => listUsersFn({ data: { search: search || undefined, is_active: statusFilter } }),
  });

  const createMutation = useMutation({
    mutationFn: createUserFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowCreateModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateUserFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleUserActiveFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setToggleTarget(null);
    },
  });

  const resendMutation = useMutation({
    mutationFn: resendInviteFn,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUserFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteTarget(null);
    },
  });

  const columns = [
    { key: "name", header: "Name", render: (u: Profile) => <span className="font-medium">{u.full_name}</span> },
    { key: "email", header: "Email", render: (u: Profile) => u.email },
    { key: "phone", header: "Phone", render: (u: Profile) => u.phone || "—" },
    {
      key: "role", header: "Role",
      render: (u: Profile) => (
        <Badge variant={u.role === "admin" ? "info" : "neutral"}>
          {u.role === "admin" ? "Admin" : "Standard"}
        </Badge>
      ),
    },
    { key: "status", header: "Status", render: (u: Profile) => <StatusBadge active={u.is_active} /> },
    {
      key: "invite_status", header: "Invite",
      render: (u: Profile) => {
        if (u.last_login_at) {
          return <Badge variant="success">Accepted</Badge>;
        }
        if (u.invited_at) {
          return <Badge variant="warning">Pending</Badge>;
        }
        return <Badge variant="neutral">Not Invited</Badge>;
      },
    },
    {
      key: "actions", header: "", className: "text-right",
      render: (u: Profile) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditingUser(u)}>Edit</Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setToggleTarget(u)}
          >
            {u.is_active ? "Deactivate" : "Reactivate"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={resendMutation.isPending}
            onClick={() => resendMutation.mutate({ data: { id: u.id } })}
          >
            Resend Invite
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => setDeleteTarget(u)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage system users and their access."
        actions={<Button onClick={() => setShowCreateModal(true)}>Add User</Button>}
      />

      <div className="flex gap-3 mb-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by name or email..."
          className="w-80"
        />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        keyExtractor={(u) => u.id}
        loading={isLoading}
        emptyMessage="No users found."
      />

      {/* Create Modal */}
      <UserFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={(values) => createMutation.mutate({ data: values })}
        loading={createMutation.isPending}
        error={createMutation.error?.message}
        title="Add User"
      />

      {/* Edit Modal */}
      {editingUser && (
        <UserFormModal
          open={true}
          onClose={() => setEditingUser(null)}
          onSubmit={(values) =>
            updateMutation.mutate({ data: { id: editingUser.id, updates: values } })
          }
          loading={updateMutation.isPending}
          error={updateMutation.error?.message}
          title="Edit User"
          defaults={editingUser}
          isEdit
        />
      )}

      {/* Toggle Confirm */}
      <ConfirmModal
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={() =>
          toggleTarget && toggleMutation.mutate({ data: { id: toggleTarget.id, is_active: !toggleTarget.is_active } })
        }
        title={toggleTarget?.is_active ? "Deactivate User" : "Reactivate User"}
        message={`Are you sure you want to ${toggleTarget?.is_active ? "deactivate" : "reactivate"} ${toggleTarget?.full_name}?`}
        confirmLabel={toggleTarget?.is_active ? "Deactivate" : "Reactivate"}
        confirmVariant={toggleTarget?.is_active ? "danger" : "primary"}
        loading={toggleMutation.isPending}
      />

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget && deleteMutation.mutate({ data: { id: deleteTarget.id } })
        }
        title="Delete User"
        message={`Are you sure you want to permanently delete ${deleteTarget?.full_name}? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// ─── User Form Modal ─────────────────────────────────────
function UserFormModal({
  open, onClose, onSubmit, loading, error, title, defaults, isEdit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: any) => void;
  loading: boolean;
  error?: string;
  title: string;
  defaults?: Partial<Profile>;
  isEdit?: boolean;
}) {
  const [fullName, setFullName] = useState(defaults?.full_name || "");
  const [email, setEmail] = useState(defaults?.email || "");
  const [phone, setPhone] = useState(defaults?.phone || "");
  const [role, setRole] = useState<UserRole>(defaults?.role || "standard_user");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      full_name: fullName,
      email,
      phone: phone || undefined,
      role,
      is_active: defaults?.is_active ?? true,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>
        )}
        <FormField label="Full Name" required>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClasses} required />
        </FormField>
        <FormField label="Email" required>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} required disabled={isEdit} />
        </FormField>
        <FormField label="Phone">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClasses} />
        </FormField>
        <FormField label="Role" required>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={selectClasses}>
            <option value="admin">Admin</option>
            <option value="standard_user">Standard User</option>
          </select>
        </FormField>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{isEdit ? "Save Changes" : "Send Invite"}</Button>
        </div>
      </form>
    </Modal>
  );
}
