// Staging-only baseline. Never point this at production without explicit approval.
// Run: k6 run -e BASE_URL=https://YOUR-STAGING-URL tests/load/http-smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
export const errorRate = new Rate('request_errors');
export const healthLatency = new Trend('health_latency');
export const options = { scenarios: { gentle_ramp: { executor: 'ramping-vus', startVUs: 1, stages: [ { duration: '30s', target: 2 }, { duration: '1m', target: 5 }, { duration: '30s', target: 0 } ], gracefulRampDown: '10s' } }, thresholds: { http_req_failed: ['rate<0.02'], http_req_duration: ['p(95)<1000'], request_errors: ['rate<0.02'] } };
const base = __ENV.BASE_URL;
if (!base) throw new Error('Set BASE_URL to a dedicated staging deployment.');
export default function () {
  const start = Date.now();
  const health = http.get(base + '/api/health', { tags: { endpoint: 'health' } });
  healthLatency.add(Date.now() - start);
  const healthOk = check(health, { 'health returns 200': r => r.status === 200, 'health identifies prototype service': r => r.body.includes('unknown-api') });
  errorRate.add(!healthOk);
  // One guest attempt per iteration; current limiter allows 5 per IP per 10 minutes.
  const session = http.post(base + '/api/sessions', JSON.stringify({ ageAttested: true }), { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'session-create' } });
  const sessionOk = check(session, { 'session created or rate-limited': r => r.status === 201 || r.status === 429 });
  errorRate.add(!sessionOk);
  sleep(2);
}
