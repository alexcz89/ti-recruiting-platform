import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const validateOnly = process.argv.includes("--validate-only");
const dryRun = process.argv.includes("--dry-run");
const VERSION = "sql-progressive-badges-v1";

const lines = (...values) => values.join("\\n");
const output = (...rows) => rows.join("\\n") + "\\n";
const test = (setup, expected, hidden = false) => ({ setup, expected, hidden });
const mcq = (id, title, text, options, correctIndex, explanation) => ({
  id,
  title,
  text,
  options,
  correctIndex,
  explanation,
});
const practical = (
  id,
  title,
  text,
  schema,
  starter,
  solution,
  publicTest,
  hiddenTest
) => ({
  id,
  title,
  text: lines("## " + title, "", text, "", "**Esquema:**", schema),
  starter,
  solution,
  tests: [publicTest, hiddenTest],
});

const intermediateConceptual = [
  mcq("ic01", "Cardinalidad de joins", "Un pedido tiene tres partidas. Al unir pedidos con detalle_pedido, el total del pedido aparece tres veces antes de agregar. ¿Cuál es la causa?", ["El INNER JOIN elimina filas", "La relación uno-a-muchos multiplica la fila del pedido", "GROUP BY siempre duplica resultados", "La llave primaria no puede usarse en joins"], 1, "Una relación uno-a-muchos produce una fila por cada detalle relacionado."),
  mcq("ic02", "WHERE o HAVING", "Necesitas mostrar clientes cuya suma de compras sea mayor a 10000. ¿Dónde debe aplicarse el filtro sobre SUM(total)?", ["WHERE SUM(total) > 10000", "ON SUM(total) > 10000", "HAVING SUM(total) > 10000", "ORDER BY SUM(total) > 10000"], 2, "HAVING filtra grupos después de calcular agregados."),
  mcq("ic03", "EXISTS correlacionado", "¿Qué expresa mejor una subconsulta EXISTS correlacionada?", ["Calcula una tabla temporal permanente", "Comprueba si existe al menos una fila relacionada para la fila externa", "Ordena dos consultas al mismo tiempo", "Convierte NULL en cero"], 1, "EXISTS responde a la existencia de filas relacionadas y puede cortocircuitar."),
  mcq("ic04", "CTE legible", "¿Cuándo aporta más valor una CTE?", ["Cuando una transformación intermedia compleja se reutiliza o necesita un nombre claro", "Cuando se requiere crear un índice", "Cuando se modifica el esquema", "Cuando se quiere omitir el SELECT"], 0, "Una CTE ayuda a separar etapas lógicas y mejorar legibilidad."),
  mcq("ic05", "Ventanas y detalle", "¿Qué diferencia principal existe entre SUM() OVER(...) y SUM() con GROUP BY?", ["La función de ventana conserva las filas de detalle", "GROUP BY conserva siempre todas las filas", "Las ventanas solo funcionan con texto", "No existe diferencia"], 0, "Las ventanas calculan métricas sin colapsar cada partición a una sola fila."),
  mcq("ic06", "Rollback", "Una transacción actualiza inventario y luego falla al registrar el movimiento. ¿Qué propiedad protege la consistencia si se ejecuta ROLLBACK?", ["Atomicidad", "Disponibilidad", "Particionamiento", "Compresión"], 0, "La atomicidad garantiza todo o nada dentro de la transacción."),
  mcq("ic07", "Índice compuesto", "Para WHERE empresa_id = ? AND fecha >= ? con ORDER BY fecha, ¿qué índice suele ser más útil?", ["(fecha, empresa_id) siempre", "(empresa_id, fecha)", "(descripcion)", "Un índice por cada columna sin considerar el patrón"], 1, "La igualdad por empresa seguida del rango/orden por fecha aprovecha el prefijo compuesto."),
  mcq("ic08", "LEFT JOIN convertido", "Una consulta usa LEFT JOIN pedidos p, pero agrega WHERE p.estado = 'PAGADO'. ¿Qué efecto tiene?", ["Conserva clientes sin pedidos", "Se comporta como INNER JOIN para esa condición", "Duplica todas las tablas", "Ignora el estado"], 1, "El WHERE descarta las filas donde p es NULL."),
  mcq("ic09", "COUNT correcto", "En un LEFT JOIN de clientes con pedidos, ¿qué expresión cuenta cero para clientes sin pedidos?", ["COUNT(*)", "COUNT(1)", "COUNT(p.id)", "SUM(*)"], 2, "COUNT(columna) ignora NULL; COUNT(*) cuenta la fila preservada por el LEFT JOIN."),
  mcq("ic10", "NULL en NOT IN", "¿Por qué NOT EXISTS suele ser más seguro que NOT IN cuando la subconsulta puede devolver NULL?", ["NOT EXISTS elimina índices", "NULL puede volver desconocidas las comparaciones de NOT IN", "NOT IN no admite subconsultas", "NOT EXISTS ordena automáticamente"], 1, "La lógica de tres valores puede hacer que NOT IN no devuelva filas si aparece NULL."),
  mcq("ic11", "ROW_NUMBER", "¿Para qué sirve ROW_NUMBER() OVER(PARTITION BY cliente_id ORDER BY fecha DESC)?", ["Numerar globalmente sin orden", "Asignar 1 al registro más reciente de cada cliente", "Sumar fechas", "Eliminar físicamente duplicados"], 1, "La numeración reinicia por cliente y sigue el orden indicado."),
  mcq("ic12", "Plan de ejecución", "Un EXPLAIN muestra un escaneo completo sobre una tabla grande para un filtro selectivo. ¿Qué revisar primero?", ["Un índice alineado con las columnas del filtro", "El color del editor", "La cantidad de aliases", "Cambiar SELECT por DELETE"], 0, "Un índice útil puede evitar revisar toda la tabla para filtros selectivos."),
  mcq("ic13", "UNION ALL", "Si dos fuentes no requieren eliminar duplicados, ¿por qué elegir UNION ALL sobre UNION?", ["UNION ALL ordena siempre", "Evita el costo de deduplicar", "Crea una tabla permanente", "Solo acepta números"], 1, "UNION normalmente requiere trabajo adicional para eliminar duplicados."),
  mcq("ic14", "Filtro en ON", "En un LEFT JOIN, ¿dónde colocar una condición de la tabla derecha para conservar filas sin coincidencia?", ["En ON", "En HAVING sin GROUP BY", "Después de ORDER BY", "En LIMIT"], 0, "La condición en ON restringe coincidencias sin eliminar la fila preservada de la izquierda."),
];

const advancedConceptual = [
  mcq("ac01", "Sargabilidad", "¿Cuál predicado permite aprovechar mejor un índice sobre fecha_creacion?", ["DATE(fecha_creacion) = '2026-07-01'", "fecha_creacion >= '2026-07-01' AND fecha_creacion < '2026-07-02'", "CAST(fecha_creacion AS TEXT) LIKE '2026-07-01%'", "strftime('%Y', fecha_creacion) = '2026'"], 1, "Evitar funciones sobre la columna indexada mantiene el predicado sargable."),
  mcq("ac02", "Prefijo izquierdo", "Existe un índice (empresa_id, estado, fecha). ¿Qué consulta no puede aprovechar bien su prefijo izquierdo?", ["empresa_id = 7", "empresa_id = 7 AND estado = 'ACTIVO'", "estado = 'ACTIVO' sin empresa_id", "empresa_id = 7 AND estado = 'ACTIVO' AND fecha >= ?"], 2, "Sin la primera columna, el índice compuesto suele perder gran parte de su utilidad."),
  mcq("ac03", "Deadlock", "Dos transacciones bloquean recursos en orden contrario. ¿Cuál es la mitigación más directa?", ["Acceder a recursos en un orden consistente y reintentar víctimas", "Desactivar todas las transacciones", "Usar SELECT *", "Eliminar las llaves foráneas"], 0, "Un orden consistente reduce ciclos de espera; el reintento maneja víctimas inevitables."),
  mcq("ac04", "Aislamiento", "¿Qué fenómeno evita REPEATABLE READ respecto de READ COMMITTED?", ["Lecturas no repetibles", "Todos los deadlocks", "Errores de sintaxis", "Falta de índices"], 0, "La misma fila leída de nuevo mantiene su versión según la semántica del motor."),
  mcq("ac05", "Particionamiento", "¿Cuándo es razonable particionar una tabla de eventos por fecha?", ["Cuando es grande y las consultas/retención se acotan por rangos de fecha", "Cuando tiene diez filas", "Para reemplazar cualquier índice", "Para evitar definir llaves"], 0, "La poda de particiones y el mantenimiento por periodos aportan valor en datos grandes."),
  mcq("ac06", "Vista materializada", "¿Qué trade-off introduce una vista materializada?", ["Lecturas más rápidas a cambio de refrescar datos precomputados", "Es siempre transaccional en tiempo real", "Elimina la fuente original", "No ocupa almacenamiento"], 0, "Precalcula resultados, pero requiere almacenamiento y estrategia de actualización."),
  mcq("ac07", "Doble conteo", "Un reporte une facturas con pagos y conceptos, ambas relaciones uno-a-muchos. ¿Cómo evitar inflar montos?", ["Preagregar pagos y conceptos por factura antes de unir", "Agregar más DISTINCT sobre todas las columnas", "Eliminar GROUP BY", "Usar CROSS JOIN"], 0, "Preagregar cada relación al mismo grano evita el producto multiplicativo."),
  mcq("ac08", "Estimación de cardinalidad", "¿Qué puede provocar estadísticas desactualizadas?", ["Elección de planes deficientes por estimaciones incorrectas", "Cambio automático de tipos", "Pérdida de sintaxis SQL", "Conversión de NULL a cero"], 0, "El optimizador depende de estadísticas para estimar filas y costos."),
  mcq("ac09", "NULL semántico", "En métricas financieras, ¿por qué COALESCE(valor, 0) debe usarse con cuidado?", ["Puede ocultar que el dato era desconocido, no realmente cero", "No funciona con números", "Siempre rompe índices", "Convierte la consulta en escritura"], 0, "Desconocido y cero tienen significados de negocio distintos."),
  mcq("ac10", "Clave de idempotencia", "En una carga incremental, ¿qué ayuda a evitar duplicados al reintentar?", ["Una clave natural/idempotente y una operación de upsert controlada", "ORDER BY aleatorio", "Eliminar restricciones", "COUNT(*) antes de cada fila sin transacción"], 0, "La identidad estable permite reconocer eventos ya procesados."),
];

