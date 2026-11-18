import { AuthShell } from "@/components/auth/auth-shell";
import { AuthLinks, RegisterMerchantForm } from "@/components/auth/forms";

export const dynamic = "force-dynamic";

export default function MerchantRegisterPage() {
  return (
    <AuthShell
      eyebrow="Para cocinas y restaurantes"
      title="Registra tu local"
      subtitle="Comisión desde 12%, sin exclusividad y con reparto propio o red Fogón. Tu cliente es tuyo."
      footer={<AuthLinks type="register" />}
    >
      <RegisterMerchantForm />
    </AuthShell>
  );
}
