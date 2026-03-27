// src/lib/app-registry.ts

export interface AppTab {
  id: string;
  label: string;
}

export const APP_TABS: AppTab[] = [
  { id: 'all', label: 'All' },
  { id: 'evidence-engine', label: 'Evidence Engine' },
  { id: 'opsample', label: 'OPSAmple' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'showcase', label: 'Showcase' },
  { id: 'neuroscribe-extension', label: 'NeuroScribe Ext' },
  { id: 'sevaro-scribe', label: 'Scribe' },
  { id: 'repgenius', label: 'RepGenius' },
  { id: 'sevaro-monitor', label: 'Monitor' },
  { id: 'sevaro-hub', label: 'Hub' },
];

/** App tabs excluding the "all" entry — for dropdowns and filters that need real app IDs */
export const APP_LIST = APP_TABS.filter((t) => t.id !== 'all');

/** Look up display label for an appId. Returns the raw appId if not found. */
export function getAppLabel(appId: string): string {
  return APP_TABS.find((t) => t.id === appId)?.label ?? appId;
}
