const profiles = [
  {
    title: "Genesys Cloud CX",
    area: "Plataformas de experiencia del cliente",
    skills: ["Genesys Cloud", "Integraciones", "Contact Center"],
  },
  {
    title: "Desarrollo Java APX/ASO",
    area: "Ingeniería de software",
    skills: ["Java", "APX", "Servicios backend"],
  },
  {
    title: "Diseño UX",
    area: "Experiencia de usuario y producto digital",
    skills: ["UX Research", "Prototipado", "Diseño de interfaces"],
  },
  {
    title: "Inteligencia artificial",
    area: "Soluciones de datos e IA",
    skills: ["IA", "Python", "Integraciones"],
  },
  {
    title: "Frontend con Web Components",
    area: "Desarrollo de aplicaciones web",
    skills: ["JavaScript", "Lit", "Web Components"],
  },
  {
    title: "Desarrollo Salesforce",
    area: "Plataformas empresariales y CRM",
    skills: ["Salesforce", "Apex", "Lightning"],
  },
] as const;

export default function ExampleTechProfiles() {
  return (
    <section
      aria-labelledby="example-tech-profiles-title"
      className="mt-14 border-t border-zinc-200 pt-10 dark:border-zinc-800"
    >
      <div className="mb-6 max-w-3xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          Referencias de perfiles tecnológicos
        </p>

        <h2
          id="example-tech-profiles-title"
          className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          Ejemplos de perfiles tecnológicos
        </h2>

        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Estos perfiles ilustran distintas especialidades del sector tecnológico.
          Son únicamente ejemplos: no representan vacantes disponibles,
          procesos de contratación activos ni invitaciones para postularse.
          Las oportunidades reales se encuentran en el listado superior.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((profile) => (
          <li
            key={profile.title}
            className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Ejemplo · No es una vacante activa
            </p>

            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {profile.title}
            </h3>

            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {profile.area}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                >
                  {skill}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
