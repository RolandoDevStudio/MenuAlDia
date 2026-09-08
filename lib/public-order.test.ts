import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PUBLIC_ORDER_TOKEN_RE,
  sanitizePublicCartItems,
} from "./public-order-sanitize.ts";

test("rejects short or unsafe tokens", () => {
  assert.equal(PUBLIC_ORDER_TOKEN_RE.test("abc"), false);
  assert.equal(PUBLIC_ORDER_TOKEN_RE.test("token with space"), false);
  assert.equal(PUBLIC_ORDER_TOKEN_RE.test("a".repeat(65)), false);
  assert.equal(PUBLIC_ORDER_TOKEN_RE.test("AbC_-012345"), true);
});

test("sanitizePublicCartItems drops junk and keeps lines", () => {
  const items = sanitizePublicCartItems([
    null,
    { name: "Tacos", dishId: "d1", unitPrice: 50, quantity: 2 },
    { name: "", unitPrice: 10, quantity: 1 },
    {
      name: "Latte",
      dishId: "d2",
      unitPrice: "65",
      quantity: 1,
      addons: [{ id: "a1", name: "Almendra", priceDelta: 15 }],
    },
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].name, "Tacos");
  assert.equal(items[0].quantity, 2);
  assert.equal(items[1].addons?.[0].name, "Almendra");
});
