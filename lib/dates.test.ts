import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addCalendarDaysYmd,
  calendarDaysUntilMexicoCity,
  endOfMexicoCityDay,
  mexicoCityOffsetIso,
  mexicoCityTodayYmd,
  startOfMexicoCityDay,
  ymdAtMexicoCityNoonIso,
  ymdInMexicoCity,
} from "./dates.ts";

test("Mexico City offset is UTC-6", () => {
  assert.equal(mexicoCityOffsetIso("2026-08-25"), "-06:00");
});

test("end of CDMX day is 05:59:59.999Z next UTC morning", () => {
  assert.equal(endOfMexicoCityDay("2026-08-25"), "2026-08-26T05:59:59.999Z");
});

test("start of CDMX day is 06:00:00.000Z", () => {
  assert.equal(startOfMexicoCityDay("2026-08-25"), "2026-08-25T06:00:00.000Z");
});

test("roundtrip: 25 Aug end-of-day → ymd stays 25 Aug", () => {
  const iso = endOfMexicoCityDay("2026-08-25");
  assert.equal(ymdInMexicoCity(iso), "2026-08-25");
});

test("19:00 CDMX is still that calendar day, not the UTC next day", () => {
  // 25 Aug 2026 19:00 CDMX = 26 Aug 01:00 UTC
  const evening = new Date("2026-08-26T01:00:00.000Z");
  assert.equal(ymdInMexicoCity(evening), "2026-08-25");
  assert.notEqual(evening.toISOString().slice(0, 10), "2026-08-25");
});

test("noon CDMX for paid_at stays on the same calendar day", () => {
  const iso = ymdAtMexicoCityNoonIso("2026-08-25");
  assert.equal(iso, "2026-08-25T18:00:00.000Z");
  assert.equal(ymdInMexicoCity(iso), "2026-08-25");
});

test("calendarDaysUntil is CDMX dates, not UTC ceil", () => {
  const end = endOfMexicoCityDay("2026-08-25");
  const morningCdmx = new Date("2026-08-25T15:00:00.000Z"); // 09:00 CDMX 25 Aug
  assert.equal(calendarDaysUntilMexicoCity(end, morningCdmx), 0);
  const nextMorning = new Date("2026-08-26T15:00:00.000Z"); // 09:00 CDMX 26 Aug
  assert.equal(calendarDaysUntilMexicoCity(end, nextMorning), -1);
});

test("mexicoCityTodayYmd at 19:00 CDMX matches that local day", () => {
  const evening = new Date("2026-08-26T01:00:00.000Z");
  assert.equal(mexicoCityTodayYmd(evening), "2026-08-25");
});

test("addCalendarDaysYmd", () => {
  assert.equal(addCalendarDaysYmd("2026-08-25", 1), "2026-08-26");
  assert.equal(addCalendarDaysYmd("2026-08-01", -1), "2026-07-31");
});
