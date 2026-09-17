// Run with: node --experimental-strip-types --test tests/tab-calc.test.mjs (Node.js 22.6+)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  balanceMessage,
  buildCsv,
  canClose,
  describeAudit,
  canDeleteRecord,
  formatMoney,
  guestRows,
  guestTotals,
  matchesSearch,
  openSummary,
  parseAmount,
  resolvePaymentAmount,
  statusAfterLine,
  statusAfterPayment,
  statusAfterPaymentRemoved,
  summarize,
} from "../lib/tab/calc.ts";

const lines = [
  { id: "l1", guestId: "a", menuItemId: null, name: "Bira", price: 20000, qty: 2, station: "bar", complimentary: false, createdBy: "u-bar", createdByName: "Bar", createdAt: "2026-09-19T18:05:00.000Z" },
  { id: "l2", guestId: "a", menuItemId: null, name: "Pizza dilim", price: 25000, qty: 1, station: "pizza", complimentary: false, createdBy: "u-pizza", createdByName: "Pizza", createdAt: "2026-09-19T18:10:00.000Z" },
  { id: "l3", guestId: "b", menuItemId: null, name: "Kokteyl", price: 40000, qty: 1, station: "bar", complimentary: false, createdBy: "u-bar", createdByName: "Bar", createdAt: "2026-09-19T18:20:00.000Z" },
];
const payments = [
  { id: "p1", guestId: "a", amount: 30000, method: "cash", accountId: null, accountLabel: null, createdBy: "u-bar", createdByName: "Bar", createdAt: "2026-09-19T19:00:00.000Z" },
  { id: "p2", guestId: "b", amount: 40000, method: "iban", accountId: "acc-1", accountLabel: "Merve", createdBy: "u-bar", createdByName: "Bar", createdAt: "2026-09-19T19:30:00.000Z" },
];
const accounts = [
  { id: "acc-1", label: "Merve", iban: "TR00 1", active: true, sortOrder: 1 },
  { id: "acc-2", label: "Can", iban: "TR00 2", active: true, sortOrder: 2 },
];
const guests = [
  { id: "a", name: "Şule Çınar", status: "open", category: "paid", discountPercent: 0, pendingMethod: null, pendingAccountId: null, pendingAccountLabel: null, createdAt: "2026-09-19T17:00:00.000Z" },
  { id: "b", name: "Ali Işık", status: "closed", category: null, discountPercent: 0, pendingMethod: null, pendingAccountId: null, pendingAccountLabel: null, createdAt: "2026-09-19T17:00:00.000Z" },
];

test("total, paid and due are derived from lines and payments", () => {
  assert.deepEqual(guestTotals(lines, payments, "a"), { subtotal: 65000, complimentary: 0, discount: 0, total: 65000, paid: 30000, due: 35000, count: 2 });
  assert.deepEqual(guestTotals(lines, payments, "b"), { subtotal: 40000, complimentary: 0, discount: 0, total: 40000, paid: 40000, due: 0, count: 1 });
  assert.deepEqual(guestTotals(lines, payments, "nobody").total, 0);
});

test("discounts and complimentary lines reduce what is owed", () => {
  const withComp = [...lines, { id: "l4", guestId: "a", menuItemId: null, name: "Shot", price: 20000, qty: 1, station: "bar", complimentary: true, createdBy: "u-bar", createdByName: "Bar", createdAt: "2026-09-19T18:30:00.000Z" }];
  const t = guestTotals(withComp, payments, "a", 20);
  assert.equal(t.subtotal, 65000);
  assert.equal(t.complimentary, 20000, "complimentary value is tracked, not charged");
  assert.equal(t.discount, 13000, "20% of the subtotal");
  assert.equal(t.total, 52000);
  assert.equal(t.due, 22000);
  assert.equal(t.count, 3);
});

