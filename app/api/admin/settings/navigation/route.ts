import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getBooleanSettings,
  isBooleanSettingKey,
  setBooleanSetting,
} from "@/lib/app-settings";

export const dynamic = "force-dynamic";

// Which ways out of this app the UI offers: the two menu links, and the
// handover row in a clip's menu. Admin only — it is one decision for everyone
// who opens the app, not a per-account preference.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // The toggles are meaningless when the address (or the drop folder) is unset,
  // so the panel is told what this deployment could offer at all.
  return NextResponse.json({
    settings: getBooleanSettings(),
    configured: {
      show_main_library_link: Boolean(process.env.MAIN_APP_URL),
      show_elite_link: Boolean(process.env.ELITE_APP_URL),
      show_handover_action: Boolean(process.env.HANDOVER_MAIN_DIR),
    },
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const key = String(body?.key ?? "");
  if (!isBooleanSettingKey(key)) {
    return NextResponse.json({ error: "Unknown setting." }, { status: 400 });
  }
  if (typeof body?.value !== "boolean") {
    return NextResponse.json(
      { error: "value must be a boolean." },
      { status: 400 }
    );
  }
  setBooleanSetting(key, body.value);
  return NextResponse.json({ ok: true, settings: getBooleanSettings() });
}
