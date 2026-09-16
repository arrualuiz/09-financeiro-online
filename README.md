# Dashboard Contábil 2026

Site estático (HTML/CSS/JS puro, sem backend) que lê a aba **"CONTABIL 2026"** da sua
planilha do Google Sheets e mostra um dashboard com cartões de totais, gráficos e
tabelas de entradas/saídas por mês.

Você faz login com sua própria conta Google no navegador; os dados são buscados
diretamente do seu navegador para a API do Google Sheets — não existe servidor
nem banco de dados no meio do caminho.

## ⚠️ Sobre segurança da planilha

Sua planilha tem 23 abas, e algumas delas guardam dados sensíveis (senhas de app,
CVV de cartão, chaves PIX, CPF — nas abas `BANCOS`, `DADOS`, `PIX` e parte da `home`).

O Google não permite dar permissão OAuth para "só uma aba" — a permissão concedida
(`spreadsheets.readonly`) tecnicamente cobre a planilha inteira. Na prática, o site
**nunca pede** nenhuma dessas abas: o código só faz uma única chamada pedindo o
intervalo `'CONTABIL 2026'!A1:BT210`, então os dados sensíveis nunca saem dos
servidores do Google. Mesmo assim, vale saber:

- Não compartilhe o link do site publicamente nem o Client ID de forma que estranhos
  possam usá-lo — restrinja quem pode logar (veja o Passo 3 abaixo).
- Se algum dia quiser abrir esse projeto pra outra pessoa colaborar, não cole o
  conteúdo da planilha em chats/PRs públicos.

## Passo 1 — Criar as credenciais no Google Cloud (~5 minutos)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/) e crie um
   projeto novo (ou use um existente).
2. Vá em **APIs e Serviços > Biblioteca**, procure por **Google Sheets API** e
   clique em **Ativar**.
3. Vá em **APIs e Serviços > Tela de permissão OAuth**:
   - Tipo de usuário: **Externo** (ou **Interno**, se sua conta for Google Workspace).
   - Preencha nome do app, e-mail de suporte e e-mail do desenvolvedor.
   - Em **Escopos**, não precisa adicionar nada manualmente.
   - Em **Usuários de teste** (se o app ficar em modo "Teste"), adicione o seu
     próprio e-mail do Google — assim só você consegue logar no site.
4. Vá em **APIs e Serviços > Credenciais > Criar Credenciais > ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**.
   - Em **Origens JavaScript autorizadas**, adicione o endereço de onde o site vai
     rodar. Exemplos:
     - `http://localhost:5500` (se for testar localmente)
     - `https://seuusuario.github.io` (se for publicar no GitHub Pages)
   - Salve e copie o **Client ID** gerado (termina em `.apps.googleusercontent.com`).

## Passo 2 — Configurar o projeto

Abra [assets/js/config.js](assets/js/config.js) e cole o Client ID:

```js
window.APP_CONFIG = {
  GOOGLE_CLIENT_ID: "COLE_AQUI.apps.googleusercontent.com",
  SPREADSHEET_ID: "1SqUu1fw5SgwHiwha3lLJC5XAKqX1NOKkxcpnhI1cIxw",
  SHEET_NAME: "CONTABIL 2026",
};
```

O `SPREADSHEET_ID` já está preenchido com o ID da sua planilha atual.

## Passo 3 — Rodar o site

Como o login do Google não funciona abrindo o arquivo diretamente (`file://`),
sirva a pasta com um servidor local. Algumas opções:

- **VS Code**: instale a extensão "Live Server" e clique em "Go Live" com o
  [index.html](index.html) aberto.
- **Python** (já vem instalado): na pasta do projeto, rode:
  ```
  python -m http.server 5500
  ```
  e abra `http://localhost:5500` no navegador.

Lembre-se: o endereço (`http://localhost:5500`, etc.) precisa ser **exatamente**
o mesmo que você cadastrou em "Origens JavaScript autorizadas" no Passo 1.

Para publicar de verdade (acessar de qualquer lugar), você pode subir a pasta
para o **GitHub Pages**, **Netlify** ou **Vercel** gratuitamente — nesse caso,
adicione a URL final também nas origens autorizadas do Google Cloud.

## Como funciona o parser

A aba "CONTABIL 2026" não é uma tabela simples — é um "calendário" com 14 meses
lado a lado (dezembro/2025 a janeiro/2027), cada um ocupando 3 colunas
(`Quando?`, `Quanto?`, `Pago?`). O arquivo [assets/js/parser.js](assets/js/parser.js)
sabe exatamente em quais linhas/colunas ler cada seção (Entradas, Saídas, e os
detalhamentos de fatura do C6 Bank e Nubank) e ignora as linhas de subtotal que a
própria planilha já calcula (para não contar valores em dobro).

**Se você alterar a estrutura da planilha** (adicionar linhas novas antes das
existentes, mudar nomes de categoria, etc.), o parser pode precisar de ajuste.
As linhas usadas hoje estão documentadas nos comentários de `parser.js`.

Os totais de "Saídas" do dashboard **não incluem** os detalhamentos de fatura de
cartão (linhas 135–184: assinaturas e compras que compõem a fatura do C6/Nubank)
— só a fatura fechada em si (linhas 70/71) — para não contar o mesmo dinheiro duas
vezes. Esses detalhamentos aparecem na tabela de saídas apenas como informação
extra.

## Estrutura dos arquivos

```
index.html              → estrutura da página
assets/css/style.css    → estilo do dashboard
assets/js/config.js     → suas credenciais (Client ID, ID da planilha)
assets/js/auth.js       → login/logout com Google (OAuth)
assets/js/sheets.js     → chamada à API do Google Sheets
assets/js/parser.js     → interpreta o grid bruto e gera as transações
assets/js/app.js        → junta tudo e desenha o dashboard (cards, gráficos, tabelas)
```
