import { LANDING_SCIENTISTS } from "./content";

export const LANDING_HERO_IMAGE_SOURCES = [
  "/assets/landing/base.png",
  "/assets/landing/bookcase_3.png",
  "/assets/landing/bookcase_2.png",
  "/assets/landing/bookcase_1.png",
  "/assets/landing/table.png",
  "/assets/landing/drawer.png",
  "/assets/landing/objects.png",
] as const;

export function getScientistIdleExpressionSrc(scientistId: string) {
  return `/assets/characters/${scientistId}/exp/idle.png`;
}

export function getLandingIntroPreloadSources() {
  return [
    ...LANDING_HERO_IMAGE_SOURCES,
    ...LANDING_SCIENTISTS.map((scientist) => getScientistIdleExpressionSrc(scientist.id)),
  ];
}
