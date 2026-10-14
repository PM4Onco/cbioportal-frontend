import * as React from 'react';
import { useState, useEffect } from 'react';
import {
    LocalCTValidationResult,
    LocalCTValidationIssue,
} from './LocalCTValidation';

interface LocalCTValidationPanelProps {
    validationResult: LocalCTValidationResult | null;
    loadError: Error | null;
    parseIssues: LocalCTValidationIssue[];
    geneIssues: LocalCTValidationIssue[];
    clinicalAttrIssues: LocalCTValidationIssue[];
}

/**
 * Displays validation results for localCT.json in a collapsible panel.
 * Shows static schema validation, parse errors, and API-based checks (genes, clinical attributes).
 */
export const LocalCTValidationPanel: React.FC<LocalCTValidationPanelProps> = ({
    validationResult,
    loadError,
    parseIssues,
    geneIssues,
    clinicalAttrIssues,
}) => {
    const [isOpen, setIsOpen] = useState(false);

    // Combine all issues
    const allIssues = [
        ...(validationResult?.issues || []),
        ...parseIssues,
        ...geneIssues,
        ...clinicalAttrIssues,
    ];

    const errorCount = allIssues.filter(i => i.level === 'error').length;
    const warningCount = allIssues.filter(i => i.level === 'warning').length;
    const hasErrors = errorCount > 0 || loadError !== null;

    // Determines alert class based on status
    const alertClass = hasErrors
        ? 'alert alert-danger'
        : warningCount > 0
        ? 'alert alert-warning'
        : 'alert alert-success';

    const statusText = loadError
        ? 'Failed to load'
        : validationResult
        ? `${validationResult.trialsCount} trial${
              validationResult.trialsCount !== 1 ? 's' : ''
          } loaded`
        : 'Validating...';

    const issueMessage =
        errorCount > 0
            ? `${errorCount} error${errorCount !== 1 ? 's' : ''}`
            : warningCount > 0
            ? `${warningCount} warning${warningCount !== 1 ? 's' : ''}`
            : 'Valid';

    return (
        <div style={{ marginBottom: '1rem' }}>
            <div
                className={alertClass}
                style={{ marginBottom: '0', cursor: 'pointer' }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <span>
                        <strong>localCT.json:</strong> {statusText} •{' '}
                        {issueMessage}
                        <span
                            style={{ fontSize: '0.9em', marginLeft: '0.5rem' }}
                        >
                            {isOpen ? '▼' : '►'}
                        </span>
                    </span>
                </div>
            </div>

            {isOpen && (
                <div
                    style={{
                        padding: '0.75rem',
                        backgroundColor: '#f9f9f9',
                        borderLeft: '4px solid #ddd',
                        marginTop: '-1px',
                        fontSize: '0.9em',
                    }}
                >
                    {loadError && (
                        <div
                            style={{ marginBottom: '0.5rem', color: '#d9534f' }}
                        >
                            <strong>Load Error:</strong> {loadError.message}
                        </div>
                    )}

                    {allIssues.length === 0 && !loadError && (
                        <div style={{ color: '#5cb85c' }}>
                            ✓ No validation issues detected.
                        </div>
                    )}

                    {allIssues.map((issue, idx) => (
                        <div
                            key={idx}
                            style={{
                                marginBottom: '0.5rem',
                                paddingLeft: '0.5rem',
                                borderLeft: `3px solid ${
                                    issue.level === 'error'
                                        ? '#d9534f'
                                        : '#f0ad4e'
                                }`,
                                color:
                                    issue.level === 'error'
                                        ? '#d9534f'
                                        : '#f0ad4e',
                            }}
                        >
                            <strong>
                                {issue.level === 'error' ? '✗' : '⚠'}{' '}
                                {issue.level === 'error' ? 'Error' : 'Warning'}
                                {issue.trialName ? ` (${issue.trialName})` : ''}
                                :
                            </strong>{' '}
                            {issue.message}
                        </div>
                    ))}

                    {allIssues.length === 0 && validationResult && (
                        <div
                            style={{
                                fontSize: '0.85em',
                                color: '#666',
                                marginTop: '0.5rem',
                            }}
                        >
                            Loaded {validationResult.trialsCount} trial
                            {validationResult.trialsCount !== 1 ? 's' : ''} with
                            no validation issues.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
