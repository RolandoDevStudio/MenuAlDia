import assert from "node:assert/strict";
import { test } from "node:test";
import { looksLikePhrase } from "./menu-intent.ts";

test("short keyword search is not a phrase", () => {
  assert.equal(looksLikePhrase("tacos"), false);
  assert.equal(looksLikePhrase("pizza margarita"), false);
});

test("natural language orders count as phrases", () => {
  assert.equal(looksLikePhrase("quiero algo para 4 personas"), true);
  assert.equal(looksLikePhrase("somos 3 con presupuesto de 500 pesos"), true);
});
