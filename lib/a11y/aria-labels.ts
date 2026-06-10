/**
 * Accessibility - ARIA Labels & Attributes
 * Centralized aria-label definitions for consistent accessibility
 */

export const ARIA_LABELS = {
  // Navigation
  OPEN_MENU: "Abrir menú",
  CLOSE_MENU: "Cerrar menú",
  NAVIGATE_HOME: "Ir a inicio",
  NAVIGATE_JOBS: "Ir a vacantes",
  NAVIGATE_PROFILE: "Ir a mi perfil",
  NAVIGATE_DASHBOARD: "Ir a panel de control",

  // Pagination
  PREVIOUS_PAGE: "Página anterior",
  NEXT_PAGE: "Página siguiente",
  LOAD_MORE: "Cargar más",

  // Search & Filter
  SEARCH_JOBS: "Buscar vacantes",
  FILTER_RESULTS: "Filtrar resultados",
  CLEAR_FILTERS: "Limpiar filtros",
  SORT_RESULTS: "Ordenar resultados",

  // Actions
  APPLY_JOB: "Postularse a esta vacante",
  SAVE_JOB: "Guardar vacante",
  SHARE_JOB: "Compartir vacante",
  EDIT: "Editar",
  DELETE: "Eliminar",
  CANCEL: "Cancelar",
  CONFIRM: "Confirmar",
  SUBMIT: "Enviar",

  // Form
  SHOW_PASSWORD: "Mostrar contraseña",
  HIDE_PASSWORD: "Ocultar contraseña",
  CLEAR_INPUT: "Limpiar entrada",

  // Modal
  CLOSE_MODAL: "Cerrar modal",
  OPEN_MODAL: "Abrir modal",

  // Notifications
  CLOSE_NOTIFICATION: "Cerrar notificación",
  CLOSE_TOAST: "Cerrar notificación",

  // Sorting & Filtering
  SORT_BY_DATE: "Ordenar por fecha",
  SORT_BY_RELEVANCE: "Ordenar por relevancia",
  SORT_BY_SALARY: "Ordenar por salario",

  // User Actions
  LOGOUT: "Cerrar sesión",
  SIGN_IN: "Iniciar sesión",
  SIGN_UP: "Registrarse",
  SETTINGS: "Configuración",

  // Job Details
  VIEW_JOB_DETAILS: "Ver detalles de la vacante",
  COPY_LINK: "Copiar enlace",
  VIEW_COMPANY: "Ver empresa",

  // Dashboard
  VIEW_APPLICATIONS: "Ver postulaciones",
  REVIEW_CANDIDATE: "Revisar candidato",
  SEND_MESSAGE: "Enviar mensaje",
  SCHEDULE_INTERVIEW: "Agendar entrevista",
};

/**
 * Get aria-label for common button types
 */
export function getAriaLabel(
  action: keyof typeof ARIA_LABELS,
  context?: string
): string {
  const label = ARIA_LABELS[action];
  if (context) {
    return `${label}: ${context}`;
  }
  return label;
}

/**
 * Aria attributes for loading states
 */
export const ARIA_LOADING = {
  LOADING: "aria-busy",
  LOADING_LABEL: "Cargando...",
};

/**
 * Aria attributes for disabled states
 */
export const ARIA_DISABLED = {
  DISABLED: "aria-disabled",
};

/**
 * Describe content for screen readers
 */
export function getAriaDescription(type: string, content: string): string {
  const descriptions: Record<string, string> = {
    error: `Error: ${content}`,
    warning: `Advertencia: ${content}`,
    success: `Éxito: ${content}`,
    info: `Información: ${content}`,
    required: `Campo requerido: ${content}`,
    optional: `Campo opcional: ${content}`,
  };

  return descriptions[type] || content;
}

/**
 * Announce dynamic updates to screen readers
 */
export const ARIA_LIVE = {
  POLITE: "aria-live='polite'",
  ASSERTIVE: "aria-live='assertive'",
  OFF: "aria-live='off'",
} as const;

/**
 * Role attributes for semantic HTML
 */
export const ARIA_ROLES = {
  BUTTON: "role='button'",
  LINK: "role='link'",
  TAB: "role='tab'",
  TABPANEL: "role='tabpanel'",
  ALERT: "role='alert'",
  DIALOG: "role='dialog'",
  REGION: "role='region'",
  MAIN: "role='main'",
  NAVIGATION: "role='navigation'",
  SEARCH: "role='search'",
  FORM: "role='form'",
  LIST: "role='list'",
  LISTITEM: "role='listitem'",
};

/**
 * Expand/Collapse buttons
 */
export function getAriaExpanded(isExpanded: boolean): string {
  return isExpanded ? "aria-expanded='true'" : "aria-expanded='false'";
}

/**
 * Keyboard shortcuts hint
 */
export function getKeyboardHint(shortcut: string): string {
  return `Presiona ${shortcut}`;
}
