import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatClabeDisplay,
  publicTransferDetails,
  sanitizePublicRestaurantTransfer,
  transferWhatsAppLines,
} from "./transfer-details.ts";

test("publicTransferDetails requires toggle and 18-digit CLABE", () => {
  assert.equal(
    publicTransferDetails({
      show_transfer_details: false,
      bank_account_holder: "Ana",
      bank_name: "BBVA",
      bank_clabe: "012345678901234567",
    }),
    null,
  );
  assert.equal(
    publicTransferDetails({
      show_transfer_details: true,
      bank_account_holder: "Ana",
      bank_name: "BBVA",
      bank_clabe: "01234567890123456",
    }),
    null,
  );
  assert.deepEqual(
    publicTransferDetails({
      show_transfer_details: true,
      bank_account_holder: " Ana ",
      bank_name: "BBVA",
      bank_clabe: "0123 4567 8901 2345 67",
    }),
    {
      holder: "Ana",
      bank: "BBVA",
      clabe: "012345678901234567",
    },
  );
});

test("formatClabeDisplay groups in fours", () => {
  assert.equal(
    formatClabeDisplay("012345678901234567"),
    "0123 4567 8901 2345 67",
  );
});

test("transferWhatsAppLines asks for CLABE when details are missing", () => {
  const lines = transferWhatsAppLines({
    show_transfer_details: false,
    bank_clabe: "012345678901234567",
  });
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /¿me puedes compartir los datos para transferir/);
});

test("transferWhatsAppLines includes CLABE and receipt instruction", () => {
  const lines = transferWhatsAppLines({
    show_transfer_details: true,
    bank_account_holder: "Ana Pérez",
    bank_name: "BBVA",
    bank_clabe: "012345678901234567",
  });
  assert.deepEqual(lines, [
    "Titular: Ana Pérez",
    "Banco: BBVA",
    "CLABE: 012345678901234567",
    "Envía tu comprobante en este chat.",
  ]);
});

test("sanitizePublicRestaurantTransfer hides draft CLABE", () => {
  const hidden = sanitizePublicRestaurantTransfer({
    show_transfer_details: false,
    bank_account_holder: "Ana",
    bank_name: "BBVA",
    bank_clabe: "012345678901234567",
  });
  assert.equal(hidden.bank_clabe, "");
  assert.equal(hidden.show_transfer_details, false);

  const shown = sanitizePublicRestaurantTransfer({
    show_transfer_details: true,
    bank_account_holder: " Ana ",
    bank_name: "BBVA",
    bank_clabe: "012345678901234567",
  });
  assert.equal(shown.bank_clabe, "012345678901234567");
  assert.equal(shown.bank_account_holder, "Ana");
});
