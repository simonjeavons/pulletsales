import { z } from "zod";

// ─── Shared ──────────────────────────────────────────────
const phone = z.string().max(30).optional().or(z.literal(""));
const email = z.string().email("Invalid email address");
const optionalEmail = z.string().email("Invalid email address").optional().or(z.literal(""));
const postCode = z.string().max(10).optional().or(z.literal(""));

// ─── Auth ────────────────────────────────────────────────
export const loginSchema = z.object({
  email: email,
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: email,
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// ─── Users ───────────────────────────────────────────────
export const userSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(200),
  email: email,
  phone: phone,
  role: z.enum(["admin", "standard_user"]),
  is_active: z.boolean().default(true),
});

// ─── Reps ────────────────────────────────────────────────
export const repSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  phone: phone,
  email: optionalEmail,
  address: z.string().max(500).optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

// ─── Customers ───────────────────────────────────────────
export const customerSchema = z.object({
  customer_unique_id: z.string().min(1, "Customer ID is required").max(50),
  company_name: z.string().min(1, "Company name is required").max(200),
  address_line_1: z.string().max(200).optional().or(z.literal("")),
  address_line_2: z.string().max(200).optional().or(z.literal("")),
  town_city: z.string().max(100).optional().or(z.literal("")),
  post_code: postCode,
  rep_id: z.string().uuid("Select a rep").optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

// ─── Delivery Addresses ─────────────────────────────────
export const deliveryAddressSchema = z.object({
  label: z.string().min(1, "Address label is required").max(100),
  address_line_1: z.string().max(200).optional().or(z.literal("")),
  address_line_2: z.string().max(200).optional().or(z.literal("")),
  town_city: z.string().max(100).optional().or(z.literal("")),
  post_code: postCode,
  delivery_notes: z.string().max(1000).optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

// ─── Extras ──────────────────────────────────────────────
export const extraSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(500).optional().or(z.literal("")),
  is_available: z.boolean().default(true),
});

// ─── Breeds ──────────────────────────────────────────────
export const breedSchema = z.object({
  breed_name: z.string().min(1, "Breed name is required").max(200),
  is_available: z.boolean().default(true),
  extra_ids: z.array(z.string().uuid()).default([]),
});

// ─── Rearers ─────────────────────────────────────────────
export const rearerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  address_line_1: z.string().max(200).optional().or(z.literal("")),
  address_line_2: z.string().max(200).optional().or(z.literal("")),
  town_city: z.string().max(100).optional().or(z.literal("")),
  post_code: postCode,
  email: optionalEmail,
  phone: phone,
  is_active: z.boolean().default(true),
});

// ─── Transporters ────────────────────────────────────────
export const transporterSchema = z.object({
  transporter_name: z.string().min(1, "Transporter name is required").max(200),
  address_line_1: z.string().max(200).optional().or(z.literal("")),
  address_line_2: z.string().max(200).optional().or(z.literal("")),
  town_city: z.string().max(100).optional().or(z.literal("")),
  post_code: postCode,
  phone: phone,
  email: optionalEmail,
  is_active: z.boolean().default(true),
});

// ─── Orders ──────────────────────────────────────────────
export const orderLineSchema = z.object({
  breed_id: z.string().uuid("Select a breed"),
  quantity: z.number().int().positive("Quantity must be greater than 0"),
  price: z.number().min(0, "Price cannot be negative"),
  food_clause_value: z.number().min(0, "Food clause value cannot be negative"),
  extra_ids: z.array(z.string().uuid()).default([]),
});

export const orderSchema = z.object({
  customer_id: z.string().uuid("Select a customer"),
  delivery_address_id: z.string().uuid().optional().or(z.literal("")),
  rep_id: z.string().uuid().optional().or(z.literal("")),
  requested_delivery_week_commencing: z.string().optional().or(z.literal("")),
  customer_notes: z.string().max(2000).optional().or(z.literal("")),
  internal_notes: z.string().max(2000).optional().or(z.literal("")),
  lines: z.array(orderLineSchema).default([]),
  extra_ids: z.array(z.string().uuid()).default([]),
});

// ─── Despatches ──────────────────────────────────────────
export const despatchLineSchema = z.object({
  order_line_id: z.string().uuid().optional().nullable(),
  breed_id: z.string().uuid("Select a breed"),
  quantity: z.number().int().positive("Quantity must be greater than 0"),
  price: z.number().min(0, "Price cannot be negative"),
  food_clause_value: z.number().min(0, "Food clause value cannot be negative"),
  extra_ids: z.array(z.string().uuid()).default([]),
});

export const despatchSchema = z.object({
  actual_delivery_date: z.string().min(1, "Delivery date is required"),
  transporter_id: z.string().uuid("Select a transporter"),
  lines: z.array(despatchLineSchema).min(1, "At least one line is required"),
  extra_ids: z.array(z.string().uuid()).default([]),
});

// ─── Type exports ────────────────────────────────────────
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type RepInput = z.infer<typeof repSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type DeliveryAddressInput = z.infer<typeof deliveryAddressSchema>;
export type ExtraInput = z.infer<typeof extraSchema>;
export type BreedInput = z.infer<typeof breedSchema>;
export type RearerInput = z.infer<typeof rearerSchema>;
export type TransporterInput = z.infer<typeof transporterSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type OrderLineInput = z.infer<typeof orderLineSchema>;
export type DespatchInput = z.infer<typeof despatchSchema>;
export type DespatchLineInput = z.infer<typeof despatchLineSchema>;
