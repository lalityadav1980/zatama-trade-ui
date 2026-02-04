import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Container, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Button, Dialog, DialogTitle, DialogContent, IconButton, Typography,
  Box, CircularProgress, Tooltip, Stack, useMediaQuery, useTheme,
  Menu, MenuItem, Checkbox, Chip, Divider, Grid, Card, CardContent,
  LinearProgress, FormControl, InputLabel, Select, DialogActions, Switch, FormControlLabel,
  FormGroup, Radio, RadioGroup
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import DensitySmallIcon from '@mui/icons-material/DensitySmall';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BarChartIcon from '@mui/icons-material/BarChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { httpApi } from './api';
import moment from 'moment';
import CustomAppBar from './CustomAppBar';

// -------------------------
// Helpers
// -------------------------
const isDateKey = (k) => /date|time|ts|timestamp/i.test(k);

// Parse a variety of timestamp shapes and then render in IST.
const parseToMoment = (val) => {
  if (val == null && val !== 0) return null;
  if (typeof val === 'number') return moment(val); // epoch ms
  if (typeof val === 'string') {
    const hasZone = /[zZ]|[+\-]\d{2}:\d{2}$/.test(val);
    return hasZone ? moment.parseZone(val) : moment.utc(val);
  }
  return moment(val);
};

const formatToIST = (val) => {
  const m = parseToMoment(val);
  return m && m.isValid()
    ? m.utcOffset(330).format('DD-MMM-YYYY HH:mm:ss')
    : String(val ?? '');
};

const humanize = (k) =>
  k === 'nifty_ltp' ? 'NIFTY LTP'
  : k === 'pnl_pct_of_cost' ? 'PnL % of Cost'
  : k === 'buy_cost_total' ? 'Investment'
  : k === 'buy_qty' ? 'Qty'
  : k === 'buy_price' ? 'Buy Price'
  : k === 'sell_price' ? 'Sell Price'
  : k === 'tag' ? 'Tag'
  : k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const renderValue = (key, value) =>
  (value == null
    ? ''
    : isDateKey(key)
      ? formatToIST(value)
      : typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : String(value));

const fmtNum = (n, d = 2) => (Number.isFinite(Number(n)) ? Number(n).toFixed(d) : String(n ?? ''));
const sum = (arr) => arr.reduce((acc, v) => acc + (Number(v) || 0), 0);

// --- Cost helpers ---
const grossBuyCost = (trades = []) => {
  return trades
    .filter(t => String(t.transaction_type).toUpperCase() === 'BUY')
    .reduce((acc, t) => acc + (Number.isFinite(+t.buy_cost)
      ? +t.buy_cost
      : (+t.average_price || 0) * (+t.filled_quantity || 0)), 0);
};

const grossSellValue = (trades = []) => {
  return trades
    .filter(t => String(t.transaction_type).toUpperCase() === 'SELL')
    .reduce((acc, t) => acc + (Number.isFinite(+t.sell_cost)
      ? +t.sell_cost
      : (+t.average_price || 0) * (+t.filled_quantity || 0)), 0);
};

// Parse the reasons string into sections like WHY, PCR, FLOW, CAPS, MTF, META, OTHER
const parseReasons = (text = '') => {
  if (!text) return [];
  const parts = text.split(/\s\|\s/g);
  return parts.map((p) => {
    const m = p.match(/^([A-Z/ ]+):\s*(.*)$/);
    return m ? { section: m[1].trim().toUpperCase(), body: m[2] } : { section: 'WHY', body: p };
  });
};

// extract inline metrics from a free-text body
const pickInlineMetrics = (body) => {
  const out = [];
  const rx = [
    [/roc=([+\-]?[0-9.]+)%\/min/i, (v) => ({ label: 'Premium ROC %/min', value: v })],
    [/vol[×x]([0-9.]+)/i, (v) => ({ label: 'Vol×', value: v })],
    [/price_mom(?:entum)?=([+\-]?[0-9.]+)/i, (v) => ({ label: 'Price Momentum', value: v })],
    [/pcr_mom(?:entum)?=([+\-]?[0-9.]+)/i, (v) => ({ label: 'PCR Momentum', value: v })],
    [/CE=([0-9.]+) \(n=([0-9]+)/i, (v, n) => ({ label: 'FLOW CE Ratio', value: v, extra: `n=${n}` })],
    [/PE=([0-9.]+) \(n=([0-9]+)/i, (v, n) => ({ label: 'FLOW PE Ratio', value: v, extra: `n=${n}` })],
  ];
  rx.forEach(([re, map]) => {
    const m = body.match(re);
    if (m) out.push(map(m[1], m[2]));
  });
  return out;
};

// A colored chip helper
const ChipKV = ({ label, value, color = '#e0e0e0', border }) => (
  <Chip
    size="small"
    label={
      <span style={{ display: 'inline-flex', gap: { xs: 4, md: 6 } }}>
        <b style={{ opacity: 0.9, fontSize: 'inherit' }}>{label}:</b>
        <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 'inherit' }}>{value}</span>
      </span>
    }
    sx={{ 
      bgcolor: 'rgba(255,255,255,0.08)', 
      color, 
      border: border ? `1px solid ${border}` : '1px solid rgba(255,255,255,0.25)',
      fontSize: { xs: '0.65rem', md: '0.75rem' },
      height: { xs: 'auto', md: '24px' },
      '& .MuiChip-label': {
        fontSize: 'inherit',
        px: { xs: 1, md: 1.5 },
        py: { xs: 0.25, md: 0.5 }
      }
    }}
  />
);

// Compact boolean chip
const BoolChip = ({ label, value }) => (
  <Chip
    size="small"
    label={`${label}: ${String(!!value).toUpperCase()}`}
    sx={{
      bgcolor: value ? 'rgba(76,175,80,0.25)' : 'rgba(244,67,54,0.25)',
      color: value ? '#81C784' : '#EF5350',
      border: `1px solid ${value ? '#4CAF5080' : '#F4433680'}`
    }}
  />
);

// -------------------------
// Analytics computation
// -------------------------
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

// -------------------------
// Custom Chart Components
// -------------------------

// Beautiful Donut Chart Component
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

// A compact header line for one fusion row
const FusionHeader = ({ f }) => (
  <Stack 
    direction={{ xs: 'column', md: 'row' }} 
    spacing={{ xs: 1, md: 1.2 }} 
    alignItems={{ xs: 'flex-start', md: 'center' }} 
    justifyContent="space-between"
  >
    <Stack 
      direction={{ xs: 'column', sm: 'row' }} 
      spacing={{ xs: 0.5, sm: 1 }} 
      alignItems={{ xs: 'flex-start', sm: 'center' }} 
      flexWrap="wrap"
      sx={{ width: { xs: '100%', md: 'auto' } }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
        <Chip 
          size="small" 
          label={f.signal_type || '-'} 
          sx={{ 
            bgcolor: (f.signal_type||'').includes('CE') ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)', 
            color: (f.signal_type||'').includes('CE') ? '#4CAF50' : '#F44336', 
            border: `1px solid ${(f.signal_type||'').includes('CE') ? '#4CAF5050' : '#F4433650'}`,
            fontSize: { xs: '0.65rem', md: '0.75rem' }
          }} 
        />
      </Stack>
      <Typography sx={{ 
        color: '#ffeb99', 
        fontWeight: 600,
        fontSize: { xs: '0.875rem', md: '1rem' }
      }}>{f.symbol}</Typography>
      <Typography sx={{ 
        color: '#9ecbff',
        fontSize: { xs: '0.75rem', md: '0.875rem' }
      }}>
        {formatToIST(f.event_ts)} <span style={{ opacity: 0.7, fontSize: { xs: 10, md: 12 } }}>IST</span>
      </Typography>
    </Stack>
    <Stack 
      direction={{ xs: 'row', md: 'row' }} 
      spacing={{ xs: 0.5, md: 1 }} 
      alignItems="center" 
      flexWrap="wrap"
      sx={{ 
        width: { xs: '100%', md: 'auto' },
        justifyContent: { xs: 'flex-start', md: 'flex-end' }
      }}
    >
      {f.trace && <ChipKV label="Trace" value={f.trace} color="#b3e5fc" />}
      {Number.isFinite(+f.nifty_ltp) && <ChipKV label="NIFTY LTP" value={fmtNum(f.nifty_ltp)} color="#b3e5fc" />}
      {f.parent_order_id && <ChipKV label="Parent" value={String(f.parent_order_id).slice(0,12)+"…"} color="#b2dfdb" />}
    </Stack>
  </Stack>
);

// ====== FIX-EDGE: derive “need” for edge when missing (matches reasons logic) ======
const deriveEdgeNeed = (cfg) => {
  if (!cfg) return null;
  if (typeof cfg.need === 'number') return cfg.need;

  // components_configured: { ticks, abs_min, frac_min, spread_mult, ... }
  const c = cfg.components_configured || {};
  const absMin = typeof c.abs_min === 'number' ? c.abs_min : 0;
  const ticks  = typeof c.ticks   === 'number' ? c.ticks   : 0;
  const minTicks = 1; // minimum tick count usually 1 (you already display ticks=0.05 elsewhere)
  const tickNeed = ticks > 0 ? ticks * minTicks : 0;

  // If backend later adds spread / last premium, add them here. For now we take the max of the configured floors.
  const fracMin = typeof c.frac_min === 'number' ? c.frac_min : 0;

  // pick a sensible floor; mirrors the textual “need ≥ 0.05” you show in reasons
  const computed = Math.max(absMin, tickNeed, fracMin);
  // If even that is 0, fall back to cfg.configured (often your canonical threshold)
  if (computed === 0 && typeof cfg.configured === 'number') return cfg.configured;

  return computed || null;
};

// A compact metrics grid for one fusion row
const FusionMetrics = ({ f }) => {
  // FIX-SR: prefer enriched sr_level to avoid “atm_fallback” in UI
  const e = f?.reasons_raw?.enriched || {};
  const srLevel = (e.sr_level || f.sr_level) && String(e.sr_level || f.sr_level).toLowerCase() === 'atm_fallback'
    ? (e.sr_level || '') // if atm_fallback, try enriched label; if empty, show nothing
    : (e.sr_level || f.sr_level);

  return (
    <Box sx={{ 
      display: 'grid', 
      gridTemplateColumns: { 
        xs: '1fr', 
        sm: 'repeat(2, 1fr)', 
        md: 'repeat(3, 1fr)', 
        lg: 'repeat(4, 1fr)' 
      }, 
      gap: { xs: 0.5, md: 1.0 }
    }}>
      <ChipKV label="Premium ROC %/min" value={fmtNum(f.prem_roc_pct_per_min)} color="#c8e6c9" />
      <ChipKV label="Price Momentum" value={fmtNum(f.price_momentum, 5)} color={+(f.price_momentum||0) >= 0 ? '#c8e6c9' : '#ffcdd2'} />
      <ChipKV label="Vol×" value={fmtNum(f.vol_mult, 3)} color="#c5cae9" />
      <ChipKV label="PCR" value={`${fmtNum(f.pcr_val, 4)} (${f.pcr_side||'NEUTRAL'})`} color="#ffe082" />
      <ChipKV label="FLOW" value={f.flow_side || '—'} color="#b2dfdb" />
      {/* FIX-SR: show SR from enriched or fallback, but never hardcode atm_fallback */}
      {srLevel && <ChipKV label="SR" value={`${srLevel}${f.sr_dist_pts!=null?` @${fmtNum(f.sr_dist_pts)}`:''}`} color="#ffccbc" />}
      <ChipKV label="Greeks Edge" value={fmtNum(f.greeks_edge)} color="#d1c4e9" />
      {Number.isFinite(+f.iv_now) && <ChipKV label="IV Now" value={fmtNum(f.iv_now, 5)} color="#b39ddb" />}
      {Number.isFinite(+f.delta) && <ChipKV label="Δ" value={fmtNum(f.delta, 6)} color="#bbdefb" />}
      {Number.isFinite(+f.vega) && <ChipKV label="Vega" value={fmtNum(f.vega, 5)} color="#bbdefb" />}
      {Number.isFinite(+f.theta_per_day) && <ChipKV label="θ/day" value={fmtNum(f.theta_per_day, 5)} color="#ffcc80" />}
      {Number.isFinite(+f.expected_spot_move) && <ChipKV label="Expected Spot Move" value={fmtNum(f.expected_spot_move)} color="#cfd8dc" />}
      {Number.isFinite(+f.oi_z) && <ChipKV label="OI z" value={fmtNum(f.oi_z, 2)} color="#cfd8dc" />}
      {typeof f.gamma_recent === 'boolean' && <ChipKV label="Gamma Recent" value={String(f.gamma_recent)} color={f.gamma_recent? '#c8e6c9':'#e0e0e0'} />}
    </Box>
  );
};

const SignalHeroSection = ({ f }) => {
  if (!f) return null;
  const heroItems = [
    { label: 'Signal', value: f.signal_type, color: '#00ffaa' },
    { label: 'Strength', value: f.strength, color: '#ffeb99' },
    { label: 'Flow Side', value: f.flow_side, color: '#81C784' },
    { label: 'PCR Side', value: f.pcr_side, color: '#ffe082' },
    { label: 'FSM', value: f.fsm_state ? `${f.fsm_state}${f.fsm_side ? ` (${f.fsm_side})` : ''}` : null, color: '#b3e5fc' },
    { label: 'SR Level', value: f.sr_level, color: '#ffccbc' },
    { label: 'SR Distance', value: f.sr_dist_pts != null ? `${fmtNum(f.sr_dist_pts)} pts` : null, color: '#ffccbc' },
    { label: 'Trace', value: f.trace, color: '#cfd8dc' },
    { label: 'Event Time', value: formatToIST(f.event_ts), color: '#cfd8dc' }
  ].filter(item => item.value && String(item.value).trim() !== '');

  if (!heroItems.length) return null;

  return (
    <Box sx={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: { xs: 0.5, sm: 1 },
      alignItems: 'center'
    }}>
      {heroItems.map(({ label, value, color }) => (
        <Chip
          key={`${label}-${value}`}
          label={`${label}: ${value}`}
          size="small"
          sx={{
            bgcolor: `${color}20`,
            color,
            border: `1px solid ${color}60`,
            fontSize: { xs: '0.65rem', md: '0.75rem' }
          }}
        />
      ))}
    </Box>
  );
};

