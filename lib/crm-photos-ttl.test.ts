import assert from "node:assert/strict";
import { test } from "node:test";
import { purgeExpiredCustomerPhotos } from "./crm-photos-ttl.ts";

type PhotoRow = { id: string; storage_path: string };

function mockAdmin(opts: {
  batches?: PhotoRow[][];
  selectError?: { message: string };
  removeError?: { message: string };
  deleteError?: { message: string };
  removed?: string[][];
  deleted?: string[][];
}) {
  const batches = [...(opts.batches ?? [])];
  return {
    from() {
      return {
        select() {
          return {
            lte() {
              return {
                async limit() {
                  if (opts.selectError) {
                    return { data: null, error: opts.selectError };
                  }
                  const next = batches.shift() ?? [];
                  return { data: next, error: null };
                },
              };
            },
          };
        },
        delete() {
          return {
            async in(_col: string, ids: string[]) {
              opts.deleted?.push(ids);
              return { error: opts.deleteError ?? null };
            },
          };
        },
      };
    },
    storage: {
      from() {
        return {
          async remove(paths: string[]) {
            opts.removed?.push(paths);
            return { error: opts.removeError ?? null };
          },
        };
      },
    },
  };
}

test("purgeExpiredCustomerPhotos removes storage then rows", async () => {
  const removed: string[][] = [];
  const deleted: string[][] = [];
  const n = await purgeExpiredCustomerPhotos(
    mockAdmin({
      batches: [
        [
          { id: "a", storage_path: "r/crm/c/1.webp" },
          { id: "b", storage_path: "r/crm/c/2.webp" },
        ],
      ],
      removed,
      deleted,
    }) as never,
  );
  assert.equal(n, 2);
  assert.deepEqual(removed, [["r/crm/c/1.webp", "r/crm/c/2.webp"]]);
  assert.deepEqual(deleted, [["a", "b"]]);
});

test("purgeExpiredCustomerPhotos keeps rows if storage remove fails", async () => {
  const deleted: string[][] = [];
  const n = await purgeExpiredCustomerPhotos(
    mockAdmin({
      batches: [[{ id: "a", storage_path: "r/crm/c/1.webp" }]],
      removeError: { message: "storage down" },
      deleted,
    }) as never,
  );
  assert.equal(n, 0);
  assert.deepEqual(deleted, []);
});
