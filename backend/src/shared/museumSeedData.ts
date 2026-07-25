import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Shared between the mock server and the real seed script (§16), so both
 * read the same source files, resolve the same room-ID collision the same
 * way, and produce the same shape — the mock is only useful to frontend
 * developers if it matches what the real seed actually produces.
 */
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data');

export interface RawItem {
  id: string;
  name: string;
  short_description: string;
  detail_text: string;
  image_url: string | null;
}

export interface RawWaypoint {
  id: string;
  story_order: number;
  title: string;
  room_overview_text: string;
  room_narration_script: string;
  next_waypoint_id: string | null;
  items: RawItem[];
}

export interface MuseumSeedSpec {
  slug: string;
  name: string;
  waypointsFile: string;
  systemPromptFile: string;
  adminEmail: string;
}

// The two content sets already sitting in data/. Both use room_1..room_4,
// which is the exact ID collision docs/backend-implementation-plan.md §16.1
// resolves via legacyId.
export const MUSEUM_SEED_SPECS: MuseumSeedSpec[] = [
  {
    slug: 'adwa',
    name: 'Adwa Victory Memorial Museum',
    waypointsFile: 'waypoints_adwa.json',
    systemPromptFile: 'system_prompt_adwa.md',
    adminEmail: 'admin@adwamuseum.org',
  },
  {
    slug: 'louvre',
    name: 'Louvre Museum',
    waypointsFile: 'waypoints_louvre.json',
    systemPromptFile: 'system_prompt_louvre.md',
    adminEmail: 'admin@louvre.fr',
  },
];

// Only the persona text above "CONTEXT:" is kept — the embedded JSON below
// it duplicates the waypoint data and would go stale the moment an admin
// edits content through the API (§16.2).
export async function extractSystemPrompt(fileName: string): Promise<string> {
  const raw = await readFile(path.join(dataDir, fileName), 'utf-8');
  const [persona] = raw.split(/\nCONTEXT:/);
  return (persona ?? raw).trim();
}

export async function loadWaypoints(fileName: string): Promise<RawWaypoint[]> {
  const raw = await readFile(path.join(dataDir, fileName), 'utf-8');
  return JSON.parse(raw) as RawWaypoint[];
}
