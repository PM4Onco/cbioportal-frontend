import * as React from 'react';
import _ from 'lodash';
import { DefaultTooltip } from 'cbioportal-frontend-commons';
import { OQLFilter } from 'pages/studyView/tabs/LocalClinicalTrialsHelperFunctions/LocalCTInterfaces';
import styles from './LocalCTMouseover.module.scss';

export function LocalTrialsTooltip({
    filters,
    warningsByTrialName = {},
}: {
    filters: OQLFilter[];
    warningsByTrialName?: { [trialName: string]: string[] };
}): JSX.Element {
    const trials = _.uniqBy(
        filters,
        filter => `${filter.trialName ?? ''}::${filter.trialURL ?? ''}`
    );

    return (
        <div className={styles.localTrialsCard}>
            <div className={styles.localTrialsHeader}>
                Matching clinical trials
            </div>

            <div className={styles.localTrialsBody}>
                This alteration is part of the inclusion criteria for{' '}
                {trials.length} {trials.length === 1 ? 'trial' : 'trials'} in
                the local clinical trials database. Please note that the patient
                may not be eligible for the trial due to additional inclusion
                criteria, or exclusion criteria which are not encoded in
                cBioPortal. In case an exclusion criterion is matched, this will
                be indicated in the warnings column of the table below.
            </div>

            <div className={styles.localTrialsBody}>
                <table className={styles.localTrialsTable}>
                    <colgroup>
                        <col className={styles.trialColumn} />
                        <col className={styles.centersColumn} />
                        <col className={styles.warningsColumn} />
                    </colgroup>

                    <thead>
                        <tr>
                            <th>Trial</th>
                            <th>Centers</th>
                            <th>Warnings</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trials.map(trial => (
                            <tr key={`${trial.trialName}-${trial.trialURL}`}>
                                <td>
                                    {trial.trialURL ? (
                                        <a
                                            href={trial.trialURL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {trial.trialName}
                                        </a>
                                    ) : (
                                        <span>{trial.trialName}</span>
                                    )}
                                </td>
                                <td>
                                    {trial.trialSites?.length
                                        ? trial.trialSites.join(', ')
                                        : 'NA'}
                                </td>
                                <td>
                                    {trial.trialName &&
                                    warningsByTrialName[trial.trialName]
                                        ?.length ? (
                                        <div className={styles.warningList}>
                                            {warningsByTrialName[
                                                trial.trialName
                                            ].map(warning => (
                                                <div
                                                    key={warning}
                                                    className={
                                                        styles.warningItem
                                                    }
                                                >
                                                    <span
                                                        className={
                                                            styles.warningIcon
                                                        }
                                                        aria-hidden="true"
                                                    >
                                                        ⚠
                                                    </span>
                                                    <span>{warning}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        ''
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className={styles.localTrialsFooter}>
                Disclaimer: This information is for research purposes only and
                eligibility for the respective trials should be confirmed.
            </div>
        </div>
    );
}

export function LocalTrialsCell({
    filters,
    warningsByTrialName,
}: {
    filters: OQLFilter[];
    warningsByTrialName?: { [trialName: string]: string[] };
}): JSX.Element {
    if (filters.length === 0) {
        return <span />;
    }

    return (
        <DefaultTooltip
            placement="left"
            overlayClassName={styles.localTrialsTooltip}
            overlay={
                <LocalTrialsTooltip
                    filters={filters}
                    warningsByTrialName={warningsByTrialName}
                />
            }
            arrowContent={<div className="rc-tooltip-arrow-inner" />}
        >
            <span
                aria-label="Matching local clinical trial"
                title="Matching inclusion criterion"
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    color: '#28a745',
                    fontSize: 18,
                    lineHeight: 1,
                }}
            >
                🔍
            </span>
        </DefaultTooltip>
    );
}
