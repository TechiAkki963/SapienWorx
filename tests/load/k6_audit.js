import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const WEB_URL = __ENV.AUDIT_WEB_URL || "http://127.0.0.1:3000";
const API_URL = __ENV.AUDIT_API_URL || "http://127.0.0.1:8080";
const AUTH = __ENV.AUDIT_CANDIDATE_TOKEN || "";

const searchLatency = new Trend("faceted_search_latency", true);
const searchFailures = new Rate("faceted_search_failures");

export const options = {
  scenarios: {
    landing_4k: {
      executor: "constant-vus",
      vus: 500,
      duration: "30s",
      exec: "landing",
    },
    faceted_search: {
      executor: "constant-arrival-rate",
      rate: 80,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 40,
      maxVUs: 200,
      exec: "search",
      startTime: "5s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{scenario:landing_4k}": ["p(95)<1000"],
    faceted_search_latency: ["p(95)<200"],
    faceted_search_failures: ["rate<0.01"],
  },
};

export function landing() {
  const response = http.get(`${WEB_URL}/`, { tags: { workload: "4k-landing" } });
  check(response, {
    "landing returns 200": (r) => r.status === 200,
    "landing has HTML": (r) => String(r.headers["Content-Type"] || "").includes("text/html"),
  });
  sleep(0.2);
}

export function search() {
  const params = {
    headers: AUTH ? { Authorization: `Bearer ${AUTH}` } : {},
    tags: { workload: "faceted-search" },
  };
  const url = `${API_URL}/api/v1/candidate/jobs?q=java&location=Mumbai&work_mode=hybrid&experience=3&page=1&limit=20`;
  const response = http.get(url, params);
  searchLatency.add(response.timings.duration);
  const ok = check(response, {
    "faceted search returns success": (r) => r.status >= 200 && r.status < 300,
    "faceted search under 200ms": (r) => r.timings.duration < 200,
  });
  searchFailures.add(!ok);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data.metrics, null, 2),
    "k6-audit-summary.json": JSON.stringify(data, null, 2),
  };
}
