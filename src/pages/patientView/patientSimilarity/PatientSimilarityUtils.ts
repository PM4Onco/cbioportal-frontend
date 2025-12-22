// PatientSimilarityUtils.ts

import { SimilarMutation } from 'shared/api/SimilarPatientsAPI';
import { Mutation } from 'cbioportal-ts-api-client';

const mergedGeneIndex: any = require('./merged_gene_index.json');

type GeneIndexEntry = {
    gene_type?: string | null;
    aliases?: string[] | null;
    pathways?: string | string[] | null;
};

type GeneIndex = { genes: Record<string, GeneIndexEntry> };

let _geneIndexCache:
    | {
          genes: Record<string, GeneIndexEntry>;
          aliasToGene: Record<string, string>;
      }
    | undefined;

function normalizeGeneKey(v?: string | null): string {
    return String(v || '')
        .trim()
        .toUpperCase();
}

function getGeneIndexMaps() {
    if (_geneIndexCache) return _geneIndexCache;

    const data: GeneIndex = (mergedGeneIndex || { genes: {} }) as GeneIndex;
    const genes = data.genes || {};
    const aliasToGene: Record<string, string> = {};

    for (const geneSymbolRaw of Object.keys(genes)) {
        const geneSymbol = normalizeGeneKey(geneSymbolRaw);
        const entry = genes[geneSymbolRaw];

        const aliases = Array.isArray(entry?.aliases)
            ? entry.aliases
            : entry?.aliases
            ? [String(entry.aliases)]
            : [];

        for (const a of aliases) {
            const alias = normalizeGeneKey(a);
            if (!alias) continue;

            if (aliasToGene[alias] && aliasToGene[alias] !== geneSymbol) {
                console.warn(
                    `[PatientSimilarity] Duplicate alias '${alias}' for genes '${aliasToGene[alias]}' and '${geneSymbol}'. Keeping '${aliasToGene[alias]}'.`
                );
                continue;
            }
            aliasToGene[alias] = geneSymbol;
        }
    }

    _geneIndexCache = { genes, aliasToGene };
    return _geneIndexCache;
}

export function resolveGeneSymbolOrAlias(
    geneOrAlias?: string | null
): string | undefined {
    const key = normalizeGeneKey(geneOrAlias);
    if (!key) return undefined;

    const { genes, aliasToGene } = getGeneIndexMaps();
    if (genes[key]) return key;
    return aliasToGene[key];
}

export function getGeneSymbolFromMutation(m: any): string | undefined {
    const g = m?.gene;
    const hugo = g?.hugoGeneSymbol || m?.hugoGeneSymbol;
    return hugo ? String(hugo) : undefined;
}

export function getGeneTypeForGene(
    geneOrAlias?: string | null
): string | undefined {
    const resolved = resolveGeneSymbolOrAlias(geneOrAlias);
    if (!resolved) return undefined;

    const { genes } = getGeneIndexMaps();
    const entry = genes[resolved];
    const t = entry?.gene_type;
    return t
        ? String(t)
              .trim()
              .toUpperCase()
        : undefined;
}

export function isTSGGene(geneOrAlias?: string | null): boolean {
    return getGeneTypeForGene(geneOrAlias) === 'TSG';
}

export function isTSGForMutation(m: any): boolean {
    const symbol = getGeneSymbolFromMutation(m);
    return isTSGGene(symbol);
}

export function getCleanPathwaysForGene(geneOrAlias?: string | null): string[] {
    const resolved = resolveGeneSymbolOrAlias(geneOrAlias);
    if (!resolved) return [];

    const { genes } = getGeneIndexMaps();
    const entry = genes[resolved];
    const raw = entry?.pathways;

    const list: string[] = Array.isArray(raw)
        ? raw.map(p => String(p).trim())
        : typeof raw === 'string'
        ? raw.split(/[,;|]/).map(s => s.trim())
        : [];

    return list
        .filter(p => p && p.toLowerCase() !== 'none')
        .filter((v, i, arr) => arr.indexOf(v) === i);
}

export function getCleanPathwaysForMutation(m: any): string[] {
    const symbol = getGeneSymbolFromMutation(m);
    return getCleanPathwaysForGene(symbol);
}

export function unionCleanPathwaysForMutations(muts: any[]): string[] {
    const set = new Set<string>();
    for (const m of muts || []) {
        getCleanPathwaysForMutation(m).forEach(p => set.add(p));
    }
    return Array.from(set);
}

export function haveCleanPathwayOverlap(
    mutsLeft: any[],
    mutsRight: any[]
): boolean {
    const left = new Set<string>(unionCleanPathwaysForMutations(mutsLeft));
    const right = new Set<string>(unionCleanPathwaysForMutations(mutsRight));
    if (left.size === 0 || right.size === 0) return false;

    for (const p of left) {
        if (right.has(p)) return true;
    }
    return false;
}

export function getSimilarMutations(
    mergedMutationData1: Mutation[][],
    mergedMutationData2: Mutation[][]
): SimilarMutation[] {
    const result: SimilarMutation[] = [];

    for (const referenceMutations of mergedMutationData1) {
        const referenceMutation = referenceMutations[0];

        const newMutation: SimilarMutation = {
            mutations1: referenceMutations,
            similarityTag: 'unequal',
            similarityScore: 0,
        } as any;

        let equalityScore = 0;

        for (const comparingMutations of mergedMutationData2) {
            const comparingMutation = comparingMutations[0];

            // equal variant
            if (
                referenceMutation.chr === comparingMutation.chr &&
                referenceMutation.startPosition ===
                    comparingMutation.startPosition &&
                referenceMutation.referenceAllele ===
                    comparingMutation.referenceAllele &&
                referenceMutation.variantAllele ===
                    comparingMutation.variantAllele &&
                equalityScore < 50
            ) {
                equalityScore = 50;
                newMutation.similarityTag = 'equal' as any;
                newMutation.similarityScore = equalityScore as any;
                (newMutation as any).mutations2 = comparingMutations;
                break;
            }

            // equal phgvs
            if (
                referenceMutation.proteinChange ===
                    comparingMutation.proteinChange &&
                referenceMutation.gene.entrezGeneId ===
                    comparingMutation.gene.entrezGeneId &&
                equalityScore < 40
            ) {
                equalityScore = 40;
                newMutation.similarityTag = 'phgvs' as any;
                newMutation.similarityScore = equalityScore as any;
                (newMutation as any).mutations2 = comparingMutations;
                continue;
            }

            // equal gene
            if (
                referenceMutation.gene.entrezGeneId ===
                    comparingMutation.gene.entrezGeneId &&
                equalityScore < 30
            ) {
                equalityScore = 30;
                newMutation.similarityTag = 'gene' as any;
                newMutation.similarityScore = equalityScore as any;
                (newMutation as any).mutations2 = comparingMutations;
                continue;
            }

            // equal pathway (NEU: aus merged_gene_index.json via gene/alias, inkl. multi-pathways)
            if (
                equalityScore < 20 &&
                haveCleanPathwayOverlap(
                    [referenceMutation],
                    [comparingMutation]
                )
            ) {
                equalityScore = 20;
                newMutation.similarityTag = 'pathway' as any;
                newMutation.similarityScore = equalityScore as any;
                (newMutation as any).mutations2 = comparingMutations;
                continue;
            }
        }

        if (equalityScore > 0) result.push(newMutation);
    }

    return result;
}

export function filterSimilarMutations(
    similarMutations: SimilarMutation[],
    similarityTags: string[]
) {
    return similarMutations.filter(m =>
        similarityTags.includes(m.similarityTag as any)
    );
}
