import type { Metadata } from "next";

import { ShopProductCard } from "../_components/shop-product-card";
import { SiteShell } from "../_components/site-shell";
import { productsInCategory, SHOP_CATEGORIES } from "../../constants/products";

export const metadata: Metadata = {
  title: "Shop — SkateU",
  description: "SkateU stickers and merch. Checkout is coming soon.",
};

export default function ShopPage() {
  const stickerProducts = productsInCategory("stickers");

  return (
    <SiteShell>
      <main id="main-content" tabIndex={-1} className="relative z-10 focus:outline-none">
        <section
          aria-labelledby="shop-title"
          className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-[920px] flex-col items-center px-5 py-12 sm:min-h-[calc(100vh-6rem)] sm:py-16"
        >
          <div className="flex w-full flex-col items-center rounded-2xl border border-border-soft bg-field p-6 text-center sm:p-10">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-muted sm:tracking-[0.26em]">
              Merch
            </p>
            <h1
              id="shop-title"
              className="font-black uppercase tracking-[-0.04em] text-[clamp(2.25rem,10vw,5.75rem)] leading-[0.88] text-ink"
            >
              Shop
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-7 text-muted sm:mt-7 sm:text-lg">
              Stickers first. Clothing, griptape, and boards are next. Checkout is not open yet.
            </p>

            <nav
              className="mt-8 flex flex-wrap items-center justify-center gap-2"
              aria-label="Shop categories"
            >
              {SHOP_CATEGORIES.map((category) => {
                if (category.status === "live") {
                  return (
                    <span
                      key={category.id}
                      aria-current="page"
                      className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-brand"
                    >
                      {category.label}
                    </span>
                  );
                }

                return (
                  <button
                    key={category.id}
                    type="button"
                    disabled
                    aria-label={`${category.label}, coming soon`}
                    className="inline-flex items-center gap-2 rounded-full bg-surface-soft px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted"
                  >
                    {category.label}
                    <span className="font-bold normal-case tracking-normal">Coming soon</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-8 w-full max-w-[32rem]">
              {stickerProducts.map((product) => (
                <ShopProductCard key={product.slug} product={product} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
