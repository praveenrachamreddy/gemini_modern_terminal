import { GoogleGenAI, Chat, Type, GenerateContentResponse, Modality, Operation } from "@google/genai";
import type { Source } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY environment variable is not set. AI commands will return an error message.");
}

// Pass a dummy key if the actual key is not set to prevent the constructor from throwing an error.
// The functions below have checks to prevent API calls if API_KEY is not set.
const ai = new GoogleGenAI({ apiKey: API_KEY || 'not-set' });
let chatSession: Chat | null = null;
let chatDocSession: Chat | null = null;

const CHAT_SYSTEM_INSTRUCTION = 'You are a helpful assistant running inside a web-based terminal. Keep your answers concise and use simple formatting (line breaks, indentation) suitable for a monospace terminal output. Do not use Markdown formatting like bolding or italics.';
const CODE_SYSTEM_INSTRUCTION = 'You are an expert code assistant. Your purpose is to provide code snippets, explanations, and solutions to programming questions. Structure your response as a JSON object with two keys: "explanation" (a string explaining the code) and "code" (a string containing only the raw code).';


export interface CodeResponse {
    explanation: string;
    code: string;
}

export interface EditedImageResponse {
    image: string | null;
    text: string | null;
}

export type StreamEvent = 
    | { type: 'chunk', text: string }
    | { type: 'sources', sources: Source[] };


/**
 * For single-turn questions using the 'ask' command with streaming.
 */
export async function* askGeminiStream(prompt: string): AsyncGenerator<string> {
  if (!API_KEY) {
    yield "Error: API_KEY is not configured. The application owner needs to set the `process.env.API_KEY` environment variable.";
    return;
  }
  
  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: CHAT_SYSTEM_INSTRUCTION
      }
    });

    for await (const chunk of responseStream) {
      yield chunk.text;
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    if (error instanceof Error) {
      yield `Gemini API Error: ${error.message}`;
    } else {
      yield "An unknown error occurred while contacting the Gemini API.";
    }
  }
};

/**
 * For single-turn questions using Google Search grounding with streaming.
 */
export async function* searchWithGoogleStream(prompt: string): AsyncGenerator<StreamEvent> {
  if (!API_KEY) {
    yield { type: 'chunk', text: "Error: API_KEY is not configured. The application owner needs to set the `process.env.API_KEY` environment variable." };
    return;
  }
  
  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
         tools: [{googleSearch: {}}],
      }
    });

    for await (const chunk of responseStream) {
      yield { type: 'chunk', text: chunk.text };
      if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
          const sources = chunk.candidates[0].groundingMetadata.groundingChunks
              .map(c => c.web)
              .filter((source): source is { uri: string; title: string } => !!source?.uri && !!source.title);
          if (sources.length > 0) {
            yield { type: 'sources', sources };
          }
      }
    }
  } catch (error)
    {
    console.error("Gemini API Error:", error);
    let errorMessage = "An unknown error occurred while contacting the Gemini API.";
    if (error instanceof Error) {
        errorMessage = `Gemini API Error: ${error.message}`;
    }
    yield { type: 'chunk', text: errorMessage };
  }
}


/**
 * For code generation using the 'code' command.
 */
export const generateCode = async (prompt: string): Promise<CodeResponse> => {
    if (!API_KEY) {
        return Promise.resolve({
            explanation: "Error: API_KEY is not configured. The application owner needs to set the `process.env.API_KEY` environment variable.",
            code: ""
        });
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: CODE_SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        explanation: { type: Type.STRING },
                        code: { type: Type.STRING }
                    },
                    required: ["explanation", "code"]
                }
            }
        });
        
        try {
            const parsed = JSON.parse(response.text);
            return {
                explanation: parsed.explanation || "",
                code: parsed.code || ""
            };
        } catch (e) {
            console.warn("Failed to parse Gemini response as JSON. Treating as plain text.", e);
            // Fallback if the model doesn't return valid JSON
            return { explanation: response.text, code: "" };
        }
    } catch (error) {
        console.error("Gemini API Error:", error);
        let errorMessage = "An unknown error occurred while contacting the Gemini API.";
        if (error instanceof Error) {
            errorMessage = `Gemini API Error: ${error.message}`;
        }
        return { explanation: errorMessage, code: "" };
    }
};

/**
 * For image generation using the 'image' command.
 */
export const generateImage = async (prompt: string): Promise<string> => {
    if (!API_KEY) {
        return Promise.resolve("Error: API_KEY is not configured. The application owner needs to set the `process.env.API_KEY` environment variable.");
    }

    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '1:1',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            return response.generatedImages[0].image.imageBytes;
        } else {
            return "Error: The AI did not return an image. Please try a different prompt.";
        }
    } catch (error) {
        console.error("Gemini Image Generation Error:", error);
        if (error instanceof Error) {
            return `Gemini API Error: ${error.message}`;
        }
        return "An unknown error occurred while generating the image.";
    }
};


