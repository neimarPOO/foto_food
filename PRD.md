# Documento de Requisitos do Produto (PRD) - Soborô: Chef Pessoal IA

## 1. Introdução

### 1.1 Visão do Produto
O **Soborô** (também referido como "Chef Pessoal IA") é uma aplicação web inteligente projetada para transformar ingredientes disponíveis em casa em receitas deliciosas. Atuando como um assistente de cozinha pessoal, o aplicativo utiliza Inteligência Artificial para combater o desperdício de alimentos e inspirar a criatividade culinária.

### 1.2 Objetivos Principais
*   **Reduzir desperdício alimentar**: Incentivar o uso de ingredientes que o usuário já possui.
*   **Facilitar a decisão culinária**: Eliminar a dúvida do "o que cozinhar hoje".
*   **Simplicidade e Acessibilidade**: Oferecer múltiplas formas de entrada (texto, áudio, câmera) para ser inclusivo e prático.
*   **Monetização**: Implementar um modelo sustentável via planos de assinatura (Stripe).

## 2. Funcionalidades Principais

### 2.1 Autenticação e Perfil
*   **Login/Cadastro**: Sistema de autenticação via e-mail e senha utilizando **Supabase Auth**.
*   **Gerenciamento de Sessão**: Persistência de login e opção de logout segura.
*   **Proteção de Rotas**: Funcionalidades de geração de receitas restritas a usuários autenticados.

### 2.2 Entrada de Ingredientes (Multimodal)
O usuário pode informar os ingredientes através de três métodos distintos:
1.  **Imagem (Visão Computacional)**:
    *   Upload de arquivo de imagem local.
    *   Captura direta via **Webcam** integrada no navegador.
    *   Pré-visualização e confirmação da imagem antes do envio.
2.  **Áudio (Reconhecimento de Voz)**:
    *   Gravação de voz diretamente no navegador.
    *   Transcrição automática de áudio para texto via API (AssemblyAI ou similar).
3.  **Texto Manual**:
    *   Campo de texto livre para digitação de ingredientes separados por vírgula.

### 2.3 Geração de Receitas (IA)
*   **Processamento Inteligente**: Envio dos ingredientes (texto ou descrição visual) para um modelo de linguagem (LLM) via API (`/api/receitas`).
*   **Saída Estruturada**: Geração de sugestões contendo:
    *   Nome criativo do prato.
    *   Lista de ingredientes (categorizados em 'disponíveis' e 'adicionais necessários').
    *   Modo de preparo passo a passo.
    *   Tempo estimado de preparo.
*   **Refinamento**: Opção de "Adicionar e Refazer" para incluir mais ingredientes à busca atual.

### 2.4 Visualização e Interação
*   **Cards de Receitas**: Exibição das sugestões em formato de cards interativos.
*   **Detalhamento (Modal)**: Visualização completa da receita em um modal focado.
*   **Exportação em PDF**: Funcionalidade para baixar a receita formatada em PDF (`jsPDF`).
*   **Tutorial Interativo**: Guia passo a passo para novos usuários utilizando a biblioteca **Shepherd.js**.

### 2.5 Planos e Assinaturas (Monetização)
Integração com **Stripe** para gestão de assinaturas com três níveis de serviço:
*   **Plano Básico (R$10/mês)**: Até 10 gerações/dia.
*   **Plano Pro (R$30/mês)**: Até 30 gerações/dia + suporte.
*   **Plano Premium (R$50/mês)**: Até 50 gerações/dia + acesso antecipado.

## 3. Especificações Técnicas

### 3.1 Frontend
*   **Linguagens**: HTML5, JavaScript (Vanilla ES6+), CSS3.
*   **Framework CSS**: **Tailwind CSS** (via CDN) para estilização responsiva e utilitária.
*   **Bibliotecas Auxiliares**:
    *   `Shepherd.js`: Tutoriais guiados (Onboarding).
    *   `jspdf`: Geração de arquivos PDF no cliente.
    *   `supabase-js`: Cliente para interação com Auth e Banco de Dados.
    *   `stripe-js`: Integração com checkout do Stripe.
*   **Estética Visual**:
    *   Tema "Sober Green" (Verde Sóbrio) e Cores Terrosas.
    *   Tipografia rica: *Oswald*, *Roboto*, *Inter*, *Grand Hotel* (títulos cursivos), *Fredericka the Great*.
    *   Design Responsivo (Mobile-first).

### 3.2 Backend e Infraestrutura
*   **Hospedagem**: Compatível com **Netlify** (estrutura pronta para Netlify Functions).
*   **API Functions** (Node.js/Express-style):
    *   `/api/receitas`: Orquestração da IA para geração de receitas.
    *   `/api/transcribe`: Serviço de transcrição de áudio.
    *   `/api/create-checkout-session`: Criação de sessões de pagamento no Stripe.
*   **Serviços Externos**:
    *   **Supabase**: Autenticação e Banco de Dados (PostgreSQL).
    *   **Stripe**: Processamento de pagamentos.
    *   **OpenRouter / OpenAI / Google Gemini**: Modelos de IA para geração de texto (receitas).
    *   **AssemblyAI**: Transcrição de áudio (STT).

## 4. Requisitos Não-Funcionais
*   **Performance**: Carregamento rápido de assets e feedback visual imediato (spinners) durante requisições de IA.
*   **Usabilidade**: Interface intuitiva com feedback claro de erros e sucessos.
*   **Responsividade**: Layout adaptável a qualquer tamanho de tela (Desktop, Tablet, Mobile).
*   **Segurança**: Proteção de chaves de API no backend (Netlify Functions) e uso de HTTPS.

## 5. Estrutura de Arquivos (Resumo)
*   `index.html`: Ponto de entrada da aplicação (SPA - Single Page Application).
*   `styles.css` (ou inline): Regras de estilo personalizadas e sobrescritas do Tailwind.
*   `netlify.toml`: Configuração de build e funções serverless.
*   `functions/`: Diretório contendo a lógica de backend (API endpoints).

## 6. Fluxo do Usuário Típico
1.  Usuário acessa a Home.
2.  (Se novo) Visualiza tutorial Shepherd.js.
3.  Faz Login/Cadastro.
4.  Escolhe método de entrada (Ex: "Usar Webcam").
5.  Tira foto dos ingredientes.
6.  Sistema analisa e retorna 3 opções de receitas.
7.  Usuário visualiza detalhes de uma receita.
8.  Usuário baixa PDF da receita para salvar.
