import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const VERSION = "python-java-progressive-v1";
const args = new Set(process.argv.slice(2));
const validateOnly = args.has("--validate-only");
const dryRun = args.has("--dry-run");

const mcq = (id, title, text, options, correctIndex, explanation) => ({
  id, title, text, options, correctIndex, explanation,
});

const test = (input, expected, hidden = false) => ({ input, expected, hidden });

const coding = (id, title, prompt, starter, solution, tests) => ({
  id, title, prompt, starter, solution, tests,
});

const pythonMain = (body) => `import sys

def solve(data: str) -> str:
${body}

if __name__ == "__main__":
    print(solve(sys.stdin.read().strip()))`;

const pythonStarter = (hint = "    # Implementa la solucion\n    return \"\"") => pythonMain(hint);

const javaMain = (body, helpers = "", imports = "import java.util.*;") => `${imports}

public class Main {
    static String solve(String input) {
${body}
    }

${helpers}

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in).useDelimiter("\\\\A");
        String input = scanner.hasNext() ? scanner.next().trim() : "";
        System.out.println(solve(input));
    }
}`;

const javaStarter = (hint = "        // Implementa la solucion\n        return \"\";") => javaMain(hint);

const pythonIntermediateConceptual = [
  mcq("pi-c1", "Generadores", "¿Qué ventaja principal ofrece un generador frente a construir una lista completa?", ["Evalúa elementos bajo demanda", "Ordena automáticamente", "Evita excepciones", "Ejecuta en varios hilos"], 0, "Los generadores producen valores de forma perezosa y reducen el uso de memoria."),
  mcq("pi-c2", "Context managers", "¿Qué protocolo implementa un context manager usado con `with`?", ["__iter__ y __next__", "__enter__ y __exit__", "__get__ y __set__", "__call__ y __del__"], 1, "`with` invoca __enter__ al entrar y __exit__ al salir."),
  mcq("pi-c3", "Comprensiones", "¿Cuál expresión crea un diccionario con cuadrados para los números pares?", ["{x: x*x for x in xs if x % 2 == 0}", "[x*x for x in xs]", "dict(x*x for x in xs)", "{x*x if x % 2 == 0}"], 0, "Una dict comprehension usa pares clave:valor y puede incluir un filtro."),
  mcq("pi-c4", "Excepciones", "¿Cuándo se ejecuta el bloque `finally`?", ["Solo si no hubo error", "Solo si hubo error", "Siempre al abandonar el try", "Solo después de except"], 2, "`finally` se ejecuta tanto en éxito como ante una excepción, salvo terminación abrupta del proceso."),
  mcq("pi-c5", "Dataclasses", "¿Qué aporta principalmente `@dataclass`?", ["Persistencia automática", "Métodos como __init__ y __repr__ generados", "Validación de tipos en runtime", "Paralelismo"], 1, "Genera métodos repetitivos a partir de los campos declarados."),
  mcq("pi-c6", "Mutabilidad", "¿Por qué no conviene usar `items=[]` como argumento por defecto?", ["La lista se comparte entre llamadas", "La lista es inmutable", "Impide type hints", "Produce SyntaxError"], 0, "Los argumentos por defecto se evalúan una sola vez al definir la función."),
  mcq("pi-c7", "Ordenamiento", "¿Qué propiedad tiene `sorted(items, key=...)` en Python?", ["Es inestable", "Modifica siempre la lista original", "Es estable", "Solo acepta números"], 2, "El ordenamiento de Python es estable y conserva el orden relativo de empates."),
];

