// Fetches quickqueck clinical trial data from the remote API with a 30-day
// localStorage cache. The cache is only overwritten on a successful fetch.

// Lookup types

export type QuickqueckLookupEntry = {
    id: number;
    name: string;
    children?: QuickqueckLookupEntry[];
};

export type QuickqueckClinic = {
    id: number;
    group_id: number | null;
    name: string;
    rank: string;
    children?: QuickqueckClinic[];
};

// Age range derived from an age group label

export type AgeRange = {
    min: number | null; // inclusive, in years; null = unbounded
    max: number | null; // inclusive, in years; null = unbounded
};

// Sub-year tokens (Tage, Wochen, Monate) are treated as year 0 for min,
// or ignored for max (returning null), since they don't represent integer ages.
const SUB_YEAR_RE = /Tag|Tage|Woche|Wochen|Monat|Monate|Monaten/i;

function tokenToYears(
    token: string
): { value: number | null; exclusive: boolean } {
    const t = token.trim().replace(/\s*\([^)]*\)\s*$/, ''); // strip "(EU)" etc.
    const exclusive = t.includes('<');
    if (SUB_YEAR_RE.test(t)) return { value: 0, exclusive: false };
    const digits = t.replace(/[<>≥≤=\s]/g, '').replace(/Jahre?$/i, '');
    const n = parseFloat(digits);
    return { value: isNaN(n) ? null : n, exclusive };
}

export function parseAgeRange(name: string): AgeRange {
    const n = name.trim();

    // "ab X Monaten" / "ab X Jahren"
    const abMatch = n.match(/^ab\s+(\d+)\s*(Monat\w*|Jahr\w*)/i);
    if (abMatch) {
        const isMonth = /monat/i.test(abMatch[2]);
        return { min: isMonth ? 0 : parseFloat(abMatch[1]), max: null };
    }

    // Range: split on " - " or "–"
    const parts = n.split(/\s*[-–]\s*/);
    if (parts.length === 2) {
        const lo = tokenToYears(parts[0]);
        const hi = tokenToYears(parts[1]);
        let hiVal = hi.value;
        if (hiVal !== null && hi.exclusive && Number.isInteger(hiVal)) {
            hiVal = Math.max(hiVal - 1, 0);
        }
        if (hiVal !== null) hiVal = Math.max(hiVal, 0);
        return { min: lo.value, max: hiVal };
    }

    // Single bound: ≥X, >X, ≤X, <X
    const singleMatch = n.match(/^([≥≤><]+)\s*(\d+(?:\.\d+)?)\s*(?:Jahre?)?$/i);
    if (singleMatch) {
        const op = singleMatch[1];
        const val = parseFloat(singleMatch[2]);
        if (op === '≥' || op === '>=') return { min: val, max: null };
        if (op === '>' || op === '>>') return { min: val + 1, max: null };
        if (op === '≤' || op === '<=') return { min: 0, max: val };
        if (op === '<') return { min: 0, max: Math.max(val - 1, 0) };
    }

    return { min: null, max: null };
}

// Contact type

export type QuickqueckContact = {
    department?: string; // e.g. "UKF Med.I/ECTU"
    name: string; // e.g. "Dr. K. Shoumariyeh"
    email?: string;
};

// Study type

export type QuickqueckStudy = {
    id: number;
    group: number;
    group_name: string;
    entity: number;
    therapy_line: number;
    age_group: number;
    study_name: string;
    study_linkname: string;
    study_link: string;
    study_number: string;
    phase: number | null;
    criteria: string;
    doctor: string;
    study_assistance: string;
    doctors: QuickqueckContact[];
    assistants: QuickqueckContact[];
    last_modified: string;
};

// --- Full API response ---

export type QuickqueckApiResponse = {
    studies: QuickqueckStudy[];
    clinics: QuickqueckClinic[];
    entities: QuickqueckLookupEntry[];
    phases: QuickqueckLookupEntry[];
    therapy_lines: QuickqueckLookupEntry[];
    age_groups: QuickqueckLookupEntry[];
};

