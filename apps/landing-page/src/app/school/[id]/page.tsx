import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CampusExplorer } from "../../_components/campus-explorer";
import { SiteShell } from "../../_components/site-shell";
import { isSchoolId, readSpotId, showsAllSpots } from "../../../lib/campus";
import { getSchool, getSchoolSpots } from "../../../lib/campus-data";

type SchoolPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ spot?: string | string[]; spots?: string | string[] }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: SchoolPageProps): Promise<Metadata> {
  const { id } = await params;

  if (!isSchoolId(id)) {
    return { title: "School — SkateU" };
  }

  try {
    const school = await getSchool(id);

    if (!school) {
      return { title: "School — SkateU" };
    }

    return {
      title: `${school.name} skate spots — SkateU`,
      description: `Skate spots at ${school.name} in ${school.city}, ${school.state}.`,
    };
  } catch {
    return { title: "School — SkateU" };
  }
}

export default async function SchoolPage({ params, searchParams }: SchoolPageProps) {
  const { id } = await params;

  if (!isSchoolId(id)) {
    notFound();
  }

  let school;

  try {
    school = await getSchool(id);
  } catch {
    return <CampusUnavailable />;
  }

  if (!school) {
    notFound();
  }

  let spots;

  try {
    spots = await getSchoolSpots(id);
  } catch {
    return <CampusUnavailable />;
  }

  const { spot, spots: spotsParam } = await searchParams;

  return (
    <SiteShell variant="campus">
      <main id="main-content" tabIndex={-1} className="relative min-h-0 flex-1 focus:outline-none">
        <CampusExplorer
          school={school}
          spots={spots}
          initialSpotId={readSpotId(spot)}
          startWithAllSpots={showsAllSpots(spotsParam)}
        />
      </main>
    </SiteShell>
  );
}

function CampusUnavailable() {
  return (
    <SiteShell variant="campus">
      <main id="main-content" tabIndex={-1} className="relative z-10 px-5 py-16 focus:outline-none">
        <h1 className="text-2xl font-black text-ink">This campus didn’t load.</h1>
        <p className="mt-3 text-base text-muted">Check your connection and try the page again.</p>
        <a href="/" className="mt-6 inline-flex min-h-11 items-center font-bold text-brand">
          Back to search
        </a>
      </main>
    </SiteShell>
  );
}
