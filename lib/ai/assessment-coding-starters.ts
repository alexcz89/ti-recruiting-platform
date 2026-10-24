import type { CodingLanguage } from "@/lib/code-execution/languages";

// Only new AI drafts use these deliberately failing scaffolds. Never rewrite saved questions.
// stdin languages pass the raw input to solution; candidates implement parsing and return stdout.
const starters: Record<CodingLanguage, string> = {
  javascript: `function solution(...args) {
  // TODO: implementar la lógica del ejercicio.
  throw new Error("Not implemented");
}`,
  typescript: `function solution(...args: unknown[]): unknown {
  // TODO: implementar la lógica del ejercicio.
  throw new Error("Not implemented");
}`,
  python: `import sys

def solution(input_data: str) -> str:
    # TODO: interpretar la entrada e implementar el ejercicio.
    raise NotImplementedError("TODO")

if __name__ == "__main__":
    sys.stdout.write(solution(sys.stdin.read()))`,
  java: `import java.nio.charset.StandardCharsets;

public class Main {
    static String solution(String input) {
        // TODO: implementar el ejercicio.
        throw new UnsupportedOperationException("TODO");
    }
    public static void main(String[] args) throws Exception {
        String input = new String(System.in.readAllBytes(), StandardCharsets.UTF_8);
        System.out.print(solution(input));
    }
}`,
  cpp: `#include <iostream>
#include <iterator>
#include <stdexcept>
#include <string>

std::string solution(const std::string& input) {
    // TODO: implementar el ejercicio.
    throw std::logic_error("TODO");
}
int main() {
    std::string input((std::istreambuf_iterator<char>(std::cin)), std::istreambuf_iterator<char>());
    std::cout << solution(input);
}`,
  c: `#include <stdio.h>
#include <stdlib.h>

void solution(const char *input) {
    /* TODO: interpretar la entrada y escribir el resultado en stdout. */
    exit(1);
}
int main(void) {
    char input[65536];
    size_t length = fread(input, 1, sizeof(input) - 1, stdin);
    input[length] = '\\0';
    solution(input);
    return 0;
}`,
  csharp: `using System;

class Program {
    static string Solution(string input) {
        // TODO: implementar el ejercicio.
        throw new NotImplementedException("TODO");
    }
    static void Main() {
        Console.Write(Solution(Console.In.ReadToEnd()));
    }
}`,
  go: `package main

import ("fmt"; "io/ioutil"; "os")

func solution(input string) string {
    // TODO: implementar el ejercicio.
    panic("TODO")
}
func main() {
    input, err := ioutil.ReadAll(os.Stdin)
    if err != nil { panic(err) }
    fmt.Print(solution(string(input)))
}`,
  rust: `use std::io::{self, Read};

fn solution(input: &str) -> String {
    // TODO: implementar el ejercicio.
    todo!()
}
fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    print!("{}", solution(&input));
}`,
  ruby: `def solution(input)
  # TODO: implementar el ejercicio.
  raise NotImplementedError, "TODO"
end

STDOUT.write(solution(STDIN.read))`,
  php: `<?php
function solution($input) {
    // TODO: implementar el ejercicio.
    throw new LogicException("TODO");
}
echo solution(stream_get_contents(STDIN));`,
  swift: `import Foundation

func solution(_ input: String) -> String {
    // TODO: implementar el ejercicio.
    fatalError("TODO")
}
let data = FileHandle.standardInput.readDataToEndOfFile()
let input = String(data: data, encoding: .utf8) ?? ""
print(solution(input), terminator: "")`,
  kotlin: `fun solution(input: String): String {
    // TODO: implementar el ejercicio.
    TODO("Not implemented")
}
fun main() {
    val input = System.\`in\`.bufferedReader().readText()
    print(solution(input))
}`,
  sql: `-- TODO: completar la consulta del ejercicio.
SELECT ...;`,
};

export function getAssessmentCodingStarter(language: CodingLanguage): string {
  return starters[language];
}
