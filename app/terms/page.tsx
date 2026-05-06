// app/terms/page.tsx
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export default function TermsPage() {
  return (
    <>
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Términos y Condiciones
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Última actualización: {new Date().toLocaleDateString("es-MX")}
          </p>

          <div className="mt-8 space-y-8 text-zinc-700 dark:text-zinc-300 leading-relaxed">

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                1. Aceptación de los términos
              </h2>
              <p>
                Al crear una cuenta o usar TaskIO, aceptas estos Términos y Condiciones en su totalidad.
                Si no estás de acuerdo con alguno de ellos, no debes usar la plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                2. Descripción del servicio
              </h2>
              <p>
                TaskIO es una plataforma de bolsa de trabajo enfocada en perfiles de tecnología en México.
                Actuamos como intermediario para conectar candidatos con empresas que publican vacantes.
                <strong> No somos una agencia de reclutamiento y no garantizamos contratación.</strong>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                3. Registro y cuentas
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Debes proporcionar información veraz y actualizada al registrarte.</li>
                <li>Eres responsable de mantener la confidencialidad de tu contraseña.</li>
                <li>Solo puedes tener una cuenta activa por persona o empresa.</li>
                <li>Debes ser mayor de 18 años para usar la plataforma.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                4. Responsabilidades del candidato
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Eres responsable de la veracidad del contenido de tu perfil y CV.</li>
                <li>No debes suplantar identidades ni proporcionar credenciales falsas.</li>
                <li>Al postularte a una vacante, aceptas que tu perfil sea compartido con la empresa correspondiente.</li>
                <li>No debes usar la plataforma para fines distintos a la búsqueda de empleo.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                5. Responsabilidades de las empresas
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Las empresas son responsables del contenido, veracidad y condiciones de sus vacantes.</li>
                <li>No se permite publicar vacantes fraudulentas, engañosas o que no correspondan a puestos reales.</li>
                <li>Los datos de los candidatos recibidos solo pueden usarse para el proceso de selección de la vacante correspondiente.</li>
                <li>Queda prohibido contactar candidatos para fines distintos al reclutamiento.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                6. Uso prohibido
              </h2>
              <p>Está estrictamente prohibido:</p>
              <ul className="mt-3 list-disc pl-6 space-y-2">
                <li>Hacer scraping, extracción automatizada de datos o acceso masivo a la plataforma.</li>
                <li>Publicar contenido ofensivo, discriminatorio o ilegal.</li>
                <li>Intentar acceder a cuentas de otros usuarios.</li>
                <li>Usar la plataforma para enviar spam o comunicaciones no solicitadas.</li>
                <li>Revender o sublicenciar el acceso a la plataforma.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                7. Propiedad intelectual
              </h2>
              <p>
                Todo el contenido de TaskIO (diseño, código, marca, textos) es propiedad de la plataforma
                y está protegido por las leyes de propiedad intelectual aplicables. El contenido generado
                por los usuarios (perfiles, CVs, vacantes) sigue siendo propiedad de quien lo crea.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                8. Limitación de responsabilidad
              </h2>
              <p>
                TaskIO no es responsable por decisiones de contratación, condiciones laborales ofrecidas
                por las empresas, o cualquier daño derivado del uso de la plataforma. Nos reservamos el
                derecho de suspender o eliminar cuentas que violen estos términos sin previo aviso.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                9. Modificaciones al servicio
              </h2>
              <p>
                Podemos modificar, suspender o discontinuar cualquier parte de la plataforma en cualquier
                momento. También podemos actualizar estos Términos — te notificaremos por correo si los
                cambios son significativos. El uso continuado de la plataforma implica aceptación de los
                nuevos términos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                10. Ley aplicable
              </h2>
              <p>
                Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier
                disputa, las partes se someten a la jurisdicción de los tribunales competentes de México.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                11. Contacto
              </h2>
              <p>
                Para cualquier duda sobre estos términos, escríbenos a{" "}
                <a className="text-emerald-700 dark:text-emerald-400 hover:underline" href="mailto:alejandro@taskio.com.mx">
                  alejandro@taskio.com.mx
                </a>.
              </p>
            </section>

          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}