import { createServerFn } from "@tanstack/react-start";
import { extraSchema } from "~/lib/validation/schemas";
import * as authService from "~/server/services/auth.service";
import * as extrasService from "~/server/services/extras.service";
import { getRequest } from "@tanstack/react-start/server";
import type { ListFilters } from "~/types/database";

const requireAdmin = async () => {
  const request = getRequest();
  return authService.requireAdmin(request);
};

export const listExtrasFn = createServerFn({ method: "GET" })
  .inputValidator((data: ListFilters & { is_available?: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return extrasService.listExtras(data);
  });

export const getAvailableExtrasFn = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  await authService.requireAuth(request);
  return extrasService.getAvailableExtras();
});

export const getExtraFn = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return extrasService.getExtra(data.id);
  });

export const createExtraFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => extraSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    return extrasService.createExtra({
      name: data.name,
      description: data.description || null,
      is_available: data.is_available,
    });
  });

export const updateExtraFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; updates: Record<string, unknown> }) => {
    extraSchema.partial().parse(data.updates);
    return data;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    return extrasService.updateExtra(data.id, data.updates);
  });

export const toggleExtraAvailableFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; is_available: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return extrasService.toggleExtraAvailable(data.id, data.is_available);
  });
