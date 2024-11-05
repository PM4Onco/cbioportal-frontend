import {
    SimilarPatient,
    TaggedMutation,
    SimilarMutation,
} from 'shared/api/SimilarPatientsAPI';
import {
    ClinicalData,
    CBioPortalAPI,
    MutationFilter,
    Mutation,
    MolecularProfile,
} from 'cbioportal-ts-api-client';

export function getSimilarMutations(
    mergedMutationData1: Mutation[][],
    mergedMutationData2: Mutation[][]
): SimilarMutation[] {
    var result = [];
    for (const referenceMutations of mergedMutationData1) {
        const referenceMutation = referenceMutations[0];
        var newMutation = {
            mutations1: referenceMutations,
            similarityTag: 'unequal',
            similarityScore: 0,
        } as SimilarMutation;
        var equalityScore = 0;
        for (const comparingMutations of mergedMutationData2) {
            const comareingMutation = comparingMutations[0];

            // equal variant
            if (
                referenceMutation.chr === comareingMutation.chr &&
                referenceMutation.startPosition ===
                    comareingMutation.startPosition &&
                referenceMutation.referenceAllele ===
                    comareingMutation.referenceAllele &&
                referenceMutation.variantAllele ===
                    comareingMutation.variantAllele &&
                equalityScore < 50
            ) {
                equalityScore = 50;
                newMutation['similarityTag'] = 'equal';
                newMutation['similarityScore'] = equalityScore;
                newMutation['mutations2'] = comparingMutations;
                break;
            }

            // equal phgvs
            if (
                referenceMutation.proteinChange ===
                    comareingMutation.proteinChange &&
                referenceMutation.gene.entrezGeneId ===
                    comareingMutation.gene.entrezGeneId &&
                equalityScore < 40
            ) {
                equalityScore = 40;
                newMutation['similarityTag'] = 'phgvs';
                newMutation['similarityScore'] = equalityScore;
                newMutation['mutations2'] = comparingMutations;
                continue;
            }

            // equal pathaway

            // equal gene
            if (
                referenceMutation.gene.entrezGeneId ===
                    comareingMutation.gene.entrezGeneId &&
                equalityScore < 20
            ) {
                equalityScore = 20;
                newMutation['similarityTag'] = 'gene';
                newMutation['similarityScore'] = equalityScore;
                newMutation['mutations2'] = comparingMutations;
                continue;
            }

            // equal GO Term
        }

        if (equalityScore > 0) {
            result.push(newMutation);
        }
    }

    return result;
}

export function filterSimilarMutations(
    similarMutations: SimilarMutation[],
    similarityTags: string[]
): SimilarMutation[] {
    return similarMutations.filter((similarMutation: SimilarMutation) => {
        if (similarityTags.includes(similarMutation.similarityTag)) {
            return similarMutation;
        }
    });
}
