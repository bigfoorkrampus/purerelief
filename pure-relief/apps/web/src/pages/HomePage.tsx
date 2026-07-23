import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Snowflake, Sun, Moon, RefreshCcw, ArrowRight, Star } from 'lucide-react';
import heroImage from '@/assets/images/IMG_20260723_063248_copy_1112x941.png';
import { Seo, organizationJsonLd } from '@/components/Seo';
import { useProducts, useSiteConfig } from '@/hooks/use-storefront';
import { ProductCard } from '@/components/ProductCard';

const BENEFITS = [
  { icon: Snowflake, title: 'Cold Therapy', description: 'Freeze for up to 45 minutes of vasoconstrictive relief that calms throbbing migraine pain.' },
  { icon: Sun, title: 'Hot Therapy', description: 'Microwave-safe gel core relaxes tight muscles for tension headaches and sinus pressure.' },
  { icon: Moon, title: 'Blocks 100% Light', description: 'The V-notch design doubles as a sleep mask, easing migraine-related photophobia.' },
  { icon: RefreshCcw, title: 'Reusable, No Mess', description: 'Wipe clean and reuse indefinitely — no disposable gel packs, no leaks.' },
];

export function HomePage() {
  const { data: config } = useSiteConfig();
  const { data: productsData } = useProducts({ pageSize: 3, sort: 'newest' });

  return (
    <>
      <Seo
        title="Pure Relief — Reusable Migraine Relief Cap | Cold & Hot Therapy UK"
        description="Drug-free migraine and headache relief. The Pure Relief cap combines 360° cold therapy, hot therapy, and full light-blocking comfort — reusable, non-toxic, UK-made for everyday wellness."
        canonicalPath="/"
        jsonLd={organizationJsonLd({
          siteName: config?.settings.siteName ?? 'Pure Relief',
          contactEmail: config?.settings.contactEmail ?? 'hello@purerelief.co.uk',
          supportPhone: config?.settings.supportPhone ?? '+44 7440 056021',
        })}
      />

      {/* ---- Hero: the signature thermal-sweep motif embodies the product's core mechanism ---- */}
      <section className="relative overflow-hidden bg-surface-tint">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-thermal-gradient bg-[length:200%_100%] animate-thermal-sweep" />
        <div className="container-page grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-cold-500" /> Cold Therapy
              <span className="mx-1 text-brand-300">·</span>
              <span className="h-1.5 w-1.5 rounded-full bg-warm-500" /> Hot Therapy
            </span>
            <h1 className="mt-5 font-display text-[2.75rem] font-extrabold leading-[1.05] tracking-tightest text-ink sm:text-6xl">
              Relief that switches
              <br />
              <span className="bg-gradient-to-r from-cold-500 to-warm-500 bg-clip-text text-transparent">hot or cold</span> on demand.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
              The Pure Relief Migraine Cap delivers 360° cranial cold therapy or soothing heat — plus full light-blocking
              comfort — in one reusable, drug-free design.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/shop" className="btn-primary">
                Shop the Cap <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/about" className="btn-secondary">
                How it works
              </Link>
            </div>
            <div className="mt-10 flex items-center gap-6 text-sm text-ink-soft">
              <div className="flex items-center gap-1.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-warm-400 text-warm-400" />
                ))}
                <span className="ml-1 font-medium text-ink">Loved UK-wide</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
          >
            <div className="aspect-square w-full overflow-hidden rounded-4xl bg-white shadow-lifted">
  <img
    src={heroImage}
    alt="Pure Relief Migraine Cap"
    className="h-full w-full object-cover object-[30%_center]"
  />
</div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-2xl bg-white p-4 shadow-lifted sm:block">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cold-50 text-cold-600">
                  <Snowflake className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">45 min</p>
                  <p className="text-xs text-ink-soft">cold relief per freeze</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---- Benefits ---- */}
      <section className="py-20 lg:py-28">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-extrabold tracking-tighter text-ink sm:text-4xl">
              Built around how migraines actually happen
            </h2>
            <p className="mt-4 text-lg text-ink-soft">
              Every feature targets a specific physiological trigger — vascular, muscular, or sensory.
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className="card-surface p-7 transition-shadow hover:shadow-lifted">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <benefit.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-semibold text-ink">{benefit.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Featured products ---- */}
      <section className="bg-surface-tint py-20 lg:py-28">
        <div className="container-page">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-tighter text-ink sm:text-4xl">Shop Pure Relief</h2>
              <p className="mt-3 text-lg text-ink-soft">Single caps or combo packs — built to last.</p>
            </div>
            <Link to="/shop" className="hidden items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 sm:flex">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {productsData?.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ---- Trust / CTA ---- */}
      <section className="py-20 lg:py-28">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-4xl bg-ink px-8 py-16 text-center sm:px-16">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-600/30 via-transparent to-cold-500/20" />
            <div className="relative">
              <h2 className="font-display text-3xl font-extrabold tracking-tighter text-white sm:text-4xl">
                Break the cycle of rebound headaches
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">
                A drug-free option that fits into your self-care routine — no dependency, no side effects.
              </p>
              <Link to="/shop" className="btn-primary mt-8 inline-flex bg-white text-ink hover:bg-white/90 hover:text-ink">
                Shop Now <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