const EMAIL_SCAN_RE = /\(?([A-Za-z0-9._\-%+-]+@[A-Za-z0-9.\-]+\.[A-Za-z]+)\)?/g;
const PHONE_NOISE_RE = /\:?\s*(?:Tel\w*\s*)\:?[\;\d\/\s\-]+\;?\s*/g;
const NUMBER_NOISE_RE = /\:?\s*\d[\d\s\-\/]+\;?/g;

function parseContactList(raw: string): QuickqueckContact[] {
    if (!raw || !raw.trim()) return [];
    raw = raw
        .replace(/\u00ad/g, '-')
        .replace(PHONE_NOISE_RE, '')
        .replace(NUMBER_NOISE_RE, '');

    // Collect positions of all email matches first.
    const emailMatches: Array<{
        email: string;
        start: number;
        end: number;
    }> = [];
    EMAIL_SCAN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = EMAIL_SCAN_RE.exec(raw)) !== null) {
        emailMatches.push({
            email: m[1],
            start: m.index,
            end: EMAIL_SCAN_RE.lastIndex,
        });
    }

    if (emailMatches.length === 0) {
        return [{ name: raw.trim() }];
    }

    return emailMatches.map(({ email, start }, i) => {
        // The name sits between the end of the previous entry and the start of this email.
        const prevEnd = i === 0 ? 0 : emailMatches[i - 1].end;
        const namePart = raw
            .slice(prevEnd, start)
            .replace(/^[\s,]+/, '') // strip leading ", "
            .replace(/\($/, '') // strip leading "("
            .replace(/:\s*$/, '') // strip trailing lone colon
            .trim();

        // If the name contains a colon, split into department + person name.
        // e.g. "UKF Med.I/ECTU: Dr. K. Shoumariyeh" → dept + name
        const colonIdx = namePart.indexOf(':');
        if (colonIdx !== -1) {
            const department = namePart.slice(0, colonIdx).trim();
            const name = namePart.slice(colonIdx + 1).trim();
            return { department, name: name || 'Contact', email };
        }

        return { name: namePart || 'Contact', email };
    });
}

// --- City extraction from clinic names ---

// Words to skip when scanning for a city name.
const CLINIC_NOISE_WORDS = new Set([
    'ukf',
    'uke',
    'ukhd',
    'tum',
    'lmu',
    'uksh',
    'uk',
    'nct',
    'wtz',
    'ucch',
    'ccc',
    'cccf',
    'cccts',
    'cccu',
    'cccm',
    'cccg',
    'cccz',
    'ccc-n',
    'ccc-mv',
    'mcc',
    'uct',
    'utc',
    'uccl',
    'nwtz',
    'rbct',
    'slk',
    'diako',
    'fek',
    'hopa',
    'hope',
    'owl',
    'abcd',
    'g-ccc',
    'umg',
    'umo',
    'campus',
    'netzwerkpartner',
    'klinikum',
    'krankenhaus',
    'brüderkrankenhaus',
    'hospital',
    'universitätsspital',
    'kantonsspital',
    'schwerpunktpraxis',
    'radiochir.',
    'norddeutschl.',
    'am',
    'am urban',
    'urban',
    'r.',
    'd.',
    'isar',
    'onk.',
    'ostholstein-onk.',
]);

// Manual overrides for entries where auto-extraction produces a wrong result.
// Keyed by group_id (the id that matches QuickqueckStudy.group).
export const CLINIC_CITY_OVERRIDES: Record<number, string> = {
    9: 'München', // "CCCM, TUM, Klinikum r. d. Isar" — "Isar" is a river
    49: 'Kiel', // "Saphir Radiochir. Norddeutschl." — no city in name
    50: 'Schwarzwald-Baar', // "Schwarzwald-Baar Klinikum" — region, not a single city
};

