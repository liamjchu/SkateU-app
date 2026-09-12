import { NextResponse } from "next/server";

import {
  checkoutSlugFromFormData,
  createShopCheckoutUrl,
} from "../../../lib/shop-checkout";

export const dynamic = "force-dynamic";

function invalidProductResponse(): NextResponse {
  return NextResponse.json(
    { error: "This product is not available." },
    { status: 400 }
  );
}

function failureResponse(): NextResponse {
  return NextResponse.json(
    { error: "Unable to start checkout." },
    { status: 500 }
  );
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Method not allowed." },
    { status: 405, headers: { Allow: "POST" } }
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const slug = checkoutSlugFromFormData(await request.formData());

    if (!slug) {
      return invalidProductResponse();
    }

    const checkoutUrl = await createShopCheckoutUrl(slug);

    if (!checkoutUrl) {
      return invalidProductResponse();
    }

    return NextResponse.redirect(checkoutUrl, 303);
  } catch {
    return failureResponse();
  }
}