const pythonIntermediatePractical = [
  coding("pi-p1", "Frecuencia de palabras", "Recibe palabras separadas por espacios. Normaliza a minúsculas y devuelve `palabra:conteo`, una por línea, ordenadas alfabéticamente.", pythonStarter(), pythonMain(`    from collections import Counter
    counts = Counter(data.lower().split())
    return "\\n".join(f"{word}:{counts[word]}" for word in sorted(counts))`), [test("Ana ana LUIS ana", "ana:3\nluis:1"), test("b a b c a b", "a:2\nb:3\nc:1", true)]),
  coding("pi-p2", "Totales por categoría", "La primera línea contiene N. Las siguientes N líneas contienen `categoria monto`. Suma por categoría y devuelve `categoria:total` en orden alfabético.", pythonStarter(), pythonMain(`    lines = data.splitlines()
    totals = {}
    for line in lines[1:1 + int(lines[0])]:
        category, amount = line.rsplit(" ", 1)
        totals[category] = totals.get(category, 0) + int(amount)
    return "\\n".join(f"{key}:{totals[key]}" for key in sorted(totals))`), [test("4\nA 10\nB 5\nA 7\nC 1", "A:17\nB:5\nC:1"), test("3\nBackend 20\nData 9\nBackend 4", "Backend:24\nData:9", true)]),
  coding("pi-p3", "Intervalos combinados", "Recibe intervalos `inicio-fin` separados por comas. Combina los que se traslapan y devuelve el mismo formato ordenado.", pythonStarter(), pythonMain(`    intervals = sorted(tuple(map(int, item.split("-"))) for item in data.split(",") if item)
    merged = []
    for start, end in intervals:
        if not merged or start > merged[-1][1]:
            merged.append([start, end])
        else:
            merged[-1][1] = max(merged[-1][1], end)
    return ",".join(f"{start}-{end}" for start, end in merged)`), [test("1-3,2-6,8-10", "1-6,8-10"), test("5-7,1-2,2-4,10-12", "1-4,5-7,10-12", true)]),
  coding("pi-p4", "Top K sin duplicados", "La primera línea contiene K y la segunda enteros. Devuelve los K valores distintos más grandes en orden descendente, separados por espacios.", pythonStarter(), pythonMain(`    lines = data.splitlines()
    k = int(lines[0])
    values = sorted(set(map(int, lines[1].split())), reverse=True)
    return " ".join(map(str, values[:k]))`), [test("3\n5 1 5 9 2 9 8", "9 8 5"), test("2\n-1 -5 -1 0 3", "3 0", true)]),
  coding("pi-p5", "Paréntesis balanceados", "Recibe una cadena con `()[]{}` e imprime `SI` si está balanceada o `NO` en caso contrario.", pythonStarter(), pythonMain(`    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for char in data:
        if char in "([{":
            stack.append(char)
        elif char in pairs and (not stack or stack.pop() != pairs[char]):
            return "NO"
    return "SI" if not stack else "NO"`), [test("{[()]}", "SI"), test("([)]", "NO", true)]),
  coding("pi-p6", "Correos únicos", "Recibe correos separados por espacios. Normaliza a minúsculas, elimina duplicados y devuelve uno por línea en orden alfabético.", pythonStarter(), pythonMain(`    emails = sorted(set(value.lower() for value in data.split()))
    return "\\n".join(emails)`), [test("A@x.com b@x.com a@x.com", "a@x.com\nb@x.com"), test("Z@MAIL.COM y@mail.com z@mail.com", "y@mail.com\nz@mail.com", true)]),
  coding("pi-p7", "Promedio móvil", "Recibe enteros separados por espacios. Devuelve el promedio de cada ventana de 3 con dos decimales.", pythonStarter(), pythonMain(`    values = list(map(int, data.split()))
    return " ".join(f"{sum(values[i:i+3]) / 3:.2f}" for i in range(len(values) - 2))`), [test("1 2 3 4 5", "2.00 3.00 4.00"), test("10 10 4 7", "8.00 7.00", true)]),
  coding("pi-p8", "Inventario neto", "Cada línea contiene `producto ENTRADA|SALIDA cantidad`. Devuelve `producto:balance` por producto, ordenado alfabéticamente.", pythonStarter(), pythonMain(`    totals = {}
    for line in data.splitlines():
        product, kind, amount = line.split()
        delta = int(amount) if kind == "ENTRADA" else -int(amount)
        totals[product] = totals.get(product, 0) + delta
    return "\\n".join(f"{key}:{totals[key]}" for key in sorted(totals))`), [test("A ENTRADA 10\nA SALIDA 3\nB ENTRADA 4", "A:7\nB:4"), test("X SALIDA 2\nX ENTRADA 5\nY SALIDA 1", "X:3\nY:-1", true)]),
];

const pythonAdvancedConceptual = [
  mcq("pa-c1", "GIL", "En CPython, ¿qué limita principalmente el GIL?", ["Procesos en paralelo", "Ejecución simultánea de bytecode Python en múltiples threads", "I/O asíncrono", "Uso de memoria compartida"], 1, "El GIL permite que un solo thread ejecute bytecode Python a la vez dentro de un proceso CPython."),
  mcq("pa-c2", "Asyncio", "¿Qué ocurre cuando una coroutine ejecuta `await` sobre una operación pendiente?", ["Bloquea todo el proceso", "Cede el control al event loop", "Crea un proceso", "Convierte el resultado en generator"], 1, "`await` permite que el event loop ejecute otras tareas mientras la operación espera."),
  mcq("pa-c3", "Descriptores", "¿Qué método hace que un objeto sea un descriptor de acceso?", ["__enter__", "__get__", "__iter__", "__await__"], 1, "Los descriptores implementan __get__, __set__ o __delete__."),
  mcq("pa-c4", "MRO", "¿Qué algoritmo usa Python moderno para resolver el orden de herencia múltiple?", ["DFS simple", "C3 linearization", "BFS", "Topological random"], 1, "Python usa C3 para obtener un MRO consistente y monotónico."),
  mcq("pa-c5", "Concurrencia", "Para trabajo CPU-bound puro en CPython, ¿qué opción suele aprovechar mejor varios núcleos?", ["threading", "multiprocessing", "asyncio.sleep", "contextvars"], 1, "Procesos separados evitan la limitación del GIL para CPU-bound."),
];

