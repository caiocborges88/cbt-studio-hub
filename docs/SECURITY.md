# Segurança e validação

## Fronteiras de confiança

O navegador não recebe permissão de leitura ou escrita direta em documentos Firestore. Autorização, validação de entrada, cotas, soluções, pontuações e transições executam na callable `studio`. App Check é obrigatório em produção; autenticação e verificação de participação continuam obrigatórias também no emulador.

Tokens de convite têm 256 bits, validade de sete dias e uso único; só o hash é indexado para resgate. Reemitir convite infantil revoga os anteriores e desativa sessões vinculadas. Revogar um convite aceito bloqueia o membro em todas as operações posteriores.

Recibos de operações repetidas ficam vinculados à identidade, ação, conteúdo integral da solicitação e participação no grupo. A resposta só é recuperada enquanto o acesso, papel, perfil e tipo de conta continuam válidos. Mudanças na ordem dos campos não duplicam a operação; mudanças no conteúdo exigem um novo identificador. Recibos antigos sem esse vínculo ou com mais de sete dias exigem nova solicitação.

Perfis selecionados dentro de uma conta de responsável são uma ferramenta de acompanhamento; não constituem troca de identidade. Para uso autônomo infantil, entre com convite na sessão infantil, sem manter a conta do adulto aberta.

Storage aceita uploads novos em caminhos do próprio usuário e grupo: PDFs por responsáveis e educadores ativos, e fotos de resposta por esses adultos ou estudantes com 15 anos ou mais. Perfis de até 14 anos, inclusive perfis infantis antigos sem faixa confirmada, não podem enviar arquivos. A faixa etária é independente da etapa escolar, não exige data de nascimento e só pode ser definida por responsável ou educador. A interface, o servidor e as regras de Storage aplicam essa política. Adultos podem anexar uma foto própria à resposta aberta pendente da criança pelo acompanhamento; a criança pode consultar esse anexo na própria sessão. Formatos e tamanhos são limitados; leitura direta e sobrescrita são bloqueadas. O backend verifica novamente o escopo e os limites antes de processar arquivos.

Arquivos são servidos por URL assinada de curta duração. Quem já recebeu uma URL pode usá-la até sua expiração mesmo que o acesso seja revogado nesse intervalo. Conteúdo externo é renderizado sem HTML cru; links têm protocolos filtrados pelo React Markdown e não são abertos com acesso ao contexto da página.

## Testes de ataque

A suíte de regras verifica acesso anônimo, leitura de soluções por estudantes e administradores, elevação de papel, pontuação forjada, mudança de proprietário, consultas amplas, leitura de tokens/recibos/arquivos antigos, uploads entre grupos, MIME, tamanho, sobrescrita, leitura direta e acesso revogado.

A suíte de serviço verifica convite usado/expirado/revogado, sessão de adulto versus infantil, leitura de gabaritos pelo editor, respostas de terceiros, salto de atividades, envio repetido, recuperação idempotente, isolamento, revisão de fonte e reserva concorrente de cotas. Testes com o adaptador Firestore real no emulador verificam as transações, incluindo leituras anteriores às escritas.

## Regras como protótipo revisável

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for private groups because clients cannot read or write Firestore documents directly and scoped uploads require active membership, ownership, permitted MIME types and size limits. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

As regras e as autorizações foram escritas para serem verificadas em conjunto. SDK Admin ignora regras: não retire as verificações do serviço supondo que as regras irão proteger chamadas do servidor.

## Antes de ampliar o piloto

Valide no projeto de homologação o provedor de Auth, App Check, IAM de assinatura, cotas, modelo, processamento real de PDFs escaneados e respostas abertas. Faça o piloto com estudantes dos anos iniciais e do ensino superior; testes automatizados não substituem essa observação.

Avalie retenção e exclusão de arquivos/respostas conforme a operação real. A versão não coleta idade exata nem publica nomes ou placares fora do grupo. Históricos antigos continuam privados e não são vinculados por inferência.
