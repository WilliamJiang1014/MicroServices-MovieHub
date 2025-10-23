import React from 'react';

interface SimilarMovie {
  id: string;
  title: string;
  year?: number;
  poster?: string;
  similarity: number; // 0-1 similarity score
}

interface NetworkGraphProps {
  centerMovie: {
    id: string;
    title: string;
    year?: number;
    poster?: string;
  };
  similarMovies: SimilarMovie[];
  className?: string;
}

interface Node {
  id: string;
  x: number;
  y: number;
  title: string;
  year?: number;
  poster?: string;
  similarity?: number;
  isCenter?: boolean;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ 
  centerMovie, 
  similarMovies, 
  className = '' 
}) => {
  const size = 400;
  const centerX = size / 2;
  const centerY = size / 2;
  const orbitRadius = 120;
  
  // Calculate positions for similar movies
  const calculatePositions = (): Node[] => {
    const nodes: Node[] = [];
    
    // Add center movie
    nodes.push({
      id: centerMovie.id,
      x: centerX,
      y: centerY,
      title: centerMovie.title,
      year: centerMovie.year,
      poster: centerMovie.poster,
      isCenter: true
    });
    
    // Add similar movies in orbit
    similarMovies.slice(0, 8).forEach((movie, index) => {
      const angle = (2 * Math.PI * index) / Math.min(similarMovies.length, 8);
      const x = centerX + orbitRadius * Math.cos(angle);
      const y = centerY + orbitRadius * Math.sin(angle);
      
      nodes.push({
        id: movie.id,
        x,
        y,
        title: movie.title,
        year: movie.year,
        poster: movie.poster,
        similarity: movie.similarity
      });
    });
    
    return nodes;
  };

  const nodes = calculatePositions();
  const centerNode = nodes[0];
  const orbitNodes = nodes.slice(1);

  return (
    <div className={`network-graph ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Connection lines */}
        {orbitNodes.map((node) => {
          const opacity = node.similarity ? node.similarity * 0.6 + 0.2 : 0.3;
          const strokeWidth = node.similarity ? node.similarity * 3 + 1 : 1;
          
          return (
            <line
              key={`line-${node.id}`}
              x1={centerNode.x}
              y1={centerNode.y}
              x2={node.x}
              y2={node.y}
              stroke="var(--primary-500)"
              strokeWidth={strokeWidth}
              opacity={opacity}
            />
          );
        })}
        
        {/* Orbit nodes */}
        {orbitNodes.map((node) => (
          <g key={node.id}>
            {/* Node circle */}
            <circle
              cx={node.x}
              cy={node.y}
              r="20"
              fill="var(--card-bg)"
              stroke="var(--primary-500)"
              strokeWidth="2"
              className="network-node"
            />
            
            {/* Similarity score */}
            {node.similarity && (
              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-primary)"
                fontWeight="600"
              >
                {(node.similarity * 100).toFixed(0)}%
              </text>
            )}
            
            {/* Movie title */}
            <text
              x={node.x}
              y={node.y + 35}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-secondary)"
              className="network-label"
            >
              {node.title.length > 12 ? node.title.substring(0, 12) + '...' : node.title}
            </text>
            
            {/* Year */}
            {node.year && (
              <text
                x={node.x}
                y={node.y + 48}
                textAnchor="middle"
                fontSize="9"
                fill="var(--text-muted)"
              >
                ({node.year})
              </text>
            )}
          </g>
        ))}
        
        {/* Center node */}
        <g>
          <circle
            cx={centerNode.x}
            cy={centerNode.y}
            r="25"
            fill="var(--primary-500)"
            stroke="var(--card-bg)"
            strokeWidth="3"
            className="center-node"
          />
          
          <text
            x={centerNode.x}
            y={centerNode.y + 4}
            textAnchor="middle"
            fontSize="12"
            fill="var(--hero-fore)"
            fontWeight="700"
          >
            ★
          </text>
          
          {/* Center movie title */}
          <text
            x={centerNode.x}
            y={centerNode.y + 40}
            textAnchor="middle"
            fontSize="11"
            fill="var(--text-primary)"
            fontWeight="600"
            className="center-label"
          >
            {centerNode.title.length > 15 ? centerNode.title.substring(0, 15) + '...' : centerNode.title}
          </text>
          
          {/* Center movie year */}
          {centerNode.year && (
            <text
              x={centerNode.x}
              y={centerNode.y + 53}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-secondary)"
            >
              ({centerNode.year})
            </text>
          )}
        </g>
      </svg>
      
      {/* Legend */}
      <div className="network-legend">
        <div className="legend-section">
          <h4>相似度说明</h4>
          <div className="legend-items">
            <div className="legend-item">
              <div className="legend-line high"></div>
              <span>高相似度 (80%+)</span>
            </div>
            <div className="legend-item">
              <div className="legend-line medium"></div>
              <span>中相似度 (60-80%)</span>
            </div>
            <div className="legend-item">
              <div className="legend-line low"></div>
              <span>低相似度 (60%以下)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkGraph;
