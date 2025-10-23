import React from 'react';

interface RadarChartProps {
  ratings: Array<{ source: string; value: number; maxValue: number }>;
  className?: string;
}

interface RadarPoint {
  x: number;
  y: number;
}

const RadarChart: React.FC<RadarChartProps> = ({ ratings, className = '' }) => {
  const size = 200;
  const center = size / 2;
  const radius = 80;
  const numPoints = ratings.length;
  
  // Calculate points for each rating
  const calculatePoints = (): RadarPoint[] => {
    return ratings.map((rating, index) => {
      const angle = (2 * Math.PI * index) / numPoints - Math.PI / 2; // Start from top
      const normalizedValue = rating.value / rating.maxValue; // Normalize to 0-1
      const distance = radius * normalizedValue;
      
      return {
        x: center + distance * Math.cos(angle),
        y: center + distance * Math.sin(angle)
      };
    });
  };

  // Calculate points for the grid circles
  const gridCircles = [0.2, 0.4, 0.6, 0.8, 1.0].map(scale => ({
    r: radius * scale,
    cx: center,
    cy: center
  }));

  // Calculate points for the rating polygon
  const points = calculatePoints();
  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');

  // Calculate points for the grid lines
  const gridLines = ratings.map((_, index) => {
    const angle = (2 * Math.PI * index) / numPoints - Math.PI / 2;
    const endX = center + radius * Math.cos(angle);
    const endY = center + radius * Math.sin(angle);
    
    return { x1: center, y1: center, x2: endX, y2: endY };
  });

  return (
    <div className={`radar-chart ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid circles */}
        {gridCircles.map((circle, index) => (
          <circle
            key={index}
            cx={circle.cx}
            cy={circle.cy}
            r={circle.r}
            fill="none"
            stroke="var(--border-color)"
            strokeWidth="1"
            opacity="0.3"
          />
        ))}
        
        {/* Grid lines */}
        {gridLines.map((line, index) => (
          <line
            key={index}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="var(--border-color)"
            strokeWidth="1"
            opacity="0.3"
          />
        ))}
        
        {/* Rating polygon */}
        <polygon
          points={polygonPoints}
          fill="var(--primary-500)"
          fillOpacity="0.2"
          stroke="var(--primary-500)"
          strokeWidth="2"
        />
        
        {/* Data points */}
        {points.map((point, index) => (
          <g key={index}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="var(--primary-500)"
              stroke="var(--card-bg)"
              strokeWidth="2"
            />
            <text
              x={point.x}
              y={point.y - 8}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-primary)"
              fontWeight="600"
            >
              {ratings[index].value.toFixed(1)}
            </text>
          </g>
        ))}
        
        {/* Labels */}
        {ratings.map((rating, index) => {
          const angle = (2 * Math.PI * index) / numPoints - Math.PI / 2;
          const labelRadius = radius + 25;
          const labelX = center + labelRadius * Math.cos(angle);
          const labelY = center + labelRadius * Math.sin(angle);
          
          return (
            <text
              key={index}
              x={labelX}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="11"
              fill="var(--text-secondary)"
              fontWeight="500"
            >
              {rating.source}
            </text>
          );
        })}
      </svg>
      
      {/* Legend */}
      <div className="radar-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: 'var(--primary-500)' }}></div>
          <span>综合评分</span>
        </div>
      </div>
    </div>
  );
};

export default RadarChart;
