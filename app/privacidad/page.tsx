import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  CURRENT_PRIVACY_VERSION,
  LEGAL_SUPPORT_EMAIL,
} from "@/lib/constants/legal";

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <BrandLogo variant="lockup" size="sm" href="/" />
      <article className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">
        <header className="space-y-2">
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-brand-dark">
            Aviso de Privacidad Integral
          </h1>
          <p className="text-lg font-semibold text-muted">Menú al Día</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            1. Identidad y domicilio del responsable
          </h2>
          <p>
            Rolando Calvillo Hernández (en lo sucesivo denominado &quot;Menú al
            Día&quot;), operando como persona física con actividad empresarial,
            con domicilio de contacto y atención en la ciudad de Monterrey,
            Nuevo León, México, y portal web oficial{" "}
            <a
              href="https://menualdia.com.mx"
              className="font-semibold text-brand underline-offset-2 hover:underline"
            >
              https://menualdia.com.mx
            </a>{" "}
            (en adelante, el &quot;Sitio Web&quot;), es el responsable del
            tratamiento, uso, almacenamiento y protección de sus datos
            personales, en cumplimiento con la Ley Federal de Protección de
            Datos Personales en Posesión de los Particulares (LFPDPPP), su
            Reglamento y demás disposiciones aplicables en los Estados Unidos
            Mexicanos.
          </p>
          <p>
            Correo electrónico de contacto y soporte:{" "}
            <a
              href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
              className="font-semibold text-brand underline-offset-2 hover:underline"
            >
              {LEGAL_SUPPORT_EMAIL}
            </a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            2. Datos personales que serán recabados
          </h2>
          <p>
            Para prestar adecuadamente los servicios de la plataforma de
            software como servicio (SaaS) &quot;Menú al Día&quot;, recabamos las
            siguientes categorías de datos personales de nuestros usuarios
            (dueños, administradores o representantes de establecimientos
            comerciales y gastronómicos):
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Datos de Identificación y Contacto:</strong> Nombre
              completo, correo electrónico, número de teléfono celular o
              WhatsApp.
            </li>
            <li>
              <strong>Datos del Establecimiento o Negocio:</strong> Nombre
              comercial del restaurante, fonda o negocio, dirección física del
              establecimiento, logotipo, fotografías de productos o platillos,
              descripción de insumos o servicios, catálogo de precios, horarios
              de atención y enlaces a redes sociales.
            </li>
            <li>
              <strong>Datos Transaccionales y de Facturación:</strong>{" "}
              Comprobantes de transferencia bancaria, número de cuenta de origen
              (únicamente para cotejo de pagos manuales), historial de
              suscripciones y transacciones dentro de la plataforma.
            </li>
          </ul>
          <p>
            Menú al Día <strong>NO</strong> recaba ni solicita bajo ninguna
            circunstancia datos personales sensibles (tales como origen étnico,
            estado de salud, información genética, creencias religiosas,
            opiniones políticas o preferencia sexual).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            3. Finalidades del tratamiento de los datos
          </h2>
          <p>
            Los datos personales recabados serán utilizados para las siguientes
            finalidades necesarias para el servicio (Finalidades Primarias):
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Creación, autenticación, gestión y administración de la cuenta de
              usuario en la plataforma.
            </li>
            <li>
              Provisión del servicio de software para la creación, edición,
              maquetación y publicación de menús digitales y flyers
              promocionales.
            </li>
            <li>
              Verificación, cotejo y validación de los pagos manuales realizados
              vía transferencia bancaria para la activación o renovación de
              planes de suscripción.
            </li>
            <li>
              Gestión de períodos de prueba gratuita o promociones aplicables
              informadas al momento del registro o contratación.
            </li>
            <li>
              Atención de dudas, soporte técnico, aclaraciones y requerimientos
              de servicio a través de correo electrónico o WhatsApp.
            </li>
            <li>
              Generación de métricas de uso y estadísticas de rendimiento
              internas para la optimización de la herramienta.
            </li>
          </ul>
          <p>
            De manera adicional, utilizaremos su información personal para las
            siguientes finalidades que no son necesarias para el servicio
            solicitado, pero que nos permiten brindarle una mejor atención
            (Finalidades Secundarias):
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Envío de boletines informativos, actualizaciones de software,
              nuevas funcionalidades y consejos de optimización para su negocio.
            </li>
            <li>
              Envío de ofertas, promociones o invitaciones a eventos organizados
              por Menú al Día.
            </li>
          </ul>
          <p>
            Si no desea que sus datos personales sean tratados para las
            finalidades secundarias, puede manifestar su negativa enviando un
            correo electrónico a{" "}
            <a
              href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
              className="font-semibold text-brand underline-offset-2 hover:underline"
            >
              {LEGAL_SUPPORT_EMAIL}
            </a>
            . La negativa para el uso de sus datos personales para estas
            finalidades secundarias no podrá ser motivo para negarle los
            servicios contratados.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            4. Transferencia de datos personales
          </h2>
          <p>
            Menú al Día no vende, renta ni comercializa sus datos personales con
            terceros. Sus datos personales únicamente podrán ser compartidos o
            transferidos con proveedores de servicios tecnológicos
            indispensables para la correcta operación de la plataforma
            (encargados), tales como:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Proveedores de infraestructura de cómputo en la nube, bases de
              datos y almacenamiento de archivos de medios (ej. Vercel,
              Supabase).
            </li>
            <li>
              Proveedores de herramientas de análisis web y rendimiento del
              sistema.
            </li>
          </ul>
          <p>
            Estas transferencias se realizan bajo estrictas medidas de seguridad
            y confidencialidad, estando dichos terceros obligados a tratar sus
            datos personales única y exclusivamente conforme a las instrucciones
            de Menú al Día y a las leyes aplicables. Asimismo, se podrán realizar
            transferencias sin requerir su consentimiento únicamente en los
            casos previstos por el Artículo 37 de la LFPDPPP.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            5. Medios y procedimiento para ejercer los derechos ARCO y
            revocación del consentimiento
          </h2>
          <p>
            Usted tiene derecho a conocer qué datos personales tenemos de usted,
            para qué los utilizamos y las condiciones del uso que les damos
            (Acceso). Asimismo, es su derecho solicitar la corrección de su
            información personal en caso de que esté desactualizada, sea
            inexacta o incompleta (Rectificación); que la eliminemos de nuestros
            registros o bases de datos cuando considere que la misma no está
            siendo utilizada adecuadamente (Cancelación); así como oponerse al
            uso de sus datos personales para fines específicos (Oposición).
            Estos derechos se conocen como derechos ARCO.
          </p>
          <p>
            Para el ejercicio de cualquiera de los derechos ARCO, o para
            revocar el consentimiento otorgado para el tratamiento de sus datos
            personales, deberá enviar una solicitud por escrito al correo
            electrónico:{" "}
            <a
              href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
              className="font-semibold text-brand underline-offset-2 hover:underline"
            >
              {LEGAL_SUPPORT_EMAIL}
            </a>
            .
          </p>
          <p>La solicitud deberá contener y acompañarse de lo siguiente:</p>
          <ul className="list-decimal space-y-2 pl-5">
            <li>
              Nombre completo del titular y correo electrónico registrado en la
              plataforma.
            </li>
            <li>
              Documento oficial que acredite la identidad del titular (copia de
              INE o Pasaporte) o, en su caso, la representación legal.
            </li>
            <li>
              Descripción clara y precisa de los datos personales respecto de
              los que se busca ejercer alguno de los derechos ARCO.
            </li>
            <li>
              Cualquier otro elemento o documento que facilite la localización
              de los datos personales.
            </li>
          </ul>
          <p>
            Menú al Día responderá a su solicitud en un plazo máximo de 20
            (veinte) días hábiles contados desde la fecha de recepción de la
            misma, notificándole la determinación adoptada a través del correo
            electrónico proporcionado.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            6. Uso de cookies, beacons y tecnologías de rastreo
          </h2>
          <p>
            Le informamos que en nuestro Sitio Web y en el panel de
            administración utilizamos cookies y otras tecnologías de rastreo a
            través de las cuales es posible monitorear su comportamiento como
            usuario de internet, brindarle una mejor experiencia de navegación y
            mantener activa su sesión de trabajo.
          </p>
          <p>
            Las cookies utilizadas almacenan identificadores de sesión,
            preferencias de idioma y estado de autenticación. Usted puede
            desactivar o configurar el uso de cookies directamente en las
            opciones de seguridad de su navegador web; sin embargo, tome en
            cuenta que la desactivación de cookies esenciales puede limitar o
            impedir el funcionamiento del panel de administración de la
            plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            7. Medidas de seguridad
          </h2>
          <p>
            Menú al Día ha implementado medidas de seguridad técnicas,
            administrativas y físicas razonables para proteger sus datos
            personales contra daño, pérdida, alteración, destrucción o el uso,
            acceso o tratamiento no autorizado, incluyendo el cifrado de
            conexiones mediante protocolos HTTPS/TLS y acceso restringido a las
            bases de datos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-dark">
            8. Cambios al Aviso de Privacidad
          </h2>
          <p>
            El presente Aviso de Privacidad puede sufrir modificaciones, cambios
            o actualizaciones derivadas de nuevos requerimientos legales, de
            nuestras propias necesidades por los servicios que ofrecemos, de
            nuestras prácticas de privacidad o de cambios en nuestro modelo de
            negocio.
          </p>
          <p>
            Cualquier modificación al presente aviso será informada a través de
            la publicación de la versión actualizada en nuestro Sitio Web{" "}
            <a
              href="https://menualdia.com.mx/privacidad"
              className="font-semibold text-brand underline-offset-2 hover:underline"
            >
              https://menualdia.com.mx/privacidad
            </a>{" "}
            y/o mediante aviso enviado al correo electrónico asociado a su
            cuenta.
          </p>
        </section>

        <p className="border-t border-black/10 pt-6 text-muted">
          Versión {CURRENT_PRIVACY_VERSION} · Última actualización: Agosto de
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
