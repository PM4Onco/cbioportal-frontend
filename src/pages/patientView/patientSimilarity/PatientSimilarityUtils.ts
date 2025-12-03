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
            const compareingMutation = comparingMutations[0];

            // equal variant
            if (
                referenceMutation.chr === compareingMutation.chr &&
                referenceMutation.startPosition ===
                    compareingMutation.startPosition &&
                referenceMutation.referenceAllele ===
                    compareingMutation.referenceAllele &&
                referenceMutation.variantAllele ===
                    compareingMutation.variantAllele &&
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
                    compareingMutation.proteinChange &&
                referenceMutation.gene.entrezGeneId ===
                    compareingMutation.gene.entrezGeneId &&
                equalityScore < 40
            ) {
                equalityScore = 40;
                newMutation['similarityTag'] = 'phgvs';
                newMutation['similarityScore'] = equalityScore;
                newMutation['mutations2'] = comparingMutations;
                continue;
            }

            // equal gene
            if (
                referenceMutation.gene.entrezGeneId ===
                    compareingMutation.gene.entrezGeneId &&
                equalityScore < 29
            ) {
                console.log(compareingMutation);
                equalityScore = 30;
                newMutation['similarityTag'] = 'gene';
                newMutation['similarityScore'] = equalityScore;
                newMutation['mutations2'] = comparingMutations;
                continue;
            }

            // equal pathway
            const referenceNamespaceColumns = referenceMutation.namespaceColumns as {
                [key: string]: any;
            };
            const compareingNamespaceColumns = compareingMutation.namespaceColumns as {
                [key: string]: any;
            };
            if (
                compareingNamespaceColumns != undefined &&
                referenceNamespaceColumns != undefined &&
                compareingNamespaceColumns['sim'] != undefined &&
                referenceNamespaceColumns['sim'] != undefined &&
                compareingNamespaceColumns['sim']['Pathways'] != undefined &&
                referenceNamespaceColumns['sim']['Pathways'] != undefined &&
                referenceNamespaceColumns['sim']['Pathways'] ===
                    compareingNamespaceColumns['sim']['Pathways'] &&
                equalityScore < 20
            ) {
                equalityScore = 20;
                newMutation['similarityTag'] = 'pathway';
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
