import type { Product, ProductStatus, Paginated, ProductVariantOption } from '@pure-relief/shared';
import { generateId } from '../crypto';

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description_html: string;
  status: ProductStatus;
  seo_title: string;
  seo_meta_description: string;
  seo_canonical_path: string;
  seo_og_image_key: string | null;
  seo_no_index: number;
  avg_rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
};

async function hydrateProduct(db: D1Database, row: ProductRow): Promise<Product> {
  const [images, variants, benefits, specs, faqs, categories, related] = await Promise.all([
    db
      .prepare(
        `SELECT pi.id, ma.r2_key, ma.alt_text, ma.width, ma.height, ma.is_placeholder
         FROM product_images pi JOIN media_assets ma ON ma.id = pi.media_asset_id
         WHERE pi.product_id = ? ORDER BY pi.sort_order ASC`,
      )
      .bind(row.id)
      .all<{ id: string; r2_key: string; alt_text: string; width: number; height: number; is_placeholder: number }>(),
    db
      .prepare(
        `SELECT id, option, sku, label, price_minor, compare_at_price_minor, stock_quantity, is_default
         FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC`,
      )
      .bind(row.id)
      .all<{
        id: string;
        option: ProductVariantOption;
        sku: string;
        label: string;
        price_minor: number;
        compare_at_price_minor: number | null;
        stock_quantity: number;
        is_default: number;
      }>(),
    db
      .prepare(`SELECT id, icon, title, description FROM product_benefits WHERE product_id = ? ORDER BY sort_order ASC`)
      .bind(row.id)
      .all<{ id: string; icon: string; title: string; description: string }>(),
    db
      .prepare(`SELECT label, value FROM product_specs WHERE product_id = ? ORDER BY sort_order ASC`)
      .bind(row.id)
      .all<{ label: string; value: string }>(),
    db
      .prepare(`SELECT id, question, answer FROM product_faqs WHERE product_id = ? ORDER BY sort_order ASC`)
      .bind(row.id)
      .all<{ id: string; question: string; answer: string }>(),
    db
      .prepare(`SELECT category_id FROM product_categories WHERE product_id = ?`)
      .bind(row.id)
      .all<{ category_id: string }>(),
    db
      .prepare(`SELECT related_product_id FROM product_related WHERE product_id = ? ORDER BY sort_order ASC`)
      .bind(row.id)
      .all<{ related_product_id: string }>(),
  ]);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    descriptionHtml: row.description_html,
    categoryIds: categories.results.map((c) => c.category_id),
    status: row.status,
    images: images.results.map((img) => ({
      id: img.id,
      r2Key: img.r2_key,
      altText: img.alt_text,
      width: img.width,
      height: img.height,
      isPlaceholder: Boolean(img.is_placeholder),
    })),
    variants: variants.results.map((v) => ({
      id: v.id,
      productId: row.id,
      option: v.option,
      sku: v.sku,
      label: v.label,
      price: { amountMinor: v.price_minor, currency: 'GBP' },
      compareAtPrice: v.compare_at_price_minor != null ? { amountMinor: v.compare_at_price_minor, currency: 'GBP' } : null,
      stockQuantity: v.stock_quantity,
      isDefault: Boolean(v.is_default),
    })),
    benefits: benefits.results.map((b) => ({ id: b.id, icon: b.icon, title: b.title, description: b.description })),
    specs: specs.results.map((s) => ({ label: s.label, value: s.value })),
    faqs: faqs.results.map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
    relatedProductIds: related.results.map((r) => r.related_product_id),
    seo: {
      title: row.seo_title,
      metaDescription: row.seo_meta_description,
      canonicalPath: row.seo_canonical_path,
      ogImageKey: row.seo_og_image_key,
      noIndex: Boolean(row.seo_no_index),
    },
    avgRating: row.avg_rating,
    reviewCount: row.review_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getProductBySlug(db: D1Database, slug: string): Promise<Product | null> {
  const row = await db
    .prepare(`SELECT * FROM products WHERE slug = ? AND deleted_at IS NULL`)
    .bind(slug)
    .first<ProductRow>();
  if (!row) return null;
  return hydrateProduct(db, row);
}

export async function getProductById(db: D1Database, id: string): Promise<Product | null> {
  const row = await db.prepare(`SELECT * FROM products WHERE id = ? AND deleted_at IS NULL`).bind(id).first<ProductRow>();
  if (!row) return null;
  return hydrateProduct(db, row);
}

export type ListProductsParams = {
  page: number;
  pageSize: number;
  status?: ProductStatus;
  search?: string;
  categoryId?: string;
  sort?: 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc';
};

export async function listProducts(db: D1Database, params: ListProductsParams): Promise<Paginated<Product>> {
  const conditions: string[] = ['p.deleted_at IS NULL'];
  const bindings: unknown[] = [];

  if (params.status) {
    conditions.push('p.status = ?');
    bindings.push(params.status);
  }
  if (params.search) {
    conditions.push('(p.name LIKE ? OR p.slug LIKE ? OR p.short_description LIKE ?)');
    const like = `%${params.search}%`;
    bindings.push(like, like, like);
  }
  if (params.categoryId) {
    conditions.push('p.id IN (SELECT product_id FROM product_categories WHERE category_id = ?)');
    bindings.push(params.categoryId);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const sortMap: Record<NonNullable<ListProductsParams['sort']>, string> = {
    newest: 'p.created_at DESC',
    oldest: 'p.created_at ASC',
    name_asc: 'p.name ASC',
    name_desc: 'p.name DESC',
    price_asc: 'MIN(pv.price_minor) ASC',
    price_desc: 'MIN(pv.price_minor) DESC',
  };
  const orderBy = sortMap[params.sort ?? 'newest'];
  const needsVariantJoin = params.sort === 'price_asc' || params.sort === 'price_desc';

  const countRow = await db
    .prepare(`SELECT COUNT(*) as total FROM products p ${whereClause}`)
    .bind(...bindings)
    .first<{ total: number }>();
  const total = countRow?.total ?? 0;

  const offset = (params.page - 1) * params.pageSize;
  const query = needsVariantJoin
    ? `SELECT p.* FROM products p LEFT JOIN product_variants pv ON pv.product_id = p.id ${whereClause}
       GROUP BY p.id ORDER BY ${orderBy} LIMIT ? OFFSET ?`
    : `SELECT p.* FROM products p ${whereClause} GROUP BY p.id ORDER BY ${orderBy} LIMIT ? OFFSET ?`;

  const rows = await db
    .prepare(query)
    .bind(...bindings, params.pageSize, offset)
    .all<ProductRow>();

  const items = await Promise.all(rows.results.map((row) => hydrateProduct(db, row)));

  return { items, total, page: params.page, pageSize: params.pageSize };
}

export type ProductWriteInput = {
 slug: string;
 name: string;
 shortDescription: string;
 descriptionHtml: string;
 categoryIds: string[];
 status: ProductStatus;
 images: string[];
  variants: {
    id?: string;
    option: ProductVariantOption;
    sku: string;
    label: string;
    priceMinor: number;
    compareAtPriceMinor?: number | null;
    stockQuantity: number;
    isDefault: boolean;
  }[];
  seo: {
    title: string;
    metaDescription: string;
    canonicalPath: string;
    ogImageKey?: string | null;
    noIndex?: boolean;
  };
};

/**
 * BUG FIX (data loss on product edit):
 *
 * createProduct/updateProduct previously ran the product row write,
 * the two association DELETEs (on update), and the association INSERTs
 * as separate, independently auto-committed D1 calls:
 *   1. INSERT/UPDATE products ... .run()
 *   2. DELETE FROM product_categories ... .run()   (update only)
 *   3. DELETE FROM product_variants ... .run()     (update only)
 *   4. writeProductAssociations() -> db.batch([...inserts])
 *
 * If step 4 failed for any reason (bad variant data, transient D1 error,
 * CPU/time limit on a product with many variants), steps 2 and 3 had
 * already committed — permanently deleting the product's categories and
 * variants with no rollback. D1's own docs confirm batched statements run
 * as a SQL transaction and roll back together on any failure, which
 * standalone .run() calls do not get. Verified this failure mode directly
 * against the live D1 database before applying this fix.
 *
 * Fix: every statement (product row + all deletes + all associations)
 * goes into one db.batch() call, so the whole update succeeds or none of
 * it does.
 */
export async function createProduct(db: D1Database, input: ProductWriteInput): Promise<Product> {
  const id = generateId('prod');
  const now = new Date().toISOString();

  const insertProduct = db
    .prepare(
      `INSERT INTO products
        (id, slug, name, short_description, description_html, status,
         seo_title, seo_meta_description, seo_canonical_path, seo_og_image_key, seo_no_index,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.slug,
      input.name,
      input.shortDescription,
      input.descriptionHtml,
      input.status,
      input.seo.title,
      input.seo.metaDescription,
      input.seo.canonicalPath,
      input.seo.ogImageKey ?? null,
      input.seo.noIndex ? 1 : 0,
      now,
      now,
    );

  await db.batch([insertProduct, ...buildProductAssociationStatements(db, id, input)]);

  const product = await getProductById(db, id);
  if (!product) throw new Error('Product creation failed unexpectedly');
  return product;
}

export async function updateProduct(db: D1Database, id: string, input: ProductWriteInput): Promise<Product> {
  const now = new Date().toISOString();

  const updateStmt = db
    .prepare(
      `UPDATE products SET
        slug = ?, name = ?, short_description = ?, description_html = ?, status = ?,
        seo_title = ?, seo_meta_description = ?, seo_canonical_path = ?, seo_og_image_key = ?, seo_no_index = ?,
        updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.slug,
      input.name,
      input.shortDescription,
      input.descriptionHtml,
      input.status,
      input.seo.title,
      input.seo.metaDescription,
      input.seo.canonicalPath,
      input.seo.ogImageKey ?? null,
      input.seo.noIndex ? 1 : 0,
      now,
      id,
    );

 const deleteCategories = db.prepare(`DELETE FROM product_categories WHERE product_id = ?`).bind(id);
 const deleteVariants = db.prepare(`DELETE FROM product_variants WHERE product_id = ?`).bind(id);
 const deleteImages = db.prepare(`DELETE FROM product_images WHERE product_id = ?`).bind(id);

 await db.batch([updateStmt, deleteCategories, deleteVariants, deleteImages, ...buildProductAssociationStatements(db, id, input)]);

  const product = await getProductById(db, id);
  if (!product) throw new Error('Product not found after update');
  return product;
}

function buildProductAssociationStatements(db: D1Database, productId: string, input: ProductWriteInput): D1PreparedStatement[] {
 const statements: D1PreparedStatement[] = [];

 for (const categoryId of input.categoryIds) {
   statements.push(
     db.prepare(`INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)`).bind(productId, categoryId),
   );
 }

 input.images.forEach((mediaAssetId, idx) => {
   statements.push(
     db
       .prepare(`INSERT INTO product_images (id, product_id, media_asset_id, sort_order) VALUES (?, ?, ?, ?)`)
       .bind(generateId('pimg'), productId, mediaAssetId, idx),
   );
 });

  input.variants.forEach((variant, idx) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO product_variants
            (id, product_id, option, sku, label, price_minor, compare_at_price_minor, stock_quantity, is_default, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          variant.id ?? generateId('var'),
          productId,
          variant.option,
          variant.sku,
          variant.label,
          variant.priceMinor,
          variant.compareAtPriceMinor ?? null,
          variant.stockQuantity,
          variant.isDefault ? 1 : 0,
          idx,
        ),
    );
  });

  return statements;
}

export async function softDeleteProduct(db: D1Database, id: string): Promise<void> {
  await db.prepare(`UPDATE products SET deleted_at = ? WHERE id = ?`).bind(new Date().toISOString(), id).run();
}

export async function restoreProduct(db: D1Database, id: string): Promise<void> {
  await db.prepare(`UPDATE products SET deleted_at = NULL WHERE id = ?`).bind(id).run();
}

export async function bulkUpdateStatus(db: D1Database, ids: string[], status: ProductStatus): Promise<void> {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  await db
    .prepare(`UPDATE products SET status = ?, updated_at = ? WHERE id IN (${placeholders})`)
    .bind(status, new Date().toISOString(), ...ids)
    .run();
}
