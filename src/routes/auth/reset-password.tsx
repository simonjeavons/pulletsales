import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { resetPasswordFn } from "~/server/functions/auth";
import { Button } from "~/components/ui/Button";
import { FormField, inputClasses } from "~/components/forms/FormField";

export const Route = createFileRoute("/auth/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await resetPasswordFn({ data: { password, confirmPassword } });
      navigate({ to: "/login" });
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Country Fresh Pullets" className="h-14 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Pullet Sales</h1>
          <p className="text-gray-500 mt-1 text-sm">Set your new password</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <FormField label="New Password" required>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClasses}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
                autoFocus
              />
            </FormField>

            <FormField label="Confirm Password" required>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClasses}
                placeholder="Re-enter your password"
                required
              />
            </FormField>

            <Button type="submit" loading={loading} className="w-full">
              Set password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
