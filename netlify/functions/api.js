const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fileType = require('file-type');
const axios = require('axios');


const app = express();
app.use(cors());
app.use(express.json());


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

app.post('/api/receitas', upload.single('image'), async (req, res) => {
  let rawResponseContent = '';
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
    }

    const imageBuffer = req.file.buffer;
    const type = await fileType.fromBuffer(imageBuffer);

    if (!type) {
        return res.status(400).json({ error: 'Não foi possível determinar o tipo do arquivo.' });
    }

    const base64Image = imageBuffer.toString('base64');
    const mimeType = type.mime;

    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
      "model": "qwen/qwen2.5-vl-32b-instruct:free",
      "messages": [
        {
          "role": "user",
          "content": [
            {
              "type": "text",
              "text": "# Prompt Melhorado para Análise de Ingredientes e Sugestão de Receitas"

```
Você é um chef experiente e nutricionista especializado em aproveitamento máximo de ingredientes. Analise meticulosamente a imagem dos ingredientes disponíveis e sugira 2-3 receitas otimizadas seguindo estas diretrizes:

## ANÁLISE DETALHADA DOS INGREDIENTES:
1. **Identificação precisa**: Reconheça cada ingrediente, incluindo variedades específicas (ex: "tomate italiano" vs "tomate cereja")
2. **Estado e qualidade**: Avalie frescor, maturação e condições visuais dos ingredientes
3. **Quantidades estimadas**: Estime porções baseando-se em referências visuais e proporções
4. **Potencial culinário**: Identifique sabores, texturas e técnicas de preparo mais adequadas para cada item
5. **Combinações sinérgicas**: Reconheça ingredientes que se complementam em sabor, textura e valor nutricional

## CRITÉRIOS PARA SUGESTÃO DE RECEITAS:
- **Máximo aproveitamento**: Priorize receitas que usem a maior quantidade possível dos ingredientes disponíveis
- **Harmonia gastronômica**: Garanta que os sabores se complementem e não compitam entre si
- **Viabilidade técnica**: Considere métodos de preparo compatíveis com ingredientes domésticos típicos
- **Equilíbrio nutricional**: Balance proteínas, carboidratos, fibras e micronutrientes quando possível
- **Praticidade**: Sugira receitas com complexidade adequada aos ingredientes disponíveis
- **Versatilidade**: Inclua opções para diferentes ocasiões (refeição principal, lanche, acompanhamento)

## INGREDIENTES ADICIONAIS ESTRATÉGICOS:
- Sugira apenas itens essenciais e comuns que elevem significativamente o prato
- Priorize temperos básicos, bases aromáticas e ingredientes de "ligação"
- Considere alternativas quando possível (ex: "azeite ou óleo vegetal")
- Mantenha a lista enxuta - máximo 5 ingredientes adicionais por receita

## MODO DE PREPARO DETALHADO:
- Use verbos de ação específicos e técnicas culinárias precisas
- Inclua temperaturas, tempos e pontos de referência visuais
- Ordene etapas logicamente para otimizar tempo e resultado
- Mencione técnicas para realçar sabores naturais dos ingredientes

## OBSERVAÇÕES ESTRATÉGICAS:
- Destaque características nutritivas dos pratos sugeridos
- Mencione possíveis variações ou substituições
- Indique dicas para maximizar sabor e apresentação
- Sugira acompanhamentos que complementem as receitas

A resposta deve ser um JSON com a seguinte estrutura: {"receitas": [{"nome": "...", "ingredientes_disponiveis": ["..."], "ingredientes_adicionais": ["..."], "modo_preparo": ["..."], "tempo_preparo": "..."}], "observacoes_gerais": "..."}. 

**IMPORTANTE**: Responda APENAS com o JSON válido, sem texto adicional, explicações ou formatação markdown antes ou depois.
```            },
            {
              "type": "image_url",
              "image_url": {
                "url": `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ]
    }, {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "HTTP-Referer": "https://receitas-com-ia.vercel.app", // You might want to change this to your Netlify URL
        "X-Title": "Receitas com IA",
        "Content-Type": "application/json"
      }
    });

    const completion = response.data;

    rawResponseContent = completion.choices[0].message.content;

    // Custom JSON parsing logic
    let parsedJson;
    try {
      const startIndex = rawResponseContent.indexOf('{');
      const endIndex = rawResponseContent.lastIndexOf('}');
      if (startIndex !== -1 && endIndex !== -1) {
        const jsonSubstring = rawResponseContent.substring(startIndex, endIndex + 1);
        parsedJson = JSON.parse(jsonSubstring);
      } else {
        throw new Error('JSON object not found in response.');
      }
    } catch (jsonError) {
      console.error("Error parsing JSON from raw response:", jsonError);
      console.error("Raw response content:", rawResponseContent);
      throw new Error('Resposta da IA não é um JSON válido ou está incompleta.');
    }

    res.json(parsedJson);

  } catch (error) {
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: `Erro no upload da imagem: ${error.message}` });
    }
    console.error("Error in /api/receitas:", error);
    console.error("Raw response content (if available):", rawResponseContent);
    res.status(500).json({ error: 'Erro ao processar a resposta da IA. Tente uma imagem diferente.' });
  }
});

const serverless = require('serverless-http');

const PORT = process.env.PORT || 3000;

module.exports.handler = serverless(app);
