import { ecosystemActivities, ecosystemText } from "./ecosystem.js";
import {
  type Activity,
  type Material,
  type Stage,
  validateActivity,
} from "./domain.js";
export const readingText =
  "Na horta da escola, Lia encontrou a terra seca. Primeiro, pegou um regador. Depois, regou as mudas com cuidado. Ao observar as folhas verdes, sorriu e decidiu voltar no dia seguinte. As raízes absorvem água e sais minerais do solo. O caule sustenta a planta e transporta substâncias. As folhas participam da fotossíntese. A luz do Sol é importante nesse processo.";
const academicText =
  "Em um estudo experimental, a hipótese é uma explicação provisória que pode ser testada. O grupo de controle oferece uma referência para comparar o efeito da intervenção. A variável independente é manipulada pelo pesquisador, enquanto a variável dependente é medida. Correlação não implica causalidade: variáveis de confusão podem explicar uma associação. A conclusão deve considerar o tamanho da amostra e as limitações do método.";
export function exampleMaterial(stage: Stage): Material {
  if (stage === "fundamental-final")
    return {
      id: "material_" + stage,
      title: "Ecossistemas e relações alimentares",
      pages: [
        {
          number: 1,
          chapter: "Relações ecológicas",
          text: ecosystemText,
          needsReview: false,
        },
      ],
      reviewed: true,
      createdAt: 1,
    };
  if (stage === "medio")
    return {
      id: "material_" + stage,
      title: "Hipóteses, experimentos e evidências",
      pages: [
        {
          number: 1,
          chapter: "Investigação científica",
          text: academicText,
          needsReview: false,
        },
      ],
      reviewed: true,
      createdAt: 1,
    };
  return {
    id: "material_" + stage,
    title:
      stage === "superior"
        ? "Introdução à pesquisa científica"
        : "Leitura · Uma descoberta na horta",
    pages: [
      {
        number: 1,
        chapter:
          stage === "superior"
            ? "Método científico"
            : "Uma descoberta na horta",
        text: stage === "superior" ? academicText : readingText,
        needsReview: false,
      },
    ],
    reviewed: true,
    createdAt: 1,
  };
}
export function examples(stage: Stage): Activity[] {
  if (stage === "fundamental-final")
    return ecosystemActivities(stage).map(validateActivity);
  const academic = stage === "superior" || stage === "medio";
  const material = exampleMaterial(stage);
  const base = {
    version: 1,
    stage,
    difficulty: "pratica",
    hint: academic
      ? "Retorne às definições do texto e compare o papel de cada elemento."
      : "Volte ao texto e procure as pistas.",
    explanation: academic
      ? "A conclusão deve ser sustentada pelo método e pelas evidências."
      : "Observe a ordem dos acontecimentos e as informações do texto.",
    skill: academic ? "Método científico" : "Compreensão de texto",
    source: {
      materialId: material.id,
      page: 1,
      quote: academic
        ? "Correlação não implica causalidade"
        : "Lia encontrou a terra seca",
    },
  };
  return [
    {
      ...base,
      id: stage + "_choice",
      type: "choice",
      prompt: academic
        ? "Qual é o papel do grupo de controle?"
        : "Por que Lia decidiu regar as mudas?",
      options: academic
        ? [
            "Oferecer uma referência de comparação",
            "Garantir que a hipótese seja verdadeira",
            "Eliminar toda limitação do estudo",
          ]
        : [
            "Porque a terra estava seca",
            "Porque estava chovendo",
            "Porque queria colher as folhas",
          ],
      solution: 0,
      explanation: academic
        ? "O controle permite comparar os resultados com os da intervenção."
        : "O texto diz que Lia encontrou a terra seca. Essa é a pista para sua decisão.",
    },
    {
      ...base,
      id: stage + "_blank",
      type: "blank",
      prompt: academic
        ? "A variável ___ é medida pelo pesquisador."
        : "As ___ absorvem água e sais minerais do solo.",
      bank: academic
        ? ["dependente", "independente", "constante"]
        : ["raízes", "folhas", "flores"],
      solution: [academic ? "dependente" : "raízes"],
    },
    {
      ...base,
      id: stage + "_match",
      type: "match",
      prompt: academic
        ? "Associe os conceitos às suas funções."
        : "Associe cada parte da planta à sua função.",
      pairs: academic
        ? [
            {
              id: "a",
              left: "Hipótese",
              right: "Explicação provisória testável",
            },
            { id: "b", left: "Controle", right: "Referência para comparação" },
            { id: "c", left: "Variável dependente", right: "Resultado medido" },
          ]
        : [
            { id: "a", left: "Raiz", right: "Absorve água do solo" },
            { id: "b", left: "Caule", right: "Sustenta e transporta" },
            { id: "c", left: "Folha", right: "Participa da fotossíntese" },
          ],
    },
    {
      ...base,
      id: stage + "_order",
      type: "order",
      prompt: academic
        ? "Organize uma sequência coerente para testar uma hipótese."
        : "Organize os acontecimentos da história.",
      items: academic
        ? [
            { id: "c", text: "Analisar os resultados" },
            { id: "a", text: "Formular uma hipótese" },
            { id: "b", text: "Realizar um experimento" },
          ]
        : [
            { id: "c", text: "Regar as mudas" },
            { id: "a", text: "Encontrar a terra seca" },
            { id: "b", text: "Pegar o regador" },
          ],
      solution: ["a", "b", "c"],
    },
    {
      ...base,
      id: stage + "_boolean",
      type: "boolean",
      prompt: academic
        ? "Uma correlação é suficiente para demonstrar causalidade."
        : "Lia decidiu voltar à horta no dia seguinte.",
      solution: !academic,
      explanation: academic
        ? "A associação pode ser explicada por variáveis de confusão; o texto alerta para esse limite."
        : "O último acontecimento da história é a decisão de voltar no dia seguinte.",
    },
    {
      ...base,
      id: stage + "_classify",
      type: "classify",
      prompt: academic
        ? "Separe as afirmações conforme sua relação com o texto."
        : "Separe as frases sobre a história.",
      categories: ["Sustentada pelo texto", "Não sustentada pelo texto"],
      items: academic
        ? [
            { id: "a", text: "A hipótese pode ser testada" },
            { id: "b", text: "A amostra não afeta a conclusão" },
            { id: "c", text: "Limitações precisam ser consideradas" },
          ]
        : [
            { id: "a", text: "A terra estava seca" },
            { id: "b", text: "Lia colheu tomates" },
            { id: "c", text: "Lia pegou um regador" },
          ],
      solution: {
        a: "Sustentada pelo texto",
        b: "Não sustentada pelo texto",
        c: "Sustentada pelo texto",
      },
    },
    {
      version: 1,
      id: stage + "_numeric",
      type: "numeric",
      stage,
      difficulty: "pratica",
      skill: academic ? "Porcentagens" : "Adição",
      prompt: academic
        ? "Em uma amostra de 200 pessoas, 25% participaram de uma intervenção. Quantas pessoas participaram?"
        : "Lia regou 12 mudas pela manhã e 8 à tarde. Quantas mudas ela regou ao todo?",
      hint: academic
        ? "25% corresponde a um quarto do total."
        : "Some as duas quantidades.",
      explanation: academic ? "200 × 0,25 = 50 pessoas." : "12 + 8 = 20 mudas.",
      solution: academic ? 50 : 20,
      unit: academic ? "pessoas" : "mudas",
      tolerance: 0,
      arithmetic: academic
        ? { a: 200, b: 0.25, op: "*" }
        : { a: 12, b: 8, op: "+" },
    },
    {
      ...base,
      id: stage + "_open",
      type: "open",
      prompt: academic
        ? "Explique por que uma conclusão experimental deve mencionar as limitações do método."
        : "Que pistas mostram que Lia se importou com as plantas? Explique com suas palavras.",
      rubric: academic
        ? "Relacionar limitações à validade da conclusão, reconhecendo o papel da amostra e de possíveis variáveis de confusão."
        : "Citar que ela regou com cuidado e decidiu voltar. Aceitar outras respostas justificadas pelo texto.",
    },
  ].map(validateActivity);
}
export function demoSeed(uid = "demo-adult"): Record<string, unknown> {
  const root = "groups/demo-group/";
  const result: Record<string, unknown> = {
    "groups/demo-group": {
      id: "demo-group",
      title: "Meu espaço de aprendizagem",
      ownerUid: uid,
      createdAt: Date.now(),
    },
    ["users/" + uid + "/groups/demo-group"]: { id: "demo-group" },
    [root + "members/" + uid]: {
      id: uid,
      role: "admin",
      profileId: "demo-profile",
      active: true,
      provider: "adult",
    },
    [root + "profiles/demo-profile"]: {
      id: "demo-profile",
      nickname: "Explorador",
      avatar: "🌿",
      stage: "fundamental-inicial",
      theme: "playful",
      subject: "",
      child: false,
      ownerUid: uid,
    },
    [root + "profiles/demo-child"]: {
      id: "demo-child",
      nickname: "Lia",
      avatar: "🦊",
      stage: "fundamental-inicial",
      theme: "playful",
      subject: "",
      child: true,
      guardianUid: uid,
    },
  };
  for (const stage of [
    "fundamental-inicial",
    "fundamental-final",
    "medio",
    "superior",
  ] as Stage[]) {
    const material = exampleMaterial(stage);
    const activities = examples(stage);
    result[root + "materials/" + material.id] = material;
    for (const activity of activities)
      result[root + "activities/" + activity.id] = activity;
    result[root + "lessons/lesson_" + stage] = {
      id: "lesson_" + stage,
      title:
        stage === "superior"
          ? "Como construímos conhecimento?"
          : stage === "medio"
            ? "Leitura, evidências e descobertas"
            : stage === "fundamental-final"
              ? "Investigue as pistas do texto"
              : "Uma descoberta na horta",
      subject:
        stage === "superior" ? "Pesquisa científica" : "Leitura e ciências",
      stage,
      activityIds: activities.map((a) => a.id),
      published: true,
      materialId: material.id,
      createdAt: Date.now(),
      createdBy: uid,
    };
  }
  const initial = examples("fundamental-inicial");
  result[root + "lessons/demo-math"] = {
    id: "demo-math",
    title: "Matemática em cada descoberta",
    subject: "Matemática",
    stage: "fundamental-inicial",
    activityIds: [initial[6].id],
    published: true,
    createdAt: Date.now(),
    createdBy: uid,
  };
  result[root + "lessons/demo-laboratory"] = {
    id: "demo-laboratory",
    title: "Laboratório das ideias",
    subject: "Associações e leitura",
    stage: "fundamental-inicial",
    activityIds: [initial[1].id, initial[2].id, initial[5].id],
    published: true,
    materialId: "material_fundamental-inicial",
    createdAt: Date.now(),
    createdBy: uid,
  };
  return result;
}
