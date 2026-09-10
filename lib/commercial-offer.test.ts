import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addFreeMonthsToDate,
  buildOfferFromPreset,
  FALLBACK_FOUNDING_PARTNER_PRICES,
  hasActiveCommercialOffer,
  isInCommercialCourtesyPeriod,
  resolveEffectiveMonthlyPrice,
} from "./commercial-offer.ts";

const LIST = {
  catalog: { monthly: 199, annual: 1990 },
  daily: { monthly: 349, annual: 3490 },
  pro: { monthly: 599, annual: 5990 },
};

describe("commercial-offer", () => {
  it("resolves list price when no offer", () => {
    const price = resolveEffectiveMonthlyPrice(
      { plan_type: "pro", commercial_offer_kind: "none" },
      LIST,
    );
    assert.equal(price, 599);
  });

  it("resolves frozen offer price when active", () => {
    const price = resolveEffectiveMonthlyPrice(
      {
        plan_type: "pro",
        commercial_offer_kind: "founding",
        commercial_monthly_price: 120,
        commercial_duration: "lifetime",
      },
      LIST,
    );
    assert.equal(price, 120);
  });

  it("detects courtesy before first payment", () => {
    const end = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const r = {
      commercial_offer_kind: "founding",
      commercial_monthly_price: 120,
      commercial_free_months: 1,
      commercial_duration: "lifetime",
      subscription_end_date: end,
    };
    assert.equal(isInCommercialCourtesyPeriod(r, false), true);
    assert.equal(isInCommercialCourtesyPeriod(r, true), false);
    assert.equal(hasActiveCommercialOffer(r), true);
  });

  it("adds free months to subscription end", () => {
    const from = new Date("2026-09-10T12:00:00.000Z");
    const withFree = addFreeMonthsToDate(from, 1);
    const without = addFreeMonthsToDate(from, 0);
    assert.equal(
      withFree.getTime() - from.getTime(),
      30 * 24 * 60 * 60 * 1000,
    );
    assert.equal(
      without.getTime() - from.getTime(),
      30 * 24 * 60 * 60 * 1000,
    );
  });

  it("builds founding preset snapshot", () => {
    const offer = buildOfferFromPreset({
      kind: "founding",
      planType: "daily",
      foundingPrices: FALLBACK_FOUNDING_PARTNER_PRICES,
    });
    assert.equal(offer.commercial_offer_kind, "founding");
    assert.equal(offer.commercial_monthly_price, 80);
    assert.equal(offer.commercial_free_months, 1);
  });
});
