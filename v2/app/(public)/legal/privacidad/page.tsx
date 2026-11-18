export const metadata = {
  title: "Política de privacidad",
  description: "Cómo Fogón recopila, usa y protege tus datos personales.",
};

export default function PrivacyPage() {
  return (
    <article className="legal-prose">
      <h1>Política de privacidad</h1>
      <p className="text-xs text-muted">Última actualización: 07/11/2026 · Versión preliminar</p>

      <h2>1. Responsable</h2>
      <p>
        Fogón SpA, RUT por definir, Santiago de Chile. Contacto de privacidad:
        privacidad@fogon.cl.
      </p>

      <h2>2. Datos que recopilamos</h2>
      <ul>
        <li>Identificación: nombre, email, teléfono.</li>
        <li>Dirección de entrega e instrucciones.</li>
        <li>Historial de pedidos y preferencias.</li>
        <li>Datos de pago procesados por la pasarela (no almacenamos tarjetas).</li>
        <li>Ubicación del repartidor durante una entrega activa.</li>
        <li>Datos técnicos: dispositivo, IP, navegador, eventos de uso.</li>
      </ul>

      <h2>3. Finalidades</h2>
      <ul>
        <li>Procesar y entregar pedidos.</li>
        <li>Gestionar pagos, reembolsos y liquidaciones.</li>
        <li>Coordinar locales y repartidores.</li>
        <li>Prevenir fraude y garantizar seguridad.</li>
        <li>Mejorar el producto y la experiencia.</li>
        <li>Enviar comunicaciones transaccionales y, con consentimiento, marketing.</li>
      </ul>

      <h2>4. Base de licitud</h2>
      <p>
        Ejecución del contrato, consentimiento, cumplimiento legal e interés
        legítimo para prevenir fraude y mejorar el servicio.
      </p>

      <h2>5. Compartición</h2>
      <p>
        Compartimos los datos necesarios con el local (nombre, dirección, teléfono
        e instrucciones), el repartidor asignado, proveedores de pago, hosting,
        mapas, notificaciones y soporte. No vendemos datos personales.
      </p>

      <h2>6. Conservación</h2>
      <p>
        Pedidos y documentos tributarios: 6 años. Ubicaciones: 90 días. Datos de
        marketing: hasta la revocación del consentimiento. Cuentas inactivas:
        eliminación o anonimización tras un plazo razonable.
      </p>

      <h2>7. Derechos</h2>
      <p>
        Puedes solicitar acceso, rectificación, supresión, oposición, portabilidad
        y bloqueo escribiendo a privacidad@fogon.cl. Responderemos en los plazos
        legales.
      </p>

      <h2>8. Seguridad</h2>
      <p>
        Usamos cifrado en tránsito, control de accesos, registros de auditoría,
        backups y minimización de datos. Ningún sistema es 100% infalible; si
        ocurre una brecha, notificaremos según corresponda.
      </p>

      <h2>9. Cookies</h2>
      <p>
        Usamos cookies necesarias para la sesión y el carrito. Las cookies de
        analítica y marketing se activan con consentimiento cuando corresponda.
      </p>

      <h2>10. Menores</h2>
      <p>
        La plataforma no está dirigida a menores de 18 años. Si detectamos una
        cuenta de un menor, la suspenderemos.
      </p>

      <h2>11. Cambios</h2>
      <p>
        Podemos actualizar esta política. Publicaremos la fecha de la última
        actualización y, si el cambio es sustancial, avisaremos por email o en la
        plataforma.
      </p>

      <h2>12. Contacto</h2>
      <p>
        privacidad@fogon.cl · Fogón SpA · Santiago, Chile.
      </p>
    </article>
  );
}
