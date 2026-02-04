// TradeAnalysis.jsx - 360° Analytics Overview as a standalone page
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Container,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  MenuItem,
  Button,
  useTheme,
  useMediaQuery,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  LinearProgress
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  ShowChart as ShowChartIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import CustomAppBar from './CustomAppBar';
import { httpApi } from './api';
import moment from 'moment';

// Format number utility
const fmtNum = (n, d = 2) => {
  if (n == null || !isFinite(n)) return '—';
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
};

const formatToIST = (tsStr) => {
  if (!tsStr) return '—';
  return moment(tsStr).utcOffset(330).format('DD-MMM-YYYY HH:mm:ss');
};

// ============================================================================
// CHART COMPONENTS (from fusion.jsx)
// ============================================================================

const DonutChart = ({ data, title, size = 200 }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Responsive sizing
  const chartSize = isMobile ? Math.min(size * 0.8, 160) : size;
  
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return <Box sx={{ textAlign: 'center', py: 4, color: '#666' }}>No data available</Box>;
  
  let cumulativePercent = 0;
  const radius = chartSize / 2 - 20;
  const innerRadius = radius * 0.6;
  
  const createArc = (startAngle, endAngle, outerRadius, innerRadius) => {
    const start = polarToCartesian(chartSize/2, chartSize/2, outerRadius, endAngle);
    const end = polarToCartesian(chartSize/2, chartSize/2, outerRadius, startAngle);
    const startInner = polarToCartesian(chartSize/2, chartSize/2, innerRadius, endAngle);
    const endInner = polarToCartesian(chartSize/2, chartSize/2, innerRadius, startAngle);
    
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    return [
      "M", startInner.x, startInner.y,
      "L", start.x, start.y,
      "A", outerRadius, outerRadius, 0, largeArcFlag, 0, end.x, end.y,
      "L", endInner.x, endInner.y,
      "A", innerRadius, innerRadius, 0, largeArcFlag, 1, startInner.x, startInner.y,
      "Z"
    ].join(" ");
  };
  
  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };
  
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="subtitle2" sx={{ 
        color: '#00ffaa', 
        mb: 2, 
        fontWeight: 600,
        fontSize: { xs: '0.875rem', md: '1rem' }
      }}>{title}</Typography>
      <Box sx={{ position: 'relative', display: 'inline-block' }}>
        <svg width={chartSize} height={chartSize} style={{ transform: 'rotate(-90deg)' }}>
          {data.map((item, index) => {
            const percent = (item.value / total) * 100;
            const startAngle = (cumulativePercent / 100) * 360;
            const endAngle = ((cumulativePercent + percent) / 100) * 360;
            cumulativePercent += percent;
            
            return (
              <g key={index}>
                <path
                  d={createArc(startAngle, endAngle, radius, innerRadius)}
                  fill={item.color}
                  stroke="#1a1a1a"
                  strokeWidth={isMobile ? "1" : "2"}
                  style={{
                    filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))',
                    transition: 'all 0.3s ease'
                  }}
                />
              </g>
            );
          })}
        </svg>
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <Typography variant={isMobile ? "subtitle2" : "h6"} sx={{ 
            color: '#fff', 
            fontWeight: 700,
            fontSize: { xs: '1rem', md: '1.25rem' }
          }}>
            {total}
          </Typography>
          <Typography variant="caption" sx={{ 
            color: '#ccc',
            fontSize: { xs: '0.7rem', md: '0.75rem' }
          }}>
            Total
          </Typography>
        </Box>
      </Box>
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        spacing={{ xs: 0.5, sm: 1 }} 
        justifyContent="center" 
        flexWrap="wrap" 
        sx={{ mt: 2 }}
      >
        {data.map((item, index) => (
          <Chip
            key={index}
            size="small"
            label={`${item.label}: ${item.value}`}
            sx={{
              bgcolor: `${item.color}30`,
              color: item.color,
              border: `1px solid ${item.color}80`,
              fontWeight: 600,
              fontSize: { xs: '0.7rem', md: '0.75rem' }
            }}
          />
        ))}
      </Stack>
    </Box>
  );
};

