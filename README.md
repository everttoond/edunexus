# EduNexus Learning Room - Validacao de Cliques

Site ficticio para validar interesse em uma ideia de plataforma educacional e medir a quantidade de cliques recebidos.

A primeira tela e um login demonstrativo. Nao existe autenticacao real por enquanto:
o botao `Quero testar` libera a experiencia demo e registra o clique quando o
visitante aceitou o aviso de consentimento.

Depois do login, a experiencia abre uma central de impacto pedagogico com duas
abas:

- `Visao do gestor`: simula indicadores executivos, risco pedagogico, uso da Edu AI
  e recomendacoes acionaveis para coordenacao/direcao.
- `Visao do aluno`: simula o impacto da adaptacao no estudante, comparando a aula
  tradicional com a aula adaptada por perfil.

## Como rodar no VS Code

1. Instale as dependencias:

```bash
npm install
```

2. Em um terminal, rode a API local:

```bash
npm run api
```

3. Em outro terminal, rode o site:

```bash
npm run dev
```

4. Acesse:

```text
http://localhost:5173
```

## Como rodar para publicar em servidor Node

```bash
npm install
npm run build
npm start
```

Nesse modo, o servidor abre em `http://localhost:3001` e serve tanto o site quanto os endpoints:

- `POST /api/events`: registra visita ou clique.
- `GET /api/stats`: retorna totais do painel.

## O que esta sendo medido

- Visitas aceitas pelo aviso de consentimento.
- Cliques no login demonstrativo.
- Cliques nos CTAs principais.
- Cliques no player demonstrativo.
- Cliques no botao de compartilhamento.
- Visitantes unicos por identificador anonimo salvo no navegador.

O projeto nao coleta nome, telefone, email, IP ou credenciais.

## Como enviar para conhecidos

Depois de publicar em uma URL publica, envie o link com UTM:

```text
https://seu-dominio.com/?utm_source=whatsapp&utm_campaign=validacao_edunexus
```

O painel na propria pagina mostra o total agregado de cliques.

## Deploy online recomendado

Para manter o contador de cliques funcionando, publique em um servidor Node como
Render, Railway ou VPS. GitHub Pages nao roda a API `/api/events`, entao deixaria
o front online, mas sem contador agregado real.

Fluxo recomendado:

1. Subir este projeto para um repositorio GitHub.
2. Criar um Web Service no Render conectado ao repositorio.
3. Usar:

```bash
npm install && npm run build
```

como build command e:

```bash
npm start
```

como start command.

O arquivo `render.yaml` ja deixa essa configuracao pronta para importacao no
Render.

Observacao: o MVP salva cliques em `data/clicks.json`. Em hospedagem gratuita,
esse arquivo pode ser reiniciado em novos deploys. Para validacao curta funciona;
para campanha real, troque por Supabase, PostgreSQL ou Google Sheets.

## Como evoluir depois

- Trocar o arquivo `data/clicks.json` por Supabase, PostgreSQL ou Google Sheets.
- Proteger o painel com senha simples.
- Separar campanhas por slug, por exemplo `/c/edunexus-maio`.
- Medir conversao depois com formulario, WhatsApp, checkout ou CRM.
