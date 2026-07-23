import { Hono } from 'hono';
import type { AppContext } from '../env';
import { ok, fail } from '../lib/response';
import { requireAuth, requirePermission } from '../middleware/auth';
import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  softDeleteProduct,
  restoreProduct,
  bulkUpdateStatus,
} from '../lib/repositories/products';
import { productInputSchema, csvImportRowSchema } from '@pure-relief/shared';
import { flattenZodErrors } from '../lib/zod-errors';
import { writeAuditLog } from '../lib/repositories/config';

export const adminProductsRouter = new Hono<AppContext>();
adminProductsRouter.use('*', requireAuth, requirePermission('products.manage'));

adminProductsRouter.get('/', async (c) => {
  const url = new URL(c.req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20));
  const search = url.searchParams.get('search') ?? undefined;
  const status = (url.searchParams.get('status') ?? undefined) as 'draft' | 'published' | 'archived' | undefined;
  const categoryId = url.searchParams.get('categoryId') ?? undefined;
  const sort = (url.searchParams.get('sort') ?? undefined) as
    | 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | undefined;

  const result = await listProducts(c.env.DB, { page, pageSize, search, status, categoryId, sort });
  return ok(c, result);
});

adminProductsRouter.get('/:id', async (c) => {
  const product = await getProductById(c.env.DB, c.req.param('id'));
  if (!product) return fail(c, 404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  return ok(c, product);
});

adminProductsRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = productInputSchema.safeParse(body);
  if (!parsed.success) return fail(c, 422, 'VALIDATION_ERROR', 'Check the highlighted fields.', flattenZodErrors(parsed.error));

  const existingSlugCheck = await c.env.DB.prepare(`SELECT id FROM products WHERE slug = ?`).bind(parsed.data.slug).first();
  if (existingSlugCheck) return fail(c, 409, 'SLUG_TAKEN', 'A product with this URL slug already exists.', { slug: 'This slug is already in use' });

  const product = await createProduct(c.env.DB, {
    ...parsed.data,
    variants: parsed.data.variants.map((v) => ({
      option: v.option,
      sku: v.sku,
      label: v.label,
      priceMinor: v.priceMinor,
      compareAtPriceMinor: v.compareAtPriceMinor ?? null,
      stockQuantity: v.stockQuantity,
      isDefault: v.isDefault,
    })),
  });

  const authUser = c.get('authUser')!;
  await writeAuditLog(c.env.DB, { userId: authUser.id, action: 'create', entityType: 'product', entityId: product.id });

  return ok(c, product, 201);
});

adminProductsRouter.put('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await getProductById(c.env.DB, id);
  if (!existing) return fail(c, 404, 'PRODUCT_NOT_FOUND', 'Product not found.');

  const body = await c.req.json().catch(() => null);
  const parsed = productInputSchema.safeParse(body);
  if (!parsed.success) return fail(c, 422, 'VALIDATION_ERROR', 'Check the highlighted fields.', flattenZodErrors(parsed.error));

  if (parsed.data.slug !== existing.slug) {
    const slugTaken = await c.env.DB.prepare(`SELECT id FROM products WHERE slug = ? AND id != ?`).bind(parsed.data.slug, id).first();
    if (slugTaken) return fail(c, 409, 'SLUG_TAKEN', 'A product with this URL slug already exists.', { slug: 'This slug is already in use' });
  }

  const product = await updateProduct(c.env.DB, id, {
    ...parsed.data,
    variants: parsed.data.variants.map((v) => ({
      id: v.id,
      option: v.option,
      sku: v.sku,
      label: v.label,
      priceMinor: v.priceMinor,
      compareAtPriceMinor: v.compareAtPriceMinor ?? null,
      stockQuantity: v.stockQuantity,
      isDefault: v.isDefault,
    })),
  });

  const authUser = c.get('authUser')!;
  await writeAuditLog(c.env.DB, { userId: authUser.id, action: 'update', entityType: 'product', entityId: id });

  return ok(c, product);
});

adminProductsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await softDeleteProduct(c.env.DB, id);
  const authUser = c.get('authUser')!;
  await writeAuditLog(c.env.DB, { userId: authUser.id, action: 'delete', entityType: 'product', entityId: id });
  return ok(c, { deleted: true });
});

