// Run with: node --experimental-strip-types --test tests/tab-calc.test.mjs (Node.js 22.6+)
import assert from "node:assert/strict";
import { test } from "node:test";
import { effectiveDiscount } from "../lib/tab/types.ts";
import {
  balanceMessage,
  buildCsv,
  canClose,
  describeAudit,
  canDeleteLine,
  canDeleteRecord,
  formatMoney,
  guestRows,
  guestTotals,
  matchesSearch,
  openSummary,
  parseAmount,
  pastRounds,
  resolvePaymentAmount,
  startsNewRound,
  statusAfterLine,
  statusAfterPayment,
  statusAfterPaymentRemoved,
  summarize,
} from "../lib/tab/calc.ts";

const lines = [
  { id: "l1", guestId: "a", menuItemId: null, name: "Bira", price: 20000, qty: 2, station: "bar", complimentary: false, discountPercent: 0, round: 1, createdBy: "u-bar", createdByName: "Bar", createdAt: "2026-09-19T18:05:00.000Z" },
  { id: "l2", guestId: "a", menuItemId: null, name: "Pizza dilim", price: 25000, qty: 1, station: "pizza", complimentary: false, discountPercent: 0, round: 1, createdBy: "u-pizza", createdByName: "Pizza", createdAt: "2026-09-19T18:10:00.000Z" },
  { id: "l3", guestId: "b", menuItemId: null, name: "Kokteyl", price: 40000, qty: 1, station: "bar", complimentary: false, discountPercent: 0, round: 1, createdBy: "u-bar", createdByName: "Bar", createdAt: "2026-09-19T18:20:00.000Z" },
];
const payments = [
  { id: "p1", guestId: "a", amount: 30000, method: "cash", accountId: null, accountLabel: null, round: 1, createdBy: "u-bar", createdByName: "Bar", createdAt: "2026-09-19T19:00:00.000Z" },
  { id: "p2", guestId: "b", amount: 40000, method: "iban", accountId: "acc-1", accountLabel: "Merve", round: 1, createdBy: "u-bar", createdByName: "Bar", createdAt: "2026-09-19T19:30:00.000Z" },
];
const accounts = [
  { id: "acc-1", label: "Merve", iban: "TR00 1", active: true, sortOrder: 1 },
  { id: "acc-2", label: "Can", iban: "TR00 2", active: true, sortOrder: 2 },
];
const guests = [
  { id: "a", name: "Şule Çınar", status: "open", category: "paid", discountOverride: null, discountPercent: 0, discountSource: null, pendingMethod: null, pendingAccountId: null, pendingAccountLabel: null, round: 1, createdAt: "2026-09-19T17:00:00.000Z" },
  { id: "b", name: "Ali Işık", status: "closed", category: null, discountOverride: null, discountPercent: 0, discountSource: null, pendingMethod: null, pendingAccountId: null, pendingAccountLabel: null, round: 1, createdAt: "2026-09-19T17:00:00.000Z" },
];

test("total, paid and due are derived from lines and payments", () => {
  assert.deepEqual(guestTotals(lines, payments, "a"), { subtotal: 65000, complimentary: 0, discount: 0, total: 65000, paid: 30000, due: 35000, count: 2 });
  assert.deepEqual(guestTotals(lines, payments, "b"), { subtotal: 40000, complimentary: 0, discount: 0, total: 40000, paid: 40000, due: 0, count: 1 });
  assert.deepEqual(guestTotals(lines, payments, "nobody").total, 0);
});