const intermediatePractical = [
  practical("ip01", "Pedidos con detalle y cliente", "Devuelve cliente, pedido_id y total_calculado de pedidos PAGADOS. Calcula el total con cantidad * precio y conserva solo totales de al menos 100.", "- clientes(id, nombre)\\n- pedidos(id, cliente_id, estado)\\n- detalle_pedido(pedido_id, cantidad, precio)", lines("SELECT -- cliente, pedido_id, total_calculado", "FROM clientes c", "-- joins", "WHERE -- estado", "GROUP BY -- pedido", "HAVING -- minimo", "ORDER BY total_calculado DESC, pedido_id ASC;"), lines("SELECT c.nombre AS cliente, p.id AS pedido_id,", "       SUM(d.cantidad * d.precio) AS total_calculado", "FROM clientes c", "JOIN pedidos p ON p.cliente_id = c.id", "JOIN detalle_pedido d ON d.pedido_id = p.id", "WHERE p.estado = 'PAGADO'", "GROUP BY c.nombre, p.id", "HAVING SUM(d.cantidad * d.precio) >= 100", "ORDER BY total_calculado DESC, pedido_id ASC;"), test(lines("CREATE TABLE clientes(id INTEGER, nombre TEXT);","CREATE TABLE pedidos(id INTEGER, cliente_id INTEGER, estado TEXT);","CREATE TABLE detalle_pedido(pedido_id INTEGER, cantidad INTEGER, precio INTEGER);","INSERT INTO clientes VALUES (1,'Ana'),(2,'Luis');","INSERT INTO pedidos VALUES (10,1,'PAGADO'),(11,2,'PAGADO'),(12,1,'PENDIENTE');","INSERT INTO detalle_pedido VALUES (10,2,80),(10,1,50),(11,1,90),(12,5,100);"), output("Ana|10|210")), test(lines("CREATE TABLE clientes(id INTEGER, nombre TEXT);","CREATE TABLE pedidos(id INTEGER, cliente_id INTEGER, estado TEXT);","CREATE TABLE detalle_pedido(pedido_id INTEGER, cantidad INTEGER, precio INTEGER);","INSERT INTO clientes VALUES (1,'Nora'),(2,'Beto');","INSERT INTO pedidos VALUES (20,1,'PAGADO'),(21,2,'PAGADO');","INSERT INTO detalle_pedido VALUES (20,2,70),(21,3,60);"), output("Beto|21|180","Nora|20|140"), true)),
  practical("ip02", "Conteos condicionales por agente", "Por agente devuelve total_tickets, abiertos y cerrados usando agregación condicional. Ordena por agente.", "tickets(id, agente, estado)", lines("SELECT agente,", "       COUNT(*) AS total_tickets,", "       -- abiertos,", "       -- cerrados", "FROM tickets", "GROUP BY agente", "ORDER BY agente;"), lines("SELECT agente,", "       COUNT(*) AS total_tickets,", "       SUM(CASE WHEN estado = 'ABIERTO' THEN 1 ELSE 0 END) AS abiertos,", "       SUM(CASE WHEN estado = 'CERRADO' THEN 1 ELSE 0 END) AS cerrados", "FROM tickets", "GROUP BY agente", "ORDER BY agente;"), test(lines("CREATE TABLE tickets(id INTEGER, agente TEXT, estado TEXT);","INSERT INTO tickets VALUES (1,'Ana','ABIERTO'),(2,'Ana','CERRADO'),(3,'Ana','ABIERTO'),(4,'Luis','CERRADO');"), output("Ana|3|2|1","Luis|1|0|1")), test(lines("CREATE TABLE tickets(id INTEGER, agente TEXT, estado TEXT);","INSERT INTO tickets VALUES (1,'Beto','CERRADO'),(2,'Beto','CERRADO'),(3,'Carla','ABIERTO');"), output("Beto|2|0|2","Carla|1|1|0"), true)),
  practical("ip03", "Productos sin ventas", "Devuelve id y nombre de productos que no aparecen en ventas. Usa NOT EXISTS y ordena por id.", "- productos(id, nombre)\\n- ventas(id, producto_id)", lines("SELECT p.id, p.nombre","FROM productos p","WHERE -- no existe venta","ORDER BY p.id;"), lines("SELECT p.id, p.nombre","FROM productos p","WHERE NOT EXISTS (","  SELECT 1 FROM ventas v WHERE v.producto_id = p.id",")","ORDER BY p.id;"), test(lines("CREATE TABLE productos(id INTEGER, nombre TEXT);","CREATE TABLE ventas(id INTEGER, producto_id INTEGER);","INSERT INTO productos VALUES (1,'A'),(2,'B'),(3,'C');","INSERT INTO ventas VALUES (10,1),(11,1),(12,3);"), output("2|B")), test(lines("CREATE TABLE productos(id INTEGER, nombre TEXT);","CREATE TABLE ventas(id INTEGER, producto_id INTEGER);","INSERT INTO productos VALUES (5,'X'),(6,'Y'),(7,'Z');","INSERT INTO ventas VALUES (20,6);"), output("5|X","7|Z"), true)),
  practical("ip04", "Departamentos sobre el promedio global", "Con CTE calcula salario_promedio y empleados por departamento. Devuelve departamentos cuyo promedio supera el promedio global.", "empleados(id, departamento, salario)", lines("WITH por_departamento AS (","  SELECT -- metricas","  FROM empleados","  GROUP BY departamento",")","SELECT departamento, salario_promedio, empleados","FROM por_departamento","WHERE -- sobre promedio global","ORDER BY departamento;"), lines("WITH por_departamento AS (","  SELECT departamento, AVG(salario) AS salario_promedio, COUNT(*) AS empleados","  FROM empleados","  GROUP BY departamento",")","SELECT departamento, salario_promedio, empleados","FROM por_departamento","WHERE salario_promedio > (SELECT AVG(salario) FROM empleados)","ORDER BY departamento;"), test(lines("CREATE TABLE empleados(id INTEGER, departamento TEXT, salario INTEGER);","INSERT INTO empleados VALUES (1,'Datos',60),(2,'Datos',80),(3,'QA',40),(4,'QA',50);"), output("Datos|70.0|2")), test(lines("CREATE TABLE empleados(id INTEGER, departamento TEXT, salario INTEGER);","INSERT INTO empleados VALUES (1,'A',100),(2,'A',80),(3,'B',20),(4,'C',60);"), output("A|90.0|2"), true)),
  practical("ip05", "Venta líder por vendedor", "Devuelve vendedor, venta_id y monto de la venta más alta de cada vendedor. En empate gana el menor venta_id.", "ventas(id, vendedor, monto)", lines("WITH ranked AS (","  SELECT -- columnas,","         ROW_NUMBER() OVER (PARTITION BY -- ORDER BY --) AS rn","  FROM ventas",")","SELECT vendedor, venta_id, monto","FROM ranked","WHERE rn = 1","ORDER BY vendedor;"), lines("WITH ranked AS (","  SELECT vendedor, id AS venta_id, monto,","         ROW_NUMBER() OVER (PARTITION BY vendedor ORDER BY monto DESC, id ASC) AS rn","  FROM ventas",")","SELECT vendedor, venta_id, monto","FROM ranked","WHERE rn = 1","ORDER BY vendedor;"), test(lines("CREATE TABLE ventas(id INTEGER, vendedor TEXT, monto INTEGER);","INSERT INTO ventas VALUES (1,'Ana',100),(2,'Ana',150),(3,'Luis',90),(4,'Luis',90);"), output("Ana|2|150","Luis|3|90")), test(lines("CREATE TABLE ventas(id INTEGER, vendedor TEXT, monto INTEGER);","INSERT INTO ventas VALUES (7,'Bea',300),(8,'Bea',200),(9,'Carla',50);"), output("Bea|7|300","Carla|9|50"), true)),
  practical("ip06", "Cambio mensual con LAG", "Devuelve mes, ingreso e ingreso_anterior. Ordena por mes.", "ingresos(mes TEXT, ingreso INTEGER)", lines("SELECT mes, ingreso,","       LAG(ingreso) OVER (ORDER BY mes) AS ingreso_anterior","FROM ingresos","ORDER BY mes;"), lines("SELECT mes, ingreso,","       LAG(ingreso) OVER (ORDER BY mes) AS ingreso_anterior","FROM ingresos","ORDER BY mes;"), test(lines("CREATE TABLE ingresos(mes TEXT, ingreso INTEGER);","INSERT INTO ingresos VALUES ('2026-01',100),('2026-02',130),('2026-03',120);"), output("2026-01|100|NULL","2026-02|130|100","2026-03|120|130")), test(lines("CREATE TABLE ingresos(mes TEXT, ingreso INTEGER);","INSERT INTO ingresos VALUES ('2026-04',50),('2026-06',90);"), output("2026-04|50|NULL","2026-06|90|50"), true)),
  practical("ip07", "Último estado por ticket", "Devuelve ticket_id, estado y fecha del registro más reciente por ticket. En empate usa el mayor id.", "historial(id, ticket_id, estado, fecha TEXT)", lines("WITH ranked AS (","  SELECT -- columnas y ROW_NUMBER","  FROM historial",")","SELECT ticket_id, estado, fecha","FROM ranked","WHERE rn = 1","ORDER BY ticket_id;"), lines("WITH ranked AS (","  SELECT id, ticket_id, estado, fecha,","         ROW_NUMBER() OVER (PARTITION BY ticket_id ORDER BY fecha DESC, id DESC) AS rn","  FROM historial",")","SELECT ticket_id, estado, fecha","FROM ranked","WHERE rn = 1","ORDER BY ticket_id;"), test(lines("CREATE TABLE historial(id INTEGER, ticket_id INTEGER, estado TEXT, fecha TEXT);","INSERT INTO historial VALUES (1,10,'ABIERTO','2026-01-01'),(2,10,'CERRADO','2026-01-03'),(3,11,'ABIERTO','2026-01-02');"), output("10|CERRADO|2026-01-03","11|ABIERTO|2026-01-02")), test(lines("CREATE TABLE historial(id INTEGER, ticket_id INTEGER, estado TEXT, fecha TEXT);","INSERT INTO historial VALUES (4,20,'A','2026-02-01'),(5,20,'B','2026-02-01'),(6,21,'C','2026-03-01');"), output("20|B|2026-02-01","21|C|2026-03-01"), true)),
  practical("ip08", "Resumen de ventas por ciudad", "Devuelve ciudad, pedidos y total_pagado para pedidos PAGADOS. Conserva ciudades con total de al menos 200.", "- clientes(id, ciudad)\\n- pedidos(id, cliente_id, total, estado)", lines("SELECT c.ciudad, COUNT(*) AS pedidos, SUM(p.total) AS total_pagado","FROM clientes c JOIN pedidos p ON --","WHERE --","GROUP BY c.ciudad","HAVING --","ORDER BY total_pagado DESC, c.ciudad;"), lines("SELECT c.ciudad, COUNT(*) AS pedidos, SUM(p.total) AS total_pagado","FROM clientes c JOIN pedidos p ON p.cliente_id = c.id","WHERE p.estado = 'PAGADO'","GROUP BY c.ciudad","HAVING SUM(p.total) >= 200","ORDER BY total_pagado DESC, c.ciudad;"), test(lines("CREATE TABLE clientes(id INTEGER, ciudad TEXT);","CREATE TABLE pedidos(id INTEGER, cliente_id INTEGER, total INTEGER, estado TEXT);","INSERT INTO clientes VALUES (1,'CDMX'),(2,'MTY'),(3,'CDMX');","INSERT INTO pedidos VALUES (1,1,150,'PAGADO'),(2,3,100,'PAGADO'),(3,2,190,'PAGADO');"), output("CDMX|2|250")), test(lines("CREATE TABLE clientes(id INTEGER, ciudad TEXT);","CREATE TABLE pedidos(id INTEGER, cliente_id INTEGER, total INTEGER, estado TEXT);","INSERT INTO clientes VALUES (1,'A'),(2,'B');","INSERT INTO pedidos VALUES (1,1,400,'PAGADO'),(2,2,220,'PAGADO'),(3,2,50,'CANCELADO');"), output("A|1|400","B|1|220"), true)),
  practical("ip09", "Clientes recurrentes", "Devuelve cliente_id, operaciones y total de clientes con al menos dos compras. Ordena por total descendente.", "compras(id, cliente_id, total)", lines("SELECT cliente_id, COUNT(*) AS operaciones, SUM(total) AS total","FROM compras","GROUP BY cliente_id","HAVING --","ORDER BY total DESC, cliente_id;"), lines("SELECT cliente_id, COUNT(*) AS operaciones, SUM(total) AS total","FROM compras","GROUP BY cliente_id","HAVING COUNT(*) >= 2","ORDER BY total DESC, cliente_id;"), test(lines("CREATE TABLE compras(id INTEGER, cliente_id INTEGER, total INTEGER);","INSERT INTO compras VALUES (1,1,50),(2,1,70),(3,2,200),(4,3,40),(5,3,30);"), output("1|2|120","3|2|70")), test(lines("CREATE TABLE compras(id INTEGER, cliente_id INTEGER, total INTEGER);","INSERT INTO compras VALUES (1,8,10),(2,8,20),(3,8,30),(4,9,100),(5,9,5);"), output("9|2|105","8|3|60"), true)),
  practical("ip10", "Productos sobre su categoría", "Devuelve producto y precio para productos con precio mayor al promedio de su propia categoría.", "productos(id, producto, categoria, precio)", lines("SELECT p.producto, p.precio","FROM productos p","WHERE p.precio > (","  SELECT -- promedio categoria"," )","ORDER BY p.producto;"), lines("SELECT p.producto, p.precio","FROM productos p","WHERE p.precio > (","  SELECT AVG(x.precio) FROM productos x WHERE x.categoria = p.categoria",")","ORDER BY p.producto;"), test(lines("CREATE TABLE productos(id INTEGER, producto TEXT, categoria TEXT, precio INTEGER);","INSERT INTO productos VALUES (1,'A','X',10),(2,'B','X',30),(3,'C','Y',20),(4,'D','Y',20);"), output("B|30")), test(lines("CREATE TABLE productos(id INTEGER, producto TEXT, categoria TEXT, precio INTEGER);","INSERT INTO productos VALUES (1,'M','A',50),(2,'N','A',70),(3,'O','B',5),(4,'P','B',15);"), output("N|70","P|15"), true)),
  practical("ip11", "Ingresos por canal", "Combina ventas_web y ventas_tienda y devuelve canal y total. No elimines operaciones duplicadas.", "- ventas_web(total)\\n- ventas_tienda(total)", lines("WITH todas AS (","  SELECT 'WEB' AS canal, total FROM ventas_web","  -- combina tienda sin deduplicar",")","SELECT canal, SUM(total) AS total","FROM todas","GROUP BY canal","ORDER BY canal;"), lines("WITH todas AS (","  SELECT 'WEB' AS canal, total FROM ventas_web","  UNION ALL","  SELECT 'TIENDA' AS canal, total FROM ventas_tienda",")","SELECT canal, SUM(total) AS total","FROM todas","GROUP BY canal","ORDER BY canal;"), test(lines("CREATE TABLE ventas_web(total INTEGER);","CREATE TABLE ventas_tienda(total INTEGER);","INSERT INTO ventas_web VALUES (100),(100);","INSERT INTO ventas_tienda VALUES (50),(80);"), output("TIENDA|130","WEB|200")), test(lines("CREATE TABLE ventas_web(total INTEGER);","CREATE TABLE ventas_tienda(total INTEGER);","INSERT INTO ventas_web VALUES (20);","INSERT INTO ventas_tienda VALUES (20),(20);"), output("TIENDA|40","WEB|20"), true)),
  practical("ip12", "Empleado y responsable", "Devuelve empleado y responsable. Conserva empleados sin responsable con el texto SIN RESPONSABLE.", "empleados(id, nombre, manager_id)", lines("SELECT e.nombre AS empleado,","       COALESCE(-- manager, 'SIN RESPONSABLE') AS responsable","FROM empleados e","LEFT JOIN empleados m ON --","ORDER BY empleado;"), lines("SELECT e.nombre AS empleado,","       COALESCE(m.nombre, 'SIN RESPONSABLE') AS responsable","FROM empleados e","LEFT JOIN empleados m ON m.id = e.manager_id","ORDER BY empleado;"), test(lines("CREATE TABLE empleados(id INTEGER, nombre TEXT, manager_id INTEGER);","INSERT INTO empleados VALUES (1,'Ana',NULL),(2,'Luis',1),(3,'Marta',1);"), output("Ana|SIN RESPONSABLE","Luis|Ana","Marta|Ana")), test(lines("CREATE TABLE empleados(id INTEGER, nombre TEXT, manager_id INTEGER);","INSERT INTO empleados VALUES (7,'Beto',NULL),(8,'Carla',7);"), output("Beto|SIN RESPONSABLE","Carla|Beto"), true)),
  practical("ip13", "Ingresos por mes", "Agrupa movimientos por mes YYYY-MM y devuelve mes, operaciones e ingreso.", "movimientos(id, fecha TEXT, monto INTEGER)", lines("SELECT strftime('%Y-%m', fecha) AS mes,","       COUNT(*) AS operaciones, SUM(monto) AS ingreso","FROM movimientos","GROUP BY strftime('%Y-%m', fecha)","ORDER BY mes;"), lines("SELECT strftime('%Y-%m', fecha) AS mes,","       COUNT(*) AS operaciones, SUM(monto) AS ingreso","FROM movimientos","GROUP BY strftime('%Y-%m', fecha)","ORDER BY mes;"), test(lines("CREATE TABLE movimientos(id INTEGER, fecha TEXT, monto INTEGER);","INSERT INTO movimientos VALUES (1,'2026-01-02',10),(2,'2026-01-20',20),(3,'2026-02-01',50);"), output("2026-01|2|30","2026-02|1|50")), test(lines("CREATE TABLE movimientos(id INTEGER, fecha TEXT, monto INTEGER);","INSERT INTO movimientos VALUES (1,'2025-12-31',40),(2,'2026-01-01',60);"), output("2025-12|1|40","2026-01|1|60"), true)),
  practical("ip14", "Segmentación por gasto", "Devuelve cliente_id, gasto y segmento: VIP si gasto >= 500, FRECUENTE si >= 200, y NUEVO en otro caso.", "compras(id, cliente_id, total)", lines("SELECT cliente_id, SUM(total) AS gasto,","       CASE -- segmentos END AS segmento","FROM compras","GROUP BY cliente_id","ORDER BY gasto DESC, cliente_id;"), lines("SELECT cliente_id, SUM(total) AS gasto,","       CASE","         WHEN SUM(total) >= 500 THEN 'VIP'","         WHEN SUM(total) >= 200 THEN 'FRECUENTE'","         ELSE 'NUEVO'","       END AS segmento","FROM compras","GROUP BY cliente_id","ORDER BY gasto DESC, cliente_id;"), test(lines("CREATE TABLE compras(id INTEGER, cliente_id INTEGER, total INTEGER);","INSERT INTO compras VALUES (1,1,300),(2,1,250),(3,2,220),(4,3,80);"), output("1|550|VIP","2|220|FRECUENTE","3|80|NUEVO")), test(lines("CREATE TABLE compras(id INTEGER, cliente_id INTEGER, total INTEGER);","INSERT INTO compras VALUES (1,4,499),(2,5,100),(3,5,100);"), output("4|499|FRECUENTE","5|200|FRECUENTE"), true)),
];

