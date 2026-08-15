/**
 * Live consequence analysis: given a subject, which classes on the road
 * feed it (prerequisite ancestors) and which does it feed (dependents)?
 * Powers the canvas's hover/drag illumination.
 */

import type { CatalogView, SelectedSubject, Subject } from "./types";
import { getSubject } from "./types";
import { classSatisfies } from "./requirements";

/** Location key for a placed class: "<semester>:<index>". */
export function placedKey(semester: number, index: number): string {
  return `${semester}:${index}`;
}

/**
 * Extract the requirement tokens (subject ids / GIR:... / HASS-... / CI-...)
 * from a FireRoad requirement string, dropping punctuation and quoted
 * free-text requirements.
 */
export function requirementTokens(reqString: string | undefined): string[] {
  if (reqString === undefined) {
    return [];
  }
  return reqString
    .replace(/''/g, '"')
    .split(/[(),/]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && token.indexOf('"') === -1);
}

export interface Consequences {
  /** Road classes that satisfy one of the subject's prereq/coreq tokens. */
  ancestors: Set<string>;
  /** Road classes that list this subject among their prereq/coreq tokens. */
  dependents: Set<string>;
}

/**
 * Compute the prerequisite ancestors and dependents of `subject` among
 * the placed classes. O(tokens × classes) with cheap checks; fast
 * enough to run synchronously on hover for a full 16-term road.
 */
export function computeConsequences(
  subject: Subject,
  selectedSubjects: SelectedSubject[][],
  catalog: CatalogView,
): Consequences {
  const ancestors = new Set<string>();
  const dependents = new Set<string>();

  const ownTokens = [
    ...requirementTokens(subject.prerequisites),
    ...requirementTokens(subject.corequisites),
  ];

  for (let semester = 0; semester < selectedSubjects.length; semester++) {
    const bucket = selectedSubjects[semester];
    for (let index = 0; index < bucket.length; index++) {
      const placed = bucket[index];
      if (placed.public === false) {
        continue; // custom activities have no prereq relationships
      }
      if (placed.subject_id === subject.subject_id) {
        continue;
      }
      const key = placedKey(semester, index);

      // Ancestor: the placed class satisfies one of our tokens.
      if (
        ownTokens.some((token) =>
          classSatisfies(catalog, token, placed.subject_id, [
            placed.subject_id,
          ]),
        )
      ) {
        ancestors.add(key);
      }

      // Dependent: we satisfy one of the placed class's tokens.
      const placedInfo = getSubject(catalog, placed.subject_id);
      if (placedInfo !== undefined) {
        const placedTokens = [
          ...requirementTokens(placedInfo.prerequisites),
          ...requirementTokens(placedInfo.corequisites),
        ];
        if (
          placedTokens.some((token) =>
            classSatisfies(catalog, token, subject.subject_id, [
              subject.subject_id,
            ]),
          )
        ) {
          dependents.add(key);
        }
      }
    }
  }

  return { ancestors, dependents };
}