test("per-line discounts and complimentary lines reduce what is owed", () => {
  // The first bira line was added under a 20% discount, the pizza after the discount was removed.
  const withComp = [
    { ...lines[0], discountPercent: 20 },
    lines[1],
    { id: "l4", guestId: "a", menuItemId: null, name: "Shot", price: 20000, qty: 1, station: "bar", complimentary: true, discountPercent: 20, round: 1, createdBy: "u-bar", createdByName: "Bar", createdAt: "2026-09-19T18:30:00.000Z" },
    lines[2],
  ];
  const t = guestTotals(withComp, payments, "a");
  assert.equal(t.subtotal, 65000);
  assert.equal(t.complimentary, 20000, "complimentary value is tracked, not charged");
  assert.equal(t.discount, 8000, "20% of the 400 ₺ bira line only; the later pizza is undiscounted");
  assert.equal(t.total, 57000);
  assert.equal(t.due, 27000);
  assert.equal(t.count, 3);
});

test("effective discount: personal override beats personal rule beats type rule", () => {
  const rules = [
    { kind: "category", category: "team", guestId: null, percent: 35, label: "Ekip" },
    { kind: "guest", category: null, guestId: "a", percent: 50, label: "Dost" },
  ];
  assert.deepEqual(effectiveDiscount({ id: "a", category: "team", discountOverride: null }, rules), { percent: 50, source: "rule", label: "Dost" });
  assert.deepEqual(effectiveDiscount({ id: "b", category: "team", discountOverride: null }, rules), { percent: 35, source: "rule", label: "Ekip" });
  assert.deepEqual(effectiveDiscount({ id: "b", category: "team", discountOverride: 0 }, rules).percent, 0, "an explicit 0 removes the discount despite the rule");
  assert.deepEqual(effectiveDiscount({ id: "c", category: "paid", discountOverride: null }, rules).percent, 0);
  assert.deepEqual(effectiveDiscount({ id: "c", category: null, discountOverride: 15 }, rules).percent, 15);
});