test("a payment closes the tab only when closing was requested and nothing is left", () => {
  assert.equal(statusAfterPayment(0, true), "closed");
  assert.equal(statusAfterPayment(-500, true), "closed");
  assert.equal(statusAfterPayment(100, true), "open");
  assert.equal(statusAfterPayment(0, false), "open", "paying in round one keeps the tab open");
});

test("adding a line always reopens; removing a payment reopens only when a balance remains", () => {
  assert.equal(statusAfterLine(), "open");
  assert.equal(statusAfterPaymentRemoved("closed", 20000), "open");
  assert.equal(statusAfterPaymentRemoved("closed", 0), "closed");
  assert.equal(statusAfterPaymentRemoved("open", 0), "open");
});

test("manual close is only allowed on an open tab with nothing owed", () => {
  assert.equal(canClose("open", 0), true);
  assert.equal(canClose("open", -100), true);
  assert.equal(canClose("open", 1), false);
  assert.equal(canClose("closed", 0), false);
});

test("empty payment amount takes the whole balance; invalid amounts are refused", () => {
  assert.deepEqual(resolvePaymentAmount(null, 35000), { amount: 35000 });
  assert.deepEqual(resolvePaymentAmount(10000, 35000), { amount: 10000 });
  assert.ok("error" in resolvePaymentAmount(null, 0));
  assert.ok("error" in resolvePaymentAmount(0, 35000));
  assert.ok("error" in resolvePaymentAmount(-5, 35000));
  assert.ok("error" in resolvePaymentAmount(12.5, 35000));
});

test("Turkish decimal input parses to kuruş", () => {
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("  "), null);
  assert.equal(parseAmount("250"), 25000);
  assert.equal(parseAmount("12,50"), 1250);
  assert.equal(parseAmount("12.50"), 1250);
  assert.equal(parseAmount("1.250"), 125000);
  assert.equal(parseAmount("1.250,75"), 125075);
  assert.equal(parseAmount("abc"), undefined);
  assert.equal(parseAmount("-5"), undefined);
});

test("money formats as tr-TR lira", () => {
  assert.equal(formatMoney(125000), "1.250 ₺");
  assert.equal(formatMoney(1250), "12,50 ₺");
  assert.equal(formatMoney(0), "0 ₺");
});

test("search ignores case and Turkish diacritics", () => {
  assert.ok(matchesSearch("Şule Çınar", "sule"));
  assert.ok(matchesSearch("Şule Çınar", "ÇINAR"));
  assert.ok(matchesSearch("Ali Işık", "isik"));
  assert.ok(matchesSearch("İrem", "irem"));
  assert.ok(!matchesSearch("Ali Işık", "sule"));
  assert.ok(matchesSearch("Ali Işık", ""));
});

test("guest rows filter by status and sort alphabetically with totals", () => {
  const data = { guests, lines, payments };
  assert.deepEqual(guestRows(data, "all", "").map((g) => g.name), ["Ali Işık", "Şule Çınar"]);
  assert.deepEqual(guestRows(data, "open", "").map((g) => g.id), ["a"]);
  assert.deepEqual(guestRows(data, "closed", "").map((g) => g.id), ["b"]);
  assert.equal(guestRows(data, "all", "sule")[0].due, 35000);
});

test("only the person who entered a record or an admin may delete it", () => {
  const record = { createdBy: "u-bar" };
  assert.ok(canDeleteRecord({ id: "u-bar", role: "bar" }, record));
  assert.ok(canDeleteRecord({ id: "u-admin", role: "admin" }, record));
  assert.ok(!canDeleteRecord({ id: "u-pizza", role: "pizza" }, record));
  assert.ok(!canDeleteRecord({ id: "u-bar", role: "bar" }, { createdBy: null }));
});

