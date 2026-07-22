import assert from "node:assert/strict";
import test from "node:test";
import { auditCsv, DEMO_CSV, issuesToCsv, parseExecutionCsv } from "../lib/trade-audit.mjs";

test("demo audit rejects invalid and duplicate executions deterministically", () => {
  const report = auditCsv(DEMO_CSV);
  assert.equal(report.rowsReceived, 12);
  assert.equal(report.executionsAccepted, 10);
  assert.equal(report.executionsCalculated, 8);
  assert.equal(report.openPositionExecutionCount, 2);
  assert.equal(report.unaccountedRowCount, 0);
  assert.equal(report.rejectedCount, 2);
  assert.equal(report.duplicateCount, 1);
  assert.equal(report.errorCount, 3);
  assert.equal(report.ruleBreaches, 1);
  assert.deepEqual(report.roundTrips.map((trade) => trade.symbol), ["AAPL", "NVDA", "TSLA"]);
  assert.ok(Math.abs(report.netPnl - 398.5) < 0.000001);
  assert.ok(Math.abs(report.pnlVariance - 1) < 0.000001);
  assert.equal(report.pnlComparisonCount, 3);
  assert.deepEqual(report.openPositions.map((position) => position.symbol).sort(), ["MSFT", "SPY"]);
});

test("header aliases parse into the canonical execution schema", () => {
  const rows = parseExecutionCsv("trade_id,orderid,datetime,account_id,asset_class,currency,contract,action,qty,fill_price,fees\nX1,O1,2026-01-01T10:00:00Z,A1,EQUITY,USD,AAPL,BUY,1,5000,2.5");
  assert.equal(rows[0].executionId, "X1");
  assert.equal(rows[0].symbol, "AAPL");
  assert.equal(rows[0].commission, 2.5);
});

test("review export retains source-row provenance", () => {
  const report = auditCsv(DEMO_CSV);
  const csv = issuesToCsv(report.issues);
  assert.match(csv, /"DUPLICATE_EXECUTION","9","T3002","TSLA"/);
  assert.match(csv, /"PNL_VARIANCE","4","A1003","AAPL"/);
});

test("missing required columns fail closed", () => {
  assert.throws(() => parseExecutionCsv("symbol,price\nAAPL,100"), /Missing required columns/);
});

test("canonical header collisions fail closed instead of discarding fees", () => {
  const csv = "execution_id,order_id,timestamp,account,asset_type,currency,symbol,side,quantity,price,commission,fees\nX1,O1,2026-01-01T10:00:00Z,A1,EQUITY,USD,AAPL,BUY,1,100,1,2";
  assert.throws(() => parseExecutionCsv(csv), /Duplicate canonical columns: commission/);
});

test("execution IDs are unique within an account rather than globally", () => {
  const csv = "execution_id,order_id,timestamp,account,asset_type,currency,symbol,side,quantity,price,commission\nX1,O1,2026-01-01T10:00:00Z,A1,EQUITY,USD,AAPL,BUY,1,100,1\nX1,O2,2026-01-01T10:01:00Z,A2,EQUITY,USD,MSFT,BUY,1,200,1";
  const report = auditCsv(csv);
  assert.equal(report.duplicateCount, 0);
  assert.equal(report.executionsAccepted, 2);
});

test("position flips fail closed for the entire symbol group", () => {
  const csv = "execution_id,order_id,timestamp,account,asset_type,currency,symbol,side,quantity,price,commission\nX1,O1,2026-01-01T10:00:00Z,A1,EQUITY,USD,AAPL,BUY,10,100,1\nX2,O2,2026-01-01T10:01:00Z,A1,EQUITY,USD,AAPL,SELL,15,101,1.5\nX3,O3,2026-01-01T10:02:00Z,A1,EQUITY,USD,AAPL,BUY,5,99,0.5";
  const report = auditCsv(csv);
  assert.equal(report.roundTrips.length, 0);
  assert.equal(report.executionsAccepted, 3);
  assert.equal(report.executionsCalculated, 0);
  assert.equal(report.openPositionExecutionCount, 0);
  assert.equal(report.calculationExcludedCount, 3);
  assert.equal(report.unaccountedRowCount, 0);
  assert.ok(report.issues.some((item) => item.code === "POSITION_FLIP_UNSUPPORTED"));
});

test("source-row provenance survives internal blank lines", () => {
  const csv = "execution_id,order_id,timestamp,account,asset_type,currency,symbol,side,quantity,price,commission\nX1,O1,2026-01-01T10:00:00Z,A1,EQUITY,USD,AAPL,BUY,1,100,1\n\nX1,O2,2026-01-01T10:01:00Z,A1,EQUITY,USD,AAPL,SELL,1,101,1";
  const report = auditCsv(csv);
  const duplicate = report.issues.find((item) => item.code === "DUPLICATE_EXECUTION");
  assert.equal(duplicate.rowNumber, 4);
});