const advancedPractical = [
  practical("ap01", "Top dos productos por categoría", "Devuelve categoria, producto e ingreso para los dos productos con mayor ingreso de cada categoría. En empate ordena por producto.", "- productos(id, producto, categoria)\\n- ventas(producto_id, ingreso)", lines("WITH totales AS (...), ranked AS (...)","SELECT categoria, producto, ingreso","FROM ranked","WHERE rn <= 2","ORDER BY categoria, rn;"), lines("WITH totales AS (","  SELECT p.categoria, p.producto, SUM(v.ingreso) AS ingreso","  FROM productos p JOIN ventas v ON v.producto_id = p.id","  GROUP BY p.categoria, p.producto",") , ranked AS (","  SELECT *, ROW_NUMBER() OVER (PARTITION BY categoria ORDER BY ingreso DESC, producto ASC) AS rn","  FROM totales",")","SELECT categoria, producto, ingreso","FROM ranked","WHERE rn <= 2","ORDER BY categoria, rn;"), test(lines("CREATE TABLE productos(id INTEGER, producto TEXT, categoria TEXT);","CREATE TABLE ventas(producto_id INTEGER, ingreso INTEGER);","INSERT INTO productos VALUES (1,'A','X'),(2,'B','X'),(3,'C','X'),(4,'D','Y');","INSERT INTO ventas VALUES (1,100),(2,200),(3,150),(4,80);"), output("X|B|200","X|C|150","Y|D|80")), test(lines("CREATE TABLE productos(id INTEGER, producto TEXT, categoria TEXT);","CREATE TABLE ventas(producto_id INTEGER, ingreso INTEGER);","INSERT INTO productos VALUES (1,'M','A'),(2,'N','A'),(3,'O','A');","INSERT INTO ventas VALUES (1,50),(2,50),(3,10);"), output("A|M|50","A|N|50"), true)),
  practical("ap02", "Ruta jerárquica", "Usa WITH RECURSIVE para devolver id, nombre, nivel y ruta desde la raíz id=1.", "categorias(id, nombre, parent_id)", lines("WITH RECURSIVE arbol AS (","  -- raiz","  UNION ALL","  -- hijos",")","SELECT id, nombre, nivel, ruta","FROM arbol","ORDER BY ruta;"), lines("WITH RECURSIVE arbol(id, nombre, parent_id, nivel, ruta) AS (","  SELECT id, nombre, parent_id, 0, nombre FROM categorias WHERE id = 1","  UNION ALL","  SELECT c.id, c.nombre, c.parent_id, a.nivel + 1, a.ruta || ' > ' || c.nombre","  FROM categorias c JOIN arbol a ON c.parent_id = a.id",")","SELECT id, nombre, nivel, ruta","FROM arbol","ORDER BY ruta;"), test(lines("CREATE TABLE categorias(id INTEGER, nombre TEXT, parent_id INTEGER);","INSERT INTO categorias VALUES (1,'Raiz',NULL),(2,'A',1),(3,'B',1),(4,'A1',2);"), output("1|Raiz|0|Raiz","2|A|1|Raiz > A","4|A1|2|Raiz > A > A1","3|B|1|Raiz > B")), test(lines("CREATE TABLE categorias(id INTEGER, nombre TEXT, parent_id INTEGER);","INSERT INTO categorias VALUES (1,'Root',NULL),(2,'X',1),(3,'Y',2);"), output("1|Root|0|Root","2|X|1|Root > X","3|Y|2|Root > X > Y"), true)),
  practical("ap03", "Islas de días consecutivos", "Agrupa días consecutivos por usuario y devuelve usuario, inicio, fin y dias.", "actividad(usuario TEXT, fecha TEXT)", lines("WITH base AS (...), grupos AS (...)","SELECT usuario, MIN(fecha) AS inicio, MAX(fecha) AS fin, COUNT(*) AS dias","FROM grupos","GROUP BY usuario, grp","ORDER BY usuario, inicio;"), lines("WITH base AS (","  SELECT usuario, fecha,","         julianday(fecha) - ROW_NUMBER() OVER (PARTITION BY usuario ORDER BY fecha) AS grp","  FROM actividad",")","SELECT usuario, MIN(fecha) AS inicio, MAX(fecha) AS fin, COUNT(*) AS dias","FROM base","GROUP BY usuario, grp","ORDER BY usuario, inicio;"), test(lines("CREATE TABLE actividad(usuario TEXT, fecha TEXT);","INSERT INTO actividad VALUES ('Ana','2026-01-01'),('Ana','2026-01-02'),('Ana','2026-01-04'),('Luis','2026-01-03');"), output("Ana|2026-01-01|2026-01-02|2","Ana|2026-01-04|2026-01-04|1","Luis|2026-01-03|2026-01-03|1")), test(lines("CREATE TABLE actividad(usuario TEXT, fecha TEXT);","INSERT INTO actividad VALUES ('A','2026-02-01'),('A','2026-02-02'),('A','2026-02-03'),('A','2026-02-05');"), output("A|2026-02-01|2026-02-03|3","A|2026-02-05|2026-02-05|1"), true)),
  practical("ap04", "Promedio móvil de tres periodos", "Devuelve mes, ingreso y promedio_movil de los últimos tres registros incluido el actual, redondeado a 2 decimales.", "ingresos(mes TEXT, ingreso REAL)", lines("SELECT mes, ingreso,","       ROUND(AVG(ingreso) OVER (...), 2) AS promedio_movil","FROM ingresos","ORDER BY mes;"), lines("SELECT mes, ingreso,","       ROUND(AVG(ingreso) OVER (ORDER BY mes ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS promedio_movil","FROM ingresos","ORDER BY mes;"), test(lines("CREATE TABLE ingresos(mes TEXT, ingreso REAL);","INSERT INTO ingresos VALUES ('2026-01',10),('2026-02',20),('2026-03',30),('2026-04',50);"), output("2026-01|10.0|10.0","2026-02|20.0|15.0","2026-03|30.0|20.0","2026-04|50.0|33.33")), test(lines("CREATE TABLE ingresos(mes TEXT, ingreso REAL);","INSERT INTO ingresos VALUES ('2026-01',5),('2026-02',15),('2026-03',40);"), output("2026-01|5.0|5.0","2026-02|15.0|10.0","2026-03|40.0|20.0"), true)),
  practical("ap05", "Retención por cohorte", "Para cada cohorte devuelve usuarios y retenidos_mes_1: usuarios con actividad en el mes siguiente al alta.", "- usuarios(id, alta_mes TEXT)\\n- actividad(usuario_id, mes TEXT)", lines("SELECT u.alta_mes AS cohorte,","       COUNT(DISTINCT u.id) AS usuarios,","       COUNT(DISTINCT CASE WHEN -- mes siguiente THEN u.id END) AS retenidos_mes_1","FROM usuarios u LEFT JOIN actividad a ON --","GROUP BY u.alta_mes","ORDER BY cohorte;"), lines("SELECT u.alta_mes AS cohorte,","       COUNT(DISTINCT u.id) AS usuarios,","       COUNT(DISTINCT CASE WHEN a.mes = strftime('%Y-%m', date(u.alta_mes || '-01', '+1 month')) THEN u.id END) AS retenidos_mes_1","FROM usuarios u LEFT JOIN actividad a ON a.usuario_id = u.id","GROUP BY u.alta_mes","ORDER BY cohorte;"), test(lines("CREATE TABLE usuarios(id INTEGER, alta_mes TEXT);","CREATE TABLE actividad(usuario_id INTEGER, mes TEXT);","INSERT INTO usuarios VALUES (1,'2026-01'),(2,'2026-01'),(3,'2026-02');","INSERT INTO actividad VALUES (1,'2026-02'),(2,'2026-03'),(3,'2026-03');"), output("2026-01|2|1","2026-02|1|1")), test(lines("CREATE TABLE usuarios(id INTEGER, alta_mes TEXT);","CREATE TABLE actividad(usuario_id INTEGER, mes TEXT);","INSERT INTO usuarios VALUES (4,'2026-04'),(5,'2026-04');","INSERT INTO actividad VALUES (4,'2026-05');"), output("2026-04|2|1"), true)),
  practical("ap06", "Conversión de funnel", "Devuelve visitantes, registrados y compradores contando usuarios distintos que alcanzaron cada evento.", "eventos(usuario_id INTEGER, evento TEXT)", lines("SELECT COUNT(DISTINCT usuario_id) AS visitantes,","       COUNT(DISTINCT CASE WHEN -- registro THEN usuario_id END) AS registrados,","       COUNT(DISTINCT CASE WHEN -- compra THEN usuario_id END) AS compradores","FROM eventos;"), lines("SELECT COUNT(DISTINCT CASE WHEN evento = 'VISITA' THEN usuario_id END) AS visitantes,","       COUNT(DISTINCT CASE WHEN evento = 'REGISTRO' THEN usuario_id END) AS registrados,","       COUNT(DISTINCT CASE WHEN evento = 'COMPRA' THEN usuario_id END) AS compradores","FROM eventos;"), test(lines("CREATE TABLE eventos(usuario_id INTEGER, evento TEXT);","INSERT INTO eventos VALUES (1,'VISITA'),(1,'REGISTRO'),(1,'COMPRA'),(2,'VISITA'),(2,'REGISTRO'),(3,'VISITA');"), output("3|2|1")), test(lines("CREATE TABLE eventos(usuario_id INTEGER, evento TEXT);","INSERT INTO eventos VALUES (4,'VISITA'),(4,'VISITA'),(5,'VISITA'),(5,'COMPRA');"), output("2|0|1"), true)),
  practical("ap07", "Usuarios con todos los permisos", "Devuelve los usuarios que tienen todos los permisos requeridos.", "- usuarios(id, nombre)\\n- permisos_requeridos(permiso TEXT)\\n- usuario_permisos(usuario_id, permiso)", lines("SELECT u.id, u.nombre","FROM usuarios u","WHERE NOT EXISTS (","  SELECT 1 FROM permisos_requeridos r","  WHERE NOT EXISTS (-- permiso del usuario)",")","ORDER BY u.id;"), lines("SELECT u.id, u.nombre","FROM usuarios u","WHERE NOT EXISTS (","  SELECT 1 FROM permisos_requeridos r","  WHERE NOT EXISTS (","    SELECT 1 FROM usuario_permisos up WHERE up.usuario_id = u.id AND up.permiso = r.permiso","  )",")","ORDER BY u.id;"), test(lines("CREATE TABLE usuarios(id INTEGER, nombre TEXT);","CREATE TABLE permisos_requeridos(permiso TEXT);","CREATE TABLE usuario_permisos(usuario_id INTEGER, permiso TEXT);","INSERT INTO usuarios VALUES (1,'Ana'),(2,'Luis');","INSERT INTO permisos_requeridos VALUES ('A'),('B');","INSERT INTO usuario_permisos VALUES (1,'A'),(1,'B'),(2,'A');"), output("1|Ana")), test(lines("CREATE TABLE usuarios(id INTEGER, nombre TEXT);","CREATE TABLE permisos_requeridos(permiso TEXT);","CREATE TABLE usuario_permisos(usuario_id INTEGER, permiso TEXT);","INSERT INTO usuarios VALUES (3,'M'),(4,'N');","INSERT INTO permisos_requeridos VALUES ('X');","INSERT INTO usuario_permisos VALUES (3,'X'),(4,'X');"), output("3|M","4|N"), true)),
  practical("ap08", "Deduplicación lógica", "Devuelve email, nombre y actualizado_en del registro válido más reciente por email. En empate usa mayor id.", "contactos(id, email, nombre, actualizado_en TEXT, valido INTEGER)", lines("WITH ranked AS (","  SELECT --, ROW_NUMBER() OVER (...) rn","  FROM contactos WHERE valido = 1",")","SELECT email, nombre, actualizado_en","FROM ranked WHERE rn = 1","ORDER BY email;"), lines("WITH ranked AS (","  SELECT *, ROW_NUMBER() OVER (PARTITION BY email ORDER BY actualizado_en DESC, id DESC) AS rn","  FROM contactos WHERE valido = 1",")","SELECT email, nombre, actualizado_en","FROM ranked WHERE rn = 1","ORDER BY email;"), test(lines("CREATE TABLE contactos(id INTEGER, email TEXT, nombre TEXT, actualizado_en TEXT, valido INTEGER);","INSERT INTO contactos VALUES (1,'a@x','Ana','2026-01-01',1),(2,'a@x','Ana 2','2026-02-01',1),(3,'b@x','B','2026-03-01',0),(4,'b@x','Bea','2026-01-01',1);"), output("a@x|Ana 2|2026-02-01","b@x|Bea|2026-01-01")), test(lines("CREATE TABLE contactos(id INTEGER, email TEXT, nombre TEXT, actualizado_en TEXT, valido INTEGER);","INSERT INTO contactos VALUES (5,'c@x','C1','2026-01-01',1),(6,'c@x','C2','2026-01-01',1);"), output("c@x|C2|2026-01-01"), true)),
  practical("ap09", "Conciliación de pagos", "Devuelve factura_id, facturado, pagado y diferencia para facturas cuyo total pagado no coincide. Conserva facturas sin pagos.", "- facturas(id, total)\\n- pagos(id, factura_id, monto)", lines("WITH pagos_agg AS (...)","SELECT f.id AS factura_id, f.total AS facturado,","       COALESCE(p.pagado,0) AS pagado,","       f.total - COALESCE(p.pagado,0) AS diferencia","FROM facturas f LEFT JOIN pagos_agg p ON --","WHERE -- no coincide","ORDER BY factura_id;"), lines("WITH pagos_agg AS (","  SELECT factura_id, SUM(monto) AS pagado FROM pagos GROUP BY factura_id",")","SELECT f.id AS factura_id, f.total AS facturado,","       COALESCE(p.pagado,0) AS pagado,","       f.total - COALESCE(p.pagado,0) AS diferencia","FROM facturas f LEFT JOIN pagos_agg p ON p.factura_id = f.id","WHERE f.total <> COALESCE(p.pagado,0)","ORDER BY factura_id;"), test(lines("CREATE TABLE facturas(id INTEGER, total INTEGER);","CREATE TABLE pagos(id INTEGER, factura_id INTEGER, monto INTEGER);","INSERT INTO facturas VALUES (1,100),(2,200),(3,50);","INSERT INTO pagos VALUES (1,1,100),(2,2,80),(3,2,70);"), output("2|200|150|50","3|50|0|50")), test(lines("CREATE TABLE facturas(id INTEGER, total INTEGER);","CREATE TABLE pagos(id INTEGER, factura_id INTEGER, monto INTEGER);","INSERT INTO facturas VALUES (5,300),(6,90);","INSERT INTO pagos VALUES (1,5,310),(2,6,90);"), output("5|300|310|-10"), true)),
  practical("ap10", "Reporte de margen por categoría", "Por categoría calcula ventas, costo y margen. Incluye categorías con ventas >= 200 y ordena por margen descendente.", "- productos(id, categoria, costo)\\n- detalle(producto_id, cantidad, precio)", lines("WITH metricas AS (...)","SELECT categoria, ventas, costo, ventas - costo AS margen","FROM metricas","WHERE ventas >= 200","ORDER BY margen DESC, categoria;"), lines("WITH metricas AS (","  SELECT p.categoria,","         SUM(d.cantidad * d.precio) AS ventas,","         SUM(d.cantidad * p.costo) AS costo","  FROM productos p JOIN detalle d ON d.producto_id = p.id","  GROUP BY p.categoria",")","SELECT categoria, ventas, costo, ventas - costo AS margen","FROM metricas","WHERE ventas >= 200","ORDER BY margen DESC, categoria;"), test(lines("CREATE TABLE productos(id INTEGER, categoria TEXT, costo INTEGER);","CREATE TABLE detalle(producto_id INTEGER, cantidad INTEGER, precio INTEGER);","INSERT INTO productos VALUES (1,'A',20),(2,'B',50);","INSERT INTO detalle VALUES (1,10,40),(2,3,80);"), output("A|400|200|200","B|240|150|90")), test(lines("CREATE TABLE productos(id INTEGER, categoria TEXT, costo INTEGER);","CREATE TABLE detalle(producto_id INTEGER, cantidad INTEGER, precio INTEGER);","INSERT INTO productos VALUES (1,'X',10),(2,'Y',30);","INSERT INTO detalle VALUES (1,5,50),(2,10,40);"), output("X|250|50|200","Y|400|300|100"), true)),
  practical("ap11", "Saldo acumulado", "Devuelve cuenta_id, fecha, monto y saldo acumulado por cuenta.", "movimientos(id, cuenta_id, fecha TEXT, monto INTEGER)", lines("SELECT cuenta_id, fecha, monto,","       SUM(monto) OVER (...) AS saldo","FROM movimientos","ORDER BY cuenta_id, fecha, id;"), lines("SELECT cuenta_id, fecha, monto,","       SUM(monto) OVER (PARTITION BY cuenta_id ORDER BY fecha, id ROWS UNBOUNDED PRECEDING) AS saldo","FROM movimientos","ORDER BY cuenta_id, fecha, id;"), test(lines("CREATE TABLE movimientos(id INTEGER, cuenta_id INTEGER, fecha TEXT, monto INTEGER);","INSERT INTO movimientos VALUES (1,1,'2026-01-01',100),(2,1,'2026-01-02',-30),(3,2,'2026-01-01',50);"), output("1|2026-01-01|100|100","1|2026-01-02|-30|70","2|2026-01-01|50|50")), test(lines("CREATE TABLE movimientos(id INTEGER, cuenta_id INTEGER, fecha TEXT, monto INTEGER);","INSERT INTO movimientos VALUES (4,3,'2026-02-01',20),(5,3,'2026-02-01',5);"), output("3|2026-02-01|20|20","3|2026-02-01|5|25"), true)),
  practical("ap12", "Mediana por grupo", "Devuelve grupo y mediana para grupos con cantidad impar de valores.", "mediciones(grupo TEXT, valor INTEGER)", lines("WITH ranked AS (...)","SELECT grupo, valor AS mediana","FROM ranked","WHERE cnt % 2 = 1 AND rn = (cnt + 1) / 2","ORDER BY grupo;"), lines("WITH ranked AS (","  SELECT grupo, valor,","         ROW_NUMBER() OVER (PARTITION BY grupo ORDER BY valor) AS rn,","         COUNT(*) OVER (PARTITION BY grupo) AS cnt","  FROM mediciones",")","SELECT grupo, valor AS mediana","FROM ranked","WHERE cnt % 2 = 1 AND rn = (cnt + 1) / 2","ORDER BY grupo;"), test(lines("CREATE TABLE mediciones(grupo TEXT, valor INTEGER);","INSERT INTO mediciones VALUES ('A',1),('A',9),('A',5),('B',2),('B',4),('B',8);"), output("A|5","B|4")), test(lines("CREATE TABLE mediciones(grupo TEXT, valor INTEGER);","INSERT INTO mediciones VALUES ('X',10),('X',30),('X',20),('X',40),('X',50);"), output("X|30"), true)),
  practical("ap13", "Sesiones por inactividad", "Inicia una nueva sesión cuando pasan más de 30 minutos entre eventos. Devuelve usuario, sesion, inicio y fin.", "eventos(usuario TEXT, ts TEXT)", lines("WITH cambios AS (...), numeradas AS (...)","SELECT usuario, sesion, MIN(ts) AS inicio, MAX(ts) AS fin","FROM numeradas","GROUP BY usuario, sesion","ORDER BY usuario, sesion;"), lines("WITH cambios AS (","  SELECT usuario, ts,","    CASE WHEN LAG(ts) OVER (PARTITION BY usuario ORDER BY ts) IS NULL","      OR (julianday(ts) - julianday(LAG(ts) OVER (PARTITION BY usuario ORDER BY ts))) * 1440 > 30","    THEN 1 ELSE 0 END AS nueva","  FROM eventos",") , numeradas AS (","  SELECT usuario, ts, SUM(nueva) OVER (PARTITION BY usuario ORDER BY ts) AS sesion","  FROM cambios",")","SELECT usuario, sesion, MIN(ts) AS inicio, MAX(ts) AS fin","FROM numeradas","GROUP BY usuario, sesion","ORDER BY usuario, sesion;"), test(lines("CREATE TABLE eventos(usuario TEXT, ts TEXT);","INSERT INTO eventos VALUES ('Ana','2026-01-01 10:00'),('Ana','2026-01-01 10:20'),('Ana','2026-01-01 11:00'),('Luis','2026-01-01 09:00');"), output("Ana|1|2026-01-01 10:00|2026-01-01 10:20","Ana|2|2026-01-01 11:00|2026-01-01 11:00","Luis|1|2026-01-01 09:00|2026-01-01 09:00")), test(lines("CREATE TABLE eventos(usuario TEXT, ts TEXT);","INSERT INTO eventos VALUES ('A','2026-02-01 08:00'),('A','2026-02-01 08:31');"), output("A|1|2026-02-01 08:00|2026-02-01 08:00","A|2|2026-02-01 08:31|2026-02-01 08:31"), true)),
  practical("ap14", "Participación porcentual", "Devuelve producto, ingreso y porcentaje del total, redondeado a 2 decimales.", "ventas(producto TEXT, ingreso REAL)", lines("WITH totales AS (...)","SELECT producto, ingreso,","       ROUND(100.0 * ingreso / SUM(ingreso) OVER (), 2) AS porcentaje","FROM totales","ORDER BY ingreso DESC, producto;"), lines("WITH totales AS (","  SELECT producto, SUM(ingreso) AS ingreso FROM ventas GROUP BY producto",")","SELECT producto, ingreso,","       ROUND(100.0 * ingreso / SUM(ingreso) OVER (), 2) AS porcentaje","FROM totales","ORDER BY ingreso DESC, producto;"), test(lines("CREATE TABLE ventas(producto TEXT, ingreso REAL);","INSERT INTO ventas VALUES ('A',50),('B',30),('A',20);"), output("A|70.0|70.0","B|30.0|30.0")), test(lines("CREATE TABLE ventas(producto TEXT, ingreso REAL);","INSERT INTO ventas VALUES ('X',1),('Y',2);"), output("Y|2.0|66.67","X|1.0|33.33"), true)),
  practical("ap15", "Rachas de éxito", "Devuelve usuario y racha_maxima de eventos OK consecutivos.", "eventos(id, usuario TEXT, estado TEXT)", lines("WITH marcados AS (...), grupos AS (...), rachas AS (...)","SELECT usuario, MAX(longitud) AS racha_maxima","FROM rachas GROUP BY usuario ORDER BY usuario;"), lines("WITH marcados AS (","  SELECT id, usuario, estado,","         SUM(CASE WHEN estado <> 'OK' THEN 1 ELSE 0 END) OVER (PARTITION BY usuario ORDER BY id) AS grp","  FROM eventos",") , rachas AS (","  SELECT usuario, grp, COUNT(*) AS longitud","  FROM marcados WHERE estado = 'OK' GROUP BY usuario, grp",")","SELECT usuario, MAX(longitud) AS racha_maxima","FROM rachas GROUP BY usuario ORDER BY usuario;"), test(lines("CREATE TABLE eventos(id INTEGER, usuario TEXT, estado TEXT);","INSERT INTO eventos VALUES (1,'Ana','OK'),(2,'Ana','OK'),(3,'Ana','FAIL'),(4,'Ana','OK'),(5,'Luis','OK');"), output("Ana|2","Luis|1")), test(lines("CREATE TABLE eventos(id INTEGER, usuario TEXT, estado TEXT);","INSERT INTO eventos VALUES (1,'A','FAIL'),(2,'A','OK'),(3,'A','OK'),(4,'A','OK');"), output("A|3"), true)),
  practical("ap16", "Profundidad de organigrama", "Desde empleados raíz devuelve empleado, nivel y ruta completa.", "empleados(id, nombre, manager_id)", lines("WITH RECURSIVE org AS (...)","SELECT empleado, nivel, ruta FROM org ORDER BY ruta;"), lines("WITH RECURSIVE org(id, empleado, manager_id, nivel, ruta) AS (","  SELECT id, nombre, manager_id, 0, nombre FROM empleados WHERE manager_id IS NULL","  UNION ALL","  SELECT e.id, e.nombre, e.manager_id, o.nivel + 1, o.ruta || ' / ' || e.nombre","  FROM empleados e JOIN org o ON e.manager_id = o.id",")","SELECT empleado, nivel, ruta FROM org ORDER BY ruta;"), test(lines("CREATE TABLE empleados(id INTEGER, nombre TEXT, manager_id INTEGER);","INSERT INTO empleados VALUES (1,'CEO',NULL),(2,'CTO',1),(3,'Dev',2);"), output("CEO|0|CEO","CTO|1|CEO / CTO","Dev|2|CEO / CTO / Dev")), test(lines("CREATE TABLE empleados(id INTEGER, nombre TEXT, manager_id INTEGER);","INSERT INTO empleados VALUES (1,'A',NULL),(2,'B',1),(3,'C',1);"), output("A|0|A","B|1|A / B","C|1|A / C"), true)),
  practical("ap17", "Siguiente intervalo y traslape", "Devuelve recurso, inicio, fin y siguiente_inicio cuando el siguiente intervalo comienza antes del fin actual.", "reservas(id, recurso TEXT, inicio TEXT, fin TEXT)", lines("WITH x AS (...)","SELECT recurso, inicio, fin, siguiente_inicio","FROM x","WHERE siguiente_inicio < fin","ORDER BY recurso, inicio;"), lines("WITH x AS (","  SELECT recurso, inicio, fin,","         LEAD(inicio) OVER (PARTITION BY recurso ORDER BY inicio, id) AS siguiente_inicio","  FROM reservas",")","SELECT recurso, inicio, fin, siguiente_inicio","FROM x","WHERE siguiente_inicio < fin","ORDER BY recurso, inicio;"), test(lines("CREATE TABLE reservas(id INTEGER, recurso TEXT, inicio TEXT, fin TEXT);","INSERT INTO reservas VALUES (1,'A','10:00','11:00'),(2,'A','10:30','12:00'),(3,'B','09:00','10:00');"), output("A|10:00|11:00|10:30")), test(lines("CREATE TABLE reservas(id INTEGER, recurso TEXT, inicio TEXT, fin TEXT);","INSERT INTO reservas VALUES (1,'X','08:00','09:00'),(2,'X','09:00','10:00'),(3,'Y','07:00','09:00'),(4,'Y','08:30','09:30');"), output("Y|07:00|09:00|08:30"), true)),
  practical("ap18", "Balance de inventario", "Por producto devuelve entradas, salidas y balance; muestra balances negativos primero.", "movimientos(producto TEXT, tipo TEXT, cantidad INTEGER)", lines("SELECT producto,","       SUM(CASE WHEN tipo='ENTRADA' THEN cantidad ELSE 0 END) AS entradas,","       SUM(CASE WHEN tipo='SALIDA' THEN cantidad ELSE 0 END) AS salidas,","       -- balance","FROM movimientos GROUP BY producto","ORDER BY balance ASC, producto;"), lines("SELECT producto,","       SUM(CASE WHEN tipo='ENTRADA' THEN cantidad ELSE 0 END) AS entradas,","       SUM(CASE WHEN tipo='SALIDA' THEN cantidad ELSE 0 END) AS salidas,","       SUM(CASE WHEN tipo='ENTRADA' THEN cantidad ELSE -cantidad END) AS balance","FROM movimientos GROUP BY producto","ORDER BY balance ASC, producto;"), test(lines("CREATE TABLE movimientos(producto TEXT, tipo TEXT, cantidad INTEGER);","INSERT INTO movimientos VALUES ('A','ENTRADA',10),('A','SALIDA',12),('B','ENTRADA',5),('B','SALIDA',1);"), output("A|10|12|-2","B|5|1|4")), test(lines("CREATE TABLE movimientos(producto TEXT, tipo TEXT, cantidad INTEGER);","INSERT INTO movimientos VALUES ('X','SALIDA',3),('Y','ENTRADA',2);"), output("X|0|3|-3","Y|2|0|2"), true)),
  practical("ap19", "Pivot mensual", "Por vendedor devuelve ene, feb y mar usando agregación condicional.", "ventas(vendedor TEXT, mes TEXT, total INTEGER)", lines("SELECT vendedor,","  SUM(CASE WHEN mes='2026-01' THEN total ELSE 0 END) AS ene,","  -- feb, mar","FROM ventas GROUP BY vendedor ORDER BY vendedor;"), lines("SELECT vendedor,","  SUM(CASE WHEN mes='2026-01' THEN total ELSE 0 END) AS ene,","  SUM(CASE WHEN mes='2026-02' THEN total ELSE 0 END) AS feb,","  SUM(CASE WHEN mes='2026-03' THEN total ELSE 0 END) AS mar","FROM ventas GROUP BY vendedor ORDER BY vendedor;"), test(lines("CREATE TABLE ventas(vendedor TEXT, mes TEXT, total INTEGER);","INSERT INTO ventas VALUES ('Ana','2026-01',10),('Ana','2026-02',20),('Luis','2026-03',30);"), output("Ana|10|20|0","Luis|0|0|30")), test(lines("CREATE TABLE ventas(vendedor TEXT, mes TEXT, total INTEGER);","INSERT INTO ventas VALUES ('B','2026-01',5),('B','2026-01',7);"), output("B|12|0|0"), true)),
  practical("ap20", "Anomalías sobre promedio", "Devuelve id, categoria, valor y promedio_categoria para registros cuyo valor supera 1.5 veces el promedio de su categoría.", "mediciones(id, categoria TEXT, valor REAL)", lines("WITH x AS ("," SELECT *, AVG(valor) OVER (PARTITION BY categoria) AS promedio_categoria"," FROM mediciones",")","SELECT id, categoria, valor, ROUND(promedio_categoria,2)","FROM x WHERE valor > promedio_categoria * 1.5","ORDER BY categoria, id;"), lines("WITH x AS ("," SELECT *, AVG(valor) OVER (PARTITION BY categoria) AS promedio_categoria"," FROM mediciones",")","SELECT id, categoria, valor, ROUND(promedio_categoria,2) AS promedio_categoria","FROM x WHERE valor > promedio_categoria * 1.5","ORDER BY categoria, id;"), test(lines("CREATE TABLE mediciones(id INTEGER, categoria TEXT, valor REAL);","INSERT INTO mediciones VALUES (1,'A',10),(2,'A',10),(3,'A',40),(4,'B',5),(5,'B',6);"), output("3|A|40.0|20.0")), test(lines("CREATE TABLE mediciones(id INTEGER, categoria TEXT, valor REAL);","INSERT INTO mediciones VALUES (1,'X',2),(2,'X',2),(3,'X',20);"), output("3|X|20.0|8.0"), true)),
];