export function extractCityFromClinicName(
    name: string,
    groupId: number | null
): string | null {
    // 1. Manual override wins.
    if (groupId !== null && CLINIC_CITY_OVERRIDES[groupId] !== undefined) {
        return CLINIC_CITY_OVERRIDES[groupId];
    }

    // 2. Parenthetical city: "Rems-Murr-Kliniken (Winnenden)"
    const parenMatch = name.match(/\(([^)]+)\)\s*$/);
    if (parenMatch) return parenMatch[1].trim();

    // 3. Flatten commas, scan words right-to-left for the first city-like word.
    const words = name.replace(/,/g, ' ').split(/\s+/);
    for (let i = words.length - 1; i >= 0; i--) {
        const raw = words[i].replace(/[.,;]+$/, '');
        if (!raw) continue;
        if (CLINIC_NOISE_WORDS.has(raw.toLowerCase())) continue;
        // Must start with a capital letter (including German umlauts).
        if (!/^[A-ZÄÖÜ]/.test(raw)) continue;

        // Post-process: adjective form "-er"/"-ner" → base city name
        const adjMatch = raw.match(/^(.+?)n?er$/);
        if (adjMatch && adjMatch[1].length > 2) {
            const base = adjMatch[1];
            // Only strip if the base itself looks like a city (capital start, not a noise word)
            if (
                /^[A-ZÄÖÜ]/.test(base) &&
                !CLINIC_NOISE_WORDS.has(base.toLowerCase())
            ) {
                return base + (raw.endsWith('ner') ? '' : '');
            }
        }

        // Post-process: strip all-caps abbreviation suffix after hyphen
        // e.g. "Erlangen-EMN" → "Erlangen", but keep "Bielefeld-Bethel"
        const hyphenMatch = raw.match(/^([A-ZÄÖÜ][^-]+)-([A-Z]{2,4})$/);
        if (hyphenMatch) return hyphenMatch[1];

        return raw;
    }

    return null;
}

// group_id → city name
export type ClinicCityMap = Record<number, string>;

function buildClinicCityMap(clinics: QuickqueckClinic[]): ClinicCityMap {
    const map: ClinicCityMap = {};
    function visit(clinic: QuickqueckClinic) {
        if (clinic.group_id !== null) {
            const city = extractCityFromClinicName(
                clinic.name,
                clinic.group_id
            );
            if (city) map[clinic.group_id] = city;
        }
        if (clinic.children) clinic.children.forEach(visit);
    }
    clinics.forEach(visit);
    return map;
}

export type QuickqueckLookupMap = Record<number, string>;

// Maps canonical phase display names to the set of phase IDs they cover.
// Combined phases (I/II, II/III) are not shown as separate filter options;
// instead they are matched by each of their constituent single phases.
export const PHASE_FILTER_MAP: Record<string, Set<number>> = {
    I: new Set([8, 9]), // I, I/II
    II: new Set([7, 9, 12]), // II, I/II, II/III
    III: new Set([4, 12]), // III, II/III
    IV: new Set([3]),
    Beobachtungsstudie: new Set([18]),
    NIS: new Set([6]),
    Register: new Set([1]),
};

export const PHASE_FILTER_OPTIONS = [
    'I',
    'II',
    'III',
    'IV',
    'Beobachtungsstudie',
    'NIS',
    'Register',
];

// id → parsed age range
export type AgeRangeMap = Record<number, AgeRange>;

function buildLookupMap(entries: QuickqueckLookupEntry[]): QuickqueckLookupMap {
    const map: QuickqueckLookupMap = {};
    function visit(entry: QuickqueckLookupEntry) {
        map[entry.id] = entry.name;
        if (entry.children) {
            entry.children.forEach(visit);
        }
    }
    entries.forEach(visit);
    return map;
}

// Returns all descendant IDs of a lookup entry (including the entry itself).
export function collectDescendantIds(entry: QuickqueckLookupEntry): number[] {
    const ids: number[] = [entry.id];
    if (entry.children) {
        for (const child of entry.children) {
            ids.push(...collectDescendantIds(child));
        }
    }
    return ids;
}

