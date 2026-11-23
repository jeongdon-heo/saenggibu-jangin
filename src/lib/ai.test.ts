import { describe, expect, it, vi } from "vitest";
import { completeAi, geminiRequestBody, migrateGeminiModel } from "./ai";

describe("Gemini 모델", () => {
  it("2.5와 1.x, 2.0은 3.8로 올리고 고른 3.x는 둔다", () => {
    expect(migrateGeminiModel("gemini-2.5-flash")).toBe("gemini-3.8-flash");
    expect(migrateGeminiModel("models/gemini-2.5-pro")).toBe("gemini-3.8-flash");
    expect(migrateGeminiModel("gemini-1.5-flash")).toBe("gemini-3.8-flash");
    expect(migrateGeminiModel("gemini-2.0-flash-lite")).toBe("gemini-3.8-flash");
    expect(migrateGeminiModel("gemini-3.5-flash-lite")).toBe("gemini-3.5-flash-lite");
    expect(migrateGeminiModel("gemini-3.6-flash")).toBe("gemini-3.6-flash");
  });

  it("3.x 요청에는 샘플링 값과 thinkingBudget, 모델 선턴을 넣지 않는다", () => {
    const body = geminiRequestBody({ model: "gemini-3.8-flash", prompt: "문제를 만들어 주세요" });
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "문제를 만들어 주세요" }] }]);
    expect(body.generationConfig).toEqual({
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "LOW" },
    });
    expect(JSON.stringify(body)).not.toMatch(/temperature|topK|topP|thinkingBudget/);
  });

  it("모델을 못 찾으면 gemini-3.8-flash를 안내한다", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("model not found", { status: 404 }));
    await expect(completeAi({ provider: "gemini", model: "gemini-2.5-flash", apiKey: "test-key", prompt: "문제" })).rejects.toThrow(
      "gemini-3.8-flash",
    );
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(sent.generationConfig.temperature).toBeUndefined();
    fetchMock.mockRestore();
  });
});
