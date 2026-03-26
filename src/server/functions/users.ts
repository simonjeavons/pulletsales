import { createServerFn } from "@tanstack/react-start";
import { userSchema } from "~/lib/validation/schemas";
import * as authService from "~/server/services/auth.service";
import * as usersService from "~/server/services/users.service";
import { getRequest } from "@tanstack/react-start/server";
import type { ListFilters } from "~/types/database";

const requireAdmin = async () => {
  const request = getRequest();
  return authService.requireAdmin(request);
};

export const listUsersFn = createServerFn({ method: "GET" })
  .inputValidator((data: ListFilters) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return usersService.listUsers(data);
  });

export const getUserFn = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return usersService.getUser(data.id);
  });

export const createUserFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => userSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const result = await authService.inviteUser({
      email: data.email,
      full_name: data.full_name,
      phone: data.phone || undefined,
      role: data.role,
    });
    if (result.error) {
      throw new Error(result.error);
    }
    return { success: true };
  });

export const updateUserFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; updates: Record<string, unknown> }) => {
    userSchema.partial().parse(data.updates);
    return data;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    return usersService.updateUser(data.id, data.updates);
  });

export const toggleUserActiveFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; is_active: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return usersService.toggleUserActive(data.id, data.is_active);
  });

export const deleteUserFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return usersService.deleteUser(data.id);
  });

export const resendInviteFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const result = await authService.resendInvite(data.id);
    if (result.error) {
      throw new Error(result.error);
    }
    return { success: true };
  });
