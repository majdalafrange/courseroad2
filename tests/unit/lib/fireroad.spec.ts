import { afterEach, describe, expect, it, vi } from "vitest";
import { FireRoadClient, NoAuthError } from "../../../src/lib/fireroad";
import type { RoadToSend } from "../../../src/lib/fireroad";

/**
 * Pins the FireRoad wire surface: endpoint paths, query encoding, the
 * auth header shape, and the no-token failure mode. A green suite after
 * an edit here means the bytes leaving the app are unchanged; changing
 * any assertion is a deliberate API-compatibility decision.
 */

const BASE = "https://fireroad.mit.edu";

function makeClient(token = "tok123"): FireRoadClient {
  return new FireRoadClient(BASE, () => token);
}

/** A minimal Response-like object, matching what fetch() resolves to. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const mockedFetch = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", mockedFetch);

afterEach(() => {
  vi.resetAllMocks();
});

describe("FireRoadClient endpoint bytes", () => {
  it("builds the login URL with the redirect passed through verbatim", () => {
    // The redirect is the app's own VITE_URL build constant, never user
    // input; its bytes are pinned because FireRoad's login flow was
    // registered against exactly this shape.
    expect(makeClient().loginUrl("http://localhost:8080")).toBe(
      "https://fireroad.mit.edu/login/?redirect=http://localhost:8080",
    );
  });

  it("fetches the full catalog from /courses/all?full=true", () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse([]));
    void makeClient().getFullCatalog();
    expect(mockedFetch).toHaveBeenCalledWith(
      "https://fireroad.mit.edu/courses/all?full=true",
      { method: "GET", headers: undefined },
    );
  });

  it("fetches the requirements list from /requirements/list_reqs/", () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse({}));
    void makeClient().getRequirementsList();
    expect(mockedFetch).toHaveBeenCalledWith(
      "https://fireroad.mit.edu/requirements/list_reqs/",
      { method: "GET", headers: undefined },
    );
  });

  it("posts road contents to /requirements/progress/<key>/", () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse({}));
    const contents = {
      coursesOfStudy: [],
      selectedSubjects: [],
      progressOverrides: {},
      progressAssertions: {},
    };
    void makeClient().getProgress("major6", contents);
    expect(mockedFetch).toHaveBeenCalledWith(
      "https://fireroad.mit.edu/requirements/progress/major6/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contents),
      },
    );
  });

  it("percent-encodes the requirement key in the progress path", () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse({}));
    void makeClient().getProgress("a/b c", {
      coursesOfStudy: [],
      selectedSubjects: [],
      progressOverrides: {},
      progressAssertions: {},
    });
    expect(mockedFetch).toHaveBeenCalledWith(
      "https://fireroad.mit.edu/requirements/progress/a%2Fb%20c/",
      expect.anything(),
    );
  });

  it("percent-encodes the OIDC code in /fetch_token/", () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse({ success: true }));
    void makeClient().fetchToken("abc&code=evil");
    expect(mockedFetch).toHaveBeenCalledWith(
      "https://fireroad.mit.edu/fetch_token/?code=abc%26code%3Devil",
      { method: "GET", headers: undefined },
    );
  });

  it("sends the bearer token on every authenticated GET", () => {
    mockedFetch.mockImplementation(async () =>
      jsonResponse({ success: true }),
    );
    const client = makeClient("secret");
    void client.verify();
    void client.getRoads();
    void client.getRoad("$defaultroad$");
    expect(mockedFetch.mock.calls).toEqual([
      [
        "https://fireroad.mit.edu/verify/",
        { method: "GET", headers: { Authorization: "Bearer secret" } },
      ],
      [
        "https://fireroad.mit.edu/sync/roads/",
        { method: "GET", headers: { Authorization: "Bearer secret" } },
      ],
      [
        "https://fireroad.mit.edu/sync/roads/?id=%24defaultroad%24",
        { method: "GET", headers: { Authorization: "Bearer secret" } },
      ],
    ]);
  });

  it("posts sync, delete, and semester to their legacy paths", () => {
    mockedFetch.mockImplementation(async () =>
      jsonResponse({ success: true }),
    );
    const client = makeClient();
    const road = { override: false, agent: "t" } as RoadToSend;
    void client.syncRoad(road);
    void client.deleteRoad("12345");
    void client.setSemester(7);
    expect(mockedFetch.mock.calls).toEqual([
      [
        "https://fireroad.mit.edu/sync/sync_road/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer tok123",
          },
          body: JSON.stringify(road),
        },
      ],
      [
        "https://fireroad.mit.edu/sync/delete_road/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer tok123",
          },
          body: JSON.stringify({ id: "12345" }),
        },
      ],
      [
        "https://fireroad.mit.edu/set_semester/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer tok123",
          },
          body: JSON.stringify({ semester: 7 }),
        },
      ],
    ]);
  });

  it("rejects (not throws) with NoAuthError when no token is present", async () => {
    // authHeaders() throws synchronously during argument evaluation; the
    // try/catch in getSecure/postSecure converts that into a rejected
    // promise so callers have one failure channel.
    // Not makeClient(undefined): an explicit undefined argument would
    // trigger the default token parameter.
    const client = new FireRoadClient(BASE, () => undefined);
    await expect(client.verify()).rejects.toBeInstanceOf(NoAuthError);
    await expect(client.syncRoad({} as RoadToSend)).rejects.toBeInstanceOf(
      NoAuthError,
    );
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("rejects with an axios-shaped error on a non-2xx response", async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse({ error: "bad key" }, 400),
    );
    await expect(makeClient().getProgress("bogus", {
      coursesOfStudy: [],
      selectedSubjects: [],
      progressOverrides: {},
      progressAssertions: {},
    })).rejects.toMatchObject({
      response: { status: 400, data: { error: "bad key" } },
    });
  });
});