const FlowConsensusSection = ({ f }) => {
  const fc = f?.flow_consensus;
  if (!fc && !f?.flow_alignment) return null;

  const stats = [
    { label: 'Ratio', value: fc?.ratio },
    { label: 'Strong Votes', value: fc?.strong },
    { label: 'Weak Votes', value: fc?.weak },
    { label: 'Total Samples', value: fc?.total },
    { label: 'Lookback (s)', value: fc?.window }
  ].filter(item => item.value !== undefined && item.value !== null);

  return (
    <Box sx={{
      border: '1px solid rgba(33,150,243,0.2)',
      borderRadius: 1,
      p: { xs: 1, sm: 1.5 }
    }}>
      <Typography variant="subtitle2" sx={{ color: '#90caf9', mb: 1, fontWeight: 600 }}>
        Flow Consensus & Alignment
      </Typography>
      <Grid container spacing={{ xs: 1, sm: 1.5 }}>
        {stats.map(({ label, value }) => (
          <Grid item xs={6} sm={4} md={3} key={label}>
            <Box sx={{
              bgcolor: 'rgba(144,202,249,0.08)',
              border: '1px solid rgba(144,202,249,0.2)',
              borderRadius: 1,
              p: 1
            }}>
              <Typography variant="caption" sx={{ color: '#90caf9', opacity: 0.75 }}>{label}</Typography>
              <Typography sx={{
                fontFamily: 'Roboto Mono, monospace',
                color: '#e0e0e0',
                fontWeight: 600,
                fontSize: { xs: '0.85rem', md: '0.95rem' }
              }}>
                {fmtNum(value, 3)}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }} useFlexGap flexWrap="wrap">
        {f.flow_alignment && <ChipKV label="Alignment" value={f.flow_alignment} color="#90caf9" />}
        {f.flow_side && <ChipKV label="Flow Side" value={f.flow_side} color="#81C784" />}
        {f.pcr_side && <ChipKV label="PCR Side" value={f.pcr_side} color="#ffe082" />}
        {f.mtf_side && <ChipKV label="MTF" value={`${f.mtf_side}${f.mtf_score ? ` (${f.mtf_score})` : ''}`} color="#b39ddb" />}
      </Stack>
    </Box>
  );
};

const GateChecksSection = ({ f }) => {
  const checks = f?.gate_checks || {};
  const entries = Object.entries(checks);
  if (!entries.length && !f?.gate_rule) return null;

  const gateMeta = [
    { label: 'Gate Rule', value: f.gate_rule },
    { label: 'ROC Gate', value: f.roc_ok_gate },
    { label: 'OI Gate', value: f.oi_ok_gate },
    { label: 'Vol Gate', value: f.vol_ok_gate }
  ];

  return (
    <Box sx={{
      border: '1px solid rgba(255,235,153,0.2)',
      borderRadius: 1,
      p: { xs: 1, sm: 1.5 }
    }}>
      <Typography variant="subtitle2" sx={{ color: '#ffeb99', mb: 1, fontWeight: 600 }}>
        Gate Checks
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
        {gateMeta.filter(item => item.value !== undefined && item.value !== null).map(({ label, value }) => (
          <Chip
            key={label}
            label={typeof value === 'boolean' ? `${label}: ${value ? 'PASS' : 'FAIL'}` : `${label}: ${value}`}
            size="small"
            sx={{
              bgcolor: typeof value === 'boolean'
                ? value ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)'
                : 'rgba(255,235,153,0.1)',
              color: typeof value === 'boolean'
                ? value ? '#4CAF50' : '#EF5350'
                : '#ffeb99',
              border: `1px solid ${typeof value === 'boolean'
                ? value ? '#4CAF5050' : '#EF535050'
                : '#ffeb9950'}`
            }}
          />
        ))}
      </Stack>
      <Grid container spacing={{ xs: 1, sm: 1.5 }}>
        {entries.map(([key, info]) => (
          <Grid item xs={12} sm={4} key={key}>
            <Box sx={{
              bgcolor: 'rgba(255,235,153,0.08)',
              border: `1px solid ${info?.passed ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)'}`,
              borderRadius: 1,
              p: 1
            }}>
              <Typography variant="body2" sx={{ color: '#ffeb99', fontWeight: 600, textTransform: 'uppercase' }}>
                {key}
              </Typography>
              <Typography variant="caption" sx={{ color: '#bdbdbd' }}>
                Need: {info?.need != null ? fmtNum(info.need, 4) : '—'} | Have: {info?.have != null ? fmtNum(info.have, 4) : '—'}
              </Typography>
              <Typography sx={{
                mt: 0.5,
                color: info?.passed ? '#4CAF50' : '#F44336',
                fontWeight: 700
              }}>
                {info?.passed ? 'PASS' : 'FAIL'}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

const CapsDecisionsSection = ({ f }) => {
  const hasCaps = f?.caps_kept_list?.length || f?.caps_waived_list?.length || f?.caps_raised_list?.length || f?.hard_kept?.length;
  if (!hasCaps) return null;

  const renderChipList = (items = [], color, labelPrefix) => (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
      {items.map((item, idx) => (
        <Chip
          key={`${labelPrefix}-${idx}`}
          label={item}
          size="small"
          sx={{
            bgcolor: `${color}25`,
            color,
            border: `1px solid ${color}50`
          }}
        />
      ))}
    </Stack>
  );

  return (
    <Box sx={{
      border: '1px solid rgba(255,152,0,0.2)',
      borderRadius: 1,
      p: { xs: 1, sm: 1.5 }
    }}>
      <Typography variant="subtitle2" sx={{ color: '#FFB74D', mb: 1, fontWeight: 600 }}>Capabilities & Waivers</Typography>
      <Stack spacing={1}>
        {f.caps_kept_list?.length ? (
          <Box>
            <Typography variant="caption" sx={{ color: '#FFB74D', fontWeight: 600 }}>Kept</Typography>
            {renderChipList(f.caps_kept_list, '#81C784', 'kept')}
          </Box>
        ) : null}
        {f.caps_waived_list?.length ? (
          <Box>
            <Typography variant="caption" sx={{ color: '#FFB74D', fontWeight: 600 }}>Waived</Typography>
            {renderChipList(f.caps_waived_list, '#FFB74D', 'waived')}
          </Box>
        ) : null}
        {f.caps_raised_list?.length ? (
          <Box>
            <Typography variant="caption" sx={{ color: '#FFB74D', fontWeight: 600 }}>Raised</Typography>
            {renderChipList(f.caps_raised_list, '#EF5350', 'raised')}
          </Box>
        ) : null}
        {f.hard_kept?.length ? (
          <Box>
            <Typography variant="caption" sx={{ color: '#FFB74D', fontWeight: 600 }}>Hard Kept</Typography>
            {renderChipList(f.hard_kept, '#64B5F6', 'hard')}
          </Box>
        ) : null}
        {(f.waiver_bias != null || f.roc_waived || f.roc_waiver) && (
          <Box sx={{
            mt: 1,
            p: 1,
            bgcolor: 'rgba(255,255,255,0.04)',
            borderRadius: 1
          }}>
            {f.waiver_bias != null && (
              <Typography variant="caption" sx={{ color: '#e0e0e0', display: 'block' }}>
                Waiver Bias: {fmtNum(f.waiver_bias, 3)}
              </Typography>
            )}
            {f.roc_waived && (
              <Typography variant="caption" sx={{ color: '#e0e0e0', display: 'block' }}>
                ROC Waived By: {f.roc_waived_by || '—'}
              </Typography>
            )}
            {f.roc_waiver && (
              <Typography variant="caption" sx={{ color: '#e0e0e0', display: 'block' }}>
                Reason: {f.roc_waiver.reason} (prem ROC {fmtNum(f.roc_waiver.prem_roc)} | need {fmtNum(f.roc_waiver.need_flow_cons)})
              </Typography>
            )}
          </Box>
        )}
      </Stack>
    </Box>
  );
};

const ExecutionSummarySection = ({ f }) => {
  const hasContent = f?.exec_reasons_pass?.length || f?.exec_reasons_fail?.length || f?.block_reasons?.length;
  if (!hasContent) return null;

  return (
    <Box sx={{
      border: '1px solid rgba(102,187,106,0.2)',
      borderRadius: 1,
      p: { xs: 1, sm: 1.5 }
    }}>
      <Typography variant="subtitle2" sx={{ color: '#66BB6A', mb: 1, fontWeight: 600 }}>
        Execution Rationale
      </Typography>
      <Grid container spacing={{ xs: 1, sm: 2 }}>
        {f.exec_reasons_pass?.length ? (
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" sx={{ color: '#81C784', fontWeight: 600 }}>Pass Drivers</Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {f.exec_reasons_pass.map((reason, idx) => (
                <Typography key={`pass-${idx}`} sx={{ color: '#e0e0e0', fontSize: { xs: '0.8rem', md: '0.85rem' } }}>
                  • {reason}
                </Typography>
              ))}
            </Stack>
          </Grid>
        ) : null}
        {(f.exec_reasons_fail?.length || f.block_reasons?.length) ? (
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" sx={{ color: '#EF9A9A', fontWeight: 600 }}>Headwinds</Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {(f.exec_reasons_fail || []).concat(f.block_reasons || []).map((reason, idx) => (
                <Typography key={`fail-${idx}`} sx={{ color: '#e0e0e0', fontSize: { xs: '0.8rem', md: '0.85rem' } }}>
                  • {reason}
                </Typography>
              ))}
            </Stack>
          </Grid>
        ) : null}
      </Grid>
      {f.exec_debug_info && (
        <Box sx={{
          mt: 1,
          p: 1,
          bgcolor: 'rgba(255,255,255,0.04)',
          borderRadius: 1
        }}>
          <Typography variant="caption" sx={{ color: '#e0e0e0' }}>
            Latency: {f.exec_debug_info.latency_ms ? `${f.exec_debug_info.latency_ms} ms` : '—'} | Autotune ROC≥{fmtNum(f.exec_debug_info.autotune?.roc_min)} OI≥{fmtNum(f.exec_debug_info.autotune?.oi_z_min)}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

const ConfigSnapshotSection = ({ snapshot }) => {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const entries = Object.entries(snapshot);
  if (!entries.length) return null;

  return (
    <Box sx={{
      border: '1px solid rgba(179,157,219,0.2)',
      borderRadius: 1,
      p: { xs: 1, sm: 1.5 }
    }}>
      <Typography variant="subtitle2" sx={{ color: '#B39DDB', mb: 1, fontWeight: 600 }}>
        Config Snapshot
      </Typography>
      <Grid container spacing={{ xs: 1, sm: 1.5 }}>
        {entries.map(([key, value]) => (
          <Grid key={key} item xs={12} sm={6} md={4}>
            <Box sx={{
              bgcolor: 'rgba(179,157,219,0.08)',
              border: '1px solid rgba(179,157,219,0.2)',
              borderRadius: 1,
              p: 1
            }}>
              <Typography variant="caption" sx={{ color: '#B39DDB', textTransform: 'uppercase' }}>{key}</Typography>
              <Typography sx={{
                fontFamily: 'Roboto Mono, monospace',
                color: '#e0e0e0',
                fontWeight: 600
              }}>
                {typeof value === 'number' ? fmtNum(value) : String(value)}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

const ExtraContextSection = ({ f }) => {
  const ctx = f?.extra_ctx;
  if (!ctx) return null;
  const entries = [
    { label: 'Spot', value: ctx.spot },
    { label: 'Nifty Slope', value: ctx.nifty_slope },
    { label: 'Expiry', value: ctx.expiry }
  ].filter(item => item.value !== undefined && item.value !== null);
  if (!entries.length) return null;

  return (
    <Box sx={{
      border: '1px solid rgba(207,216,220,0.2)',
      borderRadius: 1,
      p: { xs: 1, sm: 1.5 }
    }}>
      <Typography variant="subtitle2" sx={{ color: '#CFD8DC', mb: 1, fontWeight: 600 }}>
        Market Context
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
        {entries.map(({ label, value }) => (
          <ChipKV key={label} label={label} value={typeof value === 'number' ? fmtNum(value, 4) : value} color="#CFD8DC" />
        ))}
      </Stack>
    </Box>
  );
};

// Pretty reasons block per section
const ReasonsPretty = ({ reasons }) => {
  const sections = parseReasons(reasons);
  if (!sections.length) return <Typography sx={{ color: '#9e9e9e' }}>No reasons provided.</Typography>;

  const colorFor = (section) => ({
    WHY: '#c8e6c9', 'MOMENTUM/FLOW': '#b2dfdb', PCR: '#ffe082', FLOW: '#b2dfdb', CAPS: '#ffcdd2', MTF: '#b39ddb', META: '#80cbc4', OTHER: '#e0e0e0'
  }[section] || '#e0e0e0');

  return (
    <Stack spacing={1.2}>
      {sections.map(({ section, body }, idx) => (
        <Box key={`${section}-${idx}`} sx={{ p: 1, border: '1px solid rgba(255,255,255,0.25)', borderRadius: 1, bgcolor: 'rgba(255,255,255,0.05)' }}>
          <Typography sx={{ color: colorFor(section), fontWeight: 700, mb: 0.5 }}>{section}</Typography>
          <Typography sx={{ color: '#e0e0e0', whiteSpace: 'pre-wrap' }}>{body}</Typography>
          {['WHY','FLOW','PCR','MOMENTUM/FLOW'].includes(section) && (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
              {pickInlineMetrics(body).map((kv, i) => (
                <ChipKV key={i} label={kv.label} value={`${kv.value}${kv.extra?` (${kv.extra})`:''}`} color={colorFor(section)} />
              ))}
            </Stack>
          )}
        </Box>
      ))}
    </Stack>
  );
};

// ========= Enriched Pretty Renderer =========
const labelMap = {
  price_momentum: 'Price Momentum',
  pcr_momentum: 'PCR Momentum',
  flow_ratio: 'Flow Ratio',
  flow_n_eff: 'Flow n_eff',
  vol_mult: 'Vol×',
  oi_z: 'OI z',
  edge: 'Edge',
};

const GateRow = ({ k, cfg }) => {
  if (!cfg) return null;
  const label = labelMap[k] || humanize(k);
  const have = cfg.have;

  // FIX-EDGE: compute a meaningful need if backend didn’t include it
  const need = k === 'edge' ? (deriveEdgeNeed(cfg)) : cfg.need;
  const configured = cfg.configured;

  const pass =
    typeof have === 'number' && typeof need === 'number'
      ? have >= need
      : (typeof cfg.sign_ok === 'boolean' ? cfg.sign_ok : null);

  return (
    <Box sx={{
      p: 1, border: '1px solid rgba(255,255,255,0.25)', borderRadius: 1,
      display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.2fr 0.8fr 0.8fr 0.8fr 0.8fr' }, gap: 1,
      alignItems: 'center', bgcolor: 'rgba(255,255,255,0.05)'
    }}>
      <Typography sx={{ color: '#e0e0e0', fontWeight: 600 }}>{label}</Typography>
      <ChipKV label="Have" value={fmtNum(have, 6)} color="#c8e6c9" />
      <ChipKV label="Need" value={need == null ? '—' : fmtNum(need, 6)} color="#ffe082" />
      {configured != null && <ChipKV label="Configured" value={fmtNum(configured, 6)} color="#b39ddb" />}
      {pass != null && (
        <Chip
          size="small"
          label={pass ? 'PASS' : 'FAIL'}
          sx={{
            justifySelf: { xs: 'start', sm: 'end' },
            bgcolor: pass ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
            color: pass ? '#4CAF50' : '#F44336',
            border: `1px solid ${pass ? '#4CAF5050' : '#F4433650'}`
          }}
        />
      )}
    </Box>
  );
};

const EnrichedPretty = ({ f }) => {
  const e = f?.reasons_raw?.enriched || null;
  if (!e) return null;

  const flowRatio = e.have_need_configured?.flow_ratio?.have ?? f.flow_ratio;
  const flowNEff = e.have_need_configured?.flow_n_eff?.have ?? f.flow_n_eff;

  // FIX-SR: normalize SR chips with enriched info
  const srLevel = e.sr_level && String(e.sr_level).toLowerCase() === 'atm_fallback' ? '' : e.sr_level;

  return (
    <Stack spacing={2}>
      {/* Overview */}
      <Box sx={{ p: 2, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)' }}>
        <Typography variant="subtitle1" sx={{ color: '#00ffaa', fontWeight: 700, mb: 1 }}>
          Enriched Overview
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <ChipKV label="Energy" value={(e.energy || '').toUpperCase()} color={e.energy==='STRONG' ? '#4CAF50' : '#FF9800'} />
          <ChipKV label="Side" value={(e.side || f.fsm_side || f.flow_side || '—')} color={(e.side||f.fsm_side||'').includes('CE') ? '#4CAF50' : '#F44336'} />
          <ChipKV label="Flow Side" value={e.flow_side || f.flow_side || '—'} color={(e.flow_side||'').includes('CE') ? '#4CAF50' : '#F44336'} />
          <ChipKV label="PCR Side" value={e.pcr_side || f.pcr_side || '—'} color="#ffe082" />
          <ChipKV label="PCR" value={fmtNum(e.pcr_val ?? f.pcr_val, 4)} color="#ffe082" />
          <ChipKV label="Price Momentum" value={fmtNum(e.price_momentum ?? f.price_momentum, 6)} color="#c8e6c9" />
          <ChipKV label="PCR Momentum" value={fmtNum(e.pcr_momentum ?? f.pcr_momentum, 6)} color="#c8e6c9" />
          <ChipKV label="Premium ROC %/min" value={fmtNum(e.prem_roc_pct_per_min ?? f.prem_roc_pct_per_min, 4)} color="#c8e6c9" />
          <ChipKV label="Vol×" value={fmtNum(e.vol_mult ?? f.vol_mult, 4)} color="#c5cae9" />
          <ChipKV label="Flow Ratio" value={fmtNum(flowRatio, 3)} color="#b2dfdb" />
          <ChipKV label="n_eff" value={fmtNum(flowNEff, 3)} color="#b2dfdb" />
          {e.oi_z != null && <ChipKV label="OI z" value={fmtNum(e.oi_z, 3)} color="#cfd8dc" />}
          {/* FIX-SR: show enriched SR level (hide if it was atm_fallback) */}
          {srLevel && <ChipKV label="SR Level" value={String(srLevel)} color="#ffccbc" />}
          {e.sr_dist_pts != null && <ChipKV label="SR Dist (pts)" value={fmtNum(e.sr_dist_pts)} color="#ffccbc" />}
          {e.sr_action && <ChipKV label="SR Action" value={String(e.sr_action)} color="#ffccbc" />}
          <BoolChip label="SR OK" value={e.sr_ok} />
          <BoolChip label="SR Waived" value={e.sr_waived} />
        </Stack>
        {e.sr_waived && e.sr_waiver_reason && (
          <Typography sx={{ color: '#e0e0e0', mt: 1, fontStyle: 'italic' }}>
            SR Waiver: {e.sr_waiver_reason}
          </Typography>
        )}
      </Box>

      {/* Gates: have vs need */}
      {e.have_need_configured && (
        <Box sx={{ p: 2, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)' }}>
          <Typography variant="subtitle1" sx={{ color: '#00ffaa', fontWeight: 700, mb: 1 }}>
            Gates — Have vs Need
          </Typography>
          <Stack spacing={1}>
            {Object.entries(e.have_need_configured).map(([k, cfg]) => (
              <GateRow key={k} k={k} cfg={cfg} />
            ))}
          </Stack>
        </Box>
      )}

      {/* Autotune */}
      {e.autotune && (
        <Box sx={{ p: 2, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)' }}>
          <Typography variant="subtitle1" sx={{ color: '#00ffaa', fontWeight: 700, mb: 1 }}>
            Autotune
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <ChipKV label="Regime" value={e.autotune.regime || '-'} color="#b39ddb" />
            <ChipKV label="thr_pm" value={fmtNum(e.autotune.thr_pm)} color="#c8e6c9" />
            <ChipKV label="thr_vol" value={fmtNum(e.autotune.thr_vol)} color="#c8e6c9" />
            <ChipKV label="thr_oi" value={fmtNum(e.autotune.thr_oi)} color="#c8e6c9" />
            {e.autotune.changed && <ChipKV label="Changed" value={e.autotune.changed} color="#e0e0e0" />}
            {e.autotune.q_roc50 != null && <ChipKV label="q_roc50" value={fmtNum(e.autotune.q_roc50, 6)} color="#e0e0e0" />}
            {e.autotune.q_roc60 != null && <ChipKV label="q_roc60" value={fmtNum(e.autotune.q_roc60, 6)} color="#e0e0e0" />}
            {e.autotune.q_vol50 != null && <ChipKV label="q_vol50" value={fmtNum(e.autotune.q_vol50, 6)} color="#e0e0e0" />}
            {e.autotune.q_oi75 != null && <ChipKV label="q_oi75" value={fmtNum(e.autotune.q_oi75, 6)} color="#e0e0e0" />}
          </Stack>
        </Box>
      )}

      {/* Caps */}
      {(e.caps_kept_friendly?.length || e.caps_waived_friendly?.length || e.cap_dbg_lines?.length) && (
        <Box sx={{ p: 2, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)' }}>
          <Typography variant="subtitle1" sx={{ color: '#00ffaa', fontWeight: 700 }}>
            Caps & Decisions
          </Typography>
          {e.caps_kept_friendly?.length ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
              {e.caps_kept_friendly.map((c, i) => <Chip key={`kept-${i}`} size="small" label={`Kept: ${c}`} sx={{ bgcolor: 'rgba(76,175,80,0.25)', color: '#81C784', border: '1px solid #4CAF5080' }} />)}
            </Stack>
          ) : null}
          {e.caps_waived_friendly?.length ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
              {e.caps_waived_friendly.map((c, i) => <Chip key={`waived-${i}`} size="small" label={`Waived: ${c}`} sx={{ bgcolor: 'rgba(255,193,7,0.25)', color: '#FFD54F', border: '1px solid #FFC10780' }} />)}
            </Stack>
          ) : null}
          {e.cap_dbg_lines?.length ? (
            <Box sx={{ mt: 1 }}>
              {e.cap_dbg_lines.map((ln, i) => (
                <Typography key={i} sx={{ color: '#e0e0e0', fontFamily: 'Roboto Mono, monospace', fontSize: 12 }}>
                  • {ln}
                </Typography>
              ))}
            </Box>
          ) : null}
        </Box>
      )}
    </Stack>
  );
};

// Replace bare "sr=unknown" in reasons with richer info from enriched block
const normalizeReasonsWithEnriched = (reasons, enriched) => {
  if (!reasons || !enriched) return reasons;
  const srLevel = enriched.sr_level || 'unknown';
  const dist = enriched.sr_dist_pts;
  const farHint = (typeof dist === 'number' && typeof enriched.sr_prox_thr === 'number' && dist > enriched.sr_prox_thr)
    ? ' (far)'
    : '';
  const withLevel = `sr=${srLevel}${typeof dist === 'number' ? ` @${fmtNum(dist)}` : ''}${farHint}`;
  return reasons.replace(/\bsr=unknown\b/gi, withLevel);
};

// Decode Unicode escape sequences in reasons text
const decodeUnicodeEscapes = (text) => {
  if (!text) return text;
  return text.replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });
};

// Clean up malformed quotes and other text artifacts
const cleanReasonsText = (text) => {
  if (!text) return text;
  return text
    // Remove unmatched quotes at the end of lines or sections
    .replace(/"\s*$/gm, '')
    // Remove unmatched quotes at the beginning of lines
    .replace(/^"\s*/gm, '')
    // Remove standalone quotes
    .replace(/\s+"\s+/g, ' ')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    // Trim each line
    .split('\n').map(line => line.trim()).join('\n');
};

// -------------------------
// Date Utility Functions
// -------------------------
const formatDateForAPI = (date) => {
  return moment(date).format('YYYY-MM-DD');
};

const formatDateDisplay = (date) => {
  return moment(date).format('DD MMM YYYY');
};

const getCurrentTradingDay = () => {
  // Use IST timezone (UTC+5:30) for consistency with API timestamps
  const now = moment().utcOffset(330);
  // If it's weekend, go to Friday
  if (now.day() === 6) { // Saturday
    return now.subtract(1, 'day');
  } else if (now.day() === 0) { // Sunday
    return now.subtract(2, 'days');
  }
  return now;
};

const getPreviousTradingDay = (date = null) => {
  // Use IST timezone (UTC+5:30) for consistency with API timestamps
  const prev = date ? moment(date).subtract(1, 'day') : moment().utcOffset(330).subtract(1, 'day');
  // If it's weekend, go to Friday
  if (prev.day() === 6) { // Saturday
    return prev.subtract(1, 'day');
  } else if (prev.day() === 0) { // Sunday
    return prev.subtract(2, 'days');
  }
  return prev;
};

const getDateFilterOptions = () => {
  // Use actual current date (not trading day) to show weekend data if it exists
  const today = moment().utcOffset(330);
  const yesterday = moment().utcOffset(330).subtract(1, 'day');
  
  return [
    { 
      label: 'All Time', 
      value: 'all', 
      startDate: null, 
      endDate: null 
    },
    { 
      label: 'Today', 
      value: 'today', 
      startDate: today.clone().startOf('day'), 
      endDate: today.clone().endOf('day') 
    },
    { 
      label: 'Yesterday', 
      value: 'yesterday', 
      startDate: yesterday.clone().startOf('day'), 
      endDate: yesterday.clone().endOf('day') 
    },
    { 
      label: 'Last 3 Days', 
      value: 'last3days', 
      startDate: today.clone().subtract(2, 'days').startOf('day'), 
      endDate: today.clone().endOf('day') 
    },
    { 
      label: 'Last 7 Days', 
      value: 'last7days', 
      startDate: today.clone().subtract(6, 'days').startOf('day'), 
      endDate: today.clone().endOf('day') 
    },
    { 
      label: 'Last 30 Days', 
      value: 'last30days', 
      startDate: today.clone().subtract(29, 'days').startOf('day'), 
      endDate: today.clone().endOf('day') 
    },
    { 
      label: 'Custom Range', 
      value: 'custom', 
      startDate: null, 
      endDate: null 
    }
  ];
};

// -------------------------
// Component
// -------------------------
const Fusion = () => {
  // Full groups from /fusion-data/grouped
  const [groups, setGroups] = useState([]);      // [{ parent_order_id, display_tradingsymbol, fusion:[], trades:[], trail:[] }, ...]
  // Summary rows for main table (derived from groups)
  const [rows, setRows] = useState([]);          // flattened summaries
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selected, setSelected] = useState(null);         // selected summary row
  const [selectedGroup, setSelectedGroup] = useState(null); // full group for dialog
  const [detailView, setDetailView] = useState('fusion'); // 'fusion' | 'trade' | 'trail'
  const [orderBy, setOrderBy] = useState('event_ts');
  const [orderDirection, setOrderDirection] = useState('desc');
  const [dense, setDense] = useState(true);
  const [colMenuEl, setColMenuEl] = useState(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(true); // Analytics dialog state - open by default
  
  // CSV Export dialog state
  const [csvExportOpen, setCsvExportOpen] = useState(false);
  const [csvFilterLossOnly, setCsvFilterLossOnly] = useState(false);
  const [csvFilterProfitOnly, setCsvFilterProfitOnly] = useState(false);
  const [csvFilterTag, setCsvFilterTag] = useState('all');
  const [csvIncludeInProgress, setCsvIncludeInProgress] = useState(false);
  const [csvExportType, setCsvExportType] = useState('summary'); // 'summary' | 'detailed'

  // Date filtering state
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'yesterday', 'last7days', etc.
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [dateFilterAnchor, setDateFilterAnchor] = useState(null);
  const [allGroups, setAllGroups] = useState([]); // Store all data before date filtering

  // Columns for main table
  // NEW default: show PnL % of Cost instead of Margin (hide Parent ID)
  const displayColumns = useMemo(() => ['event_ts', 'signal_type', 'tradingsymbol', 'buy_qty', 'buy_price', 'sell_price', 'buy_cost_total', 'total_matched_pnl', 'outcome'], []);
  const [selectedColumns, setSelectedColumns] = useState(displayColumns);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Align timestamp to first BUY trade if possible
  const pickAlignedEventTs = (g) => {
    const fusions = Array.isArray(g.fusion) ? g.fusion : [];
    const trades = Array.isArray(g.trades) ? g.trades : [];

    const buyTrades = trades.filter(t => String(t.transaction_type).toUpperCase() === 'BUY');
    const firstBuy = buyTrades.length
      ? buyTrades.reduce((min, t) => {
          const mt = parseToMoment(t.order_timestamp);
          if (!mt || !mt.isValid()) return min;
          return (!min || mt.isBefore(min)) ? mt : min;
        }, null)
      : null;

    if (firstBuy && fusions.length) {
      let best = null;
      let bestDiff = Number.POSITIVE_INFINITY;
      fusions.forEach(f => {
        const mf = parseToMoment(f.event_ts);
        if (!mf || !mf.isValid()) return;
        const diff = Math.abs(mf.valueOf() - firstBuy.valueOf());
        if (diff < bestDiff) { bestDiff = diff; best = f.event_ts; }
      });
      if (best) return best;
    }

    const lastFusion = fusions.length ? fusions[fusions.length - 1].event_ts : null;
    const lastTradeTs = trades.length ? trades[trades.length - 1].order_timestamp : null;
    const lastTrailTs = (Array.isArray(g.trail) && g.trail.length) ? g.trail[g.trail.length - 1].latest_date : null;
    return lastFusion || lastTradeTs || lastTrailTs || null;
  };

  // Build a single summary row from one group
  const summarizeGroup = (g) => {
    const parent = g.parent_order_id;
  
    const tradingsymbol = g.display_tradingsymbol
      || g.trades?.[g.trades.length - 1]?.tradingsymbol
      || g.trail?.[g.trail.length - 1]?.tradingsymbol
      || g.fusion?.[g.fusion.length - 1]?.symbol
      || '';
  
    const event_ts = pickAlignedEventTs(g);
  
    const lastFusion = g.fusion?.length ? g.fusion[g.fusion.length - 1] : null;
    const signal_type = lastFusion?.signal_type || '';
    const nifty_ltp = lastFusion?.nifty_ltp ?? null;
  
    // --- P&L math (trade-basis) ---
    const trades = Array.isArray(g.trades) ? g.trades : [];
    const total_matched_pnl = sum(trades.map(t => t?.matched_pnl)); // retained (legacy PnL sum)
  
    // quantities (use filled_quantity OR quantity to handle SELL legs with filled_quantity: 0)
    const qtyFor = (t) => Number(t?.filled_quantity) || Number(t?.quantity) || 0;
  
    const buy_qty = sum(
      trades
        .filter(t => String(t.transaction_type).toUpperCase() === 'BUY')
        .map(qtyFor)
    );
  
    const sell_qty = sum(
      trades
        .filter(t => String(t.transaction_type).toUpperCase() === 'SELL')
        .map(qtyFor)
    );
  
    const net_qty = buy_qty - sell_qty;
  
    // Cost-basis (BUY vs SELL)
    const buy_cost_total = grossBuyCost(trades);
    const sell_value_total = grossSellValue(trades);
    const pnl_abs_tradebasis = (sell_value_total - buy_cost_total);
  
    // Trail "live"?
    const trailLive = Array.isArray(g.trail) && g.trail.some(t => !!t.is_live);
  
    // Fusion settled?
    const latestFusion = lastFusion || null;
    const fusionSettled = !!latestFusion?.settled_at;
  
    // Robust closed detection:
    const allPositionsClosedFlag = trades.length > 0 && trades.every(t => t.position_status === false);
    const hasSomeSell = sell_value_total > 0;
  
    const isClosed =
      ((buy_qty === sell_qty) && hasSomeSell) ||
      (allPositionsClosedFlag && hasSomeSell) ||
      fusionSettled;
  
    const in_progress = !isClosed || trailLive;
  
    // % vs cost only when closed
    const pnl_pct_of_cost = (isClosed && buy_cost_total > 0)
      ? (pnl_abs_tradebasis / buy_cost_total) * 100
      : null;
  
    // Optional: margin %
    const margins = trades
      .map(t => Number.isFinite(Number(t?.initial_margin)) ? Number(t.initial_margin) : null)
      .filter(v => v != null);
    const initial_margin_base = margins.length ? Math.max(...margins) : null;
    const pnl_pct_of_margin = (isClosed && initial_margin_base && initial_margin_base !== 0)
      ? (total_matched_pnl / initial_margin_base) * 100.0
      : null;
  
    const outcome = in_progress
      ? 'IN-PROGRESS'
      : (pnl_abs_tradebasis || 0) > 0
        ? 'PROFIT'
        : (pnl_abs_tradebasis || 0) < 0
          ? 'LOSS'
          : 'FLAT';
  
    // Extract tags based on position status:
    // - If IN-PROGRESS: show entry tag (BUY)
    // - If CLOSED: show exit tag (SELL)
    let tag = '';
    if (in_progress) {
      // Position is open - show entry tag from BUY orders
      const entryTags = trades
        .filter(t => String(t.transaction_type).toUpperCase() === 'BUY')
        .map(t => t.tag)
        .filter(tag => tag && tag !== 'undefined' && tag !== 'null');
      tag = entryTags.length ? entryTags[0] : '';
    } else {
      // Position is closed - show exit tag from SELL orders
      const exitTags = trades
        .filter(t => String(t.transaction_type).toUpperCase() === 'SELL')
        .map(t => t.tag)
        .filter(tag => tag && tag !== 'undefined' && tag !== 'null');
      tag = exitTags.length ? exitTags[0] : '';
    }

    // Calculate average buy and sell prices
    const buyTrades = trades.filter(t => String(t.transaction_type).toUpperCase() === 'BUY');
    const sellTrades = trades.filter(t => String(t.transaction_type).toUpperCase() === 'SELL');
    
    const buy_price = buyTrades.length > 0 
      ? (buyTrades.reduce((sum, t) => sum + (Number(t.average_price) || 0) * qtyFor(t), 0) / buy_qty) || 0
      : 0;
    
    const sell_price = sellTrades.length > 0 && sell_qty > 0
      ? (sellTrades.reduce((sum, t) => sum + (Number(t.average_price) || 0) * qtyFor(t), 0) / sell_qty) || 0
      : 0;

    return {
      parent_order_id: parent,
      tradingsymbol,
      event_ts,
      signal_type,
      nifty_ltp,

      // expose both (new + legacy)
      total_matched_pnl,
      pnl_pct_of_cost,
      pnl_pct_of_margin,

      // useful extras
      buy_cost_total,
      sell_value_total,
      initial_margin_base,
      buy_qty,
      sell_qty,
      buy_price,
      sell_price,
      net_qty,
  
      in_progress,
      outcome,
      tag,
      __hasFusion: !!lastFusion,
    };
  };

  // Date filtering utility functions
  const getSelectedDateRange = () => {
    const filterOptions = getDateFilterOptions();
    const selectedFilter = filterOptions.find(f => f.value === dateFilter);
    
    if (dateFilter === 'custom') {
      return {
        startDate: customStartDate ? moment(customStartDate) : null,
        endDate: customEndDate ? moment(customEndDate) : null
      };
    }
    
    return selectedFilter ? {
      startDate: selectedFilter.startDate,
      endDate: selectedFilter.endDate
    } : null;
  };

  const getActiveDateFilterLabel = () => {
    const filterOptions = getDateFilterOptions();
    const selectedFilter = filterOptions.find(f => f.value === dateFilter);
    
    if (dateFilter === 'custom' && customStartDate && customEndDate) {
      return `${moment(customStartDate).format('MMM D')} - ${moment(customEndDate).format('MMM D')}`;
    }
    
    return selectedFilter ? selectedFilter.label : 'All Time';
  };

  const filterGroupsByDate = (groupsData) => {
    // If 'all' filter is selected, return all data without filtering
    if (dateFilter === 'all') {
      console.log('🔍 "All Time" filter selected, showing all data');
      return groupsData;
    }
    
    const range = getSelectedDateRange();
    if (!range || !range.startDate || !range.endDate) {
      console.log('🔍 No date range specified, showing all data');
      return groupsData;
    }

    console.log('🔍 Date filtering:', {
      startDate: range.startDate.format('YYYY-MM-DD HH:mm:ss Z'),
      endDate: range.endDate.format('YYYY-MM-DD HH:mm:ss Z'),
      totalGroups: groupsData.length
    });

    const filtered = groupsData.filter(group => {
      // Get the event timestamp from the group
      const eventTsRaw = pickAlignedEventTs(group);
      const eventTs = parseToMoment(eventTsRaw);
      if (!eventTs || !eventTs.isValid()) {
        console.log('⚠️ Invalid timestamp:', eventTsRaw);
        return false;
      }
      
      // Convert eventTs to IST for proper comparison
      const eventTsIST = eventTs.utcOffset(330);
      const isInRange = eventTsIST.isBetween(range.startDate, range.endDate, null, '[]');
      
      if (groupsData.indexOf(group) === 0) {
        // Log first record for debugging
        console.log('🔍 First record check:', {
          raw: eventTsRaw,
          parsed: eventTsIST.format('YYYY-MM-DD HH:mm:ss Z'),
          startDate: range.startDate.format('YYYY-MM-DD HH:mm:ss Z'),
          endDate: range.endDate.format('YYYY-MM-DD HH:mm:ss Z'),
          isInRange
        });
      }
      
      return isInRange;
    });
    
    console.log(`🔍 Filtered: ${filtered.length} / ${groupsData.length} records`);
    return filtered;
  };

  const applyDateFilter = () => {
    const filteredGroups = filterGroupsByDate(allGroups);
    setGroups(filteredGroups);
    setRows(filteredGroups.map(summarizeGroup));
    setPage(0);
  };

  // Auto-fallback to previous trading day if no current day data
  const checkAndFallbackData = (groupsData) => {
    if (dateFilter !== 'today' || groupsData.length > 0) {
      return groupsData;
    }

    // If no data for today, try previous trading day
    console.log('No data for today, checking previous trading day...');
    const yesterday = getPreviousTradingDay();
    const yesterdayStart = yesterday.clone().startOf('day');
    const yesterdayEnd = yesterday.clone().endOf('day');
    
    const yesterdayData = allGroups.filter(group => {
      const eventTsRaw = pickAlignedEventTs(group);
      const eventTs = parseToMoment(eventTsRaw);
      if (!eventTs || !eventTs.isValid()) return false;
      return eventTs.isBetween(yesterdayStart, yesterdayEnd, null, '[]');
    });

    if (yesterdayData.length > 0) {
      console.log(`Found ${yesterdayData.length} records from previous trading day`);
      // Automatically switch to yesterday filter
      setDateFilter('yesterday');
      return yesterdayData;
    }

    return groupsData;
  };
  

  const refetch = async () => {
    setLoading(true);
    console.log('🔄 Fetching fusion data...');
    try {
      const res = await httpApi.get('/fusion-data/grouped', { params: { order: 'desc', limit_parents: 500 } }); // Increased limit for better date filtering
      const payload = res.data;
      console.log('📦 Raw API Response:', payload);
      
      const recs = Array.isArray(payload) ? payload : (Array.isArray(payload?.records) ? payload.records : []);
      console.log('📊 Parsed records count:', recs.length);
      console.log('📊 Sample record:', recs[0]);
      
      // Store all data first
      setAllGroups(recs);
      
      // Apply date filtering
      let filteredGroups = filterGroupsByDate(recs);
      console.log('📅 After date filtering:', filteredGroups.length);
      
      // Check for auto-fallback to previous trading day
      filteredGroups = checkAndFallbackData(filteredGroups);
      console.log('🔍 After fallback check:', filteredGroups.length);
      
      setGroups(filteredGroups);
      const summaryRows = filteredGroups.map(summarizeGroup);
      console.log('📋 Summary rows created:', summaryRows.length);
      console.log('📋 Sample summary row:', summaryRows[0]);
      
      setRows(summaryRows);
      setPage(0);
      setError(null);
    } catch (e) {
      console.error('❌ Error fetching data:', e);
      setError(e.message || 'Failed to load grouped fusion/trade/trail data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    refetch(); 
    
    // Auto-refresh every 60 seconds
    const intervalId = setInterval(() => {
      refetch();
    }, 60000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []); // eslint-disable-line

  useEffect(() => {
    console.log('Selected columns:', selectedColumns);
    console.log('Display columns:', displayColumns);
  }, [selectedColumns, displayColumns]);

  useEffect(() => {
    // Apply date filter when filter changes (except during initial load)
    if (allGroups.length > 0) {
      applyDateFilter();
    }
  }, [dateFilter, customStartDate, customEndDate]);

  const groupById = useMemo(
    () => Object.fromEntries((groups || []).map(g => [g.parent_order_id, g])),
    [groups]
  );

  // Search across selected columns
  const filtered = useMemo(() => {
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter(r => selectedColumns.some(c => {
      const val = r[c];
      const s = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : (val == null ? '' : String(val));
      return s.toLowerCase().includes(q);
    }));
  }, [rows, query, selectedColumns]);

  // Sorting
  const comparator = (a, b, key) => {
    const dir = orderDirection === 'asc' ? 1 : -1;
    if (key === 'event_ts') {
      const ma = parseToMoment(a[key]);
      const mb = parseToMoment(b[key]);
      const va = (ma && ma.isValid()) ? ma.valueOf() : 0;
      const vb = (mb && mb.isValid()) ? mb.valueOf() : 0;
      return (va - vb) * dir;
    }
    if (key === 'total_matched_pnl' || key === 'pnl_pct_of_margin' || key === 'pnl_pct_of_cost') return (((a[key] ?? 0) - (b[key] ?? 0)) * dir);
    const sa = String(a[key] ?? '').toLowerCase();
    const sb = String(b[key] ?? '').toLowerCase();
    return (sa > sb ? 1 : sa < sb ? -1 : 0) * dir;
  };
  const sorted = useMemo(() => {
    const arr = [...filtered];
    return orderBy ? arr.sort((a, b) => comparator(a, b, orderBy)) : arr;
  }, [filtered, orderBy, orderDirection]);

  const visible = useMemo(
    () => sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sorted, page, rowsPerPage]
  );

  // ---------- Profitability Summary (based on FILTERED rows, EXCLUDING in-progress) ----------
  const summary = useMemo(() => {
    const completed = filtered.filter(r => !r.in_progress);
    const excluded = filtered.length - completed.length;

    const totalMatchedPnl = sum(completed.map(r => r.total_matched_pnl));
    const totalBuy = sum(completed.map(r => r.buy_cost_total || 0));
    const totalSell = sum(completed.map(r => r.sell_value_total || 0));
    const capitalChange = totalSell - totalBuy; // absolute PnL on cost basis
    const portfolioPct = totalBuy > 0 ? (capitalChange / totalBuy) * 100 : null;
    const sumOfRowPct = sum(completed.map(r => Number.isFinite(+r.pnl_pct_of_cost) ? +r.pnl_pct_of_cost : 0));

    // *** NEW: Calculate True Portfolio Performance based on Available Margin ***
    // Get all trades from filtered parent orders to calculate margin-based performance
    const allRelevantTrades = [];
    completed.forEach(row => {
      // Find the corresponding group for this row
      const correspondingGroup = groups.find(g => g.parent_order_id === row.parent_order_id);
      if (correspondingGroup && Array.isArray(correspondingGroup.trades)) {
        correspondingGroup.trades.forEach(trade => {
          if (trade.available_margin !== undefined && trade.available_margin !== null) {
            allRelevantTrades.push({
              ...trade,
              parent_order_id: correspondingGroup.parent_order_id,
              order_timestamp: trade.order_timestamp || trade.exchange_timestamp
            });
          }
        });
      }
    });

    // Sort by timestamp and calculate true portfolio performance
    allRelevantTrades.sort((a, b) => {
      const timeA = parseToMoment(a.order_timestamp || a.exchange_timestamp);
      const timeB = parseToMoment(b.order_timestamp || b.exchange_timestamp);
      return timeA && timeB ? timeA.valueOf() - timeB.valueOf() : 0;
    });

    let truePnlPct = null;
    let fundMovement = null;
    if (allRelevantTrades.length > 0) {
      const firstTrade = allRelevantTrades[0];
      const lastTrade = allRelevantTrades[allRelevantTrades.length - 1];
      
      // Calculate initial capital (available + used margin from first trade)
      let initialCapital = firstTrade.available_margin;
      if (firstTrade.transaction_type === 'BUY' && firstTrade.used_margin) {
        initialCapital = firstTrade.available_margin + firstTrade.used_margin;
      }
      
      const finalCapital = lastTrade.available_margin;
      
      if (initialCapital > 0) {
        const actualPnl = finalCapital - initialCapital;
        truePnlPct = (actualPnl / initialCapital) * 100;
        
        fundMovement = {
          initial: initialCapital,
          final: finalCapital,
          change: actualPnl,
          changePercent: truePnlPct
        };
      }
    }
    const wins = completed.filter(r => (r.sell_value_total - r.buy_cost_total) > 0).length;
    const losses = completed.filter(r => (r.sell_value_total - r.buy_cost_total) < 0).length;
    const decided = wins + losses; // exclude FLAT
    const winRate = decided ? (wins / decided) * 100 : null;
    const lossRate = decided ? (losses / decided) * 100 : null;

    return {
      parents: completed.length,
      excluded,
      totalMatchedPnl,
      totalBuy,
      totalSell,
      capitalChange,
      portfolioPct,
      sumOfRowPct,
      truePnlPct,         // NEW: True portfolio performance based on available margin
      fundMovement,       // NEW: Fund movement analysis
      wins,
      losses,
      decided,
      winRate,
      lossRate
    };
  }, [filtered, groups]);

  const rowTheme = (pnl, in_progress) => {
    if (in_progress) return { left: '#9e9e9e', bg: 'rgba(158,158,158,0.06)', chipBg: 'rgba(158,158,158,0.15)', chipColor: '#bdbdbd', chipBorder: '#9e9e9e50' };
    if (pnl > 0) return { left: '#4caf50', bg: 'rgba(76,175,80,0.06)', chipBg: 'rgba(76,175,80,0.15)', chipColor: '#4caf50', chipBorder: '#4CAF5050' };
    if (pnl < 0) return { left: '#f44336', bg: 'rgba(244,67,54,0.06)', chipBg: 'rgba(244,67,54,0.15)', chipColor: '#f44336', chipBorder: '#F4433650' };
    return { left: '#9e9e9e', bg: 'rgba(158,158,158,0.06)', chipBg: 'rgba(158,158,158,0.15)', chipColor: '#bdbdbd', chipBorder: '#9e9e9e50' };
  };

  const handleRequestSort = (key) => {
    const isAsc = orderBy === key && orderDirection === 'asc';
    setOrderBy(key);
    setOrderDirection(isAsc ? 'desc' : 'asc');
  };

  const openDialog = (row, view = 'fusion') => {
    const g = groupById[row.parent_order_id] || null;
    setSelected(row);
    setSelectedGroup(g);
    setDetailView(view);
  };

  // Get all unique tags from trades
  const getAllTags = () => {
    const tags = new Set();
    groups.forEach(group => {
      const trades = Array.isArray(group.trades) ? group.trades : [];
      trades.forEach(trade => {
        if (trade.tag) tags.add(trade.tag);
      });
    });
    return Array.from(tags).sort();
  };

  // Enhanced CSV export with filtering
  const exportCSV = (rows, columns) => {
    if (!rows?.length) return;
    const header = columns.join(',');
    const lines = rows.map(r =>
      columns
        .map(c => {
          const v = r[c];
          const cell = typeof v === 'object'
            ? JSON.stringify(v)
            : (v == null ? '' : String(v));
          return `"${String(cell).replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fusion-data-${moment().format('YYYYMMDD-HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export detailed trades CSV with fusion and trail data
  const exportDetailedCSV = (groupsData, filterTag = null) => {
    if (!groupsData?.length) return;
    
    const detailedRows = [];
    groupsData.forEach(group => {
      const parentId = group.parent_order_id || '';
      const tradingsymbol = group.tradingsymbol || '';
      
      // Add fusion data
      const fusions = Array.isArray(group.fusion) ? group.fusion : [];
      fusions.forEach(fusion => {
        detailedRows.push({
          data_type: 'FUSION',
          parent_order_id: parentId,
          tradingsymbol: tradingsymbol || fusion.symbol || '',
          event_ts: formatToIST(fusion.event_ts),
          signal_type: fusion.signal_type || '',
          nifty_ltp: fusion.nifty_ltp || '',
          premium_ltp: fusion.premium_ltp || '',
          oi_change: fusion.oi_change || '',
          volume: fusion.volume || '',
          reasons: fusion.reasons || '',
          settled_at: fusion.settled_at ? formatToIST(fusion.settled_at) : '',
          tag: '',
          transaction_type: '',
          quantity: '',
          price: '',
          order_id: '',
          exchange_order_id: '',
          status: ''
        });
      });
      
      // Add trade data
      const trades = Array.isArray(group.trades) ? group.trades : [];
      trades.forEach(trade => {
        // Apply tag filter if specified
        if (filterTag && trade.tag !== filterTag) {
          return; // Skip this trade
        }
        
        detailedRows.push({
          data_type: 'TRADE',
          parent_order_id: parentId,
          tradingsymbol: tradingsymbol || trade.tradingsymbol || '',
          event_ts: formatToIST(trade.order_timestamp),
          signal_type: '',
          nifty_ltp: '',
          premium_ltp: '',
          oi_change: '',
          volume: '',
          reasons: '',
          settled_at: '',
          tag: trade.tag || '',
          transaction_type: trade.transaction_type || '',
          quantity: trade.filled_quantity || trade.quantity || 0,
          price: trade.average_price || 0,
          order_id: trade.order_id || '',
          exchange_order_id: trade.exchange_order_id || '',
          status: trade.status || ''
        });
      });
      
      // Add trail data
      const trails = Array.isArray(group.trail) ? group.trail : [];
      trails.forEach(trail => {
        detailedRows.push({
          data_type: 'TRAIL',
          parent_order_id: parentId,
          tradingsymbol: tradingsymbol || trail.tradingsymbol || '',
          event_ts: formatToIST(trail.latest_date),
          signal_type: '',
          nifty_ltp: trail.nifty_ltp || '',
          premium_ltp: trail.premium_ltp || '',
          oi_change: '',
          volume: '',
          reasons: '',
          settled_at: '',
          tag: '',
          transaction_type: '',
          quantity: trail.qty || '',
          price: trail.entry_price || '',
          order_id: '',
          exchange_order_id: '',
          status: trail.is_live ? 'LIVE' : 'CLOSED'
        });
      });
    });

    const columns = ['data_type', 'parent_order_id', 'tradingsymbol', 'event_ts', 'signal_type', 'tag', 'transaction_type', 
                     'quantity', 'price', 'nifty_ltp', 'premium_ltp', 'oi_change', 'volume', 'reasons', 
                     'settled_at', 'order_id', 'exchange_order_id', 'status'];
    const header = columns.join(',');
    const lines = detailedRows.map(r =>
      columns.map(c => {
        const v = r[c];
        const cell = v == null ? '' : String(v);
        return `"${String(cell).replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fusion-detailed-${moment().format('YYYYMMDD-HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Apply CSV filters and export
  const handleCsvExport = () => {
    let filteredRows = [...rows];
    
    // Filter by profit/loss
    if (csvFilterLossOnly) {
      filteredRows = filteredRows.filter(r => !r.in_progress && (r.total_matched_pnl || 0) < 0);
    } else if (csvFilterProfitOnly) {
      filteredRows = filteredRows.filter(r => !r.in_progress && (r.total_matched_pnl || 0) > 0);
    }
    
    // Filter by in-progress
    if (!csvIncludeInProgress) {
      filteredRows = filteredRows.filter(r => !r.in_progress);
    }
    
    // Get parent IDs from filtered rows
    let filteredParentIds = new Set(filteredRows.map(r => r.parent_order_id));
    
    // For detailed export with tag filter, we need to filter at the group level
    // to ensure we only include groups that have trades with the specified tag
    if (csvExportType === 'detailed' && csvFilterTag !== 'all') {
      const groupsWithTag = groups.filter(group => {
        const trades = Array.isArray(group.trades) ? group.trades : [];
        return trades.some(trade => trade.tag === csvFilterTag);
      });
      const tagFilteredParentIds = new Set(groupsWithTag.map(g => g.parent_order_id));
      
      // Intersect with existing filtered parent IDs
      filteredParentIds = new Set([...filteredParentIds].filter(id => tagFilteredParentIds.has(id)));
    } else if (csvFilterTag !== 'all') {
      // For summary export, filter by tag
      const filteredGroups = groups.filter(group => {
        const trades = Array.isArray(group.trades) ? group.trades : [];
        return trades.some(trade => trade.tag === csvFilterTag);
      });
      const tagFilteredParentIds = new Set(filteredGroups.map(g => g.parent_order_id));
      filteredParentIds = new Set([...filteredParentIds].filter(id => tagFilteredParentIds.has(id)));
      filteredRows = filteredRows.filter(r => filteredParentIds.has(r.parent_order_id));
    }
    
    if (csvExportType === 'detailed') {
      // Export detailed trades with fusion and trail data
      let filteredGroupsForDetailed = groups.filter(g => filteredParentIds.has(g.parent_order_id));
      // Pass the tag filter to exportDetailedCSV so it can filter individual trades
      exportDetailedCSV(filteredGroupsForDetailed, csvFilterTag !== 'all' ? csvFilterTag : null);
    } else {
      // Export summary
      exportCSV(filteredRows, selectedColumns);
    }
    
    setCsvExportOpen(false);
    // Reset filters
    setCsvFilterLossOnly(false);
    setCsvFilterProfitOnly(false);
    setCsvFilterTag('all');
    setCsvIncludeInProgress(false);
    setCsvExportType('summary');
  };

  const ActionButtons = ({ row }) => (
    <Stack direction="row" spacing={1}>
      <Button
        size="small"
        variant="outlined"
        onClick={(e) => { e.stopPropagation(); openDialog(row, 'trade'); }}
        sx={{ borderColor: '#90caf9', color: '#90caf9', textTransform: 'none' }}
      >Trade</Button>
      <Button
        size="small"
        variant="outlined"
        onClick={(e) => { e.stopPropagation(); openDialog(row, 'trail'); }}
        sx={{ borderColor: '#ffcc80', color: '#ffcc80', textTransform: 'none' }}
      >Trail</Button>
    </Stack>
  );

  return (
    <div>
      <CustomAppBar />
      <Container maxWidth="xl" sx={{ 
        mt: 2, 
        px: { xs: 0.5, sm: 2, md: 3 },
        mx: { xs: 0.5, sm: 'auto' }
      }}>
        <Paper
          sx={{
            p: { xs: 1, sm: 1.5, md: 2 },
            background: '#070B0A',
            borderRadius: { xs: 1, md: 2 },
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            mx: { xs: 0, sm: 0 },
            width: { xs: 'calc(100vw - 16px)', sm: 'auto' },
            maxWidth: { xs: 'none', sm: 'auto' }
          }}
        >
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={{ xs: 1, sm: 1.5 }} 
            alignItems={{ xs: 'stretch', sm: 'center' }} 
            justifyContent="space-between" 
            sx={{ mb: { xs: 1.5, md: 2 } }}
          >
            <TextField
              label="Search"
              variant="outlined"
              size="small"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0); }}
              fullWidth
              sx={{ 
                maxWidth: { xs: 'none', sm: '300px' },
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.875rem', md: '1rem' }
                },
                '& .MuiInputLabel-root': { 
                  color: '#00ffaa',
                  fontSize: { xs: '0.875rem', md: '1rem' }
                },
                '& .MuiOutlinedInput-notchedOutline': { 
                  borderColor: 'rgba(255,255,255,0.2)' 
                },
                '&:hover .MuiOutlinedInput-notchedOutline': { 
                  borderColor: '#00ffaa' 
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { 
                  borderColor: '#00ffaa' 
                }
              }}
              InputProps={{ sx: { background: 'rgba(255,255,255,0.05)', borderRadius: 1, color: '#e0e0e0' } }}
            />
            
            {/* Date Filter Controls */}
            <Stack 
              direction={{ xs: 'column', sm: 'row' }} 
              spacing={{ xs: 0.5, sm: 1 }} 
              alignItems="center" 
              sx={{ 
                minWidth: { xs: '100%', sm: 'auto' },
                width: { xs: '100%', sm: 'auto' }
              }}
            >
              <FormControl size="small" sx={{ 
                minWidth: { xs: '100%', sm: 150 },
                maxWidth: { xs: '100%', sm: 200 }
              }}>
                <InputLabel sx={{ 
                  color: '#00ffaa',
                  fontSize: { xs: '0.875rem', md: '1rem' }
                }}>Date Filter</InputLabel>
                <Select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  label="Date Filter"
                  MenuProps={{
                    anchorEl: dateFilterAnchor,
                    onClose: () => setDateFilterAnchor(null)
                  }}
                  sx={{ 
                    fontSize: { xs: '0.875rem', md: '1rem' },
                    background: 'rgba(255,255,255,0.05)',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' },
                    color: '#e0e0e0'
                  }}
                >
                  {getDateFilterOptions().map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {dateFilter === 'custom' && (
                <>
                  <TextField
                    type="date"
                    label="Start Date"
                    size="small"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ 
                      minWidth: 140,
                      background: 'rgba(255,255,255,0.05)',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' },
                      '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' },
                      '& .MuiInputLabel-root': { color: '#00ffaa' },
                      '& .MuiInputBase-input': { color: '#e0e0e0' }
                    }}
                  />
                  <TextField
                    type="date"
                    label="End Date"
                    size="small"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ 
                      minWidth: 140,
                      background: 'rgba(255,255,255,0.05)',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' },
                      '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' },
                      '& .MuiInputLabel-root': { color: '#00ffaa' },
                      '& .MuiInputBase-input': { color: '#e0e0e0' }
                    }}
                  />
                </>
              )}
              
              {/* Quick filter buttons */}
              {dateFilter !== 'today' && (
                <Tooltip title="Jump to Today">
                  <Button
                    size="small"
                    onClick={() => setDateFilter('today')}
                    sx={{ 
                      minWidth: 'auto',
                      px: 1.5,
                      color: '#90caf9',
                      borderColor: '#90caf950',
                      '&:hover': { borderColor: '#90caf9', bgcolor: 'rgba(144, 202, 249, 0.08)' }
                    }}
                    variant="outlined"
                  >
                    Today
                  </Button>
                </Tooltip>
              )}
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
              <Tooltip title="Refresh">
                <IconButton onClick={refetch} sx={{ color: '#00ffaa' }}><RefreshIcon /></IconButton>
              </Tooltip>
              <Tooltip title="Columns">
                <IconButton onClick={(e) => setColMenuEl(e.currentTarget)} sx={{ color: '#00ffaa' }}><ViewColumnIcon /></IconButton>
              </Tooltip>
              <Menu anchorEl={colMenuEl} open={Boolean(colMenuEl)} onClose={() => setColMenuEl(null)}>
                {displayColumns.concat(['pnl_pct_of_margin']).map((col) => (
                  <MenuItem key={col} onClick={() => {
                    setSelectedColumns(prev => {
                      const exists = prev.includes(col);
                      if (exists) {
                        const next = prev.filter(c => c !== col);
                        return next.length ? next : prev;
                      }
                      return [...prev, col];
                    });
                  }}>
                    <Checkbox checked={selectedColumns.includes(col)} />
                    <Typography>{humanize(col)}</Typography>
                  </MenuItem>
                ))}
              </Menu>
              <Tooltip title={dense ? 'Comfortable density' : 'Compact density'}>
                <IconButton onClick={() => setDense((d) => !d)} sx={{ color: '#00ffaa' }}><DensitySmallIcon /></IconButton>
              </Tooltip>
              <Tooltip title="Export CSV">
                <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => setCsvExportOpen(true)} sx={{ bgcolor: '#00ffaa', color: '#002b36' }}>
                  {isMobile ? 'CSV' : 'Export CSV'}
                </Button>
              </Tooltip>
            </Stack>
          </Stack>

          {/* ===== Profitability Summary Banner ===== */}
          <Box
            sx={{
              mb: 2,
              p: 2,
              background: '#070B0A',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography sx={{ color: '#00ffaa', fontWeight: 700 }}>
                Profitability Summary (Completed Parents: {summary.parents})
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body2" sx={{ color: '#90caf9' }}>
                  Showing {groups.length} of {allGroups.length} records
                </Typography>
                {dateFilter !== 'all' && (
                  <Chip
                    size="small"
                    label={`📅 ${getActiveDateFilterLabel()}`}
                    sx={{ bgcolor: 'rgba(0,255,170,0.15)', color: '#00ffaa', border: '1px solid #00ffaa50' }}
                  />
                )}
                {summary.excluded > 0 && (
                  <Chip
                    size="small"
                    label={`Excludes ${summary.excluded} in-progress`}
                    sx={{ bgcolor: 'rgba(158,158,158,0.12)', color: '#bdbdbd', border: '1px solid #9e9e9e50' }}
                  />
                )}
              </Stack>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(6, 1fr)' },
                gap: 1.5
              }}
            >
              {/* Capital Change */}
              <Paper sx={{ p: 1.5, bgcolor: 'rgba(0, 255, 170, 0.08)', border: '1px solid #00ffaa30', borderRadius: 2 }}>
                <Typography variant="body2" sx={{ color: '#a7ffeb' }}>Capital Change</Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: 'Roboto Mono, monospace',
                    color: summary.capitalChange >= 0 ? '#00e676' : '#ff5252',
                    fontWeight: 800
                  }}
                >
                  ₹{fmtNum(summary.capitalChange, 2)}
                </Typography>
              </Paper>

              {/* Portfolio PnL % (weighted on cost) */}
              <Paper sx={{ p: 1.5, bgcolor: 'rgba(0, 255, 170, 0.08)', border: '1px solid #00ffaa30', borderRadius: 2 }}>
                <Typography variant="body2" sx={{ color: '#a7ffeb' }}>Portfolio PnL % of Cost</Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: 'Roboto Mono, monospace',
                    color: (summary.portfolioPct ?? 0) >= 0 ? '#00e676' : '#ff5252',
                    fontWeight: 800
                  }}
                >
                  {summary.portfolioPct == null ? '—' : `${fmtNum(summary.portfolioPct, 2)}%`}
                </Typography>
                <Typography variant="caption" sx={{ color: '#9ecbff' }}>
                  (Weighted) (ΣSell−ΣBuy)/ΣBuy
                </Typography>
              </Paper>

              {/* Sum of Row % (unweighted) */}
              <Paper sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 2 }}>
                <Typography variant="body2" sx={{ color: '#bbdefb' }}>True Portfolio P&L %</Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: 'Roboto Mono, monospace',
                    color: summary.truePnlPct !== null 
                      ? (summary.truePnlPct >= 0 ? '#90caf9' : '#ff8a80')
                      : '#9e9e9e',
                    fontWeight: 800
                  }}
                >
                  {summary.truePnlPct !== null ? fmtNum(summary.truePnlPct, 2) + '%' : '—'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#9ecbff' }}>
                  (Simple Σ of each row’s %)
                </Typography>
              </Paper>

              {/* Total Buy Cost */}
              <Paper sx={{ p: 1.5, bgcolor: 'rgba(255, 255, 255, 0.04)', border: '1px solid #ffffff12', borderRadius: 2 }}>
                <Typography variant="body2" sx={{ color: '#e0f7fa' }}>Total Buy Cost</Typography>
                <Typography variant="h6" sx={{ fontFamily: 'Roboto Mono, monospace', color: '#e0f7fa', fontWeight: 800 }}>
                  ₹{fmtNum(summary.totalBuy, 2)}
                </Typography>
              </Paper>

              {/* Total Sell Value */}
              <Paper sx={{ p: 1.5, bgcolor: 'rgba(255, 255, 255, 0.04)', border: '1px solid #ffffff12', borderRadius: 2 }}>
                <Typography variant="body2" sx={{ color: '#e0f7fa' }}>Total Sell Value</Typography>
                <Typography variant="h6" sx={{ fontFamily: 'Roboto Mono, monospace', color: '#e0f7fa', fontWeight: 800 }}>
                  ₹{fmtNum(summary.totalSell, 2)}
                </Typography>
              </Paper>

              {/* Wins / Losses + Rates */}
              <Paper 
                sx={{ 
                  p: 1.5, 
                  bgcolor: 'rgba(255, 255, 255, 0.08)', 
                  border: '1px solid rgba(255,255,255,0.2)', 
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    bgcolor: 'rgba(0, 255, 170, 0.12)',
                    border: '1px solid #00ffaa80',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0, 255, 170, 0.3)'
                  }
                }}
                onClick={() => setAnalyticsOpen(true)}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ color: '#e0f7fa' }}>Outcome Split</Typography>
                  <BarChartIcon sx={{ fontSize: 16, color: '#00ffaa' }} />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                  <Chip size="small" label={`Wins: ${summary.wins}`} sx={{ bgcolor: 'rgba(76,175,80,0.25)', color: '#81C784', border: '1px solid #4CAF5080' }} />
                  <Chip size="small" label={`Losses: ${summary.losses}`} sx={{ bgcolor: 'rgba(244,67,54,0.25)', color: '#EF5350', border: '1px solid #F4433680' }} />
                  <Chip
                    size="small"
                    label={`Win %: ${summary.winRate == null ? '—' : fmtNum(summary.winRate, 2) + '%'}`}
                    sx={{ bgcolor: 'rgba(76,175,80,0.20)', color: '#81C784', border: '1px solid #4CAF5060' }}
                  />
                  <Chip
                    size="small"
                    label={`Loss %: ${summary.lossRate == null ? '—' : fmtNum(summary.lossRate, 2) + '%'}`}
                    sx={{ bgcolor: 'rgba(244,67,54,0.20)', color: '#EF5350', border: '1px solid #F4433650' }}
                  />
                </Stack>
                {summary.decided === 0 && (
                  <Typography variant="caption" sx={{ color: '#9e9e9e', mt: 0.5, display: 'block' }}>
                    No completed profitable/loss trades in the current filter.
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: '#00ffaa', mt: 0.5, display: 'block', fontWeight: 600 }}>
                  Click for detailed analytics →
                </Typography>
              </Paper>
            </Box>

            {/* Fund Movement Analysis */}
            {summary.fundMovement && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" sx={{ color: '#00ffaa', mb: 1.5, fontWeight: 600 }}>
                  💰 Fund Movement Analysis
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                    gap: 1.5
                  }}
                >
                  <Paper sx={{ p: 1.5, bgcolor: 'rgba(76, 175, 80, 0.08)', border: '1px solid #4CAF5030', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ color: '#a5d6a7' }}>Initial Capital</Typography>
                    <Typography variant="h6" sx={{ fontFamily: 'Roboto Mono, monospace', color: '#4CAF50', fontWeight: 800 }}>
                      ₹{fmtNum(summary.fundMovement.initial, 2)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#c8e6c9' }}>
                      Available + Used Margin
                    </Typography>
                  </Paper>

                  <Paper sx={{ p: 1.5, bgcolor: 'rgba(33, 150, 243, 0.08)', border: '1px solid #2196F330', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ color: '#90caf9' }}>Final Capital</Typography>
                    <Typography variant="h6" sx={{ fontFamily: 'Roboto Mono, monospace', color: '#2196F3', fontWeight: 800 }}>
                      ₹{fmtNum(summary.fundMovement.final, 2)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#bbdefb' }}>
                      Available Margin
                    </Typography>
                  </Paper>

                  <Paper sx={{ 
                    p: 1.5, 
                    bgcolor: summary.fundMovement.change >= 0 ? 'rgba(76, 175, 80, 0.08)' : 'rgba(244, 67, 54, 0.08)', 
                    border: summary.fundMovement.change >= 0 ? '1px solid #4CAF5030' : '1px solid #F4433630', 
                    borderRadius: 2 
                  }}>
                    <Typography variant="body2" sx={{ color: summary.fundMovement.change >= 0 ? '#a5d6a7' : '#ffcdd2' }}>Net Change</Typography>
                    <Typography variant="h6" sx={{ 
                      fontFamily: 'Roboto Mono, monospace', 
                      color: summary.fundMovement.change >= 0 ? '#4CAF50' : '#F44336', 
                      fontWeight: 800 
                    }}>
                      {summary.fundMovement.change >= 0 ? '+' : ''}₹{fmtNum(summary.fundMovement.change, 2)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: summary.fundMovement.change >= 0 ? '#c8e6c9' : '#ffcdd2' }}>
                      Actual P&L
                    </Typography>
                  </Paper>

                  <Paper sx={{ 
                    p: 1.5, 
                    bgcolor: summary.fundMovement.changePercent >= 0 ? 'rgba(76, 175, 80, 0.08)' : 'rgba(244, 67, 54, 0.08)', 
                    border: summary.fundMovement.changePercent >= 0 ? '1px solid #4CAF5030' : '1px solid #F4433630', 
                    borderRadius: 2 
                  }}>
                    <Typography variant="body2" sx={{ color: summary.fundMovement.changePercent >= 0 ? '#a5d6a7' : '#ffcdd2' }}>Return %</Typography>
                    <Typography variant="h6" sx={{ 
                      fontFamily: 'Roboto Mono, monospace', 
                      color: summary.fundMovement.changePercent >= 0 ? '#4CAF50' : '#F44336', 
                      fontWeight: 800 
                    }}>
                      {summary.fundMovement.changePercent >= 0 ? '+' : ''}{fmtNum(summary.fundMovement.changePercent, 2)}%
                    </Typography>
                    <Typography variant="caption" sx={{ color: summary.fundMovement.changePercent >= 0 ? '#c8e6c9' : '#ffcdd2' }}>
                      True Portfolio ROI
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            )}

            <Typography variant="caption" sx={{ color: '#9e9e9e', mt: 1.2, display: 'block' }}>
              Note: In-progress (open) parents are excluded to avoid misleading % (e.g., -100% when ΣSell=0).
            </Typography>
          </Box>
          {/* ===== END Summary Banner ===== */}

          <Typography sx={{ color: '#00ffaa', mb: 1, fontWeight: 600 }}>
            Fusion / Trade / Trail (Grouped by Parent) — Total Parents: {rows.length}
          </Typography>
          
          {/* Debug info removed for cleaner UI */}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : (
            <Box>
              {/* Compact Table/Card View */}
              <Box>
                {visible.map((r, idx) => {
                  const tradeBasisPnl = (r.total_matched_pnl || 0);
                  const pnlPercentage = r.buy_cost_total ? ((r.total_matched_pnl || 0) / r.buy_cost_total * 100) : 0;

                  return (
                    <Card
                      key={idx}
                      onClick={() => openDialog(r, 'fusion')}
                      sx={{
                        background: tradeBasisPnl >= 0 
                          ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.08) 0%, rgba(7,11,10,0.95) 100%)'
                          : 'linear-gradient(135deg, rgba(244, 67, 54, 0.08) 0%, rgba(7,11,10,0.95) 100%)',
                        border: `1px solid ${tradeBasisPnl >= 0 ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'}`,
                        borderRadius: 2,
                        mb: { xs: 1, sm: 1.5 },
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          transform: 'translateY(-1px)',
                          border: `1px solid ${tradeBasisPnl >= 0 ? 'rgba(76, 175, 80, 0.5)' : 'rgba(244, 67, 54, 0.5)'}`,
                          boxShadow: `0 2px 8px ${tradeBasisPnl >= 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)'}`
                        }
                      }}
                    >
                      <CardContent sx={{ p: { xs: 1, sm: 1.5 } }}>
                        {/* Header: Symbol, Signal Type, and Tag */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                              {r.tradingsymbol}
                            </Typography>
                            <Chip label={r.signal_type} size="small" sx={{
                              backgroundColor: r.signal_type === 'BUY' ? '#00c853' : '#ff1744',
                              color: '#fff', fontWeight: 600, fontSize: '0.7rem'
                            }} />
                            <Chip label={r.tag || 'UNTAGGED'} size="small" sx={{
                              backgroundColor: r.tag ? (
                                r.tag === 'TGT_EXIT' ? '#4caf50' :
                                r.tag === 'TSL_EXIT' ? (tradeBasisPnl >= 0 ? '#ff9800' : '#f44336') :
                                r.tag === 'Hard_SL' ? '#f44336' :
                                r.tag === 'VETO_BLOCK' ? (tradeBasisPnl >= 0 ? '#9c27b0' : '#f44336') :
                                r.tag === 'Market_Close' ? (tradeBasisPnl >= 0 ? '#2196f3' : '#f44336') :
                                '#00a676'
                              ) : '#616161',
                              color: '#fff', fontWeight: 600, fontSize: '0.65rem'
                            }} />
                          </Box>
                          <Typography variant="body2" sx={{ color: '#bdbdbd', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                            {formatToIST(r.event_ts)}
                          </Typography>
                        </Box>

                        {/* Compact data table with key metrics */}
                        <Box sx={{ background: 'rgba(0,0,0,0.3)', borderRadius: 1, overflow: 'hidden', mb: 1 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ color: '#00ffaa', fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' }, py: 0.5, px: 1 }}>Qty</TableCell>
                                <TableCell sx={{ color: '#00ffaa', fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' }, py: 0.5, px: 1 }}>Buy ₹</TableCell>
                                <TableCell sx={{ color: '#00ffaa', fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' }, py: 0.5, px: 1 }}>Sell ₹</TableCell>
                                <TableCell sx={{ color: '#00ffaa', fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' }, py: 0.5, px: 1 }}>Cost</TableCell>
                                <TableCell sx={{ color: '#00ffaa', fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' }, py: 0.5, px: 1 }}>PnL</TableCell>
                                <TableCell sx={{ color: '#00ffaa', fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' }, py: 0.5, px: 1 }}>%</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              <TableRow>
                                <TableCell sx={{ color: '#fff', fontSize: { xs: '0.75rem', sm: '0.8rem' }, py: 0.75, px: 1 }}>{r.buy_qty || 'N/A'}</TableCell>
                                <TableCell sx={{ color: '#4caf50', fontSize: { xs: '0.75rem', sm: '0.8rem' }, py: 0.75, px: 1 }}>{r.buy_price ? r.buy_price.toFixed(2) : 'N/A'}</TableCell>
                                <TableCell sx={{ color: '#f44336', fontSize: { xs: '0.75rem', sm: '0.8rem' }, py: 0.75, px: 1 }}>{r.sell_price ? r.sell_price.toFixed(2) : 'N/A'}</TableCell>
                                <TableCell sx={{ color: '#ff9800', fontSize: { xs: '0.75rem', sm: '0.8rem' }, py: 0.75, px: 1 }}>{r.buy_cost_total ? '₹' + r.buy_cost_total.toLocaleString() : 'N/A'}</TableCell>
                                <TableCell sx={{ color: tradeBasisPnl >= 0 ? '#4caf50' : '#f44336', fontWeight: 700, fontSize: { xs: '0.75rem', sm: '0.85rem' }, py: 0.75, px: 1 }}>
                                  {tradeBasisPnl >= 0 ? '+' : ''}₹{r.total_matched_pnl ? r.total_matched_pnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'N/A'}
                                </TableCell>
                                <TableCell sx={{ color: tradeBasisPnl >= 0 ? '#4caf50' : '#f44336', fontWeight: 700, fontSize: { xs: '0.75rem', sm: '0.85rem' }, py: 0.75, px: 1 }}>
                                  {tradeBasisPnl >= 0 ? '+' : ''}{(pnlPercentage || 0).toFixed(1)}%
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </Box>

                        {/* Footer: Status and Actions */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                          <Typography variant="caption" sx={{ color: '#bdbdbd', fontSize: { xs: '0.65rem', sm: '0.7rem' } }}>
                            {r.in_progress ? '🔄 IN PROGRESS' : '✅ COMPLETED'} • Click for details
                          </Typography>
                          <Box onClick={(e) => e.stopPropagation()}>
                            <ActionButtons row={r} />
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Pagination */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center',
                  alignItems: 'center',
                  mt: 3,
                  gap: 2,
                  flexWrap: 'wrap'
                }}>
                  <Typography variant="body2" sx={{ color: '#9e9e9e' }}>
                    Showing {visible.length} of {rows.length} entries
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                      sx={{
                        color: '#00ffaa',
                        borderColor: '#00ffaa',
                        '&:hover': { borderColor: '#00ffaa', backgroundColor: 'rgba(0, 255, 170, 0.1)' }
                      }}
                    >
                      Previous
                    </Button>
                    <Typography variant="body2" sx={{ color: '#ffffff', px: 1 }}>
                      Page {page + 1} of {Math.max(1, Math.ceil(rows.length / rowsPerPage))}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={(page + 1) * rowsPerPage >= rows.length}
                      onClick={() => setPage(page + 1)}
                      sx={{
                        color: '#00ffaa',
                        borderColor: '#00ffaa',
                        '&:hover': { borderColor: '#00ffaa', backgroundColor: 'rgba(0, 255, 170, 0.1)' }
                      }}
                    >
                      Next
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </Paper>
      </Container>

      {/* CSV Export Dialog */}
      <Dialog
        open={csvExportOpen}
        onClose={() => setCsvExportOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: '#070B0A',
            border: '2px solid #00ffaa',
            color: '#e0e0e0',
          }
        }}
      >
        <DialogTitle sx={{ 
          color: '#00ffaa', 
          fontWeight: 700,
          borderBottom: '1px solid rgba(0,255,170,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <DownloadIcon />
          Export CSV - Advanced Filters
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={3}>
            {/* Export Type */}
            <FormControl component="fieldset">
              <Typography variant="subtitle2" sx={{ color: '#00ffaa', mb: 1, fontWeight: 600 }}>
                Export Type
              </Typography>
              <RadioGroup
                value={csvExportType}
                onChange={(e) => setCsvExportType(e.target.value)}
              >
                <FormControlLabel 
                  value="summary" 
                  control={<Radio sx={{ color: '#00ffaa', '&.Mui-checked': { color: '#00ffaa' } }} />} 
                  label={<Typography sx={{ color: '#e0e0e0' }}>Summary (Parent-level data)</Typography>}
                />
                <FormControlLabel 
                  value="detailed" 
                  control={<Radio sx={{ color: '#00ffaa', '&.Mui-checked': { color: '#00ffaa' } }} />} 
                  label={<Typography sx={{ color: '#e0e0e0' }}>Detailed (Individual trades)</Typography>}
                />
              </RadioGroup>
            </FormControl>

            <Divider sx={{ borderColor: 'rgba(0,255,170,0.2)' }} />

            {/* Profit/Loss Filter */}
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#00ffaa', mb: 1, fontWeight: 600 }}>
                Filter by Outcome
              </Typography>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={csvFilterLossOnly}
                      onChange={(e) => {
                        setCsvFilterLossOnly(e.target.checked);
                        if (e.target.checked) setCsvFilterProfitOnly(false);
                      }}
                      sx={{ color: '#F44336', '&.Mui-checked': { color: '#F44336' } }}
                    />
                  }
                  label={<Typography sx={{ color: '#e0e0e0' }}>🔴 Loss-making trades only</Typography>}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={csvFilterProfitOnly}
                      onChange={(e) => {
                        setCsvFilterProfitOnly(e.target.checked);
                        if (e.target.checked) setCsvFilterLossOnly(false);
                      }}
                      sx={{ color: '#4CAF50', '&.Mui-checked': { color: '#4CAF50' } }}
                    />
                  }
                  label={<Typography sx={{ color: '#e0e0e0' }}>🟢 Profitable trades only</Typography>}
                />
              </FormGroup>
            </Box>

            <Divider sx={{ borderColor: 'rgba(0,255,170,0.2)' }} />

            {/* Tag Filter */}
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#00ffaa', mb: 1, fontWeight: 600 }}>
                Filter by Tag
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={csvFilterTag}
                  onChange={(e) => setCsvFilterTag(e.target.value)}
                  sx={{
                    color: '#e0e0e0',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa50' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' },
                    '.MuiSvgIcon-root': { color: '#00ffaa' }
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: '#0a0f0e',
                        border: '1px solid #00ffaa50',
                        '& .MuiMenuItem-root': {
                          color: '#e0e0e0',
                          '&:hover': { bgcolor: 'rgba(0,255,170,0.1)' },
                          '&.Mui-selected': { bgcolor: 'rgba(0,255,170,0.2)' }
                        }
                      }
                    }
                  }}
                >
                  <MenuItem value="all">All Tags</MenuItem>
                  {getAllTags().map(tag => (
                    <MenuItem key={tag} value={tag}>
                      {tag === 'Hard_SL' ? '🛑 ' : 
                       tag === 'TSL_EXIT' ? '📈 ' :
                       tag === 'TGT_EXIT' ? '🎯 ' :
                       tag === 'VETO_BLOCK' ? '🚫 ' :
                       tag === 'Market_Close' ? '🔔 ' : '📊 '}
                      {tag}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Divider sx={{ borderColor: 'rgba(0,255,170,0.2)' }} />

            {/* Include In-Progress */}
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={csvIncludeInProgress}
                    onChange={(e) => setCsvIncludeInProgress(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#00ffaa' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#00ffaa50' }
                    }}
                  />
                }
                label={
                  <Typography sx={{ color: '#e0e0e0' }}>
                    Include in-progress positions
                  </Typography>
                }
              />
            </Box>

            {/* Summary Info */}
            <Box sx={{ 
              p: 2, 
              bgcolor: 'rgba(0,255,170,0.1)', 
              borderRadius: 2,
              border: '1px solid rgba(0,255,170,0.3)'
            }}>
              <Typography variant="body2" sx={{ color: '#00ffaa', fontWeight: 600, mb: 0.5 }}>
                📋 Current Filters Active:
              </Typography>
              <Typography variant="caption" sx={{ color: '#e0e0e0', display: 'block' }}>
                • Date Range: {getActiveDateFilterLabel()}
              </Typography>
              <Typography variant="caption" sx={{ color: '#e0e0e0', display: 'block' }}>
                • Total Records: {rows.length}
              </Typography>
              {csvFilterLossOnly && (
                <Typography variant="caption" sx={{ color: '#F44336', display: 'block' }}>
                  • Filtering: Loss-making only
                </Typography>
              )}
              {csvFilterProfitOnly && (
                <Typography variant="caption" sx={{ color: '#4CAF50', display: 'block' }}>
                  • Filtering: Profitable only
                </Typography>
              )}
              {csvFilterTag !== 'all' && (
                <Typography variant="caption" sx={{ color: '#90caf9', display: 'block' }}>
                  • Tag Filter: {csvFilterTag}
                </Typography>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(0,255,170,0.3)', p: 2 }}>
          <Button 
            onClick={() => setCsvExportOpen(false)}
            sx={{ color: '#e0e0e0', borderColor: '#e0e0e050' }}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCsvExport}
            variant="contained"
            startIcon={<DownloadIcon />}
            sx={{ bgcolor: '#00ffaa', color: '#002b36', '&:hover': { bgcolor: '#00cc88' } }}
          >
            Export CSV
          </Button>
        </DialogActions>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        fullWidth
        maxWidth="xl"
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            background: '#070B0A',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#e0e0e0',
            minHeight: { xs: '100vh', sm: '80vh' },
            m: { xs: 0, sm: 2 },
            maxHeight: { xs: '100vh', sm: '90vh' }
          }
        }}
      >
        <DialogTitle sx={{ 
          color: '#00ffaa', 
          borderBottom: '1px solid #00ffaa30', 
          pr: { xs: 2, sm: 10 },
          pb: { xs: 1, sm: 2 },
          position: 'relative'
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            pr: { xs: 6, sm: 2 }
          }}>
            <BarChartIcon sx={{ color: '#00ffaa', fontSize: { xs: '1.2rem', sm: '1.5rem' } }} />
            <Typography variant="h6" sx={{ 
              fontWeight: 700,
              fontSize: { xs: '1rem', sm: '1.25rem' },
              wordBreak: 'break-word'
            }}>
              360° Analytics Overview
            </Typography>
          </Box>
          <IconButton
            onClick={() => setAnalyticsOpen(false)}
            sx={{ 
              position: 'absolute', 
              right: { xs: 8, sm: 8 }, 
              top: { xs: 8, sm: 8 }, 
              color: '#00ffaa',
              minWidth: { xs: '36px', sm: '40px' },
              minHeight: { xs: '36px', sm: '40px' },
              zIndex: 10
            }}
          >
            <CloseIcon fontSize={isMobile ? "small" : "medium"} />
          </IconButton>
        </DialogTitle>
        
        <DialogContent dividers sx={{ 
          background: 'transparent', 
          p: { xs: 1, sm: 3 },
          overflow: 'auto',
          wordBreak: 'break-word',
          overflowWrap: 'break-word'
        }}>
          {(() => {
            const analytics = computeAnalytics(rows, groups);
            const fmtNum = (n, d = 2) => {
              if (n == null || !isFinite(n)) return '—';
              return Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
            };
            
            return (
              <Box>
                {/* Date Range Indicator */}
                <Box sx={{ 
                  mb: 3, 
                  p: 2, 
                  background: 'linear-gradient(135deg, rgba(0, 255, 170, 0.1) 0%, rgba(0, 200, 150, 0.05) 100%)',
                  border: '1px solid #00ffaa40',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1
                }}>
                  <Typography variant="body2" sx={{ color: '#00ffaa', fontWeight: 600 }}>
                    📊 Analytics Period:
                  </Typography>
                  <Chip 
                    label={getActiveDateFilterLabel()} 
                    size="small"
                    sx={{ 
                      bgcolor: '#00ffaa20', 
                      color: '#00ffaa', 
                      border: '1px solid #00ffaa60',
                      fontWeight: 700
                    }}
                  />
                  <Typography variant="body2" sx={{ color: '#ccc' }}>
                    ({analytics.totalTrades} trades analyzed)
                  </Typography>
                </Box>

                {/* Enhanced Trading Philosophy Header */}
                <Box sx={{ 
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 193, 7, 0.08) 50%, rgba(255, 152, 0, 0.05) 100%)',
                  border: '3px solid transparent',
                  borderImage: 'linear-gradient(135deg, #FFD700, #FFC107, #FF9800) 1',
                  borderRadius: 3,
                  p: { xs: 3, md: 4 },
                  mb: 5,
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.02), rgba(255, 152, 0, 0.02))',
                    zIndex: -1
                  }
                }}>
                  <Typography variant="h4" sx={{ 
                    color: '#FFD700', 
                    fontWeight: 800, 
                    mb: 2,
                    fontSize: { xs: '1.5rem', md: '2rem' },
                    textShadow: '0 0 20px rgba(255, 215, 0, 0.3)'
                  }}>
                    🎯 Asymmetric Profitability Philosophy
                  </Typography>
                  <Typography variant="h6" sx={{ 
                    color: '#FFC107', 
                    fontWeight: 600, 
                    mb: 2,
                    fontSize: { xs: '1rem', md: '1.2rem' }
                  }}>
                    Professional Trading Mindset
                  </Typography>
                  <Typography variant="body1" sx={{ 
                    color: '#E8E8E8', 
                    maxWidth: 900, 
                    mx: 'auto',
                    fontSize: { xs: '0.95rem', md: '1.05rem' },
                    lineHeight: 1.6,
                    fontWeight: 400
                  }}>
                    <strong style={{ color: '#FFE082' }}>Quality over Quantity:</strong> Having more losing trades doesn't mean poor performance. 
                    What matters is that your winning trades generate significantly more profit than your losing trades lose.
                    This is the hallmark of professional trading - <em style={{ color: '#FFCC80' }}>asymmetric risk/reward.</em>
                  </Typography>
                  <Box sx={{ 
                    mt: 3, 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: 2, 
                    flexWrap: 'wrap' 
                  }}>
                    <Chip 
                      label="Risk Management" 
                      sx={{ 
                        bgcolor: 'rgba(255, 215, 0, 0.2)', 
                        color: '#FFD700', 
                        fontWeight: 600,
                        border: '1px solid rgba(255, 215, 0, 0.4)'
                      }} 
                    />
                    <Chip 
                      label="Performance Analysis" 
                      sx={{ 
                        bgcolor: 'rgba(255, 193, 7, 0.2)', 
                        color: '#FFC107', 
                        fontWeight: 600,
                        border: '1px solid rgba(255, 193, 7, 0.4)'
                      }} 
                    />
                    <Chip 
                      label="Strategic Insights" 
                      sx={{ 
                        bgcolor: 'rgba(255, 152, 0, 0.2)', 
                        color: '#FF9800', 
                        fontWeight: 600,
                        border: '1px solid rgba(255, 152, 0, 0.4)'
                      }} 
                    />
                  </Box>
                </Box>

                {/* Key Profitability Metrics */}
                <Typography variant="h6" sx={{ 
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
                          // Start with initial point at 0
                          const cumulativeData = [
                            {
                              trade: 0,
                              cumPnL: 0,
                              tradePnL: 0,
                              symbol: 'Start',
                              date: sortedTrades.length > 0 ? formatToIST(sortedTrades[0].event_ts).split(' ')[0] : '',
                              time: '00:00:00'
                            },
                            ...sortedTrades.map((trade, index) => {
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
                            })
                          ];

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
              </Box>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Details dialog */}
      <Dialog
        open={!!selected}
        onClose={() => { setSelected(null); setSelectedGroup(null); }}
        fullWidth
        maxWidth={isMobile ? "sm" : "lg"}
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            background: '#070B0A',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#e0e0e0',
            m: { xs: 0, sm: 2 },
            maxHeight: { xs: '100vh', sm: '90vh' }
          }
        }}
      >
        <DialogTitle sx={{ 
          color: '#00ffaa', 
          pr: { xs: 1, sm: 10 },
          pb: { xs: 1, sm: 2 },
          pt: { xs: 2, sm: 3 },
          fontSize: { xs: '1rem', sm: '1.25rem' },
          position: 'relative'
        }}>
          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: { xs: 1, sm: 1 }
          }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 600,
              fontSize: { xs: '0.9rem', sm: '1.25rem' },
              wordBreak: 'break-word',
              maxWidth: { xs: '100%', sm: '60%' },
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: { xs: 'nowrap', sm: 'normal' }
            }}>
              {selected?.tradingsymbol || 'Details'}
            </Typography>
            
            {/* Navigation Buttons Row */}
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'row', sm: 'row' },
              flexWrap: 'nowrap',
              gap: { xs: 0.3, sm: 1 },
              alignItems: 'center',
              width: { xs: '100%', sm: 'auto' },
              justifyContent: { xs: 'space-between', sm: 'flex-end' },
              overflow: 'hidden'
            }}>
              <Button
                size="small"
                variant={detailView === 'fusion' ? 'contained' : 'outlined'}
                onClick={() => setDetailView('fusion')}
                sx={{ 
                  textTransform: 'none', 
                  bgcolor: detailView === 'fusion' ? '#00ffaa' : 'transparent', 
                  color: detailView === 'fusion' ? '#002b36' : '#00ffaa', 
                  borderColor: '#00ffaa',
                  fontSize: { xs: '0.6rem', sm: '0.875rem' },
                  px: { xs: 0.5, sm: 2 },
                  py: { xs: 0.2, sm: 1 },
                  minWidth: { xs: '36px', sm: 'auto' },
                  minHeight: { xs: '28px', sm: 'auto' },
                  flex: { xs: '1 1 auto', sm: 'none' }
                }}
              >Fusion</Button>
              <Button
                size="small"
                variant={detailView === 'trade' ? 'contained' : 'outlined'}
                onClick={() => setDetailView('trade')}
                sx={{ 
                  textTransform: 'none', 
                  bgcolor: detailView === 'trade' ? '#90caf9' : 'transparent', 
                  color: detailView === 'trade' ? '#002b36' : '#90caf9', 
                  borderColor: '#90caf9',
                  fontSize: { xs: '0.6rem', sm: '0.875rem' },
                  px: { xs: 0.5, sm: 2 },
                  py: { xs: 0.2, sm: 1 },
                  minWidth: { xs: '36px', sm: 'auto' },
                  minHeight: { xs: '28px', sm: 'auto' },
                  flex: { xs: '1 1 auto', sm: 'none' }
                }}
              >Trade</Button>
              <Button
                size="small"
                variant={detailView === 'trail' ? 'contained' : 'outlined'}
                onClick={() => setDetailView('trail')}
                sx={{ 
                  textTransform: 'none', 
                  bgcolor: detailView === 'trail' ? '#ffcc80' : 'transparent', 
                  color: detailView === 'trail' ? '#002b36' : '#ffcc80', 
                  borderColor: '#ffcc80',
                  fontSize: { xs: '0.6rem', sm: '0.875rem' },
                  px: { xs: 0.5, sm: 2 },
                  py: { xs: 0.2, sm: 1 },
                  minWidth: { xs: '36px', sm: 'auto' },
                  minHeight: { xs: '28px', sm: 'auto' },
                  flex: { xs: '1 1 auto', sm: 'none' }
                }}
              >Trail</Button>
              {!isMobile && (
                <Tooltip title="Copy JSON (current tab)">
                  <IconButton
                    size="small"
                    onClick={() => {
                      const data =
                        detailView === 'fusion' ? (selectedGroup?.fusion || [])
                        : detailView === 'trade' ? (selectedGroup?.trades || [])
                        : (selectedGroup?.trail || []);
                      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                    }}
                    sx={{ color: '#00ffaa' }}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <IconButton 
                onClick={() => { setSelected(null); setSelectedGroup(null); }} 
                sx={{ 
                  color: '#e0e0e0',
                  p: { xs: 0.5, sm: 1 },
                  minWidth: { xs: '36px', sm: 'auto' },
                  minHeight: { xs: '36px', sm: 'auto' }
                }}
              >
                <CloseIcon fontSize={isMobile ? "small" : "medium"} />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ 
          background: 'transparent', 
          px: { xs: 1, sm: 2, md: 3 }, 
          py: { xs: 1, sm: 2 },
          maxHeight: { xs: 'calc(100vh - 140px)', sm: '70vh' },
          overflow: 'auto',
          wordBreak: 'break-word',
          overflowWrap: 'break-word'
        }}>
          {/* FUSION TAB */}
          {detailView === 'fusion' && (
            selectedGroup?.fusion?.length ? (
              <Stack spacing={{ xs: 1, sm: 2 }}>
                {selectedGroup.fusion.map((f, i) => (
                  <Paper key={i} sx={{ 
                    p: { xs: 1, sm: 1.5, md: 2 }, 
                    bgcolor: 'rgba(7,16,41,0.6)', 
                    border: '1px solid #0d2a45', 
                    borderRadius: { xs: 1, md: 2 },
                    overflow: 'hidden'
                  }}>
                    <Stack spacing={{ xs: 1.25, sm: 1.75 }}>
                      <FusionHeader f={f} />
                      <SignalHeroSection f={f} />
                      <FlowConsensusSection f={f} />
                      <GateChecksSection f={f} />
                      <CapsDecisionsSection f={f} />
                      <ExecutionSummarySection f={f} />
                      <ConfigSnapshotSection snapshot={f.config_snapshot} />
                      <ExtraContextSection f={f} />
                      <EnrichedPretty f={f} />
                      <Box sx={{ overflowX: 'auto' }}>
                        <FusionMetrics f={f} />
                      </Box>
                      {f.reasons && (
                        <Box>
                          <Stack 
                            direction={{ xs: 'column', sm: 'row' }} 
                            alignItems={{ xs: 'flex-start', sm: 'center' }} 
                            justifyContent="space-between" 
                            sx={{ mb: 1, gap: 1 }}
                          >
                            <Typography variant="subtitle1" sx={{ 
                              color: '#00ffaa', 
                              fontWeight: 700,
                              fontSize: { xs: '0.9rem', sm: '1rem' }
                            }}>Reasons (Why this signal)</Typography>
                            {!isMobile && (
                              <Stack direction="row" spacing={1}>
                                <Tooltip title="Copy reasons">
                                  <IconButton size="small" onClick={() => navigator.clipboard.writeText(f.reasons)} sx={{ color: '#00ffaa' }}>
                                    <ContentCopyIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            )}
                          </Stack>
                          <Box sx={{ overflowX: 'auto' }}>
                            <ReasonsPretty reasons={cleanReasonsText(decodeUnicodeEscapes(normalizeReasonsWithEnriched(f.reasons, f.reasons_raw?.enriched)))} />
                          </Box>
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : <Typography>No fusion rows for this parent.</Typography>
          )}

          {/* TRADE TAB - Compact Mobile-Friendly Version */}
          {detailView === 'trade' && (
            selectedGroup?.trades?.length ? (
              <Box>
                {/* Compact Summary Stats */}
                <Box sx={{ 
                  display: 'flex', 
                  flexWrap: 'wrap',
                  gap: { xs: 0.75, sm: 1 }, 
                  mb: { xs: 1.5, sm: 2 },
                  p: { xs: 1, sm: 1.5 },
                  bgcolor: 'rgba(144, 202, 249, 0.05)',
                  borderRadius: 1,
                  border: '1px solid #90caf920'
                }}>
                  {(() => {
                    const trades = selectedGroup.trades || [];
                    const buy_cost_total = grossBuyCost(trades);
                    const sell_value_total = grossSellValue(trades);
                    const pnl_pct_cost = buy_cost_total > 0 ? ((sell_value_total - buy_cost_total) / buy_cost_total * 100) : null;
                    const buy_qty = sum(trades.filter(t => String(t.transaction_type).toUpperCase() === 'BUY').map(t => t.filled_quantity));
                    const sell_qty = sum(trades.filter(t => String(t.transaction_type).toUpperCase() === 'SELL').map(t => t.filled_quantity));

                    return [
                      ['Cost', buy_cost_total, null],
                      ['Value', sell_value_total, null],
                      ['PnL%', pnl_pct_cost, pnl_pct_cost],
                      ['Buy', buy_qty, null],
                      ['Sell', sell_qty, null],
                    ].map(([k, v, colorValue]) => (
                      <Chip
                        key={k}
                        size="small"
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography component="span" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, opacity: 0.8 }}>
                              {k}:
                            </Typography>
                            <Typography component="span" sx={{ 
                              fontSize: { xs: '0.7rem', sm: '0.8rem' }, 
                              fontWeight: 700,
                              fontFamily: 'Roboto Mono, monospace'
                            }}>
                              {v == null ? '—' : (k === 'PnL%' ? `${fmtNum(v, 2)}%` : fmtNum(v, 0))}
                            </Typography>
                          </Box>
                        }
                        sx={{ 
                          bgcolor: 'rgba(144, 202, 249, 0.12)',
                          color: colorValue != null ? (colorValue >= 0 ? '#4caf50' : '#f44336') : '#90caf9',
                          border: '1px solid #90caf930',
                          height: { xs: '24px', sm: '28px' }
                        }}
                      />
                    ));
                  })()}
                </Box>

                {/* Compact Trade Table */}
                <TableContainer sx={{ 
                  border: '1px solid #90caf920',
                  borderRadius: 1,
                  bgcolor: 'rgba(7,11,10,0.4)',
                  maxHeight: { xs: '400px', sm: '500px' },
                  overflowY: 'auto'
                }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {(isMobile 
                          ? ['Time','Type','Qty','Price','PnL'] 
                          : ['Time','Symbol','Type','Qty','Price','Tag','PnL']
                        ).map(h => (
                          <TableCell key={h} sx={{ 
                            bgcolor: '#0a1929',
                            color: '#90caf9',
                            fontSize: { xs: '0.7rem', sm: '0.8rem' },
                            fontWeight: 700,
                            py: { xs: 0.75, sm: 1 },
                            px: { xs: 0.5, sm: 1.5 },
                            borderBottom: '2px solid #90caf950'
                          }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedGroup.trades.map((o, i) => (
                        <TableRow 
                          key={i}
                          sx={{
                            '&:hover': { bgcolor: 'rgba(144, 202, 249, 0.05)' },
                            borderBottom: '1px solid #90caf915'
                          }}
                        >
                          <TableCell sx={{ 
                            color: '#e0e0e0',
                            fontSize: { xs: '0.65rem', sm: '0.75rem' },
                            py: { xs: 0.75, sm: 1 },
                            px: { xs: 0.5, sm: 1.5 },
                            fontFamily: 'Roboto Mono, monospace',
                            whiteSpace: 'nowrap'
                          }}>
                            {moment(o.order_timestamp).utcOffset(330).format(isMobile ? 'HH:mm' : 'HH:mm:ss')}
                          </TableCell>
                          {!isMobile && (
                            <TableCell sx={{ 
                              color: '#e0e0e0',
                              fontSize: '0.7rem',
                              py: 1,
                              px: 1.5,
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>{o.tradingsymbol}</TableCell>
                          )}
                          <TableCell sx={{ 
                            py: { xs: 0.75, sm: 1 },
                            px: { xs: 0.5, sm: 1.5 }
                          }}>
                            <Chip 
                              size="small"
                              label={String(o.transaction_type).toUpperCase() === 'BUY' ? 'B' : 'S'}
                              sx={{ 
                                bgcolor: String(o.transaction_type).toUpperCase() === 'BUY' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
                                color: String(o.transaction_type).toUpperCase() === 'BUY' ? '#4caf50' : '#f44336',
                                border: `1px solid ${String(o.transaction_type).toUpperCase() === 'BUY' ? '#4caf5050' : '#f4433650'}`,
                                fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                fontWeight: 700,
                                height: { xs: '18px', sm: '22px' },
                                minWidth: { xs: '24px', sm: '28px' }
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ 
                            color: '#e0e0e0',
                            fontSize: { xs: '0.7rem', sm: '0.75rem' },
                            py: { xs: 0.75, sm: 1 },
                            px: { xs: 0.5, sm: 1.5 },
                            fontFamily: 'Roboto Mono, monospace',
                            fontWeight: 600
                          }}>{o.filled_quantity}</TableCell>
                          <TableCell sx={{ 
                            color: '#e0e0e0',
                            fontSize: { xs: '0.7rem', sm: '0.75rem' },
                            py: { xs: 0.75, sm: 1 },
                            px: { xs: 0.5, sm: 1.5 },
                            fontFamily: 'Roboto Mono, monospace'
                          }}>{fmtNum(o.average_price, 2)}</TableCell>
                          {!isMobile && (
                            <TableCell sx={{ 
                              py: 1,
                              px: 1.5
                            }}>
                              {o.tag ? (
                                <Chip 
                                  size="small" 
                                  label={String(o.tag).length > 8 ? String(o.tag).substring(0, 8) + '...' : String(o.tag)}
                                  sx={{ 
                                    bgcolor: 'rgba(128,203,196,0.12)', 
                                    color: '#80cbc4', 
                                    border: '1px solid #80cbc440',
                                    fontSize: '0.65rem',
                                    height: '20px'
                                  }} 
                                />
                              ) : (
                                <Typography sx={{ fontSize: '0.7rem', color: '#666' }}>—</Typography>
                              )}
                            </TableCell>
                          )}
                          <TableCell sx={{ 
                            color: (o.matched_pnl || 0) >= 0 ? '#4caf50' : '#f44336',
                            fontSize: { xs: '0.7rem', sm: '0.75rem' },
                            py: { xs: 0.75, sm: 1 },
                            px: { xs: 0.5, sm: 1.5 },
                            fontFamily: 'Roboto Mono, monospace',
                            fontWeight: 700
                          }}>
                            {(o.matched_pnl || 0) >= 0 ? '+' : ''}{fmtNum(o.matched_pnl, 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ) : <Typography sx={{ 
              fontSize: { xs: '0.875rem', sm: '1rem' },
              color: '#999'
            }}>No trade data for this parent.</Typography>
          )}

          {/* TRAIL TAB */}
          {detailView === 'trail' && (
            selectedGroup?.trail?.length ? (
              <Box sx={{ width: '100%' }}>
                {selectedGroup.trail.map((t, i) => (
                  <Card key={i} sx={{
                    background: 'linear-gradient(135deg, rgba(255, 204, 128, 0.08) 0%, rgba(255, 204, 128, 0.03) 100%)',
                    border: '1px solid #ffcc8030',
                    borderRadius: 2,
                    mb: 3,
                    overflow: 'hidden'
                  }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      {/* Header Row - Trading Symbol & Status */}
                      <Grid container spacing={2} sx={{ mb: 3, pb: 2, borderBottom: '1px solid #ffcc8020' }}>
                        <Grid item xs={8} sm={9}>
                          <Typography variant="h6" sx={{
                            color: '#ffcc80',
                            fontFamily: 'Roboto Mono, monospace',
                            fontWeight: 700,
                            fontSize: { xs: '0.95rem', sm: '1.1rem' },
                            wordBreak: 'break-all'
                          }}>
                            📈 {t.tradingsymbol}
                          </Typography>
                        </Grid>
                        <Grid item xs={4} sm={3}>
                          <Box sx={{ textAlign: 'right' }}>
                            <Chip
                              size="small"
                              label={t.is_live ? 'LIVE' : 'CLOSED'}
                              sx={{
                                bgcolor: t.is_live ? 'rgba(76, 175, 80, 0.15)' : 'rgba(158, 158, 158, 0.15)',
                                color: t.is_live ? '#4caf50' : '#9e9e9e',
                                border: `1px solid ${t.is_live ? '#4caf5050' : '#9e9e9e50'}`,
                                fontWeight: 700,
                                fontSize: { xs: '0.65rem', sm: '0.75rem' }
                              }}
                            />
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Date Information Row */}
                      <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={6}>
                          <Box sx={{
                            background: 'rgba(33, 150, 243, 0.08)',
                            border: '1px solid #2196f330',
                            borderRadius: 1,
                            p: { xs: 1.5, sm: 2 }
                          }}>
                            <Typography variant="caption" sx={{ color: '#90caf9', display: 'block', mb: 0.5, fontWeight: 600 }}>
                              📅 As Of Date
                            </Typography>
                            <Typography variant="body2" sx={{
                              color: '#e0e0e0',
                              fontFamily: 'Roboto Mono, monospace',
                              fontWeight: 500,
                              fontSize: { xs: '0.8rem', sm: '0.875rem' }
                            }}>
                              {formatToIST(t.as_of_date)}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Box sx={{
                            background: 'rgba(33, 150, 243, 0.08)',
                            border: '1px solid #2196f330',
                            borderRadius: 1,
                            p: { xs: 1.5, sm: 2 }
                          }}>
                            <Typography variant="caption" sx={{ color: '#90caf9', display: 'block', mb: 0.5, fontWeight: 600 }}>
                              🕐 Latest Date
                            </Typography>
                            <Typography variant="body2" sx={{
                              color: '#e0e0e0',
                              fontFamily: 'Roboto Mono, monospace',
                              fontWeight: 500,
                              fontSize: { xs: '0.8rem', sm: '0.875rem' }
                            }}>
                              {formatToIST(t.latest_date)}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Buy Information Row */}
                      <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={6}>
                          <Box sx={{
                            background: 'rgba(255, 152, 0, 0.08)',
                            border: '1px solid #ff980030',
                            borderRadius: 1,
                            p: { xs: 1.5, sm: 2 }
                          }}>
                            <Typography variant="caption" sx={{ color: '#ffcc02', display: 'block', mb: 0.5, fontWeight: 600 }}>
                              💰 Buy Price
                            </Typography>
                            <Typography variant="h6" sx={{
                              color: '#ff9800',
                              fontFamily: 'Roboto Mono, monospace',
                              fontWeight: 700,
                              fontSize: { xs: '0.9rem', sm: '1rem' }
                            }}>
                              ₹{fmtNum(t.buy_price)}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Box sx={{
                            background: 'rgba(156, 39, 176, 0.08)',
                            border: '1px solid #9c27b030',
                            borderRadius: 1,
                            p: { xs: 1.5, sm: 2 }
                          }}>
                            <Typography variant="caption" sx={{ color: '#ce93d8', display: 'block', mb: 0.5, fontWeight: 600 }}>
                              📦 Latest Quantity
                            </Typography>
                            <Typography variant="h6" sx={{
                              color: '#ba68c8',
                              fontFamily: 'Roboto Mono, monospace',
                              fontWeight: 700,
                              fontSize: { xs: '0.9rem', sm: '1rem' }
                            }}>
                              {t.latest_quantity}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Current Price & PnL Section */}
                      <Typography variant="subtitle2" sx={{ 
                        color: '#ffcc80', 
                        fontWeight: 700, 
                        mb: 2,
                        borderLeft: '3px solid #ffcc80',
                        pl: 1,
                        fontSize: { xs: '0.8rem', sm: '0.9rem' }
                      }}>
                        💹 Current Performance
                      </Typography>
                      <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <Box sx={{
                            background: 'rgba(224, 224, 224, 0.08)',
                            border: '1px solid rgba(224, 224, 224, 0.15)',
                            borderRadius: 1,
                            p: { xs: 1.5, sm: 2 },
                            textAlign: 'center'
                          }}>
                            <Typography variant="caption" sx={{ color: '#bdbdbd', display: 'block', mb: 0.5, fontWeight: 600 }}>
                              💵 Latest Current Price
                            </Typography>
                            <Typography variant="h6" sx={{
                              color: '#e0e0e0',
                              fontFamily: 'Roboto Mono, monospace',
                              fontWeight: 700,
                              fontSize: { xs: '0.9rem', sm: '1.1rem' }
                            }}>
                              ₹{fmtNum(t.latest_current_price)}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Box sx={{
                            background: (t.latest_pnl_abs || 0) >= 0 ? 'rgba(76, 175, 80, 0.12)' : 'rgba(244, 67, 54, 0.12)',
                            border: `1px solid ${(t.latest_pnl_abs || 0) >= 0 ? '#4caf5040' : '#f4433640'}`,
                            borderRadius: 1,
                            p: { xs: 1.5, sm: 2 },
                            textAlign: 'center'
                          }}>
                            <Typography variant="caption" sx={{ color: '#bdbdbd', display: 'block', mb: 0.5, fontWeight: 600 }}>
                              📊 Latest PnL (Abs)
                            </Typography>
                            <Typography variant="h6" sx={{
                              color: (t.latest_pnl_abs || 0) >= 0 ? '#4caf50' : '#f44336',
                              fontFamily: 'Roboto Mono, monospace',
                              fontWeight: 700,
                              fontSize: { xs: '0.9rem', sm: '1.1rem' }
                            }}>
                              {(t.latest_pnl_abs || 0) >= 0 ? '+' : ''}₹{fmtNum(t.latest_pnl_abs)}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Box sx={{
                            background: (t.latest_pnl_pct || 0) >= 0 ? 'rgba(76, 175, 80, 0.12)' : 'rgba(244, 67, 54, 0.12)',
                            border: `1px solid ${(t.latest_pnl_pct || 0) >= 0 ? '#4caf5040' : '#f4433640'}`,
                            borderRadius: 1,
                            p: { xs: 1.5, sm: 2 },
                            textAlign: 'center'
                          }}>
                            <Typography variant="caption" sx={{ color: '#bdbdbd', display: 'block', mb: 0.5, fontWeight: 600 }}>
                              📈 Latest PnL (%)
                            </Typography>
                            <Typography variant="h6" sx={{
                              color: (t.latest_pnl_pct || 0) >= 0 ? '#4caf50' : '#f44336',
                              fontFamily: 'Roboto Mono, monospace',
                              fontWeight: 700,
                              fontSize: { xs: '0.9rem', sm: '1.1rem' }
                            }}>
                              {(t.latest_pnl_pct || 0) >= 0 ? '+' : ''}{fmtNum(t.latest_pnl_pct)}%
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Price Range Analysis Section */}
                      <Typography variant="subtitle2" sx={{ 
                        color: '#ffcc80', 
                        fontWeight: 700, 
                        mb: 2,
                        borderLeft: '3px solid #4caf50',
                        pl: 1,
                        fontSize: { xs: '0.8rem', sm: '0.9rem' }
                      }}>
                        📊 Price Range Analytics
                      </Typography>
                      <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            py: 1,
                            px: 1.5,
                            background: 'rgba(76, 175, 80, 0.06)',
                            borderRadius: 1,
                            border: '1px solid #4caf5020'
                          }}>
                            <Typography variant="body2" sx={{ color: '#81c784', fontWeight: 600 }}>🔻 Min Price:</Typography>
                            <Typography variant="body2" sx={{ 
                              color: '#4caf50', 
                              fontFamily: 'Roboto Mono, monospace',
                              fontWeight: 700
                            }}>₹{fmtNum(t.min_current_price)}</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            py: 1,
                            px: 1.5,
                            background: 'rgba(76, 175, 80, 0.06)',
                            borderRadius: 1,
                            border: '1px solid #4caf5020'
                          }}>
                            <Typography variant="body2" sx={{ color: '#81c784', fontWeight: 600 }}>🔺 Max Price:</Typography>
                            <Typography variant="body2" sx={{ 
                              color: '#4caf50', 
                              fontFamily: 'Roboto Mono, monospace',
                              fontWeight: 700
                            }}>₹{fmtNum(t.max_current_price)}</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            py: 1,
                            px: 1.5,
                            background: 'rgba(76, 175, 80, 0.06)',
                            borderRadius: 1,
                            border: '1px solid #4caf5020'
                          }}>
                            <Typography variant="body2" sx={{ color: '#81c784', fontWeight: 600 }}>📊 Avg Price:</Typography>
                            <Typography variant="body2" sx={{ 
                              color: '#4caf50', 
                              fontFamily: 'Roboto Mono, monospace',
                              fontWeight: 700
                            }}>₹{fmtNum(t.avg_current_price, 4)}</Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Percentage Movement Section */}
                      <Typography variant="subtitle2" sx={{ 
                        color: '#ffcc80', 
                        fontWeight: 700, 
                        mb: 2,
                        borderLeft: '3px solid #2196f3',
                        pl: 1,
                        fontSize: { xs: '0.8rem', sm: '0.9rem' }
                      }}>
                        📈 Percentage Movement Analytics
                      </Typography>
                      <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            py: 1,
                            px: 1.5,
                            background: 'rgba(33, 150, 243, 0.06)',
                            borderRadius: 1,
                            border: '1px solid #2196f320'
                          }}>
                            <Typography variant="body2" sx={{ color: '#64b5f6', fontWeight: 600 }}>⬇️ Min %:</Typography>
                            <Typography variant="body2" sx={{ 
                              color: '#2196f3', 
                              fontFamily: 'Roboto Mono, monospace',
                              fontWeight: 700
                            }}>{fmtNum(t.min_pct)}%</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            py: 1,
                            px: 1.5,
                            background: 'rgba(33, 150, 243, 0.06)',
                            borderRadius: 1,
                            border: '1px solid #2196f320'
                          }}>
                            <Typography variant="body2" sx={{ color: '#64b5f6', fontWeight: 600 }}>⬆️ Max %:</Typography>
                            <Typography variant="body2" sx={{ 
                              color: '#2196f3', 
                              fontFamily: 'Roboto Mono, monospace',
                              fontWeight: 700
                            }}>{fmtNum(t.max_pct)}%</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            py: 1,
                            px: 1.5,
                            background: 'rgba(33, 150, 243, 0.06)',
                            borderRadius: 1,
                            border: '1px solid #2196f320'
                          }}>
                            <Typography variant="body2" sx={{ color: '#64b5f6', fontWeight: 600 }}>📊 Avg %:</Typography>
                            <Typography variant="body2" sx={{ 
                              color: '#2196f3', 
                              fontFamily: 'Roboto Mono, monospace',
                              fontWeight: 700
                            }}>{fmtNum(t.avg_pct, 4)}%</Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Stop Loss Section */}
                      <Box sx={{
                        background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.12) 0%, rgba(255, 193, 7, 0.06) 100%)',
                        border: '2px solid #ffc10740',
                        borderRadius: 2,
                        p: { xs: 2, sm: 2.5 },
                        textAlign: 'center',
                        mt: 2
                      }}>
                        <Typography variant="caption" sx={{ 
                          color: '#ffb74d', 
                          display: 'block', 
                          mb: 1, 
                          fontWeight: 700,
                          fontSize: { xs: '0.7rem', sm: '0.8rem' }
                        }}>
                          ⚠️ LATEST STOP LOSS
                        </Typography>
                        <Typography variant="h5" sx={{
                          color: '#ff9800',
                          fontFamily: 'Roboto Mono, monospace',
                          fontWeight: 800,
                          fontSize: { xs: '1.1rem', sm: '1.3rem' },
                          textShadow: '0 1px 2px rgba(255, 152, 0, 0.3)'
                        }}>
                          ₹{fmtNum(t.latest_stop_loss)}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : <Typography sx={{ 
              fontSize: { xs: '0.875rem', sm: '1rem' },
              color: '#999'
            }}>No trail data for this parent.</Typography>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Add CSS for better mobile experience
const globalMobileStyles = `
  .MuiDialog-paper {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  
  .MuiTableContainer-root {
    -webkit-overflow-scrolling: touch;
    max-width: 100% !important;
  }
  
  .MuiTable-root {
    table-layout: fixed !important;
  }
  
  .MuiTableCell-root {
    max-width: 120px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    box-sizing: border-box !important;
  }
  
  @media (max-width: 600px) {
    .MuiButton-root {
      min-height: 44px;
      min-width: 44px;
    }
    
    .MuiIconButton-root {
      min-height: 44px;
      min-width: 44px;
    }
    
    .MuiTableCell-root {
      font-size: 0.65rem !important;
      padding: 2px 3px !important;
      max-width: 70px !important;
      min-width: 50px !important;
    }
    
    .MuiTable-root {
      min-width: 280px !important;
      width: 100% !important;
    }
    
    .MuiChip-root {
      font-size: 0.6rem !important;
      height: 18px !important;
      max-width: 65px !important;
      min-width: 40px !important;
    }
    
    .MuiChip-label {
      padding: 0 4px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    
    .MuiTableSortLabel-root {
      font-size: 0.65rem !important;
      padding: 0 !important;
      min-width: 0 !important;
    }
  }
  
  @media (max-width: 900px) {
    .MuiTableCell-root {
      max-width: 100px !important;
      font-size: 0.75rem !important;
      padding: 4px 6px !important;
    }
    
    .MuiChip-root {
      font-size: 0.7rem !important;
      height: 20px !important;
      max-width: 80px !important;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('mobile-fusion-styles')) {
  const style = document.createElement('style');
  style.id = 'mobile-fusion-styles';
  style.textContent = globalMobileStyles;
  document.head.appendChild(style);
}

export default Fusion;