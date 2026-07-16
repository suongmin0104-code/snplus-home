import assert from "node:assert/strict";

import { summarizeTaxForecast, summarizeTaxWorkspace } from "../lib/tax-store.js";

const transactions = [
  { date: "2026-07-02", direction: "income", amount: 5000000, evidenceStatus: "attached" },
  { date: "2026-07-05", direction: "expense", amount: 1200000, evidenceStatus: "missing" },
  { date: "2026-06-30", direction: "income", amount: 900000, evidenceStatus: "missing" }
];
const tasks = [
  { dueDate: "2026-07-10", done: false },
  { dueDate: "2026-07-20", done: false },
  { dueDate: "2026-07-01", done: true }
];

assert.deepEqual(summarizeTaxWorkspace(transactions, tasks, "2026-07", "2026-07-16"), {
  month: "2026-07",
  income: 5000000,
  expense: 1200000,
  balance: 3800000,
  transactionCount: 2,
  missingEvidence: 2,
  pendingTasks: 2,
  overdueTasks: 1
});

assert.equal(summarizeTaxWorkspace(transactions, tasks, "invalid", "2026-07-16").month, "2026-07");

assert.deepEqual(summarizeTaxForecast({
  id: "forecast-2026-07",
  month: "2026-07",
  vatAmount: 720000,
  withholdingAmount: 180000,
  corporateTaxAmount: 1200000,
  otherTaxAmount: 30000,
  reviewStatus: "advisor-reviewed",
  memo: "세무사 확인",
  updatedAt: "2026-07-16T03:00:00.000Z",
  updatedBy: "01071006221"
}, "2026-07"), {
  month: "2026-07",
  saved: true,
  version: "",
  vatAmount: 720000,
  withholdingAmount: 180000,
  corporateTaxAmount: 1200000,
  otherTaxAmount: 30000,
  reviewStatus: "advisor-reviewed",
  memo: "세무사 확인",
  updatedAt: "2026-07-16T03:00:00.000Z",
  updatedBy: "01071006221",
  totalAmount: 2130000,
  hasValues: true
});

assert.deepEqual(summarizeTaxForecast(null, "2026-08"), {
  month: "2026-08",
  saved: false,
  version: "",
  vatAmount: 0,
  withholdingAmount: 0,
  corporateTaxAmount: 0,
  otherTaxAmount: 0,
  reviewStatus: "estimate",
  memo: "",
  updatedAt: "",
  updatedBy: "",
  totalAmount: 0,
  hasValues: false
});

console.log("Tax workspace tests passed.");