/**
 * For image editing using the 'editimg' command.
 */
export const editImage = async (base64ImageData: string, prompt: string): Promise<EditedImageResponse> => {
    if (!API_KEY) {
        return { 
            image: null, 
            text: "Error: API_KEY is not configured. The application owner needs to set the `process.env.API_KEY` environment variable." 
        };
    }

    try {
        const imagePart = {
          inlineData: {
            data: base64ImageData,
            mimeType: 'image/png', // generateImage produces PNG
          },
        };
        const textPart = {
          text: prompt,
        };

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image-preview',
          contents: {
            parts: [imagePart, textPart],
          },
          config: {
              responseModalities: [Modality.IMAGE, Modality.TEXT],
          },
        });
        
        const result: EditedImageResponse = { image: null, text: null };
        
        for (const part of response.candidates[0].content.parts) {
          if (part.text) {
            result.text = part.text;
          } else if (part.inlineData) {
            result.image = part.inlineData.data;
          }
        }
        
        if (!result.image && !result.text) {
            return { image: null, text: "Error: The AI did not return an image or text. Please try a different prompt." };
        }

        return result;

    } catch (error) {
        console.error("Gemini Image Editing Error:", error);
        if (error instanceof Error) {
            return { image: null, text: `Gemini API Error: ${error.message}` };
        }
        return { image: null, text: "An unknown error occurred while editing the image." };
    }
};


/**
 * Kicks off the video generation process.
 */
// Fix: The Operation type from @google/genai is generic and requires a type argument.
// Since the specific response type isn't exported, we use `any`.
export const generateVideo = async (prompt: string): Promise<Operation<any> | string> => {
    if (!API_KEY) {
        return "Error: API_KEY is not configured. The application owner needs to set the `process.env.API_KEY` environment variable.";
    }

    try {
        const operation = await ai.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
            },
        });
        return operation;
    } catch (error) {
        console.error("Gemini Video Generation Error:", error);
        if (error instanceof Error) {
            return `Gemini API Error: ${error.message}`;
        }
        return "An unknown error occurred while starting video generation.";
    }
};

/**
 * Polls the status of a video generation operation.
 */
// Fix: The Operation type from @google/genai is generic and requires a type argument.
// Since the specific response type isn't exported, we use `any`.
export const getVideosOperation = async (operation: Operation<any>): Promise<Operation<any>> => {
    const updatedOperation = await ai.operations.getVideosOperation({ operation });
    return updatedOperation;
};

/**
 * Starts a new persistent chat session.
 */
export const startChat = () => {
  if (!API_KEY) {
    return;
  }
  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: CHAT_SYSTEM_INSTRUCTION,
    },
  });
};

/**
 * Sends a message to the persistent chat session and streams the response.
 */
export async function* sendChatMessageStream(message: string): AsyncGenerator<string> {
  if (!chatSession) {
    yield "Error: Chat session not started. This is an unexpected error.";
    return;
  }

  try {
    const responseStream = await chatSession.sendMessageStream({ message });
    for await (const chunk of responseStream) {
        yield chunk.text;
    }
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    if (error instanceof Error) {
      yield `Gemini API Error: ${error.message}`;
    } else {
      yield "An unknown error occurred while contacting the Gemini API.";
    }
  }
};

/**
 * Starts a new persistent chat session for a document.
 */
export const startChatDoc = (documentContent: string) => {
  if (!API_KEY) {
    return;
  }
  // This priming of the chat history makes the model focus only on the document.
  chatDocSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: [
      {
        role: 'user',
        parts: [{ text: `--- DOCUMENT CONTENT START ---\n${documentContent}\n--- DOCUMENT CONTENT END ---\n\nBased *only* on the document content I've provided, you will now answer my questions. Do not use any external knowledge. If the answer cannot be found in the document, state that clearly. Your first response should be to confirm that you have received and understood the document and are ready for questions.` }]
      },
      {
        role: 'model',
        parts: [{ text: 'I have received the document and am ready to answer your questions based on its content.' }]
      }
    ],
  });
};

/**
 * Sends a message to the persistent document chat session and streams the response.
 */
export async function* sendChatDocMessageStream(message: string): AsyncGenerator<string> {
  if (!chatDocSession) {
    yield "Error: Document chat session not started. This is an unexpected error.";
    return;
  }

  try {
    const responseStream = await chatDocSession.sendMessageStream({ message });
    for await (const chunk of responseStream) {
        yield chunk.text;
    }
  } catch (error) {
    console.error("Gemini Document Chat Error:", error);
    if (error instanceof Error) {
      yield `Gemini API Error: ${error.message}`;
    } else {
      yield "An unknown error occurred while contacting the Gemini API.";
    }
  }
};