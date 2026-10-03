import { NextResponse } from "next/server";

import { getAllSpots } from "../../../lib/campus-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const spots = await getAllSpots();

    return NextResponse.json({ spots });
  } catch {
    return NextResponse.json({ error: "Spots are unavailable." }, { status: 500 });
  }
}