// Beautiful Bar Chart Component
const BarChart = ({ data, title, height = 300, valueFormatter = (v) => v }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Responsive height
  const chartHeight = isMobile ? Math.min(height * 0.7, 250) : height;
  
  const maxValue = Math.max(...data.map(d => Math.abs(d.value)));
  
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ 
        color: '#00ffaa', 
        mb: 2, 
        fontWeight: 600,
        fontSize: { xs: '0.875rem', md: '1rem' }
      }}>{title}</Typography>
      <Box sx={{ 
        height: chartHeight, 
        p: { xs: 1, md: 2 },
        backgroundColor: '#070B0A',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 1,
        overflowX: isMobile ? 'auto' : 'visible'
      }}>
        {data.map((item, index) => {
          const barHeight = Math.abs(item.value) / maxValue * (chartHeight - 80);
          const isNegative = item.value < 0;
          
          return (
            <Box key={index} sx={{ mb: { xs: 1.5, md: 2 } }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                mb: 1,
                flexWrap: { xs: 'wrap', sm: 'nowrap' },
                gap: { xs: 0.5, sm: 0 }
              }}>
                <Typography variant="body2" sx={{ 
                  color: '#e0e0e0', 
                  fontSize: { xs: 11, md: 12 },
                  flexShrink: 1,
                  minWidth: 0
                }}>
                  {item.label}
                </Typography>
                <Typography variant="body2" sx={{ 
                  color: item.color || '#00ffaa', 
                  fontFamily: 'Roboto Mono, monospace', 
                  fontWeight: 600,
                  fontSize: { xs: 10, md: 12 },
                  flexShrink: 0
                }}>
                  {valueFormatter(item.value)}
                </Typography>
              </Box>
              <Box sx={{ 
                width: '100%', 
                height: 24, 
                bgcolor: 'rgba(255,255,255,0.05)', 
                borderRadius: 1,
                overflow: 'hidden',
                position: 'relative'
              }}>
                <Box sx={{
                  width: `${(Math.abs(item.value) / maxValue) * 100}%`,
                  height: '100%',
                  bgcolor: item.color || '#00ffaa',
                  borderRadius: 1,
                  background: `linear-gradient(90deg, ${item.color || '#00ffaa'}80, ${item.color || '#00ffaa'})`,
                  transition: 'all 0.8s ease-in-out',
                  boxShadow: `0 2px 4px ${item.color || '#00ffaa'}30`
                }} />
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

// Enhanced Interactive Line Chart Component  
const LineChart = ({ data, title, xKey, yKey, color = '#00ffaa' }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, data: null });
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [isMouseInTooltip, setIsMouseInTooltip] = useState(false);
  const tooltipTimeoutRef = useRef(null);
  const svgRef = useRef(null);
  
  // Cleanup timeout on component unmount - MUST be before early return
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);
  
  if (!data || data.length === 0) return <Box sx={{ textAlign: 'center', py: 4, color: '#666' }}>No data available</Box>;
  
  const maxY = Math.max(...data.map(d => d[yKey]));
  const minY = Math.min(...data.map(d => d[yKey]));
  const rangeY = maxY - minY || 1; // Prevent division by zero
  
  // Responsive dimensions
  const width = isMobile ? 350 : 600;
  const height = isMobile ? 250 : 300;
  const padding = isMobile ? 40 : 60;
  
  // Determine overall gradient color based on overall trend
  const firstValue = data[0]?.[yKey] || 0;
  const lastValue = data[data.length - 1]?.[yKey] || 0;
  const overallTrendColor = lastValue >= firstValue ? '#4CAF50' : '#F44336';
  const actualColor = color === '#00ffaa' ? overallTrendColor : color;
  
  const getCoordinates = (index, value) => {
    const x = padding + (index / Math.max(data.length - 1, 1)) * (width - 2 * padding);
    const y = height - padding - ((value - minY) / rangeY) * (height - 2 * padding);
    return { x, y };
  };
  
  // Create smooth curve segments with individual colors based on P&L change
  const createSmoothSegments = () => {
    if (data.length < 2) return [];
    
    const coords = data.map((d, i) => getCoordinates(i, d[yKey]));
    const segments = [];
    
    for (let i = 0; i < data.length - 1; i++) {
      const currentValue = data[i][yKey];
      const nextValue = data[i + 1][yKey];
      const segmentColor = nextValue >= currentValue ? '#4CAF50' : '#F44336';
      
      const prev = coords[i - 1];
      const curr = coords[i];
      const next = coords[i + 1];
      const nextNext = coords[i + 2];
      
      let pathSegment = `M ${curr.x} ${curr.y}`;
      
      if (i === 0) {
        // First segment
        const cp1x = curr.x + (next.x - curr.x) / 3;
        const cp1y = curr.y;
        const cp2x = next.x - (nextNext ? (nextNext.x - curr.x) / 6 : (next.x - curr.x) / 3);
        const cp2y = next.y - (nextNext ? (nextNext.y - curr.y) / 6 : 0);
        pathSegment += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
      } else if (i === coords.length - 2) {
        // Last segment
        const cp1x = curr.x + (next.x - prev.x) / 6;
        const cp1y = curr.y + (next.y - prev.y) / 6;
        const cp2x = next.x - (next.x - curr.x) / 3;
        const cp2y = next.y;
        pathSegment += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
      } else {
        // Middle segments
        const cp1x = curr.x + (next.x - prev.x) / 6;
        const cp1y = curr.y + (next.y - prev.y) / 6;
        const cp2x = next.x - (nextNext.x - curr.x) / 6;
        const cp2y = next.y - (nextNext.y - curr.y) / 6;
        pathSegment += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
      }
      
      segments.push({
        path: pathSegment,
        color: segmentColor,
        startValue: currentValue,
        endValue: nextValue
      });
    }
    
    return segments;
  };
  
  const smoothSegments = createSmoothSegments();
  
  const showTooltip = (e, index, dataPoint) => {
    // Clear any existing timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    
    const { x: pointX } = getCoordinates(index, dataPoint[yKey]);
    
    // Position tooltip relative to the data point, not mouse
    let tooltipX = pointX + 20;
    let tooltipY = 50;
    
    // Adjust position if tooltip would go off-screen
    if (tooltipX + 220 > width) { // 220 is approximate tooltip width
      tooltipX = pointX - 240;
    }
      
    setTooltip({
      show: true,
      x: tooltipX,
      y: tooltipY,
      data: dataPoint
    });
    setHoveredIndex(index);
  };
  
  const hideTooltip = () => {
    // Add a small delay to prevent flickering when moving between point and tooltip
    tooltipTimeoutRef.current = setTimeout(() => {
      if (!isMouseInTooltip) {
        setTooltip({ show: false, x: 0, y: 0, data: null });
        setHoveredIndex(-1);
      }
    }, 100);
  };
  
  const handleTooltipMouseEnter = () => {
    setIsMouseInTooltip(true);
    // Clear the hide timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
  };
  
  const handleTooltipMouseLeave = () => {
    setIsMouseInTooltip(false);
    setTooltip({ show: false, x: 0, y: 0, data: null });
    setHoveredIndex(-1);
  };
  
  // Generate smooth curve path
  const generateSmoothPath = () => {
    if (data.length < 2) return '';
    
    let path = '';
    const coords = data.map((d, i) => getCoordinates(i, d[yKey]));
    
    path += `M ${coords[0].x} ${coords[0].y}`;
    
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const next = coords[i + 1];
      
      if (i === 1) {
        // First curve
        const cp1x = prev.x + (curr.x - prev.x) / 3;
        const cp1y = prev.y;
        const cp2x = curr.x - (next ? (next.x - prev.x) / 6 : (curr.x - prev.x) / 3);
        const cp2y = curr.y - (next ? (next.y - prev.y) / 6 : 0);
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      } else if (i === coords.length - 1) {
        // Last curve
        const prevPrev = coords[i - 2];
        const cp1x = prev.x + (curr.x - prevPrev.x) / 6;
        const cp1y = prev.y + (curr.y - prevPrev.y) / 6;
        const cp2x = curr.x - (curr.x - prev.x) / 3;
        const cp2y = curr.y;
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      } else {
        // Middle curves
        const cp1x = prev.x + (curr.x - coords[i - 2].x) / 6;
        const cp1y = prev.y + (curr.y - coords[i - 2].y) / 6;
        const cp2x = curr.x - (next.x - prev.x) / 6;
        const cp2y = curr.y - (next.y - prev.y) / 6;
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      }
    }
    
    return path;
  };
  
  const smoothPath = generateSmoothPath();
  
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ 
        color: '#00ffaa', 
        mb: 2, 
        fontWeight: 600,
        fontSize: { xs: '0.875rem', md: '1rem' }
      }}>{title}</Typography>
      <Box sx={{ 
        background: '#070B0A',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: { xs: 1, md: 2 },
        p: { xs: 1, md: 2 },
        position: 'relative',
        overflowX: isMobile ? 'auto' : 'visible'
      }}>
        <svg ref={svgRef} width={width} height={height} style={{ 
          overflow: 'visible',
          minWidth: isMobile ? width : 'auto'
        }}>
          {/* Grid lines */}
          <defs>
            {/* Area fill gradient */}
            <linearGradient id={`area-gradient-${yKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={actualColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={actualColor} stopOpacity="0.05" />
            </linearGradient>
            
            <filter id={`glow-${yKey}`}>
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Y-axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = height - padding - ratio * (height - 2 * padding);
            const value = minY + ratio * rangeY;
            return (
              <g key={i}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="#333"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                <text
                  x={padding - 10}
                  y={y + 4}
                  fill="#888"
                  fontSize="10"
                  textAnchor="end"
                >
                  ₹{Math.round(value).toLocaleString()}
                </text>
              </g>
            );
          })}
          
          {/* X-axis grid lines and labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const x = padding + ratio * (width - 2 * padding);
            const dataIndex = Math.round(ratio * (data.length - 1));
            const dataPoint = data[dataIndex];
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={padding}
                  x2={x}
                  y2={height - padding}
                  stroke="#333"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                {dataPoint && (
                  <text
                    x={x}
                    y={height - padding + 20}
                    fill="#888"
                    fontSize="9"
                    textAnchor="middle"
                  >
                    Trade {dataPoint[xKey]}
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Area fill with smooth curve */}
          <path
            d={`${smoothPath} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`}
            fill={`url(#area-gradient-${yKey})`}
            stroke="none"
          />
          
          {/* Individual smooth colored line segments based on P&L changes */}
          {smoothSegments.map((segment, index) => (
            <path
              key={index}
              d={segment.path}
              fill="none"
              stroke={segment.color}
              strokeWidth="3"
              filter={`url(#glow-${yKey})`}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transition: 'all 0.3s ease' }}
            />
          ))}
          
          {/* Interactive data points */}
          {data.map((dataPoint, i) => {
            const { x, y } = getCoordinates(i, dataPoint[yKey]);
            const isHovered = hoveredIndex === i;
            
            // Determine point color based on the trend to this point
            let pointColor = actualColor;
            if (i > 0) {
              const prevValue = data[i - 1][yKey];
              const currentValue = dataPoint[yKey];
              pointColor = currentValue >= prevValue ? '#4CAF50' : '#F44336';
            } else if (i < data.length - 1) {
              const nextValue = data[i + 1][yKey];
              const currentValue = dataPoint[yKey];
              pointColor = nextValue >= currentValue ? '#4CAF50' : '#F44336';
            }
            
            return (
              <g key={i}>
                {/* Larger hover detection area - no mouse events that could cause flicker */}
                <circle
                  cx={x}
                  cy={y}
                  r="20"
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => showTooltip(e, i, dataPoint)}
                  onMouseLeave={hideTooltip}
                />
                
                {/* Visible data point */}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? "6" : "4"}
                  fill={pointColor}
                  stroke="#1a1a1a"
                  strokeWidth="2"
                  style={{ 
                    transition: 'all 0.2s ease',
                    filter: isHovered ? `url(#glow-${yKey})` : 'none',
                    pointerEvents: 'none' // Prevent interference with hover detection
                  }}
                />
                
                {/* Highlight ring on hover */}
                {isHovered && (
                  <circle
                    cx={x}
                    cy={y}
                    r="10"
                    fill="none"
                    stroke={pointColor}
                    strokeWidth="2"
                    opacity="0.5"
                    style={{ 
                      animation: 'pulse 1s ease-in-out infinite',
                      pointerEvents: 'none'
                    }}
                  />
                )}
              </g>
            );
          })}
        </svg>
        
        {/* Stable Interactive Tooltip */}
        {tooltip.show && tooltip.data && (
          <Box
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
            sx={{
              position: 'absolute',
              left: tooltip.x,
              top: tooltip.y,
              background: 'linear-gradient(135deg, #070B0A 0%, #0F1413 100%)',
              border: `2px solid ${actualColor}`,
              borderRadius: 2,
              p: 2,
              minWidth: 200,
              maxWidth: 250,
              boxShadow: `0 8px 32px ${actualColor}50, 0 0 0 1px rgba(255,255,255,0.2)`,
              backdropFilter: 'blur(10px)',
              zIndex: 1000,
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>
              Trade #{tooltip.data[xKey]}
            </Typography>
            <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
              {tooltip.data.symbol}
            </Typography>
            <Typography variant="body2" sx={{ 
              color: (tooltip.data[yKey] || 0) >= 0 ? '#4CAF50' : '#F44336', 
              fontWeight: 700, 
              mb: 1 
            }}>
              Cumulative P&L: ₹{tooltip.data[yKey]?.toLocaleString()}
            </Typography>
            <Typography variant="caption" sx={{ color: '#ccc', display: 'block', mb: 0.5 }}>
              Trade P&L: <span style={{ 
                color: (tooltip.data.tradePnL || 0) >= 0 ? '#4CAF50' : '#F44336',
                fontWeight: 600 
              }}>
                {(tooltip.data.tradePnL || 0) >= 0 ? '+' : ''}₹{(tooltip.data.tradePnL || 0).toLocaleString()}
              </span>
            </Typography>
            <Typography variant="caption" sx={{ color: '#aaa', fontSize: 10 }}>
              {tooltip.data.date} {tooltip.data.time}
            </Typography>
          </Box>
        )}
        
        {/* Chart Summary */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, color: '#ccc', fontSize: 11 }}>
          <span>Start: ₹{data[0]?.[yKey]?.toLocaleString()}</span>
          <span>Trades: {data.length}</span>
          <span>End: ₹{data[data.length - 1]?.[yKey]?.toLocaleString()}</span>
        </Box>
      </Box>
      
      {/* CSS for pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
          100% { opacity: 0.5; transform: scale(1); }
        }
      `}</style>
    </Box>
  );
};

// Performance Progress Bars Component
const PerformanceMetrics = ({ analytics }) => {
  const metrics = [
    {
      label: 'Win Rate',
      value: analytics.winRate || 0,
      max: 100,
      color: (analytics.winRate || 0) >= 50 ? '#4CAF50' : '#FF9800',
      suffix: '%'
    },
    {
      label: 'Profit Factor',
      value: analytics.profitFactor === Infinity ? 5 : Math.min(analytics.profitFactor || 0, 5),
      max: 5,
      color: (analytics.profitFactor || 0) >= 2 ? '#4CAF50' : (analytics.profitFactor || 0) >= 1 ? '#FF9800' : '#F44336',
      suffix: 'x'
    },
    {
      label: 'Margin-Based Return',
      value: analytics.marginBasedPortfolioPct !== null ? Math.abs(analytics.marginBasedPortfolioPct || 0) : Math.abs(analytics.portfolioPnLPct || 0),
      max: analytics.marginBasedPortfolioPct !== null 
        ? Math.max(Math.abs(analytics.marginBasedPortfolioPct || 0), 10)
        : Math.max(Math.abs(analytics.portfolioPnLPct || 0), 10),
      color: (analytics.marginBasedPortfolioPct !== null ? (analytics.marginBasedPortfolioPct || 0) : (analytics.portfolioPnLPct || 0)) >= 0 ? '#4CAF50' : '#F44336',
      suffix: '%'
    }
  ];
  
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>
        Performance Metrics
      </Typography>
      {metrics.map((metric, index) => (
        <Box key={index} sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" sx={{ color: '#e0e0e0', fontWeight: 600 }}>
              {metric.label}
            </Typography>
            <Typography variant="body2" sx={{ color: metric.color, fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>
              {(metric.value || 0).toFixed(1)}{metric.suffix}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(metric.value / metric.max) * 100}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(255,255,255,0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: metric.color,
                borderRadius: 4,
                background: `linear-gradient(90deg, ${metric.color}80, ${metric.color})`,
                boxShadow: `0 2px 8px ${metric.color}40`
              }
            }}
          />
        </Box>
      ))}
    </Box>
  );
};

// ============================================================================
// ENHANCED COMPUTE ANALYTICS WITH FUND MOVEMENT
// ============================================================================
const computeAnalytics = (rows, groups = []) => {
  // Overall metrics
  const closed = rows.filter(r => !r.in_progress);
  const totalTrades = closed.length;
  const wins = closed.filter(r => (r.total_matched_pnl || 0) > 0).length;
  const losses = closed.filter(r => (r.total_matched_pnl || 0) < 0).length;
  const flat = closed.filter(r => (r.total_matched_pnl || 0) === 0).length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  
  const totalPnL = closed.reduce((sum, r) => sum + (r.total_matched_pnl || 0), 0);
  const totalBuyCost = closed.reduce((sum, r) => sum + (r.buy_cost_total || 0), 0);
  const totalSellValue = closed.reduce((sum, r) => sum + (r.sell_value_total || 0), 0);
  const portfolioPnLPct = totalBuyCost > 0 ? ((totalSellValue - totalBuyCost) / totalBuyCost) * 100 : 0;

  // *** NEW: Available Margin Based Portfolio Performance ***
  // Calculate overall portfolio performance based on available_margin changes
  const allTrades = [];
  groups.forEach(g => {
    if (Array.isArray(g.trades)) {
      g.trades.forEach(trade => {
        if (trade.available_margin !== undefined && trade.available_margin !== null) {
          allTrades.push({
            ...trade,
            parent_order_id: g.parent_order_id,
            order_timestamp: trade.order_timestamp || trade.exchange_timestamp
          });
        }
      });
    }
  });

  // Sort trades by timestamp to track margin changes chronologically
  allTrades.sort((a, b) => {
    const timeA = parseToMoment(a.order_timestamp || a.exchange_timestamp);
    const timeB = parseToMoment(b.order_timestamp || b.exchange_timestamp);
    return timeA && timeB ? timeA.valueOf() - timeB.valueOf() : 0;
  });

  let marginBasedPortfolioPct = null;
  let fundMovementAnalysis = null;
  let initialMargin = null;
  let finalMargin = null;

  if (allTrades.length > 0) {
    // Find the earliest and latest available margin values
    const firstTrade = allTrades[0];
    const lastTrade = allTrades[allTrades.length - 1];
    
    // Calculate initial capital before first trade (reverse calculation from first buy)
    if (firstTrade.transaction_type === 'BUY' && firstTrade.used_margin) {
      initialMargin = firstTrade.available_margin + firstTrade.used_margin;
    } else {
      initialMargin = firstTrade.available_margin;
    }
    
    finalMargin = lastTrade.available_margin;
    
    // Calculate portfolio performance based on margin changes
    if (initialMargin > 0) {
      const capitalChange = finalMargin - initialMargin;
      marginBasedPortfolioPct = (capitalChange / initialMargin) * 100;
    }

    // Fund movement analysis
    const marginHistory = allTrades.map((trade, idx) => ({
      step: idx + 1,
      timestamp: trade.order_timestamp || trade.exchange_timestamp,
      available_margin: trade.available_margin,
      used_margin: trade.used_margin || 0,
      transaction_type: trade.transaction_type,
      tradingsymbol: trade.tradingsymbol,
      realized_pnl: trade.realized_pnl || 0,
      change: idx > 0 ? trade.available_margin - allTrades[idx - 1].available_margin : 0
    }));

    fundMovementAnalysis = {
      initialMargin,
      finalMargin,
      totalChange: finalMargin - initialMargin,
      changePercent: marginBasedPortfolioPct,
      marginHistory
    };
  }
  
  // Profit/Loss breakdown
  const profitTrades = closed.filter(r => (r.total_matched_pnl || 0) > 0);
  const lossTrades = closed.filter(r => (r.total_matched_pnl || 0) < 0);
  
  const totalProfit = profitTrades.reduce((sum, r) => sum + (r.total_matched_pnl || 0), 0);
  const totalLoss = Math.abs(lossTrades.reduce((sum, r) => sum + (r.total_matched_pnl || 0), 0));
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
  
  const avgProfit = wins > 0 ? totalProfit / wins : 0;
  const avgLoss = losses > 0 ? totalLoss / losses : 0;
  const avgPnL = totalTrades > 0 ? totalPnL / totalTrades : 0;
  
  // Tag-based analysis
  const tagStats = {};
  closed.forEach(r => {
    const tag = r.tag || 'UNTAGGED';
    if (!tagStats[tag]) {
      tagStats[tag] = { count: 0, pnl: 0, wins: 0, losses: 0, trades: [] };
    }
    tagStats[tag].count++;
    tagStats[tag].pnl += (r.total_matched_pnl || 0);
    tagStats[tag].trades.push(r);
    if ((r.total_matched_pnl || 0) > 0) tagStats[tag].wins++;
    if ((r.total_matched_pnl || 0) < 0) tagStats[tag].losses++;
  });
  
  // Convert to array and sort by PnL
  const tagAnalysis = Object.entries(tagStats)
    .map(([tag, stats]) => ({
      tag,
      count: stats.count,
      pnl: stats.pnl,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0,
      avgPnL: stats.count > 0 ? stats.pnl / stats.count : 0
    }))
    .sort((a, b) => b.pnl - a.pnl);
  
  // Signal type analysis
  const signalStats = {};
  closed.forEach(r => {
    const signal = r.signal_type || 'UNKNOWN';
    if (!signalStats[signal]) {
      signalStats[signal] = { count: 0, pnl: 0, wins: 0, losses: 0 };
    }
    signalStats[signal].count++;
    signalStats[signal].pnl += (r.total_matched_pnl || 0);
    if ((r.total_matched_pnl || 0) > 0) signalStats[signal].wins++;
    if ((r.total_matched_pnl || 0) < 0) signalStats[signal].losses++;
  });
  
  const signalAnalysis = Object.entries(signalStats)
    .map(([signal, stats]) => ({
      signal,
      count: stats.count,
      pnl: stats.pnl,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0
    }))
    .sort((a, b) => b.pnl - a.pnl);
  
  // Outcome distribution
  const outcomeStats = {
    PROFIT: profitTrades.length,
    LOSS: lossTrades.length,
    FLAT: flat,
    'IN-PROGRESS': rows.filter(r => r.in_progress).length
  };
  
  return {
    totalTrades,
    wins,
    losses,
    flat,
    winRate,
    totalPnL,
    totalBuyCost,
    totalSellValue,
    portfolioPnLPct,
    marginBasedPortfolioPct,     // NEW: True portfolio performance based on available margin
    fundMovementAnalysis,         // NEW: Fund movement tracking
    profitFactor,
    avgProfit,
    avgLoss,
    avgPnL,
    totalProfit,
    totalLoss,
    tagAnalysis,
    signalAnalysis,
    outcomeStats
  };
};

// ============================================================================
// MAIN TRADEANALYSIS COMPONENT
// ============================================================================
function TradeAnalysis() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allGroups, setAllGroups] = useState([]);
  const [rows, setRows] = useState([]);
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await httpApi.get('/fusion-data/grouped', {
        params: { order: 'desc', limit_parents: 500 }
      });

      const payload = response.data;
      const groups = Array.isArray(payload) ? payload : (Array.isArray(payload?.records) ? payload.records : []);

      setAllGroups(groups);

      const transformedRows = groups.map(g => {
        const buyTrades = (g.trades || []).filter(t => String(t.transaction_type).toUpperCase() === 'BUY');
        const sellTrades = (g.trades || []).filter(t => String(t.transaction_type).toUpperCase() === 'SELL');

        const buyQty = buyTrades.reduce((sum, t) => sum + (t.filled_quantity || 0), 0);
        const buyPrice = buyQty > 0 ? buyTrades.reduce((sum, t) => sum + ((t.average_price || 0) * (t.filled_quantity || 0)), 0) / buyQty : 0;

        const sellQty = sellTrades.reduce((sum, t) => sum + (t.filled_quantity || 0), 0);
        const sellPrice = sellQty > 0 ? sellTrades.reduce((sum, t) => sum + ((t.average_price || 0) * (t.filled_quantity || 0)), 0) / sellQty : 0;

        const buyCost = buyTrades.reduce((sum, t) => sum + (Number.isFinite(+t.buy_cost) ? +t.buy_cost : (t.average_price || 0) * (t.filled_quantity || 0)), 0);
        const sellValue = sellTrades.reduce((sum, t) => sum + (Number.isFinite(+t.sell_cost) ? +t.sell_cost : (t.average_price || 0) * (t.filled_quantity || 0)), 0);

        const totalPnL = (g.trades || []).reduce((sum, t) => sum + (t.matched_pnl || 0), 0);
        const inProgress = (g.trades || []).some(t => t.position_status === true);

        return {
          parent_order_id: g.parent_order_id,
          tradingsymbol: g.display_tradingsymbol || g.tradingsymbol || 'N/A',
          signal_type: g.fusion?.[0]?.signal_type || 'UNKNOWN',
          tag: (g.trades || []).find(t => t.tag)?.tag || 'UNTAGGED',
          in_progress: inProgress,
          total_matched_pnl: totalPnL,
          buy_cost_total: buyCost,
          sell_value_total: sellValue,
          buy_qty: buyQty,
          buy_price: buyPrice,
          sell_price: sellPrice,
          event_ts: g.fusion?.[0]?.event_ts || g.trades?.[0]?.order_timestamp || new Date().toISOString()
        };
      });

      setRows(transformedRows);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load trade data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRows = () => {
    if (dateFilter === 'all') return rows;

    const now = moment().utcOffset(330);
    let filtered = rows;

    if (dateFilter === 'today') {
      filtered = rows.filter(r => {
        const ts = moment(r.event_ts).utcOffset(330);
        return ts.isSame(now, 'day');
      });
    } else if (dateFilter === 'yesterday') {
      const yesterday = now.clone().subtract(1, 'days');
      filtered = rows.filter(r => {
        const ts = moment(r.event_ts).utcOffset(330);
        return ts.isSame(yesterday, 'day');
      });
    } else if (dateFilter === 'last7days') {
      const last7Days = now.clone().subtract(7, 'days');
      filtered = rows.filter(r => {
        const ts = moment(r.event_ts).utcOffset(330);
        return ts.isAfter(last7Days);
      });
    } else if (dateFilter === 'last30days') {
      const last30Days = now.clone().subtract(30, 'days');
      filtered = rows.filter(r => {
        const ts = moment(r.event_ts).utcOffset(330);
        return ts.isAfter(last30Days);
      });
    } else if (dateFilter === 'custom' && startDate && endDate) {
      const start = moment(startDate).startOf('day');
      const end = moment(endDate).endOf('day');
      filtered = rows.filter(r => {
        const ts = moment(r.event_ts);
        return ts.isBetween(start, end, null, '[]');
      });
    }

    return filtered;
  };

  const filteredRows = getFilteredRows();
  const analytics = computeAnalytics(filteredRows, allGroups);

  const getDateFilterLabel = () => {
    if (dateFilter === 'all') return 'All Time';
    if (dateFilter === 'today') return 'Today';
    if (dateFilter === 'yesterday') return 'Yesterday';
    if (dateFilter === 'last7days') return 'Last 7 Days';
    if (dateFilter === 'last30days') return 'Last 30 Days';
    if (dateFilter === 'custom' && startDate && endDate) {
      return `${moment(startDate).format('MMM D, YYYY')} - ${moment(endDate).format('MMM D, YYYY')}`;
    }
    return 'Select Period';
  };

  if (loading) {
    return (
      <>
        <CustomAppBar />
        <Container maxWidth="xl" sx={{ mt: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Container>
      </>
    );
  }

  if (error) {
    return (
      <>
        <CustomAppBar />
        <Container maxWidth="xl" sx={{ mt: 4 }}>
          <Alert severity="error">{error}</Alert>
          <Button onClick={fetchData} sx={{ mt: 2 }}>Retry</Button>
        </Container>
      </>
    );
  }

  return (
    <>
      <CustomAppBar />
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4, px: { xs: 1, sm: 2, md: 3 } }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ 
            color: '#00ffaa', 
            fontWeight: 800, 
            mb: 1,
            fontSize: { xs: '1.75rem', md: '2.125rem' },
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <BarChartIcon sx={{ fontSize: 36 }} />
            360° Analytics Overview
          </Typography>
        </Box>

        {/* Date Filter Controls */}
        <Card sx={{ background: 'rgba(7,11,10,0.95)', border: '1px solid rgba(255,255,255,0.1)', mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Date Range"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': { color: '#fff' },
                    '& .MuiInputLabel-root': { color: '#00ffaa' }
                  }}
                >
                  <MenuItem value="all">All Time</MenuItem>
                  <MenuItem value="today">Today</MenuItem>
                  <MenuItem value="yesterday">Yesterday</MenuItem>
                  <MenuItem value="last7days">Last 7 Days</MenuItem>
                  <MenuItem value="last30days">Last 30 Days</MenuItem>
                  <MenuItem value="custom">Custom Range</MenuItem>
                </TextField>
              </Grid>

              {dateFilter === 'custom' && (
                <>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label="Start Date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiOutlinedInput-root': { color: '#fff' },
                        '& .MuiInputLabel-root': { color: '#00ffaa' }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label="End Date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiOutlinedInput-root': { color: '#fff' },
                        '& .MuiInputLabel-root': { color: '#00ffaa' }
                      }}
                    />
                  </Grid>
                </>
              )}

              <Grid item xs={12} sm={6} md={3}>
                <Chip
                  label={`📊 ${getDateFilterLabel()} • ${analytics.totalTrades} trades`}
                  sx={{ bgcolor: '#00ffaa20', color: '#00ffaa', fontWeight: 600 }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* ========== COMPREHENSIVE ANALYTICS SECTIONS ========== */}
                <Typography sx={{
                  color: '#00ffaa', 
                  mb: 3, 
                  fontWeight: 700,
                  fontSize: { xs: '1.1rem', md: '1.3rem' },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  📊 Profitability Reality Check
                </Typography>
                <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: 4 }}>
                  <Grid item xs={12} sm={6} md={4}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.85) 0%, rgba(12, 12, 12, 0.95) 100%)',
                      border: `2px solid ${analytics.totalPnL >= 0 ? '#4CAF5060' : '#F4433660'}`,
                      borderRadius: 4,
                      height: 200,
                      boxShadow: `0 8px 32px ${analytics.totalPnL >= 0 ? 'rgba(76, 175, 80, 0.25)' : 'rgba(244, 67, 54, 0.25)'}`,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-8px) scale(1.02)',
                        boxShadow: `0 16px 48px ${analytics.totalPnL >= 0 ? 'rgba(76, 175, 80, 0.4)' : 'rgba(244, 67, 54, 0.4)'}`,
                        border: `2px solid ${analytics.totalPnL >= 0 ? '#4CAF50' : '#F44336'}`
                      }
                    }}>
                      <CardContent sx={{ 
                        textAlign: 'center',
                        p: { xs: 2, md: 3 },
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Box sx={{ 
                          mb: 1, 
                          p: 1.5, 
                          borderRadius: 2, 
                          bgcolor: analytics.totalPnL >= 0 ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)' 
                        }}>
                          <Typography variant="h3" sx={{ 
                            color: analytics.totalPnL >= 0 ? '#4CAF50' : '#F44336', 
                            fontFamily: 'Roboto Mono, monospace', 
                            fontWeight: 800,
                            fontSize: { xs: '1.8rem', sm: '2.2rem', md: '2.5rem' },
                            textShadow: `0 0 20px ${analytics.totalPnL >= 0 ? '#4CAF5080' : '#F4433680'}`
                          }}>
                            {analytics.totalPnL >= 0 ? '+' : ''}₹{fmtNum(analytics.totalPnL)}
                          </Typography>
                        </Box>
                        <Typography variant="h6" sx={{ 
                          color: analytics.totalPnL >= 0 ? '#81C784' : '#EF5350', 
                          fontWeight: 700, 
                          mb: 1.5,
                          fontSize: { xs: '1rem', md: '1.1rem' }
                        }}>
                          {analytics.totalPnL >= 0 ? '🎉 Total Net Profit' : '⚠️ Total Net Loss'}
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          color: analytics.totalPnL >= 0 ? '#A5D6A7' : '#FFCDD2',
                          fontSize: { xs: '0.85rem', md: '0.9rem' },
                          fontWeight: 500,
                          lineHeight: 1.4,
                          textAlign: 'center'
                        }}>
                          {analytics.totalPnL >= 0 
                            ? `Despite ${analytics.losses > analytics.wins ? 'more losses' : 'fewer wins'}, strategy is profitable ✅`
                            : `Portfolio needs review - ${analytics.losses > analytics.wins ? 'too many losses' : 'wins not covering losses'} ❌`
                          }
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={4}>
                    <Card sx={{ 
                      background: analytics.profitFactor >= 1.0
                        ? 'linear-gradient(135deg, rgba(255, 235, 59, 0.12) 0%, rgba(255, 241, 118, 0.06) 100%)'
                        : 'linear-gradient(135deg, rgba(255, 152, 0, 0.12) 0%, rgba(255, 183, 77, 0.06) 100%)', 
                      border: `2px solid ${analytics.profitFactor >= 1.0 ? '#FFEB3B60' : '#FF980060'}`,
                      borderRadius: 4,
                      height: 200,
                      boxShadow: `0 8px 32px ${analytics.profitFactor >= 1.0 ? 'rgba(255, 235, 59, 0.25)' : 'rgba(255, 152, 0, 0.25)'}`,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-8px) scale(1.02)',
                        boxShadow: `0 16px 48px ${analytics.profitFactor >= 1.0 ? 'rgba(255, 235, 59, 0.4)' : 'rgba(255, 152, 0, 0.4)'}`,
                        border: `2px solid ${analytics.profitFactor >= 1.0 ? '#FFEB3B' : '#FF9800'}`
                      }
                    }}>
                      <CardContent sx={{ 
                        textAlign: 'center',
                        p: { xs: 2, md: 3 },
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Box sx={{ 
                          mb: 1, 
                          p: 1.5, 
                          borderRadius: 2, 
                          bgcolor: analytics.profitFactor >= 1.0 ? 'rgba(255, 235, 59, 0.15)' : 'rgba(255, 152, 0, 0.15)' 
                        }}>
                          <Typography variant="h3" sx={{ 
                            color: analytics.profitFactor >= 1.0 ? '#FFEB3B' : '#FF9800', 
                            fontFamily: 'Roboto Mono, monospace', 
                            fontWeight: 800,
                            fontSize: { xs: '1.8rem', sm: '2.2rem', md: '2.5rem' },
                            textShadow: `0 0 20px ${analytics.profitFactor >= 1.0 ? '#FFEB3B80' : '#FF980080'}`
                          }}>
                            {analytics.profitFactor === Infinity ? '∞' : fmtNum(analytics.profitFactor, 2)}x
                          </Typography>
                        </Box>
                        <Typography variant="h6" sx={{ 
                          color: analytics.profitFactor >= 1.0 ? '#FFF59D' : '#FFCC80', 
                          fontWeight: 700, 
                          mb: 1.5,
                          fontSize: { xs: '1rem', md: '1.1rem' }
                        }}>
                          {analytics.profitFactor >= 1.0 ? '💰 Profit Factor' : '⚠️ Profit Factor'}
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          color: analytics.profitFactor >= 1.0 ? '#FFF176' : '#FFB74D',
                          fontSize: { xs: '0.85rem', md: '0.9rem' },
                          fontWeight: 500,
                          lineHeight: 1.4,
                          textAlign: 'center'
                        }}>
                          {analytics.profitFactor >= 1.0 
                            ? `For every ₹1 lost, you make ₹${analytics.profitFactor === Infinity ? '∞' : fmtNum(analytics.profitFactor, 2)} ✅`
                            : `For every ₹1 lost, only ₹${fmtNum(analytics.profitFactor, 2)} gained ❌`
                          }
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={4}>
                    <Card sx={{ 
                      background: analytics.portfolioPnLPct >= 0
                        ? 'linear-gradient(135deg, rgba(33, 150, 243, 0.12) 0%, rgba(100, 181, 246, 0.06) 100%)'
                        : 'linear-gradient(135deg, rgba(244, 67, 54, 0.12) 0%, rgba(229, 115, 115, 0.06) 100%)', 
                      border: `2px solid ${analytics.portfolioPnLPct >= 0 ? '#2196F360' : '#F4433660'}`,
                      borderRadius: 4,
                      height: 200,
                      boxShadow: `0 8px 32px ${analytics.portfolioPnLPct >= 0 ? 'rgba(33, 150, 243, 0.25)' : 'rgba(244, 67, 54, 0.25)'}`,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-8px) scale(1.02)',
                        boxShadow: `0 16px 48px ${analytics.portfolioPnLPct >= 0 ? 'rgba(33, 150, 243, 0.4)' : 'rgba(244, 67, 54, 0.4)'}`,
                        border: `2px solid ${analytics.portfolioPnLPct >= 0 ? '#2196F3' : '#F44336'}`
                      }
                    }}>
                      <CardContent sx={{ 
                        textAlign: 'center',
                        p: { xs: 2, md: 3 },
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Box sx={{ 
                          mb: 1, 
                          p: 1.5, 
                          borderRadius: 2, 
                          bgcolor: analytics.portfolioPnLPct >= 0 ? 'rgba(33, 150, 243, 0.15)' : 'rgba(244, 67, 54, 0.15)' 
                        }}>
                          <Typography variant="h3" sx={{ 
                            color: analytics.portfolioPnLPct >= 0 ? '#2196F3' : '#F44336', 
                            fontFamily: 'Roboto Mono, monospace', 
                            fontWeight: 800,
                            fontSize: { xs: '1.8rem', sm: '2.2rem', md: '2.5rem' },
                            textShadow: `0 0 20px ${analytics.portfolioPnLPct >= 0 ? '#2196F380' : '#F4433680'}`
                          }}>
                            {analytics.portfolioPnLPct >= 0 ? '+' : ''}{fmtNum(analytics.portfolioPnLPct, 2)}%
                          </Typography>
                        </Box>
                        <Typography variant="h6" sx={{ 
                          color: analytics.portfolioPnLPct >= 0 ? '#64B5F6' : '#EF5350', 
                          fontWeight: 700, 
                          mb: 1.5,
                          fontSize: { xs: '1rem', md: '1.1rem' }
                        }}>
                          {analytics.portfolioPnLPct >= 0 ? '📈 Portfolio Return' : '📉 Portfolio Return'}
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          color: analytics.portfolioPnLPct >= 0 ? '#90CAF9' : '#FFCDD2',
                          fontSize: { xs: '0.85rem', md: '0.9rem' },
                          fontWeight: 500,
                          lineHeight: 1.4,
                          textAlign: 'center'
                        }}>
                          {analytics.portfolioPnLPct >= 0 
                            ? 'Positive return on invested capital ✅'
                            : 'Negative return - strategy needs review ❌'
                          }
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Win/Loss Analysis with Context */}
                <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>
                  ⚖️ Win vs Loss Analysis (The Real Story)
                </Typography>
                <Grid container spacing={2} sx={{ mb: 4 }}>
                  <Grid item xs={12} md={6}>
                    <Card sx={{ 
                      background: 'rgba(76, 175, 80, 0.08)', 
                      border: '1px solid #4CAF5030',
                      height: '100%'
                    }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h6" sx={{ color: '#4CAF50', fontWeight: 700 }}>
                            🟢 Winning Trades
                          </Typography>
                          <Chip label={`${analytics.wins} trades`} sx={{ bgcolor: 'rgba(76, 175, 80, 0.2)', color: '#4CAF50' }} />
                        </Box>
                        
                        <Typography variant="h4" sx={{ 
                          color: '#4CAF50', 
                          fontFamily: 'Roboto Mono, monospace', 
                          fontWeight: 700,
                          mb: 2
                        }}>
                          ₹{fmtNum(analytics.totalProfit)}
                        </Typography>
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" sx={{ color: '#a5d6a7', mb: 0.5 }}>
                            Average Win: <strong>₹{fmtNum(analytics.avgProfit)}</strong>
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#a5d6a7' }}>
                            Win Rate: <strong>{fmtNum(analytics.winRate, 1)}%</strong>
                          </Typography>
                        </Box>
                        
                        <Typography variant="caption" sx={{ color: '#c8e6c9', fontStyle: 'italic' }}>
                          Your wins are {analytics.avgProfit > 0 && analytics.avgLoss > 0 ? fmtNum(analytics.avgProfit / analytics.avgLoss, 1) : 'significantly'} times larger than your losses on average
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Card sx={{ 
                      background: 'rgba(244, 67, 54, 0.08)', 
                      border: '1px solid #F4433630',
                      height: '100%'
                    }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h6" sx={{ color: '#F44336', fontWeight: 700 }}>
                            🔴 Losing Trades
                          </Typography>
                          <Chip label={`${analytics.losses} trades`} sx={{ bgcolor: 'rgba(244, 67, 54, 0.2)', color: '#F44336' }} />
                        </Box>
                        
                        <Typography variant="h4" sx={{ 
                          color: '#F44336', 
                          fontFamily: 'Roboto Mono, monospace', 
                          fontWeight: 700,
                          mb: 2
                        }}>
                          ₹{fmtNum(analytics.totalLoss)}
                        </Typography>
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" sx={{ color: '#ef9a9a', mb: 0.5 }}>
                            Average Loss: <strong>₹{fmtNum(analytics.avgLoss)}</strong>
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#ef9a9a' }}>
                            Loss Rate: <strong>{fmtNum(100 - analytics.winRate, 1)}%</strong>
                          </Typography>
                        </Box>
                        
                        <Typography variant="caption" sx={{ color: '#ffcdd2', fontStyle: 'italic' }}>
                          {analytics.totalPnL >= 0 
                            ? 'Small, controlled losses are the price of finding big winners'
                            : '⚠️ Losses are too large or frequent - strategy needs adjustment'
                          }
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Strategy Analysis - Dynamic based on performance */}
                <Box sx={{ 
                  background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(12, 12, 12, 0.98) 100%)',
                  border: analytics.totalPnL >= 0 ? '1px solid rgba(0, 255, 170, 0.15)' : '1px solid rgba(244, 67, 54, 0.15)',
                  borderRadius: 4,
                  p: 3,
                  mb: 4,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.8)'
                }}>
                  <Typography variant="h6" sx={{ 
                    color: analytics.totalPnL >= 0 ? '#00ffaa' : '#F44336', 
                    fontWeight: 700, 
                    mb: 2 
                  }}>
                    {analytics.totalPnL >= 0 ? '🧠 Why This Strategy Works' : '⚠️ Strategy Performance Analysis'}
                  </Typography>
                  
                  {analytics.totalPnL < 0 && (
                    <Box sx={{ 
                      bgcolor: 'rgba(244, 67, 54, 0.1)', 
                      border: '1px solid #F4433650', 
                      borderRadius: 1, 
                      p: 2, 
                      mb: 3 
                    }}>
                      <Typography variant="body2" sx={{ color: '#ffcdd2', fontWeight: 600, mb: 1 }}>
                        🚨 Warning: Portfolio is in Loss
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#ffcdd2' }}>
                        Current strategy parameters need adjustment. Consider:
                        <br />• Tightening entry criteria to reduce trade frequency
                        <br />• Improving exit timing for loss trades
                        <br />• Adjusting position sizing for better risk management
                        <br />• Reviewing win rate vs profit factor balance
                      </Typography>
                    </Box>
                  )}
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" sx={{ 
                          color: analytics.avgProfit > 0 && analytics.avgLoss > 0 && (analytics.avgProfit / analytics.avgLoss) >= 1.5 
                            ? '#FFD700' 
                            : analytics.avgProfit > 0 && analytics.avgLoss > 0 && (analytics.avgProfit / analytics.avgLoss) >= 1.0
                            ? '#FF9800'
                            : (analytics.winRate >= 65 && analytics.profitFactor >= 2.0)
                            ? '#4CAF50'
                            : '#F44336', 
                          mb: 1 
                        }}>
                          {analytics.avgProfit > 0 && analytics.avgLoss > 0 ? fmtNum(analytics.avgProfit / analytics.avgLoss, 1) : '0'}:1
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                          <strong>Reward/Risk Ratio</strong><br />
                          {analytics.avgProfit > 0 && analytics.avgLoss > 0 && (analytics.avgProfit / analytics.avgLoss) >= 1.5 
                            ? 'Excellent ratio ✅'
                            : analytics.avgProfit > 0 && analytics.avgLoss > 0 && (analytics.avgProfit / analytics.avgLoss) >= 1.0
                            ? 'Acceptable ratio ⚠️'
                            : (analytics.winRate >= 65 && analytics.profitFactor >= 2.0)
                            ? 'Compensated by high win rate ✅'
                            : 'Needs improvement ❌'
                          }
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" sx={{ 
                          color: analytics.losses > analytics.wins && analytics.totalPnL >= 0 
                            ? '#4CAF50' 
                            : analytics.losses > analytics.wins
                            ? '#F44336'
                            : '#2196F3', 
                          mb: 1 
                        }}>
                          {analytics.losses > analytics.wins ? analytics.losses - analytics.wins : 0}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                          <strong>Extra Losses</strong><br />
                          {analytics.losses > analytics.wins && analytics.totalPnL >= 0 
                            ? 'More losses than wins, but still profitable ✅'
                            : analytics.losses > analytics.wins
                            ? 'Too many losses - need better entries ❌'
                            : 'Balanced win/loss ratio ✅'
                          }
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" sx={{ 
                          color: analytics.totalTrades >= 10 ? '#2196F3' : '#FF9800', 
                          mb: 1 
                        }}>
                          {analytics.totalTrades}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                          <strong>Total Trades</strong><br />
                          {analytics.totalTrades >= 30 
                            ? 'Statistically significant sample ✅'
                            : analytics.totalTrades >= 10
                            ? 'Reasonable sample size ⚠️'
                            : 'Small sample - need more data ❌'
                          }
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>

                {/* Beautiful Charts Section */}
                <Typography variant="h6" sx={{ color: '#00ffaa', mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShowChartIcon sx={{ color: '#00ffaa' }} />
                  📊 Visual Analytics Dashboard
                </Typography>

                <Grid container spacing={3} sx={{ mb: 4 }}>
                  {/* Win/Loss Donut Chart */}
                  <Grid item xs={12} md={6} lg={4}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%)',
                      border: '1px solid #00ffaa30',
                      height: 350
                    }}>
                      <CardContent>
                        <DonutChart
                          title="Win/Loss Distribution"
                          data={[
                            { label: 'Wins', value: analytics.wins, color: '#4CAF50' },
                            { label: 'Losses', value: analytics.losses, color: '#F44336' },
                            { label: 'Flat', value: analytics.flat, color: '#FF9800' }
                          ]}
                          size={220}
                        />
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Profit vs Loss Bar Chart */}
                  <Grid item xs={12} md={6} lg={4}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%)',
                      border: '1px solid #00ffaa30',
                      height: 350
                    }}>
                      <CardContent>
                        <BarChart
                          title="Profit vs Loss Analysis"
                          data={[
                            { 
                              label: 'Total Profit', 
                              value: analytics.totalProfit, 
                              color: '#4CAF50' 
                            },
                            { 
                              label: 'Total Loss', 
                              value: analytics.totalLoss, 
                              color: '#F44336' 
                            },
                            { 
                              label: 'Net P&L', 
                              value: analytics.totalPnL, 
                              color: analytics.totalPnL >= 0 ? '#00ffaa' : '#F44336' 
                            }
                          ]}
                          height={250}
                          valueFormatter={(value) => `₹${fmtNum(Math.abs(value))}`}
                        />
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Performance Metrics */}
                  <Grid item xs={12} md={6} lg={4}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%)',
                      border: '1px solid #00ffaa30',
                      height: 350
                    }}>
                      <CardContent>
                        <PerformanceMetrics analytics={analytics} />
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Cumulative P&L Line Chart */}
                  <Grid item xs={12} md={8}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%)',
                      border: '1px solid #00ffaa30'
                    }}>
                      <CardContent>
                        {(() => {
                          // Create cumulative P&L data
                          const sortedTrades = rows.filter(r => !r.in_progress)
                            .sort((a, b) => new Date(a.event_ts) - new Date(b.event_ts));
                          
                          let cumulativePnL = 0;
                          const cumulativeData = sortedTrades.map((trade, index) => {
                            cumulativePnL += (trade.total_matched_pnl || 0);
                            const fullDateTime = formatToIST(trade.event_ts);
                            const [dateOnly, timeOnly] = fullDateTime.split(' ');
                            return {
                              trade: index + 1,
                              cumPnL: cumulativePnL,
                              tradePnL: trade.total_matched_pnl || 0,
                              symbol: trade.tradingsymbol || '',
                              date: dateOnly, // Just date
                              time: timeOnly // Just time
                            };
                          });

                          return (
                            <LineChart
                              title="Cumulative P&L Progression"
                              data={cumulativeData}
                              xKey="trade"
                              yKey="cumPnL"
                              color="#00ffaa"
                            />
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Tag Performance Summary */}
                  <Grid item xs={12} md={4}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%)',
                      border: '1px solid #00ffaa30'
                    }}>
                      <CardContent>
                        <Typography variant="subtitle2" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BarChartIcon sx={{ color: '#00ffaa' }} />
                          Top Performing Tags
                        </Typography>
                        <Stack spacing={2}>
                          {analytics.tagAnalysis.slice(0, 5).map((tag, index) => (
                            <Box key={index} sx={{ 
                              p: 2, 
                              bgcolor: 'rgba(0, 255, 170, 0.05)', 
                              border: '1px solid #00ffaa20',
                              borderRadius: 1
                            }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Chip 
                                  label={tag.tag} 
                                  size="small" 
                                  sx={{ 
                                    bgcolor: tag.pnl >= 0 ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
                                    color: tag.pnl >= 0 ? '#4CAF50' : '#F44336',
                                    fontWeight: 600
                                  }} 
                                />
                                <Typography variant="caption" sx={{ color: '#ccc' }}>
                                  {tag.count} trades
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ 
                                  color: tag.pnl >= 0 ? '#4CAF50' : '#F44336',
                                  fontFamily: 'Roboto Mono, monospace',
                                  fontWeight: 700
                                }}>
                                  ₹{fmtNum(tag.pnl)}
                                </Typography>
                                <Typography variant="caption" sx={{ 
                                  color: tag.winRate >= 50 ? '#4CAF50' : '#FF9800'
                                }}>
                                  {fmtNum(tag.winRate, 1)}% win rate
                                </Typography>
                              </Box>
                            </Box>
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Risk/Reward Analysis */}
                  <Grid item xs={12}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%)',
                      border: '1px solid #00ffaa30'
                    }}>
                      <CardContent>
                        <Typography variant="subtitle2" sx={{ color: '#00ffaa', mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TrendingUpIcon sx={{ color: '#00ffaa' }} />
                          Risk vs Reward Analysis
                        </Typography>
                        
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={3}>
                            <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #4CAF5030', borderRadius: 2, bgcolor: 'rgba(76, 175, 80, 0.05)' }}>
                              <Typography variant="h4" sx={{ color: '#4CAF50', fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>
                                ₹{fmtNum(analytics.avgProfit)}
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#a5d6a7' }}>Average Win</Typography>
                            </Box>
                          </Grid>
                          
                          <Grid item xs={12} md={3}>
                            <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #F4433630', borderRadius: 2, bgcolor: 'rgba(244, 67, 54, 0.05)' }}>
                              <Typography variant="h4" sx={{ color: '#F44336', fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>
                                ₹{fmtNum(analytics.avgLoss)}
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#ef9a9a' }}>Average Loss</Typography>
                            </Box>
                          </Grid>
                          
                          <Grid item xs={12} md={3}>
                            <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #FFD70030', borderRadius: 2, bgcolor: 'rgba(255, 215, 0, 0.05)' }}>
                              <Typography variant="h4" sx={{ 
                                color: analytics.avgProfit > 0 && analytics.avgLoss > 0 && (analytics.avgProfit / analytics.avgLoss) >= 1.0
                                  ? '#FFD700'
                                  : (analytics.winRate >= 65 && analytics.profitFactor >= 2.0)
                                  ? '#4CAF50'
                                  : '#FF9800',
                                fontFamily: 'Roboto Mono, monospace', 
                                fontWeight: 700 
                              }}>
                                {analytics.avgProfit > 0 && analytics.avgLoss > 0 ? fmtNum(analytics.avgProfit / analytics.avgLoss, 1) : '∞'}:1
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#fff9c4' }}>Reward/Risk Ratio</Typography>
                              {analytics.avgProfit > 0 && analytics.avgLoss > 0 && (analytics.avgProfit / analytics.avgLoss) < 1.0 && (analytics.winRate >= 65 && analytics.profitFactor >= 2.0) && (
                                <Typography variant="caption" sx={{ color: '#4CAF50', display: 'block', mt: 0.5 }}>
                                  ✓ High win rate compensates
                                </Typography>
                              )}
                            </Box>
                          </Grid>
                          
                          <Grid item xs={12} md={3}>
                            <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #00ffaa30', borderRadius: 2, bgcolor: 'rgba(0, 255, 170, 0.05)' }}>
                              <Typography variant="h4" sx={{ color: '#00ffaa', fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>
                                {analytics.profitFactor === Infinity ? '∞' : fmtNum(analytics.profitFactor, 2)}x
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#a7ffeb' }}>Profit Factor</Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Enhanced Fund Movement Analysis Section */}
                {analytics.fundMovementAnalysis && (
                  <>
                    <Typography variant="h6" sx={{ 
                      color: '#00ffaa', 
                      mb: 4, 
                      fontWeight: 700,
                      fontSize: { xs: '1.1rem', md: '1.3rem' },
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1.5,
                      '&::before': {
                        content: '"💰"',
                        fontSize: '1.5rem',
                        filter: 'drop-shadow(0 0 8px rgba(0, 255, 170, 0.6))'
                      }
                    }}>
                      Capital Flow Analysis
                    </Typography>
                    <Grid container spacing={{ xs: 2, md: 4 }} sx={{ mb: 5 }}>
                      {/* Enhanced Capital Flow Summary */}
                      <Grid item xs={12} md={8}>
                        <Card sx={{ 
                          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 50%, rgba(0, 20, 15, 0.3) 100%)',
                          border: '3px solid transparent',
                          borderImage: 'linear-gradient(135deg, #00ffaa, #00ccaa, #008877) 1',
                          borderRadius: 4,
                          height: 380,
                          boxShadow: '0 8px 40px rgba(0, 255, 170, 0.25)',
                          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                          overflow: 'hidden',
                          position: 'relative',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'linear-gradient(135deg, rgba(0, 255, 170, 0.02), rgba(0, 200, 170, 0.02))',
                            zIndex: 1
                          },
                          '&:hover': {
                            transform: 'translateY(-6px)',
                            boxShadow: '0 16px 60px rgba(0, 255, 170, 0.35)',
                            '& .capital-flow-content': {
                              transform: 'scale(1.02)'
                            }
                          }
                        }}>
                          <CardContent sx={{ 
                            height: '100%', 
                            display: 'flex', 
                            flexDirection: 'column',
                            position: 'relative',
                            zIndex: 2
                          }} className="capital-flow-content">
                            <Typography variant="h6" sx={{ 
                              color: '#00ffaa', 
                              mb: 3, 
                              fontWeight: 700,
                              fontSize: { xs: '1rem', md: '1.2rem' },
                              textAlign: 'center',
                              textShadow: '0 0 10px rgba(0, 255, 170, 0.5)'
                            }}>
                              📈 Available Margin Timeline
                            </Typography>
                            <Box sx={{ p: { xs: 1, md: 2 }, flex: 1 }}>
                              <Grid container spacing={{ xs: 1, md: 2 }} sx={{ mb: 3 }}>
                                <Grid item xs={4}>
                                  <Box sx={{ 
                                    textAlign: 'center', 
                                    p: { xs: 1.5, md: 2 }, 
                                    background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(76, 175, 80, 0.05) 100%)', 
                                    borderRadius: 3, 
                                    border: '2px solid #4CAF5040',
                                    height: 90,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    transition: 'all 0.3s ease',
                                    boxShadow: '0 4px 16px rgba(76, 175, 80, 0.2)',
                                    '&:hover': {
                                      transform: 'translateY(-4px) scale(1.05)',
                                      boxShadow: '0 8px 24px rgba(76, 175, 80, 0.3)',
                                      border: '2px solid #4CAF50'
                                    }
                                  }}>
                                    <Typography variant="h5" sx={{ 
                                      color: '#4CAF50', 
                                      fontFamily: 'Roboto Mono, monospace', 
                                      fontWeight: 800,
                                      fontSize: { xs: '1.1rem', md: '1.4rem' },
                                      mb: 0.5,
                                      textShadow: '0 0 8px rgba(76, 175, 80, 0.4)'
                                    }}>
                                      ₹{fmtNum(analytics.fundMovementAnalysis.initialMargin)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ 
                                      color: '#A5D6A7', 
                                      fontSize: { xs: '0.7rem', md: '0.75rem' },
                                      fontWeight: 600
                                    }}>
                                      🏁 Initial Capital
                                    </Typography>
                                  </Box>
                                </Grid>
                                <Grid item xs={4}>
                                  <Box sx={{ 
                                    textAlign: 'center', 
                                    p: { xs: 1.5, md: 2 }, 
                                    background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.15) 0%, rgba(33, 150, 243, 0.05) 100%)', 
                                    borderRadius: 3, 
                                    border: '2px solid #2196F340',
                                    height: 90,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    transition: 'all 0.3s ease',
                                    boxShadow: '0 4px 16px rgba(33, 150, 243, 0.2)',
                                    '&:hover': {
                                      transform: 'translateY(-4px) scale(1.05)',
                                      boxShadow: '0 8px 24px rgba(33, 150, 243, 0.3)',
                                      border: '2px solid #2196F3'
                                    }
                                  }}>
                                    <Typography variant="h5" sx={{ 
                                      color: '#2196F3', 
                                      fontFamily: 'Roboto Mono, monospace', 
                                      fontWeight: 800,
                                      fontSize: { xs: '1.1rem', md: '1.4rem' },
                                      mb: 0.5,
                                      textShadow: '0 0 8px rgba(33, 150, 243, 0.4)'
                                    }}>
                                      ₹{fmtNum(analytics.fundMovementAnalysis.finalMargin)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ 
                                      color: '#90CAF9', 
                                      fontSize: { xs: '0.7rem', md: '0.75rem' },
                                      fontWeight: 600
                                    }}>
                                      🏆 Final Capital
                                    </Typography>
                                  </Box>
                                </Grid>
                                <Grid item xs={4}>
                                  <Box sx={{ 
                                    textAlign: 'center', 
                                    p: { xs: 1.5, md: 2 }, 
                                    background: analytics.fundMovementAnalysis.changePercent >= 0 
                                      ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(76, 175, 80, 0.05) 100%)' 
                                      : 'linear-gradient(135deg, rgba(244, 67, 54, 0.15) 0%, rgba(244, 67, 54, 0.05) 100%)', 
                                    borderRadius: 3, 
                                    border: analytics.fundMovementAnalysis.changePercent >= 0 
                                      ? '2px solid #4CAF5040' 
                                      : '2px solid #F4433640',
                                    height: 90,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    transition: 'all 0.3s ease',
                                    boxShadow: analytics.fundMovementAnalysis.changePercent >= 0 
                                      ? '0 4px 16px rgba(76, 175, 80, 0.2)' 
                                      : '0 4px 16px rgba(244, 67, 54, 0.2)',
                                    '&:hover': {
                                      transform: 'translateY(-4px) scale(1.05)',
                                      boxShadow: analytics.fundMovementAnalysis.changePercent >= 0 
                                        ? '0 8px 24px rgba(76, 175, 80, 0.3)' 
                                        : '0 8px 24px rgba(244, 67, 54, 0.3)',
                                      border: analytics.fundMovementAnalysis.changePercent >= 0 
                                        ? '2px solid #4CAF50' 
                                        : '2px solid #F44336'
                                    }
                                  }}>
                                    <Typography variant="h5" sx={{ 
                                      color: analytics.fundMovementAnalysis.changePercent >= 0 ? '#4CAF50' : '#F44336', 
                                      fontFamily: 'Roboto Mono, monospace', 
                                      fontWeight: 800,
                                      fontSize: { xs: '1.1rem', md: '1.4rem' },
                                      mb: 0.5,
                                      textShadow: analytics.fundMovementAnalysis.changePercent >= 0 
                                        ? '0 0 8px rgba(76, 175, 80, 0.4)' 
                                        : '0 0 8px rgba(244, 67, 54, 0.4)'
                                    }}>
                                      {analytics.fundMovementAnalysis.changePercent >= 0 ? '+' : ''}{fmtNum(analytics.fundMovementAnalysis.changePercent, 2)}%
                                    </Typography>
                                    <Typography variant="caption" sx={{ 
                                      color: analytics.fundMovementAnalysis.changePercent >= 0 ? '#A5D6A7' : '#FFCDD2',
                                      fontSize: { xs: '0.7rem', md: '0.75rem' },
                                      fontWeight: 600
                                    }}>
                                      {analytics.fundMovementAnalysis.changePercent >= 0 ? '📈' : '📉'} ROI
                                    </Typography>
                                  </Box>
                                </Grid>
                              </Grid>
                              
                              <Typography variant="body2" sx={{ color: '#e0e0e0', mb: 2, textAlign: 'center' }}>
                                Track how your capital moved through {analytics.fundMovementAnalysis.marginHistory?.length || 0} trading steps
                              </Typography>
                              
                              {/* Simple margin progression visualization */}
                              <Box sx={{ 
                                height: 120, 
                                bgcolor: 'rgba(255,255,255,0.05)', 
                                borderRadius: 2, 
                                p: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid rgba(0, 255, 170, 0.2)'
                              }}>
                                <Typography variant="body2" sx={{ color: '#00ffaa', textAlign: 'center' }}>
                                  📈 Your capital {analytics.fundMovementAnalysis.changePercent >= 0 ? 'grew' : 'decreased'} by{' '}
                                  <strong>₹{fmtNum(Math.abs(analytics.fundMovementAnalysis.totalChange))}</strong>{' '}
                                  ({analytics.fundMovementAnalysis.changePercent >= 0 ? '+' : ''}{fmtNum(analytics.fundMovementAnalysis.changePercent, 2)}%)
                                  <br />
                                  <Typography component="span" variant="caption" sx={{ color: '#a0a0a0' }}>
                                    Based on actual available margin changes in your trading account
                                  </Typography>
                                </Typography>
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      {/* Fund Movement Details */}
                      <Grid item xs={12} md={4}>
                        <Card sx={{ 
                          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%)',
                          border: '2px solid #00ffaa40',
                          borderRadius: 3,
                          height: 350,
                          boxShadow: '0 4px 16px rgba(0, 255, 170, 0.15)',
                          transition: 'all 0.3s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 24px rgba(0, 255, 170, 0.25)'
                          }
                        }}>
                          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="subtitle2" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>
                              Capital Efficiency
                            </Typography>
                            <Stack spacing={2} sx={{ flex: 1 }}>
                              <Box sx={{ 
                                p: 2, 
                                bgcolor: 'rgba(0, 255, 170, 0.05)', 
                                border: '1px solid #00ffaa20', 
                                borderRadius: 1,
                                height: 80,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center'
                              }}>
                                <Typography variant="body2" sx={{ color: '#a7ffeb', fontWeight: 600, mb: 1 }}>
                                  Maximum Deployed
                                </Typography>
                                <Typography variant="h6" sx={{ color: '#00ffaa', fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>
                                  ₹{fmtNum(Math.max(...(analytics.fundMovementAnalysis.marginHistory?.map(h => h.used_margin || 0) || [0])))}
                                </Typography>
                              </Box>
                              
                              <Box sx={{ 
                                p: 2, 
                                bgcolor: 'rgba(255, 193, 7, 0.05)', 
                                border: '1px solid #FFC10720', 
                                borderRadius: 1,
                                height: 80,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center'
                              }}>
                                <Typography variant="body2" sx={{ color: '#fff59d', fontWeight: 600, mb: 1 }}>
                                  Capital Utilization
                                </Typography>
                                <Typography variant="h6" sx={{ color: '#FFC107', fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>
                                  {analytics.fundMovementAnalysis.initialMargin > 0 
                                    ? fmtNum((Math.max(...(analytics.fundMovementAnalysis.marginHistory?.map(h => h.used_margin || 0) || [0])) / analytics.fundMovementAnalysis.initialMargin) * 100, 1)
                                    : 0}%
                                </Typography>
                              </Box>
                              
                              <Box sx={{ 
                                p: 2, 
                                bgcolor: 'rgba(156, 39, 176, 0.05)', 
                                border: '1px solid #9C27B020', 
                                borderRadius: 1,
                                height: 80,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center'
                              }}>
                                <Typography variant="body2" sx={{ color: '#ce93d8', fontWeight: 600, mb: 1 }}>
                                  Trading Sessions
                                </Typography>
                                <Typography variant="h6" sx={{ color: '#9C27B0', fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>
                                  {analytics.fundMovementAnalysis.marginHistory?.length || 0}
                                </Typography>
                              </Box>
                            </Stack>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                  </>
                )}

                {/* Advanced Trade Distribution Analysis */}
                <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>
                  � Trade Size & Impact Distribution
                </Typography>
                <Grid container spacing={2} sx={{ mb: 4 }}>
                  <Grid item xs={12} md={6}>
                    <Card sx={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid #00ffaa30', height: '100%' }}>
                      <CardContent>
                        <Typography variant="subtitle1" sx={{ color: '#00ffaa', fontWeight: 700, mb: 2 }}>
                          📈 Winning Trades Breakdown
                        </Typography>
                        
                        {(() => {
                          const profitTrades = rows.filter(r => !r.in_progress && (r.total_matched_pnl || 0) > 0)
                            .sort((a, b) => (b.total_matched_pnl || 0) - (a.total_matched_pnl || 0));
                          
                          const bigWins = profitTrades.filter(t => (t.total_matched_pnl || 0) > analytics.avgProfit * 1.5);
                          const mediumWins = profitTrades.filter(t => (t.total_matched_pnl || 0) <= analytics.avgProfit * 1.5 && (t.total_matched_pnl || 0) >= analytics.avgProfit * 0.5);
                          const smallWins = profitTrades.filter(t => (t.total_matched_pnl || 0) < analytics.avgProfit * 0.5);
                          
                          const bigWinsTotal = bigWins.reduce((sum, t) => sum + (t.total_matched_pnl || 0), 0);
                          const bigWinsPct = analytics.totalProfit > 0 ? (bigWinsTotal / analytics.totalProfit) * 100 : 0;
                          
                          return (
                            <Stack spacing={2}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 1 }}>
                                <Box>
                                  <Typography variant="body2" sx={{ color: '#4CAF50', fontWeight: 600 }}>Big Wins (1.5x+ avg)</Typography>
                                  <Typography variant="caption" sx={{ color: '#a5d6a7' }}>{bigWins.length} trades</Typography>
                                </Box>
                                <Box sx={{ textAlign: 'right' }}>
                                  <Typography variant="h6" sx={{ color: '#4CAF50', fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>
                                    ₹{fmtNum(bigWinsTotal)}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#a5d6a7' }}>
                                    {fmtNum(bigWinsPct, 1)}% of total profits
                                  </Typography>
                                </Box>
                              </Box>
                              
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'rgba(139, 195, 74, 0.1)', borderRadius: 1 }}>
                                <Box>
                                  <Typography variant="body2" sx={{ color: '#8BC34A', fontWeight: 600 }}>Medium Wins</Typography>
                                  <Typography variant="caption" sx={{ color: '#aed581' }}>{mediumWins.length} trades</Typography>
                                </Box>
                                <Typography variant="body1" sx={{ color: '#8BC34A', fontFamily: 'Roboto Mono, monospace', fontWeight: 600 }}>
                                  ₹{fmtNum(mediumWins.reduce((sum, t) => sum + (t.total_matched_pnl || 0), 0))}
                                </Typography>
                              </Box>
                              
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'rgba(205, 220, 57, 0.1)', borderRadius: 1 }}>
                                <Box>
                                  <Typography variant="body2" sx={{ color: '#CDDC39', fontWeight: 600 }}>Small Wins</Typography>
                                  <Typography variant="caption" sx={{ color: '#dce775' }}>{smallWins.length} trades</Typography>
                                </Box>
                                <Typography variant="body1" sx={{ color: '#CDDC39', fontFamily: 'Roboto Mono, monospace', fontWeight: 600 }}>
                                  ₹{fmtNum(smallWins.reduce((sum, t) => sum + (t.total_matched_pnl || 0), 0))}
                                </Typography>
                              </Box>
                              
                              {bigWins.length > 0 && (
                                <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255, 235, 59, 0.1)', borderRadius: 1 }}>
                                  <Typography variant="caption" sx={{ color: '#fff9c4', fontStyle: 'italic' }}>
                                    💡 <strong>Key Insight:</strong> Your {bigWins.length} biggest wins ({fmtNum(bigWins.length / analytics.totalTrades * 100, 1)}% of all trades) 
                                    generated {fmtNum(bigWinsPct, 1)}% of your total profits. This shows excellent trade selection!
                                  </Typography>
                                </Box>
                              )}
                            </Stack>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Card sx={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid #00ffaa30', height: '100%' }}>
                      <CardContent>
                        <Typography variant="subtitle1" sx={{ color: '#00ffaa', fontWeight: 700, mb: 2 }}>
                          📉 Loss Control Analysis
                        </Typography>
                        
                        {(() => {
                          const lossTrades = rows.filter(r => !r.in_progress && (r.total_matched_pnl || 0) < 0)
                            .sort((a, b) => (a.total_matched_pnl || 0) - (b.total_matched_pnl || 0));
                          
                          const bigLosses = lossTrades.filter(t => Math.abs(t.total_matched_pnl || 0) > analytics.avgLoss * 1.5);
                          const mediumLosses = lossTrades.filter(t => Math.abs(t.total_matched_pnl || 0) <= analytics.avgLoss * 1.5 && Math.abs(t.total_matched_pnl || 0) >= analytics.avgLoss * 0.5);
                          const smallLosses = lossTrades.filter(t => Math.abs(t.total_matched_pnl || 0) < analytics.avgLoss * 0.5);
                          
                          const lossControlRating = bigLosses.length === 0 ? 'Excellent' : bigLosses.length <= 2 ? 'Good' : 'Needs Improvement';
                          const lossControlColor = lossControlRating === 'Excellent' ? '#4CAF50' : lossControlRating === 'Good' ? '#FF9800' : '#F44336';
                          
                          return (
                            <Stack spacing={2}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'rgba(244, 67, 54, 0.1)', borderRadius: 1 }}>
                                <Box>
                                  <Typography variant="body2" sx={{ color: '#F44336', fontWeight: 600 }}>Big Losses (1.5x+ avg)</Typography>
                                  <Typography variant="caption" sx={{ color: '#ef9a9a' }}>{bigLosses.length} trades</Typography>
                                </Box>
                                <Typography variant="body1" sx={{ color: '#F44336', fontFamily: 'Roboto Mono, monospace', fontWeight: 600 }}>
                                  ₹{fmtNum(Math.abs(bigLosses.reduce((sum, t) => sum + (t.total_matched_pnl || 0), 0)))}
                                </Typography>
                              </Box>
                              
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'rgba(255, 152, 0, 0.1)', borderRadius: 1 }}>
                                <Box>
                                  <Typography variant="body2" sx={{ color: '#FF9800', fontWeight: 600 }}>Medium Losses</Typography>
                                  <Typography variant="caption" sx={{ color: '#ffcc80' }}>{mediumLosses.length} trades</Typography>
                                </Box>
                                <Typography variant="body1" sx={{ color: '#FF9800', fontFamily: 'Roboto Mono, monospace', fontWeight: 600 }}>
                                  ₹{fmtNum(Math.abs(mediumLosses.reduce((sum, t) => sum + (t.total_matched_pnl || 0), 0)))}
                                </Typography>
                              </Box>
                              
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'rgba(255, 193, 7, 0.1)', borderRadius: 1 }}>
                                <Box>
                                  <Typography variant="body2" sx={{ color: '#FFC107', fontWeight: 600 }}>Small Losses (Controlled)</Typography>
                                  <Typography variant="caption" sx={{ color: '#fff9c4' }}>{smallLosses.length} trades</Typography>
                                </Box>
                                <Typography variant="body1" sx={{ color: '#FFC107', fontFamily: 'Roboto Mono, monospace', fontWeight: 600 }}>
                                  ₹{fmtNum(Math.abs(smallLosses.reduce((sum, t) => sum + (t.total_matched_pnl || 0), 0)))}
                                </Typography>
                              </Box>
                              
                              <Box sx={{ mt: 2, p: 2, bgcolor: `rgba(${lossControlColor.slice(1, 3)}, ${lossControlColor.slice(3, 5)}, ${lossControlColor.slice(5, 7)}, 0.1)`, borderRadius: 1 }}>
                                <Typography variant="body2" sx={{ color: lossControlColor, fontWeight: 700, mb: 1 }}>
                                  Loss Control: {lossControlRating}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#e0e0e0', fontStyle: 'italic' }}>
                                  {lossControlRating === 'Excellent' 
                                    ? '🎯 Perfect! No big losses means excellent risk management.'
                                    : lossControlRating === 'Good'
                                    ? '👍 Good control with minimal big losses. Keep it up!'
                                    : '⚠️ Consider tightening stop losses to avoid large losses.'
                                  }
                                </Typography>
                              </Box>
                            </Stack>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Enhanced Key Performance Indicators */}
                <Typography variant="h6" sx={{ 
                  color: '#00ffaa', 
                  mb: 4, 
                  fontWeight: 700,
                  fontSize: { xs: '1.1rem', md: '1.3rem' },
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1.5,
                  '&::before': {
                    content: '"🎯"',
                    fontSize: '1.5rem',
                    filter: 'drop-shadow(0 0 8px rgba(0, 255, 170, 0.6))'
                  }
                }}>
                  Trading Performance KPIs
                </Typography>
                <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: 5 }}>
                  <Grid item xs={6} md={3}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, rgba(0, 255, 170, 0.12) 0%, rgba(0, 200, 150, 0.08) 50%, rgba(0, 150, 120, 0.04) 100%)', 
                      border: '2px solid #00ffaa50', 
                      textAlign: 'center',
                      height: 160,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                      boxShadow: '0 8px 32px rgba(0, 255, 170, 0.25)',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(135deg, rgba(0, 255, 170, 0.02), rgba(0, 150, 120, 0.02))',
                        zIndex: 1
                      },
                      '&:hover': {
                        transform: 'translateY(-8px) scale(1.05)',
                        boxShadow: '0 16px 48px rgba(0, 255, 170, 0.4)',
                        border: '2px solid #00ffaa',
                        '& .kpi-content': {
                          transform: 'scale(1.1)'
                        }
                      }
                    }}>
                      <CardContent sx={{ 
                        p: { xs: 1.5, md: 2 }, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        height: '100%',
                        width: '100%',
                        position: 'relative',
                        zIndex: 2,
                        transition: 'all 0.3s ease'
                      }} className="kpi-content">
                        <Typography variant="h3" sx={{ 
                          color: '#00ffaa', 
                          fontFamily: 'Roboto Mono, monospace', 
                          fontWeight: 800,
                          fontSize: { xs: '2rem', md: '2.5rem' },
                          mb: 1,
                          textShadow: '0 0 20px rgba(0, 255, 170, 0.6)'
                        }}>
                          {analytics.totalTrades}
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          color: '#A7FFEB', 
                          fontWeight: 700,
                          fontSize: { xs: '0.85rem', md: '0.95rem' },
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          📋 Total Trades
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={6} md={3}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.12) 0%, rgba(56, 142, 60, 0.08) 50%, rgba(46, 125, 50, 0.04) 100%)', 
                      border: '2px solid #4CAF5050', 
                      textAlign: 'center',
                      height: 160,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                      boxShadow: '0 8px 32px rgba(76, 175, 80, 0.25)',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.02), rgba(46, 125, 50, 0.02))',
                        zIndex: 1
                      },
                      '&:hover': {
                        transform: 'translateY(-8px) scale(1.05)',
                        boxShadow: '0 16px 48px rgba(76, 175, 80, 0.4)',
                        border: '2px solid #4CAF50',
                        '& .kpi-content': {
                          transform: 'scale(1.1)'
                        }
                      }
                    }}>
                      <CardContent sx={{ 
                        p: { xs: 1.5, md: 2 }, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        height: '100%',
                        width: '100%',
                        position: 'relative',
                        zIndex: 2,
                        transition: 'all 0.3s ease'
                      }} className="kpi-content">
                        <Typography variant="h3" sx={{ 
                          color: '#4CAF50', 
                          fontFamily: 'Roboto Mono, monospace', 
                          fontWeight: 800,
                          fontSize: { xs: '1.8rem', md: '2.2rem' },
                          mb: 0.5,
                          textShadow: '0 0 20px rgba(76, 175, 80, 0.6)'
                        }}>
                          {fmtNum(analytics.winRate, 1)}%
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          color: '#A5D6A7', 
                          fontWeight: 700,
                          fontSize: { xs: '0.8rem', md: '0.9rem' },
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          mb: 0.5
                        }}>
                          🏆 Win Rate
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          color: '#81C784', 
                          display: 'block',
                          fontSize: { xs: '0.7rem', md: '0.75rem' },
                          fontWeight: 600,
                          bgcolor: 'rgba(76, 175, 80, 0.1)',
                          px: 1,
                          py: 0.25,
                          borderRadius: 1
                        }}>
                          {analytics.wins}W / {analytics.losses}L
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={6} md={3}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, rgba(255, 235, 59, 0.12) 0%, rgba(255, 213, 79, 0.08) 50%, rgba(255, 193, 7, 0.04) 100%)', 
                      border: '2px solid #FFEB3B50', 
                      textAlign: 'center',
                      height: 160,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                      boxShadow: '0 8px 32px rgba(255, 235, 59, 0.25)',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(135deg, rgba(255, 235, 59, 0.02), rgba(255, 193, 7, 0.02))',
                        zIndex: 1
                      },
                      '&:hover': {
                        transform: 'translateY(-8px) scale(1.05)',
                        boxShadow: '0 16px 48px rgba(255, 235, 59, 0.4)',
                        border: '2px solid #FFEB3B',
                        '& .kpi-content': {
                          transform: 'scale(1.1)'
                        }
                      }
                    }}>
                      <CardContent sx={{ 
                        p: { xs: 1.5, md: 2 }, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        height: '100%',
                        width: '100%',
                        position: 'relative',
                        zIndex: 2,
                        transition: 'all 0.3s ease'
                      }} className="kpi-content">
                        <Typography variant="h3" sx={{ 
                          color: '#FFEB3B', 
                          fontFamily: 'Roboto Mono, monospace', 
                          fontWeight: 800,
                          fontSize: { xs: '1.8rem', md: '2.2rem' },
                          mb: 1,
                          textShadow: '0 0 20px rgba(255, 235, 59, 0.6)'
                        }}>
                          {analytics.profitFactor === Infinity ? '∞' : fmtNum(analytics.profitFactor, 1)}x
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          color: '#FFF59D', 
                          fontWeight: 700,
                          fontSize: { xs: '0.85rem', md: '0.95rem' },
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          💰 Profit Factor
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={6} md={3}>
                    <Card sx={{ 
                      background: analytics.portfolioPnLPct >= 0 
                        ? 'linear-gradient(135deg, rgba(33, 150, 243, 0.12) 0%, rgba(30, 136, 229, 0.08) 50%, rgba(25, 118, 210, 0.04) 100%)' 
                        : 'linear-gradient(135deg, rgba(244, 67, 54, 0.12) 0%, rgba(229, 57, 53, 0.08) 50%, rgba(211, 47, 47, 0.04) 100%)', 
                      border: `2px solid ${analytics.portfolioPnLPct >= 0 ? '#2196F350' : '#F4433650'}`, 
                      textAlign: 'center',
                      height: 160,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                      boxShadow: `0 8px 32px ${analytics.portfolioPnLPct >= 0 ? 'rgba(33, 150, 243, 0.25)' : 'rgba(244, 67, 54, 0.25)'}`,
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: analytics.portfolioPnLPct >= 0 
                          ? 'linear-gradient(135deg, rgba(33, 150, 243, 0.02), rgba(25, 118, 210, 0.02))' 
                          : 'linear-gradient(135deg, rgba(244, 67, 54, 0.02), rgba(211, 47, 47, 0.02))',
                        zIndex: 1
                      },
                      '&:hover': {
                        transform: 'translateY(-8px) scale(1.05)',
                        boxShadow: `0 16px 48px ${analytics.portfolioPnLPct >= 0 ? 'rgba(33, 150, 243, 0.4)' : 'rgba(244, 67, 54, 0.4)'}`,
                        border: `2px solid ${analytics.portfolioPnLPct >= 0 ? '#2196F3' : '#F44336'}`,
                        '& .kpi-content': {
                          transform: 'scale(1.1)'
                        }
                      }
                    }}>
                      <CardContent sx={{ 
                        p: { xs: 1.5, md: 2 }, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        height: '100%',
                        width: '100%',
                        position: 'relative',
                        zIndex: 2,
                        transition: 'all 0.3s ease'
                      }} className="kpi-content">
                        <Typography variant="h3" sx={{ 
                          color: analytics.avgPnL >= 0 ? '#2196F3' : '#F44336', 
                          fontFamily: 'Roboto Mono, monospace', 
                          fontWeight: 800,
                          fontSize: { xs: '1.8rem', md: '2.2rem' },
                          mb: 1,
                          textShadow: `0 0 20px ${analytics.avgPnL >= 0 ? 'rgba(33, 150, 243, 0.6)' : 'rgba(244, 67, 54, 0.6)'}`
                        }}>
                          ₹{fmtNum(analytics.avgPnL)}
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          color: analytics.avgPnL >= 0 ? '#90CAF9' : '#FFCDD2', 
                          fontWeight: 700,
                          fontSize: { xs: '0.85rem', md: '0.95rem' },
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          📊 Avg P&L/Trade
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Tag-Based Analysis */}
                <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>
                  🏷️ Tag-Based P&L Analysis
                </Typography>
                <TableContainer component={Paper} sx={{ 
                  mb: 4, 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  overflowX: 'auto',
                  maxWidth: '100%'
                }}>
                  <Table size="small" sx={{ 
                    minWidth: { xs: '280px', sm: 'auto' },
                    tableLayout: { xs: 'fixed', sm: 'auto' },
                    '& .MuiTableCell-root': {
                      px: { xs: 0.3, sm: 1, md: 2 },
                      py: { xs: 0.3, sm: 0.5, md: 1 },
                      fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.875rem' },
                      lineHeight: { xs: 1.1, sm: 1.3 },
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      '&:first-of-type': {
                        width: { xs: '35%', sm: 'auto' }
                      },
                      '&:nth-of-type(2)': {
                        width: { xs: '25%', sm: 'auto' }
                      },
                      '&:nth-of-type(3)': {
                        width: { xs: '40%', sm: 'auto' }
                      }
                    }
                  }}>
                    <TableHead>
                      <TableRow sx={{ background: 'rgba(0, 255, 170, 0.1)' }}>
                        <TableCell sx={{ color: '#00ffaa', fontWeight: 700 }}>Tag</TableCell>
                        <TableCell align="right" sx={{ color: '#00ffaa', fontWeight: 700 }}>Trades</TableCell>
                        <TableCell align="right" sx={{ color: '#00ffaa', fontWeight: 700 }}>P&L</TableCell>
                        <TableCell align="right" sx={{ color: '#00ffaa', fontWeight: 700 }}>Avg P&L</TableCell>
                        <TableCell align="right" sx={{ color: '#00ffaa', fontWeight: 700 }}>Wins</TableCell>
                        <TableCell align="right" sx={{ color: '#00ffaa', fontWeight: 700 }}>Losses</TableCell>
                        <TableCell align="right" sx={{ color: '#00ffaa', fontWeight: 700 }}>Win Rate</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analytics.tagAnalysis.map((tag, idx) => (
                        <TableRow key={idx} sx={{ '&:hover': { background: 'rgba(0, 255, 170, 0.05)' } }}>
                          <TableCell sx={{ color: '#e0e0e0' }}>
                            <Chip 
                              label={tag.tag} 
                              size="small" 
                              sx={{ 
                                bgcolor: 'rgba(0, 255, 170, 0.15)', 
                                color: '#00ffaa',
                                border: '1px solid #00ffaa50'
                              }} 
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#e0e0e0', fontFamily: 'Roboto Mono, monospace' }}>
                            {tag.count}
                          </TableCell>
                          <TableCell align="right" sx={{ 
                            color: tag.pnl >= 0 ? '#4CAF50' : '#F44336',
                            fontFamily: 'Roboto Mono, monospace',
                            fontWeight: 700
                          }}>
                            ₹{fmtNum(tag.pnl)}
                          </TableCell>
                          <TableCell align="right" sx={{ 
                            color: tag.avgPnL >= 0 ? '#4CAF50' : '#F44336',
                            fontFamily: 'Roboto Mono, monospace'
                          }}>
                            ₹{fmtNum(tag.avgPnL)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#4CAF50', fontFamily: 'Roboto Mono, monospace' }}>
                            {tag.wins}
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#F44336', fontFamily: 'Roboto Mono, monospace' }}>
                            {tag.losses}
                          </TableCell>
                          <TableCell align="right" sx={{ 
                            color: tag.winRate >= 50 ? '#4CAF50' : '#F44336',
                            fontFamily: 'Roboto Mono, monospace',
                            fontWeight: 600
                          }}>
                            {fmtNum(tag.winRate, 1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Signal Type Analysis */}
                <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>
                  📡 Signal Type Performance
                </Typography>
                <TableContainer component={Paper} sx={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  overflowX: 'auto',
                  maxWidth: '100%'
                }}>
                  <Table size="small" sx={{ 
                    minWidth: { xs: '280px', sm: 'auto' },
                    tableLayout: { xs: 'fixed', sm: 'auto' },
                    '& .MuiTableCell-root': {
                      px: { xs: 0.3, sm: 1, md: 2 },
                      py: { xs: 0.3, sm: 0.5, md: 1 },
                      fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.875rem' },
                      lineHeight: { xs: 1.1, sm: 1.3 },
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      '&:first-of-type': {
                        width: { xs: '30%', sm: 'auto' }
                      }
                    }
                  }}>
                    <TableHead>
                      <TableRow sx={{ background: 'rgba(0, 255, 170, 0.1)' }}>
                        <TableCell sx={{ color: '#00ffaa', fontWeight: 700 }}>Signal Type</TableCell>
                        <TableCell align="right" sx={{ color: '#00ffaa', fontWeight: 700 }}>Trades</TableCell>
                        <TableCell align="right" sx={{ color: '#00ffaa', fontWeight: 700 }}>P&L</TableCell>
                        <TableCell align="right" sx={{ color: '#00ffaa', fontWeight: 700 }}>Wins</TableCell>
                        <TableCell align="right" sx={{ color: '#00ffaa', fontWeight: 700 }}>Losses</TableCell>
                        <TableCell align="right" sx={{ color: '#00ffaa', fontWeight: 700 }}>Win Rate</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analytics.signalAnalysis.map((signal, idx) => (
                        <TableRow key={idx} sx={{ '&:hover': { background: 'rgba(0, 255, 170, 0.05)' } }}>
                          <TableCell sx={{ color: '#e0e0e0' }}>
                            <Chip 
                              label={signal.signal} 
                              size="small" 
                              sx={{ 
                                bgcolor: 'rgba(33, 150, 243, 0.15)', 
                                color: '#2196F3',
                                border: '1px solid #2196F350'
                              }} 
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#e0e0e0', fontFamily: 'Roboto Mono, monospace' }}>
                            {signal.count}
                          </TableCell>
                          <TableCell align="right" sx={{ 
                            color: signal.pnl >= 0 ? '#4CAF50' : '#F44336',
                            fontFamily: 'Roboto Mono, monospace',
                            fontWeight: 700
                          }}>
                            ₹{fmtNum(signal.pnl)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#4CAF50', fontFamily: 'Roboto Mono, monospace' }}>
                            {signal.wins}
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#F44336', fontFamily: 'Roboto Mono, monospace' }}>
                            {signal.losses}
                          </TableCell>
                          <TableCell align="right" sx={{ 
                            color: signal.winRate >= 50 ? '#4CAF50' : '#F44336',
                            fontFamily: 'Roboto Mono, monospace',
                            fontWeight: 600
                          }}>
                            {fmtNum(signal.winRate, 1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

      </Container>
    </>
  );
}

export default TradeAnalysis;
