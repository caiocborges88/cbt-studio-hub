import {
  type Activity,
  type Stage,
  arithmetic,
  validateActivity,
} from "./domain.js";
export interface MathOptions {
  count: number;
  min: number;
  max: number;
  operations: ("+" | "-" | "*" | "/")[];
  regroup: boolean;
  stage: Stage;
  difficulty: "introducao" | "pratica" | "aprofundamento";
}
export function mathActivities(
  options: MathOptions,
  id: () => string,
  random = Math.random,
): Activity[] {
  const { min, max, count, operations } = options;
  if (
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min < 0 ||
    max > 100000 ||
    max <= min ||
    max - min < 2 ||
    count < 1 ||
    count > 30 ||
    !operations.length
  )
    throw new Error(
      "Defina um intervalo com ao menos três inteiros entre 0 e 100.000, quantidade de 1 a 30 e uma operação.",
    );
  const integer = () => min + Math.floor(random() * (max - min + 1));
  const result: Activity[] = [];
  for (let n = 0; n < count; n++) {
    let a = 0,
      b = 0,
      op = operations[n % operations.length];
    let found = false;
    for (let tries = 0; tries < 2000; tries++) {
      a = integer();
      b = integer();
      if (op === "-" && b > a) [a, b] = [b, a];
      if (op === "/" && (b === 0 || a % b !== 0)) continue;
      if (!options.regroup && (op === "+" || op === "-")) {
        let x = a,
          y = b,
          valid = true;
        while (x > 0 || y > 0) {
          if (op === "+" ? (x % 10) + (y % 10) >= 10 : x % 10 < y % 10)
            valid = false;
          x = Math.floor(x / 10);
          y = Math.floor(y / 10);
        }
        if (!valid) continue;
      }
      found = true;
      break;
    }
    if (!found)
      throw new Error(
        "Não foi possível montar operações neste intervalo. Amplie o intervalo ou permita reagrupamento.",
      );
    const solution = arithmetic(a, b, op);
    const sign = op === "*" ? "×" : op === "/" ? "÷" : op;
    result.push(
      validateActivity({
        id: id(),
        version: 1,
        type: "numeric",
        prompt: "Quanto é " + a + " " + sign + " " + b + "?",
        skill: {
          "+": "Adição",
          "-": "Subtração",
          "*": "Multiplicação",
          "/": "Divisão exata",
        }[op],
        stage: options.stage,
        difficulty: options.difficulty,
        hint:
          op === "/"
            ? "Procure o número que, multiplicado pelo divisor, forma o dividendo."
            : "Você pode decompor os números e resolver uma parte de cada vez.",
        explanation: a + " " + sign + " " + b + " = " + solution + ".",
        solution,
        unit: "",
        tolerance: 0,
        arithmetic: { a, b, op },
      }),
    );
  }
  return result;
}
