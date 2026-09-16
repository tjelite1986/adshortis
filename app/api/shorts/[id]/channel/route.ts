import { NextResponse } from "next/server";
import { getSession, sameOrigin } from "@/lib/auth";
import { getShort } from "@/lib/shorts";
import { handOverToMain, handoverConfigured } from "@/lib/handover";
import { getBooleanSetting } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

/**
 * Hand a clip over to the main shorts library (the uploader of their own clip,
 * or an admin).
 *
 * This used to be a channel move inside one app. The main library lives in its
 * own app now, so the clip is dropped into that app's import folder and picked
 * up by its own timer — see lib/handover.ts. The route keeps its name and its
 * `{ channel }` body so the button that calls it did not have to learn a new
 * shape, but there is only one direction: nothing comes back the other way
 * except through that app's own tools.
 */
export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const short = getShort(Number(params.id));
  if (!short) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const isOwner = short.uploader_id === Number(session.sub);
  if (session.role !== "admin" && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.channel !== "main") {
    return NextResponse.json(
      { error: "The only move from here is to the main library." },
      { status: 400 }
    );
  }
  // Turned off in Settings > Links the action is gone from the menu; the route
  // says the same thing, so a hidden button is not a route anyone can still
  // reach by hand.
  if (!getBooleanSetting("show_handover_action")) {
    return NextResponse.json(
      { error: "Handover is turned off for this library." },
      { status: 403 }
    );
  }
  if (!handoverConfigured()) {
    return NextResponse.json(
      { error: "The main library is not reachable from here." },
      { status: 503 }
    );
  }

  try {
    const result = handOverToMain(short.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    // The clip is on the other side but not yet visible there: that app's
    // importer runs every 5 minutes and its transcoder every 3. Say so, rather
    // than let it read as a clip that vanished.
    return NextResponse.json({
      ok: true,
      channel: "main",
      message:
        "Handed over — it appears in the main library within a few minutes.",
    });
  } catch (err) {
    console.error("[shorts] handover to the main library failed:", err);
    return NextResponse.json({ error: "Handover failed." }, { status: 500 });
  }
}
