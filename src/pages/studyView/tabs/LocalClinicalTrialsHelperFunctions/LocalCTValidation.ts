/**
 * Validation module for localCT.json schema and content.
 * Provides both static validation (schema, syntax) and async validation (genes, clinical attributes).
 */

import { clinicalTrial } from './LocalCT';
import { ClinicalAttribute, Gene } from 'cbioportal-ts-api-client';

export interface LocalCTValidationIssue {
    level: 'error' | 'warning';
    trialName?: string;
    message: string;
}

export interface LocalCTValidationResult {
    valid: boolean;
    trialsCount: number;
    issues: LocalCTValidationIssue[];
}

/**
 * Performs static schema and syntax validation on trials.
 * Does NOT require network calls; validates structure, required fields, and parsing feasibility.
 */
export function validateLocalCTStatic(
    trials: unknown
): LocalCTValidationResult {
    const issues: LocalCTValidationIssue[] = [];

    // Check if trials is an array
    if (!Array.isArray(trials)) {
        return {
            valid: false,
            trialsCount: 0,
            issues: [
                {
                    level: 'error',
                    message: 'Top-level JSON must have a "studies" array.',
                },
            ],
        };
    }

    if (trials.length === 0) {
        return {
            valid: false,
            trialsCount: 0,
            issues: [
                {
                    level: 'error',
                    message: 'No trials defined (empty "studies" array).',
                },
            ],
        };
    }

    // Track uniqueness of trialName (the internal key in matching maps)
    const seenTrialNames = new Set<string>();

    trials.forEach((trial: any, index: number) => {
        const label = trial?.trialName
            ? `Trial "${trial.trialName}"`
            : `Trial #${index + 1}`;

        // Required fields
        if (typeof trial?.trialName !== 'string' || !trial.trialName.trim()) {
            issues.push({
                level: 'error',
                trialName: trial?.trialName || undefined,
                message: `${label}: trialName is required and must be a non-empty string.`,
            });
        }

        if (typeof trial?.trialID !== 'string' || !trial.trialID.trim()) {
            issues.push({
                level: 'error',
                trialName: trial?.trialName || undefined,
                message: `${label}: trialID is required and must be a non-empty string.`,
            });
        }

        // trialSites
        if (
            !Array.isArray(trial?.trialSites) ||
            trial.trialSites.length === 0
        ) {
            issues.push({
                level: 'error',
                trialName: trial?.trialName || undefined,
                message: `${label}: at least one trialSite is required.`,
            });
        }

        // inclusionCriteria
        if (
            !Array.isArray(trial?.inclusionCriteria) ||
            trial.inclusionCriteria.length === 0
        ) {
            issues.push({
                level: 'error',
                trialName: trial?.trialName || undefined,
                message: `${label}: at least one inclusionCriterion is required.`,
            });
        }

        // Check uniqueness of trialName (error if duplicate, as it's a key in internal maps)
        if (trial?.trialName) {
            if (seenTrialNames.has(trial.trialName)) {
                issues.push({
                    level: 'error',
                    trialName: trial?.trialName || undefined,
                    message: `${label}: duplicate trialName (internal matching key must be unique).`,
                });
            } else {
                seenTrialNames.add(trial.trialName);
            }
        }

        // Validate inclusion/exclusion criteria syntax and parseability
        const validateCriteria = (
            criteria: any[],
            criteriaType: 'inclusion' | 'exclusion'
        ) => {
            if (!Array.isArray(criteria)) return;
            criteria.forEach((crit: any, critIdx: number) => {
                if (typeof crit !== 'string' || !crit.trim()) return;

                const parseIssues = validateCriterionSyntax(
                    crit,
                    trial?.trialName || label
                );
                issues.push(
                    ...parseIssues.map(msg => ({
                        level: 'error' as const,
                        trialName: trial?.trialName || undefined,
                        message: `${label}: ${criteriaType} criterion #${critIdx +
                            1} ("${crit.substring(0, 50)}${
                            crit.length > 50 ? '...' : ''
                        }"): ${msg}`,
                    }))
                );
            });
        };

        validateCriteria(trial?.inclusionCriteria, 'inclusion');
        validateCriteria(trial?.exclusionCriteria, 'exclusion');
    });

    return {
        valid: issues.filter(i => i.level === 'error').length === 0,
        trialsCount: trials.length,
        issues,
    };
}

/**
 * Validates syntax of a single criterion string (molecular or clinical).
 * Returns array of error messages (empty if valid).
 */
