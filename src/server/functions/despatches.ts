import { createServerFn } from "@tanstack/react-start";
import { despatchSchema } from "~/lib/validation/schemas";
import * as despatchesService from "~/server/services/despatches.service";

export const getDespatchFn = createServerFn({ method: "GET" })
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ data }) => {
    return despatchesService.getDespatch(data.orderId);
  });

export const saveDespatchFn = createServerFn({ method: "POST" })
  .inputValidator((data: { orderId: string; despatch: unknown; createdBy?: string }) => {
    const parsed = despatchSchema.parse(data.despatch);
    return { orderId: data.orderId, despatch: parsed, createdBy: data.createdBy };
  })
  .handler(async ({ data }) => {
    return despatchesService.saveDespatch(data.orderId, data.despatch, data.createdBy);
  });

export const completeDespatchFn = createServerFn({ method: "POST" })
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ data }) => {
    return despatchesService.completeDespatch(data.orderId);
  });

export const copyOrderLinesToDespatchFn = createServerFn({ method: "GET" })
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ data }) => {
    return despatchesService.copyOrderLinesToDespatch(data.orderId);
  });
