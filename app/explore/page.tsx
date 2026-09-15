import ShortsGrid from "@/components/shorts-grid";
import ShortsCategoryChips from "@/components/shorts-category-chips";
import { getSession } from "@/lib/auth";
import { parseCategory } from "@/lib/shorts-categories";

export const dynamic = "force-dynamic";

// Browse the whole library as a grid, filterable by genre; tapping a tile opens
// the immersive feed there. Admins get a per-tile selector to sort the clips
// that arrive uncategorized.
export default async function ExplorePage(props: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await getSession();
  const category = parseCategory(searchParams?.cat);
  const query: Record<string, string> = { channel: "18plus" };
  if (category) query.category = category;

  return (
    <div className="mx-auto max-w-5xl px-2 pb-24 pt-6">
      <div className="mb-3 px-1">
        <ShortsCategoryChips />
      </div>
      <ShortsGrid
        key={category ?? "all"}
        query={query}
        // Carry the filter into the feed, so the clips above and below the one
        // you tapped are the ones the grid was showing.
        hrefPrefix={category ? `/?cat=${category}&focus=` : "/?focus="}
        empty="Nothing to explore yet."
        categoryEditable={session?.role === "admin"}
        restoreKey={`explore:${category ?? "all"}`}
        lengthFilter
        isAdmin={session?.role === "admin"}
      />
    </div>
  );
}
