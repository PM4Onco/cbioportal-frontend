import React, { useState, useMemo } from 'react';
import {
    ScatterChart,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Customized,
    TooltipProps,
} from 'recharts';

// Renders a horizontal similarity scale with interactive patient markers.
// Patients below the chosen minimum similarity are hidden.

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
    if (!patients || patients.length === 0) return null;

    const scores = patients
        .map(p => p.similarityScore)
        .filter((s): s is number => typeof s === 'number');

    const rawMaxScore = Math.max(...scores);
    const maxScore = rawMaxScore + 1.5;
    const [minSimilarity, setMinSimilarity] = useState(
        Math.floor(rawMaxScore * 0.7)
    );
    const [axisY, setAxisY] = useState<number | null>(null);
    const [hoveredPatient, setHoveredPatient] = useState<null | {
        name: string;
        age: number;
        similarityScore: number;
        x: number;
        y: number;
    }>(null);

    const minScore = Math.max(0, minSimilarity - 1.5);

    const dataInRange = patients.filter(
        p =>
            typeof p.similarityScore === 'number' &&
            p.similarityScore >= minSimilarity &&
            p.similarityScore <= rawMaxScore
    );

    const displayData = dataInRange.map(p => ({
        ...p,
        x: p.similarityScore!,
        y: 0,
        isSelected: p.patient_id === selectedPatientId,
    }));

    // Compute tick positions dynamically based on current min and max similarity

    const ticks = useMemo(() => {
        const adjustedMax = Math.ceil(rawMaxScore);
        const maxTickCount = 5;

        const totalSteps = adjustedMax - Math.ceil(minSimilarity);
        const step = Math.max(1, Math.floor(totalSteps / (maxTickCount - 1)));

        const result = [];
        for (let i = 0; i < maxTickCount; i++) {
            const tickValue = adjustedMax - i * step;
            if (tickValue < minSimilarity) break;
            result.push(tickValue);
        }

        return result;
    }, [rawMaxScore, minSimilarity]);

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '10px',
                marginTop: '18px',
                width: '100%',
            }}
        >
            <div
                style={{ width: '85%', height: '100px', position: 'relative' }}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                        margin={{ top: 30, bottom: 40, left: 20, right: 10 }}
                    >
                        <XAxis
                            type="number"
                            dataKey="x"
                            domain={[minScore, maxScore]}
                            reversed={true}
                            ticks={ticks}
                            tick={{ fontSize: 12, dy: 15, fill: '#000' }}
                            axisLine={{ stroke: '#000', strokeWidth: 5 }}
                            tickLine={{ stroke: '#000', strokeWidth: 3 }}
                            tickSize={15}
                        />
                        <YAxis type="number" domain={[0, 10]} hide />

                        <Tooltip
                            content={({
                                active,
                                payload,
                            }: TooltipProps<number, string>) => {
                                if (active && payload && payload.length > 0) {
                                    const similarity = payload[0].payload?.x;
                                    return (
                                        <div
                                            style={{
                                                backgroundColor: 'white',
                                                border: '1px solid #ccc',
                                                padding: '5px',
                                                fontSize: '12px',
                                            }}
                                        >
                                            Similarity Score: {similarity}
                                        </div>
                                    );
                                }
                                return null;
                            }}
                            cursor={false}
                        />

                        <Customized
                            component={(props: any) => {
                                const xAxisMap = props.xAxisMap;
                                const yAxisMap = props.yAxisMap;
                                const xAxis =
                                    xAxisMap[Object.keys(xAxisMap)[0]];
                                const yAxis =
                                    yAxisMap[Object.keys(yAxisMap)[0]];
                                if (!xAxis || !yAxis) return null;

                                const yPos = yAxis.scale(0);
                                if (axisY === null) setAxisY(yPos);

                                const minX = xAxis.scale(minScore);
                                const maxX = xAxis.scale(maxScore);

                                const rectWidth = 10;
                                const rectHeight = 30;
                                const cornerRadius = 7;

                                return (
                                    <g>
                                        <rect
                                            x={maxX - rectWidth / 2}
                                            y={yPos - rectHeight / 2}
                                            width={rectWidth}
                                            height={rectHeight}
                                            rx={cornerRadius}
                                            ry={cornerRadius}
                                            fill="black"
                                        />
                                        <rect
                                            x={minX - rectWidth / 2}
                                            y={yPos - rectHeight / 2}
                                            width={rectWidth}
                                            height={rectHeight}
                                            rx={cornerRadius}
                                            ry={cornerRadius}
                                            fill="black"
                                        />

                                        {displayData.map(point => {
                                            const cx = xAxis.scale(point.x);
                                            const tooltipOffsetY = -40;

                                            return (
                                                <g
                                                    key={point.patient_id}
                                                    onClick={() =>
                                                        onSelectPatient(
                                                            point.patient_id
                                                        )
                                                    }
                                                    onMouseEnter={e =>
                                                        setHoveredPatient({
                                                            name: point.name,
                                                            age: point.age,
                                                            similarityScore: point.similarityScore!,
                                                            x: e.clientX,
                                                            y:
                                                                e.clientY +
                                                                tooltipOffsetY,
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
                                                        cy={yPos}
                                                        r={10}
                                                        fill={
                                                            point.isSelected
                                                                ? 'red'
                                                                : 'black'
                                                        }
                                                    />
                                                    <circle
                                                        cx={cx}
                                                        cy={yPos}
                                                        r={4}
                                                        fill="white"
                                                    />
                                                </g>
                                            );
                                        })}
                                    </g>
                                );
                            }}
                        />
                    </ScatterChart>
                </ResponsiveContainer>

                {axisY !== null && (
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
                )}

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
            <div
                style={{
                    position: 'relative',
                    width: '80px',
                    height: '100px',
                    marginLeft: '10px',
                }}
            >
                {axisY !== null && (
                    <>
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
                                top: axisY - 6,
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
                                    setMinSimilarity(parseInt(e.target.value))
                                }
                                style={{ width: '80px' }}
                            />

                            <div
                                style={{
                                    marginTop: '8px',
                                    textAlign: 'center',
                                }}
                            >
                                <input
                                    type="number"
                                    min={0}
                                    max={rawMaxScore}
                                    step={1}
                                    value={minSimilarity}
                                    onChange={e =>
                                        setMinSimilarity(
                                            parseInt(e.target.value)
                                        )
                                    }
                                    style={{ width: '50px' }}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SimilarityScoreBar;