function validateCriterionSyntax(
    critStr: string,
    trialLabel: string
): string[] {
    const errors: string[] = [];
    const tokens = critStr
        .split(/[,;]+/)
        .map(t => t.trim())
        .filter(Boolean);

    tokens.forEach(token => {
        if (/^clinical:/i.test(token)) {
            // Clinical criterion: Clinical:ParamID:dataType:operator:value
            const parts = splitOnUnescapedColon(token).map(p => p.trim());

            if (parts.length < 5 || parts[0].toLowerCase() !== 'clinical') {
                errors.push(
                    `Malformed clinical criterion: expected at least 5 colon-separated parts (Clinical:ParamID:dataType:operator:value), got ${parts.length}.`
                );
                return;
            }

            const dataType = parts[2].toLowerCase();
            const operator = parts[3];

            if (dataType !== 'string' && dataType !== 'number') {
                errors.push(
                    `Invalid clinical dataType "${parts[2]}": must be "string" or "number".`
                );
            }

            if (
                !['>', '>=', '<', '<=', '=', '!=', 'contains'].includes(
                    operator
                )
            ) {
                errors.push(
                    `Invalid operator "${operator}": must be one of: >, >=, <, <=, =, !=, contains.`
                );
            }

            if (dataType === 'number') {
                const valueRaw = parts.slice(4).join(':');
                const numVal = Number(valueRaw);
                if (valueRaw.trim() === '' || Number.isNaN(numVal)) {
                    errors.push(
                        `Invalid number value "${valueRaw}" for number dataType.`
                    );
                }
            }
        } else {
            // Molecular criterion: GENE[:altType[:partner]]
            // Examples: KRAS, KRAS:MUT, KRAS:G12C, CCNE1:AMP, GENE1::GENE2:FUSION
            const parts = token
                .split(':')
                .map(p => p.trim())
                .filter(Boolean);

            if (parts.length === 0) {
                errors.push(`Empty molecular criterion token.`);
                return;
            }

            const gene = parts[0];
            // Gene names are validated later against actual gene list (API check)
            // Here we only check basic syntax: gene name should not be empty
            if (!gene || gene.length === 0) {
                errors.push(`Gene name is empty.`);
            }
        }
    });

    return errors;
}

/**
 * Validates that all genes mentioned in trials exist in the provided gene list.
 * @param trials
 * @param availableGenes List of Gene objects from cBioPortal API
 * @returns Array of validation issues
 */
export function validateGenesExist(
    trials: clinicalTrial[],
    availableGenes: Gene[]
): LocalCTValidationIssue[] {
    const issues: LocalCTValidationIssue[] = [];
    const validHugoSymbols = new Set(
        availableGenes.map(g => g.hugoGeneSymbol?.toUpperCase()).filter(Boolean)
    );

    const extractGenesFromCriteria = (criteria: string[]): Set<string> => {
        const genes = new Set<string>();
        criteria.forEach(crit => {
            if (/^clinical:/i.test(crit)) return; // Skip clinical criteria

            const tokens = crit
                .split(/[,;]+/)
                .map(t => t.trim())
                .filter(Boolean);
            tokens.forEach(token => {
                const parts = token
                    .split(':')
                    .map(p => p.trim())
                    .filter(Boolean);
                if (parts.length > 0) {
                    genes.add(parts[0].toUpperCase());
                }
            });
        });
        return genes;
    };

    trials.forEach(trial => {
        const genesInTrial = extractGenesFromCriteria([
            ...(trial.inclusionCriteria || []),
            ...(trial.exclusionCriteria || []),
        ]);

        genesInTrial.forEach(gene => {
            if (!validHugoSymbols.has(gene)) {
                issues.push({
                    level: 'error',
                    trialName: trial.trialName,
                    message: `Gene "${gene}" is not found in the cBioPortal instance's gene database.`,
                });
            }
        });
    });

    return issues;
}

/**
 * Validates that all clinical attributes mentioned in trials exist in the provided clinical attributes.
 * @param trials
 * @param clinicalAttributes List of ClinicalAttribute objects from the current study
 * @returns Array of validation issues
 */
export function validateClinicalAttributesExist(
    trials: clinicalTrial[],
    clinicalAttributes: ClinicalAttribute[]
): LocalCTValidationIssue[] {
    const issues: LocalCTValidationIssue[] = [];
    const validAttrIds = new Set(
        clinicalAttributes
            .map(a => a.clinicalAttributeId?.toUpperCase())
            .filter(Boolean)
    );

    const extractClinicalAttrsFromCriteria = (
        criteria: string[]
    ): Set<string> => {
        const attrs = new Set<string>();
        criteria.forEach(crit => {
            if (!/^clinical:/i.test(crit)) return; // Only clinical criteria

            const parts = splitOnUnescapedColon(crit).map(p => p.trim());
            if (parts.length >= 2) {
                attrs.add(parts[1].toUpperCase());
            }
        });
        return attrs;
    };

    trials.forEach(trial => {
        const attrsInTrial = extractClinicalAttrsFromCriteria([
            ...(trial.inclusionCriteria || []),
            ...(trial.exclusionCriteria || []),
        ]);

        attrsInTrial.forEach(attrId => {
            if (!validAttrIds.has(attrId)) {
                issues.push({
                    level: 'error',
                    trialName: trial.trialName,
                    message: `Clinical attribute "${attrId}" is not found in the current study's attributes.`,
                });
            }
        });
    });

    return issues;
}

/**
 * Splits a string on unescaped colons.
 * Handles backslash escaping: \: is treated as a literal colon, not a delimiter.
 */
function splitOnUnescapedColon(input: string): string[] {
    const parts: string[] = [];
    let current = '';
    let escaped = false;

    const chars = input.split('');
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (escaped) {
            current += ch;
            escaped = false;
        } else if (ch === '\\') {
            escaped = true;
        } else if (ch === ':') {
            parts.push(current);
            current = '';
        } else {
            current += ch;
        }
    }

    if (escaped) {
        current += '\\';
    }

    parts.push(current);
    return parts;
}