const levels = [
  {
    level: 2,
    slug: "badge-sql-intermedio",
    title: "Certificación SQL - Intermedio",
    description: "Evaluación SQL intermedia con joins, agregaciones, CTE, subconsultas y funciones de ventana.",
    difficulty: "MID",
    timeLimit: 70,
    passingScore: 80,
    conceptualQuota: 7,
    practicalQuota: 8,
    minimumPractical: 6,
    conceptual: intermediateConceptual,
    practical: intermediatePractical,
    conceptualSection: "SQL intermedio conceptual",
    practicalSection: "SQL intermedio práctico",
  },
  {
    level: 3,
    slug: "badge-sql-avanzado",
    title: "Certificación SQL - Avanzado",
    description: "Evaluación SQL avanzada con analítica, recursividad, reconciliación y diseño de consultas de producción.",
    difficulty: "SENIOR",
    timeLimit: 90,
    passingScore: 87,
    conceptualQuota: 5,
    practicalQuota: 10,
    minimumPractical: 8,
    conceptual: advancedConceptual,
    practical: advancedPractical,
    conceptualSection: "SQL avanzado conceptual",
    practicalSection: "SQL avanzado práctico",
  },
];

function buildOptions(question) {
  return question.options.map((text, index) => ({
    id: String(index),
    text,
    isCorrect: index === question.correctIndex,
  }));
}

