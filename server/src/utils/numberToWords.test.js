import { describe, it, expect } from "vitest";
import { numberToIndianWords } from "./numberToWords.js";

describe("numberToIndianWords", () => {
  it("matches a real payslip's net-pay wording", () => {
    expect(numberToIndianWords(50368)).toBe("Fifty Thousand Three Hundred and Sixty Eight Rupees only");
  });

  it("handles zero", () => {
    expect(numberToIndianWords(0)).toBe("Zero Rupees only");
  });

  it("uses Indian lakh/crore grouping", () => {
    expect(numberToIndianWords(100000)).toBe("One Lakh Rupees only");
    expect(numberToIndianWords(1234567)).toBe("Twelve Lakh Thirty Four Thousand Five Hundred and Sixty Seven Rupees only");
    expect(numberToIndianWords(10000001)).toBe("One Crore One Rupees only");
  });

  it("drops the paise (integer part only)", () => {
    expect(numberToIndianWords(1000.75)).toBe("One Thousand Rupees only");
  });
});
