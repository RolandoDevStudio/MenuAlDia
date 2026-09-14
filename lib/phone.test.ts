import assert from "node:assert/strict";
import { test } from "node:test";
import { mx10ToWaE164, normalizeMxPhone, waIdToMx10 } from "./phone.ts";

test("strips separators to 10 digits", () => {
  assert.equal(normalizeMxPhone("(55) 1234-5678"), "5512345678");
  assert.equal(normalizeMxPhone("55 1234 5678"), "5512345678");
});

test("strips +52 and 521 country prefixes", () => {
  assert.equal(normalizeMxPhone("+52 55 1234 5678"), "5512345678");
  assert.equal(normalizeMxPhone("5215512345678"), "5512345678");
});

test("rejects short or junk values", () => {
  assert.equal(normalizeMxPhone("551234"), null);
  assert.equal(normalizeMxPhone(""), null);
  assert.equal(normalizeMxPhone("abc"), null);
});

test("waIdToMx10 and mx10ToWaE164 round-trip", () => {
  assert.equal(waIdToMx10("5215512345678"), "5512345678");
  assert.equal(waIdToMx10("525512345678"), "5512345678");
  assert.equal(mx10ToWaE164("5512345678"), "525512345678");
  assert.equal(mx10ToWaE164("bad"), null);
});
