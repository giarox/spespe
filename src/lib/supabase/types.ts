import type { Tables } from "@/lib/database.types";

export type Chain = Tables<"chains">;
export type Store = Tables<"stores">;
export type Product = Tables<"products">;
export type Offer = Tables<"offers">;
export type Flyer = Tables<"flyers">;
export type FlyerPage = Tables<"flyer_pages">;
export type FlyerRun = Tables<"flyer_runs">;

export type OfferWithRelations = Offer & {
  product: Product | null;
  store: (Store & { chain: Chain | null }) | null;
};
