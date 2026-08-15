/**
 * Cookie utility, byte-compatible with the vue-cookies plugin the app
 * used historically (default infinite expiry; objects JSON-stringified on
 * set; values that look like {...} auto-parsed on get; everything else
 * returned as a string). Existing users' cookies must keep working, so
 * the encoding details below mirror vue-cookies 1.7.x exactly.
 */

type CookieValue = string | number | boolean | object;

function escapeKey(key: string): string {
  // encodeURIComponent leaves -.!~*'() unescaped; of those, only the
  // regex metacharacters need a backslash before this becomes part of a
  // RegExp below (get(), isKey()). Parens were missing: a key containing
  // one built an unbalanced/mismatching group.
  return encodeURIComponent(key).replace(/[-.+*()]/g, "\\$&");
}

/** Parse an expires spec like "3d"/"12h" (subset vue-cookies supported). */
function expiresString(expires?: string | number): string {
  if (expires === undefined || expires === Infinity) {
    return "; expires=Fri, 31 Dec 9999 23:59:59 GMT";
  }
  if (typeof expires === "number") {
    return "; max-age=" + expires;
  }
  const match = /^(\d+)([smhd])$/.exec(expires);
  if (match) {
    const seconds =
      parseInt(match[1]) *
      ({ s: 1, m: 60, h: 3600, d: 86400 } as Record<string, number>)[match[2]];
    return "; max-age=" + seconds;
  }
  return "; expires=" + expires;
}

export const cookies = {
  set(key: string, value: CookieValue, expires?: string | number): void {
    const stringValue =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    // SameSite=Lax blunts cross-site sends while still allowing the cookie
    // on the top-level OAuth return navigation; Secure is added only over
    // https so localhost dev (http) can still set cookies. HttpOnly is not
    // settable from JS; moving the token to an HttpOnly server-issued
    // cookie is a separate FireRoad-side hardening.
    const secure =
      typeof location !== "undefined" && location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie =
      encodeURIComponent(key) +
      "=" +
      encodeURIComponent(stringValue) +
      expiresString(expires) +
      "; path=/; SameSite=Lax" +
      secure;
  },

  /** Raw string value, or auto-parsed object for "{...}" values, or null. */
  get(key: string): string | Record<string, unknown> | null {
    const value =
      decodeURIComponent(
        document.cookie.replace(
          new RegExp(
            "(?:(?:^|.*;)\\s*" + escapeKey(key) + "\\s*\\=\\s*([^;]*).*$)|^.*$",
          ),
          "$1",
        ),
      ) || null;
    if (
      value &&
      value.substring(0, 1) === "{" &&
      value.substring(value.length - 1) === "}"
    ) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  },

  isKey(key: string): boolean {
    return new RegExp("(?:^|;\\s*)" + escapeKey(key) + "\\s*\\=").test(
      document.cookie,
    );
  },

  remove(key: string): void {
    document.cookie =
      encodeURIComponent(key) +
      "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  },

  keys(): string[] {
    if (!document.cookie) {
      return [];
    }
    return document.cookie.split(";").map((pair) => {
      return decodeURIComponent(pair.split("=")[0].trim());
    });
  },
};