// Converts the clinic hierarchy into the generic QuickqueckLookupEntry shape
// so it can be used with CollapsibleTreeSelect.
// Virtual grouping nodes (group_id: null) become non-selectable headers (id: -1 * index).
// Their children that have a real group_id become selectable leaf entries.
export function clinicsToLookupEntries(
    clinics: QuickqueckClinic[]
): QuickqueckLookupEntry[] {
    return clinics.map((clinic, i) => {
        const children: QuickqueckLookupEntry[] = (clinic.children ?? []).map(
            (child, j) => clinicsToLookupEntries([child])[0]
        );

        return {
            id: clinic.group_id ?? -(i + 1), // negative sentinel for virtual nodes
            name: clinic.name,
            children: children.length > 0 ? children : undefined,
        };
    });
}

// --- Derived type returned to callers ---

export type QuickqueckData = {
    studies: QuickqueckStudy[];
    entityMap: QuickqueckLookupMap;
    phaseMap: QuickqueckLookupMap;
    therapyLineMap: QuickqueckLookupMap;
    ageGroupMap: QuickqueckLookupMap;
    ageRangeMap: AgeRangeMap;
    clinicCityMap: ClinicCityMap;
    lastUpdated: number;
    // Raw hierarchical lists for building grouped dropdowns.
    rawEntities: QuickqueckLookupEntry[];
    rawClinicsAsEntries: QuickqueckLookupEntry[]; // clinics normalised for CollapsibleTreeSelect
};

// --- Cache constants ---

const cacheKey = 'quickqueck_data';
const cacheTimestampKey = 'quickqueck_timestamp';
const cacheMaxAgeMs = 14 * 24 * 60 * 60 * 1000; // biweekly update to match MTB rhythm in UKF
const fetchUrl = '/quickqueck/search/json/';

function buildQuickqueckData(
    raw: QuickqueckApiResponse,
    date: number
): QuickqueckData {
    const ageRangeMap: AgeRangeMap = {};
    for (const ag of raw.age_groups) {
        ageRangeMap[ag.id] = parseAgeRange(ag.name);
    }
    return {
        studies: raw.studies.map(s => ({
            ...s,
            doctors: parseContactList(s.doctor),
            assistants: parseContactList(s.study_assistance),
        })),
        entityMap: buildLookupMap(raw.entities),
        phaseMap: buildLookupMap(raw.phases),
        therapyLineMap: buildLookupMap(raw.therapy_lines),
        ageGroupMap: buildLookupMap(raw.age_groups),
        ageRangeMap,
        clinicCityMap: buildClinicCityMap(raw.clinics),
        lastUpdated: date,
        rawEntities: raw.entities,
        rawClinicsAsEntries: clinicsToLookupEntries(raw.clinics),
    };
}

export const getQuickqueckData = async (): Promise<QuickqueckData> => {
    const cachedRaw = localStorage.getItem(cacheKey);
    const cachedTimestamp = localStorage.getItem(cacheTimestampKey);

    const now = Date.now();
    const isCacheValid =
        cachedRaw !== null &&
        cachedTimestamp !== null &&
        now - Number(cachedTimestamp) < cacheMaxAgeMs;

    if (isCacheValid) {
        // Cache stores the full API response so lookups survive page reload.
        return buildQuickqueckData(
            JSON.parse(cachedRaw!) as QuickqueckApiResponse,
            Number(cachedTimestamp)
        );
    }

    // Cache is missing or stale — attempt to fetch fresh data
    try {
        const res = await fetch(fetchUrl);
        if (!res.ok) {
            throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
        }
        const data: QuickqueckApiResponse = await res.json();
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(cacheTimestampKey, String(now));
        return buildQuickqueckData(data, now);
    } catch (err) {
        if (cachedRaw !== null) {
            // Fetch failed but stale cache exists — return it without overwriting
            return buildQuickqueckData(
                JSON.parse(cachedRaw!) as QuickqueckApiResponse,
                Number(cachedTimestamp)
            );
        }
        throw err;
    }
};
