# Migração preservando os originais

O migrador usa Firebase Admin com credencial de aplicação autorizada (ADC) e exige projeto, grupo de destino e UID do proprietário. Nunca execute usando credenciais no repositório.

1. Crie o grupo privado na versão nova e obtenha seu ID e UID do proprietário no console.
2. Faça backup do banco e das regras atuais.
3. Execute a simulação, que apenas lê:

```sh
npm run migrate:legacy -- --project SEU_PROJETO --group GRUPO --owner UID --stage fundamental-inicial
```

4. Confira as contagens e então execute com `--apply`:

```sh
npm run migrate:legacy -- --project SEU_PROJETO --group GRUPO --owner UID --stage fundamental-inicial --apply
```

O script não modifica nem apaga `cbt_provas` ou `cbt_rankings`. Copia provas para rascunhos, guarda o documento original em `migrationSources` e copia rankings para `legacyRankings`, ambos privados e acessíveis administrativamente. Nenhum nome/idade é associado automaticamente a novos perfis.

Os materiais importados precisam de revisão: o campo de texto é limitado a 40 mil caracteres na página inicial do rascunho. O documento original completo fica preservado. Para textos maiores ou PDFs que antes eram apenas links, importe novamente o arquivo ou separe o texto em páginas.

As questões antigas recebem fonte em branco, para que o educador confira e preencha uma citação literal no editor antes da publicação. Questões incompatíveis são convertidas em abertas para revisão. Até 100 questões são convertidas por prova; o original completo continua preservado no arquivo de migração.

Cada prova tem marcador determinístico e importação atômica; repetir o comando não duplica provas ou rankings. O script foi incluído e validado localmente; não foi executado contra os dados de produção.