test("a payment closes the tab only when closing was requested and nothing is left", () => {
  assert.equal(statusAfterPayment(0), "closed", "nothing owed closes the tab");
  assert.equal(statusAfterPayment(-500), "closed");
  assert.equal(statusAfterPayment(100), "open", "a balance keeps the tab open");
  assert.equal(startsNewRound("closed", { count: 2, paid: 500, due: 0 }), true);
  assert.equal(startsNewRound("open", { count: 2, paid: 500, due: 0 }), true, "a fully paid open tab also starts a new round");
  assert.equal(startsNewRound("open", { count: 2, paid: 100, due: 400 }), false);
  assert.equal(startsNewRound("open", { count: 1, paid: 0, due: 0 }), false, "complimentary-only open tab stays in its round");
  assert.equal(startsNewRound("closed", { count: 0, paid: 0, due: 0 }), false);
  assert.equal(startsNewRound("closed", { count: 1, paid: 900, due: -400 }), false, "credit is used by the next order");
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

test("guest rows: Açık shows only opened tabs, Hepsi everyone, search looks through everyone", () => {
  const idle = { ...guests[0], id: "c", name: "Zeynep Boş" };
  const data = { guests: [...guests, idle], lines, payments };
  assert.deepEqual(guestRows(data, "all", "").map((g) => g.name), ["Ali Işık", "Şule Çınar", "Zeynep Boş"]);
  assert.deepEqual(guestRows(data, "open", "").map((g) => g.id), ["a"], "a guest without any line or payment is not an open tab");
  assert.deepEqual(guestRows(data, "closed", "").map((g) => g.id), ["b"]);
  assert.deepEqual(guestRows(data, "open", "zeynep").map((g) => g.id), ["c"], "search ignores the filter");
  assert.equal(guestRows(data, "all", "sule")[0].due, 35000);
  assert.equal(guestRows(data, "all", "").find((g) => g.id === "c").active, false);
});

test("rounds: totals follow the current round and closed rounds become history", () => {
  const reopened = { ...guests[1], status: "open", round: 2 };
  const round2Lines = [...lines, { ...lines[2], id: "l9", round: 2, createdAt: "2026-09-19T22:00:00.000Z" }];
  const t = guestTotals(round2Lines, payments, "b", 2);
  assert.equal(t.total, 40000);
  assert.equal(t.paid, 0, "the earlier round's payment does not count for the new round");
  assert.equal(t.due, 40000);
  const history = pastRounds({ lines: round2Lines, payments }, reopened);
  assert.equal(history.length, 1);
  assert.equal(history[0].round, 1);
  assert.equal(history[0].totals.paid, 40000);
  assert.equal(history[0].lines.length, 1);
  assert.equal(guestTotals(round2Lines, payments, "b").total, 80000, "without a round, all rounds are summed (summary/CSV)");
  assert.deepEqual(openSummary({ guests: [guests[0], reopened], lines: round2Lines, payments }), { open: 2, due: 75000 });
});

test("only the person who entered a record or an admin may delete it", () => {
  const record = { createdBy: "u-bar" };
  assert.ok(canDeleteRecord({ id: "u-bar", role: "bar" }, record));
  assert.ok(canDeleteRecord({ id: "u-admin", role: "admin" }, record));
  assert.ok(!canDeleteRecord({ id: "u-pizza", role: "pizza" }, record));
  assert.ok(!canDeleteRecord({ id: "u-bar", role: "bar" }, { createdBy: null }));
});

test("any staff member may delete a wrongly entered line", () => {
  for (const role of ["admin", "bar", "pizza"]) assert.ok(canDeleteLine({ role }));
  assert.ok(!canDeleteLine({ role: "guest" }));
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
  const discounted = summarize({ guests, lines: lines.map((l) => (l.guestId === "a" ? { ...l, discountPercent: 50 } : l)), payments });
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
  const comp = buildCsv({ guests: [guests[0]], lines: [{ ...lines[0], complimentary: true }, { ...lines[1], discountPercent: 10 }], payments: [] });
  assert.ok(comp.includes("ikram;Şule Çınar;Bira;2;200,00;0,00;bar;;Bar;"), "complimentary lines are charged as 0");
  assert.ok(comp.includes("indirim;Şule Çınar;indirim;;;-25,00;"), "discount rows appear per guest as a negative amount");
  assert.equal(rows[1], "satis;Şule Çınar;Bira;2;200,00;400,00;bar;;Bar;2026-09-19 21:05:00");
  assert.ok(rows.some((r) => r.startsWith("odeme;Ali Işık;;;;400,00;iban;Merve;Bar;")));
  const quoted = buildCsv({ guests: [{ ...guests[0], name: 'A "B"; C' }], lines: lines.slice(0, 1), payments: [] });
  assert.ok(quoted.includes('"A ""B""; C"'));
});

test("open summary counts opened tabs only and the balance still owed", () => {
  assert.deepEqual(openSummary({ guests, lines, payments }), { open: 1, due: 35000 });
  assert.deepEqual(openSummary({ guests: [{ ...guests[0], id: "idle", name: "Boş" }], lines: [], payments: [] }), { open: 0, due: 0 });
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
  assert.equal(describeAudit({ action: "staff.create", guestName: null, record: { name: "Ece", role: "pizza" } }), "Personel girişi oluşturuldu: Ece (Yemek)");
  assert.equal(describeAudit({ action: "staff.rename", guestName: null, record: { from: "Ec", to: "Ece" } }), "Personel adı değişti: Ec → Ece");
  assert.equal(describeAudit({ action: "staff.code", guestName: null, record: { name: "Ece" } }), "Yeni giriş kodu: Ece");
  assert.equal(describeAudit({ action: "staff.active", guestName: null, record: { name: "Ece", active: false } }), "Personel girişi kapatıldı: Ece");
  assert.equal(describeAudit({ action: "discount.rules", guestName: null, record: { rules: [{}, {}] } }), "İndirim kuralları güncellendi (2 kural)");
});

test("balance message carries name, balance and IBAN text", () => {
  assert.equal(balanceMessage("Ali Işık", 35000, "Ad Soyad · TR00"), "Ali Işık · Kalan 350 ₺\nAd Soyad · TR00");
});
