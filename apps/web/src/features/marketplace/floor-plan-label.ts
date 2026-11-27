export function floorPlanLabel(floor?: number) {
  if (floor === undefined) return "Default floor plan";
  if (floor < 0) return `Basement B${-floor}`;
  if (floor === 0) return "Ground floor";
  const lastTwo = floor % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : ({1: "st", 2: "nd", 3: "rd"}[floor % 10] ?? "th");
  return `${floor}${suffix} floor`;
}
