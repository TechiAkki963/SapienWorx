import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const ACCESS_TOKEN = (__ENV.ACCESS_TOKEN || '').trim();
const CANDIDATE_TOKENS = (__ENV.CANDIDATE_TOKENS || '')
  .split(',')
  .map((token) => token.trim())
  .filter(Boolean);

const TOKENS = CANDIDATE_TOKENS.length > 0 ? CANDIDATE_TOKENS : ACCESS_TOKEN ? [ACCESS_TOKEN] : [];

const searchFailures = new Rate('candidate_search_failures');
const payloadFailures = new Rate('candidate_search_payload_failures');
const searchLatency = new Trend('candidate_search_latency', true);

const PEAK_VUS = Number(__ENV.PEAK_VUS || 1000);
const THINK_MIN_MS = Number(__ENV.THINK_MIN_MS || 250);
const THINK_MAX_MS = Number(__ENV.THINK_MAX_MS || 1000);

export const options = {
  discardResponseBodies: false,
  scenarios: {
    candidate_search: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [
        { duration: __ENV.RAMP_1 || '1m', target: Math.max(100, Math.floor(PEAK_VUS * 0.25)) },
        { duration: __ENV.RAMP_2 || '2m', target: Math.max(250, Math.floor(PEAK_VUS * 0.5)) },
        { duration: __ENV.RAMP_3 || '2m', target: PEAK_VUS },
        { duration: __ENV.HOLD || '5m', target: PEAK_VUS },
        { duration: __ENV.RAMP_DOWN || '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'candidateSearch',
      tags: { workload: 'candidate-search' },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:candidate_search}': ['p(95)<800', 'p(99)<1500'],
    candidate_search_failures: ['rate<0.01'],
    candidate_search_payload_failures: ['rate<0.005'],
    candidate_search_latency: ['p(95)<800', 'p(99)<1500'],
  },
};

const queries = ['golang', 'java', 'react', 'devops', 'data engineer', 'cloud', 'python', 'backend'];
const locations = ['Mumbai', 'Pune', 'Bengaluru', 'Hyderabad', 'Chennai', 'Remote'];
const workModes = ['', 'onsite', 'hybrid', 'remote'];
const experienceMonths = [0, 12, 24, 36, 60, 84];
const pages = [1, 1, 1, 2, 3];

function choose(items, seedOffset = 0) {
  const seed = (__VU * 31 + __ITER * 17 + seedOffset) >>> 0;
  return items[seed % items.length];
}

function candidateToken() {
  if (TOKENS.length === 0) {
    fail('Set CANDIDATE_TOKENS (comma-separated JWTs; preferred) or ACCESS_TOKEN before running the load test.');
  }
  return TOKENS[(__VU - 1) % TOKENS.length];
}

function buildSearchURL() {
  const params = new URLSearchParams();
  params.set('q', choose(queries, 1));
  params.set('location', choose(locations, 2));

  const mode = choose(workModes, 3);
  if (mode) params.set('work_mode', mode);

  params.set('experience_months', String(choose(experienceMonths, 4)));
  params.set('page', String(choose(pages, 5)));
  params.set('limit', '10');

  return `${BASE_URL}/api/v1/candidate/jobs?${params.toString()}`;
}

export function setup() {
  if (TOKENS.length === 0) {
    fail('No candidate JWT supplied. Refusing to execute an unauthenticated load test.');
  }

  if (PEAK_VUS >= 1000 && TOKENS.length < 1000) {
    console.warn(
      `PEAK_VUS=${PEAK_VUS}, but only ${TOKENS.length} candidate token(s) supplied. ` +
        'For a production-representative 1,000-candidate test, provide 1,000 distinct JWTs via CANDIDATE_TOKENS.',
    );
  }

  const health = http.get(`${BASE_URL}/healthz`, { timeout: '3s', tags: { name: 'health-preflight' } });
  if (health.status !== 200) {
    fail(`API preflight failed: ${BASE_URL}/healthz returned HTTP ${health.status}`);
  }

  return { baseURL: BASE_URL, tokenCount: TOKENS.length };
}

export function candidateSearch() {
  const started = Date.now();
  const response = http.get(buildSearchURL(), {
    headers: {
      Authorization: `Bearer ${candidateToken()}`,
      Accept: 'application/json',
      'X-Load-Test': 'phase-d-candidate-search',
    },
    timeout: '5s',
    tags: { name: 'candidate-job-search' },
  });

  searchLatency.add(Date.now() - started);

  const responseOK = check(response, {
    'job search returns 200': (res) => res.status === 200,
    'job search is JSON': (res) => String(res.headers['Content-Type'] || '').includes('application/json'),
  });
  searchFailures.add(!responseOK);

  let payloadOK = false;
  if (response.status === 200) {
    try {
      const body = response.json();
      payloadOK = Array.isArray(body.items) && Number.isInteger(body.page) && Number.isInteger(body.limit) && typeof body.total === 'number';
    } catch (_) {
      payloadOK = false;
    }
  }
  payloadFailures.add(!payloadOK);

  const jitter = THINK_MIN_MS + Math.random() * Math.max(0, THINK_MAX_MS - THINK_MIN_MS);
  sleep(jitter / 1000);
}

export function handleSummary(data) {
  const p95 = data.metrics.candidate_search_latency?.values?.['p(95)'];
  const p99 = data.metrics.candidate_search_latency?.values?.['p(99)'];
  const failureRate = data.metrics.candidate_search_failures?.values?.rate;

  console.log(
    `SapienWorx candidate-search peak: ${PEAK_VUS} VUs | ` +
      `p95=${p95 !== undefined ? p95.toFixed(1) : 'n/a'}ms | ` +
      `p99=${p99 !== undefined ? p99.toFixed(1) : 'n/a'}ms | ` +
      `failures=${failureRate !== undefined ? (failureRate * 100).toFixed(2) : 'n/a'}%`,
  );

  return {
    stdout: JSON.stringify(data, null, 2),
    'performance/results/summary.json': JSON.stringify(data, null, 2),
  };
}
