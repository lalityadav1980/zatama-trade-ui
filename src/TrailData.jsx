import React, { useState, useEffect } from 'react';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  CircularProgress,
  styled,
  Chip,
  useMediaQuery,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  TextField,
  InputAdornment
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import TodayIcon from '@mui/icons-material/Today';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-moment';
import CustomAppBar from './CustomAppBar';
import { httpApi } from './api';
import moment from 'moment';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

// =====================
// Styled components
// =====================
const DateCard = styled(Card)(({ theme }) => ({
  background: '#070808',
  border: '2px solid rgba(0, 255, 170, 0.5)',
  borderRadius: '8px',
  marginBottom: '16px',
  transition: 'all 0.3s ease',
}));

const SymbolGaugeCard = styled(Card)(({ theme }) => ({
  background: '#070808',
  border: '2px solid rgba(0, 255, 170, 0.4)',
  borderRadius: '12px',
  transition: 'all 0.3s ease',
  cursor: 'pointer',
  minHeight: '320px',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(0, 255, 170, 0.15)',
    border: '2px solid rgba(0, 255, 170, 0.7)',
  },
}));

const ActiveCard = styled(SymbolGaugeCard)({
  background: '#070808',
  border: '2px solid rgba(0, 255, 170, 0.8)',
  boxShadow: '0 0 24px rgba(0,255,170,0.25)'
});

const LivePanel = styled(Card)(({ theme }) => ({
  background: '#070808',
  border: '2px solid rgba(0, 255, 170, 0.7)',
  borderRadius: 12,
}));

// =====================
// Helpers
// =====================
const formatNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num)
    ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
};

const formatSigned = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  const sign = num > 0 ? '+' : '';
  return `${sign}${formatNumber(num)}`;
};

const formatDate = (dateString) => (dateString ? moment(dateString).format('DD-MM-YYYY') : 'N/A');

const getGaugeColor = (value) => {
  if (value >= 5) return '#4CAF50';
  if (value >= 1) return '#8BC34A';
  if (value >= -1) return '#FFEB3B';
  if (value >= -5) return '#FF9800';
  return '#F44336';
};

// Helper function to calculate stop loss percentage of buy price
const getStopLossPercentage = (stopLoss, buyPrice) => {
  if (!stopLoss || !buyPrice) return null;
  const percentage = ((stopLoss - buyPrice) / buyPrice) * 100;
  return percentage;
};

