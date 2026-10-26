import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeRoomId, sendChatwork } from "./chatwork";

describe("normalizeRoomId", () => {
  it("数字だけ、またはチャットのURLからルームIDを取り出す", () => {
    expect(normalizeRoomId("412345678")).toBe("412345678");
    expect(normalizeRoomId("https://www.chatwork.com/#!rid412345678")).toBe("412345678");
    expect(normalizeRoomId("abc")).toBe("");
  });
});

describe("sendChatwork", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("トークンが無ければ送らない", async () => {
    vi.stubEnv("CHATWORK_API_TOKEN", "");
    expect(await sendChatwork("1", "x")).toBe("no_token");
  });

  it("ルームにメッセージを送る", async () => {
    vi.stubEnv("CHATWORK_API_TOKEN", "tok");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendChatwork("123", "こんにちは")).toBe("sent");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.chatwork.com/v2/rooms/123/messages");
    expect(init.headers["X-ChatWorkToken"]).toBe("tok");
    expect(String(init.body)).toContain("body=");
  });

  it("APIがエラーなら failed", async () => {
    vi.stubEnv("CHATWORK_API_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendChatwork("123", "x")).toBe("failed");
  });
});
