import { Store } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { setMerchantStatusAction } from "@/app/actions/admin";
import { COMMISSION_PLAN_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminMerchantsPage() {
  const session = await getSession();
  const canManage = session?.role === "ADMIN";
  const merchants = await db.merchant.findMany({
    include: {
      owner: { select: { name: true, email: true } },
      stores: { select: { name: true, comuna: true, status: true } },
      _count: { select: { stores: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          Red de locales
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
          Locales
        </h1>
        <p className="mt-1 text-sm text-muted">
          {merchants.length} locales registrados · verifica documentos y activa la operación.
        </p>
      </div>

      {merchants.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No hay locales registrados"
          description="Cuando una cocina se registre, aparecerá aquí para verificación."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Local</th>
                  <th>Responsable</th>
                  <th>Sucursales</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Registro</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map((merchant) => (
                  <tr key={merchant.id}>
                    <td>
                      <p className="text-xs font-semibold">{merchant.name}</p>
                      <p className="text-[10px] text-muted">
                        {merchant.stores[0]?.comuna ?? "Sin comuna"} · {merchant._count.stores} sucursales
                      </p>
                    </td>
                    <td>
                      <p className="text-xs">{merchant.owner.name}</p>
                      <p className="text-[10px] text-muted">{merchant.owner.email}</p>
                    </td>
                    <td className="text-xs">
                      {merchant.stores.map((store) => store.name).join(", ") || "—"}
                    </td>
                    <td className="text-xs text-muted">
                      {COMMISSION_PLAN_LABELS[merchant.commissionPlan] ?? merchant.commissionPlan}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          merchant.status === "VERIFIED"
                            ? "badge-success"
                            : merchant.status === "SUSPENDED"
                              ? "badge-danger"
                              : "badge-primary"
                        }`}
                      >
                        {merchant.status === "VERIFIED"
                          ? "Verificado"
                          : merchant.status === "SUSPENDED"
                            ? "Suspendido"
                            : "Pendiente"}
                      </span>
                    </td>
                    <td className="text-xs text-muted">{formatDateTime(merchant.createdAt)}</td>
                    <td className="text-right">
                      {canManage ? (
                        <div className="flex justify-end gap-1">
                          {merchant.status !== "VERIFIED" && (
                            <form action={setMerchantStatusAction}>
                              <input type="hidden" name="merchantId" value={merchant.id} />
                              <input type="hidden" name="status" value="VERIFIED" />
                              <button type="submit" className="btn btn-success btn-sm text-[10px]">
                                Verificar
                              </button>
                            </form>
                          )}
                          {merchant.status !== "SUSPENDED" && (
                            <form action={setMerchantStatusAction}>
                              <input type="hidden" name="merchantId" value={merchant.id} />
                              <input type="hidden" name="status" value="SUSPENDED" />
                              <button type="submit" className="btn btn-danger btn-sm text-[10px]">
                                Suspender
                              </button>
                            </form>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
