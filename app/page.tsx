"use client";

import { useMemo, useRef, useState } from "react";
import {
  auditCsv,
  DEMO_CSV,
  issuesToCsv,
  type AuditIssue,
  type AuditReport,
} from "@/lib/trade-audit.mjs";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const MAX_UPLOAD_BYTES = 2_000_000;
const CONTACT_URL =
  "https://github.com/Alina-Alx/fillproof-csv-audit-demo/issues/new?title=Scoped%20CSV%20importer%20QA%20request";

function ArrowMark() {
  return <span className="text-icon" aria-hidden="true">→</span>;
}

function DownloadMark() {
  return <span className="text-icon" aria-hidden="true">↓</span>;
}

function CheckMark() {
  return <span className="text-icon check" aria-hidden="true">✓</span>;
}

function scrollToAudit() {
  document.getElementById("audit")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToPilot() {
  document.getElementById("pilot")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

function SummaryCard({ label, value, detail, tone = "default" }: { label: string; value: string; detail: string; tone?: string }) {
  return (
    <article className={`summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function IssueList({
  issues,
  selected,
  onSelect,
}: {
  issues: AuditIssue[];
  selected: AuditIssue | null;
  onSelect: (issue: AuditIssue) => void;
}) {
  if (!issues.length) {
    return <div className="empty-state">No issues in this filter.</div>;
  }
  return (
    <ul className="issue-list">
      {issues.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className={`issue-row ${selected?.id === item.id ? "selected" : ""}`}
            onClick={() => onSelect(item)}
            aria-pressed={selected?.id === item.id}
            aria-controls="issue-inspector"
          >
            <span className={`severity-dot ${item.severity}`} aria-hidden="true" />
            <span className="issue-copy">
              <strong>{item.title}</strong>
              <small>{item.symbol ?? "File"} · {item.rowNumber ? `row ${item.rowNumber}` : "file level"}</small>
            </span>
            <span className="issue-code">{item.code.replaceAll("_", " ")}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  const initial = useMemo(() => auditCsv(DEMO_CSV), []);
  const [report, setReport] = useState<AuditReport>(initial);
  const [fileName, setFileName] = useState("sample-executions.csv");
  const [parseError, setParseError] = useState("");
  const [filter, setFilter] = useState<"all" | "error" | "warning" | "info">("all");
  const [view, setView] = useState<"issues" | "trades">("issues");
  const [selectedId, setSelectedId] = useState(initial.issues[0]?.id ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredIssues = filter === "all" ? report.issues : report.issues.filter((item) => item.severity === filter);
  const selected = filteredIssues.find((item) => item.id === selectedId) ?? filteredIssues[0] ?? null;

  function applyCsv(text: string, name: string) {
    try {
      const next = auditCsv(text);
      setReport(next);
      setFileName(name);
      setParseError("");
      setFilter("all");
      setView("issues");
      setSelectedId(next.issues[0]?.id ?? "");
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "The file could not be parsed.");
    }
  }

  async function handleFile(file?: File) {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setParseError("The local demo accepts synthetic CSV files up to 2 MB.");
      return;
    }
    applyCsv(await file.text(), file.name);
  }

  function resetDemo() {
    applyCsv(DEMO_CSV, "sample-executions.csv");
  }

  return (
    <main>
      <nav className="nav shell" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="FillProof home">
          <span className="brand-mark"><i /><i /><i /></span>
          FILLPROOF
        </a>
        <div className="nav-links">
          <a href="#audit">Synthetic demo</a>
          <a href="#method">Method</a>
          <a href="#pilot">QA packs</a>
        </div>
        <button className="nav-action" type="button" onClick={scrollToPilot}>See QA packs <ArrowMark /></button>
      </nav>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span /> BROKER CSV IMPORTER QA</div>
          <h1>Regression evidence for broker CSV importers.</h1>
          <p className="hero-lede">
            FillProof builds synthetic fixtures, expected row outcomes, and reproducible issue reports for one existing USD stock or ETF importer.
          </p>
          <div className="hero-actions">
            <button className="button primary" type="button" onClick={scrollToPilot}>Compare QA packs <ArrowMark /></button>
            <button className="button secondary" type="button" onClick={scrollToAudit}>Run synthetic demo</button>
          </div>
          <div className="privacy-line"><CheckMark /> No customer statements, account credentials, or production access are required.</div>
        </div>

        <div className="hero-proof" aria-label="Synthetic demonstration result">
          <div className="proof-header">
            <div><span className="window-dot" /><span className="window-dot" /><span className="window-dot" /></div>
            <span>SYNTHETIC FIXTURE · 12 ROWS</span>
          </div>
          <div className="proof-score">
            <span>DEMONSTRATION STATUS · NOT A CLIENT RESULT</span>
            <strong>Needs review</strong>
            <div className="score-track"><i /></div>
          </div>
          <div className="proof-grid">
            <div><small>ROWS</small><b>{initial.rowsReceived}</b></div>
            <div><small>ERRORS</small><b>{initial.errorCount}</b></div>
            <div><small>P&amp;L VARIANCE</small><b>{money.format(initial.pnlVariance)}</b></div>
          </div>
          <div className="proof-finding error"><span>01</span><div><b>Duplicate execution</b><small>T3002 excluded · row 9</small></div><em>FLAGGED</em></div>
          <div className="proof-finding warning"><span>02</span><div><b>Missing timestamp</b><small>MSFT rejected · row 11</small></div><em>REJECT</em></div>
          <div className="proof-finding info"><span>03</span><div><b>P&amp;L variance</b><small>AAPL · $1.00 difference</small></div><em>COMPARE</em></div>
        </div>
      </section>

      <section className="signal-strip" aria-label="Product principles">
        <div className="shell signal-inner">
          <span><b>01</b> ONE EXISTING IMPORTER</span>
          <span><b>02</b> SYNTHETIC FIXTURES</span>
          <span><b>03</b> EXPECTED VS OBSERVED</span>
        </div>
      </section>

      <section className="audit-section shell" id="audit">
        <div className="section-heading">
          <div>
            <div className="eyebrow"><span /> INTERACTIVE SYNTHETIC DEMO</div>
            <h2>Inspect the reporting format.</h2>
          </div>
          <p>The sample contains intentional defects. Choose only a synthetic or deliberately altered canonical USD stock/ETF CSV; processing stays in the browser in this prototype.</p>
        </div>

        <div className="audit-shell">
          <div className="audit-toolbar">
            <div className="file-pill">
              <span className="file-icon">CSV</span>
              <div><strong>{fileName}</strong><small>{report.rowsReceived} source rows · local session</small></div>
            </div>
            <div className="toolbar-actions">
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(event) => handleFile(event.target.files?.[0])} hidden />
              <button type="button" onClick={() => fileRef.current?.click()}>Choose test CSV</button>
              <button type="button" onClick={resetDemo}>Reset sample</button>
            </div>
          </div>
          {parseError && <div className="parse-error" role="alert">{parseError}</div>}

          <div className="summary-grid">
            <SummaryCard label="Closed-trip net P&L" value={money.format(report.netPnl)} detail={`${money.format(report.fees)} closed-trip commissions included`} />
            <SummaryCard label="Material errors" value={String(report.errorCount)} detail={`${report.rejectedCount} input rejected · ${report.calculationExcludedCount} calculation-excluded`} tone="danger" />
            <SummaryCard
              label="Provided-value variance"
              value={report.pnlComparisonCount > 0 ? money.format(report.pnlVariance) : "Not provided"}
              detail={report.pnlComparisonCount > 0 ? `${report.pnlComparisonCount}/${report.roundTrips.length} closed trips compared` : "no confirmed trade-level input"}
              tone="warning"
            />
            <SummaryCard label="Closed round trips" value={String(report.roundTrips.length)} detail={`${report.executionsCalculated}/${report.executionsAccepted} validated rows calculated · ${report.openPositionExecutionCount} open · ${report.unaccountedRowCount} unaccounted`} />
          </div>

          <div className="audit-tabs">
            <div role="tablist" aria-label="Audit views">
              {(["issues", "trades"] as const).map((item) => {
                const label = item === "issues" ? "Issues" : "Round trips";
                const count = item === "issues" ? report.issues.length : report.roundTrips.length;
                return (
                  <button
                    key={item}
                    id={`audit-tab-${item}`}
                    type="button"
                    role="tab"
                    className={view === item ? "active" : ""}
                    aria-selected={view === item}
                    aria-controls={`audit-panel-${item}`}
                    tabIndex={view === item ? 0 : -1}
                    onClick={() => setView(item)}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                      event.preventDefault();
                      const next = item === "issues" ? "trades" : "issues";
                      setView(next);
                      document.getElementById(`audit-tab-${next}`)?.focus();
                    }}
                  >
                    {label} <span>{count}</span>
                  </button>
                );
              })}
            </div>
            <button className="export-button" type="button" onClick={() => downloadText("fillproof-audit.csv", issuesToCsv(report.issues))}><DownloadMark /> Export review CSV</button>
          </div>

          {view === "issues" ? (
            <div
              className="issues-layout"
              id="audit-panel-issues"
              role="tabpanel"
              aria-labelledby="audit-tab-issues"
              tabIndex={0}
            >
              <div className="issues-main">
                <div className="filters" aria-label="Issue filters">
                  {(["all", "error", "warning", "info"] as const).map((item) => (
                    <button key={item} type="button" className={filter === item ? "active" : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>
                  ))}
                </div>
                <IssueList issues={filteredIssues} selected={selected} onSelect={(item) => setSelectedId(item.id)} />
              </div>
              <aside className="inspector" id="issue-inspector" aria-live="polite">
                {selected ? (
                  <>
                    <div className="inspector-top"><span className={`severity-label ${selected.severity}`}>{selected.severity}</span><code>{selected.code}</code></div>
                    <h3>{selected.title}</h3>
                    <p>{selected.detail}</p>
                    <dl>
                      <div><dt>Source row</dt><dd>{selected.rowNumber ?? "File"}</dd></div>
                      <div><dt>Execution</dt><dd>{selected.executionId ?? "—"}</dd></div>
                      <div><dt>Symbol</dt><dd>{selected.symbol ?? "—"}</dd></div>
                    </dl>
                    <div className="resolution"><span>Recommended action</span><p>{selected.severity === "error" ? "Correct the fixture or importer rule, then rerun the same expected outcome." : selected.code === "RISK_LIMIT" ? "Confirm whether this business-rule signal belongs in the importer scope." : "Keep the finding in the regression record and confirm the grouping rule."}</p></div>
                  </>
                ) : <div className="empty-state">This file has no findings.</div>}
              </aside>
            </div>
          ) : (
            <div
              className="trade-table-wrap"
              id="audit-panel-trades"
              role="tabpanel"
              aria-labelledby="audit-tab-trades"
              tabIndex={0}
            >
              <table className="trade-table">
                <thead><tr><th>Symbol</th><th>Setup</th><th>Executions</th><th>Gross P&amp;L</th><th>Fees</th><th>Net P&amp;L</th><th>Variance</th></tr></thead>
                <tbody>
                  {report.roundTrips.map((trade) => (
                    <tr key={trade.id}>
                      <td><b>{trade.symbol}</b><small>{new Date(trade.openedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></td>
                      <td>{trade.setup}</td>
                      <td>{trade.executionCount}</td>
                      <td>{money.format(trade.grossPnl)}</td>
                      <td className="negative">−{money.format(trade.fees)}</td>
                      <td className={trade.netPnl >= 0 ? "positive" : "negative"}>{money.format(trade.netPnl)}</td>
                      <td>{Number.isFinite(trade.pnlVariance) ? money.format(trade.pnlVariance) : "Not reported"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.openPositions.length > 0 && (
                <div className="open-positions"><b>Open-position check</b>{report.openPositions.map((position) => <span key={`${position.account}-${position.symbol}`}>{position.symbol} · {position.side} {position.quantity} @ {money.format(position.averagePrice)}</span>)}</div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="method-section" id="method">
        <div className="shell">
          <div className="section-heading light">
            <div><div className="eyebrow"><span /> FIXTURES TO OBSERVED RESULTS</div><h2>One traceable chain from source row to finding.</h2></div>
            <p>The service starts after one importer, its supported behavior, and a way to observe its actual output are agreed.</p>
          </div>
          <div className="method-grid">
            <article><span>01</span><h3>Scope</h3><p>Agree on one broker export, the header mapping, supported cases, and the observation path before payment.</p></article>
            <article><span>02</span><h3>Test</h3><p>Prepare broker-shaped synthetic fixtures, expected canonical rows, and explicit acceptance rules.</p></article>
            <article><span>03</span><h3>Compare</h3><p>Record expected and observed results by source row, prioritize reproducible findings, and rerun the same fixture after a fix.</p></article>
          </div>
          <div className="boundary-note"><CheckMark /><div><strong>Paid-service boundary</strong><p>Observed QA requires a runnable repository/build, a staging importer, or unedited client-run fixture outputs. FillProof does not build the importer, request credentials, access production data, or certify the full application.</p></div></div>
        </div>
      </section>

      <section className="pilot-section shell" id="pilot">
        <div className="pilot-card">
          <div className="pilot-copy">
            <div className="eyebrow"><span /> FIXED-SCOPE DEVELOPER PILOT</div>
            <h2>Choose the smallest pack that covers the importer.</h2>
            <p>Both options cover one USD stock/ETF broker export using synthetic or deliberately altered values. Scope and the observation path are confirmed before payment.</p>
            <div className="pilot-prices">
              <div>
                <small>MINI QA · ONE KNOWN FAILURE MODE</small>
                <strong>$79</strong><span>fixed scope</span>
                <ul className="package-list">
                  <li>One fixture, up to 12 execution rows</li>
                  <li>Up to five agreed edge cases</li>
                  <li>Reproducible issue list</li>
                  <li>One rerun of the same fixture</li>
                </ul>
              </div>
              <div>
                <small>FULL QA · BROADER REGRESSION COVERAGE</small>
                <strong>$150</strong><span>fixed scope</span>
                <ul className="package-list">
                  <li>Fixtures totaling up to 40 execution rows</li>
                  <li>Agreed broader edge-case matrix</li>
                  <li>Source-to-canonical mapping review</li>
                  <li>Prioritized observed-results report</li>
                  <li>Two reruns of the same fixtures</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="pilot-scorecard">
            <span>START WITH THREE ITEMS</span>
            <ul>
              <li><b>01</b> Broker and export/report name</li>
              <li><b>02</b> Header row only, with no executions or account data</li>
              <li><b>03</b> Runnable build/repository, staging importer, or client-run outputs</li>
            </ul>
            <p>Open a GitHub request with the broker/export name and header row only. FillProof will confirm fit and recommend the $79 or $150 scope before payment. Do not include credentials or production data.</p>
            <p className="scope-exclusions">Excluded: options, futures, forex, crypto, CFDs, multi-currency data, corporate actions, transfers, and position flips.</p>
            <a className="contact-button" href={CONTACT_URL}>Request scoped QA on GitHub <ArrowMark /></a>
          </div>
        </div>
      </section>

      <footer>
        <div className="shell footer-inner">
          <div><a className="brand" href="#top"><span className="brand-mark"><i /><i /><i /></span>FILLPROOF</a><p>Developer QA pilot · synthetic data only · July 2026</p></div>
          <div className="footer-links"><a href="#audit">Synthetic demo</a><a href="#method">QA method</a><a href="/sample-executions.csv" download>Sample CSV</a><a href={CONTACT_URL}>GitHub request</a></div>
        </div>
      </footer>
    </main>
  );
}
