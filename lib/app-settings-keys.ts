/**
 * The install-wide preference keys and their labels.
 *
 * Separate from lib/app-settings.ts on purpose: that module opens the database,
 * and the Settings panel that renders these labels is a client component. Only
 * the names travel to the browser.
 */
export const BOOLEAN_SETTINGS = {
  show_main_library_link: {
    label: "Main library",
    description:
      "The menu row that opens the main shorts library. Hiding it does not stop a clip being handed over.",
    default: true,
  },
  show_elite_link: {
    label: "Back to Elite",
    description:
      "The menu row back to the site the login comes from. Hiding it does not affect signing in.",
    default: true,
  },
  show_handover_action: {
    label: "Hand over to the main library",
    description:
      "The row in a clip's 3-dot menu that moves it to the main library. Hiding it leaves clips already on their way alone.",
    default: true,
  },
} as const;

export type BooleanSettingKey = keyof typeof BOOLEAN_SETTINGS;

export const BOOLEAN_SETTING_KEYS = Object.keys(
  BOOLEAN_SETTINGS
) as BooleanSettingKey[];

export function isBooleanSettingKey(k: string): k is BooleanSettingKey {
  return (BOOLEAN_SETTING_KEYS as string[]).includes(k);
}
