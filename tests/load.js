import http from 'k6/http';
import { check, sleep } from 'k6';
export const options = { vus: 5, duration: '30s', thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<1000'] } };
export default function () {
  const base = __ENV.BASE_URL || 'http://127.0.0.1:4317';
  const response = http.get(base + '/api/incidents');
  check(response, { 'domain-backed read succeeds': r => r.status === 200 });
  sleep(1);
}
