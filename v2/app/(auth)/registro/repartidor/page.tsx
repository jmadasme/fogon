import { AuthShell } from "@/components/auth/auth-shell";
import { AuthLinks, RegisterCourierForm } from "@/components/auth/forms";

export const dynamic = "force-dynamic";

export default function CourierRegisterPage() {
  return (
    <AuthShell
      eyebrow="Para repartidores"
      title="Súmate a la red"
      subtitle="Trabaja cuando quieras, cobra lo que ves y recibe el 100% de tu propina. Sin letra chica."
      footer={<AuthLinks type="register" />}
    >
      <RegisterCourierForm />
    </AuthShell>
  );
}
