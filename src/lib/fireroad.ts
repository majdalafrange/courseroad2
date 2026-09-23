/**
 * Typed FireRoad API client, centralizing every endpoint the app touches.
 * Base URL and token are injected so tests can stub it.
 */

import type {
  AccessInfo,
  FlatRoadContents,
  RequirementNode,
  Road,
  Subject,
} from "./types";

export interface HttpResponse<T> {
  data: T;
  status: number;
}

/**
 * Mirrors axios's default behavior (reject on non-2xx, with the status and
 * parsed body on `.response`) since callers (auth.ts, degreeFit.ts) branch
 * on `err.response.status`/`err.response.data`.
 */
export class HttpError extends Error {
  response: { status: number; data: unknown };
  constructor(status: number, data: unknown) {
    super(`Request failed with status ${status}`);
    this.response = { status, data };
  }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function httpGet<T>(
  url: string,
  config?: { headers?: Record<string, string> },
): Promise<HttpResponse<T>> {
  const res = await fetch(url, { method: "GET", headers: config?.headers });
  const data = await parseBody(res);
  if (!res.ok) {
    throw new HttpError(res.status, data);
  }
  return { data: data as T, status: res.status };
}

async function httpPost<T>(
  url: string,
  body: unknown,
  config?: { headers?: Record<string, string> },
): Promise<HttpResponse<T>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...config?.headers },
    body: JSON.stringify(body),
  });
  const data = await parseBody(res);
  if (!res.ok) {
    throw new HttpError(res.status, data);
  }
  return { data: data as T, status: res.status };
}

export interface FetchTokenResponse {
  success: boolean;
  access_info: AccessInfo;
}

export interface VerifyResponse {
  success: boolean;
  current_semester: number;
  academic_id?: string;
  username?: string;
}

export interface RoadsListResponse {
  success: boolean;
  files: Record<string, { name: string; agent: string; changed: string }>;
}

export interface RoadGetResponse {
  success: boolean;
  file: Road;
}

export interface SyncRoadResponse {
  success?: boolean;
  error_msg?: string;
  result?: "conflict" | "update_local" | "update_remote" | "no_change";
  id?: number | string;
  // conflict payload
  other_name?: string;
  other_agent?: string;
  other_date?: string;
  other_contents?: FlatRoadContents;
  this_agent?: string;
  this_date?: string;
  // update_local payload
  changed?: string;
  name?: string;
  contents?: FlatRoadContents;
}

/** Road payload sent to /sync/sync_road/. */
export interface RoadToSend extends Omit<Road, "contents"> {
  contents: FlatRoadContents;
  override: boolean;
  agent: string;
  id?: string;
}

/** The student's notes, keyed by subject id (/prefs/notes/). */
export type SubjectNotes = Record<string, string>;

export interface NotesResponse {
  success: boolean;
  /** Present when success is true. */
  notes?: SubjectNotes;
  error?: string;
}

export class NoAuthError extends Error {
  constructor() {
    super("No auth information");
  }
}

export class FireRoadClient {
  private baseUrl: string;
  private getToken: () => string | undefined;

  constructor(baseUrl: string, getToken: () => string | undefined) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
  }

  /** URL to send the browser to for MIT OIDC login. */
  loginUrl(redirect: string): string {
    return `${this.baseUrl}/login/?redirect=${redirect}`;
  }

  private authHeaders() {
    const token = this.getToken();
    if (token === undefined) {
      throw new NoAuthError();
    }
    return { headers: { Authorization: "Bearer " + token } };
  }

  private getSecure<T>(link: string): Promise<HttpResponse<T>> {
    try {
      return httpGet<T>(this.baseUrl + link, this.authHeaders());
    } catch (err) {
      return Promise.reject(err);
    }
  }

  private postSecure<T>(
    link: string,
    params: unknown,
  ): Promise<HttpResponse<T>> {
    try {
      return httpPost<T>(this.baseUrl + link, params, this.authHeaders());
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /* ---- public, unauthenticated ---- */

  getFullCatalog(): Promise<HttpResponse<Subject[]>> {
    return httpGet<Subject[]>(this.baseUrl + "/courses/all?full=true");
  }

  getRequirementsList(): Promise<
    HttpResponse<Record<string, Omit<import("./types").ReqListEntry, "key">>>
  > {
    return httpGet(this.baseUrl + "/requirements/list_reqs/");
  }

  getProgress(
    reqKey: string,
    roadContents: FlatRoadContents,
  ): Promise<HttpResponse<RequirementNode>> {
    return httpPost<RequirementNode>(
      this.baseUrl +
        "/requirements/progress/" +
        encodeURIComponent(reqKey) +
        "/",
      roadContents,
    );
  }

  fetchToken(code: string): Promise<HttpResponse<FetchTokenResponse>> {
    // `code` arrives via this page's own URL query, so it is attacker-
    // choosable; encoding keeps it a single parameter.
    return httpGet<FetchTokenResponse>(
      this.baseUrl + "/fetch_token/?code=" + encodeURIComponent(code),
    );
  }

  /* ---- authenticated ---- */

  verify(): Promise<HttpResponse<VerifyResponse>> {
    return this.getSecure<VerifyResponse>("/verify/");
  }

  getRoads(): Promise<HttpResponse<RoadsListResponse>> {
    return this.getSecure<RoadsListResponse>("/sync/roads/");
  }

  getRoad(roadID: string): Promise<HttpResponse<RoadGetResponse>> {
    return this.getSecure<RoadGetResponse>(
      "/sync/roads/?id=" + encodeURIComponent(roadID),
    );
  }

  syncRoad(road: RoadToSend): Promise<HttpResponse<SyncRoadResponse>> {
    return this.postSecure<SyncRoadResponse>("/sync/sync_road/", road);
  }

  deleteRoad(roadID: string): Promise<HttpResponse<unknown>> {
    return this.postSecure("/sync/delete_road/", { id: roadID });
  }

  setSemester(semester: number): Promise<HttpResponse<{ success: boolean }>> {
    return this.postSecure("/set_semester/", { semester });
  }

  getNotes(): Promise<HttpResponse<NotesResponse>> {
    return this.getSecure<NotesResponse>("/prefs/notes/");
  }

  /**
   * Replaces every stored note: the body is the whole map, not a change
   * to one subject (the server stores the JSON as given).
   */
  setNotes(
    notes: SubjectNotes,
  ): Promise<HttpResponse<{ success: boolean; error?: string }>> {
    return this.postSecure("/prefs/set_notes/", notes);
  }
}
