import { createServerFn } from "@tanstack/react-start";
import { rearerSchema } from "~/lib/validation/schemas";
import * as authService from "~/server/services/auth.service";
import * as rearersService from "~/server/services/rearers.service";
import { getRequest } from "@tanstack/react-start/server";
import type { ListFilters } from "~/types/database";

const requireAdmin = async () => {
  const request = getRequest();
  return authService.requireAdmin(request);
};

export const listRearersFn = createServerFn({ method: "GET" })
  .inputValidator((data: ListFilters) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return rearersService.listRearers(data);
  });

export const getRearerFn = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return rearersService.getRearer(data.id);
  });

export const createRearerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => rearerSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    return rearersService.createRearer({
      name: data.name,
      address_line_1: data.address_line_1 || null,
      address_line_2: data.address_line_2 || null,
      town_city: data.town_city || null,
      post_code: data.post_code || null,
      email: data.email || null,
      phone: data.phone || null,
      is_active: data.is_active,
    });
  });

export const updateRearerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; updates: Record<string, unknown> }) => {
    rearerSchema.partial().parse(data.updates);
    return data;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    return rearersService.updateRearer(data.id, data.updates);
  });

export const toggleRearerActiveFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; is_active: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return rearersService.toggleRearerActive(data.id, data.is_active);
  });
