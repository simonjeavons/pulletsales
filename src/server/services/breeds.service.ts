import { getSupabaseAdminClient } from "~/lib/supabase/server";
import type { Breed, BreedWithExtras, BreedInsert, BreedUpdate, ListFilters } from "~/types/database";

const admin = () => getSupabaseAdminClient();

export async function listBreeds(filters: ListFilters & { is_available?: boolean } = {}) {
  const { search, is_available, page = 1, pageSize = 25 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin()
    .from("breeds")
    .select("*, breed_extras(extra_id, extras(id, name, is_available))", { count: "exact" })
    .order("breed_name", { ascending: true })
    .range(from, to);

  if (search) {
    query = query.ilike("breed_name", `%${search}%`);
  }

  if (is_available !== undefined) {
    query = query.eq("is_available", is_available);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  // Flatten the nested extras
  const breeds = (data ?? []).map((breed: any) => ({
    ...breed,
    extras: (breed.breed_extras ?? []).map((be: any) => be.extras).filter(Boolean),
    breed_extras: undefined,
  }));

  return { data: breeds as BreedWithExtras[], count: count ?? 0 };
}

export async function getBreed(id: string) {
  const { data, error } = await admin()
    .from("breeds")
    .select("*, breed_extras(extra_id, extras(id, name, is_available))")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);

  const breed = {
    ...data,
    extras: (data.breed_extras ?? []).map((be: any) => be.extras).filter(Boolean),
    breed_extras: undefined,
  };

  return breed as BreedWithExtras;
}

export async function createBreed(input: BreedInsert, extraIds: string[] = []) {
  const db = admin();

  const { data, error } = await db
    .from("breeds")
    .insert({ breed_name: input.breed_name, is_available: input.is_available })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (extraIds.length > 0) {
    const { error: linkError } = await db.from("breed_extras").insert(
      extraIds.map((extra_id) => ({ breed_id: data.id, extra_id }))
    );
    if (linkError) throw new Error(linkError.message);
  }

  return data as Breed;
}

export async function updateBreed(id: string, updates: BreedUpdate, extraIds?: string[]) {
  const db = admin();

  const { data, error } = await db
    .from("breeds")
    .update({ breed_name: updates.breed_name, is_available: updates.is_available })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Replace extras if provided
  if (extraIds !== undefined) {
    await db.from("breed_extras").delete().eq("breed_id", id);
    if (extraIds.length > 0) {
      const { error: linkError } = await db.from("breed_extras").insert(
        extraIds.map((extra_id) => ({ breed_id: id, extra_id }))
      );
      if (linkError) throw new Error(linkError.message);
    }
  }

  return data as Breed;
}

export async function toggleBreedAvailable(id: string, is_available: boolean) {
  return updateBreed(id, { is_available });
}
