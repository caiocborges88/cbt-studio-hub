import type { Activity, Stage } from "./domain.js";
export const ecosystemText =
  "Em um ecossistema, os produtores transformam energia luminosa em energia química. Os consumidores obtêm energia ao se alimentar de outros seres vivos. Os decompositores devolvem nutrientes ao ambiente. Uma cadeia alimentar representa parte das relações de alimentação: capim, gafanhoto e sapo formam um exemplo. A redução de uma população pode afetar outras populações, pois os seres vivos estão conectados.";
export function ecosystemActivities(stage: Stage): Activity[] {
  const base = {
    version: 1,
    stage,
    difficulty: "pratica" as const,
    skill: "Relações ecológicas",
    hint: "Identifique como a energia e os nutrientes se relacionam no texto.",
    explanation:
      "Os organismos participam de uma rede de relações: mudanças em uma população podem afetar outras.",
    source: {
      materialId: "material_" + stage,
      page: 1,
      quote: "os seres vivos estão conectados",
    },
  };
  return [
    {
      ...base,
      id: stage + "_choice",
      type: "choice",
      prompt: "Por que a redução de uma população pode afetar outras?",
      options: [
        "Porque os seres vivos mantêm relações de alimentação",
        "Porque todas as espécies têm a mesma função",
        "Porque os consumidores produzem luz",
      ],
      solution: 0,
    },
    {
      ...base,
      id: stage + "_blank",
      type: "blank",
      prompt: "Os ___ devolvem nutrientes ao ambiente.",
      bank: ["decompositores", "produtores", "consumidores"],
      solution: ["decompositores"],
    },
    {
      ...base,
      id: stage + "_match",
      type: "match",
      prompt: "Associe os grupos às suas funções ecológicas.",
      pairs: [
        { id: "a", left: "Produtores", right: "Transformam energia luminosa" },
        {
          id: "b",
          left: "Consumidores",
          right: "Alimentam-se de outros seres vivos",
        },
        {
          id: "c",
          left: "Decompositores",
          right: "Devolvem nutrientes ao ambiente",
        },
      ],
    },
    {
      ...base,
      id: stage + "_order",
      type: "order",
      prompt: "Organize a cadeia alimentar apresentada no texto.",
      items: [
        { id: "c", text: "Sapo" },
        { id: "a", text: "Capim" },
        { id: "b", text: "Gafanhoto" },
      ],
      solution: ["a", "b", "c"],
    },
    {
      ...base,
      id: stage + "_boolean",
      type: "boolean",
      prompt:
        "Uma mudança na população de gafanhotos pode afetar capim e sapos.",
      solution: true,
    },
    {
      ...base,
      id: stage + "_classify",
      type: "classify",
      prompt: "Separe as afirmações conforme as evidências do texto.",
      categories: ["Sustentada pelo texto", "Não sustentada pelo texto"],
      items: [
        { id: "a", text: "Os produtores transformam energia luminosa" },
        { id: "b", text: "Toda cadeia alimentar tem apenas três espécies" },
        { id: "c", text: "Decompositores devolvem nutrientes" },
      ],
      solution: {
        a: "Sustentada pelo texto",
        b: "Não sustentada pelo texto",
        c: "Sustentada pelo texto",
      },
    },
    {
      id: stage + "_numeric",
      version: 1,
      type: "numeric",
      stage,
      difficulty: "pratica",
      skill: "Porcentagens",
      prompt:
        "Uma população de 120 indivíduos diminuiu 25%. Quantos indivíduos foram perdidos?",
      hint: "Calcule um quarto de 120.",
      explanation: "120 × 0,25 = 30 indivíduos.",
      solution: 30,
      unit: "indivíduos",
      tolerance: 0,
      arithmetic: { a: 120, b: 0.25, op: "*" },
    },
    {
      ...base,
      id: stage + "_open",
      type: "open",
      prompt:
        "Explique como a redução de produtores pode afetar os consumidores, usando as relações descritas no texto.",
      rubric:
        "Relacionar a redução dos produtores à disponibilidade de alimento e energia para consumidores, justificando a conexão entre populações.",
    },
  ];
}
