import {
    DraggableChangedFn,
    SelectedChangedFn,
    StateChangedFn,
} from 'pages/patientView/presentation/model/dynamic-component';
import React from 'react';
import { TherapyRecommendationTableComponent } from 'pages/patientView/therapyRecommendation/MtbTherapyRecommendationTable';
import {
    IClinicalData,
    IClinicalTrial,
    IGeneticAlteration,
    IMtb,
    IReference,
    ITherapyRecommendation,
    ITreatment,
} from 'cbioportal-utils';
import styles from 'pages/patientView/therapyRecommendation/style/therapyRecommendation.module.scss';
import { Else, If, Then } from 'react-if';
import {
    DefaultTooltip,
    placeArrowBottomLeft,
} from 'cbioportal-frontend-commons';
import {
    getTooltipEvidenceContent,
    truncate,
} from 'pages/patientView/therapyRecommendation/TherapyRecommendationTableUtils';
import * as _ from 'lodash';
import { DiscreteCopyNumberData, Mutation } from 'cbioportal-ts-api-client';
import SampleManager from 'pages/patientView/SampleManager';

interface Props {
    stateChanged: StateChangedFn;
    draggableChanged: DraggableChangedFn;
    selectedChanged: SelectedChangedFn;
    initialValue: string;
    mtbs: IMtb[];
    mutations: Mutation[];
    cna: DiscreteCopyNumberData[];
    sampleManager: SampleManager | null;
}

