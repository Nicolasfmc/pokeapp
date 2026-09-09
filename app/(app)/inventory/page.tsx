import type { Metadata } from "next";
import { getSession } from "@/server/auth";
import { listInventoryItems } from "@/server/services/inventory";
import { InventoryPanel } from "@/modules/inventory";

export const metadata: Metadata = {
  title: "Inventory",
};

export default async function InventoryPage() {
  const session = await getSession();
  const items = session ? await listInventoryItems(session.id) : [];

  return (
    <section className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4">
      <InventoryPanel initialItems={items} />
    </section>
  );
}
