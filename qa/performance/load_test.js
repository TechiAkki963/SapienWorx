import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const API = __ENV.API_URL || 'http://127.0.0.1:8080';
const candidateErrors = new Rate('candidate_errors');
const recruiterErrors = new Rate('recruiter_errors');
const stageLatency = new Trend('stage_update_latency', true);
const applicationIds = (__ENV.APPLICATION_IDS || '').split(',').map(v => v.trim()).filter(Boolean);

export const options = {
  scenarios: {
    candidates_search: {
      executor: 'constant-vus',
      vus: 500,
      duration: '5m',
      exec: 'candidateSearch',
      gracefulStop: '15s'
    },
    recruiters_stage_updates: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      exec: 'recruiterStageUpdate',
      gracefulStop: '15s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:candidates_search}': ['p(95)<300'],
    candidate_errors: ['rate<0.01'],
    recruiter_errors: ['rate<0.01'],
    stage_update_latency: ['p(95)<1000']
  }
};

export function setup() {
  if (!__ENV.RECRUITER_JWT) throw new Error('RECRUITER_JWT is required for recruiter concurrency scenario');
  if (applicationIds.length === 0) throw new Error('APPLICATION_IDS must contain one or more real recruiter-owned application IDs');
}

export function candidateSearch() {
  const r = http.get(`${API}/api/v1/jobs?location=Mumbai&limit=20`, {
    tags: { scenario: 'candidates_search' }
  });
  const ok = check(r, {
    'search status 200': x => x.status === 200,
    'search has no 5xx': x => x.status < 500
  });
  candidateErrors.add(!ok);
  sleep(Math.random() * 0.5);
}

export function recruiterStageUpdate() {
  const applicationId = applicationIds[(__VU - 1) % applicationIds.length];
  const stages = ['screening', 'shortlisted', 'technical_interview', 'hr_round'];
  const stage = stages[__ITER % stages.length];
  const r = http.patch(`${API}/api/v1/recruiter/applications/${encodeURIComponent(applicationId)}/stage`, JSON.stringify({ stage }), {
    tags: { scenario: 'recruiters_stage_updates' },
    headers: { Authorization: `Bearer ${__ENV.RECRUITER_JWT}`, 'Content-Type': 'application/json' }
  });
  stageLatency.add(r.timings.duration);
  const ok = check(r, {
    'stage update succeeds': x => x.status === 204,
    'no deadlock or serialization failure': x => !/deadlock|race|serialization failure/i.test(x.body || '')
  });
  recruiterErrors.add(!ok);
  sleep(0.25 + Math.random());
}
