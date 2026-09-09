import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { SiteShell } from "../../_components/site-shell";
import { PRODUCTS, productBySlug } from "../../../constants/products";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = productBySlug(slug);

  if (!product) {
    return {
      title: "Shop — SkateU",
    };
  }

  return {
    title: `${product.name} — SkateU`,
    description: product.description,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = productBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
    <SiteShell>
      <main id="main-content" tabIndex={-1} className="relative z-10 focus:outline-none">
        <section
          aria-labelledby="product-title"
          className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-[920px] flex-col items-center px-5 py-12 sm:min-h-[calc(100vh-6rem)] sm:py-16"
        >
          <div className="flex w-full flex-col rounded-2xl border border-border-soft bg-field p-6 sm:p-10">
            <a
              href="/shop"
              className="self-start text-sm font-bold text-ink underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Back to shop
            </a>

            <div className="mt-6 grid gap-8 sm:grid-cols-2 sm:items-center">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-brand">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  priority
                  sizes="(min-width: 640px) 400px, 100vw"
                  className="object-contain p-6 sm:p-8"
                />
              </div>

              <div className="text-left">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted">
                  Coming soon
                </p>
                <h1
                  id="product-title"
                  className="mt-3 font-black uppercase tracking-[-0.04em] text-[clamp(1.75rem,6vw,3rem)] leading-[0.95] text-ink"
                >
                  {product.name}
                </h1>
                <p className="mt-5 text-base leading-7 text-muted">{product.description}</p>
                <button
                  type="button"
                  disabled
                  className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-actionDisabled px-6 text-sm font-bold text-muted"
                >
                  Checkout coming soon
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
