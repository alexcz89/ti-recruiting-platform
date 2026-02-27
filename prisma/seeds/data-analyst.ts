// prisma/seeds/data-analyst.ts
// Ejecutar directo:  npx ts-node prisma/seeds/data-analyst.ts
// Importar desde seed.ts: import { seedDataAnalyst } from './seeds/data-analyst'

import { PrismaClient, AssessmentDifficulty } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeDifficulty(d: unknown): AssessmentDifficulty {
  const v = String(d ?? "").trim().toUpperCase();
  if (v === "JUNIOR") return "JUNIOR";
  if (v === "MID") return "MID";
  if (v === "SENIOR") return "SENIOR";
  return "MID";
}

async function upsertQuestion(templateId: string, q: any) {
  const existing = await prisma.assessmentQuestion.findFirst({
    where: { templateId, questionText: q.questionText },
  });
  if (existing) {
    await prisma.assessmentQuestion.update({
      where: { id: existing.id },
      data: { ...q, difficulty: normalizeDifficulty(q.difficulty), updatedAt: new Date() },
    });
    return "updated";
  } else {
    await prisma.assessmentQuestion.create({
      data: {
        ...q,
        templateId,
        difficulty: normalizeDifficulty(q.difficulty),
        type: "MULTIPLE_CHOICE",
        isActive: true,
      },
    });
    return "created";
  }
}

