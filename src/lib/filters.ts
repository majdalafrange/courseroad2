/**
 * Generic subject-filter engine (Regex / Math-range / Boolean / Array
 * filters over arbitrary attributes, composable in AND/OR groups), plus
 * the concrete search filters the UI uses (GIR/HASS/CI/Level/Units/Term/
 * Virtual and the text/instructor filters).
 *
 * Ported from utilities/filters.js + ClassSearch.vue with identical
 * matching and ranking semantics (pinned by tests/unit/filter/*).
 */

type CombineMode = "AND" | "OR";
type Combiner = (a: boolean, b: boolean) => boolean;

const COMBINERS: Record<CombineMode, Combiner> = {
  AND: (a, b) => a && b,
  OR: (a, b) => a || b,
};

/** Inputs object passed to setupInputs (e.g. { nameInput: "6.00" }). */
export type FilterInputs = Record<string, string>;

// The filter engine inspects arbitrary subject attributes by name.
type AttributeBag = Record<string, unknown>;

/**
 * View a typed subject as an attribute bag. Interfaces are not assignable
 * to Record<string, unknown> in TS, so the engine's callers name the
 * boundary here once instead of casting at every call site.
 */
export function toAttributeBag(subject: object): AttributeBag {
  return subject as AttributeBag;
}

export class Filter<V = unknown> {
  name: string;
  short: string;
  filter: (value: V) => boolean;
  attributes: string[];
  combine: Combiner;

  /**
   * name: long name for the filter
   * shortName: short display name
   * filter: predicate evaluated on a subject's attribute values
   * attributeNames: attributes on the subject to test
   * mode: 'AND' if all attributes must match, 'OR' if any (default OR)
   */
  constructor(
    name: string,
    shortName: string,
    filter: (value: V) => boolean,
    attributeNames: string[],
    mode: CombineMode = "OR",
  ) {
    this.name = name;
    this.short = shortName;
    this.filter = filter;
    this.attributes = attributeNames;
    this.combine = COMBINERS[mode];
  }

  /** Adjust the filter from inputs (no-op for the base class). */
  setupInputs(_inputs: FilterInputs): void {}

  /**
   * Test one raw attribute value against the predicate. The engine reads
   * untyped attribute bags, so this cast is the one typed boundary; a
   * predicate given the wrong runtime shape falls back on JS coercion,
   * which is the legacy engine's documented behavior.
   */
  testValue(value: unknown): boolean {
    return this.filter(value as V);
  }

  /** Test if a subject matches (OR: any attribute; AND: all attributes). */
  matches(subject: AttributeBag): boolean {
    // starting value of true for and, false for or
    let isMatch = !this.combine(true, false);
    for (let a = 0; a < this.attributes.length; a++) {
      const attribute = this.attributes[a];
      isMatch = this.combine(isMatch, this.testValue(subject[attribute]));
    }
    return isMatch;
  }
}

export class RegexFilter extends Filter<string> {
  regex: string;
  originalFilter: (value: string) => boolean;
  /** Input key required to extend the regex (e.g. "nameInput"). */
  requires?: string;
  priorities?: ((value: string) => boolean)[];
  priorityIndexMap?: number[];

  constructor(
    name: string,
    shortName: string,
    regex: string,
    requires: string | undefined,
    attributeNames: string[],
    mode?: CombineMode,
  ) {
    const testFunction = RegexFilter.getRegexTestFunction(regex);
    super(name, shortName, testFunction, attributeNames, mode);
    this.regex = regex;
    this.originalFilter = testFunction;
    this.requires = requires;
  }

