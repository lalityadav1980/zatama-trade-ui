// TradeAnalysis.jsx - Complete 360° Analytics Overview
import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Container, CircularProgress, Grid, Card, CardContent,
  Chip, Stack, TextField, MenuItem, Button, useTheme, useMediaQuery,
  Alert, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, LinearProgress
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  ShowChart as ShowChartIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import CustomAppBar from './CustomAppBar';
import { httpApi } from './api';
import moment from 'moment';

// Utility functions
const fmtNum = (n, d = 2) => {
  if (n == null || !isFinite(n)) return '—';
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
};

const formatToIST = (tsStr) => {
  if (!tsStr) return '—';
  return moment(tsStr).utcOffset(330).format('DD-MMM-YYYY HH:mm:ss');
};

// DonutChart Component (from fusion.jsx lines 338-458)
const DonutChart = ({ title, data, size = 200 }) => {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const actualSize = isMobile ? Math.min(size, 180) : size;
  const center = actualSize / 2;
  const radius = actualSize / 2.5;
  const thickness = actualSize / 10;
  const total = data.reduce((sum, d) => sum + (d.value || 0), 0);

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    };
  };

  const createArc = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  let currentAngle = 0;
  const segments = data.map((d) => {
    const angle = total > 0 ? (d.value / total) * 360 : 0;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    const outerPath = createArc(center, center, radius, startAngle, endAngle);
    const innerPath = createArc(center, center, radius - thickness, startAngle, endAngle);
    return {
      path: `${outerPath} L ${polarToCartesian(center, center, radius - thickness, startAngle).x} ${polarToCartesian(center, center, radius - thickness, startAngle).y} ${innerPath.replace('M', 'L')} Z`,
      color: d.color,
      label: d.label,
      value: d.value
    };
  });

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>{title}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <svg width={actualSize} height={actualSize}>
          <defs>
            {segments.map((seg, i) => (
              <linearGradient key={i} id={`gradient-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={seg.color} stopOpacity="1" />
                <stop offset="100%" stopColor={seg.color} stopOpacity="0.6" />
              </linearGradient>
            ))}
          </defs>
          {segments.map((seg, i) => (
            <path key={i} d={seg.path} fill={`url(#gradient-${i})`} stroke="#1a1a1a" strokeWidth="1" />
          ))}
          <circle cx={center} cy={center} r={radius - thickness - 5} fill="#0a0a0a" />
          <text x={center} y={center - 10} textAnchor="middle" fill="#fff" fontSize={actualSize / 10} fontWeight="700">{total}</text>
          <text x={center} y={center + 15} textAnchor="middle" fill="#aaa" fontSize={actualSize / 15}>Trades</text>
        </svg>
        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
          {data.map((d, i) => (
            <Chip key={i} label={`${d.label}: ${d.value}`} size="small" sx={{ bgcolor: `${d.color}30`, color: d.color, border: `1px solid ${d.color}60` }} />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

// BarChart Component (from fusion.jsx lines 459-542)
const BarChart = ({ title, data, height = 250, valueFormatter }) => {
  const maxValue = Math.max(...data.map((d) => Math.abs(d.value)));
  const barHeight = 40;
  const actualHeight = Math.max(height, data.length * (barHeight + 15) + 80);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>{title}</Typography>
      <Box sx={{ background: '#070B0A', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 2, p: 2 }}>
        <svg width="100%" height={actualHeight}>
          {data.map((d, i) => {
            const barWidth = maxValue > 0 ? (Math.abs(d.value) / maxValue) * 75 : 0;
            const y = 40 + i * (barHeight + 15);
            return (
              <g key={i}>
                <defs>
                  <linearGradient id={`bar-gradient-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={d.color} stopOpacity="0.8" />
                    <stop offset="100%" stopColor={d.color} stopOpacity="1" />
                  </linearGradient>
                </defs>
                <text x="10" y={y - 5} fill="#ccc" fontSize="12" fontWeight="600">{d.label}</text>
                <rect x="10" y={y} width={`${barWidth}%`} height={barHeight} fill={`url(#bar-gradient-${i})`} rx="4" />
                <text x={`${barWidth + 2}%`} y={y + barHeight / 2 + 5} fill="#fff" fontSize="12" fontWeight="700">
                  {valueFormatter ? valueFormatter(d.value) : d.value}
                </text>
              </g>
            );
          })}
        </svg>
      </Box>
    </Box>
  );
};

// PerformanceMetrics Component (from fusion.jsx lines 987-1100)
const PerformanceMetrics = ({ analytics }) => {
  const metrics = [
    { label: 'Win Rate', value: analytics.winRate || 0, max: 100, color: (analytics.winRate || 0) >= 50 ? '#4CAF50' : '#FF9800', suffix: '%' },
    { label: 'Profit Factor', value: analytics.profitFactor === Infinity ? 5 : Math.min(analytics.profitFactor || 0, 5), max: 5, color: (analytics.profitFactor || 0) >= 2 ? '#4CAF50' : (analytics.profitFactor || 0) >= 1 ? '#FF9800' : '#F44336', suffix: 'x' },
    { label: 'Portfolio Return', value: Math.abs(analytics.portfolioPnLPct || 0), max: Math.max(Math.abs(analytics.portfolioPnLPct || 0), 10), color: (analytics.portfolioPnLPct || 0) >= 0 ? '#4CAF50' : '#F44336', suffix: '%' }
  ];

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>Performance Metrics</Typography>
      {metrics.map((metric, index) => (
        <Box key={index} sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" sx={{ color: '#e0e0e0', fontWeight: 600 }}>{metric.label}</Typography>
            <Typography variant="body2" sx={{ color: metric.color, fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>
              {(metric.value || 0).toFixed(1)}{metric.suffix}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={(metric.value / metric.max) * 100} sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: metric.color, borderRadius: 4, background: `linear-gradient(90deg, ${metric.color}80, ${metric.color})`, boxShadow: `0 2px 8px ${metric.color}40` } }} />
        </Box>
      ))}
    </Box>
  );
};

// Enhanced computeAnalytics with fund movement
const computeAnalytics = (rows, groups = []) => {
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

  const profitTrades = closed.filter(r => (r.total_matched_pnl || 0) > 0);
  const lossTrades = closed.filter(r => (r.total_matched_pnl || 0) < 0);

  const totalProfit = profitTrades.reduce((sum, r) => sum + (r.total_matched_pnl || 0), 0);
  const totalLoss = Math.abs(lossTrades.reduce((sum, r) => sum + (r.total_matched_pnl || 0), 0));
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

  const avgProfit = wins > 0 ? totalProfit / wins : 0;
  const avgLoss = losses > 0 ? totalLoss / losses : 0;
  const avgPnL = totalTrades > 0 ? totalPnL / totalTrades : 0;

  const tagStats = {};
  closed.forEach(r => {
    const tag = r.tag || 'UNTAGGED';
    if (!tagStats[tag]) tagStats[tag] = { count: 0, pnl: 0, wins: 0, losses: 0 };
    tagStats[tag].count++;
    tagStats[tag].pnl += (r.total_matched_pnl || 0);
    if ((r.total_matched_pnl || 0) > 0) tagStats[tag].wins++;
    if ((r.total_matched_pnl || 0) < 0) tagStats[tag].losses++;
  });

  const tagAnalysis = Object.entries(tagStats).map(([tag, stats]) => ({
    tag, count: stats.count, pnl: stats.pnl, wins: stats.wins, losses: stats.losses,
    winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0,
    avgPnL: stats.count > 0 ? stats.pnl / stats.count : 0
  })).sort((a, b) => b.pnl - a.pnl);

  const signalStats = {};
  closed.forEach(r => {
    const signal = r.signal_type || 'UNKNOWN';
    if (!signalStats[signal]) signalStats[signal] = { count: 0, pnl: 0, wins: 0, losses: 0 };
    signalStats[signal].count++;
    signalStats[signal].pnl += (r.total_matched_pnl || 0);
    if ((r.total_matched_pnl || 0) > 0) signalStats[signal].wins++;
    if ((r.total_matched_pnl || 0) < 0) signalStats[signal].losses++;
  });

  const signalAnalysis = Object.entries(signalStats).map(([signal, stats]) => ({
    signal, count: stats.count, pnl: stats.pnl, wins: stats.wins, losses: stats.losses,
    winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0
  })).sort((a, b) => b.pnl - a.pnl);

  // Fund movement analysis
  let fundMovementAnalysis = null;
  const marginHistory = [];
  groups.forEach(g => {
    if (g.fusion && g.fusion.length > 0) {
      g.fusion.forEach(f => {
        if (Number.isFinite(+f.available_margin_new) && Number.isFinite(+f.available_margin_old)) {
          marginHistory.push({
            event_ts: f.event_ts,
            available_margin: +f.available_margin_new,
            used_margin: (+f.available_margin_old - +f.available_margin_new) || 0
          });
        }
      });
    }
  });

  if (marginHistory.length > 0) {
    marginHistory.sort((a, b) => new Date(a.event_ts) - new Date(b.event_ts));
    const initialMargin = marginHistory[0]?.available_margin || 0;
    const finalMargin = marginHistory[marginHistory.length - 1]?.available_margin || 0;
    const totalChange = finalMargin - initialMargin;
    const changePercent = initialMargin > 0 ? (totalChange / initialMargin) * 100 : 0;
    fundMovementAnalysis = { initialMargin, finalMargin, totalChange, changePercent, marginHistory };
  }

  return {
    totalTrades, wins, losses, flat, winRate, totalPnL, totalBuyCost, totalSellValue, portfolioPnLPct,
    profitFactor, avgProfit, avgLoss, avgPnL, totalProfit, totalLoss, tagAnalysis, signalAnalysis, fundMovementAnalysis
  };
};

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

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await httpApi.get('/fusion-data/grouped', { params: { order: 'desc', limit_parents: 500 } });
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
      setError('Failed to load trade data');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRows = () => {
    if (dateFilter === 'all') return rows;
    const now = moment().utcOffset(330);
    let filtered = rows;

    if (dateFilter === 'today') {
      filtered = rows.filter(r => moment(r.event_ts).utcOffset(330).isSame(now, 'day'));
    } else if (dateFilter === 'yesterday') {
      const yesterday = now.clone().subtract(1, 'days');
      filtered = rows.filter(r => moment(r.event_ts).utcOffset(330).isSame(yesterday, 'day'));
    } else if (dateFilter === 'last7days') {
      const last7Days = now.clone().subtract(7, 'days');
      filtered = rows.filter(r => moment(r.event_ts).utcOffset(330).isAfter(last7Days));
    } else if (dateFilter === 'last30days') {
      const last30Days = now.clone().subtract(30, 'days');
      filtered = rows.filter(r => moment(r.event_ts).utcOffset(330).isAfter(last30Days));
    } else if (dateFilter === 'custom' && startDate && endDate) {
      const start = moment(startDate).startOf('day');
      const end = moment(endDate).endOf('day');
      filtered = rows.filter(r => moment(r.event_ts).isBetween(start, end, null, '[]'));
    }

    return filtered;
  };

  const filteredRows = getFilteredRows();
  const analytics = computeAnalytics(filteredRows, allGroups);

  if (loading) return (<><CustomAppBar /><Container maxWidth="xl" sx={{ mt: 4, display: 'flex', justifyContent: 'center', minHeight: '60vh' }}><CircularProgress /></Container></>);
  if (error) return (<><CustomAppBar /><Container maxWidth="xl" sx={{ mt: 4 }}><Alert severity="error">{error}</Alert><Button onClick={fetchData} sx={{ mt: 2 }}>Retry</Button></Container></>);

  return (
    <>
      <CustomAppBar />
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4, px: { xs: 1, sm: 2, md: 3 } }}>
        {/* Header */}
        <Typography variant="h4" sx={{ color: '#00ffaa', fontWeight: 800, mb: 1, fontSize: { xs: '1.75rem', md: '2.125rem' }, display: 'flex', alignItems: 'center', gap: 1 }}>
          <BarChartIcon sx={{ fontSize: 36 }} /> 360° Analytics Overview
        </Typography>

        {/* Date Filter */}
        <Card sx={{ background: 'rgba(7,11,10,0.95)', border: '1px solid rgba(255,255,255,0.1)', mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <TextField select fullWidth size="small" label="Date Range" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#00ffaa' } }}>
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
                    <TextField fullWidth size="small" type="date" label="Start Date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#00ffaa' } }} />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField fullWidth size="small" type="date" label="End Date" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#00ffaa' } }} />
                  </Grid>
                </>
              )}
              <Grid item xs={12} sm={6} md={3}>
                <Chip label={`${analytics.totalTrades} trades analyzed`} sx={{ bgcolor: '#00ffaa20', color: '#00ffaa', fontWeight: 600 }} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Trading Philosophy */}
        <Box sx={{ background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 193, 7, 0.08) 50%, rgba(255, 152, 0, 0.05) 100%)', border: '3px solid transparent', borderImage: 'linear-gradient(135deg, #FFD700, #FFC107, #FF9800) 1', borderRadius: 3, p: { xs: 3, md: 4 }, mb: 4, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ color: '#FFD700', fontWeight: 800, mb: 2, fontSize: { xs: '1.5rem', md: '2rem' } }}>🎯 Asymmetric Profitability Philosophy</Typography>
          <Typography variant="h6" sx={{ color: '#FFC107', fontWeight: 600, mb: 2, fontSize: { xs: '1rem', md: '1.2rem' } }}>Professional Trading Mindset</Typography>
          <Typography variant="body1" sx={{ color: '#E8E8E8', fontSize: { xs: '0.95rem', md: '1.1rem' }, lineHeight: 1.8, maxWidth: '900px', mx: 'auto' }}>
            Success in trading is <strong style={{ color: '#FFD700' }}>NOT</strong> about winning every trade. It's about mastering the art of <strong style={{ color: '#00FFAA' }}>asymmetric returns</strong> — where average wins significantly outweigh average losses.
          </Typography>
          <Box sx={{ mt: 3, display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Chip label="🎯 Risk Management" sx={{ bgcolor: 'rgba(255, 215, 0, 0.2)', color: '#FFD700', fontWeight: 600 }} />
            <Chip label="📊 Performance Analysis" sx={{ bgcolor: 'rgba(255, 193, 7, 0.2)', color: '#FFC107', fontWeight: 600 }} />
            <Chip label="💡 Strategic Insights" sx={{ bgcolor: 'rgba(255, 152, 0, 0.2)', color: '#FF9800', fontWeight: 600 }} />
          </Box>
        </Box>

        {/* Profitability Reality Check - 3 animated cards from fusion.jsx */}
        <Typography variant="h6" sx={{ color: '#00ffaa', mb: 3, fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.3rem' }, display: 'flex', alignItems: 'center', gap: 1 }}>📊 Profitability Reality Check</Typography>
        <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: 4 }}>
          {/* Total P&L Card */}
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.85) 0%, rgba(12, 12, 12, 0.95) 100%)', border: `2px solid ${analytics.totalPnL >= 0 ? '#4CAF5060' : '#F4433660'}`, borderRadius: 4, height: 200, boxShadow: `0 8px 32px ${analytics.totalPnL >= 0 ? 'rgba(76, 175, 80, 0.25)' : 'rgba(244, 67, 54, 0.25)'}`, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', '&:hover': { transform: 'translateY(-8px) scale(1.02)', boxShadow: `0 16px 48px ${analytics.totalPnL >= 0 ? 'rgba(76, 175, 80, 0.4)' : 'rgba(244, 67, 54, 0.4)'}`, border: `2px solid ${analytics.totalPnL >= 0 ? '#4CAF50' : '#F44336'}` } }}>
              <CardContent sx={{ textAlign: 'center', p: { xs: 2, md: 3 }, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Box sx={{ mb: 1, p: 1.5, borderRadius: 2, bgcolor: analytics.totalPnL >= 0 ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)' }}>
                  <Typography variant="h3" sx={{ color: analytics.totalPnL >= 0 ? '#4CAF50' : '#F44336', fontFamily: 'Roboto Mono, monospace', fontWeight: 800, fontSize: { xs: '1.8rem', sm: '2.2rem', md: '2.5rem' }, textShadow: `0 0 20px ${analytics.totalPnL >= 0 ? '#4CAF5080' : '#F4433680'}` }}>
                    {analytics.totalPnL >= 0 ? '+' : ''}₹{fmtNum(analytics.totalPnL)}
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ color: analytics.totalPnL >= 0 ? '#81C784' : '#EF5350', fontWeight: 700, mb: 1.5, fontSize: { xs: '1rem', md: '1.1rem' } }}>
                  {analytics.totalPnL >= 0 ? '🎉 Total Net Profit' : '⚠️ Total Net Loss'}
                </Typography>
                <Typography variant="body2" sx={{ color: analytics.totalPnL >= 0 ? '#A5D6A7' : '#FFCDD2', fontSize: { xs: '0.85rem', md: '0.9rem' }, fontWeight: 500, lineHeight: 1.4, textAlign: 'center' }}>
                  {analytics.totalPnL >= 0 ? `Despite ${analytics.losses > analytics.wins ? 'more losses' : 'fewer wins'}, strategy is profitable ✅` : `Portfolio needs review ❌`}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Profit Factor Card */}
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ background: analytics.profitFactor >= 1.0 ? 'linear-gradient(135deg, rgba(255, 235, 59, 0.12) 0%, rgba(255, 241, 118, 0.06) 100%)' : 'linear-gradient(135deg, rgba(255, 152, 0, 0.12) 0%, rgba(255, 183, 77, 0.06) 100%)', border: `2px solid ${analytics.profitFactor >= 1.0 ? '#FFEB3B60' : '#FF980060'}`, borderRadius: 4, height: 200, boxShadow: `0 8px 32px ${analytics.profitFactor >= 1.0 ? 'rgba(255, 235, 59, 0.25)' : 'rgba(255, 152, 0, 0.25)'}`, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', '&:hover': { transform: 'translateY(-8px) scale(1.02)', boxShadow: `0 16px 48px ${analytics.profitFactor >= 1.0 ? 'rgba(255, 235, 59, 0.4)' : 'rgba(255, 152, 0, 0.4)'}` } }}>
              <CardContent sx={{ textAlign: 'center', p: { xs: 2, md: 3 }, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Box sx={{ mb: 1, p: 1.5, borderRadius: 2, bgcolor: analytics.profitFactor >= 1.0 ? 'rgba(255, 235, 59, 0.15)' : 'rgba(255, 152, 0, 0.15)' }}>
                  <Typography variant="h3" sx={{ color: analytics.profitFactor >= 1.0 ? '#FFEB3B' : '#FF9800', fontFamily: 'Roboto Mono, monospace', fontWeight: 800, fontSize: { xs: '1.8rem', sm: '2.2rem', md: '2.5rem' }, textShadow: `0 0 20px ${analytics.profitFactor >= 1.0 ? '#FFEB3B80' : '#FF980080'}` }}>
                    {analytics.profitFactor === Infinity ? '∞' : fmtNum(analytics.profitFactor, 2)}x
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ color: analytics.profitFactor >= 1.0 ? '#FFF59D' : '#FFCC80', fontWeight: 700, mb: 1.5, fontSize: { xs: '1rem', md: '1.1rem' } }}>
                  {analytics.profitFactor >= 1.0 ? '💰 Profit Factor' : '⚠️ Profit Factor'}
                </Typography>
                <Typography variant="body2" sx={{ color: analytics.profitFactor >= 1.0 ? '#FFF176' : '#FFB74D', fontSize: { xs: '0.85rem', md: '0.9rem' }, fontWeight: 500, lineHeight: 1.4, textAlign: 'center' }}>
                  {analytics.profitFactor >= 1.0 ? `For every ₹1 lost, you make ₹${analytics.profitFactor === Infinity ? '∞' : fmtNum(analytics.profitFactor, 2)} ✅` : `For every ₹1 lost, only ₹${fmtNum(analytics.profitFactor, 2)} gained ❌`}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Portfolio Return Card */}
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ background: analytics.portfolioPnLPct >= 0 ? 'linear-gradient(135deg, rgba(33, 150, 243, 0.12) 0%, rgba(100, 181, 246, 0.06) 100%)' : 'linear-gradient(135deg, rgba(244, 67, 54, 0.12) 0%, rgba(229, 115, 115, 0.06) 100%)', border: `2px solid ${analytics.portfolioPnLPct >= 0 ? '#2196F360' : '#F4433660'}`, borderRadius: 4, height: 200, boxShadow: `0 8px 32px ${analytics.portfolioPnLPct >= 0 ? 'rgba(33, 150, 243, 0.25)' : 'rgba(244, 67, 54, 0.25)'}`, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', '&:hover': { transform: 'translateY(-8px) scale(1.02)' } }}>
              <CardContent sx={{ textAlign: 'center', p: { xs: 2, md: 3 }, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Box sx={{ mb: 1, p: 1.5, borderRadius: 2, bgcolor: analytics.portfolioPnLPct >= 0 ? 'rgba(33, 150, 243, 0.15)' : 'rgba(244, 67, 54, 0.15)' }}>
                  <Typography variant="h3" sx={{ color: analytics.portfolioPnLPct >= 0 ? '#2196F3' : '#F44336', fontFamily: 'Roboto Mono, monospace', fontWeight: 800, fontSize: { xs: '1.8rem', sm: '2.2rem', md: '2.5rem' }, textShadow: `0 0 20px ${analytics.portfolioPnLPct >= 0 ? '#2196F380' : '#F4433680'}` }}>
                    {analytics.portfolioPnLPct >= 0 ? '+' : ''}{fmtNum(analytics.portfolioPnLPct, 2)}%
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ color: analytics.portfolioPnLPct >= 0 ? '#64B5F6' : '#EF5350', fontWeight: 700, mb: 1.5, fontSize: { xs: '1rem', md: '1.1rem' } }}>
                  {analytics.portfolioPnLPct >= 0 ? '�� Portfolio Return' : '📉 Portfolio Return'}
                </Typography>
                <Typography variant="body2" sx={{ color: analytics.portfolioPnLPct >= 0 ? '#90CAF9' : '#FFCDD2', fontSize: { xs: '0.85rem', md: '0.9rem' }, fontWeight: 500, lineHeight: 1.4, textAlign: 'center' }}>
                  {analytics.portfolioPnLPct >= 0 ? 'Positive return on invested capital ✅' : 'Negative return - strategy needs review ❌'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Win/Loss Analysis */}
        <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>⚖️ Win vs Loss Analysis (The Real Story)</Typography>
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Card sx={{ background: 'rgba(76, 175, 80, 0.08)', border: '1px solid #4CAF5030', height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: '#4CAF50', fontWeight: 700 }}>🟢 Winning Trades</Typography>
                  <Chip label={`${analytics.wins} trades`} sx={{ bgcolor: 'rgba(76, 175, 80, 0.2)', color: '#4CAF50' }} />
                </Box>
                <Typography variant="h4" sx={{ color: '#4CAF50', fontFamily: 'Roboto Mono, monospace', fontWeight: 700, mb: 2 }}>₹{fmtNum(analytics.totalProfit)}</Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: '#a5d6a7', mb: 0.5 }}>Average Win: <strong>₹{fmtNum(analytics.avgProfit)}</strong></Typography>
                  <Typography variant="body2" sx={{ color: '#a5d6a7' }}>Win Rate: <strong>{fmtNum(analytics.winRate, 1)}%</strong></Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#c8e6c9', fontStyle: 'italic' }}>Your wins are {analytics.avgProfit > 0 && analytics.avgLoss > 0 ? fmtNum(analytics.avgProfit / analytics.avgLoss, 1) : 'significantly'} times larger than losses</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ background: 'rgba(244, 67, 54, 0.08)', border: '1px solid #F4433630', height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: '#F44336', fontWeight: 700 }}>🔴 Losing Trades</Typography>
                  <Chip label={`${analytics.losses} trades`} sx={{ bgcolor: 'rgba(244, 67, 54, 0.2)', color: '#F44336' }} />
                </Box>
                <Typography variant="h4" sx={{ color: '#F44336', fontFamily: 'Roboto Mono, monospace', fontWeight: 700, mb: 2 }}>₹{fmtNum(analytics.totalLoss)}</Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: '#ef9a9a', mb: 0.5 }}>Average Loss: <strong>₹{fmtNum(analytics.avgLoss)}</strong></Typography>
                  <Typography variant="body2" sx={{ color: '#ef9a9a' }}>Loss Rate: <strong>{fmtNum(100 - analytics.winRate, 1)}%</strong></Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#ffcdd2', fontStyle: 'italic' }}>
                  {analytics.totalPnL >= 0 ? 'Small, controlled losses are the price of finding big winners' : '⚠️ Losses are too large - strategy needs adjustment'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Why This Strategy Works */}
        <Box sx={{ background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(12, 12, 12, 0.98) 100%)', border: analytics.totalPnL >= 0 ? '1px solid rgba(0, 255, 170, 0.15)' : '1px solid rgba(244, 67, 54, 0.15)', borderRadius: 4, p: 3, mb: 4 }}>
          <Typography variant="h6" sx={{ color: analytics.totalPnL >= 0 ? '#00ffaa' : '#F44336', fontWeight: 700, mb: 2 }}>
            {analytics.totalPnL >= 0 ? '🧠 Why This Strategy Works' : '⚠️ Strategy Performance Analysis'}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h4" sx={{ color: analytics.avgProfit > 0 && analytics.avgLoss > 0 && (analytics.avgProfit / analytics.avgLoss) >= 1.5 ? '#FFD700' : '#FF9800', mb: 1 }}>
                  {analytics.avgProfit > 0 && analytics.avgLoss > 0 ? fmtNum(analytics.avgProfit / analytics.avgLoss, 1) : '0'}:1
                </Typography>
                <Typography variant="body2" sx={{ color: '#e0e0e0' }}><strong>Reward/Risk Ratio</strong><br />Excellent ratio ✅</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h4" sx={{ color: analytics.losses > analytics.wins && analytics.totalPnL >= 0 ? '#4CAF50' : '#2196F3', mb: 1 }}>
                  {analytics.losses > analytics.wins ? analytics.losses - analytics.wins : 0}
                </Typography>
                <Typography variant="body2" sx={{ color: '#e0e0e0' }}><strong>Extra Losses</strong><br />{analytics.losses > analytics.wins && analytics.totalPnL >= 0 ? 'More losses, still profitable ✅' : 'Balanced ratio ✅'}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h4" sx={{ color: analytics.totalTrades >= 10 ? '#2196F3' : '#FF9800', mb: 1 }}>{analytics.totalTrades}</Typography>
                <Typography variant="body2" sx={{ color: '#e0e0e0' }}><strong>Total Trades</strong><br />{analytics.totalTrades >= 30 ? 'Statistically significant ✅' : analytics.totalTrades >= 10 ? 'Reasonable sample ⚠️' : 'Need more data ❌'}</Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Visual Analytics Dashboard */}
        <Typography variant="h6" sx={{ color: '#00ffaa', mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}><ShowChartIcon sx={{ color: '#00ffaa' }} />�� Visual Analytics Dashboard</Typography>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6} lg={4}>
            <Card sx={{ background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%)', border: '1px solid #00ffaa30', height: 350 }}>
              <CardContent>
                <DonutChart title="Win/Loss Distribution" data={[{ label: 'Wins', value: analytics.wins, color: '#4CAF50' }, { label: 'Losses', value: analytics.losses, color: '#F44336' }, { label: 'Flat', value: analytics.flat, color: '#FF9800' }]} size={220} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6} lg={4}>
            <Card sx={{ background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%)', border: '1px solid #00ffaa30', height: 350 }}>
              <CardContent>
                <BarChart title="Profit vs Loss Analysis" data={[{ label: 'Total Profit', value: analytics.totalProfit, color: '#4CAF50' }, { label: 'Total Loss', value: analytics.totalLoss, color: '#F44336' }, { label: 'Net P&L', value: analytics.totalPnL, color: analytics.totalPnL >= 0 ? '#00ffaa' : '#F44336' }]} height={250} valueFormatter={(value) => `₹${fmtNum(Math.abs(value))}`} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6} lg={4}>
            <Card sx={{ background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%)', border: '1px solid #00ffaa30', height: 350 }}>
              <CardContent>
                <PerformanceMetrics analytics={analytics} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Capital Flow Analysis */}
        {analytics.fundMovementAnalysis && (
          <>
            <Typography variant="h6" sx={{ color: '#00ffaa', mb: 4, fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.3rem' }, display: 'flex', alignItems: 'center', gap: 1.5, '&::before': { content: '"💰"', fontSize: '1.5rem' } }}>Capital Flow Analysis</Typography>
            <Grid container spacing={{ xs: 2, md: 4 }} sx={{ mb: 5 }}>
              <Grid item xs={12} md={8}>
                <Card sx={{ background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 50%, rgba(0, 20, 15, 0.3) 100%)', border: '3px solid transparent', borderImage: 'linear-gradient(135deg, #00ffaa, #00ccaa, #008877) 1', borderRadius: 4, height: 380, boxShadow: '0 8px 40px rgba(0, 255, 170, 0.25)', '&:hover': { transform: 'translateY(-6px)' } }}>
                  <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="h6" sx={{ color: '#00ffaa', mb: 3, fontWeight: 700, textAlign: 'center' }}>📈 Available Margin Timeline</Typography>
                    <Box sx={{ p: { xs: 1, md: 2 }, flex: 1 }}>
                      <Grid container spacing={{ xs: 1, md: 2 }} sx={{ mb: 3 }}>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center', p: { xs: 1.5, md: 2 }, background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(76, 175, 80, 0.05) 100%)', borderRadius: 3, border: '2px solid #4CAF5040', height: 90, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="h5" sx={{ color: '#4CAF50', fontFamily: 'Roboto Mono, monospace', fontWeight: 800, mb: 0.5 }}>₹{fmtNum(analytics.fundMovementAnalysis.initialMargin)}</Typography>
                            <Typography variant="caption" sx={{ color: '#A5D6A7', fontWeight: 600 }}>🏁 Initial Capital</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center', p: { xs: 1.5, md: 2 }, background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.15) 0%, rgba(33, 150, 243, 0.05) 100%)', borderRadius: 3, border: '2px solid #2196F340', height: 90, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="h5" sx={{ color: '#2196F3', fontFamily: 'Roboto Mono, monospace', fontWeight: 800, mb: 0.5 }}>₹{fmtNum(analytics.fundMovementAnalysis.finalMargin)}</Typography>
                            <Typography variant="caption" sx={{ color: '#90CAF9', fontWeight: 600 }}>🏆 Final Capital</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center', p: { xs: 1.5, md: 2 }, background: analytics.fundMovementAnalysis.changePercent >= 0 ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(76, 175, 80, 0.05) 100%)' : 'linear-gradient(135deg, rgba(244, 67, 54, 0.15) 0%, rgba(244, 67, 54, 0.05) 100%)', borderRadius: 3, border: analytics.fundMovementAnalysis.changePercent >= 0 ? '2px solid #4CAF5040' : '2px solid #F4433640', height: 90, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="h5" sx={{ color: analytics.fundMovementAnalysis.changePercent >= 0 ? '#4CAF50' : '#F44336', fontFamily: 'Roboto Mono, monospace', fontWeight: 800, mb: 0.5 }}>
                              {analytics.fundMovementAnalysis.changePercent >= 0 ? '+' : ''}{fmtNum(analytics.fundMovementAnalysis.changePercent, 2)}%
                            </Typography>
                            <Typography variant="caption" sx={{ color: analytics.fundMovementAnalysis.changePercent >= 0 ? '#A5D6A7' : '#FFCDD2', fontWeight: 600 }}>
                              {analytics.fundMovementAnalysis.changePercent >= 0 ? '📈' : '📉'} ROI
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                      <Box sx={{ height: 120, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0, 255, 170, 0.2)' }}>
                        <Typography variant="body2" sx={{ color: '#00ffaa', textAlign: 'center' }}>
                          �� Your capital {analytics.fundMovementAnalysis.changePercent >= 0 ? 'grew' : 'decreased'} by <strong>₹{fmtNum(Math.abs(analytics.fundMovementAnalysis.totalChange))}</strong> ({analytics.fundMovementAnalysis.changePercent >= 0 ? '+' : ''}{fmtNum(analytics.fundMovementAnalysis.changePercent, 2)}%)
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card sx={{ background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%)', border: '2px solid #00ffaa40', borderRadius: 3, height: 350, boxShadow: '0 4px 16px rgba(0, 255, 170, 0.15)' }}>
                  <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="subtitle2" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>Capital Efficiency</Typography>
                    <Stack spacing={2} sx={{ flex: 1 }}>
                      <Box sx={{ p: 2, bgcolor: 'rgba(0, 255, 170, 0.05)', border: '1px solid #00ffaa20', borderRadius: 1, height: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#a7ffeb', fontWeight: 600, mb: 1 }}>Maximum Deployed</Typography>
                        <Typography variant="h6" sx={{ color: '#00ffaa', fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>
                          ₹{fmtNum(Math.max(...(analytics.fundMovementAnalysis.marginHistory?.map(h => h.used_margin || 0) || [0])))}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 2, bgcolor: 'rgba(255, 193, 7, 0.05)', border: '1px solid #FFC10720', borderRadius: 1, height: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#fff59d', fontWeight: 600, mb: 1 }}>Capital Utilization</Typography>
                        <Typography variant="h6" sx={{ color: '#FFC107', fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>
                          {analytics.fundMovementAnalysis.initialMargin > 0 ? fmtNum((Math.max(...(analytics.fundMovementAnalysis.marginHistory?.map(h => h.used_margin || 0) || [0])) / analytics.fundMovementAnalysis.initialMargin) * 100, 1) : 0}%
                        </Typography>
                      </Box>
                      <Box sx={{ p: 2, bgcolor: 'rgba(156, 39, 176, 0.05)', border: '1px solid #9C27B020', borderRadius: 1, height: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#ce93d8', fontWeight: 600, mb: 1 }}>Trading Sessions</Typography>
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

        {/* Trade Size & Impact Distribution */}
        <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>💎 Trade Size & Impact Distribution</Typography>
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Card sx={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid #00ffaa30', height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ color: '#00ffaa', fontWeight: 700, mb: 2 }}>📈 Winning Trades Breakdown</Typography>
                {(() => {
                  const profitTrades = filteredRows.filter(r => !r.in_progress && (r.total_matched_pnl || 0) > 0).sort((a, b) => (b.total_matched_pnl || 0) - (a.total_matched_pnl || 0));
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
                          <Typography variant="h6" sx={{ color: '#4CAF50', fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>₹{fmtNum(bigWinsTotal)}</Typography>
                          <Typography variant="caption" sx={{ color: '#a5d6a7' }}>{fmtNum(bigWinsPct, 1)}% of total profits</Typography>
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
                            💡 <strong>Key Insight:</strong> Your {bigWins.length} biggest wins ({fmtNum(bigWins.length / analytics.totalTrades * 100, 1)}% of all trades) generated {fmtNum(bigWinsPct, 1)}% of your total profits!
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
                <Typography variant="subtitle1" sx={{ color: '#00ffaa', fontWeight: 700, mb: 2 }}>📉 Loss Control Analysis</Typography>
                {(() => {
                  const lossTrades = filteredRows.filter(r => !r.in_progress && (r.total_matched_pnl || 0) < 0).sort((a, b) => (a.total_matched_pnl || 0) - (b.total_matched_pnl || 0));
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
                      <Box sx={{ mt: 2, p: 2, bgcolor: `rgba(${parseInt(lossControlColor.slice(1, 3), 16)}, ${parseInt(lossControlColor.slice(3, 5), 16)}, ${parseInt(lossControlColor.slice(5, 7), 16)}, 0.1)`, borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ color: lossControlColor, fontWeight: 700, mb: 1 }}>Loss Control: {lossControlRating}</Typography>
                        <Typography variant="caption" sx={{ color: '#e0e0e0', fontStyle: 'italic' }}>
                          {lossControlRating === 'Excellent' ? '🎯 Perfect! No big losses means excellent risk management.' : lossControlRating === 'Good' ? '👍 Good control with minimal big losses.' : '⚠️ Consider tightening stop losses.'}
                        </Typography>
                      </Box>
                    </Stack>
                  );
                })()}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Trading Performance KPIs */}
        <Typography variant="h6" sx={{ color: '#00ffaa', mb: 4, fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.3rem' }, display: 'flex', alignItems: 'center', gap: 1.5, '&::before': { content: '"🎯"', fontSize: '1.5rem' } }}>Trading Performance KPIs</Typography>
        <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: 5 }}>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, rgba(0, 255, 170, 0.12) 0%, rgba(0, 200, 150, 0.08) 50%, rgba(0, 150, 120, 0.04) 100%)', border: '2px solid #00ffaa50', textAlign: 'center', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, boxShadow: '0 8px 32px rgba(0, 255, 170, 0.25)', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', '&:hover': { transform: 'translateY(-8px) scale(1.05)' } }}>
              <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                <Typography variant="h3" sx={{ color: '#00ffaa', fontFamily: 'Roboto Mono, monospace', fontWeight: 800, fontSize: { xs: '2rem', md: '2.5rem' }, mb: 1 }}>{analytics.totalTrades}</Typography>
                <Typography variant="body2" sx={{ color: '#A7FFEB', fontWeight: 700, fontSize: { xs: '0.85rem', md: '0.95rem' } }}>📋 Total Trades</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.12) 0%, rgba(56, 142, 60, 0.08) 50%, rgba(46, 125, 50, 0.04) 100%)', border: '2px solid #4CAF5050', textAlign: 'center', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, boxShadow: '0 8px 32px rgba(76, 175, 80, 0.25)', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', '&:hover': { transform: 'translateY(-8px) scale(1.05)' } }}>
              <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                <Typography variant="h3" sx={{ color: '#4CAF50', fontFamily: 'Roboto Mono, monospace', fontWeight: 800, fontSize: { xs: '1.8rem', md: '2.2rem' }, mb: 0.5 }}>{fmtNum(analytics.winRate, 1)}%</Typography>
                <Typography variant="body2" sx={{ color: '#A5D6A7', fontWeight: 700, fontSize: { xs: '0.8rem', md: '0.9rem' }, mb: 0.5 }}>🏆 Win Rate</Typography>
                <Typography variant="caption" sx={{ color: '#81C784', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>{analytics.wins}W / {analytics.losses}L</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, rgba(255, 235, 59, 0.12) 0%, rgba(255, 213, 79, 0.08) 50%, rgba(255, 193, 7, 0.04) 100%)', border: '2px solid #FFEB3B50', textAlign: 'center', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, boxShadow: '0 8px 32px rgba(255, 235, 59, 0.25)', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', '&:hover': { transform: 'translateY(-8px) scale(1.05)' } }}>
              <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                <Typography variant="h3" sx={{ color: '#FFEB3B', fontFamily: 'Roboto Mono, monospace', fontWeight: 800, fontSize: { xs: '1.8rem', md: '2.2rem' }, mb: 1 }}>
                  {analytics.profitFactor === Infinity ? '∞' : fmtNum(analytics.profitFactor, 1)}x
                </Typography>
                <Typography variant="body2" sx={{ color: '#FFF59D', fontWeight: 700, fontSize: { xs: '0.85rem', md: '0.95rem' } }}>💰 Profit Factor</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: analytics.avgPnL >= 0 ? 'linear-gradient(135deg, rgba(33, 150, 243, 0.12) 0%, rgba(30, 136, 229, 0.08) 50%, rgba(25, 118, 210, 0.04) 100%)' : 'linear-gradient(135deg, rgba(244, 67, 54, 0.12) 0%, rgba(229, 57, 53, 0.08) 50%, rgba(211, 47, 47, 0.04) 100%)', border: `2px solid ${analytics.avgPnL >= 0 ? '#2196F350' : '#F4433650'}`, textAlign: 'center', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, boxShadow: `0 8px 32px ${analytics.avgPnL >= 0 ? 'rgba(33, 150, 243, 0.25)' : 'rgba(244, 67, 54, 0.25)'}`, transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', '&:hover': { transform: 'translateY(-8px) scale(1.05)' } }}>
              <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                <Typography variant="h3" sx={{ color: analytics.avgPnL >= 0 ? '#2196F3' : '#F44336', fontFamily: 'Roboto Mono, monospace', fontWeight: 800, fontSize: { xs: '1.8rem', md: '2.2rem' }, mb: 1 }}>₹{fmtNum(analytics.avgPnL)}</Typography>
                <Typography variant="body2" sx={{ color: analytics.avgPnL >= 0 ? '#90CAF9' : '#FFCDD2', fontWeight: 700, fontSize: { xs: '0.85rem', md: '0.95rem' } }}>📊 Avg P&L/Trade</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tag-Based P&L Analysis */}
        <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>🏷️ Tag-Based P&L Analysis</Typography>
        <TableContainer component={Paper} sx={{ mb: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', overflowX: 'auto' }}>
          <Table size="small">
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
                    <Chip label={tag.tag} size="small" sx={{ bgcolor: 'rgba(0, 255, 170, 0.15)', color: '#00ffaa', border: '1px solid #00ffaa50' }} />
                  </TableCell>
                  <TableCell align="right" sx={{ color: '#e0e0e0', fontFamily: 'Roboto Mono, monospace' }}>{tag.count}</TableCell>
                  <TableCell align="right" sx={{ color: tag.pnl >= 0 ? '#4CAF50' : '#F44336', fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>₹{fmtNum(tag.pnl)}</TableCell>
                  <TableCell align="right" sx={{ color: tag.avgPnL >= 0 ? '#4CAF50' : '#F44336', fontFamily: 'Roboto Mono, monospace' }}>₹{fmtNum(tag.avgPnL)}</TableCell>
                  <TableCell align="right" sx={{ color: '#4CAF50', fontFamily: 'Roboto Mono, monospace' }}>{tag.wins}</TableCell>
                  <TableCell align="right" sx={{ color: '#F44336', fontFamily: 'Roboto Mono, monospace' }}>{tag.losses}</TableCell>
                  <TableCell align="right" sx={{ color: tag.winRate >= 50 ? '#4CAF50' : '#F44336', fontFamily: 'Roboto Mono, monospace', fontWeight: 600 }}>{fmtNum(tag.winRate, 1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Signal Type Performance */}
        <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>📡 Signal Type Performance</Typography>
        <TableContainer component={Paper} sx={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', overflowX: 'auto' }}>
          <Table size="small">
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
                    <Chip label={signal.signal} size="small" sx={{ bgcolor: 'rgba(33, 150, 243, 0.15)', color: '#2196F3', border: '1px solid #2196F350' }} />
                  </TableCell>
                  <TableCell align="right" sx={{ color: '#e0e0e0', fontFamily: 'Roboto Mono, monospace' }}>{signal.count}</TableCell>
                  <TableCell align="right" sx={{ color: signal.pnl >= 0 ? '#4CAF50' : '#F44336', fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>₹{fmtNum(signal.pnl)}</TableCell>
                  <TableCell align="right" sx={{ color: '#4CAF50', fontFamily: 'Roboto Mono, monospace' }}>{signal.wins}</TableCell>
                  <TableCell align="right" sx={{ color: '#F44336', fontFamily: 'Roboto Mono, monospace' }}>{signal.losses}</TableCell>
                  <TableCell align="right" sx={{ color: signal.winRate >= 50 ? '#4CAF50' : '#F44336', fontFamily: 'Roboto Mono, monospace', fontWeight: 600 }}>{fmtNum(signal.winRate, 1)}%</TableCell>
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