export async function seedDataAnalyst() {
  console.log("\n📦 Procesando: Data Analyst - SAS + Python (Mid Level)");

  const template = await prisma.assessmentTemplate.upsert({
    where: { slug: "data-analyst-sas-python-mid" },
    update: { isActive: true, updatedAt: new Date() },
    create: {
      title: "Data Analyst - SAS + Python (Mid Level)",
      slug: "data-analyst-sas-python-mid",
      description:
        "Evaluación técnica integral para analistas de datos con experiencia en SAS, Python, estadística y riesgo crediticio. Incluye 40 preguntas de opción múltiple y un reto de código práctico.",
      type: "MIXED",
      difficulty: "MID",
      totalQuestions: 40,
      passingScore: 70,
      timeLimit: 90,
      sections: [
        { name: "Python", questions: 12, weight: 30 },
        { name: "SAS", questions: 10, weight: 25 },
        { name: "Statistics", questions: 10, weight: 25 },
        { name: "Risk", questions: 8, weight: 20 },
      ],
      allowRetry: false,
      maxAttempts: 1,
      shuffleQuestions: true,
      penalizeWrong: true,
      isActive: true,
    },
  });

  console.log(`  ✅ Template ${template.id}`);

  const pythonQuestions = [
    {
      section: "Python",
      difficulty: "JUNIOR",
      tags: ["pandas", "basics"],
      questionText: "¿Cuál es la diferencia principal entre `.loc[]` y `.iloc[]` en pandas?",
      options: [
        { id: "a", text: "No hay diferencia, son sinónimos", isCorrect: false },
        { id: "b", text: ".loc[] usa etiquetas, .iloc[] usa posiciones enteras", isCorrect: true },
        { id: "c", text: ".iloc[] es más rápido que .loc[]", isCorrect: false },
        { id: "d", text: ".loc[] solo funciona con índices numéricos", isCorrect: false },
      ],
      explanation: ".loc[] es label-based (usa nombres de índice/columna), mientras que .iloc[] es integer-based (usa posiciones numéricas).",
    },
    {
      section: "Python",
      difficulty: "MID",
      tags: ["pandas", "merge"],
      questionText: 'Al hacer un `merge` de dos DataFrames con `how="inner"`, ¿qué sucede con las filas sin match?',
      options: [
        { id: "a", text: "Se llenan con NaN", isCorrect: false },
        { id: "b", text: "Se eliminan completamente", isCorrect: true },
        { id: "c", text: "Se duplican", isCorrect: false },
        { id: "d", text: "Genera un error", isCorrect: false },
      ],
      explanation: "Un inner join solo mantiene las filas que tienen match en ambos DataFrames.",
    },
    {
      section: "Python",
      difficulty: "MID",
      tags: ["pandas", "performance"],
      questionText: '¿Cuál es la forma más eficiente de aplicar una operación a un DataFrame completo?\n\nOpción A: `df["new_col"] = df["old_col"] * 2`\nOpción B: `df["new_col"] = df["old_col"].apply(lambda x: x * 2)`',
      options: [
        { id: "a", text: "Ambas tienen el mismo performance", isCorrect: false },
        { id: "b", text: "Opción A es más eficiente (vectorización)", isCorrect: true },
        { id: "c", text: "Opción B es más eficiente", isCorrect: false },
        { id: "d", text: "Depende del tamaño del DataFrame", isCorrect: false },
      ],
      explanation: "La vectorización (Opción A) es mucho más rápida que apply() porque opera a nivel de C en lugar de Python loops.",
    },
    {
      section: "Python",
      difficulty: "SENIOR",
      tags: ["pandas", "groupby", "transform"],
      questionText: '¿Qué hace este código?\n```python\ndf.groupby("category")["amount"].transform("sum")\n```',
      codeSnippet: 'df.groupby("category")["amount"].transform("sum")',
      options: [
        { id: "a", text: "Suma por categoría y retorna un DataFrame agrupado", isCorrect: false },
        { id: "b", text: "Suma por categoría y retorna una Serie con el mismo índice que el original", isCorrect: true },
        { id: "c", text: "Suma total de amount ignorando category", isCorrect: false },
        { id: "d", text: "Genera un error", isCorrect: false },
      ],
      explanation: "transform() retorna una Serie del mismo tamaño que el DataFrame original, con el valor agregado repetido para cada fila del grupo.",
    },
    {
      section: "Python",
      difficulty: "MID",
      tags: ["pandas", "missing"],
      questionText: "Para manejar valores nulos, ¿cuál es la diferencia entre `fillna()` y `interpolate()`?",
      options: [
        { id: "a", text: "fillna() llena con un valor fijo, interpolate() calcula valores intermedios", isCorrect: true },
        { id: "b", text: "Son idénticos", isCorrect: false },
        { id: "c", text: "interpolate() solo funciona con fechas", isCorrect: false },
        { id: "d", text: "fillna() es más rápido siempre", isCorrect: false },
      ],
      explanation: "fillna() rellena con un valor específico (constante), mientras que interpolate() calcula valores basándose en valores vecinos.",
    },
    {
      section: "Python",
      difficulty: "SENIOR",
      tags: ["pandas", "merge", "cartesian"],
      questionText: "¿Cuántas filas retorna este merge?\n```python\ndf1 = pd.DataFrame({'id': [1, 1, 2], 'val': [10, 20, 30]})\ndf2 = pd.DataFrame({'id': [1, 2, 2], 'score': [100, 200, 300]})\nresult = pd.merge(df1, df2, on='id')\n```",
      codeSnippet: "df1 = pd.DataFrame({'id': [1, 1, 2], 'val': [10, 20, 30]})\ndf2 = pd.DataFrame({'id': [1, 2, 2], 'score': [100, 200, 300]})\nresult = pd.merge(df1, df2, on='id')",
      options: [
        { id: "a", text: "3 filas", isCorrect: false },
        { id: "b", text: "4 filas (producto cartesiano de matches)", isCorrect: true },
        { id: "c", text: "5 filas", isCorrect: false },
        { id: "d", text: "Genera un error", isCorrect: false },
      ],
      explanation: "id=1: 2 filas en df1 × 1 en df2 = 2 combinaciones. id=2: 1 fila en df1 × 2 en df2 = 2 combinaciones. Total: 4 filas.",
    },
    {
      section: "Python",
      difficulty: "MID",
      tags: ["pandas", "binning"],
      questionText: "¿Qué hace `pd.cut()` vs `pd.qcut()`?",
      options: [
        { id: "a", text: "Ambos crean bins de igual tamaño", isCorrect: false },
        { id: "b", text: "cut() usa intervalos iguales, qcut() usa quantiles", isCorrect: true },
        { id: "c", text: "Son idénticos", isCorrect: false },
        { id: "d", text: "qcut() solo funciona con enteros", isCorrect: false },
      ],
      explanation: "cut() divide en intervalos de igual ancho. qcut() divide en quantiles (cada bin tiene aprox. el mismo número de valores).",
    },
    {
      section: "Python",
      difficulty: "JUNIOR",
      tags: ["pandas", "datetime"],
      questionText: "Para convertir una columna de texto a datetime en pandas:",
      options: [
        { id: "a", text: 'df["date"] = datetime(df["date"])', isCorrect: false },
        { id: "b", text: 'df["date"] = pd.to_datetime(df["date"])', isCorrect: true },
        { id: "c", text: 'df["date"] = df["date"].astype("datetime")', isCorrect: false },
        { id: "d", text: 'df["date"] = df["date"].convert_datetime()', isCorrect: false },
      ],
      explanation: "pd.to_datetime() es la forma correcta y flexible de convertir a datetime.",
    },
    {
      section: "Python",
      difficulty: "SENIOR",
      tags: ["pandas", "missing"],
      questionText: "¿Cuál es el comportamiento de `dropna()` por defecto?",
      options: [
        { id: "a", text: "Elimina filas con ANY valor nulo", isCorrect: true },
        { id: "b", text: "Elimina filas con TODOS los valores nulos", isCorrect: false },
        { id: "c", text: "Elimina columnas con valores nulos", isCorrect: false },
        { id: "d", text: "Llena los nulos con 0", isCorrect: false },
      ],
      explanation: 'Por defecto, dropna() elimina filas que tengan al menos un valor nulo (how="any").',
    },
    {
      section: "Python",
      difficulty: "MID",
      tags: ["pandas", "reshape"],
      questionText: "¿Qué función convierte datos de formato largo a ancho en pandas?",
      options: [
        { id: "a", text: "df.melt()", isCorrect: false },
        { id: "b", text: "df.pivot_table()", isCorrect: true },
        { id: "c", text: "df.transpose()", isCorrect: false },
        { id: "d", text: "df.stack()", isCorrect: false },
      ],
      explanation: "pivot_table() convierte de formato largo a ancho. melt() hace lo contrario.",
    },
    {
      section: "Python",
      difficulty: "SENIOR",
      tags: ["pandas", "sampling"],
      questionText: "¿Qué retorna `df.sample(frac=0.8, random_state=42)` si df tiene 1000 filas?",
      options: [
        { id: "a", text: "800 filas aleatorias reproducibles", isCorrect: true },
        { id: "b", text: "800 filas secuenciales desde el inicio", isCorrect: false },
        { id: "c", text: "Error porque frac debe ser entero", isCorrect: false },
        { id: "d", text: "Todas las filas del DataFrame", isCorrect: false },
      ],
      explanation: "sample(frac=0.8) toma el 80% de filas aleatoriamente. random_state=42 hace que sea reproducible.",
    },
    {
      section: "Python",
      difficulty: "MID",
      tags: ["pandas", "io", "encoding"],
      questionText: "¿Cuál es la forma correcta de leer un CSV con encoding latino?",
      options: [
        { id: "a", text: 'pd.read_csv("file.csv") sin parámetros', isCorrect: false },
        { id: "b", text: 'pd.read_csv("file.csv", encoding="latin-1") o encoding="iso-8859-1"', isCorrect: true },
        { id: "c", text: 'pd.read_csv("file.csv", encoding="utf-16")', isCorrect: false },
        { id: "d", text: 'pd.read_csv("file.csv", encoding="ascii")', isCorrect: false },
      ],
      explanation: "latin-1 e iso-8859-1 son equivalentes. utf-8 es diferente y puede fallar con caracteres latinos.",
    },
  ];

  const sasQuestions = [
    {
      section: "SAS",
      difficulty: "MID",
      tags: ["merge", "sql"],
      questionText: "En SAS, ¿cuál es la diferencia entre un DATA step merge y PROC SQL join?",
      options: [
        { id: "a", text: "No hay diferencia funcional", isCorrect: false },
        { id: "b", text: "DATA step requiere datos ordenados, SQL no", isCorrect: true },
        { id: "c", text: "SQL es siempre más rápido", isCorrect: false },
        { id: "d", text: "DATA step no puede hacer left joins", isCorrect: false },
      ],
      explanation: "DATA step merge requiere que los datos estén ordenados por la variable BY. PROC SQL no requiere orden previo.",
    },
    {
      section: "SAS",
      difficulty: "SENIOR",
      tags: ["data-step", "by", "retain"],
      questionText: "¿Qué hace este código SAS?\n```sas\ndata output;\n  set input;\n  by customer_id;\n  if first.customer_id then total = 0;\n  total + amount;\n  if last.customer_id then output;\n  keep customer_id total;\nrun;\n```",
      codeSnippet: "data output;\n  set input;\n  by customer_id;\n  if first.customer_id then total = 0;\n  total + amount;\n  if last.customer_id then output;\n  keep customer_id total;\nrun;",
      options: [
        { id: "a", text: "Suma el amount por customer y retorna solo el total final por grupo", isCorrect: true },
        { id: "b", text: "Suma el amount total de todos los customers", isCorrect: false },
        { id: "c", text: "Cuenta cuántos registros tiene cada customer", isCorrect: false },
        { id: "d", text: "Genera un error de sintaxis", isCorrect: false },
      ],
      explanation: "Este código acumula amount por customer_id y solo hace output de la última fila de cada grupo.",
    },
    {
      section: "SAS",
      difficulty: "JUNIOR",
      tags: ["macro", "basics"],
      questionText: "Para crear una macro variable en SAS, ¿cuál es la sintaxis correcta?",
      options: [
        { id: "a", text: "%macro var = value;", isCorrect: false },
        { id: "b", text: "%let var = value;", isCorrect: true },
        { id: "c", text: "let var = value;", isCorrect: false },
        { id: "d", text: "var = value;", isCorrect: false },
      ],
      explanation: "%let es la forma correcta de crear macro variables en SAS.",
    },
    {
      section: "SAS",
      difficulty: "SENIOR",
      tags: ["proc-sql", "calculated"],
      questionText: "¿Qué hace `CALCULATED` en PROC SQL?\n```sas\nproc sql;\n  select name,\n    sales * 1.15 as sales_with_tax,\n    calculated sales_with_tax * 0.1 as commission\n  from dataset;\nquit;\n```",
      codeSnippet: "proc sql;\n  select name,\n    sales * 1.15 as sales_with_tax,\n    calculated sales_with_tax * 0.1 as commission\n  from dataset;\nquit;",
      options: [
        { id: "a", text: "Genera error", isCorrect: false },
        { id: "b", text: "Permite reutilizar columnas calculadas en la misma query", isCorrect: true },
        { id: "c", text: "Es equivalente a no usar CALCULATED", isCorrect: false },
        { id: "d", text: "Solo funciona en WHERE clause", isCorrect: false },
      ],
      explanation: "CALCULATED permite referenciar columnas calculadas previamente en el mismo SELECT.",
    },
    {
      section: "SAS",
      difficulty: "MID",
      tags: ["data-step", "basics"],
      questionText: "En un DATA step, ¿cuál es la diferencia entre `SET` y `MERGE`?",
      options: [
        { id: "a", text: "SET lee un dataset, MERGE combina múltiples por variables BY", isCorrect: true },
        { id: "b", text: "Son sinónimos", isCorrect: false },
        { id: "c", text: "SET es más rápido siempre", isCorrect: false },
        { id: "d", text: "MERGE solo funciona con exactamente 2 datasets", isCorrect: false },
      ],
      explanation: "SET lee datos de uno o más datasets secuencialmente. MERGE combina datasets por variables BY.",
    },
    {
      section: "SAS",
      difficulty: "JUNIOR",
      tags: ["format", "data-step"],
      questionText: "¿Qué hace aplicar FORMAT a una variable dentro de un DATA step?",
      options: [
        { id: "a", text: "Aplica formato solo en OUTPUT de impresión", isCorrect: false },
        { id: "b", text: "Aplica formato permanente al dataset", isCorrect: true },
        { id: "c", text: "Genera error fuera de PROC PRINT", isCorrect: false },
        { id: "d", text: "Cambia el tipo de dato de la variable", isCorrect: false },
      ],
      explanation: "FORMAT en un DATA step aplica el formato de forma permanente al dataset resultante.",
    },
    {
      section: "SAS",
      difficulty: "SENIOR",
      tags: ["macro", "logic"],
      questionText: "¿Qué imprime en el log este código?\n```sas\n%macro test(var);\n  %if &var > 10 %then %do;\n    %put High;\n  %end;\n  %else %do;\n    %put Low;\n  %end;\n%mend;\n%test(15);\n```",
      codeSnippet: "%macro test(var);\n  %if &var > 10 %then %do;\n    %put High;\n  %end;\n  %else %do;\n    %put Low;\n  %end;\n%mend;\n%test(15);",
      options: [
        { id: "a", text: '"High" en el log', isCorrect: true },
        { id: "b", text: '"Low" en el log', isCorrect: false },
        { id: "c", text: "Genera error porque falta %EVAL", isCorrect: false },
        { id: "d", text: "No imprime nada", isCorrect: false },
      ],
      explanation: "%put escribe en el log. La condición 15 > 10 es verdadera, por lo que imprime 'High'.",
    },
    {
      section: "SAS",
      difficulty: "MID",
      tags: ["data-step", "by", "first-last"],
      questionText: "Para mantener solo la primera observación por grupo, ¿cuál código es correcto?\n```sas\ndata output;\n  set input;\n  by group_var;\n  if first.group_var;\nrun;\n```",
      codeSnippet: "data output;\n  set input;\n  by group_var;\n  if first.group_var;\nrun;",
      options: [
        { id: "a", text: "Correcto, mantiene solo la primera observación por grupo", isCorrect: true },
        { id: "b", text: 'Falta "then output;" explícito', isCorrect: false },
        { id: "c", text: "Genera error de sintaxis", isCorrect: false },
        { id: "d", text: "Mantiene la última observación, no la primera", isCorrect: false },
      ],
      explanation: "Un IF sin THEN en SAS hace output implícitamente cuando la condición es verdadera.",
    },
    {
      section: "SAS",
      difficulty: "MID",
      tags: ["proc-means", "output"],
      questionText: "¿Qué hace `PROC MEANS` con la opción `NOPRINT`?",
      options: [
        { id: "a", text: "No calcula nada", isCorrect: false },
        { id: "b", text: "Calcula pero no muestra resultados en pantalla, solo crea dataset de salida", isCorrect: true },
        { id: "c", text: "Genera error", isCorrect: false },
        { id: "d", text: "Es equivalente a omitir NOPRINT", isCorrect: false },
      ],
      explanation: "NOPRINT suprime la salida visual pero permite crear un dataset OUTPUT con los resultados.",
    },
    {
      section: "SAS",
      difficulty: "SENIOR",
      tags: ["proc-sql", "self-join"],
      questionText: "¿Es válido este self-join en PROC SQL?\n```sas\nproc sql;\n  select a.id, a.value, b.value as prev_value\n  from dataset as a, dataset as b\n  where a.id = b.id + 1;\nquit;\n```",
      codeSnippet: "proc sql;\n  select a.id, a.value, b.value as prev_value\n  from dataset as a, dataset as b\n  where a.id = b.id + 1;\nquit;",
      options: [
        { id: "a", text: "Sí, es un self-join válido para traer el valor anterior", isCorrect: true },
        { id: "b", text: "Genera error de sintaxis", isCorrect: false },
        { id: "c", text: "Retorna todas las combinaciones posibles sin filtro", isCorrect: false },
        { id: "d", text: "Necesita LEFT JOIN obligatoriamente", isCorrect: false },
      ],
      explanation: "Self-join válido que relaciona cada fila con la anterior por ID usando aliases.",
    },
  ];

  const allQuestions = [...pythonQuestions, ...sasQuestions];
  let created = 0;
  let updated = 0;

  for (const q of allQuestions) {
    const result = await upsertQuestion(template.id, q);
    if (result === "created") created++;
    else updated++;
  }

  console.log(`  📝 Preguntas: ${created} creadas, ${updated} actualizadas`);

  // Coding Challenge
  const existingChallenge = await prisma.codingChallenge.findFirst({
    where: { templateId: template.id, title: "Análisis de Cartera de Crédito" },
  });

  if (!existingChallenge) {
    await prisma.codingChallenge.create({
      data: {
        templateId: template.id,
        title: "Análisis de Cartera de Crédito",
        description: "Análisis de riesgo de una cartera de préstamos personales",
        difficulty: "MID",
        timeLimit: 45,
        instructions: `# Análisis de Cartera de Crédito

## Contexto
Eres analista de riesgo y debes analizar una cartera de préstamos personales.

## Tareas

### 1. Data Cleaning (15 pts)
- Convertir fechas a datetime
- Manejar valores nulos
- Detectar y reportar duplicados
- Validar rangos (ej: interest_rate entre 0-100)

### 2. Feature Engineering (20 pts)
Crear estos features:
- \`total_paid\`: suma de pagos por préstamo
- \`max_days_late\`: máximo días de atraso
- \`payment_rate\`: total_paid / loan_amount
- \`loan_to_income_ratio\`: amount / customer_income

### 3. Risk Analysis (25 pts)
Segmentar en:
- **LOW**: max_days_late = 0 y payment_rate > 0.9
- **MEDIUM**: max_days_late ≤ 15 o payment_rate > 0.7
- **HIGH**: resto

Calcular métricas por segmento: count, default_rate, avg_amount, total_exposure`,
        starterCode: `import pandas as pd
import numpy as np

def clean_data(loans_df, customers_df, payments_df):
    """
    Limpia y valida los datos.
    Returns: tuple (loans_clean, customers_clean, payments_clean, report_dict)
    """
    # TU CÓDIGO AQUÍ
    pass

def create_features(loans_df, customers_df, payments_df):
    """
    Crea features para análisis de riesgo.
    Returns: DataFrame con loan_id y features calculados
    """
    # TU CÓDIGO AQUÍ
    pass

def risk_analysis(enriched_df):
    """
    Segmenta y analiza riesgo.
    Returns: DataFrame con [risk_segment, count, default_rate, avg_amount, total_exposure]
    """
    # TU CÓDIGO AQUÍ
    pass`,
        inputFiles: [
          {
            name: "loans.csv",
            preview: "loan_id,customer_id,amount,interest_rate,term_months,origination_date,status\nL001,C001,50000,12.5,24,2023-01-15,CURRENT",
          },
          {
            name: "customers.csv",
            preview: "customer_id,age,income,credit_score,region\nC001,35,45000,720,CDMX",
          },
          {
            name: "payments.csv",
            preview: "payment_id,loan_id,payment_date,amount_paid,days_late\nP001,L001,2023-02-15,2500,0",
          },
        ],
        testCases: [
          { name: "test_cleaning", description: "Valida limpieza de datos", points: 15 },
          { name: "test_features", description: "Valida creación de features", points: 20 },
          { name: "test_risk_analysis", description: "Valida segmentación de riesgo", points: 25 },
        ],
        language: "python",
        allowedLibs: ["pandas", "numpy"],
      },
    });
    console.log("  🧩 Coding challenge creado");
  } else {
    console.log("  🧩 Coding challenge ya existe, skip");
  }

  return template;
}

// ✅ Ejecución directa: npx ts-node prisma/seeds/data-analyst.ts
if (require.main === module) {
  seedDataAnalyst()
    .catch((e) => {
      console.error("❌ Error en seed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}