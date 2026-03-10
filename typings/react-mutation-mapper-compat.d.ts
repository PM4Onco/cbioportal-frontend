import 'react-mutation-mapper';
import {
    ICivicGeneIndex,
    ICivicVariantIndex,
    IHotspotIndex,
    IMyCancerGenomeData,
    IOncoKbData,
    ISharedTherapyRecommendationData,
    RemoteData,
} from 'cbioportal-utils';
import { Mutation } from 'cbioportal-ts-api-client';
import { VariantAnnotation } from 'genome-nexus-ts-api-client';
import { CancerGene } from 'oncokb-ts-api-client';

declare module 'react-mutation-mapper' {
    interface IAnnotation {
        myCancerGenomeLinks?: string[];
        sharedTherapyRecommendationData?: ISharedTherapyRecommendationData;
    }

    function getAnnotationData(
        mutation?: Mutation,
        oncoKbCancerGenes?: RemoteData<CancerGene[] | Error | undefined>,
        hotspotData?: RemoteData<IHotspotIndex | undefined>,
        myCancerGenomeData?: IMyCancerGenomeData,
        oncoKbData?: RemoteData<IOncoKbData | Error | undefined>,
        usingPublicOncoKbInstance?: boolean,
        civicGenes?: RemoteData<ICivicGeneIndex | undefined>,
        civicVariants?: RemoteData<ICivicVariantIndex | undefined>,
        indexedVariantAnnotations?: RemoteData<
            { [genomicLocation: string]: VariantAnnotation } | undefined
        >,
        sharedTherapyRecommendationData?: ISharedTherapyRecommendationData,
        resolveTumorType?: (mutation: Mutation) => string,
        resolveEntrezGeneId?: (mutation: Mutation) => number
    ): IAnnotation;
}
