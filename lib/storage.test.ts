import { describe, expect, it } from "vitest";
import { sniff } from "./storage";

const B = (...a: number[]) => Buffer.from(a);

describe("sniff (magic-byte upload guard)", () => {
  it("accepts real files by content, not claimed type", () => {
    expect(sniff(Buffer.from("%PDF-1.4"))?.ext).toBe("pdf");
    expect(sniff(B(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
    expect(sniff(B(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe("png");
    expect(
      sniff(Buffer.concat([Buffer.from("RIFF"), B(0, 0, 0, 0), Buffer.from("WEBP")]))?.ext,
    ).toBe("webp");
  });

  it("rejects junk that lies about its type (octet-stream bypass)", () => {
    expect(sniff(Buffer.from("not a real file"))).toBeNull();
    expect(sniff(B(0x00, 0x01, 0x02, 0x03))).toBeNull();
  });
});
