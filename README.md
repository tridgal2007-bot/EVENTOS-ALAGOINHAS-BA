# Alagoinhas Eventos - Portal de Agenda Cultural

Este projeto é um portal de eventos para Alagoinhas - BA, desenvolvido com **React + Vite + Tailwind CSS (v4)** e **TypeScript**. Ele foi estruturado como uma aplicação de página única (SPA) cliente pura, ideal para rodar localmente no VS Code e ser hospedado gratuitamente na Vercel ou Netlify, utilizando `localStorage` para persistência local rápida e eficiente de dados.

## 🚀 Como Executar Localmente (VS Code)

Para rodar este projeto na sua máquina de desenvolvimento usando o VS Code, certifique-se de ter o [Node.js](https://nodejs.org/) instalado.

1. **Abra a pasta do projeto** no VS Code.
2. **Abra o terminal integrado** (`Ctrl + \`` ou `Cmd + \``) e instale as dependências:
   ```bash
   npm install
   ```
3. **Inicie o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```
4. **Abra o link exibido no terminal** (geralmente `http://localhost:3000` ou `http://localhost:5173`) no seu navegador.

## ⚡ Como Implantar (Deploy) na Vercel

Hospedar seu projeto na Vercel é extremamente simples e leva menos de 2 minutos:

### Método 1: Via Vercel CLI (Direto do VS Code)
1. Instale o CLI da Vercel globalmente:
   ```bash
   npm install -g vercel
   ```
2. Na raiz do projeto, execute o comando:
   ```bash
   vercel
   ```
3. Siga as instruções rápidas na tela (pressione Enter para as opções padrão).

### Método 2: Conectando ao GitHub (Recomendado)
1. Crie um repositório no seu GitHub e envie o código para lá.
2. Acesse [vercel.com](https://vercel.com/) e faça login.
3. Clique em **"Add New"** > **"Project"**.
4. Importe o repositório do seu GitHub.
5. A Vercel detectará automaticamente que é um projeto **Vite**. Basta clicar em **"Deploy"**.

---

## 🛠️ Tecnologias Utilizadas

- **React 19** & **TypeScript**
- **Vite 6** (Super rápido para desenvolvimento e compilação)
- **Tailwind CSS v4** (Estilização ultra-rápida baseada em classes de utilidade)
- **Motion (motion/react)** (Animações fluidas e elegantes)
- **Lucide React** (Ícones vetoriais modernos)
