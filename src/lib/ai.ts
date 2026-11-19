import type { AiProviderId } from "../types";

export type AiCompleteInput = {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  prompt: string;
};

export const AI_PROVIDERS: Array<{ id: AiProviderId; label: string; defaultModel: string; models: string[]; keyHint: string }> = [
  {
    id: "gemini",
    label: "Gemini",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
    keyHint: "Google AI Studio에서 받은 키",
  },
  {
    id: "openai",
    label: "ChatGPT (OpenAI)",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"],
    keyHint: "OpenAI API 키. 브라우저에서 막히면 프롬프트 복사를 사용하세요.",
  },
];

const SYSTEM = "초등 평가 문항만 만듭니다. 학생의 이름, 번호, 생활기록은 받지 않았고 만들어 넣지도 않습니다. JSON만 출력합니다.";

function scrub(text: string, apiKey: string): string {
  const clean = text.replace(/\s+/g, " ").slice(0, 180);
  if (!apiKey) return clean;
  return clean.split(apiKey).join("***");
}

function httpError(status: number, body: string, apiKey: string): string {
  if (status === 401 || status === 403) return "API 키를 확인하지 못했습니다. 키와 제공자를 다시 봐 주세요.";
  if (status === 429) return "요청이 많습니다. 잠시 뒤 다시 시도해 주세요.";
  if (status === 404) return "모델 이름을 찾지 못했습니다. 설정에서 모델 이름을 바꿔 보세요.";
  return `인공지능 응답이 거절되었습니다. ${scrub(body, apiKey)}`;
}

async function completeGemini(input: AiCompleteInput): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": input.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: input.prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
      }),
    });
  } catch {
    throw new Error("브라우저에서 Gemini에 연결하지 못했습니다. 네트워크를 확인하거나 프롬프트 복사를 사용하세요.");
  }
  const body = await response.text();
  if (!response.ok) throw new Error(httpError(response.status, body, input.apiKey));
  const parsed = JSON.parse(body) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = parsed.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("응답이 비어 있습니다. 프롬프트 복사로 다시 만들어 보세요.");
  return text;
}

async function completeOpenAI(input: AiCompleteInput): Promise<string> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.apiKey}` },
      body: JSON.stringify({
        model: input.model,
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: input.prompt },
        ],
      }),
    });
  } catch {
    throw new Error("이 브라우저에서 OpenAI로 직접 보내지 못했습니다. 프롬프트 복사를 사용하거나 Gemini 키를 써 보세요.");
  }
  const body = await response.text();
  if (!response.ok) throw new Error(httpError(response.status, body, input.apiKey));
  const parsed = JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }> };
  const text = parsed.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("응답이 비어 있습니다. 프롬프트 복사로 다시 만들어 보세요.");
  return text;
}

export async function completeAi(input: AiCompleteInput): Promise<string> {
  if (!input.apiKey.trim()) throw new Error("API 키가 없습니다. 설정에서 키를 넣거나 프롬프트 복사를 사용하세요.");
  if (input.provider === "openai") return completeOpenAI(input);
  return completeGemini(input);
}
