// app/privacy/page.tsx
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <>
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Aviso de Privacidad
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Última actualización: {new Date().toLocaleDateString("es-MX")}
          </p>

          <div className="mt-8 space-y-8 text-zinc-700 dark:text-zinc-300 leading-relaxed">

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                1. Responsable del tratamiento de datos
              </h2>
              <p>
                Alejandro Cerda Zertuche, operando bajo el nombre comercial TaskIO (en adelante &ldquo;la Plataforma&rdquo;),
                es responsable del tratamiento de tus datos personales.
                Puedes contactarnos en cualquier momento a través de{" "}
                <a className="text-emerald-700 dark:text-emerald-400 hover:underline" href="mailto:alejandro@taskio.com.mx">
                  alejandro@taskio.com.mx
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                2. Datos que recopilamos
              </h2>
              <p>Recopilamos únicamente los datos necesarios para operar la plataforma:</p>
              <ul className="mt-3 list-disc pl-6 space-y-2">
                <li><strong>Datos de registro:</strong> nombre, correo electrónico y contraseña (almacenada con hash).</li>
                <li><strong>Datos de perfil:</strong> experiencia laboral, educación, habilidades técnicas, ubicación y CV.</li>
                <li><strong>Datos de uso:</strong> vacantes vistas, postulaciones realizadas y actividad dentro de la plataforma.</li>
                <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador y cookies de sesión necesarias para el funcionamiento.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                3. Finalidad del tratamiento
              </h2>
              <p>Usamos tus datos para:</p>
              <ul className="mt-3 list-disc pl-6 space-y-2">
                <li>Crear y gestionar tu cuenta en la plataforma.</li>
                <li>Mostrarte vacantes relevantes según tu perfil.</li>
                <li>Enviar tu perfil a reclutadores cuando aplicas a una vacante.</li>
                <li>Enviarte notificaciones relacionadas con tu actividad (nuevas vacantes, cambios de estatus).</li>
                <li>Mejorar la plataforma mediante análisis de uso agregado y anónimo.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                4. Compartición de datos
              </h2>
              <p>
                <strong>No vendemos ni cedemos tus datos personales a terceros.</strong> Tus datos pueden ser
                compartidos únicamente en los siguientes casos:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-2">
                <li><strong>Con reclutadores:</strong> cuando aplicas a una vacante, tu perfil es visible para la empresa que la publicó.</li>
                <li><strong>Con proveedores de servicio:</strong> utilizamos servicios de infraestructura (hosting, base de datos, correo) bajo contratos de confidencialidad.</li>
                <li><strong>Por obligación legal:</strong> si una autoridad competente lo requiere conforme a la ley aplicable.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                5. Retención de datos
              </h2>
              <p>
                Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta, tus datos
                personales serán eliminados en un plazo máximo de 30 días, excepto aquellos que debamos
                conservar por obligaciones legales.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                6. Tus derechos (ARCO)
              </h2>
              <p>Tienes derecho a:</p>
              <ul className="mt-3 list-disc pl-6 space-y-2">
                <li><strong>Acceso:</strong> conocer qué datos tenemos sobre ti.</li>
                <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
                <li><strong>Cancelación:</strong> solicitar la eliminación de tus datos.</li>
                <li><strong>Oposición:</strong> oponerte al tratamiento de tus datos para fines específicos.</li>
              </ul>
              <p className="mt-3">
                Para ejercer cualquiera de estos derechos, escríbenos a{" "}
                <a className="text-emerald-700 dark:text-emerald-400 hover:underline" href="mailto:alejandro@taskio.com.mx">
                  alejandro@taskio.com.mx
                </a>{" "}
                con el asunto &ldquo;Derechos ARCO&rdquo;.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                7. Cookies
              </h2>
              <p>
                Utilizamos cookies estrictamente necesarias para mantener tu sesión activa y garantizar
                el funcionamiento de la plataforma. No utilizamos cookies de rastreo publicitario ni
                compartimos datos de cookies con terceros para fines comerciales.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                8. Seguridad
              </h2>
              <p>
                Implementamos medidas técnicas y organizativas para proteger tus datos: conexiones
                cifradas (HTTPS), contraseñas almacenadas con hash, y acceso restringido a la base de
                datos. Sin embargo, ningún sistema es 100% seguro. Te recomendamos usar una contraseña
                única y segura.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                9. Cambios a este aviso
              </h2>
              <p>
                Podemos actualizar este aviso de privacidad. Cuando lo hagamos, actualizaremos la fecha
                de &ldquo;última actualización&rdquo; al inicio de esta página. Si los cambios son significativos,
                te notificaremos por correo electrónico.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                10. Contacto
              </h2>
              <p>
                Si tienes preguntas sobre este aviso o el tratamiento de tus datos, contáctanos en{" "}
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