export const TherapyRecommendations = ({
    initialValue,
    mtbs,
    sampleManager,
    mutations,
    cna,
}: Props) => {
    enum ColumnKey {
        THERAPY = 'Therapy / Trials',
        COMMENT = 'Comment',
        REASONING = 'Reasoning',
        REFERENCES = 'References',
        EVIDENCE = 'Evidence Level',
    }

    enum ColumnWidth {
        COMMENT = 340,
    }

    function getGeneticAlterations(geneticAlterations: IGeneticAlteration[]) {
        return (
            <React.Fragment>
                <If
                    condition={
                        geneticAlterations && geneticAlterations.length > 0
                    }
                >
                    <div>
                        {geneticAlterations &&
                            geneticAlterations.map(
                                (geneticAlteration: IGeneticAlteration) => (
                                    <div>
                                        {geneticAlteration &&
                                            getGeneticAlteration(
                                                geneticAlteration
                                            )}
                                    </div>
                                )
                            )}
                    </div>
                </If>
            </React.Fragment>
        );
    }

    function getGeneticAlteration(geneticAlteration: IGeneticAlteration) {
        return (
            <React.Fragment>
                <div>
                    <span style={{ marginRight: 5 }}>
                        <b>{geneticAlteration.hugoSymbol}</b>{' '}
                        {geneticAlteration.alteration || 'any'}
                    </span>
                    <DefaultTooltip
                        placement="bottomLeft"
                        trigger={['hover', 'focus']}
                        overlay={tooltipGenomicContent(geneticAlteration)}
                        destroyTooltipOnHide={false}
                        onPopupAlign={placeArrowBottomLeft}
                    >
                        <i className={'fa fa-info-circle ' + styles.icon}></i>
                    </DefaultTooltip>
                </div>
            </React.Fragment>
        );
    }

    function getSamplesForGeneticAlterations(
        geneticAlterations: IGeneticAlteration[]
    ) {
        if (!geneticAlterations || geneticAlterations.length == 0) return;
        let alterationIds = geneticAlterations.map(
            (geneticAlteration: IGeneticAlteration) =>
                (geneticAlteration.entrezGeneId || '') +
                (geneticAlteration.alteration || '')
        );
        let allAlterationsOfPatient = getAllAlterationsOfPatient();
        let groupedMutations = _.groupBy(
            allAlterationsOfPatient,
            (alteration: any) => alteration.sampleId
        );
        let fittingSampleIds: string[] = [];
        for (let sampleId in groupedMutations) {
            let allAlterationsOfSample = groupedMutations[sampleId];
            if (
                alterationIds.every((alterationId: string) =>
                    allAlterationsOfSample
                        .map((alt: any) => alt.entrezGeneId + alt.alteration)
                        .includes(alterationId)
                )
            ) {
                fittingSampleIds.push(sampleId);
            }
        }
        return getSampleIdIcons(fittingSampleIds);
    }

    function getAllAlterationsOfPatient() {
        let allMutations = mutations.map((mutation: Mutation) => {
            return {
                hugoSymbol: mutation.gene.hugoGeneSymbol,
                alteration: mutation.proteinChange,
                entrezGeneId: mutation.entrezGeneId,
                sampleId: mutation.sampleId,
            };
        });
        let allCna = cna.map((alt: DiscreteCopyNumberData) => {
            return {
                hugoSymbol: alt.gene.hugoGeneSymbol,
                alteration:
                    alt.alteration === -2 ? 'Deletion' : 'Amplification',
                entrezGeneId: alt.entrezGeneId,
                sampleId: alt.sampleId,
            };
        });
        allMutations.push(...allCna);
        return allMutations;
    }

    function getSampleIdIcons(fittingSampleIds: string[]) {
        let sortedSampleIds = fittingSampleIds;
        if (fittingSampleIds.length > 1) {
            const sampleOrder = sampleManager!.getSampleIdsInOrder();
            sortedSampleIds = sampleOrder.filter((sampleId: string) =>
                fittingSampleIds.includes(sampleId)
            );
        }
        return (
            <React.Fragment>
                {sortedSampleIds.map((sampleId: string) => (
                    <span className={styles.genomicSpan}>
                        {sampleManager!.getComponentForSample(sampleId, 1, '')}
                    </span>
                ))}
            </React.Fragment>
        );
    }

    function tooltipGenomicContent(geneticAlteration: IGeneticAlteration) {
        return (
            <div className={styles.tooltip}>
                <div>
                    Genomic selection specified in the therapy recommendation:
                </div>
                <div>
                    <b>{geneticAlteration.hugoSymbol}</b> (ID:{' '}
                    {geneticAlteration.entrezGeneId}){' '}
                    {geneticAlteration.alteration || 'any'}
                </div>
            </div>
        );
    }

    function tooltipTreatmentContent(treatment: ITreatment) {
        return (
            <div className={styles.tooltip}>
                <div>
                    <div>
                        <b>{treatment.name}</b> (NCIT: {treatment.ncit_code})
                    </div>
                    <div>Synonyms: {treatment.synonyms || '-'}</div>
                </div>
            </div>
        );
    }

    function getTextForClinicalDataItem(item: IClinicalData): string {
        let text = '';
        if (item && item.attributeName) text += item.attributeName;
        if (item && item.attributeName && item.value && item.value !== 'null')
            text += ': ';
        if (item && item.value && item.value !== 'null') text += item.value;
        return text;
    }

    function tooltipClinicalTrialContent(clinicalTrial: IClinicalTrial) {
        return (
            <div className={styles.tooltip}>
                <div>
                    <div>
                        <b>{clinicalTrial.id}</b>
                    </div>
                    <div>{clinicalTrial.name}</div>
                </div>
            </div>
        );
    }

    const columns = [
        {
            name: ColumnKey.REASONING,
            render: (therapyRecommendation: ITherapyRecommendation) => (
                <div>
                    <div className={styles.reasoningInfoContainer}>
                        <div className={styles.genomicInfoContainer}>
                            <div className={styles.reasoningContainer}>
                                <If
                                    condition={
                                        therapyRecommendation.reasoning
                                            .geneticAlterations &&
                                        therapyRecommendation.reasoning
                                            .geneticAlterations.length > 0
                                    }
                                >
                                    <div className={styles.firstLeft}>
                                        <div className={styles.secondLeft}>
                                            Genomic alterations:
                                            <div>
                                                {therapyRecommendation.reasoning
                                                    .geneticAlterations &&
                                                    getGeneticAlterations(
                                                        therapyRecommendation
                                                            .reasoning
                                                            .geneticAlterations
                                                    )}
                                            </div>
                                            In samples:
                                            <div>
                                                {therapyRecommendation.reasoning
                                                    .geneticAlterations &&
                                                    getSamplesForGeneticAlterations(
                                                        therapyRecommendation
                                                            .reasoning
                                                            .geneticAlterations
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                </If>
                                <If
                                    condition={
                                        therapyRecommendation.reasoning
                                            .clinicalData &&
                                        therapyRecommendation.reasoning
                                            .clinicalData.length > 0
                                    }
                                >
                                    <div className={styles.firstRight}>
                                        Clinical data / molecular diagnostics:
                                        {therapyRecommendation.reasoning
                                            .clinicalData &&
                                            therapyRecommendation.reasoning.clinicalData.map(
                                                (
                                                    clinicalDataItem: IClinicalData
                                                ) => (
                                                    <div>
                                                        {getTextForClinicalDataItem(
                                                            clinicalDataItem
                                                        )}
                                                    </div>
                                                )
                                            )}
                                    </div>
                                </If>
                            </div>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            name: ColumnKey.THERAPY,
            render: (therapyRecommendation: ITherapyRecommendation) => (
                <div>
                    <If
                        condition={
                            therapyRecommendation.treatments &&
                            therapyRecommendation.treatments.length > 0
                        }
                    >
                        <div>
                            <span>
                                {therapyRecommendation.treatments.map(
                                    (treatment: ITreatment) => (
                                        <div>
                                            <DefaultTooltip
                                                placement="bottomLeft"
                                                trigger={['hover', 'focus']}
                                                overlay={tooltipTreatmentContent(
                                                    treatment
                                                )}
                                                destroyTooltipOnHide={false}
                                                onPopupAlign={
                                                    placeArrowBottomLeft
                                                }
                                            >
                                                <i
                                                    className={
                                                        'fa fa-medkit ' +
                                                        styles.icon
                                                    }
                                                ></i>
                                            </DefaultTooltip>
                                            <span style={{ marginLeft: 5 }}>
                                                <b>{treatment.name}</b>
                                            </span>
                                        </div>
                                    )
                                )}
                            </span>
                        </div>
                    </If>
                    <If
                        condition={
                            therapyRecommendation.clinicalTrials &&
                            therapyRecommendation.clinicalTrials.length > 0
                        }
                    >
                        <div>
                            <span>
                                {therapyRecommendation.clinicalTrials.map(
                                    (clinicalTrial: IClinicalTrial) => (
                                        <div>
                                            <DefaultTooltip
                                                placement="bottomLeft"
                                                trigger={['hover', 'focus']}
                                                overlay={tooltipClinicalTrialContent(
                                                    clinicalTrial
                                                )}
                                                destroyTooltipOnHide={false}
                                                onPopupAlign={
                                                    placeArrowBottomLeft
                                                }
                                            >
                                                <i
                                                    className={
                                                        'fa fa-stethoscope ' +
                                                        styles.icon
                                                    }
                                                ></i>
                                            </DefaultTooltip>
                                            <span style={{ marginLeft: 5 }}>
                                                <b>
                                                    <a
                                                        href={
                                                            'https://www.clinicaltrials.gov/ct2/show/' +
                                                            clinicalTrial.id
                                                        }
                                                        target={'_blank'}
                                                    >
                                                        {clinicalTrial.id}
                                                    </a>
                                                </b>
                                            </span>
                                        </div>
                                    )
                                )}
                            </span>
                        </div>
                    </If>
                </div>
            ),
        },
        {
            name: ColumnKey.COMMENT,
            render: (therapyRecommendation: ITherapyRecommendation) => (
                <div>
                    {therapyRecommendation.comment.map((comment: string) => (
                        <p>{comment}</p>
                    ))}
                </div>
            ),
            width: ColumnWidth.COMMENT,
        },
        {
            name: ColumnKey.EVIDENCE,
            render: (therapyRecommendation: ITherapyRecommendation) => (
                <div>
                    <span style={{ marginRight: 5 }}>
                        Level{' '}
                        <b>{therapyRecommendation.evidenceLevel || 'NA'}</b>{' '}
                        {therapyRecommendation.evidenceLevelExtension || ''}
                        {therapyRecommendation.evidenceLevelM3Text
                            ? ' (' +
                              therapyRecommendation.evidenceLevelM3Text +
                              ')'
                            : ''}
                    </span>
                    <If condition={therapyRecommendation.evidenceLevel}>
                        <DefaultTooltip
                            trigger={['hover', 'focus']}
                            overlay={getTooltipEvidenceContent(
                                therapyRecommendation.evidenceLevel
                            )}
                            destroyTooltipOnHide={false}
                        >
                            <i
                                className={'fa fa-info-circle ' + styles.icon}
                            ></i>
                        </DefaultTooltip>
                    </If>
                </div>
            ),
        },
        {
            name: ColumnKey.REFERENCES,
            render: (therapyRecommendation: ITherapyRecommendation) => (
                <If
                    condition={
                        therapyRecommendation.references &&
                        therapyRecommendation.references.length > 0
                    }
                >
                    <div>
                        {therapyRecommendation.references.map(
                            (reference: IReference) => (
                                <If
                                    condition={
                                        reference.pmid && reference.pmid > 0
                                    }
                                >
                                    <Then>
                                        <div>
                                            <a
                                                target="_blank"
                                                href={
                                                    'https://www.ncbi.nlm.nih.gov/pubmed/' +
                                                    reference.pmid
                                                }
                                            >
                                                [{reference.pmid}]{' '}
                                                {truncate(
                                                    reference.name,
                                                    40,
                                                    true
                                                )}
                                            </a>
                                        </div>
                                    </Then>
                                    <Else>
                                        <div>
                                            {truncate(
                                                reference.name,
                                                200,
                                                true
                                            )}
                                        </div>
                                    </Else>
                                </If>
                            )
                        )}
                    </div>
                </If>
            ),
        },
    ];

    return (
        <div className="presentation__mutation-table">
            <TherapyRecommendationTableComponent
                data={
                    mtbs.find(mtb => mtb.id === initialValue)
                        ?.therapyRecommendations
                }
                columns={columns}
                showFilter={false}
                showCopyDownload={false}
                showColumnVisibility={false}
            />
        </div>
    );
};
