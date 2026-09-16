import { db } from "./db";
import {
  BOOLEAN_SETTINGS,
  BOOLEAN_SETTING_KEYS,
  isBooleanSettingKey,
  type BooleanSettingKey,
} from "./app-settings-keys";

/**
 * Install-wide preferences, kept in `app_settings` rather than in the
 * environment.
 *
 * The two outbound links in the menu — the main shorts library and the site the
 * login comes from — are addresses, and an address is a deployment fact that
 * belongs in the environment. Whether they are *shown* is not: someone running
 * this app on its own has no use for either, and changing that should not mean
 * editing a compose file and restarting the container. So the address stays in
 * the env, where the handover still needs it, and the decision to show the link
 * lives here, where the Settings page can change it.
 *
 * A key that has never been set is absent, and the default below — "shown" —
 * stands, so an existing install behaves exactly as it did.
 */

export { BOOLEAN_SETTINGS, BOOLEAN_SETTING_KEYS, isBooleanSettingKey };
export type { BooleanSettingKey };

export function getBooleanSetting(key: BooleanSettingKey): boolean {
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  if (!row) return BOOLEAN_SETTINGS[key].default;
  return row.value === "1";
}

export function setBooleanSetting(
  key: BooleanSettingKey,
  value: boolean
): void {
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                    updated_at = excluded.updated_at`
  ).run(key, value ? "1" : "0");
}

export function getBooleanSettings(): Record<BooleanSettingKey, boolean> {
  return Object.fromEntries(
    BOOLEAN_SETTING_KEYS.map((k) => [k, getBooleanSetting(k)])
  ) as Record<BooleanSettingKey, boolean>;
}
