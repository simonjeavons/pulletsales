// ─── Enums ───────────────────────────────────────────────
export type UserRole = "admin" | "standard_user";

// ─── Profiles ────────────────────────────────────────────
export interface Profile {
  id: string;
  auth_user_id: string;
  full_name: string;
  phone: string | null;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  invited_at: string | null;
  last_login_at: string | null;
  password_reset_requested_at: string | null;
}

export type ProfileInsert = Omit<Profile, "id" | "created_at" | "updated_at">;
export type ProfileUpdate = Partial<Omit<Profile, "id" | "auth_user_id" | "created_at">>;

// ─── Reps ────────────────────────────────────────────────
export interface Rep {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type RepInsert = Omit<Rep, "id" | "created_at" | "updated_at">;
export type RepUpdate = Partial<Omit<Rep, "id" | "created_at">>;

// ─── Customers ───────────────────────────────────────────
export interface Customer {
  id: string;
  customer_unique_id: string;
  company_name: string;
  address_line_1: string | null;
  address_line_2: string | null;
  town_city: string | null;
  post_code: string | null;
  rep_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CustomerInsert = Omit<Customer, "id" | "created_at" | "updated_at">;
export type CustomerUpdate = Partial<Omit<Customer, "id" | "created_at">>;

// With joined data for list views
export interface CustomerWithRep extends Customer {
  rep?: Rep | null;
}

// ─── Delivery Addresses ─────────────────────────────────
export interface DeliveryAddress {
  id: string;
  customer_id: string;
  label: string;
  address_line_1: string | null;
  address_line_2: string | null;
  town_city: string | null;
  post_code: string | null;
  delivery_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type DeliveryAddressInsert = Omit<DeliveryAddress, "id" | "created_at" | "updated_at">;
export type DeliveryAddressUpdate = Partial<Omit<DeliveryAddress, "id" | "customer_id" | "created_at">>;

// ─── Extras ──────────────────────────────────────────────
export interface Extra {
  id: string;
  name: string;
  description: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export type ExtraInsert = Omit<Extra, "id" | "created_at" | "updated_at">;
export type ExtraUpdate = Partial<Omit<Extra, "id" | "created_at">>;

// ─── Breeds ──────────────────────────────────────────────
export interface Breed {
  id: string;
  breed_name: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export type BreedInsert = Omit<Breed, "id" | "created_at" | "updated_at">;
export type BreedUpdate = Partial<Omit<Breed, "id" | "created_at">>;

export interface BreedExtra {
  id: string;
  breed_id: string;
  extra_id: string;
}

export interface BreedWithExtras extends Breed {
  extras: Extra[];
}

// ─── Rearers ─────────────────────────────────────────────
export interface Rearer {
  id: string;
  name: string;
  address_line_1: string | null;
  address_line_2: string | null;
  town_city: string | null;
  post_code: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type RearerInsert = Omit<Rearer, "id" | "created_at" | "updated_at">;
export type RearerUpdate = Partial<Omit<Rearer, "id" | "created_at">>;

// ─── Transporters ────────────────────────────────────────
export interface Transporter {
  id: string;
  transporter_name: string;
  address_line_1: string | null;
  address_line_2: string | null;
  town_city: string | null;
  post_code: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type TransporterInsert = Omit<Transporter, "id" | "created_at" | "updated_at">;
export type TransporterUpdate = Partial<Omit<Transporter, "id" | "created_at">>;

// ─── API Response Types ──────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
}

export interface ListFilters {
  search?: string;
  is_active?: boolean;
  page?: number;
  pageSize?: number;
}
