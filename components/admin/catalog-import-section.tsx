"use client";

import { useRouter } from "next/navigation";
import { CatalogImportPanel } from "@/components/admin/catalog-import-panel";
import type { Category, Dish } from "@/lib/types";

type Props = {
  restaurantId: string;
  slug: string;
  categories: Category[];
  dishes: Pick<Dish, "id" | "name">[];
};

export function CatalogImportSection(props: Props) {
  const router = useRouter();
  return (
    <CatalogImportPanel
      {...props}
      onDone={() => {
        router.refresh();
      }}
    />
  );
}
