# Arquitetura

## Contratos e fluxo

React + TypeScript + Vite no navegador. Firebase Authentication identifica adultos por Google/e-mail e crianças por autenticação anônima vinculada a convite. Todas as operações de domínio passam pela callable `studio`, protegida por App Check em produção. O backend identifica o tipo de sessão pelo token; nunca pelo papel informado pelo cliente.

A apresentação é preferência individual. Etapa, disciplina, objetivos e complexidade orientam a geração; idade não bloqueia conteúdos.

```text
Material → extração por página → revisão → geração → editor/prévia → publicação
                                                                  ↓
                                       sessão → resposta → correção no servidor
                                                                  ↓
                                             histórico por perfil e habilidade
```

## Documentos

- `groups/{groupId}`: título, proprietário e criação.
- `members/{uid}`: papel, perfil, origem da sessão e acesso ativo.
- `profiles/{id}`: apelido, avatar, etapa, apresentação, responsável e vínculo de conta.
- `materials/{id}`: páginas ordenadas, capítulos, texto, pendências e confirmação da revisão.
- `lessons/{id}`: título, disciplina, etapa e identificadores de atividades.
- `activities/{versionId}`: contrato validado, solução, dica, explicação, habilidade e fonte.
- `sessions/{id}`: perfil, proprietário, modo, versão das atividades e posição; `sessions/{id}/attempts/{id}` guarda cada tentativa separadamente, sem fazer um documento crescer a cada repetição.
- `challenges/{id}`: modo, prazo, situação, posição ao vivo e cópia dos identificadores de atividades.
- `jobs/{id}`: entrada, situação, progresso, tentativas, concessão temporária e resultado.
- `jobs/{id}/pages/{n}`: checkpoints da extração; `private/generation`: resultado validado.
- `invites/{id}`: papel permitido, perfil, expiração, aceite e revogação; o token completo só é retornado na criação.
- `usage/{diaUTC}`: reserva transacional de chamadas e páginas escaneadas.
- `users/{uid}/groups/{id}`: índice privado de participação.
- `inviteTokens/{hash}`: resolução de tokens; `receipts/{hash}`: respostas idempotentes por identidade e operação.

Coleções sob um grupo são subcoleções de `groups/{groupId}`. As coleções antigas permanecem intactas.

## Atividades e avaliação

O contrato discriminado por tipo é validado com Zod e verificações de consistência. O cliente recebe somente os campos necessários para responder. Associações usam chaves de destino opacas, sem relação com a posição ou identificador do par correto.

Lacunas aceitam uma lacuna por atividade e múltiplas respostas textuais equivalentes definidas pelo autor. A comparação normaliza maiúsculas e espaços, preservando acentos. Números aceitam vírgula, ponto e notação científica; unidade aparece separada e a tolerância é absoluta. Frações digitadas e provas simbólicas devem usar resposta aberta.

Uma tentativa registra acerto, dica, número de tentativas e avaliação pendente/confirmada. A pontuação pessoal considera o melhor resultado por atividade na sessão; tentativas repetidas não acumulam pontos adicionais.

## Versões, retomada e competição

Editar uma atividade gera novo identificador de versão. Sessões e desafios conservam os identificadores originais. Salvar rascunho de uma trilha publicada cria uma cópia, mantendo a publicação anterior disponível.

O progresso é registrado no servidor a cada resposta e avanço. Reabrir uma sessão retoma a posição registrada; abrir novamente o mesmo desafio recupera a participação existente.

O organizador controla a sala ao vivo. Participantes entram antes do início; reconexão de participantes já inscritos é permitida. Cada rodada admite uma resposta por perfil. Desafios por prazo avançam após cada envio. Pontos, gabaritos e explicações ficam ocultos até o encerramento, inclusive após expiração do prazo. Respostas abertas podem manter pontos pendentes até confirmação humana.

Salas e jobs são atualizados por consulta periódica (3 segundos na sala; 5 segundos no painel), sem SDK de escrita direta no Firestore. Essa primeira versão é voltada a grupos pequenos; consultar o custo das leituras e adicionar paginação/agregação antes de operar turmas com históricos muito grandes.

## Processamento e limites

PDFs: até 15 MB e 100 páginas por arquivo, com limites administrativos que podem reduzir esses valores. A geração usa até 20 páginas e 100 mil caracteres por solicitação. Materiais maiores devem ser separados em volumes. Arquivos protegidos, ilegíveis ou excessivos recebem mensagem acionável.

Cada execução processa até oito páginas novas e continua por novo evento, reutilizando checkpoints. Páginas com pouco texto passam pela visão do Gemini. Fórmulas potencialmente incertas recebem pendência para revisão. Falhas podem ser retomadas até três tentativas; execuções interrompidas ficam disponíveis para retomada após a concessão temporária expirar.

Os checkpoints e recibos evitam duplicações de resultados. Não se promete cobrança exatamente uma vez pelo provedor: uma requisição interrompida depois do processamento externo pode voltar a ser cobrada.
