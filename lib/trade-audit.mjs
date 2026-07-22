const REQUIRED_COLUMNS = [
  "execution_id",
  "order_id",
  "timestamp",
  "account",
  "asset_type",
  "currency",
  "symbol",
  "side",
  "quantity",
  "price",
  "commission",
];

const MAX_CSV_CHARACTERS = 2_000_000;
const MAX_EXECUTION_ROWS = 10_000;

const HEADER_ALIASES = {
  exec_id: "execution_id",
  executionid: "execution_id",
  execution_id: "execution_id",
  trade_id: "execution_id",
  orderid: "order_id",
  order_id: "order_id",
  date_time: "timestamp",
  datetime: "timestamp",
  time: "timestamp",
  timestamp: "timestamp",
  account: "account",
  account_id: "account",
  asset_class: "asset_type",
  asset_type: "asset_type",
  instrument_type: "asset_type",
  security_type: "asset_type",
  currency: "currency",
  settlement_currency: "currency",
  contract: "symbol",
  instrument: "symbol",
  symbol: "symbol",
  action: "side",
  buy_sell: "side",
  side: "side",
  qty: "quantity",
  quantity: "quantity",
  fill_price: "price",
  price: "price",
  commission: "commission",
  commissions: "commission",
  fees: "commission",
  setup: "setup",
  strategy: "setup",
  planned_risk: "planned_risk",
  planned_risk_usd: "planned_risk",
  risk_limit: "risk_limit",
  risk_limit_usd: "risk_limit",
  reported_net_pnl: "reported_net_pnl",
  net_pnl: "reported_net_pnl",
};

export const DEMO_CSV = `execution_id,order_id,timestamp,account,asset_type,currency,symbol,side,quantity,price,commission,setup,planned_risk_usd,risk_limit_usd,reported_net_pnl
A1001,O-101,2026-07-15T09:35:14-04:00,PROP-17,EQUITY,USD,AAPL,BUY,100,185.00,1.00,ORB,120,150,
A1002,O-102,2026-07-15T10:11:03-04:00,PROP-17,EQUITY,USD,AAPL,SELL,50,188.00,0.75,ORB,,,
A1003,O-102,2026-07-15T10:11:04-04:00,PROP-17,EQUITY,USD,AAPL,SELL,50,187.50,0.75,ORB,,,273.50
N2001,O-201,2026-07-15T11:04:40-04:00,PROP-17,EQUITY,USD,NVDA,SELL,20,125.00,0.50,,180,150,
N2002,O-202,2026-07-15T11:32:18-04:00,PROP-17,EQUITY,USD,NVDA,BUY,20,126.20,0.50,,,,-25.00
T3001,O-301,2026-07-16T09:42:07-04:00,PROP-17,EQUITY,USD,TSLA,BUY,40,244.00,0.40,Pullback,90,150,
T3002,O-301,2026-07-16T09:42:08-04:00,PROP-17,EQUITY,USD,TSLA,BUY,10,243.80,0.10,Pullback,90,150,
T3002,O-301,2026-07-16T09:42:08-04:00,PROP-17,EQUITY,USD,TSLA,BUY,10,243.80,0.10,Pullback,90,150,
T3003,O-302,2026-07-16T10:05:51-04:00,PROP-17,EQUITY,USD,TSLA,SELL,50,247.00,0.50,Pullback,,,151.00
M4001,O-401,,PROP-17,EQUITY,USD,MSFT,BUY,10,510.00,0.20,Breakout,70,150,
M4002,O-402,2026-07-16T14:25:04-04:00,PROP-17,EQUITY,USD,MSFT,SELL,10,512.00,0.20,Breakout,,,
S5001,O-501,2026-07-17T15:44:28-04:00,PROP-17,EQUITY,USD,SPY,BUY,5,628.00,0.20,Reversal,60,150,`;

function parseCsvLine(line, lineNumber = null) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted) {
    throw new Error(`Unbalanced quotes${lineNumber ? ` on row ${lineNumber}` : ""}. Multiline CSV fields are not supported.`);
  }
  values.push(value.trim());
  return values;
}