const pythonAdvancedPractical = [
  coding("pa-p1", "Subcadena sin repetidos", "Devuelve la longitud de la subcadena más larga sin caracteres repetidos.", pythonStarter(), pythonMain(`    left = 0
    last = {}
    best = 0
    for right, char in enumerate(data):
        left = max(left, last.get(char, -1) + 1)
        last[char] = right
        best = max(best, right - left + 1)
    return str(best)`), [test("abcabcbb", "3"), test("pwwkew", "3", true)]),
  coding("pa-p2", "Orden topológico", "La primera línea contiene nodos separados por espacios; las siguientes líneas contienen dependencias `A B` (A antes que B). Devuelve un orden topológico lexicográficamente mínimo o `CICLO`.", pythonStarter(), pythonMain(`    import heapq
    lines = data.splitlines()
    nodes = lines[0].split()
    graph = {node: [] for node in nodes}
    indegree = {node: 0 for node in nodes}
    for line in lines[1:]:
        before, after = line.split()
        graph[before].append(after)
        indegree[after] += 1
    heap = [node for node in nodes if indegree[node] == 0]
    heapq.heapify(heap)
    order = []
    while heap:
        node = heapq.heappop(heap)
        order.append(node)
        for nxt in graph[node]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                heapq.heappush(heap, nxt)
    return " ".join(order) if len(order) == len(nodes) else "CICLO"`), [test("A B C\nA B\nB C", "A B C"), test("A B\nA B\nB A", "CICLO", true)]),
  coding("pa-p3", "Ruta mínima", "La primera línea contiene origen y destino. Las demás líneas son aristas no dirigidas `A B`. Devuelve la distancia mínima o -1.", pythonStarter(), pythonMain(`    from collections import defaultdict, deque
    lines = data.splitlines()
    start, target = lines[0].split()
    graph = defaultdict(list)
    for line in lines[1:]:
        a, b = line.split()
        graph[a].append(b); graph[b].append(a)
    queue = deque([(start, 0)])
    seen = {start}
    while queue:
        node, distance = queue.popleft()
        if node == target:
            return str(distance)
        for nxt in graph[node]:
            if nxt not in seen:
                seen.add(nxt); queue.append((nxt, distance + 1))
    return "-1"`), [test("A D\nA B\nB C\nC D\nA E", "3"), test("A Z\nA B\nC Z", "-1", true)]),
  coding("pa-p4", "Agrupar anagramas", "Recibe palabras separadas por espacios. Cada grupo se ordena alfabéticamente; los grupos se ordenan por su primera palabra y se imprimen con comas.", pythonStarter(), pythonMain(`    from collections import defaultdict
    groups = defaultdict(list)
    for word in data.split():
        groups["".join(sorted(word))].append(word)
    result = [sorted(group) for group in groups.values()]
    result.sort(key=lambda group: group[0])
    return "\\n".join(",".join(group) for group in result)`), [test("eat tea tan ate nat bat", "ate,eat,tea\nbat\nnat,tan"), test("abc bca foo oof bar", "abc,bca\nbar\nfoo,oof", true)]),
  coding("pa-p5", "Máximo por ventana", "La primera línea contiene K y la segunda enteros. Devuelve el máximo de cada ventana de tamaño K.", pythonStarter(), pythonMain(`    from collections import deque
    lines = data.splitlines(); k = int(lines[0]); values = list(map(int, lines[1].split()))
    queue = deque(); result = []
    for index, value in enumerate(values):
        while queue and queue[0] <= index - k: queue.popleft()
        while queue and values[queue[-1]] <= value: queue.pop()
        queue.append(index)
        if index >= k - 1: result.append(values[queue[0]])
    return " ".join(map(str, result))`), [test("3\n1 3 -1 -3 5 3 6 7", "3 3 5 5 6 7"), test("2\n9 1 8 2", "9 8 8", true)]),
  coding("pa-p6", "Mediana incremental", "Recibe enteros y devuelve la mediana tras insertar cada uno, con una cifra decimal.", pythonStarter(), pythonMain(`    import heapq
    low, high, result = [], [], []
    for value in map(int, data.split()):
        heapq.heappush(low, -value)
        heapq.heappush(high, -heapq.heappop(low))
        if len(high) > len(low): heapq.heappush(low, -heapq.heappop(high))
        median = float(-low[0]) if len(low) > len(high) else (-low[0] + high[0]) / 2
        result.append(f"{median:.1f}")
    return " ".join(result)`), [test("5 2 10 4", "5.0 3.5 5.0 4.5"), test("1 2 3", "1.0 1.5 2.0", true)]),
  coding("pa-p7", "Aplanar JSON", "Recibe un objeto JSON. Devuelve pares `ruta=valor` para valores escalares, ordenados por ruta. Usa puntos para objetos.", pythonStarter(), pythonMain(`    import json
    obj = json.loads(data)
    result = []
    def visit(value, path):
        if isinstance(value, dict):
            for key in sorted(value): visit(value[key], path + [key])
        else:
            result.append(".".join(path) + "=" + str(value).lower() if isinstance(value, bool) else ".".join(path) + "=" + str(value))
    visit(obj, [])
    return "\\n".join(result)`), [test('{"user":{"name":"Ana","age":30},"active":true}', "active=true\nuser.age=30\nuser.name=Ana"), test('{"a":{"b":{"c":1}},"z":0}', "a.b.c=1\nz=0", true)]),
  coding("pa-p8", "Detección de ciclo", "Recibe aristas dirigidas `A B`, una por línea. Devuelve `CICLO` si existe un ciclo o `OK`.", pythonStarter(), pythonMain(`    from collections import defaultdict
    graph = defaultdict(list); nodes = set()
    for line in data.splitlines():
        a, b = line.split(); graph[a].append(b); nodes.update((a, b))
    state = {}
    def visit(node):
        if state.get(node) == 1: return True
        if state.get(node) == 2: return False
        state[node] = 1
        if any(visit(nxt) for nxt in graph[node]): return True
        state[node] = 2
        return False
    return "CICLO" if any(visit(node) for node in nodes if not state.get(node)) else "OK"`), [test("A B\nB C\nC A", "CICLO"), test("A B\nA C\nB D", "OK", true)]),
  coding("pa-p9", "Cache LRU", "La primera línea contiene capacidad. La segunda contiene claves accedidas. Devuelve las claves finales de menor a mayor recencia.", pythonStarter(), pythonMain(`    from collections import OrderedDict
    lines = data.splitlines(); capacity = int(lines[0]); cache = OrderedDict()
    for key in lines[1].split():
        if key in cache: cache.move_to_end(key)
        else:
            cache[key] = True
            if len(cache) > capacity: cache.popitem(last=False)
    return " ".join(cache.keys())`), [test("3\nA B C A D", "C A D"), test("2\n1 2 1 3 1", "3 1", true)]),
  coding("pa-p10", "Consolidar eventos", "Cada línea contiene `usuario fecha segundos`. Devuelve `usuario:total` ordenado por total descendente y usuario ascendente.", pythonStarter(), pythonMain(`    totals = {}
    for line in data.splitlines():
        user, _, seconds = line.split()
        totals[user] = totals.get(user, 0) + int(seconds)
    ordered = sorted(totals.items(), key=lambda item: (-item[1], item[0]))
    return "\\n".join(f"{user}:{total}" for user, total in ordered)`), [test("Ana 2026-01-01 10\nLuis 2026-01-01 20\nAna 2026-01-02 15", "Ana:25\nLuis:20"), test("B 1 5\nA 1 5\nA 2 1", "A:6\nB:5", true)]),
];

