
// Use Gemini to explain the severity and implications of code changes.
import { GoogleGenAI, Type } from "@google/genai";
import { ImpactAnalysis, RiskLevel } from "../types";

import * as path from 'path';

export class ImpactExplainer {
  constructor(private workspaceRoot: string) {
    require('dotenv').config({ path: path.join(workspaceRoot, '.env') });
  }

  async explain(analysis: ImpactAnalysis): Promise<{ explanation: string; testSuggestions: string[] }> {
    // Support both GEMINI_API_KEY (documented in .env.example) and legacy API_KEY.
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "dummy_key_to_avoid_init_error";
    const ai = new GoogleGenAI({ apiKey });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [{
            text: `As a senior software engineer, analyze the impact of changing or commenting out '${analysis.changedSymbol}' in '${analysis.file}'. 
            Impacted locations found by static analysis: ${analysis.impacts.length}. 
            Risk Level: ${analysis.riskScore}.
            Categories: ${analysis.categories.join(', ')}.
            
            File Content Snippet:
            \`\`\`
            ${analysis.fileContent ? analysis.fileContent.substring(0, 3000) : 'Not available'}
            \`\`\`
            
            1. Return a 2-sentence explanation of the impact.
            2. Provide 3 specific test recommendations.
            3. If the static analysis found 0 impacts, but you clearly see in the code snippet that other lines will be broken (like a ReferenceError if a variable is commented out), list those exact lines in 'discoveredImpacts'.
            Return strictly in JSON format.`
          }]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: { type: Type.STRING },
              testSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              discoveredImpacts: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT,
                  properties: {
                    line: { type: Type.INTEGER },
                    context: { type: Type.STRING }
                  }
                } 
              }
            },
            required: ["explanation", "testSuggestions"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("AI response was empty");
      
      const result = JSON.parse(text.trim());
      
      if (result.discoveredImpacts && Array.isArray(result.discoveredImpacts)) {
        result.discoveredImpacts.forEach((imp: any) => {
          analysis.impacts.push({
            symbolName: analysis.changedSymbol,
            file: analysis.file,
            line: imp.line,
            context: imp.context,
            isDirect: true
          });
        });
        // Update risk score based on new impacts
        if (analysis.impacts.length > 5) analysis.riskScore = RiskLevel.HIGH;
        else if (analysis.impacts.length > 2) analysis.riskScore = RiskLevel.MEDIUM;
      }

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
