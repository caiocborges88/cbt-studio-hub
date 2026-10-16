# CBT Studio Hub

Plataforma de aprendizagem em português brasileiro para estudantes a partir de 7 anos, do fundamental à graduação, sem limite máximo de idade.

## Experimentar localmente

Requisitos: Node.js 22 e npm. Java 21 é necessário apenas para os emuladores.

```sh
npm ci
npm run dev
```

Sem configuração de Firebase, a interface abre uma **demonstração local identificada**, com exemplos e histórico salvos neste navegador. Ela permite experimentar atividades, editor, perfis, progressão, correção manual e desafios no mesmo navegador. Não faz chamadas de IA, não importa PDFs e não conecta dispositivos diferentes.

A configuração de um projeto Firebase ativa o serviço real; erros de conexão nunca são convertidos silenciosamente em dados de demonstração.

## Recursos

- Apresentações lúdica, discreta e acadêmica, com progresso independente da aparência.
- Múltipla escolha, verdadeiro/falso, lacunas, associação, ordenação, classificação, respostas numéricas e abertas por texto/foto.
- Interações por mouse, toque e teclado; leitura em voz alta quando disponível no navegador.
- Leitura por páginas/capítulos, Markdown e LaTeX; importação de PDFs textuais e escaneados no servidor.
- Revisão humana da extração e das atividades antes de publicar.
- Aritmética conferida por código; parâmetros de operações, intervalo e reagrupamento; unidade e tolerância absoluta em respostas numéricas.
- Grupos privados, convites de uso único e revogação de acesso; perfis infantis sem e-mail.
- Histórico completo de tentativas, acertos independentes, dicas e novas tentativas.
- Competições por prazo e salas ao vivo com avanço pelo organizador; empates preservados e placar liberado no encerramento.
- Correção sugerida pela IA para respostas abertas, com confirmação humana.

## Configurar e validar

Consulte [implantação](docs/DEPLOYMENT.md), [arquitetura](docs/ARCHITECTURE.md), [segurança](docs/SECURITY.md) e [migração](docs/MIGRATION.md).

```sh
npm run check
npm run test:rules
npx playwright install chromium
npm run test:e2e
```

O servidor e o frontend compartilham contratos e validações em `shared/`. As regras de negócio executam em Functions; o navegador nunca grava pontuações nem lê documentos contendo gabaritos.

A versão anterior foi preservada em `legacy/` para referência e rollback. Esses arquivos não são publicados pelo novo Hosting, cujo diretório público é `dist/`.

## Limites desta entrega

A leitura automática e a geração dependem da configuração do Firebase, segredo Gemini e cotas. O piloto com estudantes reais e a validação do modelo com materiais reais devem acontecer no ambiente de homologação antes de publicar. O sistema não inclui correção simbólica universal, pagamentos, chat ou rankings públicos.
