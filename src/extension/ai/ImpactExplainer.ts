
// Use Gemini to explain the severity and implications of code changes.
import { GoogleGenAI, Type } from "@google/genai";
import { ImpactAnalysis } from "../types";

export class ImpactExplainer {
  async explain(analysis: ImpactAnalysis): Promise<{ explanation: string; testSuggestions: string[] }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: {
          parts: [{
            text: `As a senior software engineer, explain the impact of changing '${analysis.changedSymbol}' in '${analysis.file}'. 
            Impacted locations: ${analysis.impacts.length}. 
            Risk Level: ${analysis.riskScore}.
            Categories: ${analysis.categories.join(', ')}.
            
            Return a 2-sentence explanation and 3 test suggestions in JSON format.`
          }]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: { type: Type.STRING },
              testSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["explanation", "testSuggestions"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("AI response was empty");
      
      const result = JSON.parse(text.trim());
      return {
        explanation: result.explanation || "Verify logical side-effects of this symbol change.",
        testSuggestions: result.testSuggestions || ["Run direct caller unit tests", "Verify API consumers"]
      };
    } catch (error) {
      console.error("Gemini Insight Error:", error);
      return {
        explanation: `Potential regressions in ${analysis.impacts.length} files. Review propagation paths manually.`,
        testSuggestions: ["Perform integration testing", "Verify data flow stability"]
      };
    }
  }
}