const javaIntermediateConceptual = [
  mcq("ji-c1", "equals y hashCode", "Si dos objetos son iguales según `equals`, ¿qué exige el contrato de `hashCode`?", ["Hash distintos", "El mismo hash", "Hash cero", "No existe relación"], 1, "Objetos iguales deben producir el mismo hash."),
  mcq("ji-c2", "Genéricos", "¿Qué expresa `List<? extends Number>`?", ["Lista que acepta cualquier Object", "Lista de un subtipo desconocido de Number, principalmente para lectura", "Lista mutable solo de Number", "Lista de tipos primitivos"], 1, "Un wildcard extends es covariante para lectura, pero restringe inserciones."),
  mcq("ji-c3", "Streams", "¿Qué operación de Stream es terminal?", ["map", "filter", "collect", "peek"], 2, "collect consume el stream y produce un resultado."),
  mcq("ji-c4", "Optional", "¿Qué ventaja busca `Optional` como valor de retorno?", ["Serializar automáticamente", "Hacer explícita la ausencia de valor", "Evitar todos los errores", "Reemplazar colecciones"], 1, "Optional representa explícitamente que un resultado puede no existir."),
  mcq("ji-c5", "Inmutabilidad", "¿Cuál práctica favorece una clase inmutable?", ["Campos públicos", "Setters para cada campo", "Campos final y copias defensivas", "Herencia abierta obligatoria"], 2, "Los campos final y las copias defensivas evitan cambios observables."),
  mcq("ji-c6", "Excepciones", "¿Cuál excepción es checked?", ["NullPointerException", "IllegalArgumentException", "IOException", "ArithmeticException"], 2, "IOException debe capturarse o declararse."),
  mcq("ji-c7", "Colecciones", "¿Qué colección preserva orden de inserción y evita duplicados?", ["HashSet", "LinkedHashSet", "TreeSet", "PriorityQueue"], 1, "LinkedHashSet mantiene una lista enlazada con el orden de inserción."),
];

const javaIntermediatePractical = [
  coding("ji-p1", "Frecuencia de palabras", "Recibe palabras y devuelve `palabra:conteo` ordenado alfabéticamente, ignorando mayúsculas.", javaStarter(), javaMain(`        Map<String, Integer> counts = new TreeMap<>();
        for (String word : input.toLowerCase().split("\\\\s+")) counts.merge(word, 1, Integer::sum);
        StringJoiner out = new StringJoiner("\\n");
        counts.forEach((word, count) -> out.add(word + ":" + count));
        return out.toString();`), [test("Ana ana LUIS ana", "ana:3\nluis:1"), test("b a b c", "a:1\nb:2\nc:1", true)]),
  coding("ji-p2", "Totales por categoría", "Cada línea contiene `categoria monto`. Suma por categoría y devuelve `categoria:total` en orden alfabético.", javaStarter(), javaMain(`        Map<String, Integer> totals = new TreeMap<>();
        for (String line : input.split("\\\\R")) {
            String[] parts = line.trim().split("\\\\s+");
            totals.merge(parts[0], Integer.parseInt(parts[1]), Integer::sum);
        }
        StringJoiner out = new StringJoiner("\\n");
        totals.forEach((key, value) -> out.add(key + ":" + value));
        return out.toString();`), [test("A 10\nB 5\nA 7", "A:17\nB:5"), test("Backend 20\nData 9\nBackend 4", "Backend:24\nData:9", true)]),
  coding("ji-p3", "Deduplicar preservando orden", "Recibe enteros separados por espacios y elimina duplicados conservando la primera aparición.", javaStarter(), javaMain(`        Set<String> values = new LinkedHashSet<>(Arrays.asList(input.split("\\\\s+")));
        return String.join(" ", values);`), [test("3 1 3 2 1", "3 1 2"), test("5 5 5 4 3 4", "5 4 3", true)]),
  coding("ji-p4", "Paréntesis balanceados", "Recibe una cadena con `()[]{}` y devuelve `SI` o `NO`.", javaStarter(), javaMain(`        Map<Character, Character> pairs = Map.of(')', '(', ']', '[', '}', '{');
        Deque<Character> stack = new ArrayDeque<>();
        for (char c : input.toCharArray()) {
            if ("([{ ".replace(" ", "").indexOf(c) >= 0) stack.push(c);
            else if (pairs.containsKey(c) && (stack.isEmpty() || stack.pop() != pairs.get(c))) return "NO";
        }
        return stack.isEmpty() ? "SI" : "NO";`), [test("{[()]}", "SI"), test("([)]", "NO", true)]),
  coding("ji-p5", "Ordenar empleados", "Cada línea contiene `nombre salario`. Ordena por salario descendente y nombre ascendente; devuelve `nombre:salario`.", javaStarter(), javaMain(`        List<String[]> rows = new ArrayList<>();
        for (String line : input.split("\\\\R")) rows.add(line.split("\\\\s+"));
        rows.sort(Comparator.<String[]>comparingInt(row -> Integer.parseInt(row[1])).reversed().thenComparing(row -> row[0]));
        StringJoiner out = new StringJoiner("\\n");
        rows.forEach(row -> out.add(row[0] + ":" + row[1]));
        return out.toString();`), [test("Ana 10\nLuis 20\nBeto 20", "Beto:20\nLuis:20\nAna:10"), test("Zoe 5\nAda 5", "Ada:5\nZoe:5", true)]),
  coding("ji-p6", "Promedio móvil", "Recibe enteros y devuelve promedios de ventana 3 con dos decimales.", javaStarter(), javaMain(`        int[] values = Arrays.stream(input.split("\\\\s+")).mapToInt(Integer::parseInt).toArray();
        StringJoiner out = new StringJoiner(" ");
        for (int i = 0; i + 2 < values.length; i++) out.add(String.format(Locale.US, "%.2f", (values[i] + values[i+1] + values[i+2]) / 3.0));
        return out.toString();`), [test("1 2 3 4 5", "2.00 3.00 4.00"), test("10 10 4 7", "8.00 7.00", true)]),
  coding("ji-p7", "Inventario neto", "Cada línea contiene `producto ENTRADA|SALIDA cantidad`. Devuelve balances alfabéticamente.", javaStarter(), javaMain(`        Map<String, Integer> totals = new TreeMap<>();
        for (String line : input.split("\\\\R")) {
            String[] p = line.split("\\\\s+"); int amount = Integer.parseInt(p[2]);
            totals.merge(p[0], p[1].equals("ENTRADA") ? amount : -amount, Integer::sum);
        }
        StringJoiner out = new StringJoiner("\\n");
        totals.forEach((key, value) -> out.add(key + ":" + value));
        return out.toString();`), [test("A ENTRADA 10\nA SALIDA 3\nB ENTRADA 4", "A:7\nB:4"), test("X SALIDA 2\nX ENTRADA 5", "X:3", true)]),
  coding("ji-p8", "Top K sin duplicados", "La primera línea contiene K y la segunda enteros. Devuelve los K distintos más grandes.", javaStarter(), javaMain(`        String[] lines = input.split("\\\\R"); int k = Integer.parseInt(lines[0]);
        Set<Integer> values = new TreeSet<>(Comparator.reverseOrder());
        for (String value : lines[1].split("\\\\s+")) values.add(Integer.parseInt(value));
        return values.stream().limit(k).map(String::valueOf).collect(java.util.stream.Collectors.joining(" "));`), [test("3\n5 1 5 9 2 9 8", "9 8 5"), test("2\n-1 0 3 3", "3 0", true)]),
];