test("summary groups by method, station and item, and lists debtors", () => {
  const s = summarize({ guests, lines, payments });
  assert.equal(s.total, 105000);
  assert.equal(s.paid, 70000);
  assert.equal(s.due, 35000);
  assert.deepEqual(s.byMethod, { cash: 30000, iban: 40000, pos: 0 });
  assert.deepEqual(s.byStation, { bar: 80000, pizza: 25000 });
  assert.deepEqual(s.byItem, [
    { name: "Bira", qty: 2, complimentaryQty: 0, amount: 40000, station: "bar" },
    { name: "Kokteyl", qty: 1, complimentaryQty: 0, amount: 40000, station: "bar" },
    { name: "Pizza dilim", qty: 1, complimentaryQty: 0, amount: 25000, station: "pizza" },
  ]);
  assert.equal(s.gross, 105000);
  assert.equal(s.discount, 0);
  assert.equal(s.complimentary, 0);
  const discounted = summarize({ guests: [{ ...guests[0], discountPercent: 50 }, guests[1]], lines, payments });
  assert.equal(discounted.discount, 32500);
  assert.equal(discounted.total, 72500);
  assert.equal(discounted.debtors[0].due, 2500);
  assert.deepEqual(s.debtors, [{ id: "a", name: "Şule Çınar", due: 35000 }]);
  assert.deepEqual(summarize({ guests, lines, payments, accounts }).byAccount, [
    { id: "acc-1", label: "Merve", iban: "TR00 1", amount: 40000, count: 1 },
    { id: "acc-2", label: "Can", iban: "TR00 2", amount: 0, count: 0 },
  ]);
});

test("CSV uses semicolons, decimal commas, and one row per line and payment", () => {
  const csv = buildCsv({ guests, lines, payments });
  const rows = csv.trim().split("\r\n");
  assert.equal(rows[0], "tip;misafir;urun;adet;fiyat;tutar;istasyon_veya_yontem;iban_hesabi;kullanici;zaman");
  assert.equal(rows.length, 1 + lines.length + payments.length);
  const comp = buildCsv({ guests: [{ ...guests[0], discountPercent: 10 }], lines: [{ ...lines[0], complimentary: true }, lines[1]], payments: [] });
  assert.ok(comp.includes("ikram;Şule Çınar;Bira;2;200,00;0,00;bar;;Bar;"), "complimentary lines are charged as 0");
  assert.ok(comp.includes("indirim;Şule Çınar;%10 indirim;;;-25,00;"), "discount rows appear per guest as a negative amount");
  assert.equal(rows[1], "satis;Şule Çınar;Bira;2;200,00;400,00;bar;;Bar;2026-09-19 21:05:00");
  assert.ok(rows.some((r) => r.startsWith("odeme;Ali Işık;;;;400,00;iban;Merve;Bar;")));
  const quoted = buildCsv({ guests: [{ ...guests[0], name: 'A "B"; C' }], lines: lines.slice(0, 1), payments: [] });
  assert.ok(quoted.includes('"A ""B""; C"'));
});

test("open summary counts open tabs and the balance still owed", () => {
  assert.deepEqual(openSummary({ guests, lines, payments }), { open: 1, due: 35000 });
  assert.deepEqual(openSummary({ guests: [], lines: [], payments: [] }), { open: 0, due: 0 });
});

test("deletion log entries read as short Turkish sentences", () => {
  assert.equal(
    describeAudit({ action: "line.delete", guestName: "Şule Çınar", record: { name: "Bira", price: 20000, qty: 2 } }),
    "Şule Çınar: Bira ×2 · 400 ₺",
  );
  assert.equal(
    describeAudit({ action: "payment.delete", guestName: null, record: { amount: 1250, method: "iban" } }),
    "Silinmiş misafir: IBAN ödemesi · 12,50 ₺",
  );
  assert.equal(
    describeAudit({ action: "guest.delete", guestName: "Ali", record: { lines: [{}, {}], payments: [] } }),
    "Ali: misafir silindi (2 kalem, 0 ödeme)",
  );
});

test("balance message carries name, balance and IBAN text", () => {
  assert.equal(balanceMessage("Ali Işık", 35000, "Ad Soyad · TR00"), "Ali Işık · Kalan 350 ₺\nAd Soyad · TR00");
});
