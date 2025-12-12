import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ThemeResponse, ShapeType } from "../types";

const GEMINI_API_KEY = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Exclude GALLERY from AI options as it requires user assets
const aiShapeOptions = Object.values(ShapeType).filter(s => s !== ShapeType.GALLERY);

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    shape: {
      type: Type.STRING,
      enum: aiShapeOptions,
      description: "The 3D shape that best matches the description."
    },
    primaryColor: {
      type: Type.STRING,
      description: "Hex color code for the main particles."
    },
    secondaryColor: {
      type: Type.STRING,
      description: "Hex color code for the secondary/highlight particles."
    },
    speed: {
      type: Type.NUMBER,
      description: "Simulation speed multiplier (0.1 to 3.0)."
    },
    particleCount: {
      type: Type.NUMBER,
      description: "Number of particles (1000 to 10000)."
    },
    reasoning: {
      type: Type.STRING,
      description: "Short explanation of why these settings were chosen."
    }
  },
  required: ["shape", "primaryColor", "secondaryColor", "speed", "particleCount", "reasoning"]
};

export const generateThemeFromPrompt = async (prompt: string): Promise<ThemeResponse> => {
  if (!GEMINI_API_KEY) {
    throw new Error("API Key is missing");
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a visual theme for a 3D particle system based on this description: "${prompt}".
      Be creative with the colors and shape choice to match the mood.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as ThemeResponse;
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback theme
    return {
      shape: ShapeType.SPHERE,
      primaryColor: "#ffffff",
      secondaryColor: "#00aaff",
      speed: 1.0,
      particleCount: 2000,
      reasoning: "Fallback due to API error."
    };
  }
};
