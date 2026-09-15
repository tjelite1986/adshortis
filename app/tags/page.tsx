import { redirect } from "next/navigation";
import ShortsTagCatalogue from "@/components/shorts-tag-catalogue";
import { getSession } from "@/lib/auth";
import { getShortTags } from "@/lib/shorts";

export const dynamic = "force-dynamic";

// Every hashtag in the library, as browsable categories. Each one opens the
// /tag/<tag> grid.
export default async function ShortsTagsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const tags = getShortTags(
    "18plus",
    Number(session.sub) || 0,
    session.role === "admin"
  );

  return (
    <div className="mx-auto max-w-5xl px-2 pb-24 pt-6">
      <h1 className="mb-1 px-1 text-lg font-semibold text-white">Categories</h1>
      <p className="mb-3 px-1 text-sm text-white/50">
        {tags.length} hashtag{tags.length === 1 ? "" : "s"} across the library.
      </p>
      <ShortsTagCatalogue tags={tags} />
    </div>
  );
}
