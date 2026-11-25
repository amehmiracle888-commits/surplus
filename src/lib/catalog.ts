import { createClient } from "@/lib/supabase/server";
import type { ProductCategory, PublicProduct } from "@/types/database";

const SAFE_PRODUCT_COLUMNS = `
  id,
  category_id,
  slug,
  name,
  provider,
  short_description,
  description,
  image_url,
  terms_and_conditions,
  setup_instructions,
  billing_cycle,
  duration_days,
  retail_price_kobo,
  renewal_price_kobo,
  delivery_method,
  availability_status,
  stock_quantity,
  is_active,
  is_featured,
  is_popular,
  metadata,
  options_schema,
  created_at,
  updated_at,
  category:product_categories(id, slug, name, description, icon, sort_order, is_active)
`;

export async function getActiveCategories(): Promise<ProductCategory[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("product_categories")
      .select("id, slug, name, description, icon, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error || !data) return [];
    return data as ProductCategory[];
  } catch {
    return [];
  }
}

export async function getPublicProducts(filters?: {
  categorySlug?: string;
  featuredOnly?: boolean;
  popularOnly?: boolean;
  search?: string;
}): Promise<PublicProduct[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("products")
      .select(SAFE_PRODUCT_COLUMNS)
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });

    if (filters?.featuredOnly) query = query.eq("is_featured", true);
    if (filters?.popularOnly) query = query.eq("is_popular", true);
    if (filters?.search) {
      const term = filters.search.trim();
      if (term) {
        query = query.or(`name.ilike.%${term}%,provider.ilike.%${term}%,short_description.ilike.%${term}%`);
      }
    }

    const { data, error } = await query;
    if (error || !data) return [];

    let products = data as unknown as PublicProduct[];
    if (filters?.categorySlug) {
      products = products.filter((p) => p.category?.slug === filters.categorySlug);
    }
    return products;
  } catch {
    return [];
  }
}

export async function getPublicProductBySlug(slug: string): Promise<PublicProduct | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select(SAFE_PRODUCT_COLUMNS)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) return null;
    return data as unknown as PublicProduct;
  } catch {
    return null;
  }
}