const javaAdvancedConceptual = [
  mcq("ja-c1", "Java Memory Model", "¿Qué garantiza `volatile` sobre un campo?", ["Atomicidad de cualquier operación compuesta", "Visibilidad y orden de lecturas/escrituras", "Inmutabilidad", "Bloqueo exclusivo"], 1, "volatile establece relaciones happens-before para visibilidad, pero no vuelve atómicas operaciones compuestas."),
  mcq("ja-c2", "CompletableFuture", "¿Qué método combina el resultado exitoso de dos futures independientes?", ["thenApply", "thenCombine", "exceptionally", "joinAll"], 1, "thenCombine recibe ambos resultados cuando los dos completan."),
  mcq("ja-c3", "Locks", "¿Qué ventaja puede ofrecer `ReentrantLock` frente a `synchronized`?", ["No usa memoria", "tryLock e interrupción al adquirir", "Elimina deadlocks", "Hace todo lock-free"], 1, "ReentrantLock ofrece APIs como tryLock, lockInterruptibly y múltiples Conditions."),
  mcq("ja-c4", "Garbage collection", "¿Qué caracteriza una referencia débil (`WeakReference`)?", ["Impide siempre recolección", "No evita que el objeto sea recolectado", "Vive en stack", "Es equivalente a final"], 1, "Una referencia débil no mantiene fuertemente alcanzable al objeto."),
  mcq("ja-c5", "ConcurrentHashMap", "¿Qué operación permite actualización atómica por clave?", ["get y luego put separados", "compute", "iterator.remove siempre", "containsValue"], 1, "compute/computeIfAbsent realizan la transformación de forma atómica para la clave."),
];

