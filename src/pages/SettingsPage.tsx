import { useState } from "react";
import { useAppData } from "../context/DataContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { AI_PROVIDERS, GEMINI_DEFAULT_MODEL, migrateGeminiModel } from "../lib/ai";
import { useToast } from "../components/Toast";
import { Button, Field, PageHeader } from "../components/ui";
import type { AiProviderId } from "../types";

export function SettingsPage() {
  usePageTitle("AI 설정");
  const { data, apply, aiKey, persistAiAccess } = useAppData();
  const toast = useToast();
  const [provider, setProvider] = useState<AiProviderId>(data.aiSettings.provider);
  const [model, setModel] = useState(data.aiSettings.model);
  const [remember, setRemember] = useState(data.aiSettings.rememberKey);
  const [key, setKey] = useState(aiKey);
  const current = AI_PROVIDERS.find((item) => item.id === provider) ?? AI_PROVIDERS[0];

  function chooseProvider(next: AiProviderId) {
    const chosen = AI_PROVIDERS.find((item) => item.id === next);
    setProvider(next);
    if (chosen && !chosen.models.includes(model) && model === current?.defaultModel) setModel(chosen.defaultModel);
    if (chosen && model.trim() === "") setModel(chosen.defaultModel);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="설정"
        title="AI 설정"
        description="키는 이 앱에 넣어 두지 않습니다. 선생님이 가진 키만 사용합니다. 학급 백업 파일에는 키가 들어가지 않습니다."
      />
      <form
        className="sheet space-y-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const typed = model.trim() || current?.defaultModel || GEMINI_DEFAULT_MODEL;
          const nextModel = provider === "gemini" ? migrateGeminiModel(typed) : typed;
          apply({ ...data, aiSettings: { provider, model: nextModel, rememberKey: remember } });
          persistAiAccess(remember, key.trim());
          toast(remember ? "이 브라우저에 키를 남겨 두었습니다." : "키는 이 창을 닫으면 사라집니다.");
        }}
      >
        <fieldset>
          <legend className="mb-2 text-sm font-medium">제공자</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {AI_PROVIDERS.map((item) => (
              <label key={item.id} className="flex items-start gap-2 rounded-2xl border border-line bg-white px-3 py-3 text-sm">
                <input type="radio" name="provider" checked={provider === item.id} onChange={() => chooseProvider(item.id)} />
                <span>
                  <span className="block font-medium">{item.label}</span>
                  <span className="mt-1 block text-muted">{item.keyHint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="모델" hint="목록에 없는 모델 이름도 적을 수 있습니다.">
          <input className="control" list="ai-models" value={model} onChange={(event) => setModel(event.target.value)} />
          <datalist id="ai-models">
            {current?.models.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </Field>
        <Field label="API 키" hint="입력칸은 가려져 있습니다.">
          <input className="control" type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} />
        </Field>
        <label className="flex items-start gap-2 text-sm leading-6">
          <input className="mt-1" type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <span>
            이 브라우저에 키를 기억하기
            <span className="mt-1 block text-muted">
              공용 컴퓨터라면 켜지 마세요. 이 브라우저를 쓰는 사람은 키를 볼 수 있습니다. 기억해도 학급 백업 파일에는 넣지 않습니다.
            </span>
          </span>
        </label>
        <Button type="submit">설정 저장</Button>
      </form>
    </div>
  );
}
