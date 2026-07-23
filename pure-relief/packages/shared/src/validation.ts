import { z } from 'zod';

// ============================================================================
// Shared Zod schemas — used by React Hook Form on the client AND as the
// server-side input validator inside Worker route handlers. One definition,
// two enforcement points; prevents the classic "client validated, server
// didn't" gap that most tutorials leave open.
// ============================================================================

export const ukPostcodeRegex =
  /^([A-Z]{1,2}\d[A-Z\d]?|ASCN|STHL|TDCU|BBND|[BFS]IQQ|PCRN|TKCA) ?\d[A-Z]{2}$/i;

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the full name').max(120),
  line1: z.string().trim().min(3, 'Enter the address').max(200),
  line2: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  city: z.string().trim().min(2, 'Enter the town or city').max(120),
  postcode: z
    .string()
    .trim()
    .regex(ukPostcodeRegex, 'Enter a valid UK postcode')
    .transform((v) => v.toUpperCase()),
  country: z.string().trim().min(2).max(60).default('United Kingdom'),
  phone: z
    .string()
    .trim()
    .regex(/^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$|^\+?\d{7,15}$/, 'Enter a valid phone number'),
});

export const contactFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  subject: z.string().trim().min(3, 'Enter a subject').max(150),
  message: z.string().trim().min(10, 'Message is too short').max(5000),
  // honeypot — must stay empty; bots that autofill hidden fields get silently rejected server-side
  website: z.string().max(0).optional().or(z.literal('')),
});
export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const newsletterSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});

export const checkoutSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  shippingAddress: addressSchema,
  billingAddressSameAsShipping: z.boolean(),
  billingAddress: addressSchema.optional(),
  couponCode: z.string().trim().max(40).optional().or(z.literal('')),
  marketingOptIn: z.boolean().default(false),
});
export type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export const reviewSubmissionSchema = z.object({
  productId: z.string().min(1),
  authorName: z.string().trim().min(2, 'Enter your name').max(80),
  email: z.string().trim().email('Enter a valid email address'),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3, 'Enter a short title').max(120),
  body: z.string().trim().min(10, 'Tell us a bit more').max(3000),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

// ---- Admin entity schemas (used by admin forms + worker admin routes) -----

export const moneyInputSchema = z.number().int().min(0).max(100_000_00);

export const productVariantInputSchema = z.object({
  id: z.string().optional(),
  option: z.enum(['single', 'double', 'triple']),
  sku: z.string().trim().min(2).max(64),
  label: z.string().trim().min(2).max(120),
  priceMinor: moneyInputSchema,
  compareAtPriceMinor: moneyInputSchema.nullable().optional(),
  stockQuantity: z.number().int().min(0).max(1_000_000),
  isDefault: z.boolean().default(false),
});

/**
 * BUG FIX: products and blog posts could not be saved unless the admin
 * hand-wrote an SEO title of at least 10 characters and a meta
 * description of at least 50 characters, with no way to leave them
 * blank.
 *
 * Both the `products` and `blog_posts` tables default seo_title and
 * seo_meta_description to '' — the schema was designed to allow saving
 * without SEO fields filled in. This validation schema contradicted that
 * by requiring both with no fallback, so any admin who left them blank
 * (or just short) got a 422 that looked identical to "the save button
 * doesn't work," with no connection to auth or CSRF at all.
 *
 * Fix: make seo fields optional and auto-fill sensible defaults from the
 * entity's own title/description when left blank, instead of hard
 * blocking the save. Still caps length so nothing overflows the columns
 * or the storefront's <meta> tags.
 */
export const seoInputSchema = z
  .object({
    title: z.string().trim().max(70, 'Keep the SEO title under 70 characters').optional().default(''),
    metaDescription: z.string().trim().max(160, 'Keep the meta description under 160 characters').optional().default(''),
    canonicalPath: z.string().trim().optional().default(''),
    ogImageKey: z.string().nullable().optional(),
    noIndex: z.boolean().optional().default(false),
  })
  .optional()
  .default({});

export const productInputSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only')
      .max(160),
    name: z.string().trim().min(2).max(200),
    shortDescription: z.string().trim().min(10).max(300),
    descriptionHtml: z.string().trim().min(20),
    categoryIds: z.array(z.string()).default([]),
   status: z.enum(['draft', 'published', 'archived']),
   images: z.array(z.string()).default([]),
    variants: z.array(productVariantInputSchema).min(1, 'Add at least one variant'),
    seo: seoInputSchema,
  })
  .transform((data) => ({
    ...data,
    seo: {
      ...data.seo,
      title: data.seo.title || data.name.slice(0, 70),
      metaDescription: data.seo.metaDescription || data.shortDescription.slice(0, 160),
      canonicalPath: data.seo.canonicalPath || `/product/${data.slug}`,
    },
  }));

export const couponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,32}$/, 'Use 3-32 letters, numbers, hyphens or underscores'),
    type: z.enum(['percentage', 'fixed']),
    value: z.number().positive(),
    minSpendMinor: z.number().int().min(0).nullable().optional(),
    maxUses: z.number().int().positive().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    active: z.boolean().default(true),
  })
  .refine((c) => (c.type === 'percentage' ? c.value <= 100 : true), {
    message: 'Percentage discounts cannot exceed 100',
    path: ['value'],
  });

export const blogPostInputSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only'),
    title: z.string().trim().min(5).max(200),
    excerpt: z.string().trim().min(10).max(300),
    contentHtml: z.string().trim().min(20),
    coverImageKey: z.string().nullable().optional(),
    authorName: z.string().trim().min(2).max(120),
    status: z.enum(['draft', 'published']),
    tags: z.array(z.string().trim().max(40)).max(20).default([]),
    // Same fix as productInputSchema.seo — see comment above it. The
    // blog_posts table also defaults seo_title/seo_meta_description to
    // '', so requiring them here with no fallback blocked saves for no
    // real reason.
    seo: seoInputSchema,
  })
  .transform((data) => ({
    ...data,
    seo: {
      ...data.seo,
      title: data.seo.title || data.title.slice(0, 70),
      metaDescription: data.seo.metaDescription || data.excerpt.slice(0, 160),
      canonicalPath: data.seo.canonicalPath || `/blog/${data.slug}`,
    },
  }));

export const faqInputSchema = z.object({
  question: z.string().trim().min(5).max(300),
  answer: z.string().trim().min(5).max(3000),
  category: z.string().trim().min(2).max(80),
  sortOrder: z.number().int().min(0).default(0),
});

export const userInviteSchema = z.object({
  email: z.string().trim().email(),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(['owner', 'admin', 'editor', 'support']),
});

export const csvImportRowSchema = z.object({
  slug: z.string().trim().toLowerCase(),
  name: z.string().trim().min(2),
  shortDescription: z.string().trim().default(''),
  priceMinor: z.coerce.number().int().min(0),
  stockQuantity: z.coerce.number().int().min(0).default(0),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
});
