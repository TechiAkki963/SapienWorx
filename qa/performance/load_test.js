import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const API = __ENV.API_URL || 'http://127.0.0.1:8080';
const candidateErrors = new Rate('candidate_errors');
const recruiterErrors = new Rate('recruiter_errors');
const bulkLatency = new Trend('bulk_update_latency', true);

export const options = {
  scenarios: {
    candidates_search: {
      executor: 'constant-vus',
      vus: 500,
      duration: '5m',
      exec: 'candidateSearch',
      gracefulStop: '15s'
    },
    recruiters_bulk_update: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      exec: 'recruiterBulkUpdate',
      gracefulStop: '15s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:candidates_search}': ['p(95)<300'],
    candidate_errors: ['rate<0.01'],
    recruiter_errors: ['rate<0.01'],
    bulk_update_latency: ['p(95)<1000']
  }
};

export function candidateSearch() {
  const r = http.get(`${API}/api/v1/jobs?location=Mumbai&skills=go,react&notice_period_lte=30&limit=20`, {
    tags: { scenario: 'candidates_search' },
    headers: auth(__ENV.CANDIDATE_JWT)
  });
  const ok = check(r, {
    'search status 200': x => x.status === 200,
    'search has no 5xx': x => x.status < 500
  });
  candidateErrors.add(!ok);
  sleep(Math.random() * 0.5);
}

export function recruiterBulkUpdate() {
  const ids = Array.from({ length: 25 }, (_, i) => `${(__VU - 1) * 25 + i + 1}`);
  const r = http.patch(`${API}/api/v1/recruiter/pipeline/bulk-stage`, JSON.stringify({ candidate_ids: ids, stage: 'interview' }), {
    tags: { scenario: 'recruiters_bulk_update' },
    headers: { ...auth(__ENV.RECRUITER_JWT), 'Content-Type': 'application/json' }
  });
  bulkLatency.add(r.timings.duration);
  const ok = check(r, {
    'bulk status accepted': x => [200, 202, 204].includes(x.status),
    'no deadlock signature': x => !/deadlock|race|serialization failure/i.test(x.body || '')
  });
  recruiterErrors.add(!ok);
  sleep(0.25 + Math.random());
}

function auth(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