adminProductsRouter.post('/:id/restore', async (c) => {
  const id = c.req.param('id');
  await restoreProduct(c.env.DB, id);
  const authUser = c.get('authUser')!;
  await writeAuditLog(c.env.DB, { userId: authUser.id, action: 'restore', entityType: 'product', entityId: id });
  return ok(c, { restored: true });
});

adminProductsRouter.post('/bulk/status', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !Array.isArray(body.ids) || !body.status) {
    return fail(c, 400, 'INVALID_REQUEST', 'Provide ids and a status.');
  }
  await bulkUpdateStatus(c.env.DB, body.ids, body.status);
  const authUser = c.get('authUser')!;
  await writeAuditLog(c.env.DB, { userId: authUser.id, action: 'bulk_status_update', entityType: 'product', diff: { ids: body.ids, status: body.status } });
  return ok(c, { updated: body.ids.length });
});

adminProductsRouter.post('/bulk/delete', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !Array.isArray(body.ids)) return fail(c, 400, 'INVALID_REQUEST', 'Provide ids to delete.');
  for (const id of body.ids as string[]) {
    await softDeleteProduct(c.env.DB, id);
  }
  const authUser = c.get('authUser')!;
  await writeAuditLog(c.env.DB, { userId: authUser.id, action: 'bulk_delete', entityType: 'product', diff: { ids: body.ids } });
  return ok(c, { deleted: body.ids.length });
});

/** CSV export: streams all non-deleted products as a downloadable CSV. */
adminProductsRouter.get('/export/csv', async (c) => {
  const { items } = await listProducts(c.env.DB, { page: 1, pageSize: 10_000 });
  const header = 'slug,name,short_description,status,variant_sku,variant_label,price_minor,stock_quantity\n';
  const rows = items
    .flatMap((p) =>
      p.variants.map((v) =>
        [p.slug, csvEscape(p.name), csvEscape(p.shortDescription), p.status, v.sku, csvEscape(v.label), v.price.amountMinor, v.stockQuantity].join(','),
      ),
    )
    .join('\n');

  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="pure-relief-products.csv"');
  return c.body(header + rows);
});

/** CSV import: creates simple draft products from a minimal CSV. Full editing happens in the UI afterward. */
adminProductsRouter.post('/import/csv', async (c) => {
  const body = await c.req.text();
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return fail(c, 400, 'EMPTY_CSV', 'The CSV file has no data rows.');

  const headerCols = lines[0]!.split(',').map((h) => h.trim());
  const results: { row: number; ok: boolean; error?: string; slug?: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(',');
    const record: Record<string, string> = {};
    headerCols.forEach((col, idx) => (record[col] = cols[idx]?.trim() ?? ''));

    const parsed = csvImportRowSchema.safeParse(record);
    if (!parsed.success) {
      results.push({ row: i + 1, ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid row' });
      continue;
    }

    const existing = await c.env.DB.prepare(`SELECT id FROM products WHERE slug = ?`).bind(parsed.data.slug).first();
    if (existing) {
      results.push({ row: i + 1, ok: false, error: 'Slug already exists', slug: parsed.data.slug });
      continue;
    }

    await createProduct(c.env.DB, {
     slug: parsed.data.slug,
     name: parsed.data.name,
     shortDescription: parsed.data.shortDescription,
     descriptionHtml: `<p>${parsed.data.shortDescription}</p>`,
     categoryIds: [],
     status: parsed.data.status,
     images: [],
     variants: [
        {
          option: 'single',
          sku: `${parsed.data.slug}-default`.toUpperCase(),
          label: 'Default',
          priceMinor: parsed.data.priceMinor,
          stockQuantity: parsed.data.stockQuantity,
          isDefault: true,
        },
      ],
      seo: {
        title: parsed.data.name.slice(0, 70),
        metaDescription: parsed.data.shortDescription.slice(0, 160) || parsed.data.name,
        canonicalPath: `/product/${parsed.data.slug}`,
      },
    });

    results.push({ row: i + 1, ok: true, slug: parsed.data.slug });
  }

  const authUser = c.get('authUser')!;
  await writeAuditLog(c.env.DB, { userId: authUser.id, action: 'csv_import', entityType: 'product', diff: { count: results.filter((r) => r.ok).length } });

  return ok(c, { results, imported: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
});

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
