import { IMAGES } from "./images";

export const SHOP_CATEGORIES = [
  { id: "stickers", label: "Stickers", status: "live" },
  { id: "clothing", label: "Clothing", status: "coming_soon" },
  { id: "griptape", label: "Griptape", status: "coming_soon" },
  { id: "boards", label: "Boards", status: "coming_soon" },
] as const;

export type ShopCategoryId = (typeof SHOP_CATEGORIES)[number]["id"];

export type Product = {
  slug: string;
  name: string;
  category: ShopCategoryId;
  status: "coming_soon";
  description: string;
  image: typeof IMAGES.sticker;
};

export const PRODUCTS: Product[] = [
  {
    slug: "skateu-sticker",
    name: "SkateU Sticker",
    category: "stickers",
    status: "coming_soon",
    description:
      "The SkateU logo as a sticker. Stick it on a laptop, board, or bottle. Checkout is coming soon.",
    image: IMAGES.sticker,
  },
];

export function productBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((product) => product.slug === slug);
}

export function productsInCategory(category: ShopCategoryId): Product[] {
  return PRODUCTS.filter((product) => product.category === category);
}