function normalizeHeader(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function numberFrom(value, fallback = Number.NaN) {
  let normalized = String(value ?? "").replace(/[$€£₽\s]/g, "");
  if (normalized === "") return fallback;
  if (/^-?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/,/g, "");
  } else if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return fallback;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseExecutionCsv(text) {
  const rawText = String(text);
  if (rawText.length > MAX_CSV_CHARACTERS) {
    throw new Error(`The pilot accepts at most ${MAX_CSV_CHARACTERS.toLocaleString("en-US")} CSV characters.`);
  }
  if (/[\u0000\uFFFD]/.test(rawText)) {
    throw new Error("The CSV contains unsupported binary or undecodable characters. Export it as UTF-8 CSV and retry.");
  }
  const lines = rawText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("The export needs a header and at least one execution row.");
  }
  if (lines.length - 1 > MAX_EXECUTION_ROWS) {
    throw new Error(`The pilot accepts at most ${MAX_EXECUTION_ROWS.toLocaleString("en-US")} execution rows.`);
  }

  const headers = parseCsvLine(lines[0].line, lines[0].lineNumber).map((header) => {
    const normalized = normalizeHeader(header);
    return HEADER_ALIASES[normalized] ?? normalized;
  });
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length) {
    throw new Error(`Missing required columns: ${missing.join(", ")}`);
  }
  const duplicates = [...new Set(headers.filter((header, index) => headers.indexOf(header) !== index))];
  if (duplicates.length) {
    throw new Error(`Duplicate canonical columns: ${duplicates.join(", ")}`);
  }

  return lines.slice(1).map(({ line, lineNumber }) => {
    const values = parseCsvLine(line, lineNumber);
    if (values.length !== headers.length) {
      throw new Error(`Row ${lineNumber} has ${values.length} columns; expected ${headers.length}.`);
    }
    const raw = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
    return {
      rowNumber: lineNumber,
      executionId: String(raw.execution_id ?? "").trim(),
      orderId: String(raw.order_id ?? "").trim(),
      timestamp: String(raw.timestamp ?? "").trim(),
      account: String(raw.account ?? "").trim(),
      assetType: String(raw.asset_type ?? "").trim().toUpperCase(),
      currency: String(raw.currency ?? "").trim().toUpperCase(),
      symbol: String(raw.symbol ?? "").trim().toUpperCase(),
      side: String(raw.side ?? "").trim().toUpperCase(),
      quantity: numberFrom(raw.quantity),
      price: numberFrom(raw.price),
      commission: numberFrom(raw.commission),
      setup: String(raw.setup ?? "").trim(),
      plannedRisk: numberFrom(raw.planned_risk),
      riskLimit: numberFrom(raw.risk_limit),
      reportedNetPnl: numberFrom(raw.reported_net_pnl),
      raw,
    };
  });
}

function issue(severity, code, title, detail, execution = null) {
  return {
    id: `${code}-${execution?.rowNumber ?? "file"}-${title}`,
    severity,
    code,
    title,
    detail,
    rowNumber: execution?.rowNumber ?? null,
    executionId: execution?.executionId ?? null,
    symbol: execution?.symbol ?? null,
  };
}

function validateExecutions(rows) {
  const issues = [];
  const accepted = [];
  const seen = new Set();

  for (const row of rows) {
    const missing = [];
    for (const key of ["executionId", "orderId", "timestamp", "account", "symbol"]) {
      if (!row[key]) missing.push(key);
    }
    if (!Number.isFinite(Date.parse(row.timestamp))) missing.push("valid timestamp");
    if (row.timestamp && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(row.timestamp)) missing.push("explicit timezone");
    if (!["BUY", "SELL"].includes(row.side)) missing.push("BUY/SELL side");
    if (!Number.isFinite(row.quantity) || row.quantity <= 0) missing.push("positive quantity");
    if (!Number.isFinite(row.price) || row.price <= 0) missing.push("positive price");
    if (!Number.isFinite(row.commission) || row.commission < 0) missing.push("non-negative commission");

    if (missing.length) {
      issues.push(issue("error", "INVALID_ROW", "Execution excluded from P&L", `Missing or invalid: ${[...new Set(missing)].join(", ")}.`, row));
      continue;
    }
    if (row.assetType !== "EQUITY" || row.currency !== "USD") {
      issues.push(issue("error", "UNSUPPORTED_INSTRUMENT", "Execution is outside the pilot scope", `Only USD cash equities are supported; received ${row.assetType || "unknown asset type"}/${row.currency || "unknown currency"}.`, row));
      continue;
    }
    const executionKey = `${row.account}\u0000${row.executionId}`;
    if (seen.has(executionKey)) {
      issues.push(issue("error", "DUPLICATE_EXECUTION", "Duplicate execution ID", `${row.executionId} appears more than once in account ${row.account}; the later row was excluded.`, row));
      continue;
    }
    seen.add(executionKey);
    accepted.push(row);

    if (!row.setup) {
      issues.push(issue("warning", "MISSING_SETUP", "Setup tag is missing", "This execution cannot be included in the setup-level weekly review.", row));
    }
    if (Number.isFinite(row.plannedRisk) && Number.isFinite(row.riskLimit) && row.plannedRisk > row.riskLimit) {
      issues.push(issue("warning", "RISK_LIMIT", "Planned risk exceeds the rule", `$${row.plannedRisk.toFixed(2)} planned versus a $${row.riskLimit.toFixed(2)} limit.`, row));
    }
  }

  return { accepted, issues };
}