  /** Escape all regex special characters in a string. */
  static escapeRegex(regex: string): string {
    return regex.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Longest input compiled as a live pattern; longer inputs match as
   * escaped literals. Short pathological patterns stay possible but are
   * bounded by short haystacks (subject ids and titles); the cap guards
   * against pasted input long enough to make backtracking hang the tab.
   */
  static readonly MAX_REGEX_INPUT = 128;

  /** Construct a regex, falling back to the escaped literal if invalid. */
  static constructRegex(regex: string): RegExp {
    if (regex.length > RegexFilter.MAX_REGEX_INPUT) {
      return new RegExp(RegexFilter.escapeRegex(regex), "i");
    }
    try {
      return new RegExp(regex, "i");
    } catch {
      // If a regex cannot be constructed, default to matching the literal
      return new RegExp(RegexFilter.escapeRegex(regex), "i");
    }
  }

  /** Test function for regex + optional addon, undefined-safe. */
  static getRegexTestFunction(
    regex: string,
    addon?: string,
  ): (value: string) => boolean {
    let regexObject = RegexFilter.constructRegex(regex);
    if (addon !== undefined) {
      const addonObject = RegexFilter.constructRegex(addon);
      regexObject = new RegExp(regexObject.source + addonObject.source, "i");
    }
    // Regex test function only works when bound to the regex object
    return regexObject.test.bind(regexObject) as (value: string) => boolean;
  }

  setupInputs(inputs: FilterInputs): void {
    if (this.requires !== undefined) {
      const regexAddOn = inputs[this.requires];
      this.filter = RegexFilter.getRegexTestFunction(this.regex, regexAddOn);
    } else {
      this.filter = this.originalFilter;
    }
  }

  /**
   * Build ranked match-variant test functions (literal vs regex, prefix vs
   * anywhere) used to order search results. See legacy docs for details.
   */
  setupVariants(
    inputs: FilterInputs,
    priorityDirections: Record<string, boolean>,
    priorityOrder: string[],
  ): void {
    const atStart = (regex: string) => "^" + regex;
    const asLiteral = (regex: string) => RegexFilter.escapeRegex(regex);
    const priorityFunctions: Record<string, (regex: string) => string> = {
      atStart,
      asLiteral,
    };
    // Order to apply functions (must add ^ after escaping, for example)
    const applicationOrder = ["asLiteral", "atStart"];

    let regexAddOn = "";
    if (this.requires !== undefined) {
      regexAddOn = inputs[this.requires];
    }
    const regex = this.regex + regexAddOn;

    // Create list of different combinations of functions to apply
    // Prioritized functions last; which priority to consider first by priority order
    const regexPriorities: string[][] = [[]];
    let indexMap = [0];

    priorityOrder.reverse();
    for (let p = 0; p < priorityOrder.length; p++) {
      const isPrioritized = priorityDirections[priorityOrder[p]];
      const arrayWithPriority = regexPriorities.map((funcNames) =>
        funcNames.concat([priorityOrder[p]]),
      );
      regexPriorities.push(...arrayWithPriority);
      const priorityIndices = indexMap.map((i) => i + indexMap.length);
      // If this priority is prioritized, give it higher ranks (later indices)
      if (isPrioritized) {
        indexMap.push(...priorityIndices);
      } else {
        priorityIndices.push(...indexMap);
        indexMap = priorityIndices;
      }
    }

    this.priorities = regexPriorities
      .map((priorityFuncs) =>
        priorityFuncs
          .sort(
            (a, b) => applicationOrder.indexOf(a) - applicationOrder.indexOf(b),
          )
          .reduce((acc, func) => priorityFunctions[func](acc), regex),
      )
      .map((r) => RegexFilter.getRegexTestFunction(r));
    this.priorityIndexMap = indexMap;
  }

  /**
   * Rank a subject by the best match variant it satisfies (-1 = none).
   */
  compareByVariants(subject: AttributeBag): number {
    let orders: number[] = [];
    for (let a = 0; a < this.attributes.length; a++) {
      const matches = (this.priorities ?? []).map((test) =>
        test(subject[this.attributes[a]] as string),
      );
      orders.push(matches.lastIndexOf(true));
    }
    orders = orders.map((order) =>
      order === -1 ? -1 : (this.priorityIndexMap ?? [])[order],
    );
    return Math.max(...orders);
  }
}

export class MathFilter extends Filter<number> {
  /**
   * range: [lower, upper] (undefined = unbounded); inclusive: whether
   * values equal to a bound pass.
   */
  constructor(
    name: string,
    shortName: string,
    range: [number | undefined, number | undefined],
    inclusive: boolean,
    attributeNames: string[],
    mode?: CombineMode,
  ) {
    const comparator = function (input: number) {
      if (
        (range[0] === undefined || input > range[0]) &&
        (range[1] === undefined || input < range[1])
      ) {
        return true;
      } else if (inclusive && (input === range[0] || input === range[1])) {
        return true;
      }
      return false;
    };
    super(name, shortName, comparator, attributeNames, mode);
  }
}

export class BooleanFilter extends Filter<boolean> {
  /** negated: true passes false attributes, false passes true ones. */
  constructor(
    name: string,
    shortName: string,
    negated: boolean,
    attributeNames: string[],
    mode?: CombineMode,
  ) {
    const match = (input: boolean) => input === !negated;
    super(name, shortName, match, attributeNames, mode);
  }
}

export class FilterGroup {
  name: string;
  filters: AnyFilter[];
  combine: Combiner;

