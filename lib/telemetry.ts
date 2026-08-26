export type SapienworxTelemetryEvent = {
  name: string;
  occurredAt: string;
  properties: Record<string, boolean | number | string>;
};

declare global {
  interface Window {
    dataLayer?: Array<Record<string, boolean | number | string>>;
  }
}

/**
 * Emits privacy-safe product events. Candidate names, identifiers, email
 * addresses, CV text, and message content must never be included here.
 */
export function trackProductEvent(name: string, properties: Record<string, boolean | number | string> = {}) {
  if (typeof window === "undefined") return;
  const event: SapienworxTelemetryEvent = { name, occurredAt: new Date().toISOString(), properties };
  window.dispatchEvent(new CustomEvent<SapienworxTelemetryEvent>("sapienworx:analytics", { detail: event }));
  window.dataLayer ??= [];
  window.dataLayer.push({ event: name, ...properties });
}
