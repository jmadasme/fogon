import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { setKycStatusAction } from "@/app/actions/kyc";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  NOT_STARTED: "Sin iniciar",
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

export default async function AdminKycPage() {
  const session = await getSession();
  const canManage = session?.role === "ADMIN";
  const cases = await db.kycCase.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true, email: true, role: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          Confianza
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
          Verificaciones KYC
        </h1>
        <p className="mt-1 text-sm text-muted">
          Revisa identidad y liveness de locales y repartidores. En producción
          esta decisión debe basarse en el proveedor KYC, no solo en el panel.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="border-b border-border bg-surface-2/60 text-[10px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cases.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    No hay casos KYC todavía.
                  </td>
                </tr>
              )}
              {cases.map((record) => (
                <tr key={record.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{record.user.name}</p>
                    <p className="text-[10px] text-muted">{record.user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{record.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${
                        record.status === "APPROVED"
                          ? "badge-success"
                          : record.status === "REJECTED"
                            ? "badge-danger"
                            : "badge-muted"
                      }`}
                    >
                      {LABELS[record.status] ?? record.status}
                    </span>
                    {record.livenessScore != null && (
                      <p className="mt-1 text-[10px] text-muted">
                        Liveness {record.livenessScore.toFixed(1)}
                      </p>
                    )}
                    {record.reason && (
                      <p className="mt-1 text-[10px] text-muted">{record.reason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{record.provider}</td>
                  <td className="px-4 py-3 text-muted">
                    {record.createdAt.toLocaleDateString("es-CL")}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <div className="flex flex-wrap gap-1.5">
                        <form action={setKycStatusAction}>
                          <input type="hidden" name="caseId" value={record.id} />
                          <input type="hidden" name="status" value="APPROVED" />
                          <button type="submit" className="btn btn-secondary btn-sm">
                            Aprobar
                          </button>
                        </form>
                        <form action={setKycStatusAction} className="flex gap-1">
                          <input type="hidden" name="caseId" value={record.id} />
                          <input type="hidden" name="status" value="REJECTED" />
                          <input
                            name="reason"
                            placeholder="Motivo"
                            className="input h-8 w-28 text-[10px]"
                          />
                          <button type="submit" className="btn btn-danger btn-sm">
                            Rechazar
                          </button>
                        </form>
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
    </div>
  );
}
