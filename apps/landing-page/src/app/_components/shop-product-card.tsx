import Image from "next/image";

import type { Product } from "../../constants/products";

export function ShopProductCard({ product }: { product: Product }) {
  return (
    <article className="w-full overflow-hidden rounded-2xl border border-border-soft bg-surface text-left">
      <a
        href={`/shop/${product.slug}`}
        className="flex flex-col rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-field"
      >
        <div className="relative aspect-[4/3] bg-brand">
          <Image
            src={product.image}
            alt=""
            fill
            sizes="(min-width: 640px) 520px, 100vw"
            className="object-contain p-6 sm:p-8"
          />
        </div>
        <div className="flex flex-col gap-2 p-5 sm:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted">
            Coming soon
          </p>
          <h2 className="text-2xl font-black uppercase tracking-[-0.03em] text-ink">
            {product.name}
          </h2>
        </div>
      </a>
    </article>
  );
}
