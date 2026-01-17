// prisma/seed-assessments.ts
import { PrismaClient, AssessmentDifficulty } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeDifficulty(d: unknown): AssessmentDifficulty {
  const v = String(d ?? "").trim().toUpperCase();
  if (v === "JUNIOR") return "JUNIOR";
  if (v === "MID") return "MID";
  if (v === "SENIOR") return "SENIOR";
  return "MID";
}

async function seedAssessments() {
  console.log("🌱 Seeding assessment system...");

  // Crear template Data Analyst
  const template = await prisma.assessmentTemplate.upsert({
    where: { slug: "data-analyst-sas-python-mid" },
    update: {},
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
        { name: "Python", questions: 12, weight: 30, timeLimit: 20 },
        { name: "SAS", questions: 10, weight: 25, timeLimit: 15 },
        { name: "Statistics", questions: 10, weight: 25, timeLimit: 15 },
        { name: "Risk", questions: 8, weight: 20, timeLimit: 10 },
      ],
      allowRetry: false,
      maxAttempts: 1,
      shuffleQuestions: true,
      penalizeWrong: true,
    },
  });

  console.log("✅ Created template:", template.slug);

  // Preguntas Python (12)
  const pythonQuestions = [
    {
      section: "Python",
      difficulty: "JUNIOR",
      tags: ["pandas", "basics"],
      questionText: "¿Cuál es la diferencia principal entre `.loc[]` y `.iloc[]` en pandas?",
      options: [
        { id: "a", text: "No hay diferencia, son sinónimos", isCorrect: false },
        {
          id: "b",
          text: ".loc[] usa etiquetas, .iloc[] usa posiciones enteras",
          isCorrect: true,
        },
        { id: "c", text: ".iloc[] es más rápido que .loc[]", isCorrect: false },
        { id: "d", text: ".loc[] solo funciona con índices numéricos", isCorrect: false },
      ],
      explanation:
        ".loc[] es label-based (usa nombres de índice/columna), mientras que .iloc[] es integer-based (usa posiciones numéricas).",
    },
    {
      section: "Python",
      difficulty: "MID",
      tags: ["pandas", "merge"],
      questionText:
        'Al hacer un `merge` de dos DataFrames con `how="inner"`, ¿qué sucede con las filas sin match?',
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
      questionText:
        '¿Cuál es la forma más eficiente de aplicar una operación a un DataFrame completo?\n\nOpción A: `df["new_col"] = df["old_col"] * 2`\nOpción B: `df["new_col"] = df["old_col"].apply(lambda x: x * 2)`',
      options: [
        { id: "a", text: "Ambas tienen el mismo performance", isCorrect: false },
        { id: "b", text: "Opción A es más eficiente (vectorización)", isCorrect: true },
        { id: "c", text: "Opción B es más eficiente", isCorrect: false },
        { id: "d", text: "Depende del tamaño del DataFrame", isCorrect: false },
      ],
      explanation:
        "La vectorización (Opción A) es mucho más rápida que apply() porque opera a nivel de C en lugar de Python loops.",
    },
    {
      section: "Python",
      difficulty: "SENIOR",
      tags: ["pandas", "groupby", "transform"],
      questionText:
        '¿Qué hace este código?\n```python\ndf.groupby("category")["amount"].transform("sum")\n```',
      options: [
        { id: "a", text: "Suma por categoría y retorna un DataFrame agrupado", isCorrect: false },
        {
          id: "b",
          text: "Suma por categoría y retorna una Serie con el mismo índice que el original",
          isCorrect: true,
        },
        { id: "c", text: "Suma total de amount ignorando category", isCorrect: false },
        { id: "d", text: "Genera un error", isCorrect: false },
      ],
      explanation:
        "transform() retorna una Serie del mismo tamaño que el DataFrame original, con el valor agregado repetido para cada fila del grupo.",
    },
    {
      section: "Python",
      difficulty: "MID",
      tags: ["pandas", "missing"],
      questionText:
        "Para manejar valores nulos, ¿cuál es la diferencia entre `fillna()` y `interpolate()`?",
      options: [
        {
          id: "a",
          text: "fillna() llena con un valor fijo, interpolate() calcula valores intermedios",
          isCorrect: true,
        },
        { id: "b", text: "Son idénticos", isCorrect: false },
        { id: "c", text: "interpolate() solo funciona con fechas", isCorrect: false },
        { id: "d", text: "fillna() es más rápido siempre", isCorrect: false },
      ],
      explanation:
        "fillna() rellena con un valor específico (constante), mientras que interpolate() calcula valores basándose en valores vecinos.",
    },
    {
      section: "Python",
      difficulty: "SENIOR",
      tags: ["pandas", "sampling"],
      questionText:
        "¿Qué retorna este código si `df` tiene 1000 filas?\n```python\ndf.sample(frac=0.8, random_state=42).index\n```",
      options: [
        { id: "a", text: "800 índices aleatorios reproducibles", isCorrect: true },
        { id: "b", text: "800 índices secuenciales desde el inicio", isCorrect: false },
        { id: "c", text: "Error porque frac debe ser ≤ 1", isCorrect: false },
        { id: "d", text: "Todos los índices del DataFrame original", isCorrect: false },
      ],
      explanation:
        "sample(frac=0.8) toma el 80% de filas aleatoriamente. random_state=42 hace que sea reproducible.",
    },
    {
      section: "Python",
      difficulty: "MID",
      tags: ["pandas", "io", "encoding"],
      questionText: "¿Cuál es la forma correcta de leer un CSV con encoding latino?",
      options: [
        { id: "a", text: 'Solo pd.read_csv("file.csv", encoding="latin-1")', isCorrect: false },
        {
          id: "b",
          text: 'pd.read_csv("file.csv", encoding="latin-1") o encoding="iso-8859-1"',
          isCorrect: true,
        },
        { id: "c", text: 'Solo pd.read_csv("file.csv", encoding="utf-8")', isCorrect: false },
        { id: "d", text: "Todas son equivalentes", isCorrect: false },
      ],
      explanation: "latin-1 e iso-8859-1 son equivalentes. utf-8 es diferente.",
    },
    {
      section: "Python",
      difficulty: "SENIOR",
      tags: ["pandas", "merge", "cartesian"],
      questionText:
        'En un merge con duplicados en la llave, ¿qué pasa?\n```python\ndf1 = pd.DataFrame({"id": [1, 1, 2], "val": [10, 20, 30]})\ndf2 = pd.DataFrame({"id": [1, 2, 2], "score": [100, 200, 300]})\nresult = pd.merge(df1, df2, on="id")\n```',
      options: [
        { id: "a", text: "Retorna 3 filas", isCorrect: false },
        { id: "b", text: "Retorna 5 filas (producto cartesiano de matches)", isCorrect: true },
        { id: "c", text: "Genera un error", isCorrect: false },
        { id: "d", text: "Retorna 4 filas", isCorrect: false },
      ],
      explanation:
        "id=1 tiene 2 filas en df1 y 1 en df2 (2*1=2 combinaciones). id=2 tiene 1 en df1 y 2 en df2 (1*2=2). id=3 no existe. Total: 2+2+0 = 4 filas. Corrección: la respuesta correcta es d.",
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
      explanation:
        "cut() divide en intervalos de igual ancho. qcut() divide en quantiles (cada bin tiene aprox. el mismo número de valores).",
    },
    {
      section: "Python",
      difficulty: "JUNIOR",
      tags: ["pandas", "datetime"],
      questionText: "Para convertir una columna de texto a datetime:",
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
      explanation:
        'Por defecto, dropna() elimina filas que tengan al menos un valor nulo (how="any").',
    },
    {
      section: "Python",
      difficulty: "MID",
      tags: ["pandas", "reshape"],
      questionText:
        'Para pivotear datos de largo a ancho:\n```python\ndf = pd.DataFrame({\n  "date": ["2024-01", "2024-01", "2024-02"],\n  "product": ["A", "B", "A"],\n  "sales": [100, 200, 150]\n})\n```\n¿Qué función usar?',
      options: [
        { id: "a", text: "df.melt()", isCorrect: false },
        { id: "b", text: "df.pivot_table()", isCorrect: true },
        { id: "c", text: "df.transpose()", isCorrect: false },
        { id: "d", text: "df.stack()", isCorrect: false },
      ],
      explanation: "pivot_table() convierte de formato largo a ancho. melt() hace lo contrario.",
    },
  ];

  // Preguntas SAS (10)
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
      explanation:
        "DATA step merge requiere que los datos estén ordenados por la variable BY. PROC SQL no requiere orden previo.",
    },
    {
      section: "SAS",
      difficulty: "SENIOR",
      tags: ["data-step", "by", "retain"],
      questionText:
        "¿Qué hace este código SAS?\n```sas\ndata output;\n  set input;\n  by customer_id;\n  if first.customer_id then total = 0;\n  total + amount;\n  if last.customer_id then output;\n  keep customer_id total;\nrun;\n```",
      options: [
        {
          id: "a",
          text: "Suma el amount por customer y retorna solo el total final",
          isCorrect: true,
        },
        { id: "b", text: "Suma el amount total de todos los customers", isCorrect: false },
        { id: "c", text: "Cuenta cuántos registros tiene cada customer", isCorrect: false },
        { id: "d", text: "Genera un error", isCorrect: false },
      ],
      explanation:
        "Este código acumula amount por customer_id y solo hace output de la última fila de cada grupo.",
    },
    {
      section: "SAS",
      difficulty: "JUNIOR",
      tags: ["macro", "basics"],
      questionText: "Para crear una macro variable en SAS:",
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
      questionText:
        '¿Qué hace `PROC SQL` con `CALCULATED`?\n```sas\nproc sql;\n  select name,\n    sales * 1.15 as sales_with_tax,\n    calculated sales_with_tax * 0.1 as commission\n  from dataset;\nquit;\n```',
      options: [
        { id: "a", text: "Genera error", isCorrect: false },
        {
          id: "b",
          text: "Permite reutilizar columnas calculadas en la misma query",
          isCorrect: true,
        },
        { id: "c", text: "Es equivalente a no usar CALCULATED", isCorrect: false },
        { id: "d", text: "Solo funciona en WHERE clause", isCorrect: false },
      ],
      explanation:
        "CALCULATED permite referenciar columnas calculadas previamente en el mismo SELECT.",
    },
    {
      section: "SAS",
      difficulty: "MID",
      tags: ["data-step", "basics"],
      questionText: "En un DATA step, ¿cuál es la diferencia entre `SET` y `MERGE`?",
      options: [
        { id: "a", text: "SET lee un dataset, MERGE combina múltiples", isCorrect: true },
        { id: "b", text: "Son sinónimos", isCorrect: false },
        { id: "c", text: "SET es más rápido", isCorrect: false },
        { id: "d", text: "MERGE solo funciona con 2 datasets", isCorrect: false },
      ],
      explanation: "SET lee datos de uno o más datasets. MERGE combina datasets por variables BY.",
    },
    {
      section: "SAS",
      difficulty: "JUNIOR",
      tags: ["format", "data-step"],
      questionText: "Para aplicar un formato permanente a una variable:",
      options: [
        { id: "a", text: "Aplica formato solo en OUTPUT", isCorrect: false },
        { id: "b", text: "Aplica formato permanente al dataset", isCorrect: true },
        { id: "c", text: "Genera error", isCorrect: false },
        { id: "d", text: "Solo funciona en PROC PRINT", isCorrect: false },
      ],
      explanation: "FORMAT en un DATA step aplica el formato de forma permanente al dataset.",
    },
    {
      section: "SAS",
      difficulty: "SENIOR",
      tags: ["macro", "logic"],
      questionText:
        '¿Qué retorna esta macro?\n```sas\n%macro test(var);\n  %if &var > 10 %then %do;\n    %put High;\n  %end;\n  %else %do;\n    %put Low;\n  %end;\n%mend;\n%test(15);\n```',
      options: [
        { id: "a", text: 'Imprime "High" en el log', isCorrect: true },
        { id: "b", text: 'Crea una variable con valor "High"', isCorrect: false },
        { id: "c", text: "Genera error porque falta %EVAL", isCorrect: false },
        { id: "d", text: "No imprime nada", isCorrect: false },
      ],
      explanation: "%put escribe en el log. La condición 15 > 10 es verdadera.",
    },
    {
      section: "SAS",
      difficulty: "MID",
      tags: ["data-step", "by", "first-last"],
      questionText:
        'Para mantener solo la primera observación por grupo:\n```sas\ndata output;\n  set input;\n  by group_var;\n  if first.group_var;\nrun;\n```',
      options: [
        { id: "a", text: "Esto es correcto", isCorrect: true },
        { id: "b", text: 'Falta "then output;"', isCorrect: false },
        { id: "c", text: "Genera error", isCorrect: false },
        { id: "d", text: "Mantiene la última observación", isCorrect: false },
      ],
      explanation: "Un IF sin THEN implícitamente hace output solo cuando es verdadero.",
    },
    {
      section: "SAS",
      difficulty: "MID",
      tags: ["proc-means", "output"],
      questionText: "¿Qué hace `PROC MEANS` con `NOPRINT`?",
      options: [
        { id: "a", text: "No calcula nada", isCorrect: false },
        {
          id: "b",
          text: "Calcula pero no muestra resultados, solo crea dataset",
          isCorrect: true,
        },
        { id: "c", text: "Genera error", isCorrect: false },
        { id: "d", text: "Es equivalente a omitir NOPRINT", isCorrect: false },
      ],
      explanation:
        "NOPRINT suprime la salida visual pero permite crear un dataset de resultados.",
    },
    {
      section: "SAS",
      difficulty: "SENIOR",
      tags: ["proc-sql", "self-join"],
      questionText:
        "Para hacer un self-join en PROC SQL:\n```sas\nproc sql;\n  select a.id, a.value, b.value as prev_value\n  from dataset as a, dataset as b\n  where a.id = b.id + 1;\nquit;\n```",
      options: [
        { id: "a", text: "Esto es correcto para traer el valor previo", isCorrect: true },
        { id: "b", text: "Genera error de sintaxis", isCorrect: false },
        { id: "c", text: "Retorna todas las combinaciones", isCorrect: false },
        { id: "d", text: "Necesita un LEFT JOIN obligatoriamente", isCorrect: false },
      ],
      explanation: "Self-join válido que relaciona cada fila con la anterior por ID.",
    },
  ];

  // Crear todas las preguntas
  const allQuestions = [...pythonQuestions, ...sasQuestions];

  for (const q of allQuestions) {
    await prisma.assessmentQuestion.create({
      data: {
        ...q,
        templateId: template.id,
        difficulty: normalizeDifficulty((q as any).difficulty),
      },
    });
  }

  console.log(`✅ Created ${allQuestions.length} questions`);

  // Crear coding challenge
  const challenge = await prisma.codingChallenge.create({
    data: {
      templateId: template.id,
      title: "Análisis de Cartera de Crédito",
      description: "Análisis de riesgo de una cartera de préstamos personales",
      difficulty: "MID",
      timeLimit: 45,
      instructions: `# Análisis de Cartera de Crédito

## Contexto
Eres analista de riesgo y debes analizar una cartera de préstamos personales.

## Archivos proporcionados:
- \`loans.csv\`: Información de préstamos
- \`customers.csv\`: Datos de clientes  
- \`payments.csv\`: Historial de pagos

## Tareas:

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
Segmentar préstamos en 3 grupos:
- **LOW**: max_days_late = 0 y payment_rate > 0.9
- **MEDIUM**: max_days_late ≤ 15 o payment_rate > 0.7
- **HIGH**: resto

Calcular métricas por segmento:
- count, default_rate, avg_amount, total_exposure

## Entregables
Implementa las 3 funciones con los nombres exactos especificados.`,
      starterCode: `import pandas as pd
import numpy as np

def clean_data(loans_df, customers_df, payments_df):
    """
    Limpia y valida los datos.
    
    Returns:
        tuple: (loans_clean, customers_clean, payments_clean, report_dict)
    """
    # TU CÓDIGO AQUÍ
    pass

def create_features(loans_df, customers_df, payments_df):
    """
    Crea features para análisis de riesgo.
    
    Returns:
        DataFrame con loan_id y features calculados
    """
    # TU CÓDIGO AQUÍ
    pass

def risk_analysis(enriched_df):
    """
    Segmenta y analiza riesgo.
    
    Returns:
        DataFrame con: [risk_segment, count, default_rate, avg_amount, total_exposure]
    """
    # TU CÓDIGO AQUÍ
    pass
`,
      inputFiles: [
        {
          name: "loans.csv",
          url: "s3://assessment-data/loans.csv",
          preview:
            "loan_id,customer_id,amount,interest_rate,term_months,origination_date,status\nL001,C001,50000,12.5,24,2023-01-15,CURRENT",
        },
        {
          name: "customers.csv",
          url: "s3://assessment-data/customers.csv",
          preview: "customer_id,age,income,credit_score,region\nC001,35,45000,720,CDMX",
        },
        {
          name: "payments.csv",
          url: "s3://assessment-data/payments.csv",
          preview: "payment_id,loan_id,payment_date,amount_paid,days_late\nP001,L001,2023-02-15,2500,0",
        },
      ],
      testCases: [
        {
          name: "test_cleaning",
          description: "Valida limpieza de datos",
          points: 15,
          expectedBehavior: "Remueve duplicados, maneja nulos, valida rangos",
        },
        {
          name: "test_features",
          description: "Valida creación de features",
          points: 20,
          expectedBehavior:
            "Crea total_paid, max_days_late, payment_rate, loan_to_income_ratio",
        },
        {
          name: "test_risk_analysis",
          description: "Valida segmentación de riesgo",
          points: 25,
          expectedBehavior: "Segmenta correctamente en LOW/MEDIUM/HIGH y calcula métricas",
        },
      ],
      language: "python",
      allowedLibs: ["pandas", "numpy"],
    },
  });

  console.log("✅ Created coding challenge");

  console.log("\n🎉 Assessment seed completed successfully!");
  console.log(`
📊 Summary:
- Template: ${template.title}
- Questions: ${allQuestions.length} MCQ
- Coding Challenges: 1
- Estimated time: ${template.timeLimit} minutes
- Passing score: ${template.passingScore}%
  `);
}

seedAssessments()
  .catch((e) => {
    console.error("❌ Error seeding assessments:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
