export const metadata = {
  title: "Cancelaciones y reembolsos",
  description: "Cómo funcionan las cancelaciones y reembolsos en Fogón.",
};

export default function RefundsPage() {
  return (
    <article className="legal-prose">
      <h1>Cancelaciones y reembolsos</h1>
      <p className="text-xs text-muted">Última actualización: 07/11/2026 · Versión preliminar</p>

      <h2>1. Cancelación por el cliente</h2>
      <ul>
        <li>
          <strong>Antes de que el local acepte:</strong> cancelación sin costo y
          reembolso total.
        </li>
        <li>
          <strong>Después de aceptar y antes de preparar:</strong> el local puede
          aceptar la cancelación; si ya compró insumos, puede aplicar un cargo
          parcial informado.
        </li>
        <li>
          <strong>En preparación o en camino:</strong> la cancelación no procede,
          salvo error del local o fuerza mayor.
        </li>
      </ul>

      <h2>2. Rechazo o cancelación por el local</h2>
      <p>
        Si el local rechaza el pedido o no responde en el plazo definido, el
        cliente recibe el reembolso total y, cuando corresponda, una compensación.
      </p>

      <h2>3. Pedido incompleto, incorrecto o en mal estado</h2>
      <p>
        El cliente debe reportar el problema dentro de las 48 horas siguientes a
        la entrega, con foto y código de pedido. Fogón revisa el caso con el local
        y resuelve en un plazo máximo de 72 horas.
      </p>

      <h2>4. Pedido no entregado</h2>
      <p>
        Si el pedido no llega, se investiga la trazabilidad con el local y el
        repartidor. Si no se puede acreditar la entrega, se reembolsa el total.
      </p>

      <h2>5. Plazos de reembolso</h2>
      <ul>
        <li>Mercado Pago: 5–10 días hábiles según el medio de pago.</li>
        <li>Webpay: 5–10 días hábiles.</li>
        <li>Efectivo: coordinación con soporte.</li>
      </ul>

      <h2>6. Cómo solicitar</h2>
      <p>
        Escríbenos a soporte@fogon.cl con el código del pedido, una descripción
        del problema y evidencia fotográfica. También puedes usar el botón de
        soporte en el seguimiento del pedido.
      </p>

      <h2>7. Casos no cubiertos</h2>
      <ul>
        <li>Dirección incorrecta entregada por el cliente.</li>
        <li>Cliente ausente después de 10 minutos de espera.</li>
        <li>Productos consumidos en su totalidad sin evidencia de problema.</li>
        <li>Reclamos fuera del plazo de 48 horas.</li>
      </ul>

      <h2>8. Contacto</h2>
      <p>soporte@fogon.cl · Lunes a domingo, 09:00–23:00.</p>
    </article>
  );
}
