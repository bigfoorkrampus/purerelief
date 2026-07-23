import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, MessageCircle, ShoppingBag, Menu, X } from 'lucide-react';
import logo from '@/assets/images/logo.png';
import { useCartItemCount } from '@/store/cart-store';
import { useSiteConfig } from '@/hooks/use-storefront';

const FALLBACK_NAV = [
  { id: '1', label: 'Home', href: '/', sortOrder: 0 },
  { id: '2', label: 'Shop', href: '/shop', sortOrder: 1 },
  { id: '3', label: 'About', href: '/about', sortOrder: 2 },
  { id: '4', label: 'Blog', href: '/blog', sortOrder: 3 },
  { id: '5', label: 'FAQ', href: '/faq', sortOrder: 4 },
  { id: '6', label: 'Contact', href: '/contact', sortOrder: 5 },
];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const cartCount = useCartItemCount();
  const { data: config } = useSiteConfig();

  const navLinks = config?.navLinks?.length ? config.navLinks : FALLBACK_NAV;
  const phone = config?.settings.supportPhone ?? '+44 7440 056021';
  const whatsapp = config?.settings.supportWhatsApp ?? '+44 7440 056021';
  const banner = config?.banner;

  return (
    <>
      {banner?.enabled && (
        <div
          className="w-full py-2 text-center text-[13px] font-medium"
          style={{ backgroundColor: banner.backgroundColor, color: banner.textColor }}
        >
          {banner.linkHref ? (
            <Link to={banner.linkHref} className="hover:underline">
              {banner.message}
            </Link>
          ) : (
            banner.message
          )}
        </div>
      )}

      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-lg">
        <div className="container-page flex h-[72px] items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 shrink-0" aria-label="Pure Relief home">
  <img
    src={logo}
    alt="Pure Relief"
    className="h-16 w-auto"
  />
  <span className="font-display text-[19px] font-extrabold tracking-tighter text-ink">
    Pure<span className="text-brand-600">.</span>Relief
  </span>
</Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {navLinks.map((link) => (
              <NavLink
                key={link.id}
                to={link.href}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-[14.5px] font-medium transition-colors ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-slate-50 hover:text-ink'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={`tel:${phone.replace(/\s/g, '')}`}
              className="hidden items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand-300 hover:bg-brand-50 sm:flex"
              aria-label={`Call us at ${phone}`}
            >
              <Phone className="h-4 w-4" />
              <span className="hidden xl:inline">{phone}</span>
            </a>
            <a
              href={`https://wa.me/${whatsapp.replace(/[^\d]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full bg-success-50 px-3.5 py-2.5 text-sm font-semibold text-success-500 transition-colors hover:bg-success-500 hover:text-white"
              aria-label="Message us on WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
            </a>

            <Link
              to="/cart"
              className="relative flex items-center justify-center rounded-full p-2.5 text-ink transition-colors hover:bg-slate-100"
              aria-label={`Cart, ${cartCount} items`}
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex items-center justify-center rounded-full p-2.5 text-ink hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-white lg:hidden"
          >
            <div className="container-page flex h-[72px] items-center justify-between border-b border-slate-100">
              <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
  <img
    src={logo}
    alt="Pure Relief"
    className="h-10 w-auto"
  />
  <span className="font-display text-[19px] font-extrabold tracking-tighter">
    Pure.Relief
  </span>
</Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center rounded-full p-2.5 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="container-page flex flex-col gap-1 py-6" aria-label="Mobile navigation">
              {navLinks.map((link) => (
                <NavLink
                  key={link.id}
                  to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `rounded-2xl px-5 py-4 text-lg font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink'}`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <a href={`tel:${phone.replace(/\s/g, '')}`} className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 px-5 py-4 text-lg font-semibold">
                <Phone className="h-5 w-5" /> {phone}
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


