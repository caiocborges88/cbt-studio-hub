# Homologação e implantação

O projeto original usa Firestore Standard no banco `(default)`. Mantenha a mesma edição; não reprovisione o banco para instalar esta versão. Este guia permite implantação em etapas e não confirma, por si só, quais etapas já foram executadas em um projeto.

## 1. Ambiente de homologação

Use um projeto Firebase separado, com Firestore Standard, Authentication (Google, e-mail/senha e anônimo), Storage e Functions habilitados. Configure domínio autorizado no Authentication e App Check com reCAPTCHA Enterprise. Para Functions e Storage, confira o plano de cobrança exigido no projeto.

Não crie contas infantis por e-mail; a entrada por convite usa Firebase Anonymous Auth. Um convite infantil vincula um perfil já criado por seu responsável ou educador.

Copie `.env.example` para `.env.local` e preencha a configuração pública do aplicativo Web de homologação. Defina `VITE_APPCHECK_SITE_KEY`; a ausência dela em produção não desativa a exigência de App Check no servidor.

## 2. IA central e cotas

O backend pode ser implantado em duas etapas. Antes de cadastrar a chave Gemini, configure `AI_DAILY_LIMIT=0` e `OCR_DAILY_PAGE_LIMIT=0` no arquivo de ambiente do projeto e implante apenas a API e o Storage:

```sh
npx -y firebase-tools@latest deploy --only functions:learning:studio,storage --project SEU_PROJETO_HOMOLOGACAO
```

O segredo `GEMINI_API_KEY` fica vinculado somente ao worker `learningJob`. Depois de cadastrar o segredo, implante esse worker com `--only functions:learning:learningJob`. Implantar a API isoladamente não ativa a geração por IA. Uma prévia do Hosting compartilha o backend do projeto: no projeto existente, preserve as regras e os provedores anteriores até preparar a migração e a troca coordenada.

Configure o segredo no projeto correto:

```sh
npx firebase functions:secrets:set GEMINI_API_KEY --project SEU_PROJETO_HOMOLOGACAO
```

Copie `functions/.env.example` para `functions/.env.SEU_PROJETO_HOMOLOGACAO`. Escolha cotas positivas para `AI_DAILY_LIMIT` (solicitações por grupo/dia UTC) e `OCR_DAILY_PAGE_LIMIT` (páginas escaneadas por grupo/dia UTC). Zero bloqueia o processamento pago. Por exemplo, um piloto pode começar com 10 solicitações e 50 páginas escaneadas diárias por grupo.

`GEMINI_MODEL` é configurável no servidor; o padrão é `gemini-3.8-flash`, listado como estável na documentação oficial consultada em 15/10/2026. Confirme disponibilidade para o projeto antes de ativar. Nunca coloque a chave Gemini em variáveis `VITE_*`.

As cotas são limites operacionais, não teto monetário global. Configure alertas de orçamento e acompanhe solicitações, páginas, leituras e arquivos. Pessoas que criam múltiplos grupos obtêm cotas por grupo; para operação comercial, acrescente aprovação de novos grupos ou cotas globais por conta.

## 3. Validar e publicar a prévia

```sh
npm ci
npm run check
npm run test:rules
npx playwright install chromium
npm run test:e2e
npx firebase deploy --only functions,firestore:rules,firestore:indexes,storage --project SEU_PROJETO_HOMOLOGACAO
npx firebase hosting:channel:deploy revisao-v2 --expires 7d --project SEU_PROJETO_HOMOLOGACAO
```

O build publica somente `dist/`. Os arquivos `legacy/`, scripts, testes e configurações não são arquivos públicos do Hosting.

O serviço de Functions precisa de permissão para assinar URLs de leitura de arquivos (IAM Service Account Token Creator para assinatura pelo próprio service account, com escopo mínimo adequado). URLs expiram em cinco minutos; o backend verifica a participação antes de emiti-las. Não use tokens públicos permanentes de download.

Confirme a execução de `learningJob` após criar uma tarefa, e confira erros e consumo no console Firebase. O conteúdo de respostas, segredos e PDFs não deve ser inserido em logs.

## 4. Emuladores

```sh
npm run emulators
```

Portas isoladas desta configuração: Auth 9190, Functions 5101, Firestore 8180, Storage 9199 e UI 4102. Crie um `.env.local` com projeto `demo-cbt-studio`, chave/appId fictícios e `VITE_USE_EMULATORS=true` para abrir a interface conectada aos emuladores. A interface sem projeto configurado continua sendo a demonstração local, que é outro modo.

Para testar o worker com uma chave de teste autorizada, configure `functions/.secret.local` conforme as instruções do emulador. Não salve esse arquivo no Git. Downloads por URL assinada precisam de credencial de assinatura; os emuladores de regras não substituem a validação desse recurso em homologação.

## 5. Produção e rollback

Antes da troca, faça backup do Firestore, execute a migração primeiro sem `--apply`, revise os rascunhos importados e valide o piloto. Só então aplique regras e Hosting da versão nova no projeto de produção.

As novas regras tornam as coleções antigas inacessíveis pelo navegador. Portanto, não implante as regras novas isoladamente sobre a interface antiga. A troca deve incluir Functions, regras e frontend compatíveis.

Rollback: restaure o release anterior do Hosting e as regras anteriores guardadas no backup de implantação. Os originais e os históricos não são apagados pelo script. A pasta `legacy/` é referência do frontend anterior; não contém um backup das regras que estavam configuradas no console.