  /** combination: 'AND' if all active filters must match, 'OR' if any. */
  constructor(name: string, filters: AnyFilter[], combination: CombineMode) {
    this.name = name;
    this.filters = filters;
    this.combine = COMBINERS[combination];
  }

  /**
   * Test a subject against the active filters in this group (`active[i]`
   * is whether filter i is on). True if no filters are active.
   */
  matches(subject: AttributeBag, active: boolean[]): boolean {
    if (!active.some((a) => a)) {
      return true;
    }
    const baseCombinationValue = !this.combine(true, false);
    let isMatch = baseCombinationValue;
    for (let f = 0; f < this.filters.length; f++) {
      if (active[f]) {
        isMatch = this.combine(isMatch, this.filters[f].matches(subject));
        if (isMatch !== baseCombinationValue) {
          return isMatch;
        }
      }
    }
    return isMatch;
  }
}

/**
 * Any filter regardless of its value type. `never` is the correct
 * supertype here: a Filter<V> consumes V, so contravariance makes every
 * Filter<V> assignable to Filter<never>. Callers hand values through
 * testValue, which owns the boundary cast.
 */
export type AnyFilter = Filter<never>;

/**
 * Constructor shape ArrayFilter can wrap: name and short name first,
 * then subfilter-specific arguments, then attributeNames and mode. The
 * never[] rest accepts every concrete subclass constructor (each
 * parameter type accepts never), which is exactly the forwarding
 * contract; the spread cast in ArrayFilter is its runtime half.
 */
type SubfilterConstructor = new (
  name: string,
  shortName: string,
  ...args: never[]
) => AnyFilter;

export class ArrayFilter extends Filter<never> {
  subfilter: AnyFilter;

  /** Matches when any element of an array attribute matches the subfilter. */
  constructor(
    name: string,
    shortName: string,
    SubfilterType: SubfilterConstructor,
    subfilterArguments: unknown[],
    attributeNames: string[],
    mode?: CombineMode,
  ) {
    const subfilter = new SubfilterType(
      name,
      shortName,
      ...(subfilterArguments as never[]),
      ...([attributeNames, mode] as never[]),
    );
    const comparator = subfilter.filter;
    super(name, shortName, comparator, attributeNames, mode);
    this.subfilter = subfilter;
  }

  matches(subject: AttributeBag): boolean {
    // starting value of true for and, false for or
    let isMatch = !this.combine(true, false);
    for (let a = 0; a < this.attributes.length; a++) {
      const attribute = this.attributes[a];
      if (Array.isArray(subject[attribute])) {
        // The whole array is handed to the subfilter's predicate; a regex
        // subfilter matches via the array's string form. Legacy behavior.
        isMatch = this.combine(
          isMatch,
          this.subfilter.testValue(subject[attribute]),
        );
      } else {
        isMatch = false;
      }
    }
    return isMatch;
  }

