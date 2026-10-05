export type Category = "Graphic Design" | "Web" | "Apps" | "Video" | "Digital";
export const CATEGORIES: ("All" | Category)[] = ["All", "Graphic Design", "Web", "Apps", "Video", "Digital"];
export type ConceptKind = "identity" | "poster" | "browser" | "landing" | "phone" | "reel" | "system";

export interface Project {
  id: string; title: string; category: Category; description: string; kind: ConceptKind;
  /** All entries are MYRONIX concepts unless this is explicitly set to "client". */
  type: "concept" | "client";
  detail: string;
}

// To add real work later: add an entry here with type: "client".
export const PROJECTS: Project[] = [
  { id: "identity-system", title: "Brand Identity System", category: "Graphic Design", kind: "identity", type: "concept",
    description: "A logo, colour and type system shown across profile, poster and packaging.",
    detail: "A self-initiated exploration of how one identity holds together on very different surfaces." },
  { id: "campaign-posters", title: "Campaign Poster Series", category: "Graphic Design", kind: "poster", type: "concept",
    description: "A poster series built from one grid and a restrained palette.",
    detail: "Explores hierarchy and rhythm across a set of related poster layouts." },
  { id: "studio-site", title: "Business Website", category: "Web", kind: "browser", type: "concept",
    description: "A multi-section company website layout with clear service paths.",
    detail: "Explores navigation, content hierarchy and performance-first layout for a service business." },
  { id: "launch-page", title: "Product Landing Page", category: "Web", kind: "landing", type: "concept",
    description: "A single focused page with one clear action.",
    detail: "Explores a one-goal page structure with minimal friction." },
  { id: "mobile-app", title: "Mobile App Interface", category: "Apps", kind: "phone", type: "concept",
    description: "Core screens for a task-focused mobile application.",
    detail: "Explores onboarding, a primary task flow and a simple settings area." },
  { id: "reel-edit", title: "Short-form Reel Concept", category: "Video", kind: "reel", type: "concept",
    description: "A vertical video structure planned frame by frame.",
    detail: "Explores pacing, text placement and sound-led cuts for 9:16 video." },
  { id: "content-system", title: "Digital Content System", category: "Digital", kind: "system", type: "concept",
    description: "A reusable set of templates for consistent social content.",
    detail: "Explores modular layouts a small team can reuse without losing consistency." },
];
