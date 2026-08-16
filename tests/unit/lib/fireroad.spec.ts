import { afterEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { FireRoadClient, NoAuthError } from "../../../src/lib/fireroad";
import type { RoadToSend } from "../../../src/lib/fireroad";

vi.mock("axios");

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

const mockedGet = vi.mocked(axios.get);
const mockedPost = vi.mocked(axios.post);

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
    mockedGet.mockResolvedValueOnce({ data: [] });
    void makeClient().getFullCatalog();
    expect(mockedGet).toHaveBeenCalledWith(
      "https://fireroad.mit.edu/courses/all?full=true",
    );
  });

  it("fetches the requirements list from /requirements/list_reqs/", () => {
    mockedGet.mockResolvedValueOnce({ data: {} });
    void makeClient().getRequirementsList();
    expect(mockedGet).toHaveBeenCalledWith(
      "https://fireroad.mit.edu/requirements/list_reqs/",
    );
  });

  it("posts road contents to /requirements/progress/<key>/", () => {
    mockedPost.mockResolvedValueOnce({ data: {} });
    const contents = {
      coursesOfStudy: [],
      selectedSubjects: [],
      progressOverrides: {},
      progressAssertions: {},
    };
    void makeClient().getProgress("major6", contents);
    expect(mockedPost).toHaveBeenCalledWith(
      "https://fireroad.mit.edu/requirements/progress/major6/",
      contents,
    );
  });

  it("percent-encodes the requirement key in the progress path", () => {
    mockedPost.mockResolvedValueOnce({ data: {} });
    void makeClient().getProgress("a/b c", {
      coursesOfStudy: [],
      selectedSubjects: [],
      progressOverrides: {},
      progressAssertions: {},
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "https://fireroad.mit.edu/requirements/progress/a%2Fb%20c/",
      expect.anything(),
    );
  });

  it("percent-encodes the OIDC code in /fetch_token/", () => {
    mockedGet.mockResolvedValueOnce({ data: { success: true } });
    void makeClient().fetchToken("abc&code=evil");
    expect(mockedGet).toHaveBeenCalledWith(
      "https://fireroad.mit.edu/fetch_token/?code=abc%26code%3Devil",
    );
  });

  it("sends the bearer token on every authenticated GET", () => {
    mockedGet.mockResolvedValue({ data: { success: true } });
    const client = makeClient("secret");
    void client.verify();
    void client.getRoads();
    void client.getRoad("$defaultroad$");
    expect(mockedGet.mock.calls).toEqual([
      [
        "https://fireroad.mit.edu/verify/",
        { headers: { Authorization: "Bearer secret" } },
      ],
      [
        "https://fireroad.mit.edu/sync/roads/",
        { headers: { Authorization: "Bearer secret" } },
      ],
      [
        "https://fireroad.mit.edu/sync/roads/?id=%24defaultroad%24",
        { headers: { Authorization: "Bearer secret" } },
      ],
    ]);
  });

  it("posts sync, delete, and semester to their legacy paths", () => {
    mockedPost.mockResolvedValue({ data: { success: true } });
    const client = makeClient();
    const road = { override: false, agent: "t" } as RoadToSend;
    void client.syncRoad(road);
    void client.deleteRoad("12345");
    void client.setSemester(7);
    expect(mockedPost.mock.calls).toEqual([
      [
        "https://fireroad.mit.edu/sync/sync_road/",
        road,
        { headers: { Authorization: "Bearer tok123" } },
      ],
      [
        "https://fireroad.mit.edu/sync/delete_road/",
        { id: "12345" },
        { headers: { Authorization: "Bearer tok123" } },
      ],
      [
        "https://fireroad.mit.edu/set_semester/",
        { semester: 7 },
        { headers: { Authorization: "Bearer tok123" } },
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
    expect(mockedGet).not.toHaveBeenCalled();
    expect(mockedPost).not.toHaveBeenCalled();
  });
});
