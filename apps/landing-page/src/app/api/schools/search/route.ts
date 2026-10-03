import { NextResponse } from "next/server";

import { MIN_SCHOOL_SEARCH_LENGTH } from "../../../../lib/campus";
import { searchSchools } from "../../../../lib/campus-data";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < MIN_SCHOOL_SEARCH_LENGTH) {
    return NextResponse.json({ schools: [] });
  }

  try {
    const schools = await searchSchools(query);

    return NextResponse.json({
      schools: schools.map(({ id, name, city, state }) => ({ id, name, city, state })),
    });
  } catch {
    return NextResponse.json({ error: "School search is unavailable." }, { status: 500 });
  }
}
