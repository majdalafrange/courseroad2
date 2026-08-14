/**
 * Typed FireRoad API client. Centralizes every endpoint the app touches;
 * the implicit `response.data.whatever` contracts of the legacy code are
 * now explicit response types.
 *
 * Framework-free: base URL and token are injected, so tests can stub it.
 */

import axios, { type AxiosResponse } from "axios";
import type {
  AccessInfo,
  FlatRoadContents,
  RequirementNode,
  Road,
  Subject,
} from "./types";

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

  private getSecure<T>(link: string): Promise<AxiosResponse<T>> {
    try {
      return axios.get<T>(this.baseUrl + link, this.authHeaders());
    } catch (err) {
      return Promise.reject(err);
    }
  }

  private postSecure<T>(
    link: string,
    params: unknown,
  ): Promise<AxiosResponse<T>> {
    try {
      return axios.post<T>(this.baseUrl + link, params, this.authHeaders());
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /* ---- public, unauthenticated ---- */

  getFullCatalog(): Promise<AxiosResponse<Subject[]>> {
    return axios.get<Subject[]>(this.baseUrl + "/courses/all?full=true");
  }

  getRequirementsList(): Promise<
    AxiosResponse<Record<string, Omit<import("./types").ReqListEntry, "key">>>
  > {
    return axios.get(this.baseUrl + "/requirements/list_reqs/");
  }

  getProgress(
    reqKey: string,
    roadContents: FlatRoadContents,
  ): Promise<AxiosResponse<RequirementNode>> {
    return axios.post<RequirementNode>(
      this.baseUrl +
        "/requirements/progress/" +
        encodeURIComponent(reqKey) +
        "/",
      roadContents,
    );
  }

  fetchToken(code: string): Promise<AxiosResponse<FetchTokenResponse>> {
    // `code` arrives via this page's own URL query, so it is attacker-
    // choosable; encoding keeps it a single parameter.
    return axios.get<FetchTokenResponse>(
      this.baseUrl + "/fetch_token/?code=" + encodeURIComponent(code),
    );
  }

  /* ---- authenticated ---- */

  verify(): Promise<AxiosResponse<VerifyResponse>> {
    return this.getSecure<VerifyResponse>("/verify/");
  }

  getRoads(): Promise<AxiosResponse<RoadsListResponse>> {
    return this.getSecure<RoadsListResponse>("/sync/roads/");
  }

  getRoad(roadID: string): Promise<AxiosResponse<RoadGetResponse>> {
    return this.getSecure<RoadGetResponse>(
      "/sync/roads/?id=" + encodeURIComponent(roadID),
    );
  }

  syncRoad(road: RoadToSend): Promise<AxiosResponse<SyncRoadResponse>> {
    return this.postSecure<SyncRoadResponse>("/sync/sync_road/", road);
  }

  deleteRoad(roadID: string): Promise<AxiosResponse<unknown>> {
    return this.postSecure("/sync/delete_road/", { id: roadID });
  }

  setSemester(semester: number): Promise<AxiosResponse<{ success: boolean }>> {
    return this.postSecure("/set_semester/", { semester });
  }
}