// CSV Export function
const exportToCSV = (data, filename = 'trail_data') => {
  if (!data || data.length === 0) {
    alert('No data available to export');
    return;
  }

  // Flatten all records from all dates
  const allRecords = [];
  Object.entries(data).forEach(([date, records]) => {
    records.forEach(record => {
      allRecords.push({
        date: formatDate(date),
        tradingsymbol: record.tradingsymbol || '',
        parent_order_id: record.parent_order_id || '',
        quantity: record.quantity || '',
        buy_price: record.buy_price || '',
        current_price: record.current_price || '',
        pnl_pct: record.pnl_pct || '',
        pnl_abs: record.pnl_abs || '',
        is_live: record.is_live ? 'Yes' : 'No',
        max_pct: record.max_pct || '',
        min_pct: record.min_pct || '',
        avg_pct: record.avg_pct || '',
        max_current_price: record.max_current_price || '',
        min_current_price: record.min_current_price || '',
        avg_current_price: record.avg_current_price || '',
        max_profit_abs: record.max_profit_abs || '',
        min_profit_abs: record.min_profit_abs || '',
        avg_profit_abs: record.avg_profit_abs || ''
      });
    });
  });

  if (allRecords.length === 0) {
    alert('No records found to export');
    return;
  }

  // Create CSV headers
  const headers = [
    'Date',
    'Trading Symbol',
    'Parent Order ID', 
    'Quantity',
    'Buy Price',
    'Current Price',
    'P&L %',
    'P&L ₹',
    'Is Live',
    'Max P&L %',
    'Min P&L %',
    'Avg P&L %',
    'Max Price',
    'Min Price', 
    'Avg Price',
    'Max Profit ₹',
    'Min Profit ₹',
    'Avg Profit ₹'
  ];

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...allRecords.map(record => 
      Object.values(record).map(value => 
        typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value
      ).join(',')
    )
  ].join('\n');

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${moment().format('YYYY-MM-DD_HH-mm-ss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Build a stable parent key; server should give parent_order_id but keep a legacy fallback.
const parentKeyOf = (r) =>
  r.parent_order_id || `NO_PARENT:${r.tradingsymbol}:${moment(r.date).format('YYYYMMDD')}:${r.buy_price}`;

// Prefer live rows, then latest time
const byLiveThenTimeDesc = (a, b) => {
  const la = a.is_live ? 1 : 0;
  const lb = b.is_live ? 1 : 0;
  if (lb !== la) return lb - la; // live first
  return moment(b.date).valueOf() - moment(a.date).valueOf();
};

// Derive profit amounts (₹) from price aggregates if API didn’t send them
const deriveProfitAmounts = (r) => {
  const buy = Number(r.buy_price);
  const qty = Number(r.quantity);
  const minP = Number(r.min_current_price);
  const maxP = Number(r.max_current_price);
  const avgP = Number(r.avg_current_price);
  if (
    Number.isFinite(buy) &&
    Number.isFinite(qty) &&
    Number.isFinite(minP) &&
    Number.isFinite(maxP) &&
    Number.isFinite(avgP)
  ) {
    return {
      min_profit_abs: (minP - buy) * qty,
      max_profit_abs: (maxP - buy) * qty,
      avg_profit_abs: (avgP - buy) * qty,
    };
  }
  return {};
};

// =====================
// Advanced Cockpit-Style Gauge
// =====================
const AdvancedTrailGauge = ({ value, title, size = 140, type = 'profit' }) => {
  const clampedValue = Math.max(-15, Math.min(15, value || 0));
  const percentage = ((clampedValue + 15) / 30) * 100; // Convert to 0-100%
  const radius = (size - 40) / 2;
  const centerX = size / 2;
  const centerY = size / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Clean color scheme based on value
  const getGaugeColor = (val) => {
    if (val >= 8) return '#4CAF50'; // Strong green
    if (val >= 3) return '#8BC34A'; // Light green
    if (val >= 1) return '#FFC107'; // Yellow
    if (val >= -1) return '#FF9800'; // Orange
    if (val >= -5) return '#FF5722'; // Red-orange
    return '#F44336'; // Red
  };
  
  const gaugeColor = getGaugeColor(clampedValue);
  const strokeOffset = circumference - (percentage / 100) * circumference;
  
  return (
    <Box sx={{ 
      textAlign: 'center', 
      p: 1.5,
      backgroundColor: '#070808',
      borderRadius: '12px',
      border: '2px solid rgba(255,255,255,0.1)',
      position: 'relative',
      '&:hover': {
        border: `2px solid ${gaugeColor}30`,
        boxShadow: `0 0 20px ${gaugeColor}20`
      }
    }}>
      <Typography variant="subtitle2" sx={{ 
        color: '#FFFFFF', 
        mb: 1.5, 
        fontSize: '0.8rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {title}
      </Typography>
      
      <Box sx={{ position: 'relative', display: 'inline-block' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          
          {/* Progress circle */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke={gaugeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            style={{
              transition: 'stroke-dashoffset 0.5s ease-in-out, stroke 0.3s ease'
            }}
          />
        </svg>
        
        {/* Value display */}
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <Typography variant="h6" sx={{ 
            color: gaugeColor,
            fontWeight: 700, 
            fontSize: '1.1rem',
            fontFamily: 'Arial, sans-serif',
            lineHeight: 1
          }}>
            {`${value > 0 ? '+' : ''}${Math.round((value || 0) * 10) / 10}%`}
          </Typography>
        </Box>
      </Box>
      
      {/* Status indicator bar */}
      <Box sx={{
        mt: 1.5,
        height: '4px',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: '2px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Box sx={{
          height: '100%',
          width: `${percentage}%`,
          backgroundColor: gaugeColor,
          borderRadius: '2px',
          transition: 'width 0.5s ease-in-out'
        }}/>
      </Box>
    </Box>
  );
};

// =====================
// Circular Progress Gauge for Trail Status
// =====================
const TrailStatusGauge = ({ current, max, min, title, size = 120 }) => {
  // For AVG P&L, we should actually calculate the average of min, max, current
  const avgValue = (min + max + current) / 3;
  const range = Math.max(max - min, 0.1); // Prevent division by zero
  const normalizedCurrent = ((avgValue - min) / range) * 100;
  const clampedProgress = Math.max(0, Math.min(100, normalizedCurrent));
  const radius = (size - 30) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (clampedProgress / 100) * circumference;
  
  // Clean status colors
  const getStatusColor = (value) => {
    if (value >= 2) return '#4CAF50'; // Green
    if (value >= 1) return '#8BC34A'; // Light green
    if (value >= 0) return '#FFC107'; // Yellow
    if (value >= -1) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };
  
  const statusColor = getStatusColor(avgValue);
  
  return (
    <Box sx={{ 
      textAlign: 'center', 
      p: 1.5,
      backgroundColor: '#070808',
      borderRadius: '12px',
      border: '2px solid rgba(255,255,255,0.1)',
      '&:hover': {
        border: `2px solid ${statusColor}30`,
        boxShadow: `0 0 20px ${statusColor}20`
      }
    }}>
      <Typography variant="caption" sx={{ 
        color: '#FFFFFF', 
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        fontSize: '0.75rem',
        display: 'block',
        mb: 1.5
      }}>
        {title}
      </Typography>
      
      <Box sx={{ position: 'relative', display: 'inline-block' }}>
        <svg width={size} height={size}>
          {/* Background circle */}
          <circle
            cx={size/2}
            cy={size/2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
            strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`}
          />
          
          {/* Progress circle */}
          <circle
            cx={size/2}
            cy={size/2}
            r={radius}
            fill="none"
            stroke={statusColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{
              transition: 'stroke-dashoffset 0.6s ease-in-out, stroke 0.3s ease'
            }}
          />
          
          {/* Center content */}
          <text 
            x={size/2} 
            y={size/2} 
            textAnchor="middle" 
            dominantBaseline="central"
            fill={statusColor}
            fontSize="16"
            fontWeight="bold"
            fontFamily="monospace"
          >
            {avgValue > 0 ? '+' : ''}{avgValue.toFixed(1)}%
          </text>
        </svg>
      </Box>
      
      {/* Simplified status indicator */}
      <Box sx={{
        mt: 1.5,
        height: '4px',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: '2px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Box sx={{
          height: '100%',
          width: `${clampedProgress}%`,
          backgroundColor: statusColor,
          borderRadius: '2px',
          transition: 'width 0.5s ease-in-out'
        }}/>
      </Box>
    </Box>
  );
};

// =====================
// Main Component
// =====================
const ALL_LOOKBACK_DAYS = 30;

const TrailData = () => {
  const [groupedData, setGroupedData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [symbolData, setSymbolData] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [symbolLoading, setSymbolLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [aggregationInterval, setAggregationInterval] = useState('1min'); // 1min, 5min, 15min, 30min, 1hour
  const [timeRange, setTimeRange] = useState('all'); // all, 1hour, 6hours, 12hours, 1day
  const [searchedAllData, setSearchedAllData] = useState(false);

  // Modes: 'current', 'historical', 'dateRange', 'all'
  const [viewMode, setViewMode] = useState('current');
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [dateRange, setDateRange] = useState({
    start: moment().subtract(7, 'days').format('YYYY-MM-DD'),
    end: moment().format('YYYY-MM-DD'),
  });
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [onlyActive, setOnlyActive] = useState(false);
  const [parentQuery, setParentQuery] = useState('');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // ------------- Data fetchers -------------
  const normalizeIncoming = (items = [], asLive = false) =>
    items.map((r) => {
      const base = { ...r, is_live: asLive, parent_order_id: r.parent_order_id || parentKeyOf(r) };
      // If API didn't send *_profit_abs, derive from price aggregates
      if (
        typeof base.max_profit_abs === 'undefined' &&
        typeof base.min_current_price !== 'undefined'
      ) {
        return { ...base, ...deriveProfitAmounts(base) };
      }
      return base;
    });

  const fetchTrailData = async () => {
    try {
      setLoading(true);

      if (viewMode === 'current') {
        const today = moment().format('YYYY-MM-DD');
        const res = await httpApi.get(`/trail-data/summary?date=${today}`);

        const live = normalizeIncoming(res.data.live || [], true);
        const historical = normalizeIncoming(res.data.historical || [], false);
        const combined = [...live, ...historical];

        const grouped = combined.reduce((acc, item) => {
          const d = moment(item.date).format('YYYY-MM-DD');
          if (!acc[d]) acc[d] = [];
          acc[d].push(item);
          return acc;
        }, {});

        Object.keys(grouped).forEach((d) => grouped[d].sort(byLiveThenTimeDesc));

        const sortedGrouped = {};
        Object.keys(grouped)
          .sort((a, b) => moment(b).valueOf() - moment(a).valueOf())
          .forEach((d) => {
            sortedGrouped[d] = grouped[d];
          });

        setGroupedData(sortedGrouped);
      } else if (viewMode === 'historical') {
        const day = selectedDate;
        const res = await httpApi.get(`/trail-data/summary?date=${day}`);

        const live = normalizeIncoming(res.data.live || [], true);
        const historical = normalizeIncoming(res.data.historical || [], false);
        const combined = [...live, ...historical];

        const grouped = combined.reduce((acc, item) => {
          const d = moment(item.date).format('YYYY-MM-DD');
          if (!acc[d]) acc[d] = [];
          acc[d].push(item);
          return acc;
        }, {});
        Object.keys(grouped).forEach((d) => grouped[d].sort(byLiveThenTimeDesc));
        setGroupedData(grouped);
      } else {
        const start =
          viewMode === 'all'
            ? moment().subtract(ALL_LOOKBACK_DAYS, 'days').format('YYYY-MM-DD')
            : dateRange.start;
        const end = viewMode === 'all' ? moment().format('YYYY-MM-DD') : dateRange.end;

        const res = await httpApi.get(`/trail-data/range?start_date=${start}&end_date=${end}`);
        const data = normalizeIncoming(res.data.data || [], false);

        const grouped = data.reduce((acc, item) => {
          const d = moment(item.date).format('YYYY-MM-DD');
          if (!acc[d]) acc[d] = [];
          acc[d].push(item);
          return acc;
        }, {});

        Object.keys(grouped).forEach((d) => grouped[d].sort(byLiveThenTimeDesc));

        const sortedGrouped = {};
        Object.keys(grouped)
          .sort((a, b) => moment(b).valueOf() - moment(a).valueOf())
          .forEach((d) => {
            sortedGrouped[d] = grouped[d];
          });
        setGroupedData(sortedGrouped);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentDateData = async () => {
    try {
      setRefreshing(true);
      const today = moment().format('YYYY-MM-DD');
      const res = await httpApi.get(`/trail-data/summary?date=${today}`);

      const live = normalizeIncoming(res.data.live || [], true);
      const historical = normalizeIncoming(res.data.historical || [], false);
      const combined = [...live, ...historical].sort(byLiveThenTimeDesc);

      setGroupedData((prev) => ({ ...prev, [today]: combined }));
    } catch (err) {
      console.error('Error fetching current date data:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // ------------- Group & filter helpers (by parent) -------------
  const buildGroupsByParent = (records) => {
    return records.reduce((acc, record) => {
      const key = parentKeyOf(record); // group strictly by parent_order_id
      if (!acc[key]) acc[key] = [];
      acc[key].push(record);
      return acc;
    }, {});
  };

  // Enhanced search function that searches current data and fetches all data if needed
  const searchParentOrderData = async (query) => {
    if (!query.trim()) {
      setSearchedAllData(false);
      return;
    }

    const q = query.trim().toLowerCase();
    console.log(`=== SEARCH DEBUG ===`);
    console.log(`Query: "${q}"`);
    console.log(`Current grouped data keys:`, Object.keys(groupedData));
    console.log(`Total records in grouped data:`, Object.values(groupedData).flat().length);
    
    // First, search in current page data
    let foundRecords = [];
    Object.entries(groupedData).forEach(([date, dateRecords]) => {
      dateRecords.forEach(record => {
        // Debug: Log the actual structure of a few records
        if (foundRecords.length === 0) {
          console.log(`Sample record structure:`, {
            parent_order_id: record.parent_order_id,
            tradingsymbol: record.tradingsymbol,
            allKeys: Object.keys(record)
          });
        }
        
        const parentOrderId = String(record.parent_order_id || '').toLowerCase();
        const parentKey = String(parentKeyOf(record) || '').toLowerCase();
        const symbol = String(record.tradingsymbol || '').toLowerCase();
        
        // Also check if it's in a nested structure
        const nestedParentId = String(record.parent?.order_id || record.parentOrderId || '').toLowerCase();
        
        console.log(`Checking record - Parent ID: "${record.parent_order_id}", Symbol: "${record.tradingsymbol}"`);
        
        if (parentOrderId.includes(q) || parentKey.includes(q) || symbol.includes(q) || nestedParentId.includes(q)) {
          foundRecords.push({
            date,
            record,
            matchedBy: {
              parentOrderId: parentOrderId.includes(q),
              parentKey: parentKey.includes(q),
              symbol: symbol.includes(q),
              nestedParentId: nestedParentId.includes(q)
            }
          });
        }
      });
    });
    
    console.log(`Found ${foundRecords.length} matching records in current data:`);
    foundRecords.forEach(found => {
      console.log(`- Parent ID: ${found.record.parent_order_id}, Symbol: ${found.record.tradingsymbol}, Matched by:`, found.matchedBy);
    });
    
    const hasMatchInCurrentData = foundRecords.length > 0;

    // If found in current data or already searched all data, no need to fetch
    if (hasMatchInCurrentData || searchedAllData) {
      console.log(hasMatchInCurrentData ? 'Match found in current data' : 'Using previously fetched all data');
      return;
    }

    // If not found and haven't searched all data yet, fetch all data
    console.log('Parent order not found in current data, fetching all data...');
    try {
      setRefreshing(true);
      
      // Fetch all data from API (last 30 days)
      const allData = await httpApi.get('/trail-data', {
        params: {
          lookback_days: 30
        }
      });
      
      if (allData.data) {
        console.log(`Fetched ${allData.data.length} records from API`);
        
        // Process the fetched data same way as current data processing
        const processedData = {};
        
        allData.data.forEach((rawRecord) => {
          const record = {
            ...rawRecord,
            parent_order_id: rawRecord.parent_order_id || parentKeyOf(rawRecord)
          };
          
          const dateKey = moment(record.date).format('YYYY-MM-DD');
          if (!processedData[dateKey]) processedData[dateKey] = [];
          processedData[dateKey].push(record);
        });
        
        console.log(`Processed data into ${Object.keys(processedData).length} date groups`);
        
        // Update the grouped data with all fetched data
        setGroupedData(processedData);
        setSearchedAllData(true);
        
        console.log(`Updated grouped data, now searching again for: ${query}`);
      }
    } catch (error) {
      console.error('Error fetching all data for search:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Enhanced filter function with better search logic
  const filterGroupEntries = (entries) => {
    let result = entries;

    if (viewMode === 'current' && onlyActive) {
      result = result.filter(([, recs]) => recs.some((r) => r.is_live));
    }
    
    if (parentQuery.trim()) {
      const q = parentQuery.trim().toLowerCase();
      console.log(`=== FILTER DEBUG ===`);
      console.log(`=== FILTER DEBUG ===`);
      console.log(`Filtering query: "${q}" in ${entries.length} groups`);
      
      result = result.filter(([parentKey, recs]) => {
        // Check multiple fields for matches
        const parentKeyMatch = String(parentKey || '').toLowerCase().includes(q);
        
        const recordMatch = recs.some((r) => {
          const parentOrderId = String(r.parent_order_id || '').toLowerCase();
          const parentKeyFromRecord = String(parentKeyOf(r) || '').toLowerCase();
          const symbol = String(r.tradingsymbol || '').toLowerCase();
          const nestedParentId = String(r.parent?.order_id || r.parentOrderId || '').toLowerCase();
          
          const matches = parentOrderId.includes(q) || 
                         parentKeyFromRecord.includes(q) || 
                         symbol.includes(q) ||
                         nestedParentId.includes(q);
          
          if (q.startsWith('fusion') || q.includes('2025')) {
            console.log(`Checking record for "${q}":`, {
              parentOrderId: r.parent_order_id,
              parentOrderIdLower: parentOrderId,
              includes: parentOrderId.includes(q),
              symbol: r.tradingsymbol,
              parentKey: parentKeyFromRecord
            });
          }
          
          if (matches) {
            console.log(`✓ Match found - Parent ID: ${r.parent_order_id}, Symbol: ${r.tradingsymbol}`);
          }
          
          return matches;
        });
        
        return parentKeyMatch || recordMatch;
      });
      
      console.log(`Filter result: ${result.length} groups found out of ${entries.length} total`);
    }
    
    // Ensure deterministic order by latest in each group
    return result.sort(([, a], [, b]) => {
      const la = [...a].sort(byLiveThenTimeDesc)[0];
      const lb = [...b].sort(byLiveThenTimeDesc)[0];
      return byLiveThenTimeDesc(la, lb);
    });
  };

  // ------------- Symbol dialog prep (parent-aware) -------------
  const fetchSymbolData = async (symbol, date, parentKey) => {
    try {
      setSymbolLoading(true);
      const d = moment(date).format('YYYY-MM-DD');
      const records = (groupedData[d] || [])
        .filter((r) => (!parentKey || parentKeyOf(r) === parentKey))
        .sort(byLiveThenTimeDesc);
      setSymbolData(records);
    } catch (err) {
      console.error('Error preparing symbol data:', err);
      setSymbolData([]);
    } finally {
      setSymbolLoading(false);
    }
  };

  // ------------- Effects -------------
  useEffect(() => {
    fetchTrailData();
  }, [viewMode, selectedDate, dateRange, onlyActive]);

  // Separate effect for parent query search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (parentQuery.trim()) {
        console.log(`Triggering search for: "${parentQuery}"`);
        searchParentOrderData(parentQuery);
      }
    }, 300); // Reduced debounce to 300ms

    return () => clearTimeout(timeoutId);
  }, [parentQuery]);

  useEffect(() => {
    if (viewMode === 'current' && liveUpdates) {
      const refreshInterval = setInterval(() => fetchCurrentDateData(), 2000);
      return () => clearInterval(refreshInterval);
    }
  }, [viewMode, liveUpdates]);

  // ------------- UI handlers -------------
  const handleViewModeChange = (newMode) => {
    setViewMode(newMode);
    setLiveUpdates(newMode === 'current');
  };

  const handleRefreshData = () => fetchTrailData();

  const handleExportCSV = () => {
    const filename = `trail_data_${viewMode}_${moment().format('YYYY-MM-DD')}`;
    exportToCSV(groupedData, filename);
  };

  // Aggregate data based on time interval
  const aggregateData = (data, interval) => {
    if (!data || data.length === 0) return data;
    
    const intervalMinutes = {
      '1min': 1,
      '5min': 5,
      '15min': 15,
      '30min': 30,
      '1hour': 60
    }[interval] || 1;
    
    const aggregated = [];
    const groups = {};
    
    data.forEach(item => {
      const time = moment(item.date);
      const roundedTime = time.clone().startOf('minute')
        .minute(Math.floor(time.minute() / intervalMinutes) * intervalMinutes);
      const key = roundedTime.valueOf();
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });
    
    Object.keys(groups).sort((a, b) => a - b).forEach(key => {
      const group = groups[key];
      const latestItem = group[group.length - 1]; // Take the latest item in the group
      const pnlValues = group.map(item => parseFloat(item.pnl_pct || 0));
      
      aggregated.push({
        ...latestItem,
        date: new Date(parseInt(key)),
        pnl_pct: pnlValues[pnlValues.length - 1], // Use latest P&L
        min_pnl: Math.min(...pnlValues),
        max_pnl: Math.max(...pnlValues),
        avg_pnl: pnlValues.reduce((sum, val) => sum + val, 0) / pnlValues.length
      });
    });
    
    return aggregated;
  };
  
  // Filter data based on time range
  const filterDataByTimeRange = (data, range) => {
    if (!data || data.length === 0 || range === 'all') return data;
    
    const now = moment();
    const cutoffTime = {
      '1hour': now.clone().subtract(1, 'hour'),
      '6hours': now.clone().subtract(6, 'hours'),
      '12hours': now.clone().subtract(12, 'hours'),
      '1day': now.clone().subtract(1, 'day')
    }[range];
    
    if (!cutoffTime) return data;
    
    return data.filter(item => moment(item.date).isAfter(cutoffTime));
  };

  // Fetch chart data for the selected symbol
  const fetchChartData = async (parentOrderId) => {
    if (!parentOrderId) return;
    
    setChartLoading(true);
    try {
      const response = await httpApi.get(`/trail-data?parent_order_id=${parentOrderId}`);
      const apiData = response.data || {};
      const rows = apiData.rows || [];
      
      if (rows.length === 0) {
        setChartData(null);
        setChartLoading(false);
        return;
      }

      // Sort rows by date to ensure proper time order
      const sortedRows = rows.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Apply time range filter
      const filteredRows = filterDataByTimeRange(sortedRows, timeRange);
      
      // Apply aggregation if dataset is large or user selected aggregation
      const shouldAggregate = filteredRows.length > 100 || aggregationInterval !== '1min';
      const processedRows = shouldAggregate ? aggregateData(filteredRows, aggregationInterval) : filteredRows;
      
      if (processedRows.length === 0) {
        setChartData(null);
        setChartLoading(false);
        return;
      }
      
      // Calculate running statistics
      const chartDataPoints = [];
      let runningPnlValues = [];
      
      processedRows.forEach((item, index) => {
        const currentPnl = parseFloat(item.pnl_pct || 0);
        runningPnlValues.push(currentPnl);
        
        // Calculate min, max, and average up to this point
        const minPnl = Math.min(...runningPnlValues);
        const maxPnl = Math.max(...runningPnlValues);
        const avgPnl = runningPnlValues.reduce((sum, val) => sum + val, 0) / runningPnlValues.length;
        
        const timeFormat = shouldAggregate && aggregationInterval !== '1min' ? 'HH:mm' : 'HH:mm:ss';
        
        chartDataPoints.push({
          time: moment(item.date).format(timeFormat),
          current: currentPnl,
          average: avgPnl,
          high: maxPnl,
          min: minPnl
        });
      });
      
      // Process data for chart
      const processedData = {
        labels: chartDataPoints.map(point => point.time),
        datasets: [
          {
            label: 'Current P&L %',
            data: chartDataPoints.map(point => Number(point.current.toFixed(2))),
            borderColor: '#00BFFF',
            backgroundColor: 'rgba(0, 191, 255, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.5,
            pointRadius: 0,
            pointHoverRadius: 0,
          },
          {
            label: 'Average P&L %',
            data: chartDataPoints.map(point => Number(point.average.toFixed(2))),
            borderColor: '#FFD700',
            backgroundColor: 'rgba(255, 215, 0, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.5,
            pointRadius: 0,
            pointHoverRadius: 0,
          },
          {
            label: 'High P&L %',
            data: chartDataPoints.map(point => Number(point.high.toFixed(2))),
            borderColor: '#32CD32',
            backgroundColor: 'rgba(50, 205, 50, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.5,
            pointRadius: 0,
            pointHoverRadius: 0,
          },
          {
            label: 'Min P&L %',
            data: chartDataPoints.map(point => Number(point.min.toFixed(2))),
            borderColor: '#FF4444',
            backgroundColor: 'rgba(255, 68, 68, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.5,
            pointRadius: 0,
            pointHoverRadius: 0,
          },
        ],
      };
      
      setChartData(processedData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setChartData(null);
    } finally {
      setChartLoading(false);
    }
  };

  const handleSymbolClick = (symbol, date, parentKey) => {
    setSelectedSymbol({ symbol, date, parentKey });
    setDialogOpen(true);
    
    // Extract parent_order_id from the records
    const symbolRecords = Object.values(groupedData).flat().flat();
    const relevantRecord = symbolRecords.find(record => 
      record.tradingsymbol === symbol && 
      parentKeyOf(record) === parentKey
    );
    
    const parentOrderId = relevantRecord?.parent_order_id || parentKey;
    fetchChartData(parentOrderId);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedSymbol(null);
    setSymbolData([]);
    setChartData(null);
  };

  // ------------- Stats -------------
  const getSymbolStats = (records) => {
    if (!records || records.length === 0) {
      return {
        max: 0,
        min: 0,
        avg: 0,
        current: 0,
        currentRecord: null,
        totalRecords: 0,
        totalQuantity: 0,
        totalPnLAbs: 0,
        anyLive: false,
      };
    }

    const sorted = [...records].sort(byLiveThenTimeDesc);
    const latest = sorted[0];
    const hasAggregates = typeof records[0].min_pct !== 'undefined';

    const totals = records.reduce(
      (acc, r) => {
        const qty = parseInt(r.quantity) || 0;
        acc.qty += qty;
        acc.pnl += parseFloat(r.pnl_abs) || 0;
        return acc;
      },
      { qty: 0, pnl: 0 }
    );

    const weightedAvg = (arr, valKey, weightKey = 'quantity') => {
      let num = 0,
        den = 0;
      arr.forEach((r) => {
        const v = Number(r[valKey]);
        const w = Number(r[weightKey]) || 1;
        if (Number.isFinite(v) && Number.isFinite(w)) {
          num += v * w;
          den += w;
        }
      });
      return den ? num / den : 0;
    };

    if (hasAggregates) {
      const max = Math.max(...records.map((r) => Number(r.max_pct)));
      const min = Math.min(...records.map((r) => Number(r.min_pct)));
      const avg = weightedAvg(records, 'avg_pct', 'quantity');
      const current = weightedAvg(records, 'pnl_pct', 'quantity');
      return {
        max,
        min,
        avg,
        current,
        currentRecord: latest,
        totalRecords: records.length,
        totalQuantity: totals.qty,
        totalPnLAbs: totals.pnl,
        anyLive: records.some((r) => r.is_live),
      };
    }

    const pnlValues = records.map((r) => Number(r.pnl_pct)).filter(Number.isFinite);
    return {
      max: pnlValues.length ? Math.max(...pnlValues) : 0,
      min: pnlValues.length ? Math.min(...pnlValues) : 0,
      avg: pnlValues.length ? pnlValues.reduce((s, v) => s + v, 0) / pnlValues.length : 0,
      current: Number(latest?.pnl_pct) || 0,
      currentRecord: latest,
      totalRecords: records.length,
      totalQuantity: totals.qty,
      totalPnLAbs: totals.pnl,
      anyLive: records.some((r) => r.is_live),
    };
  };

  // ------------- Loading / Error -------------
  if (loading) {
    return (
      <>
        <CustomAppBar />
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
          sx={{ backgroundColor: '#070808' }}
        >
          <CircularProgress sx={{ color: '#00ffaa' }} />
        </Box>
      </>
    );
  }

  if (error) {
    return (
      <>
        <CustomAppBar />
        <Container maxWidth="xl" sx={{ mt: 4 }}>
          <Typography color="error" align="center" variant="h6">
            Error: {error}
          </Typography>
        </Container>
      </>
    );
  }

  // =====================
  // Render
  // =====================
  return (
    <>
      <CustomAppBar />
      <Container
        maxWidth="xl"
        sx={{
          borderRadius: '8px',
          border: '2px solid rgba(0, 255, 170, 0.5)',
          boxShadow: '0 0 30px rgba(0, 255, 170, 0.3), inset 0 0 20px rgba(0, 100, 150, 0.1)',
          background: 'linear-gradient(135deg, #070808 0%, #0a0f1c 30%, #070808 100%)',
          mt: 1,
          minHeight: '100vh',
          pb: 2,
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 20% 20%, rgba(0,255,255,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(0,255,170,0.03) 0%, transparent 50%)',
            pointerEvents: 'none',
            borderRadius: '8px'
          }
        }}
      >
        <Box sx={{ 
          textAlign: 'center', 
          py: 3, 
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '300px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #00ffff, transparent)',
            zIndex: 0
          }
        }}>
          <Typography
            variant="h4"
            sx={{ 
              color: '#00ffff', 
              fontWeight: 900,
              fontSize: { xs: '1.8rem', md: '2.5rem' },
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              letterSpacing: '3px',
              textShadow: '0 0 20px #00ffff, 0 0 40px #00ffff50',
              position: 'relative',
              zIndex: 1,
              background: '#070808',
              px: 3,
              '&::before': {
                content: '"◄ "',
                color: '#00ff41'
              },
              '&::after': {
                content: '" ►"',
                color: '#00ff41'
              }
            }}
          >
            TRAIL DATA ANALYTICS
          </Typography>
        </Box>

        {/* Control Panel */}
        <Card
          sx={{
            mb: 3,
            background: 'linear-gradient(135deg, #070808 0%, #0f1419 50%, #070808 100%)',
            border: '2px solid rgba(0, 255, 170, 0.5)',
            borderRadius: '12px',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: 'linear-gradient(90deg, #00ffff, #00ff41, #ffff00, #ff6b35, #ff0033)',
              borderRadius: '12px 12px 0 0'
            }
          }}
        >
          <CardContent>
            {/* Top Row - Mode Selection and Date Controls */}
            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <Select
                    value={viewMode}
                    onChange={(e) => handleViewModeChange(e.target.value)}
                    sx={{
                      color: '#e0e0e0',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa30' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa60' },
                    }}
                  >
                    <MenuItem value="current">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TodayIcon sx={{ color: '#4CAF50' }} />
                        Current Date (Live)
                      </Box>
                    </MenuItem>
                    <MenuItem value="historical">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HistoryIcon sx={{ color: '#FF9800' }} />
                        Specific Date
                      </Box>
                    </MenuItem>
                    <MenuItem value="dateRange">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HistoryIcon sx={{ color: '#2196F3' }} />
                        Date Range
                      </Box>
                    </MenuItem>
                    <MenuItem value="all">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HistoryIcon sx={{ color: '#9C27B0' }} />
                        All (last {ALL_LOOKBACK_DAYS} days)
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {viewMode === 'historical' && (
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Select Date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      '& .MuiInputLabel-root': { color: '#e0e0e0' },
                      '& .MuiOutlinedInput-root': {
                        color: '#e0e0e0',
                        '& fieldset': { borderColor: '#00ffaa30' },
                        '&:hover fieldset': { borderColor: '#00ffaa60' },
                      },
                    }}
                  />
                </Grid>
              )}

              {viewMode === 'dateRange' && (
                <>
                  <Grid item xs={12} md={2}>
                    <TextField
                      label="Start Date"
                      type="date"
                      value={dateRange.start}
                      onChange={(e) =>
                        setDateRange((prev) => ({ ...prev, start: e.target.value }))
                      }
                      size="small"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiInputLabel-root': { color: '#e0e0e0' },
                        '& .MuiOutlinedInput-root': {
                          color: '#e0e0e0',
                          '& fieldset': { borderColor: '#00ffaa30' },
                          '&:hover fieldset': { borderColor: '#00ffaa60' },
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      label="End Date"
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                      size="small"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiInputLabel-root': { color: '#e0e0e0' },
                        '& .MuiOutlinedInput-root': {
                          color: '#e0e0e0',
                          '& fieldset': { borderColor: '#00ffaa30' },
                          '&:hover fieldset': { borderColor: '#00ffaa60' },
                        },
                      }}
                    />
                  </Grid>
                </>
              )}

              {/* Search Field (for current mode) */}
              {viewMode === 'current' && (
                <Grid item xs={12} md={4}>
                  <TextField
                    size="small"
                    fullWidth
                    value={parentQuery}
                    onChange={(e) => {
                      setParentQuery(e.target.value);
                      if (!e.target.value.trim()) {
                        setSearchedAllData(false);
                      }
                    }}
                    label="Search Parent ID / Symbol"
                    placeholder="Enter parent_order_id or symbol (searches all 30 days)"
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: parentQuery.trim() ? '#00ffaa' : '#9E9E9E' }} />
                        </InputAdornment>
                      ),
                      sx: {
                        color: '#e0e0e0',
                        '& fieldset': { borderColor: parentQuery.trim() ? '#00ffaa60' : '#00ffaa30' },
                        '&:hover fieldset': { borderColor: '#00ffaa60' },
                      },
                    }}
                    helperText={searchedAllData ? "Searched in all 30 days data" : "Will search current page first, then fetch all data if needed"}
                    FormHelperTextProps={{
                      sx: { color: searchedAllData ? '#00ffaa' : '#9E9E9E', fontSize: '0.7rem' }
                    }}
                  />
                </Grid>
              )}

              {/* Action Buttons */}
              <Grid item xs={6} md={1.5}>
                <Button
                  variant="outlined"
                  onClick={handleRefreshData}
                  startIcon={<RefreshIcon />}
                  size="small"
                  sx={{
                    color: '#00ffaa',
                    borderColor: '#00ffaa',
                    '&:hover': { borderColor: '#00ffaa', backgroundColor: '#00ffaa20' },
                  }}
                  fullWidth
                >
                  Refresh
                </Button>
              </Grid>
              
              <Grid item xs={6} md={1.5}>
                <Button
                  variant="contained"
                  onClick={handleExportCSV}
                  startIcon={<DownloadIcon />}
                  size="small"
                  sx={{
                    bgcolor: '#2196F3',
                    color: '#ffffff',
                    fontWeight: 600,
                    '&:hover': {
                      bgcolor: '#1976D2',
                      boxShadow: '0 4px 12px rgba(33,150,243,0.3)'
                    }
                  }}
                  fullWidth
                  disabled={Object.keys(groupedData).length === 0}
                >
                  Export CSV
                </Button>
              </Grid>
            </Grid>

            {/* Bottom Row - Status and Controls */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              {/* Left Side - Status Chips */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Chip
                  icon={viewMode === 'current' ? <TodayIcon /> : <HistoryIcon />}
                  label={`Mode: ${
                    viewMode === 'current'
                      ? 'Live'
                      : viewMode === 'historical'
                      ? `Date: ${formatDate(selectedDate)}`
                      : viewMode === 'dateRange'
                      ? `Range: ${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`
                      : `All (last ${ALL_LOOKBACK_DAYS} days)`
                  }`}
                  sx={{
                    backgroundColor: viewMode === 'current' ? '#4CAF5030' : '#FF980030',
                    color: viewMode === 'current' ? '#4CAF50' : '#FF9800',
                    border: `1px solid ${viewMode === 'current' ? '#4CAF50' : '#FF9800'}30`,
                  }}
                />
                
                {liveUpdates && viewMode === 'current' && (
                  <Chip
                    label={refreshing ? 'Refreshing...' : 'Live (2s refresh)'}
                    size="small"
                    sx={{
                      backgroundColor: refreshing ? '#FF980030' : '#00ffaa30',
                      color: refreshing ? '#FF9800' : '#00ffaa',
                      border: `1px solid ${refreshing ? '#FF9800' : '#00ffaa'}30`,
                      animation: 'pulse 2s infinite',
                      '@keyframes pulse': {
                        '0%': { opacity: 1 },
                        '50%': { opacity: 0.7 },
                        '100%': { opacity: 1 },
                      },
                    }}
                  />
                )}
                
                {/* Live Updates and Only Active switches for current mode */}
                {viewMode === 'current' && (
                  <>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={liveUpdates}
                          onChange={(e) => setLiveUpdates(e.target.checked)}
                          disabled={viewMode !== 'current'}
                          size="small"
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: '#00ffaa' },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: '#00ffaa',
                            },
                          }}
                        />
                      }
                      label={<Typography variant="body2" sx={{ color: '#e0e0e0', fontSize: '0.8rem' }}>Live Updates</Typography>}
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={onlyActive}
                          onChange={(e) => setOnlyActive(e.target.checked)}
                          size="small"
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: '#00ffaa' },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: '#00ffaa',
                            },
                          }}
                        />
                      }
                      label={<Typography variant="body2" sx={{ color: '#e0e0e0', fontSize: '0.8rem' }}>Only Active</Typography>}
                    />
                  </>
                )}
              </Box>

              {/* Right Side - Data Info */}
              <Typography variant="body2" sx={{ color: '#e0e0e0', fontSize: '0.8rem' }}>
                Total Dates: {Object.keys(groupedData).length} | Records: {Object.values(groupedData).flat().length}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* LIVE PANEL (current day only) */}
        {viewMode === 'current' && groupedData[moment().format('YYYY-MM-DD')] &&
          (() => {
            const today = moment().format('YYYY-MM-DD');
            const todayRecords = groupedData[today] || [];
            const liveRecs = todayRecords.filter((r) => r.is_live);
            if (!liveRecs.length) return null;

            const groups = buildGroupsByParent(liveRecs);
            let entries = Object.entries(groups);
            entries = filterGroupEntries(entries);

            return (
              <LivePanel sx={{ 
                mb: 3,
                background: 'linear-gradient(135deg, #070808 0%, #0a1a0a 30%, #070808 100%)',
                border: '2px solid rgba(0, 255, 65, 0.7)',
                borderRadius: '16px',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #00ff41, #7fff00, #00ff41)',
                  animation: 'scan 3s linear infinite',
                  '@keyframes scan': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' }
                  }
                },
                '&::after': {
                  content: '"● LIVE TRACKING SYSTEM"',
                  position: 'absolute',
                  top: '12px',
                  right: '20px',
                  fontSize: '0.6rem',
                  color: '#00ff41',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  animation: 'blink 2s infinite',
                  '@keyframes blink': {
                    '0%, 70%': { opacity: 1 },
                    '71%, 100%': { opacity: 0.3 }
                  }
                }
              }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2, fontWeight: 'bold' }}>
                    Live Trades (Active Now)
                  </Typography>
                  <Grid container spacing={isMobile ? 2 : 3}>
                    {entries.map(([parentGroupKey, records]) => {
                      const stats = getSymbolStats(records);
                      const currentRecord = records[0] || null; // already live-first
                      const symbol = currentRecord?.tradingsymbol;

                      return (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={`live-${parentGroupKey}`}>
                          <ActiveCard
                            onClick={() => handleSymbolClick(symbol, today, parentGroupKey)}
                            sx={{
                              background: 'linear-gradient(135deg, #070808 0%, #0a1f0a 30%, #070808 100%)',
                              border: '2px solid rgba(0, 255, 65, 0.8)',
                              borderRadius: '16px',
                              position: 'relative',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '2px',
                                background: 'linear-gradient(90deg, transparent, #00ff41, transparent)',
                                animation: 'pulse 2s ease-in-out infinite'
                              },
                              '&:hover': {
                                transform: 'translateY(-4px) scale(1.02)',
                                boxShadow: '0 15px 35px rgba(0, 255, 65, 0.3), 0 0 20px rgba(0, 255, 65, 0.2)',
                                border: '2px solid rgba(0, 255, 65, 1)'
                              }
                            }}
                          >
                            <CardContent sx={{ textAlign: 'center', p: 2 }}>
                              <Typography
                                variant="h6"
                                sx={{
                                  color: '#FFEB3B',
                                  mb: 1,
                                  fontWeight: 'bold',
                                  fontSize: isMobile ? '0.9rem' : '1.1rem',
                                }}
                              >
                                {symbol}
                                {currentRecord?.buy_price
                                  ? ` (₹${formatNumber(currentRecord.buy_price)})`
                                  : ''}
                              </Typography>
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'center',
                                  gap: 1,
                                  mb: 2,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <Chip
                                  label="◉ ACTIVE"
                                  size="small"
                                  sx={{
                                    backgroundColor: 'rgba(0, 255, 65, 0.2)',
                                    color: '#00ff41',
                                    border: '1px solid rgba(0, 255, 65, 0.6)',
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    animation: 'glow 2s ease-in-out infinite',
                                    '@keyframes glow': {
                                      '0%, 100%': { boxShadow: '0 0 5px rgba(0, 255, 65, 0.3)' },
                                      '50%': { boxShadow: '0 0 15px rgba(0, 255, 65, 0.6)' }
                                    }
                                  }}
                                />
                                <Chip
                                  label="● LIVE"
                                  size="small"
                                  sx={{ 
                                    backgroundColor: 'rgba(76, 255, 80, 0.2)', 
                                    color: '#4cff50',
                                    border: '1px solid rgba(76, 255, 80, 0.6)',
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    animation: 'livePulse 1s ease-in-out infinite',
                                    '@keyframes livePulse': {
                                      '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                                      '50%': { opacity: 0.7, transform: 'scale(0.95)' }
                                    }
                                  }}
                                />
                                {currentRecord?.parent_order_id && (
                                  <Chip
                                    label={`Parent: ${String(currentRecord.parent_order_id).slice(
                                      0,
                                      10
                                    )}…`}
                                    size="small"
                                    sx={{ backgroundColor: '#1a237e50', color: '#e0e0e0' }}
                                  />
                                )}
                                {currentRecord?.buy_price && (
                                  <Chip
                                    label={`Buy ₹${formatNumber(currentRecord.buy_price)}`}
                                    size="small"
                                    sx={{ backgroundColor: '#1a237e50', color: '#FFEB3B' }}
                                  />
                                )}
                              </Box>

                              <Grid container spacing={1}>
                                <Grid item xs={6}>
                                  <AdvancedTrailGauge
                                    value={stats.max}
                                    title="MAX P&L"
                                    size={isMobile ? 90 : 110}
                                    type="max"
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <AdvancedTrailGauge
                                    value={stats.min}
                                    title="MIN P&L"
                                    size={isMobile ? 90 : 110}
                                    type="min"
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <TrailStatusGauge
                                    current={stats.current}
                                    max={stats.max}
                                    min={stats.min}
                                    title="AVG P&L"
                                    size={isMobile ? 90 : 110}
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <AdvancedTrailGauge
                                    value={stats.current}
                                    title="CURRENT P&L"
                                    size={isMobile ? 90 : 110}
                                    type="current"
                                  />
                                </Grid>
                              </Grid>

                              {/* Price aggregates */}
                              {currentRecord &&
                                typeof currentRecord.min_current_price !== 'undefined' && (
                                  <Box sx={{ mt: 1 }}>
                                    <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                                      Price (₹): 
                                      <span style={{ color: '#FFFFFF' }}>min {formatNumber(currentRecord.min_current_price)}</span> ·
                                      <span style={{ color: '#FFFFFF' }}> avg {formatNumber(currentRecord.avg_current_price)}</span> · 
                                      <span style={{ color: '#FFFFFF' }}>max {formatNumber(currentRecord.max_current_price)}</span>
                                    </Typography>
                                  </Box>
                                )}

                              {/* Trail Status */}}
                              {currentRecord && (
                                <Box
                                  sx={{
                                    mt: 2,
                                    p: 1.5,
                                    backgroundColor: '#00ffaa10',
                                    borderRadius: '8px',
                                    border: '1px solid #00ffaa30',
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: '#00ffaa',
                                      fontWeight: 'bold',
                                      display: 'block',
                                      mb: 1,
                                      textAlign: 'center',
                                      fontSize: '0.75rem',
                                    }}
                                  >
                                    Latest Trail Status
                                  </Typography>

                                  <Grid container spacing={0.5} sx={{ fontSize: '0.7rem' }}>
                                    <Grid item xs={6}>
                                      <Typography
                                        variant="caption"
                                        sx={{ color: '#e0e0e0', display: 'block', lineHeight: 1.3 }}
                                      >
                                        <strong style={{ color: '#FFEB3B' }}>Qty:</strong>{' '}
                                        {currentRecord.quantity}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                      <Typography
                                        variant="caption"
                                        sx={{ color: '#e0e0e0', display: 'block', lineHeight: 1.3 }}
                                      >
                                        <strong style={{ color: '#4CAF50' }}>Buy:</strong> ₹
                                        {formatNumber(currentRecord.buy_price)}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                      <Typography
                                        variant="caption"
                                        sx={{ color: '#e0e0e0', display: 'block', lineHeight: 1.3 }}
                                      >
                                        <strong style={{ color: '#FF9800' }}>Now:</strong> ₹
                                        {formatNumber(currentRecord.current_price)}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color:
                                            parseFloat(currentRecord.pnl_abs) >= 0
                                              ? '#4CAF50'
                                              : '#F44336',
                                          display: 'block',
                                          lineHeight: 1.3,
                                          fontWeight: 'bold',
                                        }}
                                      >
                                        {parseFloat(currentRecord.pnl_abs) >= 0 ? '+' : ''}₹
                                        {formatNumber(currentRecord.pnl_abs)}
                                      </Typography>
                                    </Grid>

                                    {/* Max/Min Profit amounts (₹) */}
                                    <Grid item xs={6}>
                                      <Typography
                                        variant="caption"
                                        sx={{ color: '#4CAF50', display: 'block', lineHeight: 1.3 }}
                                      >
                                        <strong>Max Profit:</strong>{' '}
                                        ₹
                                        {formatSigned(
                                          currentRecord.max_profit_abs ??
                                            deriveProfitAmounts(currentRecord).max_profit_abs
                                        )}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                      <Typography
                                        variant="caption"
                                        sx={{ color: '#F44336', display: 'block', lineHeight: 1.3 }}
                                      >
                                        <strong>Min Profit:</strong>{' '}
                                        ₹
                                        {formatSigned(
                                          currentRecord.min_profit_abs ??
                                            deriveProfitAmounts(currentRecord).min_profit_abs
                                        )}
                                      </Typography>
                                    </Grid>

                                    <Grid item xs={12}>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: '#e0e0e0',
                                          display: 'block',
                                          lineHeight: 1.3,
                                          textAlign: 'center',
                                        }}
                                      >
                                        <strong style={{ color: '#F44336' }}>Stop Loss:</strong>{' '}
                                        {currentRecord.stop_loss && currentRecord.buy_price ? (
                                          <>
                                            ₹{formatNumber(currentRecord.stop_loss)}{' '}
                                            <span style={{ 
                                              color: getStopLossPercentage(currentRecord.stop_loss, currentRecord.buy_price) > 0 
                                                ? '#4CAF50' 
                                                : getStopLossPercentage(currentRecord.stop_loss, currentRecord.buy_price) === 0 
                                                ? '#FFEB3B' 
                                                : '#F44336', 
                                              fontWeight: 'bold' 
                                            }}>
                                              {getStopLossPercentage(currentRecord.stop_loss, currentRecord.buy_price) < 0 && '⚠️ '}
                                              ({getStopLossPercentage(currentRecord.stop_loss, currentRecord.buy_price) > 0 ? '+' : ''}
                                              {formatNumber(getStopLossPercentage(currentRecord.stop_loss, currentRecord.buy_price))}%)
                                            </span>
                                          </>
                                        ) : (
                                          'None'
                                        )}
                                      </Typography>
                                    </Grid>
                                    <Grid
                                      item
                                      xs={12}
                                      sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid #00ffaa20' }}
                                    >
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: '#9E9E9E',
                                          display: 'block',
                                          fontSize: '0.65rem',
                                          textAlign: 'center',
                                        }}
                                      >
                                        Last Updated: {moment(currentRecord.date).format('HH:mm:ss')}
                                      </Typography>
                                    </Grid>
                                  </Grid>
                                </Box>
                              )}
                            </CardContent>
                          </ActiveCard>
                        </Grid>
                      );
                    })}
                  </Grid>
                </CardContent>
              </LivePanel>
            );
          })()}

        {/* Dates */}
        {Object.keys(groupedData).map((date) => {
          const dateRecords = groupedData[date];

          // If current view & current date, exclude live records to avoid duplication with Live Panel
          const visibleDateRecords =
            viewMode === 'current' && moment(date).isSame(moment(), 'day')
              ? dateRecords.filter((r) => !r.is_live)
              : dateRecords;

          // Group strictly by parent_order_id
          const groups = buildGroupsByParent(visibleDateRecords);
          let groupEntries = Object.entries(groups);
          groupEntries = filterGroupEntries(groupEntries);

          if (!groupEntries.length) return null;

          return (
            <DateCard key={date} sx={{ mb: 3 }}>
              <CardContent>
                <Typography
                  variant="h5"
                  sx={{
                    color: '#00ffaa',
                    mb: 2,
                    fontWeight: 'bold',
                    borderBottom: '2px solid #00ffaa30',
                    pb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  {formatDate(date)} ({groupEntries.length} parents)
                  {moment(date).isSame(moment(), 'day') && (
                    <Box
                      sx={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: refreshing ? '#FF9800' : '#00ffaa',
                        animation: 'pulse 2s infinite',
                        '@keyframes pulse': {
                          '0%': { opacity: 1, transform: 'scale(1)' },
                          '50%': { opacity: 0.5, transform: 'scale(1.2)' },
                          '100%': { opacity: 1, transform: 'scale(1)' },
                        },
                      }}
                      title={refreshing ? 'Refreshing data...' : 'Live updates every 2 seconds'}
                    />
                  )}
                </Typography>

                <Grid container spacing={isMobile ? 2 : 3}>
                  {groupEntries.map(([parentGroupKey, records]) => {
                    const stats = getSymbolStats(records);
                    const currentRecord = records.sort(byLiveThenTimeDesc)[0];
                    const isActive = !!currentRecord?.is_live;
                    const symbol = currentRecord?.tradingsymbol;

                    const cardTitle = currentRecord
                      ? `${symbol}${
                          currentRecord?.buy_price
                            ? ` (₹${formatNumber(currentRecord.buy_price)})`
                            : ''
                        }`
                      : symbol;

                    const CardComp = isActive ? ActiveCard : SymbolGaugeCard;

                    return (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={parentGroupKey}>
                        <CardComp onClick={() => handleSymbolClick(symbol, date, parentGroupKey)}>
                          <CardContent sx={{ textAlign: 'center', p: 2 }}>
                            <Typography
                              variant="h6"
                              sx={{
                                color: '#FFEB3B',
                                mb: 1,
                                fontWeight: 'bold',
                                fontSize: isMobile ? '0.9rem' : '1.1rem',
                              }}
                            >
                              {cardTitle}
                            </Typography>

                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                gap: 1,
                                mb: 2,
                                flexWrap: 'wrap',
                              }}
                            >
                              {isActive && (
                                <Chip
                                  label="ACTIVE"
                                  size="small"
                                  sx={{
                                    backgroundColor: '#00ffaa20',
                                    color: '#00ffaa',
                                    border: '1px solid #00ffaa50',
                                  }}
                                />
                              )}
                              {stats.anyLive && (
                                <Chip
                                  label="LIVE"
                                  size="small"
                                  sx={{ backgroundColor: '#4CAF5020', color: '#4CAF50' }}
                                />
                              )}
                              {currentRecord?.parent_order_id && (
                                <Chip
                                  label={`Parent: ${String(currentRecord.parent_order_id).slice(
                                    0,
                                    10
                                  )}…`}
                                  size="small"
                                  sx={{ backgroundColor: '#1a237e50', color: '#e0e0e0' }}
                                />
                              )}
                              {currentRecord?.buy_price && (
                                <Chip
                                  label={`Buy ₹${formatNumber(currentRecord.buy_price)}`}
                                  size="small"
                                  sx={{ backgroundColor: '#1a237e50', color: '#FFEB3B' }}
                                />
                              )}
                            </Box>

                            {/* Gauges */}
                            <Box>
                              <Grid container spacing={1}>
                                <Grid item xs={6}>
                                  <AdvancedTrailGauge
                                    value={stats.max}
                                    title="MAX P&L"
                                    size={isMobile ? 90 : 110}
                                    type="max"
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <AdvancedTrailGauge
                                    value={stats.min}
                                    title="MIN P&L"
                                    size={isMobile ? 90 : 110}
                                    type="min"
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <TrailStatusGauge
                                    current={stats.current}
                                    max={stats.max}
                                    min={stats.min}
                                    title="AVG P&L"
                                    size={isMobile ? 90 : 110}
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <AdvancedTrailGauge
                                    value={stats.current}
                                    title="CURRENT P&L"
                                    size={isMobile ? 90 : 110}
                                    type="current"
                                  />
                                </Grid>
                              </Grid>

                              {/* Price aggregates */}
                              {currentRecord &&
                                typeof currentRecord.min_current_price !== 'undefined' && (
                                  <Box sx={{ mt: 1 }}>
                                    <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                                      Price (₹): 
                                      <span style={{ color: '#FFFFFF' }}>min {formatNumber(currentRecord.min_current_price)}</span> ·
                                      <span style={{ color: '#FFFFFF' }}> avg {formatNumber(currentRecord.avg_current_price)}</span> · 
                                      <span style={{ color: '#FFFFFF' }}>max {formatNumber(currentRecord.max_current_price)}</span>
                                    </Typography>
                                  </Box>
                                )}

                              {/* Trail Status (now shows Max/Min Profit amounts) */}
                              {currentRecord && (
                                <Box
                                  sx={{
                                    mt: 2,
                                    p: 1.5,
                                    backgroundColor: '#00ffaa10',
                                    borderRadius: '8px',
                                    border: '1px solid #00ffaa30',
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: '#00ffaa',
                                      fontWeight: 'bold',
                                      display: 'block',
                                      mb: 1,
                                      textAlign: 'center',
                                      fontSize: '0.75rem',
                                    }}
                                  >
                                    {records.length === 1 ? 'Trail Status' : 'Latest Trail Status'}
                                  </Typography>

                                  <Grid container spacing={0.5} sx={{ fontSize: '0.7rem' }}>
                                    {records.length > 1 && (
                                      <>
                                        <Grid item xs={6}>
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              color: '#e0e0e0',
                                              display: 'block',
                                              lineHeight: 1.3,
                                            }}
                                          >
                                            <strong style={{ color: '#FFEB3B' }}>Trades:</strong>{' '}
                                            {records.length}
                                          </Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              color: '#e0e0e0',
                                              display: 'block',
                                              lineHeight: 1.3,
                                            }}
                                          >
                                            <strong style={{ color: '#4CAF50' }}>Total Qty:</strong>{' '}
                                            {records.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0)}
                                          </Typography>
                                        </Grid>
                                      </>
                                    )}
                                    <Grid item xs={6}>
                                      <Typography
                                        variant="caption"
                                        sx={{ color: '#e0e0e0', display: 'block', lineHeight: 1.3 }}
                                      >
                                        <strong style={{ color: '#FFEB3B' }}>Qty:</strong>{' '}
                                        {currentRecord.quantity}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                      <Typography
                                        variant="caption"
                                        sx={{ color: '#e0e0e0', display: 'block', lineHeight: 1.3 }}
                                      >
                                        <strong style={{ color: '#4CAF50' }}>Buy:</strong> ₹
                                        {formatNumber(currentRecord.buy_price)}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                      <Typography
                                        variant="caption"
                                        sx={{ color: '#e0e0e0', display: 'block', lineHeight: 1.3 }}
                                      >
                                        <strong style={{ color: '#FF9800' }}>Now:</strong> ₹
                                        {formatNumber(currentRecord.current_price)}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color:
                                            parseFloat(currentRecord.pnl_abs) >= 0
                                              ? '#4CAF50'
                                              : '#F44336',
                                          display: 'block',
                                          lineHeight: 1.3,
                                          fontWeight: 'bold',
                                        }}
                                      >
                                        {parseFloat(currentRecord.pnl_abs) >= 0 ? '+' : ''}₹
                                        {formatNumber(currentRecord.pnl_abs)}
                                      </Typography>
                                    </Grid>

                                    {/* NEW: Max/Min Profit amounts */}
                                    <Grid item xs={6}>
                                      <Typography
                                        variant="caption"
                                        sx={{ color: '#4CAF50', display: 'block', lineHeight: 1.3 }}
                                      >
                                        <strong>Max Profit:</strong> ₹
                                        {formatSigned(
                                          currentRecord.max_profit_abs ??
                                            deriveProfitAmounts(currentRecord).max_profit_abs
                                        )}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                      <Typography
                                        variant="caption"
                                        sx={{ color: '#F44336', display: 'block', lineHeight: 1.3 }}
                                      >
                                        <strong>Min Profit:</strong> ₹
                                        {formatSigned(
                                          currentRecord.min_profit_abs ??
                                            deriveProfitAmounts(currentRecord).min_profit_abs
                                        )}
                                      </Typography>
                                    </Grid>

                                    <Grid item xs={12}>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: '#e0e0e0',
                                          display: 'block',
                                          lineHeight: 1.3,
                                          textAlign: 'center',
                                        }}
                                      >
                                        <strong style={{ color: '#F44336' }}>Stop Loss:</strong>{' '}
                                        {currentRecord.stop_loss && currentRecord.buy_price ? (
                                          <>
                                            ₹{formatNumber(currentRecord.stop_loss)}{' '}
                                            <span style={{ 
                                              color: getStopLossPercentage(currentRecord.stop_loss, currentRecord.buy_price) > 0 
                                                ? '#4CAF50' 
                                                : getStopLossPercentage(currentRecord.stop_loss, currentRecord.buy_price) === 0 
                                                ? '#FFEB3B' 
                                                : '#F44336', 
                                              fontWeight: 'bold' 
                                            }}>
                                              {getStopLossPercentage(currentRecord.stop_loss, currentRecord.buy_price) < 0 && '⚠️ '}
                                              ({getStopLossPercentage(currentRecord.stop_loss, currentRecord.buy_price) > 0 ? '+' : ''}
                                              {formatNumber(getStopLossPercentage(currentRecord.stop_loss, currentRecord.buy_price))}%)
                                            </span>
                                          </>
                                        ) : (
                                          'None'
                                        )}
                                      </Typography>
                                    </Grid>
                                    <Grid
                                      item
                                      xs={12}
                                      sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid #00ffaa20' }}
                                    >
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: '#9E9E9E',
                                          display: 'block',
                                          fontSize: '0.65rem',
                                          textAlign: 'center',
                                        }}
                                      >
                                        Last Updated: {moment(currentRecord.date).format('HH:mm:ss')}
                                      </Typography>
                                    </Grid>
                                  </Grid>
                                </Box>
                              )}
                            </Box>
                          </CardContent>
                        </CardComp>
                      </Grid>
                    );
                  })}
                </Grid>
              </CardContent>
            </DateCard>
          );
        })}

        {/* Symbol Detail Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="lg"
          fullWidth
          fullScreen={isMobile}
          sx={{ '& .MuiDialog-paper': { background: '#070808', border: '2px solid rgba(0, 255, 170, 0.5)' } }}
        >
          <DialogTitle
            sx={{
              color: '#00ffaa',
              borderBottom: '2px solid rgba(0, 255, 170, 0.5)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexDirection: { xs: 'column', md: 'row' },
              gap: { xs: 2, md: 3 },
              p: 3
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" component="div" sx={{ mb: 0.5, wordBreak: 'break-word' }}>
                {selectedSymbol?.symbol} - {formatDate(selectedSymbol?.date)}
              </Typography>
              <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                P&L Trend Analysis{' '}
                {selectedSymbol?.parentKey
                  ? `(${String(selectedSymbol.parentKey).slice(0, 10)}…)`
                  : ''}
              </Typography>
            </Box>
            
            <Box sx={{ 
              display: 'flex', 
              gap: 2, 
              alignItems: 'center', 
              flexWrap: 'wrap',
              flexShrink: 0
            }}>
              <FormControl size="small" sx={{ minWidth: { xs: 100, sm: 120 } }}>
                <InputLabel sx={{ color: '#e0e0e0', fontSize: '0.875rem' }}>Time Range</InputLabel>
                <Select
                  value={timeRange}
                  onChange={(e) => {
                    setTimeRange(e.target.value);
                    if (selectedSymbol) {
                      const symbolRecords = Object.values(groupedData).flat().flat();
                      const relevantRecord = symbolRecords.find(record => 
                        record.tradingsymbol === selectedSymbol.symbol && 
                        parentKeyOf(record) === selectedSymbol.parentKey
                      );
                      const parentOrderId = relevantRecord?.parent_order_id || selectedSymbol.parentKey;
                      fetchChartData(parentOrderId);
                    }
                  }}
                  sx={{
                    color: '#e0e0e0',
                    fontSize: '0.875rem',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0, 255, 170, 0.5)' },
                    '& .MuiSvgIcon-root': { color: '#e0e0e0' }
                  }}
                >
                  <MenuItem value="all">All Time</MenuItem>
                  <MenuItem value="1hour">Last 1 Hour</MenuItem>
                  <MenuItem value="6hours">Last 6 Hours</MenuItem>
                  <MenuItem value="12hours">Last 12 Hours</MenuItem>
                  <MenuItem value="1day">Last 1 Day</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: { xs: 100, sm: 120 } }}>
                <InputLabel sx={{ color: '#e0e0e0', fontSize: '0.875rem' }}>Interval</InputLabel>
                <Select
                  value={aggregationInterval}
                  onChange={(e) => {
                    setAggregationInterval(e.target.value);
                    if (selectedSymbol) {
                      const symbolRecords = Object.values(groupedData).flat().flat();
                      const relevantRecord = symbolRecords.find(record => 
                        record.tradingsymbol === selectedSymbol.symbol && 
                        parentKeyOf(record) === selectedSymbol.parentKey
                      );
                      const parentOrderId = relevantRecord?.parent_order_id || selectedSymbol.parentKey;
                      fetchChartData(parentOrderId);
                    }
                  }}
                  sx={{
                    color: '#e0e0e0',
                    fontSize: '0.875rem',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0, 255, 170, 0.5)' },
                    '& .MuiSvgIcon-root': { color: '#e0e0e0' }
                  }}
                >
                  <MenuItem value="1min">1 Minute</MenuItem>
                  <MenuItem value="5min">5 Minutes</MenuItem>
                  <MenuItem value="15min">15 Minutes</MenuItem>
                  <MenuItem value="30min">30 Minutes</MenuItem>
                  <MenuItem value="1hour">1 Hour</MenuItem>
                </Select>
              </FormControl>
              
              <IconButton onClick={handleCloseDialog} sx={{ color: '#e0e0e0' }}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ p: 3, background: '#070808' }}>
            {chartLoading ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress sx={{ color: '#00ffaa' }} size={60} />
                <Typography variant="h6" sx={{ color: '#00ffaa', ml: 2 }}>
                  Loading Chart Data...
                </Typography>
              </Box>
            ) : chartData ? (
              <Box sx={{ height: '500px', width: '100%' }}>
                <Line
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                        labels: {
                          color: '#FFFFFF',
                          font: {
                            size: 13,
                            family: 'Roboto Mono, monospace',
                            weight: 'bold'
                          },
                          usePointStyle: false,
                          boxWidth: 12,
                          boxHeight: 12,
                          padding: 15
                        }
                      },
                      title: {
                        display: true,
                        text: `P&L Trend Analysis - ${selectedSymbol?.symbol || 'Symbol'} (${chartData?.labels?.length || 0} points)`,
                        color: '#00ffaa',
                        font: {
                          size: 18,
                          weight: 'bold',
                          family: 'Roboto Mono, monospace'
                        },
                        padding: 20
                      },
                      tooltip: {
                        backgroundColor: 'rgba(7, 8, 8, 0.95)',
                        titleColor: '#00ffaa',
                        bodyColor: '#FFFFFF',
                        borderColor: '#00ffaa',
                        borderWidth: 2,
                        cornerRadius: 10,
                        displayColors: true,
                        titleFont: {
                          size: 14,
                          weight: 'bold'
                        },
                        bodyFont: {
                          size: 13
                        },
                        callbacks: {
                          label: function(context) {
                            const value = Number(context.parsed.y);
                            const formattedValue = value.toFixed(2);
                            const sign = value >= 0 ? '+' : '';
                            return `${context.dataset.label}: ${sign}${formattedValue}%`;
                          }
                        }
                      }
                    },
                    interaction: {
                      intersect: false,
                      mode: 'index'
                    },
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: 'Time',
                          color: '#FFFFFF',
                          font: {
                            size: 14,
                            weight: 'bold',
                            family: 'Roboto Mono, monospace'
                          }
                        },
                        ticks: {
                          color: '#FFFFFF',
                          font: {
                            family: 'Roboto Mono, monospace'
                          },
                          maxTicksLimit: 10
                        },
                        grid: {
                          color: 'rgba(255, 255, 255, 0.1)',
                          borderColor: '#00ffaa'
                        }
                      },
                      y: {
                        title: {
                          display: true,
                          text: 'P&L Percentage (%)',
                          color: '#FFFFFF',
                          font: {
                            size: 14,
                            weight: 'bold',
                            family: 'Roboto Mono, monospace'
                          }
                        },
                        ticks: {
                          color: '#FFFFFF',
                          font: {
                            family: 'Roboto Mono, monospace',
                            weight: 'normal'
                          },
                          callback: function(value) {
                            const numValue = parseFloat(value);
                            const sign = numValue > 0 ? '+' : numValue < 0 ? '' : '±';
                            return `${sign}${numValue.toFixed(1)}%`;
                          }
                        },
                        grid: {
                          color: function(context) {
                            return context.tick.value === 0 ? '#00ffaa' : 'rgba(255, 255, 255, 0.1)';
                          },
                          lineWidth: function(context) {
                            return context.tick.value === 0 ? 3 : 1;
                          },
                          borderColor: '#00ffaa'
                        }
                      }
                    },
                    elements: {
                      point: {
                        radius: 4,
                        hoverRadius: 8,
                        borderWidth: 2,
                        backgroundColor: '#070808'
                      },
                      line: {
                        borderCapStyle: 'round',
                        borderJoinStyle: 'round'
                      }
                    },
                    animations: {
                      tension: {
                        duration: 1000,
                        easing: 'easeInOutQuart',
                        from: 0.1,
                        to: 0.4,
                        loop: false
                      }
                    }
                  }}
                />
              </Box>
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <Typography variant="h6" sx={{ color: '#9E9E9E' }}>
                  No chart data available for this symbol.
                </Typography>
              </Box>
            )}
          </DialogContent>
        </Dialog>
      </Container>
    </>
  );
};

export default TrailData;