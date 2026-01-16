
import { GoogleGenAI, Type } from "@google/genai";
import { HumorTechnique, JokePart } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const comedyAssistant = {
  async generateThemes(context?: string) {
    const prompt = context 
      ? `Gere 5 temas inusitados para piadas de stand-up baseados no contexto: ${context}. Foque em situações cotidianas, observações sociais ou frustrações pessoais.`
      : "Gere 5 temas aleatórios e altamente relacionáveis para piadas de stand-up comedy.";

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ideas: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            explanation: { type: Type.STRING }
          },
          required: ["ideas"]
        }
      }
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      return { ideas: [], explanation: "Erro ao gerar temas." };
    }
  },

  async expandTheme(theme: string) {
    const prompt = `Atue como um mentor de escrita de comédia com conhecimento em Greg Dean e Leo Lins. 
    Para o tema "${theme}", sugira 3 abordagens diferentes.
    Para cada abordagem, forneça:
    1. Uma premissa clara.
    2. Um setup que construa uma suposição sólida (Greg Dean).
    3. Uma punchline que revele uma reinterpretação inesperada (o "conector").
    Pense em ângulos originais, técnicos e engraçados.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  premise: { type: Type.STRING },
                  setup: { type: Type.STRING },
                  punchline: { type: Type.STRING }
                },
                required: ["premise", "setup", "punchline"]
              }
            }
          },
          required: ["suggestions"]
        }
      }
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      return { suggestions: [] };
    }
  },

  async refineJoke(joke: JokePart, technique: HumorTechnique) {
    let instruction = `Use a técnica "${technique}" para melhorar esta piada.`;
    
    if (technique === HumorTechnique.GREG_DEAN) {
      instruction = `Aplique o método de Greg Dean: identifique o 'Conector' (o elemento com duplo sentido no setup), torne a 'Suposição' clara e crie uma 'Reinterpretação' (Punchline) que surpreenda.`;
    } else if (technique === HumorTechnique.LEO_LINS) {
      instruction = `Aplique o estilo de Leo Lins: use Mapeamento. Liste características do assunto, busque ângulos técnicos, explore o absurdo e, se apropriado, use humor ácido ou observações sociais afiadas. Foque na eficiência das palavras.`;
    }

    const prompt = `
      Atue como um redator sênior de comédia stand-up com expertise em Greg Dean e Leo Lins.
      ${instruction}
      
      Premissa original: ${joke.premise}
      Setup original: ${joke.setup}
      Punchline original: ${joke.punchline}

      Retorne a versão aprimorada.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            premise: { type: Type.STRING },
            setup: { type: Type.STRING },
            punchline: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: ["premise", "setup", "punchline"]
        }
      }
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      return joke;
    }
  }
};
