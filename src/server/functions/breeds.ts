import { createServerFn } from "@tanstack/react-start";
import { breedSchema } from "~/lib/validation/schemas";
import * as authService from "~/server/services/auth.service";
import * as breedsService from "~/server/services/breeds.service";
import { getRequest } from "@tanstack/react-start/server";
import type { ListFilters } from "~/types/database";

const requireAdmin = async () => {
  const request = getRequest();
  return authService.requireAdmin(request);
};

export const listBreedsFn = createServerFn({ method: "GET" })
  .inputValidator((data: ListFilters & { is_available?: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return breedsService.listBreeds(data);
  });

export const getBreedFn = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return breedsService.getBreed(data.id);
  });

export const createBreedFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => breedSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    return breedsService.createBreed(
      { breed_name: data.breed_name, is_available: data.is_available },
      data.extra_ids
    );
  });

export const updateBreedFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { id: string; updates: Record<string, unknown>; extra_ids?: string[] }) => {
      breedSchema.partial().parse(data.updates);
      return data;
    }
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    return breedsService.updateBreed(data.id, data.updates, data.extra_ids);
  });

export const toggleBreedAvailableFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; is_available: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return breedsService.toggleBreedAvailable(data.id, data.is_available);
  });
