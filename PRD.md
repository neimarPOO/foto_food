# PRD - Documento de Requisitos do Produto: Chef Pessoal IA

## 1. Introdução

O "Chef Pessoal IA" é uma aplicação web que atua como um assistente de cozinha inteligente. Ele permite que os usuários descubram receitas com base nos ingredientes que possuem em casa, utilizando inteligência artificial para gerar sugestões criativas e práticas.

## 2. Objetivo

O principal objetivo do projeto é reduzir o desperdício de alimentos e inspirar a criatividade na cozinha, ajudando os usuários a cozinhar com o que já têm disponível. A aplicação visa fornecer uma experiência de usuário simples e intuitiva para a descoberta de receitas.

## 3. Funcionalidades

### 3.1. Input de Ingredientes

O usuário pode fornecer os ingredientes que possui de três maneiras diferentes:

-   **Imagem:** Tirando ou enviando uma foto dos ingredientes.
-   **Áudio:** Gravando um áudio e listando os ingredientes em voz alta.
-   **Texto:** Digitando uma lista de ingredientes, separados por vírgula.

### 3.2. Geração de Receitas

-   Após o input do usuário, a aplicação envia os ingredientes para uma API de IA.
-   A API processa a informação e retorna uma ou mais sugestões de receitas.
-   Cada receita contém:
    -   Nome da receita.
    -   Lista de ingredientes (disponíveis e adicionais).
    -   Modo de preparo detalhado.
    -   Tempo estimado de preparo.

### 3.3. Visualização de Receitas

-   As receitas geradas são exibidas em cards individuais e de fácil leitura.
-   A interface mostra claramente os ingredientes que foram utilizados na busca.

### 3.4. Funcionalidades Adicionais

-   **Adicionar mais ingredientes:** O usuário pode adicionar mais ingredientes a qualquer momento para refinar a busca e gerar novas receitas.
-   **Começar Nova Receita:** Permite ao usuário limpar a busca atual e iniciar uma nova consulta do zero.
-   **Tutorial Interativo:** Um guia passo-a-passo (usando Shepherd.js) é apresentado aos novos usuários para explicar o funcionamento da aplicação.

## 4. Requisitos Técnicos

### 4.1. Frontend

-   **Estrutura:** HTML5.
-   **Estilização:** Tailwind CSS para um design moderno e responsivo.
-   **Lógica:** JavaScript puro para manipular o DOM e interagir com a API.
-   **Design:** Responsivo, garantindo uma boa experiência em desktops, tablets e smartphones.

### 4.2. Backend (API)

-   **Endpoint de Receitas (`/api/receitas`):** Responsável por receber os ingredientes (em formato de texto ou imagem) e o estado atual dos ingredientes, e retornar as receitas geradas pela IA.
-   **Endpoint de Transcrição (`/api/transcribe`):** Responsável por receber um arquivo de áudio, transcrevê-lo para texto e retorná-lo.
-   **Integração com IA:** O backend deve se comunicar com um modelo de linguagem de grande porte para a lógica de geração de receitas.

## 5. Fluxo do Usuário

1.  **Início:** O usuário acessa a página inicial e clica no botão "Começar a Criar Receitas".
2.  **Seleção de Input:** Um modal é exibido, permitindo que o usuário escolha entre os métodos de entrada: Imagem, Áudio ou Texto.
3.  **Fornecimento de Ingredientes:** O usuário fornece os ingredientes usando o método escolhido.
4.  **Carregamento:** A aplicação exibe uma tela de carregamento com mensagens dinâmicas enquanto aguarda a resposta da API.
5.  **Exibição dos Resultados:** As receitas geradas são exibidas na tela. A seção inicial é substituída pelos botões "Adicionar e Refazer Receitas" e "Começar Nova Receita".
6.  **Interação com Resultados:**
    -   O usuário pode analisar as receitas.
    -   Ao clicar em "Adicionar e Refazer Receitas", o modal de input é reaberto para adicionar mais ingredientes à busca atual.
    -   Ao clicar em "Começar Nova Receita", o estado da aplicação é reiniciado, a tela de resultados é limpa e o usuário é levado de volta ao fluxo inicial.
