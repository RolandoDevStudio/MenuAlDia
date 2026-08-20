import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  CURRENT_TERMS_VERSION,
  LEGAL_SUPPORT_EMAIL,
} from "@/lib/constants/legal";

export default function TerminosPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <BrandLogo variant="lockup" size="sm" href="/" />
      <article className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">
        <header className="space-y-2">
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-brand-dark">
            Términos y Condiciones de Uso del Servicio
          </h1>
          <p className="text-lg font-semibold text-muted">Menú al Día</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            1. Información general y aceptación
          </h2>
          <p>
            El presente contrato establece los Términos y Condiciones de Uso (en
            adelante, los &quot;Términos&quot;) que rigen el acceso y uso de la
            plataforma de software como servicio (SaaS) denominada &quot;Menú al
            Día&quot;, operada por Rolando Calvillo Hernández (persona física
            con actividad empresarial), con domicilio en Monterrey, Nuevo León,
            México, y disponible a través del dominio{" "}
            <a
              href="https://menualdia.com.mx"
              className="font-semibold text-brand underline-offset-2 hover:underline"
            >
              https://menualdia.com.mx
            </a>{" "}
            (en adelante, el &quot;Sitio Web&quot; o la &quot;Plataforma&quot;).
          </p>
          <p>
            Al registrarse, acceder, utilizar o contratar los servicios de Menú
            al Día, usted (en adelante, el &quot;Usuario&quot; o el
            &quot;Suscriptor&quot;) declara que ha leído, entendido y aceptado
            en su totalidad el contenido de estos Términos, así como nuestro
            Aviso de Privacidad. Si no está de acuerdo con estos Términos,
            deberá abstenerse de utilizar la Plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            2. Descripción del servicio
          </h2>
          <p>
            Menú al Día es una herramienta tecnológica en la nube diseñada para
            permitir a establecimientos gastronómicos y comerciales la gestión
            de catálogos digitales de productos, actualización de especiales del
            día, generación de menús digitales interactivos y maquetación de
            flyers/anuncios promocionales para su difusión en redes sociales y
            canales digitales.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            3. Registro de cuenta y elegibilidad
          </h2>
          <p>
            Para hacer uso de la Plataforma, el Usuario debe ser mayor de edad
            con capacidad legal para contratar según las leyes de los Estados
            Unidos Mexicanos o tener la representación legal debida de una
            persona moral o establecimiento comercial.
          </p>
          <p>
            El Usuario es el único responsable de mantener la confidencialidad de
            sus credenciales de acceso (usuario y contraseña) y de todas las
            actividades que ocurran bajo su cuenta. El Usuario se compromete a
            notificar inmediatamente a Menú al Día sobre cualquier uso no
            autorizado de su cuenta.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            4. Períodos de prueba y promociones
          </h2>
          <p>
            Menú al Día podrá ofrecer, a su entero criterio y de manera
            discrecional, períodos de prueba gratuita, tarifas promocionales o
            descuentos de lanzamiento a usuarios o establecimientos
            seleccionados. Los términos, duración y alcance de dichas
            promociones serán los informados al momento del registro o
            contratación. Una vez concluido el periodo promocional aplicable, el
            acceso a la Plataforma se regirá bajo las tarifas estándar vigentes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            5. Suscripciones, tarifas y modalidad de pago
          </h2>
          <p>
            Finalizado el período de prueba o promoción aplicable, el servicio
            se presta bajo el esquema de suscripción periódica (mensual o anual
            según la tarifa vigente publicada en el Sitio Web).
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Modalidad de Pago:</strong> Por el momento, los pagos de
              suscripción se procesan exclusivamente de manera manual a través
              de transferencia bancaria (SPEI).
            </li>
            <li>
              <strong>Activación y Renovación:</strong> El Usuario deberá
              realizar la transferencia por el monto exacto del plan elegido a
              las coordenadas bancarias proporcionadas dentro del panel o por
              los canales oficiales de soporte, enviando el comprobante de pago
              correspondiente al correo{" "}
              <a
                href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
                className="font-semibold text-brand underline-offset-2 hover:underline"
              >
                {LEGAL_SUPPORT_EMAIL}
              </a>{" "}
              o vía WhatsApp oficial. Una vez verificado el depósito en la
              cuenta de origen, se procederá a la activación o renovación del
              periodo contratado en un lapso no mayor a 24 horas hábiles.
            </li>
            <li>
              <strong>Suspensión por Falta de Pago:</strong> Si la renovación no
              es liquidada a la fecha de vencimiento del periodo pagado, el
              acceso al panel de administración y la visualización pública de
              los menús/flyers vinculados a la cuenta podrán ser suspendidos
              hasta que se acredite el pago correspondiente.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            6. Política de cancelación y reembolsos
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Cancelación:</strong> El Usuario puede solicitar la
              cancelación de su suscripción en cualquier momento manifestándolo
              por escrito al correo{" "}
              <a
                href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
                className="font-semibold text-brand underline-offset-2 hover:underline"
              >
                {LEGAL_SUPPORT_EMAIL}
              </a>
              . La cancelación surtirá efectos al finalizar el período de pago
              en curso.
            </li>
            <li>
              <strong>Reembolsos:</strong> Dado que el Usuario puede contar con
              un período de prueba o promoción previa para evaluar la plataforma
              y que los pagos se efectúan por adelantado mediante transferencia
              manual voluntaria, Menú al Día no realiza reembolsos ni
              devoluciones de dinero por períodos de suscripción parcialmente
              utilizados o por cancelación anticipada.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            7. Propiedad intelectual
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>De la Plataforma:</strong> El código fuente, diseño de
              interfaz, bases de datos, algoritmos, logotipos, marcas, dominio
              https://menualdia.com.mx, plantillas visuales (themes) y cualquier
              elemento tangible o intangible que compone Menú al Día son
              propiedad exclusiva de Rolando Calvillo Hernández y están
              protegidos por las leyes de propiedad industrial y derechos de
              autor en México e internacionalmente.
            </li>
            <li>
              <strong>Del Contenido del Usuario:</strong> El Usuario conserva la
              totalidad de la propiedad intelectual y los derechos sobre las
              marcas, logotipos, imágenes de platillos, descripciones y datos
              que cargue en la Plataforma. El Usuario concede a Menú al Día una
              licencia gratuita, no exclusiva y temporal para almacenar,
              procesar y mostrar dicho contenido en la web con el único propósito
              de prestar el servicio contratado.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            8. Responsabilidad sobre el contenido publicado
          </h2>
          <p>
            El Usuario es el único y exclusivo responsable por la exactitud,
            veracidad, legalidad y actualización del contenido que publique a
            través de Menú al Día.
          </p>
          <p>En consecuencia, el Usuario garantiza que:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Los precios, promociones, descuentos y términos de venta mostrados
              en sus menús y flyers son exactos y cumplen con las normativas de
              protección al consumidor (PROFECO).
            </li>
            <li>
              Las imágenes y textos subidos no violan derechos de autor, marcas
              registradas ni derechos de terceros.
            </li>
            <li>
              La descripción de platillos e ingredientes (incluyendo la
              presencia de alérgenos) es correcta.
            </li>
          </ul>
          <p>
            Menú al Día actúa únicamente como un proveedor de herramientas
            tecnológicas de publicación y NO asume responsabilidad alguna por
            reclamos de clientes finales del Usuario relacionados con precios
            incorrectos, calidad de alimentos, promociones no respetadas,
            alergias o transacciones comerciales entre el Usuario y sus
            consumidores.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            9. Límite de responsabilidad y disponibilidad del servicio
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Menú al Día realiza esfuerzos comercialmente razonables para
              mantener la Plataforma disponible y en correcto funcionamiento.
              Sin embargo, el servicio se proporciona &quot;tal cual&quot;
              (&quot;as is&quot;) y &quot;según disponibilidad&quot;.
            </li>
            <li>
              Menú al Día no garantiza que el acceso a la Plataforma sea
              ininterrumpido o libre de errores, toda vez que depende de
              factores externos como la conectividad a internet del Usuario,
              proveedores de infraestructura en la nube y disponibilidad de
              servicios de terceros (como WhatsApp).
            </li>
            <li>
              En la medida máxima permitida por las leyes aplicables, Rolando
              Calvillo Hernández no será responsable por daños indirectos,
              incidentales, especiales, punitivos o consecuenciales, ni por
              pérdida de ingresos, ganancias, clientes o datos (lucro cesante)
              derivados del uso o la imposibilidad de uso de la Plataforma.
            </li>
            <li>
              En caso de determinarse cualquier responsabilidad legal por parte
              de Menú al Día, esta quedará estrictamente limitada al monto total
              pagado por el Usuario a Menú al Día por concepto de suscripción en
              el mes inmediato anterior al evento que dio origen a la
              reclamación.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            10. Uso aceptable y prohibiciones
          </h2>
          <p>El Usuario se obliga a no utilizar la Plataforma para:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Cargar o transmitir contenido ilegal, difamatorio, obsceno,
              fraudulento o que incite a la violencia.
            </li>
            <li>
              Intentar vulnerar la seguridad, realizar ingeniería inversa,
              descompilar o extraer el código fuente de la Plataforma.
            </li>
            <li>
              Utilizar mecanismos automatizados (bots, scrapers) para extraer
              datos de la Plataforma.
            </li>
            <li>
              Revender o subarrendar el acceso a la Plataforma a terceros sin la
              autorización previa y por escrito de Menú al Día.
            </li>
          </ul>
          <p>
            Cualquier violación a estas prohibiciones facultará a Menú al Día a
            suspender o cancelar la cuenta del Usuario de forma inmediata, sin
            derecho a reembolso y sin perjuicio de las acciones legales que
            correspondan.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            11. Modificaciones a los Términos
          </h2>
          <p>
            Menú al Día se reserva el derecho de modificar o actualizar los
            presentes Términos en cualquier momento. Las modificaciones
            entrarán en vigor a partir de su publicación en el Sitio Web{" "}
            <a
              href="https://menualdia.com.mx/terminos"
              className="font-semibold text-brand underline-offset-2 hover:underline"
            >
              https://menualdia.com.mx/terminos
            </a>
            . La continuación en el uso de la Plataforma tras la publicación de
            los cambios constituirá la aceptación tácita de los mismos por parte
            del Usuario.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            12. Legislación aplicable y jurisdicción
          </h2>
          <p>
            Para la interpretación, cumplimiento y solución de cualquier
            controversia derivada de los presentes Términos y Condiciones o del
            uso de la Plataforma, ambas partes se someten expresamente a las
            leyes aplicables de los Estados Unidos Mexicanos y a la jurisdicción
            de los Tribunales Competentes de la ciudad de Monterrey, Nuevo León,
            México, renunciando expresamente a cualquier otro fuero que por
            razón de sus domicilios presentes o futuros pudiera corresponderles.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            13. Tratamiento de datos de clientes finales (terceros)
          </h2>
          <p>
            El Administrador/Usuario reconoce y acepta que es el único
            Responsable de recabar los datos personales de sus clientes finales
            (tales como números telefónicos, notas, preferencias y fotografías
            de servicio) de conformidad con las leyes aplicables, incluyendo la
            LFPDPPP. Menú al Día actúa únicamente como Encargado del
            procesamiento de dicha información y no utilizará ni compartirá los
            datos de los clientes finales para ningún fin ajeno a la prestación
            del servicio al Administrador.
          </p>
          <p>
            El Usuario se compromete a obtener, cuando corresponda, el
            consentimiento o autorización verbal/escrita de sus clientes finales
            antes de registrar sus datos o fotografías en la Plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">14. Contacto</h2>
          <p>
            Para cualquier duda, aclaración o comentario relativo a estos
            Términos y Condiciones, favor de ponerse en contacto a través de:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Correo electrónico:{" "}
              <a
                href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
                className="font-semibold text-brand underline-offset-2 hover:underline"
              >
                {LEGAL_SUPPORT_EMAIL}
              </a>
            </li>
            <li>
              Sitio Web:{" "}
              <a
                href="https://menualdia.com.mx"
                className="font-semibold text-brand underline-offset-2 hover:underline"
              >
                https://menualdia.com.mx
              </a>
            </li>
          </ul>
        </section>

        <p className="border-t border-black/10 pt-6 text-muted">
          Versión {CURRENT_TERMS_VERSION} · Última actualización: Agosto de
          2026.
        </p>
      </article>

      <Link
        href="/"
        className="mt-8 inline-block text-sm font-semibold text-brand"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