const javaAdvancedPractical = [
  coding("ja-p1", "Cache LRU", "Primera línea: capacidad. Segunda: claves. Devuelve las claves finales de menor a mayor recencia.", javaStarter(), javaMain(`        String[] lines = input.split("\\\\R"); int capacity = Integer.parseInt(lines[0]);
        LinkedHashMap<String, Boolean> cache = new LinkedHashMap<>(16, .75f, true);
        for (String key : lines[1].split("\\\\s+")) {
            cache.put(key, true);
            if (cache.size() > capacity) cache.remove(cache.keySet().iterator().next());
        }
        return String.join(" ", cache.keySet());`), [test("3\nA B C A D", "C A D"), test("2\n1 2 1 3 1", "3 1", true)]),
  coding("ja-p2", "Orden topológico", "Primera línea: nodos. Resto: aristas A B. Devuelve el orden lexicográficamente mínimo o `CICLO`.", javaStarter(), javaMain(`        String[] lines = input.split("\\\\R"); String[] nodes = lines[0].split("\\\\s+");
        Map<String,List<String>> graph = new HashMap<>(); Map<String,Integer> degree = new HashMap<>();
        for (String n : nodes) { graph.put(n, new ArrayList<>()); degree.put(n, 0); }
        for (int i=1;i<lines.length;i++){String[] p=lines[i].split("\\\\s+");graph.get(p[0]).add(p[1]);degree.merge(p[1],1,Integer::sum);}
        PriorityQueue<String> q=new PriorityQueue<>(); degree.forEach((n,d)->{if(d==0)q.add(n);}); List<String> out=new ArrayList<>();
        while(!q.isEmpty()){String n=q.poll();out.add(n);for(String x:graph.get(n)){degree.put(x,degree.get(x)-1);if(degree.get(x)==0)q.add(x);}}
        return out.size()==nodes.length?String.join(" ",out):"CICLO";`), [test("A B C\nA B\nB C", "A B C"), test("A B\nA B\nB A", "CICLO", true)]),
  coding("ja-p3", "Ruta mínima", "Primera línea: origen destino. Resto: aristas no dirigidas. Devuelve la distancia o -1.", javaStarter(), javaMain(`        String[] lines=input.split("\\\\R");String[] endpoints=lines[0].split(" ");Map<String,List<String>> g=new HashMap<>();
        for(int i=1;i<lines.length;i++){String[] p=lines[i].split(" ");g.computeIfAbsent(p[0],k->new ArrayList<>()).add(p[1]);g.computeIfAbsent(p[1],k->new ArrayList<>()).add(p[0]);}
        Queue<String> q=new ArrayDeque<>();Map<String,Integer>d=new HashMap<>();q.add(endpoints[0]);d.put(endpoints[0],0);
        while(!q.isEmpty()){String n=q.remove();if(n.equals(endpoints[1]))return String.valueOf(d.get(n));for(String x:g.getOrDefault(n,List.of()))if(!d.containsKey(x)){d.put(x,d.get(n)+1);q.add(x);}}
        return "-1";`), [test("A D\nA B\nB C\nC D", "3"), test("A Z\nA B\nC Z", "-1", true)]),
  coding("ja-p4", "Agrupar anagramas", "Agrupa palabras anagramas. Ordena palabras y grupos como en el ejemplo de salida.", javaStarter(), javaMain(`        Map<String,List<String>> groups=new HashMap<>();
        for(String word:input.split("\\\\s+")){char[] chars=word.toCharArray();Arrays.sort(chars);groups.computeIfAbsent(new String(chars),k->new ArrayList<>()).add(word);}
        List<List<String>> values=new ArrayList<>(groups.values());values.forEach(Collections::sort);values.sort(Comparator.comparing(v->v.get(0)));
        return values.stream().map(v->String.join(",",v)).collect(java.util.stream.Collectors.joining("\\n"));`), [test("eat tea tan ate nat bat", "ate,eat,tea\nbat\nnat,tan"), test("abc bca foo oof bar", "abc,bca\nbar\nfoo,oof", true)]),
  coding("ja-p5", "Máximo por ventana", "Primera línea K, segunda enteros. Devuelve el máximo de cada ventana.", javaStarter(), javaMain(`        String[] lines=input.split("\\\\R");int k=Integer.parseInt(lines[0]);int[] a=Arrays.stream(lines[1].split(" ")).mapToInt(Integer::parseInt).toArray();
        Deque<Integer> q=new ArrayDeque<>();StringJoiner out=new StringJoiner(" ");
        for(int i=0;i<a.length;i++){while(!q.isEmpty()&&q.peekFirst()<=i-k)q.removeFirst();while(!q.isEmpty()&&a[q.peekLast()]<=a[i])q.removeLast();q.addLast(i);if(i>=k-1)out.add(String.valueOf(a[q.peekFirst()]));}
        return out.toString();`), [test("3\n1 3 -1 -3 5 3 6 7", "3 3 5 5 6 7"), test("2\n9 1 8 2", "9 8 8", true)]),
  coding("ja-p6", "Combinar intervalos", "Recibe intervalos `inicio-fin` separados por comas. Combina traslapes.", javaStarter(), javaMain(`        List<int[]> values=new ArrayList<>();for(String item:input.split(",")){String[]p=item.split("-");values.add(new int[]{Integer.parseInt(p[0]),Integer.parseInt(p[1])});}
        values.sort(Comparator.comparingInt(v->v[0]));List<int[]> merged=new ArrayList<>();
        for(int[]v:values){if(merged.isEmpty()||v[0]>merged.get(merged.size()-1)[1])merged.add(v.clone());else merged.get(merged.size()-1)[1]=Math.max(merged.get(merged.size()-1)[1],v[1]);}
        return merged.stream().map(v->v[0]+"-"+v[1]).collect(java.util.stream.Collectors.joining(","));`), [test("1-3,2-6,8-10", "1-6,8-10"), test("5-7,1-2,2-4", "1-4,5-7", true)]),
  coding("ja-p7", "Mediana incremental", "Recibe enteros y devuelve la mediana tras cada inserción con una cifra decimal.", javaStarter(), javaMain(`        PriorityQueue<Integer>low=new PriorityQueue<>(Comparator.reverseOrder()),high=new PriorityQueue<>();StringJoiner out=new StringJoiner(" ");
        for(String token:input.split(" ")){int v=Integer.parseInt(token);low.add(v);high.add(low.poll());if(high.size()>low.size())low.add(high.poll());double m=low.size()>high.size()?low.peek():(low.peek()+high.peek())/2.0;out.add(String.format(Locale.US,"%.1f",m));}
        return out.toString();`), [test("5 2 10 4", "5.0 3.5 5.0 4.5"), test("1 2 3", "1.0 1.5 2.0", true)]),
  coding("ja-p8", "Detectar ciclo", "Recibe aristas dirigidas A B. Devuelve `CICLO` u `OK`.", javaStarter(), javaMain(`        Map<String,List<String>>g=new HashMap<>();Set<String>nodes=new HashSet<>();for(String line:input.split("\\\\R")){String[]p=line.split(" ");g.computeIfAbsent(p[0],k->new ArrayList<>()).add(p[1]);nodes.add(p[0]);nodes.add(p[1]);}
        Map<String,Integer>state=new HashMap<>();for(String n:nodes)if(cycle(n,g,state))return "CICLO";return "OK";`, `    static boolean cycle(String n,Map<String,List<String>>g,Map<String,Integer>s){
        if(s.getOrDefault(n,0)==1)return true;
        if(s.getOrDefault(n,0)==2)return false;
        s.put(n,1);
        for(String x:g.getOrDefault(n,List.of()))if(cycle(x,g,s))return true;
        s.put(n,2);
        return false;
    }`), [test("A B\nB C\nC A", "CICLO"), test("A B\nA C\nB D", "OK", true)]),
  coding("ja-p9", "Top K frecuentes", "Recibe K en la primera línea y palabras en la segunda. Devuelve las K más frecuentes por frecuencia descendente y palabra ascendente.", javaStarter(), javaMain(`        String[]lines=input.split("\\\\R");int k=Integer.parseInt(lines[0]);Map<String,Integer>counts=new HashMap<>();for(String w:lines[1].split(" "))counts.merge(w,1,Integer::sum);
        return counts.entrySet().stream().sorted(Comparator.<Map.Entry<String,Integer>>comparingInt(Map.Entry::getValue).reversed().thenComparing(Map.Entry::getKey)).limit(k).map(Map.Entry::getKey).collect(java.util.stream.Collectors.joining(" "));`), [test("2\na b a c b a", "a b"), test("2\nx y z x y", "x y", true)]),
  coding("ja-p10", "Consolidar eventos", "Cada línea contiene `usuario fecha segundos`. Devuelve totales por usuario ordenados por total descendente y usuario.", javaStarter(), javaMain(`        Map<String,Integer>totals=new HashMap<>();for(String line:input.split("\\\\R")){String[]p=line.split(" ");totals.merge(p[0],Integer.parseInt(p[2]),Integer::sum);}
        return totals.entrySet().stream().sorted(Comparator.<Map.Entry<String,Integer>>comparingInt(Map.Entry::getValue).reversed().thenComparing(Map.Entry::getKey)).map(e->e.getKey()+":"+e.getValue()).collect(java.util.stream.Collectors.joining("\\n"));`), [test("Ana 1 10\nLuis 1 20\nAna 2 15", "Ana:25\nLuis:20"), test("B 1 5\nA 1 5\nA 2 1", "A:6\nB:5", true)]),
];

