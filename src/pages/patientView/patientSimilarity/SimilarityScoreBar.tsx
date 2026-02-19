import React, { useEffect, useMemo, useRef, useState } from 'react';

// Similarity score “landscape” with clickable patient markers and optional clustering by identical scores.

interface SimilarityScoreBarProps {
    patients: {
        similarityScore?: number;
        patient_id: string;
        name: string;
        age: number;
    }[];
    selectedPatientId: string;
    onSelectPatient: (id: string) => void;
}

const SimilarityScoreBar: React.FC<SimilarityScoreBarProps> = ({
    patients,
    selectedPatientId,
    onSelectPatient,
}) => {
    // Nothing to render.
    if (!patients || patients.length === 0) return null;

    // Collect valid numeric scores.
    const scores = patients
        .map(p => p.similarityScore)
        .filter((s): s is number => typeof s === 'number');

    // Nothing to render if no scores exist.
    if (scores.length === 0) return null;

    // Define the score domain (with padding for nicer spacing).
    const rawMaxScore = Math.max(...scores);
    const maxScore = rawMaxScore + 1.5;

    // “Zoom” threshold: hide patients below this minimum similarity.
    const [minSimilarity, setMinSimilarity] = useState(
        Math.floor(rawMaxScore * 0.7)
    );

    // Pad the minimum domain slightly to avoid edge-collisions.
    const minScore = Math.max(0, minSimilarity - 1.5);

    // Floating tooltip state (positioned via viewport coordinates).
    const [hoveredPatient, setHoveredPatient] = useState<null | {
        name: string;
        age: number;
        similarityScore: number;
        x: number;
        y: number;
    }>(null);

    // Tracks which score-group (same score) is currently expanded.
    const [expandedScoreKey, setExpandedScoreKey] = useState<string | null>(
        null
    );

    // Used to delay collapse to make hovering between items easier.
    const collapseTimeoutRef = useRef<number | null>(null);

    // Expand a score-group and cancel any pending collapse.
    const openGroup = (key: string) => {
        if (collapseTimeoutRef.current) {
            window.clearTimeout(collapseTimeoutRef.current);
            collapseTimeoutRef.current = null;
        }
        setExpandedScoreKey(key);
    };

    // Collapse the expanded score-group after a short delay.
    const closeGroupDelayed = () => {
        if (collapseTimeoutRef.current)
            window.clearTimeout(collapseTimeoutRef.current);
        collapseTimeoutRef.current = window.setTimeout(() => {
            setExpandedScoreKey(null);
            setHoveredPatient(null);
            collapseTimeoutRef.current = null;
        }, 120);
    };

    // Apply zoom filter to reduce points shown.
    const dataInRange = patients.filter(
        p =>
            typeof p.similarityScore === 'number' &&
            p.similarityScore >= minSimilarity &&
            p.similarityScore <= rawMaxScore
    );

    // Convert to render-friendly point objects.
    const displayData = dataInRange.map(p => ({
        ...p,
        x: p.similarityScore!,
        isSelected: p.patient_id === selectedPatientId,
    }));

    // Group points by identical score (within a fixed rounding precision).
    const groupedDisplayData = useMemo(() => {
        const groups = new Map<string, typeof displayData>();
        const keyOf = (x: number) => x.toFixed(4);

        displayData.forEach(p => {
            const k = keyOf(p.x);
            const arr = groups.get(k) ?? [];
            arr.push(p);
            groups.set(k, arr);
        });

        return Array.from(groups.entries()).map(([key, pts]) => {
            const selectedIdx = pts.findIndex(
                p => p.patient_id === selectedPatientId
            );
            const primary = selectedIdx >= 0 ? pts[selectedIdx] : pts[0];
            const hidden = pts.filter(p => p !== primary);

            return { key, x: primary.x, primary, hidden };
        });
    }, [displayData, selectedPatientId]);

    // Only grow the chart when a group is actually expanded.
    const expandedHiddenCount = useMemo(() => {
        if (!expandedScoreKey) return 0;
        const g = groupedDisplayData.find(x => x.key === expandedScoreKey);
        return g ? g.hidden.length : 0;
    }, [expandedScoreKey, groupedDisplayData]);

    // Extra height for the +N label and stacked expanded points.
    const extraHeight =
        expandedHiddenCount > 0 ? expandedHiddenCount * 22 + 28 : 0;
    const chartHeight = 100 + extraHeight;

    // Build a small set of ticks for the score axis.
    const ticks = useMemo(() => {
        const adjustedMax = Math.ceil(rawMaxScore);
        const maxTickCount = 5;

        const totalSteps = adjustedMax - Math.ceil(minSimilarity);
        const step = Math.max(1, Math.floor(totalSteps / (maxTickCount - 1)));

        const result: number[] = [];
        for (let i = 0; i < maxTickCount; i++) {
            const tickValue = adjustedMax - i * step;
            if (tickValue < minSimilarity) break;
            result.push(tickValue);
        }
        return result;
    }, [rawMaxScore, minSimilarity]);

    // Measure available width for correct pixel scaling.
    const svgWrapRef = useRef<HTMLDivElement | null>(null);
    const [svgWidth, setSvgWidth] = useState<number>(0);

    useEffect(() => {
        const updateWidth = () => {
            const el = svgWrapRef.current;
            if (!el) return;
            const w = el.getBoundingClientRect().width;
            if (typeof w === 'number' && !Number.isNaN(w)) setSvgWidth(w);
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);

        return () => {
            window.removeEventListener('resize', updateWidth);
        };
    }, []);

    // Layout constants for the SVG drawing area.
    const marginTop = 30;
    const marginBottom = 40 + extraHeight;
    const marginLeft = 20;
    const marginRight = 10;

    const innerW = Math.max(0, svgWidth - marginLeft - marginRight);
    const innerH = Math.max(0, chartHeight - marginTop - marginBottom);

    // Baseline (the horizontal axis line) y-position.
    const axisY = marginTop + innerH / 2;

    // Shift content (beam, ticks, points, end-caps, +N, expanded points, hover-rect) down,
    // but keep the labels ("Similarity Score Landscape" and "Zoom") at the original axisY.
    const contentYOffset = 14;
    const axisYContent = axisY + contentYOffset;

    // Convert score -> x (reversed: higher score is more to the left).
    const xScale = (score: number) => {
        if (innerW <= 0) return marginLeft;
        const denom = maxScore - minScore;
        if (denom <= 0) return marginLeft;
        const t = (maxScore - score) / denom;
        return marginLeft + t * innerW;
    };

    // Pixel positions for the end caps.
    const minX = xScale(minScore);
    const maxX = xScale(maxScore);

    // End cap styling.
    const rectWidth = 10;
    const rectHeight = 30;
    const cornerRadius = 7;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '10px',
                marginTop: '18px',
                width: '100%',
                position: 'relative',
                zIndex: 999,
                overflow: 'visible',
            }}
            // Always clear hover/expanded state when leaving the component.
            onMouseLeave={() => {
                setHoveredPatient(null);
                setExpandedScoreKey(null);
                if (collapseTimeoutRef.current) {
                    window.clearTimeout(collapseTimeoutRef.current);
                    collapseTimeoutRef.current = null;
                }
            }}
        >
            <div
                ref={svgWrapRef}
                style={{
                    width: '85%',
                    height: `${chartHeight}px`,
                    position: 'relative',
                    overflow: 'visible',
                    zIndex: 999,
                }}
            >
                <svg width="100%" height={chartHeight}>
                    {/* Main axis line */}
                    <line
                        x1={marginLeft}
                        x2={svgWidth - marginRight}
                        y1={axisYContent}
                        y2={axisYContent}
                        stroke="#000"
                        strokeWidth={5}
                    />

                    {/* Tick marks and labels */}
                    {ticks.map(t => {
                        const tx = xScale(t);
                        return (
                            <g key={`tick-${t}`}>
                                <line
                                    x1={tx}
                                    x2={tx}
                                    y1={axisYContent}
                                    y2={axisYContent + 15}
                                    stroke="#000"
                                    strokeWidth={3}
                                />
                                <text
                                    x={tx}
                                    y={axisYContent + 15 + 15}
                                    textAnchor="middle"
                                    fontSize={12}
                                    fill="#000"
                                >
                                    {t}
                                </text>
                            </g>
                        );
                    })}

                    {/* End caps */}
                    <rect
                        x={maxX - rectWidth / 2}
                        y={axisYContent - rectHeight / 2}
                        width={rectWidth}
                        height={rectHeight}
                        rx={cornerRadius}
                        ry={cornerRadius}
                        fill="black"
                    />
                    <rect
                        x={minX - rectWidth / 2}
                        y={axisYContent - rectHeight / 2}
                        width={rectWidth}
                        height={rectHeight}
                        rx={cornerRadius}
                        ry={cornerRadius}
                        fill="black"
                    />

                    {/* Patient points (grouped by score) */}
                    {groupedDisplayData.map(group => {
                        const cx = xScale(group.x);
                        const yPos = axisYContent;
                        const tooltipOffsetY = -40;

                        // Primary point shown at the score position.
                        const basePoint = (
                            <g
                                key={`primary-${group.primary.patient_id}`}
                                onClick={() =>
                                    onSelectPatient(group.primary.patient_id)
                                }
                                onMouseEnter={e =>
                                    setHoveredPatient({
                                        name: group.primary.name,
                                        age: group.primary.age,
                                        similarityScore: group.primary
                                            .similarityScore!,
                                        x: ((e as unknown) as MouseEvent)
                                            .clientX,
                                        y:
                                            ((e as unknown) as MouseEvent)
                                                .clientY + tooltipOffsetY,
                                    })
                                }
                                onMouseLeave={() => setHoveredPatient(null)}
                                style={{ cursor: 'pointer' }}
                            >
                                <circle
                                    cx={cx}
                                    cy={yPos}
                                    r={10}
                                    fill={
                                        group.primary.isSelected
                                            ? '#337ab7'
                                            : 'black'
                                    }
                                />
                                <circle cx={cx} cy={yPos} r={4} fill="white" />
                            </g>
                        );

                        if (group.hidden.length === 0) return basePoint;

                        const expanded = expandedScoreKey === group.key;

                        // Hover box keeps the group expanded while moving between items.
                        const pad = 3;
                        const r = 10;
                        const xPad = r + pad;
                        const top = yPos - (r + pad);
                        const bottom =
                            yPos +
                            28 +
                            (expanded ? group.hidden.length * 22 : 0) +
                            (r + pad);

                        const hoverRectX = cx - xPad;
                        const hoverRectY = top;
                        const hoverRectW = xPad * 2;
                        const hoverRectH = bottom - top;

                        return (
                            <g key={`group-${group.key}`}>
                                {basePoint}

                                <g
                                    onMouseEnter={() => openGroup(group.key)}
                                    onMouseLeave={closeGroupDelayed}
                                    style={{ pointerEvents: 'all' }}
                                >
                                    <rect
                                        x={hoverRectX}
                                        y={hoverRectY}
                                        width={hoverRectW}
                                        height={hoverRectH}
                                        fill="transparent"
                                        pointerEvents="all"
                                    />

                                    {/* “+N” indicates hidden patients with the same score */}
                                    <text
                                        x={cx}
                                        y={yPos + 28}
                                        textAnchor="middle"
                                        fontSize={12}
                                        style={
                                            {
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                            } as any
                                        }
                                    >
                                        +{group.hidden.length}
                                    </text>

                                    {/* Expanded points are stacked below the primary point */}
                                    {expanded &&
                                        group.hidden.map((p, i) => {
                                            const cy = yPos + (i + 1) * 22;

                                            return (
                                                <g
                                                    key={`hidden-${p.patient_id}`}
                                                    onClick={() =>
                                                        onSelectPatient(
                                                            p.patient_id
                                                        )
                                                    }
                                                    onMouseEnter={e =>
                                                        setHoveredPatient({
                                                            name: p.name,
                                                            age: p.age,
                                                            similarityScore: p.similarityScore!,
                                                            x: ((e as unknown) as MouseEvent)
                                                                .clientX,
                                                            y:
                                                                ((e as unknown) as MouseEvent)
                                                                    .clientY -
                                                                40,
                                                        })
                                                    }
                                                    onMouseLeave={() =>
                                                        setHoveredPatient(null)
                                                    }
                                                    style={{
                                                        cursor: 'pointer',
                                                        pointerEvents: 'all',
                                                    }}
                                                >
                                                    <circle
                                                        cx={cx}
                                                        cy={cy}
                                                        r={10}
                                                        fill={
                                                            p.patient_id ===
                                                            selectedPatientId
                                                                ? '#337ab7'
                                                                : 'black'
                                                        }
                                                    />
                                                    <circle
                                                        cx={cx}
                                                        cy={cy}
                                                        r={4}
                                                        fill="white"
                                                    />
                                                </g>
                                            );
                                        })}
                                </g>
                            </g>
                        );
                    })}
                </svg>

                {/* Axis title */}
                <div
                    style={{
                        position: 'absolute',
                        top: axisY - 6,
                        left: '8px',
                        color: '#000',
                        fontSize: '16px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        zIndex: 2,
                        transform: 'translateY(-100%) translateY(-8px)',
                    }}
                >
                    Similarity Score Landscape
                </div>

                {/* Floating tooltip near cursor */}
                {hoveredPatient && (
                    <div
                        style={{
                            position: 'fixed',
                            top: hoveredPatient.y,
                            left: hoveredPatient.x,
                            backgroundColor: 'white',
                            border: '1px solid #ccc',
                            padding: '6px',
                            fontSize: '13px',
                            borderRadius: '6px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                            pointerEvents: 'none',
                            zIndex: 9999,
                        }}
                    >
                        <div>
                            <b>Name:</b> {hoveredPatient.name}
                        </div>
                        <div>
                            <b>Age:</b> {hoveredPatient.age}
                        </div>
                        <div>
                            <b>Similarity Score:</b>{' '}
                            {hoveredPatient.similarityScore}
                        </div>
                    </div>
                )}
            </div>

            {/* Zoom controls for minSimilarity */}
            <div
                style={{
                    position: 'relative',
                    width: '80px',
                    height: `${chartHeight}px`,
                    marginLeft: '10px',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: axisY - 6,
                        left: '0px',
                        color: '#000',
                        fontSize: '16px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        zIndex: 2,
                        transform: 'translateY(-100%) translateY(-8px)',
                    }}
                >
                    Zoom
                </div>

                <div
                    style={{
                        position: 'absolute',
                        top: axisY - 6 + contentYOffset,
                        left: '0px',
                        width: '80px',
                    }}
                >
                    <input
                        type="range"
                        min={0}
                        max={rawMaxScore}
                        value={minSimilarity}
                        step={1}
                        onChange={e =>
                            setMinSimilarity(parseInt(e.target.value, 10))
                        }
                        style={{ width: '80px' }}
                    />

                    <div style={{ marginTop: '8px', textAlign: 'center' }}>
                        <input
                            type="number"
                            min={0}
                            max={rawMaxScore}
                            step={1}
                            value={minSimilarity}
                            onChange={e =>
                                setMinSimilarity(parseInt(e.target.value, 10))
                            }
                            style={{ width: '50px' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SimilarityScoreBar;