test("USD numbers use unambiguous US formatting without corrupting three-decimal values", () => {
  const us = parseExecutionCsv('execution_id,order_id,timestamp,account,asset_type,currency,symbol,side,quantity,price,commission\nX1,O1,2026-01-01T10:00:00Z,A1,EQUITY,USD,AAPL,BUY,"1,000","1,234.56",1')[0];
  const decimal = parseExecutionCsv('execution_id,order_id,timestamp,account,asset_type,currency,symbol,side,quantity,price,commission\nX2,O2,2026-01-01T10:00:00Z,A1,EQUITY,USD,AAPL,BUY,0.125,1.234,0.001')[0];
  assert.equal(us.quantity, 1000);
  assert.equal(us.price, 1234.56);
  assert.equal(decimal.quantity, 0.125);
  assert.equal(decimal.price, 1.234);
  assert.equal(decimal.commission, 0.001);
});

test("ambiguous European number formatting fails closed for the USD pilot", () => {
  const csv = 'execution_id,order_id,timestamp,account,asset_type,currency,symbol,side,quantity,price,commission\nX1,O1,2026-01-01T10:00:00Z,A1,EQUITY,USD,AAPL,BUY,"1.000","1.234,56",1';
  const report = auditCsv(csv);
  assert.equal(report.executionsAccepted, 0);
  assert.ok(report.issues.some((item) => item.code === "INVALID_ROW"));
  const decimalComma = parseExecutionCsv('execution_id,order_id,timestamp,account,asset_type,currency,symbol,side,quantity,price,commission\nX2,O2,2026-01-01T10:00:00Z,A1,EQUITY,USD,AAPL,BUY,"0,125",1,0')[0];
  assert.ok(Number.isNaN(decimalComma.quantity));
});

test("provided P&L is compared only when it appears on the closing execution", () => {
  const csv = "execution_id,order_id,timestamp,account,asset_type,currency,symbol,side,quantity,price,commission,reported_net_pnl\nX1,O1,2026-01-01T10:00:00Z,A1,EQUITY,USD,AAPL,BUY,1,100,0,999\nX2,O2,2026-01-01T10:01:00Z,A1,EQUITY,USD,AAPL,SELL,1,101,0,";
  const report = auditCsv(csv);
  assert.ok(Number.isNaN(report.roundTrips[0].reportedNetPnl));
  assert.equal(report.pnlComparisonCount, 0);
  assert.ok(!report.issues.some((item) => item.code === "PNL_VARIANCE"));
});

test("P&L variance keeps provenance inside the matching account and symbol", () => {
  const csv = "execution_id,order_id,timestamp,account,asset_type,currency,symbol,side,quantity,price,commission,reported_net_pnl\nX1,O1,2026-01-01T10:00:00Z,A1,EQUITY,USD,AAPL,BUY,1,100,0,\nX2,O2,2026-01-01T10:01:00Z,A1,EQUITY,USD,AAPL,SELL,1,101,0,1\nX1,O3,2026-01-01T10:00:00Z,A2,EQUITY,USD,MSFT,BUY,1,200,0,\nX2,O4,2026-01-01T10:01:00Z,A2,EQUITY,USD,MSFT,SELL,1,202,0,1";
  const report = auditCsv(csv);
  const variance = report.issues.find((item) => item.code === "PNL_VARIANCE");
  assert.equal(variance?.symbol, "MSFT");
  assert.equal(variance?.rowNumber, 5);
});

test("blank fees, missing timezone and non-equity instruments are rejected", () => {
  const csv = "execution_id,order_id,timestamp,account,asset_type,currency,symbol,side,quantity,price,commission\nX1,O1,2026-01-01T10:00:00,A1,EQUITY,USD,AAPL,BUY,1,100,\nX2,O2,2026-01-01T10:00:00Z,A1,FUTURE,USD,ES,BUY,1,5000,2";
  const report = auditCsv(csv);
  assert.equal(report.executionsAccepted, 0);
  assert.ok(report.issues.some((item) => item.code === "INVALID_ROW" && /explicit timezone|commission/.test(item.detail)));
  assert.ok(report.issues.some((item) => item.code === "UNSUPPORTED_INSTRUMENT"));
});

test("review CSV neutralizes spreadsheet formulas", () => {
  const csv = issuesToCsv([{ severity: "error", code: "TEST", rowNumber: 2, executionId: "=CMD()", symbol: "+AAPL", title: "Issue", detail: "Detail" }]);
  assert.match(csv, /"'=CMD\(\)"/);
  assert.match(csv, /"'\+AAPL"/);
});

test("malformed row widths and unbalanced quotes fail closed", () => {
  const header = "execution_id,order_id,timestamp,account,asset_type,currency,symbol,side,quantity,price,commission";
  assert.throws(() => parseExecutionCsv(`${header}\nX1,O1,2026-01-01T10:00:00Z,A1,EQUITY,USD,AAPL,BUY,1,100`), /expected 11/);
  assert.throws(() => parseExecutionCsv(`${header}\nX1,O1,2026-01-01T10:00:00Z,A1,EQUITY,USD,\"AAPL,BUY,1,100,1`), /Unbalanced quotes on row 2/);
});

test("binary or undecodable CSV input fails closed", () => {
  assert.throws(() => parseExecutionCsv("execution_id\u0000,order_id\nX1,O1"), /unsupported binary or undecodable/);
});
