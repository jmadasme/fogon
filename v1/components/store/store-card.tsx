import Link from "next/link";
import { Bike, Clock, Star } from "lucide-react";
import { formatCLP } from "@/lib/utils";
import { DELIVERY_BASE_FEE } from "@/lib/constants";

type StoreCardStore = {
  slug: string;
  name: string;
  cuisine: string;
  emoji: string;
  comuna: string;
  rating: number;
  ratingCount: number;
  prepTimeMin: number;
  coverUrl: string | null;
  minOrder: number;
};

export function StoreCard({ store }: { store: StoreCardStore }) {
  return (
    <Link
      href={`/store/${store.slug}`}
      className="group overflow-hidden rounded-xl border border-border bg-surface transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
    >
      <div
        className="relative h-40 w-full overflow-hidden bg-surface-3 bg-cover bg-center"
        style={
          store.coverUrl
            ? { backgroundImage: `url(${store.coverUrl})` }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          <span>{store.emoji}</span>
          {store.cuisine}
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="font-display text-lg font-bold tracking-tight text-white drop-shadow">
            {store.name}
          </h3>
          <p className="text-xs text-white/70">{store.comuna}</p>
        </div>
      </div>

      <div className="space-y-2 p-4">
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1 text-primary">
            <Star className="h-3.5 w-3.5 fill-primary" />
            <span className="font-mono-nums font-semibold">{store.rating.toFixed(1)}</span>
            <span className="text-muted">({store.ratingCount})</span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {store.prepTimeMin}–{store.prepTimeMin + 10} min
          </span>
          <span className="flex items-center gap-1">
            <Bike className="h-3.5 w-3.5" />
            {formatCLP(DELIVERY_BASE_FEE)}
          </span>
        </div>
        {store.minOrder > 0 && (
          <p className="text-[11px] text-muted">
            Pedido mínimo {formatCLP(store.minOrder)}
          </p>
        )}
      </div>
    </Link>
  );
}
