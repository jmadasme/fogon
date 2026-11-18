import { Bike } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { setCourierVerificationAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCouriersPage() {
  const session = await getSession();
  const canManage = session?.role === "ADMIN";
  const couriers = await db.courier.findMany({
    include: {
      user: { select: { name: true, email: true, phone: true } },
      _count: { select: { orders: true } },
    },
    orderBy: [{ verificationStatus: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          Red de reparto
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
          Repartidores
        </h1>
        <p className="mt-1 text-sm text-muted">
          {couriers.length} repartidores registrados · verifica identidad, vehículo y documentos.
        </p>
      </div>

      {couriers.length === 0 ? (
        <EmptyState
          icon={Bike}
          title="No hay repartidores registrados"
          description="Cuando alguien se sume a la red, aparecerá aquí para verificación."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Repartidor</th>
                  <th>Vehículo</th>
                  <th>Zona</th>
                  <th>Rating</th>
                  <th>Entregas</th>
                  <th>Estado</th>
                  <th>Registro</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {couriers.map((courier) => (
                  <tr key={courier.id}>
                    <td>
                      <p className="text-xs font-semibold">{courier.user.name}</p>
                      <p className="text-[10px] text-muted">{courier.user.email}</p>
                      {courier.user.phone && (
                        <p className="text-[10px] text-muted">{courier.user.phone}</p>
                      )}
                    </td>
                    <td className="text-xs">{vehicleLabel(courier.vehicle)}</td>
                    <td className="text-xs text-muted">{courier.zone ?? "—"}</td>
                    <td className="text-xs">
                      <span className="text-primary">{courier.rating.toFixed(1)} ★</span>
                      <span className="ml-1 text-muted">({courier.ratingCount})</span>
                    </td>
                    <td className="text-xs text-muted">{courier._count.orders}</td>
                    <td>
                      <span
                        className={`badge ${
                          courier.verificationStatus === "VERIFIED"
                            ? "badge-success"
                            : courier.verificationStatus === "SUSPENDED"
                              ? "badge-danger"
                              : "badge-primary"
                        }`}
                      >
                        {courier.verificationStatus === "VERIFIED"
                          ? "Verificado"
                          : courier.verificationStatus === "SUSPENDED"
                            ? "Suspendido"
                            : "Pendiente"}
                      </span>
                      <p className="mt-1 text-[10px] text-muted">
                        {courier.status === "AVAILABLE"
                          ? "Disponible"
                          : courier.status === "BUSY"
                            ? "En entrega"
                            : "Desconectado"}
                      </p>
                    </td>
                    <td className="text-xs text-muted">{formatDateTime(courier.createdAt)}</td>
                    <td className="text-right">
                      {canManage ? (
                        <div className="flex justify-end gap-1">
                          {courier.verificationStatus !== "VERIFIED" && (
                            <form action={setCourierVerificationAction}>
                              <input type="hidden" name="courierId" value={courier.id} />
                              <input type="hidden" name="status" value="VERIFIED" />
                              <button type="submit" className="btn btn-success btn-sm text-[10px]">
                                Verificar
                              </button>
                            </form>
                          )}
                          {courier.verificationStatus !== "SUSPENDED" && (
                            <form action={setCourierVerificationAction}>
                              <input type="hidden" name="courierId" value={courier.id} />
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

function vehicleLabel(vehicle: string) {
  const labels: Record<string, string> = {
    BIKE: "Bicicleta",
    MOTORCYCLE: "Moto",
    CAR: "Auto",
    WALKING: "A pie",
  };
  return labels[vehicle] ?? vehicle;
}
