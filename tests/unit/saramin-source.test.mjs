import assert from "node:assert/strict";
import test from "node:test";
import { SaraminSource } from "../../dist/sources/saramin/saramin-source.js";

const ctx = { requestId: "req-s", now: "2026-09-14T03:00:00+09:00", timeoutMs: 1000 };

const job = {
  id: "123",
  url: "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=123&utm_source=api",
  active: 1,
  company: { detail: { name: "Example Corp" } },
  position: {
    title: "Node.js Backend Developer",
    location: { code: "101000", name: "서울전체" },
    "job-type": { code: "1", name: "정규직" },
    "experience-level": { code: 1, min: 0, max: 0, name: "신입" },
    "required-education-level": { code: "0", name: "학력무관" },
  },
  keyword: "Node.js,TypeScript,REST API",
  "posting-timestamp": "1789311600",
  "expiration-timestamp": "1791903599",
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("Saramin search maps Seoul to the official location code and never leaks access key into output", async () => {
  let requestedUrl = "";
  const source = new SaraminSource({
    accessKey: "secret-key",
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return response({ jobs: { count: 1, start: 0, total: "1", job: [job] } });
    },
  });
  const result = await source.search({ keywords: ["Node.js", "TypeScript"], locations: ["서울"], pageSize: 20 }, ctx);
  assert.equal(result.ok, true);
  assert.match(requestedUrl, /loc_cd=101000/);
  assert.match(requestedUrl, /access-key=secret-key/);
  if (!result.ok) return;
  assert.equal(JSON.stringify(result.data).includes("secret-key"), false);
  assert.equal(result.data.items[0].company, "Example Corp");
});

test("Saramin fetch + normalize marks API content as partial rather than a full JD", async () => {
  const source = new SaraminSource({
    accessKey: "secret-key",
    fetchImpl: async () => response({ jobs: { count: 1, start: 0, total: "1", job: [job] } }),
  });
  const fetched = await source.fetch({ sourceId: "saramin", externalId: "123", url: job.url }, ctx);
  assert.equal(fetched.ok, true);
  if (!fetched.ok) return;
  const normalized = await source.normalize(fetched.data, ctx);
  assert.equal(normalized.ok, true);
  if (!normalized.ok) return;
  assert.equal(normalized.data.contentCompleteness, "partial");
  assert.equal(normalized.data.experienceRequirement?.minYears, 0);
  assert.equal(normalized.data.status, "open");
  assert.equal(normalized.warnings[0].code, "PARTIAL_CONTENT");
});

test("Saramin API quota errors become retryable RATE_LIMITED errors", async () => {
  const source = new SaraminSource({
    accessKey: "secret-key",
    fetchImpl: async () => response({ code: 4, message: "daily limit exceeded" }),
  });
  const result = await source.search({ keywords: ["backend"] }, ctx);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "RATE_LIMITED");
  assert.equal(result.error.retryable, true);
});
