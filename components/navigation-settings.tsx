"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  BOOLEAN_SETTINGS,
  BOOLEAN_SETTING_KEYS,
  type BooleanSettingKey,
} from "@/lib/app-settings-keys";

type Flags = Record<BooleanSettingKey, boolean>;

/**
 * Admin toggles for the ways this app points at its neighbours: the two links
 * in the menu sheet, and the handover row in a clip's 3-dot menu.
 *
 * Running this app on its own, none of them lead anywhere the reader wants to
 * go — so they can be turned off here instead of by unsetting an environment
 * variable, which would take a container restart and, in the case of the main
 * library, would take the avatar proxy and the handover down with it.
 */
export default function NavigationSettings() {
  const router = useRouter();
  const [flags, setFlags] = useState<Flags | null>(null);
  const [configured, setConfigured] = useState<Partial<Flags>>({});
  const [busy, setBusy] = useState<BooleanSettingKey | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/settings/navigation")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.settings) {
          setFlags(d.settings);
          setConfigured(d.configured ?? {});
        } else {
          setMsg(d?.error || "Could not load the settings.");
        }
      })
      .catch(() => {
        if (!cancelled) setMsg("Could not load the settings.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (key: BooleanSettingKey, value: boolean) => {
    setBusy(key);
    setMsg(null);
    // Optimistic: the switch has to move under the finger, and a failure puts
    // it back with the server's own answer rather than a guess.
    setFlags((f) => (f ? { ...f, [key]: value } : f));
    try {
      const res = await fetch("/api/admin/settings/navigation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d?.settings) {
        setFlags(d.settings);
        // The menu is drawn in the root layout from the server, so the bar only
        // picks this up once that tree is re-rendered.
        router.refresh();
      } else {
        setFlags((f) => (f ? { ...f, [key]: !value } : f));
        setMsg(d?.error || "Could not save.");
      }
    } catch {
      setFlags((f) => (f ? { ...f, [key]: !value } : f));
      setMsg("Could not save.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <h2 className="text-base font-medium">Ways out of this app</h2>
      <p className="mb-4 mt-1 text-sm text-white/50">
        The menu rows that lead somewhere else, and the row that hands a clip to
        the main library. Turn one off and it is gone for everyone.
      </p>

      {!flags && !msg && (
        <p className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 size={14} className="animate-spin" />
          Loading…
        </p>
      )}

      {flags && (
        <div className="divide-y divide-white/10">
          {BOOLEAN_SETTING_KEYS.map((key) => {
            const meta = BOOLEAN_SETTINGS[key];
            const unavailable = configured[key] === false;
            const on = flags[key];
            return (
              <div
                key={key}
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{meta.label}</p>
                  <p className="mt-0.5 text-xs text-white/50">
                    {meta.description}
                  </p>
                  {unavailable && (
                    <p className="mt-1 text-xs text-amber-300/70">
                      Nothing is configured for this on the server, so it is
                      unavailable either way.
                    </p>
                  )}
                </div>
                <button
                  role="switch"
                  aria-checked={on}
                  aria-label={meta.label}
                  disabled={busy === key}
                  onClick={() => toggle(key, !on)}
                  className={
                    "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 " +
                    (on ? "bg-rose-500" : "bg-white/15")
                  }
                >
                  <span
                    className={
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all " +
                      (on ? "left-[1.375rem]" : "left-0.5")
                    }
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {msg && <p className="mt-3 text-xs text-rose-300/80">{msg}</p>}
    </section>
  );
}
