import { redirect } from "next/navigation";

import { SchoolSearch } from "../_components/school-search";
import { SiteShell } from "../_components/site-shell";
import { getPopularSchool } from "../../lib/campus-data";
import type { CampusSchool } from "../../lib/campus";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  let school: CampusSchool | null = null;

  try {
    school = await getPopularSchool();
  } catch {
    return <MapUnavailable />;
  }

  if (!school) {
    return <MapUnavailable />;
  }

  redirect(`/school/${school.id}?spots=all`);
}

function MapUnavailable() {
  return (
    <SiteShell>
      <main id="main-content" tabIndex={-1} className="relative z-10 focus:outline-none">
        <section className="mx-auto flex w-full max-w-xl flex-col px-5 py-10 sm:py-16">
          <h1 className="text-2xl font-black text-ink">Map isn’t available right now.</h1>
          <p className="mt-3 text-base leading-7 text-muted">Search for a school instead.</p>
          <div className="mt-6">
            <SchoolSearch />
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