  setupInputs(inputs: FilterInputs): void {
    this.subfilter.setupInputs(inputs);
  }
}

/* ------------------------------------------------------------------ *
 * Concrete search filters (formerly defined inline in ClassSearch.vue)
 * ------------------------------------------------------------------ */

export const textFilter = new RegexFilter(
  "Subject ID",
  "ID",
  "",
  "nameInput",
  ["subject_id", "title", "old_id"],
  "OR",
);

export const instructorFilter = new ArrayFilter(
  "Instructor",
  "Prof",
  RegexFilter,
  ["", "nameInput"],
  ["instructors"],
  "OR",
);

/** The seven filter groups of the search UI, in display order. */
export function buildSearchFilterGroups(): Record<string, FilterGroup> {
  return {
    girs: new FilterGroup(
      "GIR",
      [
        new RegexFilter("GIR:Any", "Any", ".+", undefined, ["gir_attribute"]),
        new RegexFilter("GIR:Lab", "Lab", ".*(LAB|LAB2).*", undefined, [
          "gir_attribute",
        ]),
        new RegexFilter("GIR:REST", "REST", ".*(REST|RST2).*", undefined, [
          "gir_attribute",
        ]),
      ],
      "OR",
    ),
    hass: new FilterGroup(
      "HASS",
      [
        new RegexFilter("HASS:Any", "Any", "HASS", undefined, [
          "hass_attribute",
        ]),
        new RegexFilter("HASS-A", "A", "HASS-A", undefined, ["hass_attribute"]),
        new RegexFilter("HASS-S", "S", "HASS-S", undefined, ["hass_attribute"]),
        new RegexFilter("HASS-H", "H", "HASS-H", undefined, ["hass_attribute"]),
        new RegexFilter("HASS-E", "E", "HASS-E", undefined, ["hass_attribute"]),
      ],
      "OR",
    ),
    ci: new FilterGroup(
      "CI",
      [
        new RegexFilter("CI:Any", "Any", "CI.+", undefined, [
          "communication_requirement",
        ]),
        new RegexFilter("CI-H", "CI-H", "CI-H", undefined, [
          "communication_requirement",
        ]),
        new RegexFilter("CI-HW", "CI-HW", "CI-HW", undefined, [
          "communication_requirement",
        ]),
        new RegexFilter("Not CI", "None", "^(?!CI)", undefined, [
          "communication_requirement",
        ]),
      ],
      "OR",
    ),
    level: new FilterGroup(
      "Level",
      [
        new RegexFilter("Undergraduate", "UG", "U", undefined, ["level"]),
        new RegexFilter("Graduate", "G", "G", undefined, ["level"]),
      ],
      "OR",
    ),
    units: new FilterGroup(
      "Units",
      [
        new MathFilter("<6", "<6", [undefined, 6], false, ["total_units"]),
        new MathFilter("6", "6", [6, 6], true, ["total_units"]),
        new MathFilter("9", "9", [9, 9], true, ["total_units"]),
        new MathFilter("12", "12", [12, 12], true, ["total_units"]),
        new MathFilter("15", "15", [15, 15], true, ["total_units"]),
        new MathFilter("6-15", "6-15", [6, 15], true, ["total_units"]),
        new MathFilter(">15", ">15", [15, undefined], false, ["total_units"]),
      ],
      "OR",
    ),
    terms: new FilterGroup(
      "Term",
      [
        new BooleanFilter("Fall", "FA", false, ["offered_fall"]),
        new BooleanFilter("IAP", "IAP", false, ["offered_IAP"]),
        new BooleanFilter("Spring", "SP", false, ["offered_spring"]),
      ],
      "OR",
    ),
    virtual: new FilterGroup(
      "Virtual",
      [
        new RegexFilter("Virtual", "Y", "^Virtual$", undefined, [
          "virtual_status",
        ]),
        new RegexFilter("In Person", "N", "^In-Person$", undefined, [
          "virtual_status",
        ]),
        new RegexFilter(
          "Partly Virtual",
          "Both",
          "^Virtual/In-Person$",
          undefined,
          ["virtual_status"],
        ),
      ],
      "OR",
    ),
  };
}

/** Blank "nothing selected" state for the seven filter groups. */
export function emptyChosenFilters(): Record<string, boolean[]> {
  return {
    girs: [false, false, false],
    hass: [false, false, false, false, false],
    ci: [false, false, false, false],
    level: [false, false],
    units: [false, false, false, false, false, false, false],
    terms: [false, false, false],
    virtual: [false, false, false],
  };
}