const levels = [
  { skill: "python", level: 2, slug: "badge-python-intermedio", title: "Certificación Python - Intermedio", description: "Generadores, colecciones, excepciones, modelado y resolución práctica con Python.", difficulty: "MID", timeLimit: 70, passingScore: 80, conceptualQuota: 7, practicalQuota: 8, minimumPractical: 6, conceptual: pythonIntermediateConceptual, practical: pythonIntermediatePractical },
  { skill: "python", level: 3, slug: "badge-python-avanzado", title: "Certificación Python - Avanzado", description: "Concurrencia, arquitectura, algoritmos y resolución avanzada con Python.", difficulty: "SENIOR", timeLimit: 90, passingScore: 87, conceptualQuota: 5, practicalQuota: 10, minimumPractical: 8, conceptual: pythonAdvancedConceptual, practical: pythonAdvancedPractical },
  { skill: "java", level: 2, slug: "badge-java-intermedio", title: "Certificación Java - Intermedio", description: "Colecciones, genéricos, streams, excepciones y programación práctica con Java.", difficulty: "MID", timeLimit: 75, passingScore: 80, conceptualQuota: 7, practicalQuota: 8, minimumPractical: 6, conceptual: javaIntermediateConceptual, practical: javaIntermediatePractical },
  { skill: "java", level: 3, slug: "badge-java-avanzado", title: "Certificación Java - Avanzado", description: "Concurrencia, Java Memory Model, rendimiento y algoritmos avanzados con Java.", difficulty: "SENIOR", timeLimit: 100, passingScore: 87, conceptualQuota: 5, practicalQuota: 10, minimumPractical: 8, conceptual: javaAdvancedConceptual, practical: javaAdvancedPractical },
].map((level) => ({
  ...level,
  conceptualSection: `${level.title} conceptual`,
  practicalSection: `${level.title} práctico`,
}));

function buildOptions(question) {
  return question.options.map((text, index) => ({ id: String(index), text, isCorrect: index === question.correctIndex }));
}

function validateDefinitions() {
  const markers = new Set();
  for (const level of levels) {
    if (level.conceptual.length < level.conceptualQuota || level.practical.length < level.practicalQuota) throw new Error(`${level.slug}: banco insuficiente`);
    if (level.conceptualQuota + level.practicalQuota !== 15) throw new Error(`${level.slug}: debe mostrar 15 preguntas`);
    if (level.minimumPractical > level.practicalQuota) throw new Error(`${level.slug}: mínimo práctico inválido`);
    for (const question of [...level.conceptual, ...level.practical]) {
      const marker = `${level.slug}:${question.id}`;
      if (markers.has(marker)) throw new Error(`ID duplicado: ${marker}`);
      markers.add(marker);
    }
    for (const question of level.conceptual) {
      if (question.options.length !== 4 || question.correctIndex < 0 || question.correctIndex > 3) throw new Error(`${level.slug}: MCQ inválida ${question.id}`);
    }
    for (const question of level.practical) {
      if (question.tests.length < 2 || !question.tests.some((item) => item.hidden)) throw new Error(`${level.slug}: ejercicio sin test oculto ${question.id}`);
    }
  }
}

