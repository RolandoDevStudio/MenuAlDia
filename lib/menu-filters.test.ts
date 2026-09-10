import assert from "node:assert/strict";
import { test } from "node:test";
import {
  comboMatchesFilters,
  countActiveMenuFilters,
  dishMatchesFilters,
  emptyMenuFilters,
  menuFiltersNarrow,
  sortMenuItems,
} from "./menu-filters.ts";

test("dishMatchesFilters matches name tokens and price range", () => {
  const taco = {
    name: "Tacos al pastor",
    description: "Con piña",
    price: 80,
    category_id: "cat-1",
    is_popular: true,
  };
  assert.equal(
    dishMatchesFilters(taco, { ...emptyMenuFilters, query: "pastor" }),
    true,
  );
  assert.equal(
    dishMatchesFilters(taco, { ...emptyMenuFilters, query: "sushi" }),
    false,
  );
  assert.equal(
    dishMatchesFilters(taco, { ...emptyMenuFilters, presupuestoMax: 50 }),
    false,
  );
  assert.equal(
    dishMatchesFilters(taco, { ...emptyMenuFilters, presupuestoMin: 70, presupuestoMax: 90 }),
    true,
  );
  assert.equal(
    dishMatchesFilters(taco, {
      ...emptyMenuFilters,
      categoryIds: ["cat-2"],
    }),
    false,
  );
  assert.equal(
    dishMatchesFilters(taco, { ...emptyMenuFilters, popularOnly: true }),
    true,
  );
});

test("comboMatchesFilters hides combos when category or popular is on", () => {
  const combo = {
    title: "Combo pastor",
    description: "",
    price: 120,
    itemNames: "Tacos al pastor",
  };
  assert.equal(comboMatchesFilters(combo, emptyMenuFilters), true);
  assert.equal(
    comboMatchesFilters(combo, { ...emptyMenuFilters, popularOnly: true }),
    false,
  );
  assert.equal(
    comboMatchesFilters(combo, { ...emptyMenuFilters, categoryIds: ["cat-1"] }),
    false,
  );
  assert.equal(
    comboMatchesFilters(combo, { ...emptyMenuFilters, query: "pastor" }),
    true,
  );
});

test("legacy filters without categoryIds do not throw", () => {
  const taco = { name: "Tacos", description: "", price: 80 };
  const legacy = {
    query: "",
    presupuestoMin: null,
    presupuestoMax: null,
    comensales: null,
    tags: undefined,
  } as unknown as import("./menu-filters.ts").MenuSearchFilters;
  assert.equal(dishMatchesFilters(taco, legacy), true);
  assert.equal(menuFiltersNarrow(legacy), false);
});

test("sortMenuItems and filter counts", () => {
  const items = [
    { name: "B", price: 30 },
    { name: "A", price: 90 },
  ];
  assert.deepEqual(
    sortMenuItems(items, "name", (i) => i.name, (i) => i.price).map((i) => i.name),
    ["A", "B"],
  );
  assert.deepEqual(
    sortMenuItems(items, "price_asc", (i) => i.name, (i) => i.price).map((i) => i.price),
    [30, 90],
  );
  assert.equal(menuFiltersNarrow(emptyMenuFilters), false);
  assert.equal(
    countActiveMenuFilters({
      ...emptyMenuFilters,
      query: "tacos",
      presupuestoMax: 100,
    }),
    1,
  );
});
