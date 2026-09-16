"use client";

import { createContext, useContext } from "react";
import {
  BOOLEAN_SETTINGS,
  type BooleanSettingKey,
} from "@/lib/app-settings-keys";

type Flags = Record<BooleanSettingKey, boolean>;

const defaults = Object.fromEntries(
  Object.entries(BOOLEAN_SETTINGS).map(([k, v]) => [k, v.default])
) as Flags;

const AppSettingsContext = createContext<Flags>(defaults);

/**
 * The install-wide flags, resolved once in the root layout and handed to the
 * client tree.
 *
 * A context rather than a prop: the one component that asks (a clip's 3-dot
 * menu) sits five levels below the four pages that can render a feed, and
 * threading a boolean through all of them would put the same argument in five
 * signatures that have nothing else to do with it.
 */
export function AppSettingsProvider({
  value,
  children,
}: {
  value: Flags;
  children: React.ReactNode;
}) {
  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSetting(key: BooleanSettingKey): boolean {
  return useContext(AppSettingsContext)[key];
}
