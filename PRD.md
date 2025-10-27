
# Documento de Requisitos do Produto (PRD) - Chef Pessoal IA

## 1. Visão Geral do Produto

O Chef Pessoal IA é uma aplicação web projetada para atuar como um assistente de cozinha inteligente. Ele permite que os usuários descubram receitas criativas com base nos ingredientes que já possuem em casa, combatendo o desperdício de alimentos e inspirando a criatividade culinária.

## 2. Objetivos

*   **Reduzir o desperdício de alimentos:** Ajudar os usuários a utilizar os ingredientes que têm à disposição.
*   **Inspirar a criatividade na cozinha:** Oferecer novas e variadas receitas a partir de uma lista de ingredientes.
*   **Facilitar o planejamento de refeições:** Simplificar o processo de decidir o que cozinhar.
*   **Prover uma experiência de usuário rica e intuitiva:** Permitir a entrada de ingredientes de múltiplas formas (imagem, áudio, texto).

## 3. Público-Alvo

*   **Cozinheiros domésticos:** Pessoas que cozinham regularmente em casa e procuram inspiração.
*   **Estudantes e jovens adultos:** Indivíduos com menos experiência na cozinha que precisam de ajuda para preparar refeições com os ingredientes disponíveis.
*   **Pessoas com consciência ambiental:** Usuários que desejam minimizar o desperdício de alimentos.

## 4. Funcionalidades

### 4.1. Input de Ingredientes

O sistema oferece três métodos para o usuário fornecer os ingredientes:

*   **4.1.1. Upload de Imagem:**
    *   O usuário pode tirar uma foto ou fazer o upload de uma imagem dos seus ingredientes.
    *   O sistema processará a imagem para identificar os ingredientes.
*   **4.1.2. Gravação de Áudio:**
    *   O usuário pode gravar um áudio listando os ingredientes que possui.
    *   O sistema transcreverá o áudio para texto a fim de identificar os ingredientes.
*   **4.1.3. Entrada de Texto:**
    *   O usuário pode digitar os ingredientes que possui em um campo de texto, separados por vírgula.

### 4.2. Geração de Receitas

*   Após o envio dos ingredientes, o sistema utilizará a API da OpenAI para gerar uma ou mais sugestões de receitas.
*   O sistema pode refinar as receitas se o usuário adicionar mais ingredientes posteriormente.

### 4.3. Exibição de Resultados

*   As receitas sugeridas são exibidas em cards, contendo:
    *   Nome da receita.
    *   Lista de ingredientes (disponíveis e adicionais).
    *   Modo de preparo passo a passo.
    *   Tempo de preparo estimado.
*   O sistema também pode exibir observações gerais ou dicas.

### 4.4. Tutorial Guiado

*   Para novos usuários, um tutorial interativo (usando Shepherd.js) é acionado para guiar através das principais funcionalidades da aplicação.

## 5. Requisitos Não Funcionais

*   **5.1. Tecnologia:**
    *   **Frontend:** HTML5, Tailwind CSS, JavaScript (vanilla).
    *   **Backend:** Node.js com Express, executado como uma função serverless.
    *   **APIs Externas:** OpenAI para geração de receitas.
*   **5.2. Desempenho:**
    *   A aplicação deve ser responsiva e carregar rapidamente.
    *   O tempo de resposta para a geração de receitas deve ser otimizado, com indicadores de carregamento claros para o usuário.
*   **5.3. Usabilidade:**
    *   A interface deve ser limpa, moderna e intuitiva.
    *   O processo de adicionar ingredientes e obter receitas deve ser simples e direto.
    *   A aplicação deve ser totalmente responsiva, funcionando bem em desktops e dispositivos móveis.

## 6. Plataforma

*   A aplicação é baseada na web e acessível através de qualquer navegador moderno.
*   O deploy é feito na plataforma Netlify, aproveitando as Netlify Functions para o backend.
