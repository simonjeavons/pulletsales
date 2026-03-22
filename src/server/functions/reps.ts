import { createServerFn } from "@tanstack/react-start";
import { repSchema } from "~/lib/validation/schemas";
import * as authService from "~/server/services/auth.service";
import * as repsService from "~/server/services/reps.service";
import { getRequest } from "@tanstack/react-start/server";
import type { ListFilters } from "~/types/database";

const requireAdmin = async () => {
  const request = getRequest();
  return authService.requireAdmin(request);
};

export const listRepsFn = createServerFn({ method: "GET" })
  .inputValidator((data: ListFilters) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return repsService.listReps(data);
  });

export const getActiveRepsFn = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  await authService.requireAuth(request);
  return repsService.getActiveReps();
});

export const getRepFn = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return repsService.getRep(data.id);
  });

export const createRepFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => repSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    return repsService.createRep({
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      is_active: data.is_active,
    });
  });

export const updateRepFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; updates: Record<string, unknown> }) => {
    repSchema.partial().parse(data.updates);
    return data;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    return repsService.updateRep(data.id, data.updates);
  });

export const toggleRepActiveFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; is_active: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return repsService.toggleRepActive(data.id, data.is_active);
  });
