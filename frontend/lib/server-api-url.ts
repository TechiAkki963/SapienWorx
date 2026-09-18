const configuredServerAPI =
  process.env.INTERNAL_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();

export const SERVER_API_URL = configuredServerAPI || "http://localhost:8080";