async function upsertLevel(tx, term, level) {
  let template = await tx.assessmentTemplate.findFirst({
    where: { OR: [{ slug: level.slug }, { badgeTermId: term.id, badgeLevel: level.level }] },
    select: { id: true },
  });
  const templateData = {
    title: level.title, slug: level.slug, description: level.description, type: "MIXED", difficulty: level.difficulty,
    totalQuestions: 15, passingScore: level.passingScore, timeLimit: level.timeLimit,
    sections: [
      { name: level.conceptualSection, title: level.conceptualSection, questions: level.conceptualQuota, sampleSize: level.conceptualQuota },
      { name: level.practicalSection, title: level.practicalSection, questions: level.practicalQuota, sampleSize: level.practicalQuota, minimumCorrect: level.minimumPractical },
    ],
    shuffleQuestions: true, allowRetry: true, maxAttempts: 99, isActive: true, isGlobal: true, companyId: null,
    language: level.skill, baseCreditCost: 0, isBadgeExam: true, badgeTermId: term.id, badgeLevel: level.level,
  };
  if (template) await tx.assessmentTemplate.update({ where: { id: template.id }, data: templateData });
  else template = await tx.assessmentTemplate.create({ data: templateData, select: { id: true } });

  const levelTag = `${VERSION}-${level.skill}-level-${level.level}`;
  await tx.assessmentQuestion.updateMany({ where: { templateId: template.id, NOT: { tags: { has: levelTag } } }, data: { isActive: false } });

  for (const question of level.conceptual) {
    const marker = `${levelTag}-concept-${question.id}`;
    const data = { section: level.conceptualSection, difficulty: level.difficulty, tags: [level.skill, "conceptual", VERSION, levelTag, marker], questionText: `${question.title}\n\n${question.text}`, codeSnippet: null, options: buildOptions(question), allowMultiple: false, explanation: question.explanation, type: "MULTIPLE_CHOICE", language: null, allowedLanguages: null, starterCode: null, solutionCode: null, codingConfig: null, isActive: true };
    const existing = await tx.assessmentQuestion.findFirst({ where: { templateId: template.id, tags: { has: marker } }, select: { id: true } });
    if (existing) await tx.assessmentQuestion.update({ where: { id: existing.id }, data: { ...data, testCases: { deleteMany: {} } } });
    else await tx.assessmentQuestion.create({ data: { templateId: template.id, ...data } });
  }

  for (const question of level.practical) {
    const marker = `${levelTag}-practical-${question.id}`;
    const data = { section: level.practicalSection, difficulty: level.difficulty, tags: [level.skill, "práctico", VERSION, levelTag, marker], questionText: `${question.title}\n\n${question.prompt}\n\nLee los datos desde la entrada estándar y escribe únicamente la salida solicitada.`, codeSnippet: null, options: [], allowMultiple: false, explanation: "La solución debe respetar el formato, los casos límite y la complejidad esperada.", type: "CODING", language: level.skill, allowedLanguages: JSON.stringify([level.skill]), starterCode: question.starter, solutionCode: question.solution, codingConfig: { stdin: true, exactOutput: true }, isActive: true };
    const tests = question.tests.map((item, index) => ({ input: item.input, expectedOutput: item.expected, isHidden: item.hidden, points: 1, timeoutMs: level.skill === "java" ? 8000 : 5000, memoryLimitMb: 256, orderIndex: index }));
    const existing = await tx.assessmentQuestion.findFirst({ where: { templateId: template.id, tags: { has: marker } }, select: { id: true } });
    if (existing) await tx.assessmentQuestion.update({ where: { id: existing.id }, data: { ...data, testCases: { deleteMany: {}, create: tests } } });
    else await tx.assessmentQuestion.create({ data: { templateId: template.id, ...data, testCases: { create: tests } } });
  }
  return { slug: level.slug, bank: { conceptual: level.conceptual.length, practical: level.practical.length }, exam: { displayed: 15, minimumPractical: level.minimumPractical, passingScore: level.passingScore, timeLimit: level.timeLimit } };
}

async function main() {
  validateDefinitions();
  if (validateOnly) {
    console.log(JSON.stringify({ valid: true, levels: levels.map((level) => ({ slug: level.slug, conceptual: level.conceptual.length, practical: level.practical.length, displayed: level.conceptualQuota + level.practicalQuota })) }, null, 2));
    return;
  }
  const terms = await prisma.taxonomyTerm.findMany({ where: { kind: "SKILL", slug: { in: ["python", "java"] } }, select: { id: true, slug: true, label: true } });
  const termBySlug = new Map(terms.map((term) => [term.slug, term]));
  if (!termBySlug.has("python") || !termBySlug.has("java")) throw new Error("No se encontraron los skills Python y Java en TaxonomyTerm.");
  if (dryRun) {
    const current = await prisma.assessmentTemplate.findMany({ where: { badgeTermId: { in: terms.map((term) => term.id) } }, select: { slug: true, badgeLevel: true, totalQuestions: true, _count: { select: { questions: true } } }, orderBy: [{ badgeTermId: "asc" }, { badgeLevel: "asc" }] });
    console.log(JSON.stringify({ mode: "dry-run", terms, current }, null, 2));
    return;
  }
  const seeded = await prisma.$transaction(async (tx) => {
    await tx.assessmentTemplate.updateMany({ where: { slug: "badge-python-basico" }, data: { totalQuestions: 15, timeLimit: 30 } });
    const output = [];
    for (const level of levels) output.push(await upsertLevel(tx, termBySlug.get(level.skill), level));
    return output;
  }, { timeout: 180000 });
  console.log(JSON.stringify({ success: true, basicUpdated: { python: { totalQuestions: 15, timeLimit: 30 } }, seeded }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
