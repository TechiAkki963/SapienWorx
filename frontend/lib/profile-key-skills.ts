// Older profiles retain comma-separated text; new section saves use arrays.
// Normalize for presentation only so unrelated saves preserve the original data.
export function profileKeySkills(value: unknown): string[] {
  const items = typeof value === "string" ? value.split(",") : value;
  if (!Array.isArray(items)) return [];
  return [
    ...new Set(
      items
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
