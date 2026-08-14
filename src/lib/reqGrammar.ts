/**
 * The requirement-string grammar, shared by both consumers: comma binds
 * loose, slash binds tight, parentheses group. "18.03, 6.041/6.3700"
 * means 18.03 AND (6.041 OR 6.3700). prereqTree.ts (the class-detail
 * tree) and requirements.ts (the fulfillment flag) both split with these
 * helpers, so the two paths cannot disagree on precedence.
 */

/** Split on a separator, ignoring separators inside parentheses. */
export function splitTopLevel(str: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of str) {
    if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
    }
    if (char === separator && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.filter((part) => part !== "");
}

/** Remove parentheses that enclose the whole string, layer by layer. */
export function stripOuterParens(str: string): string {
  while (str.startsWith("(") && str.endsWith(")")) {
    let depth = 0;
    let wraps = true;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "(") {
        depth++;
      } else if (str[i] === ")") {
        depth--;
        if (depth === 0 && i < str.length - 1) {
          wraps = false;
          break;
        }
      }
    }
    if (!wraps) {
      break;
    }
    str = str.slice(1, -1);
  }
  return str;
}

export interface ReqLevel {
  /** "all" for a top-level comma list, "any" for slashes, null for an atom. */
  connective: "all" | "any" | null;
  /** Operands at this level, or the atom itself when connective is null. */
  parts: string[];
  /** The input with whole-string parentheses removed. */
  stripped: string;
}

/**
 * One level of the grammar: strip enclosing parentheses, then split on
 * top-level commas first, top-level slashes second.
 */
export function splitReqLevel(str: string): ReqLevel {
  const stripped = stripOuterParens(str);
  const commaParts = splitTopLevel(stripped, ",");
  if (commaParts.length > 1) {
    return { connective: "all", parts: commaParts, stripped };
  }
  const slashParts = splitTopLevel(stripped, "/");
  if (slashParts.length > 1) {
    return { connective: "any", parts: slashParts, stripped };
  }
  return { connective: null, parts: commaParts, stripped };
}