function validateDefinitions() {
  for (const level of levels) {
    if (level.conceptual.length < level.conceptualQuota) {
      throw new Error(level.slug + ": banco conceptual insuficiente");
    }
    if (level.practical.length < level.practicalQuota) {
      throw new Error(level.slug + ": banco práctico insuficiente");
    }
    if (level.conceptualQuota + level.practicalQuota !== 15) {
      throw new Error(level.slug + ": el examen mostrado debe tener 15 preguntas");
    }
    if (level.minimumPractical > level.practicalQuota) {
      throw new Error(level.slug + ": mínimo práctico inválido");
    }
    for (const question of level.conceptual) {
      if (question.options.length !== 4 || question.correctIndex < 0 || question.correctIndex > 3) {
        throw new Error(level.slug + ": MCQ inválida " + question.id);
      }
    }
    for (const question of level.practical) {
      if (question.tests.length < 2 || !question.tests.some((item) => item.hidden)) {
        throw new Error(level.slug + ": ejercicio sin test oculto " + question.id);
      }
    }
  }
}

async function upsertLevel(tx, term, level) {
  let template = await tx.assessmentTemplate.findFirst({
    where: {
      OR: [
        { slug: level.slug },
        { badgeTermId: term.id, badgeLevel: level.level },
      ],
    },
    select: { id: true },
  });

  const templateData = {
    title: level.title,
    slug: level.slug,
    description: level.description,
    type: "MIXED",
    difficulty: level.difficulty,
    totalQuestions: 15,
    passingScore: level.passingScore,
    timeLimit: level.timeLimit,
    sections: [
      {
        name: level.conceptualSection,
        title: level.conceptualSection,
        questions: level.conceptualQuota,
        sampleSize: level.conceptualQuota,
      },
      {
        name: level.practicalSection,
        title: level.practicalSection,
        questions: level.practicalQuota,
        sampleSize: level.practicalQuota,
        minimumCorrect: level.minimumPractical,
      },
    ],
    shuffleQuestions: true,
    allowRetry: true,
    maxAttempts: 99,
    isActive: true,
    isGlobal: true,
    companyId: null,
    language: "sql",
    baseCreditCost: 0,
    isBadgeExam: true,
    badgeTermId: term.id,
    badgeLevel: level.level,
  };

  if (template) {
    await tx.assessmentTemplate.update({ where: { id: template.id }, data: templateData });
  } else {
    template = await tx.assessmentTemplate.create({
      data: templateData,
      select: { id: true },
    });
  }

  const levelTag = VERSION + "-level-" + level.level;
  await tx.assessmentQuestion.updateMany({
    where: {
      templateId: template.id,
      NOT: { tags: { has: levelTag } },
    },
    data: { isActive: false },
  });

  for (const question of level.conceptual) {
    const marker = levelTag + "-concept-" + question.id;
    const data = {
      section: level.conceptualSection,
      difficulty: level.difficulty,
      tags: ["sql", "conceptual", VERSION, levelTag, marker],
      questionText: question.title + "\\n\\n" + question.text,
      codeSnippet: null,
      options: buildOptions(question),
      allowMultiple: false,
      explanation: question.explanation,
      type: "MULTIPLE_CHOICE",
      language: null,
      allowedLanguages: null,
      starterCode: null,
      solutionCode: null,
      codingConfig: null,
      isActive: true,
    };
    const existing = await tx.assessmentQuestion.findFirst({
      where: { templateId: template.id, tags: { has: marker } },
      select: { id: true },
    });
    if (existing) {
      await tx.assessmentQuestion.update({
        where: { id: existing.id },
        data: { ...data, testCases: { deleteMany: {} } },
      });
    } else {
      await tx.assessmentQuestion.create({ data: { templateId: template.id, ...data } });
    }
  }

  for (const question of level.practical) {
    const marker = levelTag + "-practical-" + question.id;
    const data = {
      section: level.practicalSection,
      difficulty: level.difficulty,
      tags: ["sql", "práctico", VERSION, levelTag, marker],
      questionText: question.title + "\\n\\n" + question.text,
      codeSnippet: null,
      options: [],
      allowMultiple: false,
      explanation: "La consulta debe producir exactamente las columnas, filtros y orden solicitados.",
      type: "CODING",
      language: "sql",
      allowedLanguages: JSON.stringify(["sql"]),
      starterCode: question.starter,
      solutionCode: question.solution,
      codingConfig: { dialect: "sqlite", readOnly: true },
      isActive: true,
    };
    const tests = question.tests.map((item, index) => ({
      input: item.setup,
      expectedOutput: item.expected,
      isHidden: item.hidden,
      points: 1,
      timeoutMs: 5000,
      memoryLimitMb: 128,
      orderIndex: index,
    }));
    const existing = await tx.assessmentQuestion.findFirst({
      where: { templateId: template.id, tags: { has: marker } },
      select: { id: true },
    });
    if (existing) {
      await tx.assessmentQuestion.update({
        where: { id: existing.id },
        data: { ...data, testCases: { deleteMany: {}, create: tests } },
      });
    } else {
      await tx.assessmentQuestion.create({
        data: { templateId: template.id, ...data, testCases: { create: tests } },
      });
    }
  }

  return {
    id: template.id,
    slug: level.slug,
    bank: {
      conceptual: level.conceptual.length,
      practical: level.practical.length,
    },
    exam: {
      conceptual: level.conceptualQuota,
      practical: level.practicalQuota,
      minimumPractical: level.minimumPractical,
      passingScore: level.passingScore,
      timeLimit: level.timeLimit,
    },
  };
}

async function main() {
  validateDefinitions();

  if (validateOnly) {
    console.log(JSON.stringify({
      valid: true,
      levels: levels.map((level) => ({
        slug: level.slug,
        conceptualBank: level.conceptual.length,
        practicalBank: level.practical.length,
        displayedQuestions: level.conceptualQuota + level.practicalQuota,
        minimumPractical: level.minimumPractical,
      })),
    }, null, 2));
    return;
  }

  const term = await prisma.taxonomyTerm.findFirst({
    where: { kind: "SKILL", slug: "sql" },
    select: { id: true, label: true },
  });
  if (!term) throw new Error("No se encontró el skill SQL en TaxonomyTerm.");

  if (dryRun) {
    const templates = await prisma.assessmentTemplate.findMany({
      where: { badgeTermId: term.id, badgeLevel: { in: [2, 3] } },
      select: { id: true, slug: true, badgeLevel: true, _count: { select: { questions: true } } },
    });
    console.log(JSON.stringify({ mode: "dry-run", term, current: templates }, null, 2));
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const seeded = [];
    for (const level of levels) seeded.push(await upsertLevel(tx, term, level));
    return seeded;
  }, { timeout: 120000 });

  console.log(JSON.stringify({ success: true, term, seeded: result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
