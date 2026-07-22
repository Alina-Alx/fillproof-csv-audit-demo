import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-rendered output contains the complete FillProof landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>FillProof — Broker Import QA<\/title>/i);
  assert.match(html, /Regression evidence for broker CSV importers/);
  assert.match(html, /INTERACTIVE SYNTHETIC DEMO/);
  assert.match(html, /processing stays in the browser in this prototype/);
  assert.match(html, /FIXED-SCOPE DEVELOPER PILOT/);
  assert.match(html, /\$79/);
  assert.match(html, /\$150/);
  assert.match(html, /NOT A CLIENT RESULT/);
  assert.match(html, /github\.com\/Alina-Alx\/fillproof-csv-audit-demo\/issues\/new/);
  assert.doesNotMatch(html, /mailto:|@gmail\.com/i);
  assert.doesNotMatch(html, /<strong>\$49<\/strong>|<strong>\$39<\/strong>|No outreach has been sent/);
  assert.doesNotMatch(html, /Your site is taking shape|Codex is working|react-loading-skeleton/);
});

test("audit controls expose accessible selection and tab relationships", async () => {
  const html = await (await render()).text();
  assert.match(html, /id="audit-tab-issues"[^>]*role="tab"[^>]*aria-selected="true"[^>]*aria-controls="audit-panel-issues"/);
  assert.match(html, /id="audit-tab-trades"[^>]*role="tab"[^>]*aria-selected="false"[^>]*aria-controls="audit-panel-trades"/);
  assert.match(html, /id="audit-panel-issues"[^>]*role="tabpanel"[^>]*aria-labelledby="audit-tab-issues"/);
  assert.match(html, /aria-pressed="true"[^>]*>all/);
  assert.match(html, /<ul class="issue-list">/);
  assert.doesNotMatch(html, /role="listitem"/);
});

test("sample execution export ships with the site", async () => {
  const csv = await readFile(new URL("../public/sample-executions.csv", import.meta.url), "utf8");
  assert.match(csv, /^execution_id,order_id,timestamp,/);
  assert.match(csv, /T3002/);
  assert.match(csv, /reported_net_pnl/);
});
