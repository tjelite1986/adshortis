import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseCategory } from "@/lib/shorts-categories";

export const dynamic = "force-dynamic";

// Bounds one request; the grid only ever sends the tiles it has loaded.
const MAX_IDS = 1000;

// Set the 18+ category bucket of many clips at once — the grid's multi-select
// counterpart of /api/shorts/[id]/category. Admin only, like the single route.
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const category = parseCategory(body?.category);
  if (!category) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }

  const ids: unknown = body?.ids;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_IDS ||
    !ids.every((id) => Number.isInteger(id) && id > 0)
  ) {
    return NextResponse.json(
      { error: `ids must be 1-${MAX_IDS} positive integers.` },
      { status: 400 }
    );
  }

  const update = db.prepare("UPDATE shorts SET category = ? WHERE id = ?");
  const updated = db.transaction((list: number[]) => {
    let n = 0;
    for (const id of new Set(list)) n += update.run(category, id).changes;
    return n;
  })(ids as number[]);

  return NextResponse.json({ ok: true, category, updated });
}
