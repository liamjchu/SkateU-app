import { IMAGES } from "./images";

export type ProductStatus = "live" | "coming_soon";

const SHOP_CATEGORY_LIST = [
  { id: "stickers", label: "Stickers", status: "coming_soon" },
  { id: "clothing", label: "Clothing", status: "coming_soon" },
  { id: "griptape", label: "Griptape", status: "coming_soon" },
  { id: "boards", label: "Boards", status: "coming_soon" },
] as const;

export type ShopCategoryId = (typeof SHOP_CATEGORY_LIST)[number]["id"];

export const SHOP_CATEGORIES: readonly {
  id: ShopCategoryId;
  label: string;
  status: ProductStatus;
}[] = SHOP_CATEGORY_LIST;

export type Product = {
  slug: string;
  name: string;
  category: ShopCategoryId;
  status: ProductStatus;
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
      "The SkateU logo as a sticker. Stick it on a laptop, board, or bottle.",
    image: IMAGES.sticker,
  },
];

export const STICKER_SLUG = "skateu-sticker";

export function productBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((product) => product.slug === slug);
}

export function productsInCategory(category: ShopCategoryId): Product[] {
  return PRODUCTS.filter((product) => product.category === category);
}

export function liveProductBySlug(slug: string): Product | null {
  const product = productBySlug(slug);

  if (!product || product.status !== "live") {
    return null;
  }

  return product;
}
