/** @vitest-environment happy-dom */
import { act, type ReactNode } from "react";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { StandardCodes } from "./TeachPage";

async function render(node: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  return { host, root };
}

describe("성취기준 코드", () => {
  it("코드를 보여 주고, 누르면 문장을 펼쳤다가 다시 접는다", async () => {
    const { host, root } = await render(
      <StandardCodes
        standards={[
          { code: "4사03-01", text: "지역의 문제를 파악하고 해결 방안을 찾아본다." },
          { code: "4사03-02", text: "자료를 조사한다." },
        ]}
      />,
    );
    expect(host.textContent).toContain("[4사03-01]");
    expect(host.textContent).toContain("[4사03-02]");
    expect(host.textContent).not.toContain("지역의 문제를 파악하고");
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons[0]?.getAttribute("aria-expanded")).toBe("false");
    expect(buttons[0]?.getAttribute("title")).toBe("지역의 문제를 파악하고 해결 방안을 찾아본다.");
    await act(async () => {
      buttons[0]?.click();
    });
    expect(buttons[0]?.getAttribute("aria-expanded")).toBe("true");
    expect(host.textContent).toContain("지역의 문제를 파악하고 해결 방안을 찾아본다.");
    expect(host.textContent).not.toContain("자료를 조사한다.");
    await act(async () => {
      buttons[0]?.click();
    });
    expect(buttons[0]?.getAttribute("aria-expanded")).toBe("false");
    expect(host.textContent).not.toContain("지역의 문제를 파악하고");
    await act(async () => {
      root.unmount();
    });
  });

  it("연결된 성취기준이 없으면 아무것도 그리지 않는다", async () => {
    const { host, root } = await render(<StandardCodes standards={[]} />);
    expect(host.childElementCount).toBe(0);
    await act(async () => {
      root.unmount();
    });
  });
});
