import { describe, expect, it } from "vitest";
import { COUNT_NOTES, countChars, countNeisBytes } from "./textCount";

describe("글자 수", () => {
  it("공백을 포함해 센다", () => {
    expect(countChars("가 나")).toBe(3);
    expect(countChars("  ")).toBe(2);
  });

  it("한글 한 글자를 1로 센다", () => {
    expect(countChars("학생")).toBe(2);
  });

  it("줄바꿈을 한 글자로 세고 윈도우 줄바꿈도 한 번이다", () => {
    expect(countChars("가\n나")).toBe(3);
    expect(countChars("가\r\n나")).toBe(3);
    expect(countChars("가\r나")).toBe(3);
  });

  it("빈 문장은 0이다", () => {
    expect(countChars("")).toBe(0);
  });
});

describe("나이스 바이트", () => {
  it("한글 1자는 3바이트다", () => {
    expect(countNeisBytes("한")).toBe(3);
    expect(countNeisBytes("학생")).toBe(6);
    expect(countNeisBytes("ㄱ")).toBe(3);
  });

  it("영문과 숫자는 1바이트다", () => {
    expect(countNeisBytes("A")).toBe(1);
    expect(countNeisBytes("abc")).toBe(3);
    expect(countNeisBytes("12")).toBe(2);
  });

  it("줄바꿈은 1바이트다", () => {
    expect(countNeisBytes("가\n나")).toBe(7);
    expect(countNeisBytes("가\r\n나")).toBe(7);
    expect(countNeisBytes("\n")).toBe(1);
  });

  it("공백은 1바이트로 가정한다", () => {
    expect(countNeisBytes(" ")).toBe(1);
    expect(countNeisBytes("가 나")).toBe(7);
    expect(countNeisBytes("a b")).toBe(3);
    expect(COUNT_NOTES.some((line) => line.includes("공백") && line.includes("1바이트"))).toBe(true);
  });

  it("영문 문장부호는 1바이트, 한자는 3바이트다", () => {
    expect(countNeisBytes("Hi!")).toBe(3);
    expect(countNeisBytes("韓")).toBe(3);
    expect(countNeisBytes("\u3000")).toBe(3);
  });

  it("한글, 공백, 영문, 문장부호가 섞인 문장을 계산한다", () => {
    const text = "수업 A를 잘함.";
    expect(countChars(text)).toBe(9);
    expect(countNeisBytes(text)).toBe(19);
  });

  it("이모지는 한 글자, 비ASCII라 3바이트다", () => {
    expect(countChars("😀")).toBe(1);
    expect(countNeisBytes("😀")).toBe(3);
  });
});