function buildRoundTrips(executions, issues) {
  const groups = new Map();
  for (const execution of executions) {
    const key = `${execution.account}::${execution.symbol}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(execution);
  }

  const roundTrips = [];
  const openPositions = [];
  let calculationExcludedCount = 0;

  for (const group of groups.values()) {
    group.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
    let simulatedPosition = 0;
    const flip = group.find((execution) => {
      const signedQuantity = execution.side === "BUY" ? execution.quantity : -execution.quantity;
      const crossesZero = simulatedPosition !== 0
        && Math.sign(simulatedPosition) !== Math.sign(signedQuantity)
        && Math.abs(signedQuantity) > Math.abs(simulatedPosition) + 0.0000001;
      simulatedPosition += signedQuantity;
      return crossesZero;
    });
    if (flip) {
      issues.push(issue("error", "POSITION_FLIP_UNSUPPORTED", "Position flip excluded from P&L", "One execution closes the existing position and opens the opposite side. This group needs manual commission and trade-boundary review.", flip));
      calculationExcludedCount += group.length;
      continue;
    }
    let lots = [];
    let current = null;

    const position = () => lots.reduce((total, lot) => total + lot.direction * lot.quantity, 0);

    for (const execution of group) {
      const direction = execution.side === "BUY" ? 1 : -1;
      if (!current) {
        current = {
          id: `${execution.account}-${execution.symbol}-${execution.executionId}`,
          account: execution.account,
          symbol: execution.symbol,
          openedAt: execution.timestamp,
          closedAt: null,
          executionIds: [],
          orderIds: new Set(),
          setup: execution.setup || "Unclassified",
          grossPnl: 0,
          fees: 0,
          reportedNetPnl: Number.NaN,
        };
      }
      current.executionIds.push(execution.executionId);
      current.orderIds.add(execution.orderId);
      current.fees += execution.commission;
      const before = position();
      if (before === 0 || Math.sign(before) === direction) {
        lots.push({ direction, quantity: execution.quantity, price: execution.price });
      } else {
        let remaining = execution.quantity;
        while (remaining > 0 && lots.length && lots[0].direction !== direction) {
          const lot = lots[0];
          const closed = Math.min(remaining, lot.quantity);
          current.grossPnl += lot.direction === 1
            ? (execution.price - lot.price) * closed
            : (lot.price - execution.price) * closed;
          lot.quantity -= closed;
          remaining -= closed;
          if (lot.quantity <= 0.0000001) lots.shift();
        }
        if (remaining > 0) {
          issues.push(issue("warning", "POSITION_FLIP", "Execution flips the position", "The excess quantity starts a new position; confirm the broker grouping.", execution));
          lots.push({ direction, quantity: remaining, price: execution.price });
        }
      }

      if (Math.abs(position()) <= 0.0000001) {
        current.closedAt = execution.timestamp;
        current.reportedNetPnl = Number.isFinite(execution.reportedNetPnl) ? execution.reportedNetPnl : Number.NaN;
        current.netPnl = current.grossPnl - current.fees;
        current.orderCount = current.orderIds.size;
        current.executionCount = current.executionIds.length;
        current.pnlVariance = Number.isFinite(current.reportedNetPnl)
          ? current.netPnl - current.reportedNetPnl
          : Number.NaN;
        current.status = "closed";
        delete current.orderIds;
        roundTrips.push(current);
        current = null;
        lots = [];
      }
    }

    if (current && Math.abs(position()) > 0.0000001) {
      const netPosition = position();
      const weightedPrice = lots.reduce((total, lot) => total + lot.price * lot.quantity, 0)
        / lots.reduce((total, lot) => total + lot.quantity, 0);
      openPositions.push({
        account: current.account,
        symbol: current.symbol,
        side: netPosition > 0 ? "LONG" : "SHORT",
        quantity: Math.abs(netPosition),
        averagePrice: weightedPrice,
        executionIds: current.executionIds,
      });
      issues.push(issue("warning", "OPEN_POSITION", "Position does not return to flat", `${current.symbol} ends ${netPosition > 0 ? "long" : "short"} ${Math.abs(netPosition)} units.`, group[group.length - 1]));
    }
  }

  return { roundTrips, openPositions, calculationExcludedCount };
}

export function auditExecutions(rows) {
  const { accepted, issues } = validateExecutions(rows);
  const orderCounts = new Map();
  for (const row of accepted) {
    const orderKey = `${row.account}\u0000${row.symbol}\u0000${row.orderId}`;
    orderCounts.set(orderKey, (orderCounts.get(orderKey) ?? 0) + 1);
  }
  for (const [orderKey, count] of orderCounts) {
    if (count > 1) {
      const [account, symbol, orderId] = orderKey.split("\u0000");
      const row = accepted.find((execution) => execution.account === account && execution.symbol === symbol && execution.orderId === orderId);
      issues.push(issue("info", "PARTIAL_FILL", "Partial fills grouped", `${count} executions under order ${orderId} in account ${account} were kept together.`, row));
    }
  }

  const { roundTrips, openPositions, calculationExcludedCount } = buildRoundTrips(accepted, issues);
  for (const trade of roundTrips) {
    if (Number.isFinite(trade.pnlVariance) && Math.abs(trade.pnlVariance) >= 0.01) {
      const row = accepted.find((execution) => execution.account === trade.account
        && execution.symbol === trade.symbol
        && execution.executionId === trade.executionIds.at(-1));
      issues.push(issue("error", "PNL_VARIANCE", "Provided P&L does not reconcile", `${trade.symbol}: computed $${trade.netPnl.toFixed(2)} versus provided $${trade.reportedNetPnl.toFixed(2)}.`, row));
    }
  }

  const severityRank = { error: 0, warning: 1, info: 2 };
  issues.sort((left, right) => severityRank[left.severity] - severityRank[right.severity] || (left.rowNumber ?? 0) - (right.rowNumber ?? 0));
  const grossPnl = roundTrips.reduce((total, trade) => total + trade.grossPnl, 0);
  const fees = roundTrips.reduce((total, trade) => total + trade.fees, 0);
  const netPnl = roundTrips.reduce((total, trade) => total + trade.netPnl, 0);
  const pnlVariance = roundTrips.reduce((total, trade) => total + (Number.isFinite(trade.pnlVariance) ? Math.abs(trade.pnlVariance) : 0), 0);
  const pnlComparisonCount = roundTrips.filter((trade) => Number.isFinite(trade.pnlVariance)).length;
  const executionsCalculated = roundTrips.reduce((total, trade) => total + trade.executionCount, 0);
  const openPositionExecutionCount = openPositions.reduce((total, position) => total + position.executionIds.length, 0);
  const rejectedCount = rows.length - accepted.length;
  const unaccountedRowCount = rows.length
    - rejectedCount
    - executionsCalculated
    - openPositionExecutionCount
    - calculationExcludedCount;

  return {
    rowsReceived: rows.length,
    executionsAccepted: accepted.length,
    executionsCalculated,
    openPositionExecutionCount,
    rejectedCount,
    calculationExcludedCount,
    unaccountedRowCount,
    duplicateCount: issues.filter((item) => item.code === "DUPLICATE_EXECUTION").length,
    errorCount: issues.filter((item) => item.severity === "error").length,
    warningCount: issues.filter((item) => item.severity === "warning").length,
    ruleBreaches: issues.filter((item) => item.code === "RISK_LIMIT").length,
    grossPnl,
    fees,
    netPnl,
    pnlVariance,
    pnlComparisonCount,
    roundTrips,
    openPositions,
    issues,
    accepted,
  };
}

export function auditCsv(text) {
  return auditExecutions(parseExecutionCsv(text));
}

export function issuesToCsv(issues) {
  const headers = ["severity", "code", "row", "execution_id", "symbol", "issue", "detail"];
  const escape = (value) => {
    const stringValue = String(value ?? "");
    const neutralized = /^[\t\r\n]*[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue;
    return `"${neutralized.replace(/"/g, '""')}"`;
  };
  const rows = issues.map((item) => [item.severity, item.code, item.rowNumber, item.executionId, item.symbol, item.title, item.detail]);
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}
