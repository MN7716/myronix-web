export interface Service {
  id: string;
  title: string;
  summary: string;
  detail: string;
  /** Specific offerings. Only services with a supplied list have items. */
  items: string[];
}

export const SERVICES: Service[] = [
  { id: "graphic-design", title: "Graphic Design", summary: "Logos, social visuals, posters and packaging with a clear point of view.",
    detail: "Visual communication that makes a brand recognisable across every surface it appears on, from a profile picture to a printed box.",
    items: ["Logo Design", "Instagram Post", "Instagram Story", "Thumbnail Design", "Banner Design", "Poster Design", "Packaging Design"] },
  { id: "website-development", title: "Website Development", summary: "Fast, responsive websites built to be used, not just looked at.",
    detail: "Websites engineered for speed, accessibility and search, from a single focused page to a full online store.",
    items: ["Landing Page", "Business Website", "Portfolio Website", "E-commerce Website"] },
  { id: "app-development", title: "App Development", summary: "Mobile and business applications built around real workflows.",
    detail: "Applications designed around how people actually use them, with a maintainable foundation.",
    items: ["Mobile App Development", "Business App Development"] },
  { id: "video-editing", title: "Video Editing", summary: "Short-form and promotional video cut for attention and clarity.",
    detail: "Editing that respects the platform it is made for, with pacing, sound and structure planned together.",
    items: ["Instagram Reel Editing", "Promotional Video", "Short-form Video Editing"] },
  { id: "digital-media", title: "Digital Media", summary: "Content and visual systems for a consistent online presence.",
    detail: "Digital media work that keeps a brand consistent across its online channels.", items: [] },
  { id: "programming", title: "Programming", summary: "Clean, maintainable code for custom digital needs.",
    detail: "Custom programming with a focus on readable, maintainable code and sensible architecture.", items: [] },
  { id: "ai", title: "AI", summary: "Practical use of AI inside creative and technical work.",
    detail: "Applying AI where it genuinely helps, while keeping people in charge of decisions that matter.", items: [] },
  { id: "technology", title: "Technology", summary: "Technology choices that fit the project and its future.",
    detail: "Guidance and implementation across the technology a project depends on.", items: [] },
  { id: "innovation", title: "Innovation", summary: "Exploring new ideas and turning them into working digital products.",
    detail: "A space for new ideas, tested and shaped into something that works.", items: [] },
];
