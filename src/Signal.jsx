import React, { useState, useEffect } from 'react';
import {
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TableSortLabel,
  styled,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel
} from '@mui/material';
import { 
  Close as CloseIcon, 
  ArrowUpward, 
  ArrowDownward,
  Today as TodayIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import CustomAppBar from './CustomAppBar';
import { httpApi } from './api';
import moment from 'moment';
import 'moment-timezone';

// Utility function to convert any date to IST (Indian Standard Time)
const formatDateIST = (dateString, format = 'DD-MM-YY HH:mm') => {
  if (!dateString) return 'N/A';
  
  try {
    // Parse the date and convert to IST
    const istDate = moment.utc(dateString).tz('Asia/Kolkata');
    return istDate.format(format);
  } catch (error) {
    console.error('Error formatting date to IST:', error);
    return dateString;
  }
};

// Styled components
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 'bold',
  padding: '12px 16px',
  fontFamily: "'Roboto Mono', monospace",
  borderBottom: `1px solid ${theme.palette.divider}`,
  color: '#e0e0e0',
}));

const GradientHeader = styled(TableRow)(({ theme }) => ({
  background: 'linear-gradient(45deg, #1a5fb4 30%, #2a3f9e 90%)',
  borderBottom: '2px solid #00ffaa80',
}));

const HoverRow = styled(TableRow)(({ theme }) => ({
  '&:hover': {
    backgroundColor: '#1a237e30',
    transform: 'scale(1.002)',
    transition: 'all 0.1s ease-in-out',
    cursor: 'pointer',
  },
}));

const SignalDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    background: 'linear-gradient(135deg, #0a1929 0%, #1a237e 100%)',
    border: '1px solid #00ffaa30',
    boxShadow: '0 0 30px #00ffaa20',
    minWidth: '900px',
    maxWidth: '95vw',
  },
}));

const StockCard = styled(Card)(({ signal }) => ({
  background: signal === 'BUY' 
    ? 'linear-gradient(45deg, #1b5e20 30%, #2e7d32 90%)' 
    : signal === 'SELL' 
    ? 'linear-gradient(45deg, #b71c1c 30%, #d32f2f 90%)'
    : 'linear-gradient(45deg, #424242 30%, #616161 90%)',
  border: `1px solid ${signal === 'BUY' ? '#4CAF50' : signal === 'SELL' ? '#F44336' : '#9E9E9E'}30`,
  boxShadow: `0 0 10px ${signal === 'BUY' ? '#4CAF50' : signal === 'SELL' ? '#F44336' : '#9E9E9E'}20`,
  marginBottom: '12px',
}));

const SignalIndicator = styled('span')(({ signal }) => ({
  color: signal === 'Buy' ? '#4CAF50' : 
         signal === 'Sell' ? '#F44336' : 
         signal === 'NoTrade' ? '#9E9E9E' : '#FFEB3B',
  filter: 'drop-shadow(0 0 2px currentColor)',
  fontSize: '1.2rem',
}));

const PulseDot = styled('div')({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  animation: 'pulse 1.5s infinite',
  marginRight: '8px',
  '@keyframes pulse': {
    '0%': { boxShadow: '0 0 0 0 rgba(0, 255, 170, 0.7)' },
    '70%': { boxShadow: '0 0 0 6px rgba(0, 255, 170, 0)' },
    '100%': { boxShadow: '0 0 0 0 rgba(0, 255, 170, 0)' },
  },
});

const TrafficLight = styled('div', { shouldForwardProp: (prop) => prop !== 'sideways' })(({ sideways }) => ({
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  backgroundColor: sideways === 'True' ? '#F44336' : '#4CAF50', // Red for sideways, Green for momentum
  filter: 'drop-shadow(0 0 2px currentColor)',
  margin: '0 auto',
  animation: sideways === 'False' ? 'pulse 1.5s infinite' : 'none',
  '@keyframes pulse': {
    '0%': { boxShadow: '0 0 0 0 rgba(76, 175, 80, 0.7)' },
    '70%': { boxShadow: '0 0 0 6px rgba(76, 175, 80, 0)' },
    '100%': { boxShadow: '0 0 0 0 rgba(76, 175, 80, 0)' },
  },
}));

const formatNumber = (value) => {
  const num = Number(value);
  return isNaN(num) ? value : num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Normalize sideways value from API (handles booleans, numbers, and strings)
const normalizeSideways = (v) => {
  return v === true || v === 'True' || v === 'true' || v === 1 || v === '1';
};

// Utility function to handle timezone conversion consistently
const parseAndFormatDate = (dateString, format = 'DD-MMM-YY HH:mm') => {
  return formatDateIST(dateString, format) + ' IST';
};

// Helper: robust UTC parser for API dates (handles RFC1123 and ISO strings)
const parseApiDateUtc = (s) => {
  if (!s) return null;
  try {
    if (typeof s === 'string' && s.includes('GMT')) {
      const m = moment.utc(s, 'ddd, DD MMM YYYY HH:mm:ss [GMT]', true);
      return m.isValid() ? m : moment.utc(s);
    }
    const m = moment.utc(s);
    return m.isValid() ? m : null;
  } catch (e) {
    console.warn('Failed to parse API date:', s, e);
    return null;
  }
};

// NIFTY50 stock weights for sorting
const NIFTY50_WEIGHTS = {
  'reliance': 9.62,
  'hdfcbank': 7.75,
  'bhartiartl': 5.85,
  'tcs': 5.75,
  'icicibank': 5.30,
  'sbin': 3.79,
  'infy': 3.28,
  'bajfinance': 2.98,
  'hindunilvr': 2.93,
  'itc': 2.62,
};

const getPriceIndicator = (currentValue, comparisonValue) => {
  const current = Number(currentValue);
  const comparison = Number(comparisonValue);
  
  if (isNaN(current) || isNaN(comparison)) return <span>N/A</span>;

  const diff = current - comparison;
  let color = '#bdbdbd';
  let indicator = '━';

  if (diff > 0) {
    color = '#4CAF50';
    indicator = '▲';
  } else if (diff < 0) {
    color = '#F44336';
    indicator = '▼';
  }

  return (
    <span style={{ color }}>
      {formatNumber(current)} {indicator}
    </span>
  );
};

// Utility: safe number + intraday helpers
const toNum = (v) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const intradayChange = (open, close) => toNum(close) - toNum(open);
const intradayPercent = (open, close) => {
  const o = toNum(open);
  if (!o) return 0;
  return ((toNum(close) - o) / o) * 100;
};
// Helper to get a finite number or null (used for API fields that might be missing)
const finiteNumberOrNull = (v) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

// Build stock rows from a wide-bars snapshot record for dialog
const getStockRowsFromDetail = (detailRow) => {
  if (!detailRow) return [];

  return Object.keys(detailRow)
    .filter((key) => key.endsWith('_signal') && !key.includes('weighted'))
    .map((signalKey) => {
      const stockKey = signalKey.replace('_signal', '');
      const open = detailRow[`${stockKey}_open`] || 0;
      const close = detailRow[`${stockKey}_close`] || 0;
      const high = detailRow[`${stockKey}_high`] || 0;
      const low = detailRow[`${stockKey}_low`] || 0;
      const volume = detailRow[`${stockKey}_volume`] || 0;
      const signalValue = detailRow[signalKey];

      const weight = NIFTY50_WEIGHTS[stockKey.toLowerCase()] || 0;
      const change = toNum(close) - toNum(open);
      const changePercent = intradayPercent(open, close);

      return {
        stockName: stockKey,
        signal: signalValue,
        open,
        high,
        low,
        close,
        volume,
        weight,
        change,
        changePercent,
      };
    });
};

const Signal = () => {
  const [tradeSignals, setTradeSignals] = useState([]);
  const [orderBy, setOrderBy] = useState('date');
  const [orderDirection, setOrderDirection] = useState('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [stockOrderBy, setStockOrderBy] = useState('weight');
  const [stockOrderDirection, setStockOrderDirection] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // New states for enhanced functionality
  const [viewMode, setViewMode] = useState('current'); // 'current', 'historical', 'dateRange'
  const [selectedDate, setSelectedDate] = useState(moment().tz('Asia/Kolkata').format('YYYY-MM-DD'));
  const [dateRange, setDateRange] = useState({
    start: moment().tz('Asia/Kolkata').subtract(7, 'days').format('YYYY-MM-DD'),
    end: moment().tz('Asia/Kolkata').format('YYYY-MM-DD')
  });
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDetailData = async (signal) => {
    setLoadingDetail(true);
    try {
      // Instead of calling the problematic trade-signals/range API,
      // use the working wide-bars-snapshot API to get the same date's data
      if (!signal || !signal.date) {
        throw new Error('Invalid signal data');
      }
      
      // Parse the date from the signal
      let signalDate;
      if (signal.date.includes('GMT')) {
        signalDate = moment.utc(signal.date, 'ddd, DD MMM YYYY HH:mm:ss [GMT]');
      } else {
        signalDate = moment.utc(signal.date);
      }
      
      if (!signalDate.isValid()) {
        console.error('Invalid date format:', signal.date);
        throw new Error('Invalid date format');
      }
      
      // Format date for the by-date API (YYYY-MM-DD format)
      const dateString = signalDate.format('YYYY-MM-DD');
      
      console.log('Fetching detail data for date:', dateString, 'Original signal date:', signal.date);
      
      // Use the working wide-bars-snapshot/by-date API instead
      const response = await httpApi.get(`wide-bars-snapshot/by-date?date=${dateString}`);
      
      // Transform the response to match the expected format
      if (response.data && response.data.data) {
        setDetailData({
          data: response.data.data
        });
        console.log('Detail data from wide-bars-snapshot:', response.data);
      } else {
        setDetailData({ data: [] });
      }
    } catch (error) {
      console.error('Error fetching detail data:', error);
      setDetailData(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchWideBarSignals = async () => {
    try {
      setLoading(true);
      setError(null);
      let response;
      
      switch (viewMode) {
        case 'current':
          // Fetch current date data
          response = await httpApi.get('/wide-bars-snapshot/current-date');
          break;
          
        case 'historical':
          // Fetch specific date data
          response = await httpApi.get(`/wide-bars-snapshot/by-date?date=${selectedDate}`);
          break;
          
        case 'dateRange':
          // Fetch date range data
          response = await httpApi.get(`/wide-bars-snapshot/date-range?start_date=${dateRange.start}&end_date=${dateRange.end}`);
          break;
          
        default:
          response = await httpApi.get('/wide-bars-snapshot/current-date');
      }
      
      const data = response.data.data || [];
      console.log('Wide bars data:', data);
      
      // Process the data if needed (similar to the old format)
      const processedData = data.map((entry, i, arr) => ({
        ...entry,
        // Add any additional processing if needed
      }));

      setTradeSignals(processedData);
    } catch (err) {
      console.error('Error fetching wide bar signals:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentDateData = async () => {
    try {
      setRefreshing(true);
      const response = await httpApi.get('/wide-bars-snapshot/current-date');
      const currentData = response.data.data || [];
      
      if (currentData.length > 0) {
        setTradeSignals(currentData);
      }
    } catch (err) {
      console.error('Error fetching current date data:', err);
      // Don't show error for background refresh, just log it
    } finally {
      setRefreshing(false);
    }
  };

  const handleRowClick = (signal) => {
    setSelectedSignal(signal);
    setDialogOpen(true);
    fetchDetailData(signal);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedSignal(null);
    setDetailData(null);
    setStockOrderBy('weight');
    setStockOrderDirection('desc');
  };

  const handleStockSort = (property) => {
    const isAsc = stockOrderBy === property && stockOrderDirection === 'asc';
    setStockOrderBy(property);
    setStockOrderDirection(isAsc ? 'desc' : 'asc');
  };

const fetchTradeSignals = async () => {
  console.warn('fetchTradeSignals is deprecated, use fetchWideBarSignals instead');
  // Keep for backward compatibility, but redirect to new function
  return fetchWideBarSignals();
};

  useEffect(() => {
    fetchWideBarSignals();
  }, [viewMode, selectedDate, dateRange]);

  // Set up live refresh for current date data only when live updates are enabled
  useEffect(() => {
    if (viewMode === 'current' && liveUpdates) {
      const refreshInterval = setInterval(() => {
        fetchCurrentDateData();
      }, 30000); // Refresh every 30 seconds for signals

      return () => clearInterval(refreshInterval);
    }
  }, [viewMode, liveUpdates]);

  const handleViewModeChange = (newMode) => {
    setViewMode(newMode);
    setLiveUpdates(newMode === 'current'); // Enable live updates only for current mode
  };

  const handleRefreshData = () => {
    fetchWideBarSignals();
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && orderDirection === 'asc';
    setOrderBy(property);
    setOrderDirection(isAsc ? 'desc' : 'asc');
  };

  const sortedData = [...tradeSignals].sort((a, b) => {
    if (orderBy === 'date') {
      // Parse dates for sorting using IST timezone
      const parseDate = (dateStr) => {
        try {
          return moment.utc(dateStr).tz('Asia/Kolkata');
        } catch (error) {
          console.error('Error parsing date for sorting:', error);
          return moment(0); // Return epoch if parsing fails
        }
      };
      
      const aParsed = parseDate(a.date);
      const bParsed = parseDate(b.date);
      
      if (!aParsed || !bParsed) {
        return 0;
      }
      
      // First sort by date (most recent date first)
      const aDate = aParsed.format('YYYY-MM-DD');
      const bDate = bParsed.format('YYYY-MM-DD');
      
      if (aDate !== bDate) {
        // Different dates - most recent date first
        return orderDirection === 'desc' ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
      } else {
        // Same date - latest time first within the date
        const aTime = aParsed.valueOf();
        const bTime = bParsed.valueOf();
        return orderDirection === 'desc' ? bTime - aTime : aTime - bTime;
      }
    } else if (orderBy === 'symbol') {
      // Sort by symbol alphabetically
      const aSymbol = (a.symbol || a.tradingsymbol || '').toString();
      const bSymbol = (b.symbol || b.tradingsymbol || '').toString();
      return orderDirection === 'asc' ? aSymbol.localeCompare(bSymbol) : bSymbol.localeCompare(aSymbol);
    } else if (orderBy === 'signal' || orderBy === 'weighted_signal') {
      // Sort by weighted signal type: BUY > SELL > HOLD
      const signalOrder = { 'BUY': 3, 'Buy': 3, 'SELL': 2, 'Sell': 2, 'HOLD': 1, 'NoTrade': 1 };
      const aSignal = a.weighted_signal || a.signal || '';
      const bSignal = b.weighted_signal || b.signal || '';
      const aVal = signalOrder[aSignal] || 0;
      const bVal = signalOrder[bSignal] || 0;
      return orderDirection === 'asc' ? aVal - bVal : bVal - aVal;
    } else if (orderBy === 'final_signal') {
      // Sort by final signal type: BUY > SELL > HOLD
      const signalOrder = { 'BUY': 3, 'Buy': 3, 'SELL': 2, 'Sell': 2, 'HOLD': 1, 'NoTrade': 1 };
      const aSignal = a.final_signal || '';
      const bSignal = b.final_signal || '';
      const aVal = signalOrder[aSignal] || 0;
      const bVal = signalOrder[bSignal] || 0;
      return orderDirection === 'asc' ? aVal - bVal : bVal - aVal;
    } else if (orderBy === 'sideways') {
      // False (momentum) comes before True (sideways) when ascending
      const aVal = a.nifty_sideways ? 1 : 0;
      const bVal = b.nifty_sideways ? 1 : 0;
      return orderDirection === 'asc' ? aVal - bVal : bVal - aVal;
    } else {
      // Handle numeric fields with fallback for old field names
      let aVal, bVal;
      
      switch(orderBy) {
        case 'open':
          aVal = Number(a.open || a.current_open || 0);
          bVal = Number(b.open || b.current_open || 0);
          break;
        case 'high':
          aVal = Number(a.high || a.current_high || 0);
          bVal = Number(b.high || b.current_high || 0);
          break;
        case 'low':
          aVal = Number(a.low || a.current_low || 0);
          bVal = Number(b.low || b.current_low || 0);
          break;
        case 'close':
          aVal = Number(a.close || a.current_close || 0);
          bVal = Number(b.close || b.current_close || 0);
          break;
        case 'volume':
          aVal = Number(a.volume || 0);
          bVal = Number(b.volume || 0);
          break;
        case 'profit':
          aVal = Number(a.profit || a.gained_points || 0);
          bVal = Number(b.profit || b.gained_points || 0);
          break;
        default:
          aVal = Number(a[orderBy] || 0);
          bVal = Number(b[orderBy] || 0);
      }
      
      return orderDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
  });

  const getSignalDisplay = (signalValue) => {
    let displayText = signalValue;
    let dotColor = '#FFEB3B'; // Default yellow for NoTrade
    let shouldPulse = false;

    switch(signalValue) {
      case 'Buy':
      case 'BUY':
        displayText = 'BUY';
        dotColor = '#4CAF50';
        shouldPulse = true;
        break;
      case 'Sell':
      case 'SELL':
        displayText = 'SELL';
        dotColor = '#F44336';
        shouldPulse = true;
        break;
      case 'NoTrade':
      case 'HOLD':
        displayText = 'HOLD';
        dotColor = '#9E9E9E';
        shouldPulse = false;
        break;
      default:
        displayText = signalValue || 'N/A';
        break;
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <PulseDot style={{ 
          backgroundColor: dotColor,
          animationPlayState: shouldPulse ? 'running' : 'paused'
        }}/>
        <SignalIndicator signal={signalValue}>
          {displayText}
        </SignalIndicator>
      </div>
    );
  };

  // Select the detail row closest to the clicked signal's timestamp
  const matchedDetailRow = React.useMemo(() => {
    const rows = detailData?.data || [];
    if (!rows.length || !selectedSignal?.date) return null;

    const target = parseApiDateUtc(selectedSignal.date);
    if (!target) return rows[0] || null;

    // Find exact match, else closest by absolute time difference
    let best = rows[0];
    let bestDiff = Math.abs(parseApiDateUtc(rows[0].date)?.diff(target) ?? Number.MAX_SAFE_INTEGER);

    for (let i = 1; i < rows.length; i++) {
      const d = parseApiDateUtc(rows[i].date);
      if (!d) continue;
      const diff = Math.abs(d.diff(target));
      if (diff < bestDiff) {
        best = rows[i];
        bestDiff = diff;
      }
    }

    // Prefer the last snapshot at or before the target time if there are ties
    const candidates = rows
      .map(r => ({ r, m: parseApiDateUtc(r.date) }))
      .filter(x => x.m)
      .sort((a, b) => a.m.valueOf() - b.m.valueOf());
    const atOrBefore = candidates.filter(x => x.m.isSameOrBefore(target));
    if (atOrBefore.length) return atOrBefore[atOrBefore.length - 1].r;

    return best;
  }, [detailData, selectedSignal]);

  // Stock rows based on the matched detail row
  const stockRows = React.useMemo(() => getStockRowsFromDetail(matchedDetailRow), [matchedDetailRow]);

  if (loading) {
    return (
      <>
        <CustomAppBar />
        <Box 
          display="flex" 
          justifyContent="center" 
          alignItems="center" 
          minHeight="100vh"
          sx={{ backgroundColor: '#0a1929' }}
        >
          <CircularProgress sx={{ color: '#00ffaa' }} />
          <Typography sx={{ color: '#e0e0e0', ml: 2 }}>Loading signal data...</Typography>
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

  // Derive NIFTY intraday values for summary cards (inside component)
  const apiDelta = finiteNumberOrNull(matchedDetailRow?.current_close_delta_since_open);
  const apiPct = finiteNumberOrNull(matchedDetailRow?.current_close_pct_since_open);
  const fallbackChange = matchedDetailRow
    ? intradayChange(matchedDetailRow.current_open, matchedDetailRow.current_close)
    : 0;
  const fallbackPct = matchedDetailRow
    ? intradayPercent(matchedDetailRow.current_open, matchedDetailRow.current_close)
    : 0;
  const niftyIntradayChange = apiDelta ?? fallbackChange;
  const niftyIntradayPercent = apiPct ?? fallbackPct;

  return (
    <>
      <CustomAppBar />
      <Container maxWidth="xl" sx={{
        borderRadius: '8px',
        border: '1px solid #00ffaa30',
        boxShadow: '0 0 20px #00ffaa20',
        background: '#0a1929',
        mt: 1,
        minHeight: '100vh',
        pb: 2
      }}>
        <Typography 
          variant="h4" 
          sx={{ 
            color: '#00ffaa', 
            textAlign: 'center', 
            py: 3,
            fontWeight: 'bold'
          }}
        >
          Wide Bars Signal Analytics
        </Typography>

        {/* Control Panel */}
        <Card sx={{ 
          mb: 3, 
          background: 'linear-gradient(135deg, #2a3f9e 0%, #1a5fb4 100%)',
          border: '1px solid #00ffaa30'
        }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ color: '#e0e0e0' }}>View Mode</InputLabel>
                  <Select
                    value={viewMode}
                    onChange={(e) => handleViewModeChange(e.target.value)}
                    sx={{ 
                      color: '#e0e0e0',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#00ffaa30',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#00ffaa60',
                      },
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
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
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
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
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

              <Grid item xs={12} md={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={liveUpdates}
                      onChange={(e) => setLiveUpdates(e.target.checked)}
                      disabled={viewMode !== 'current'}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#00ffaa',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#00ffaa',
                        },
                      }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                      Live Updates
                    </Typography>
                  }
                />
              </Grid>

              <Grid item xs={12} md={2}>
                <Button
                  variant="outlined"
                  onClick={handleRefreshData}
                  startIcon={<RefreshIcon />}
                  sx={{
                    color: '#00ffaa',
                    borderColor: '#00ffaa',
                    '&:hover': {
                      borderColor: '#00ffaa',
                      backgroundColor: '#00ffaa20',
                    },
                  }}
                  fullWidth
                >
                  Refresh
                </Button>
              </Grid>
            </Grid>

            {/* Status Information */}
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Chip
                icon={viewMode === 'current' ? <TodayIcon /> : <HistoryIcon />}
                label={`Mode: ${viewMode === 'current' ? 'Live Current Date' : 
                              viewMode === 'historical' ? `Date: ${formatDateIST(selectedDate, 'DD-MM-YYYY')}` :
                              `Range: ${formatDateIST(dateRange.start, 'DD-MM-YYYY')} - ${formatDateIST(dateRange.end, 'DD-MM-YYYY')}`}`}
                sx={{
                  backgroundColor: viewMode === 'current' ? '#4CAF5030' : '#FF980030',
                  color: viewMode === 'current' ? '#4CAF50' : '#FF9800',
                  border: `1px solid ${viewMode === 'current' ? '#4CAF50' : '#FF9800'}30`,
                }}
              />
              
              {liveUpdates && viewMode === 'current' && (
                <Chip
                  label={refreshing ? "Refreshing..." : "Live (30s refresh)"}
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
              
              <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                Total Records: {tradeSignals.length}
              </Typography>
            </Box>
          </CardContent>
        </Card>
        <TableContainer 
          component={Paper}
          sx={{
            background: '#0a1929',
            border: '1px solid #00ffaa30',
          }}
        >
          <Table stickyHeader sx={{ minWidth: 1000 }}>
            <TableHead>
              <GradientHeader>
                {[
                  { label: 'Date', prop: 'date', width: '160px' },
                  // Removed Symbol column
                  { label: 'Open', prop: 'open', align: 'right' },
                  { label: 'High', prop: 'high', align: 'right' },
                  { label: 'Low', prop: 'low', align: 'right' },
                  { label: 'Close', prop: 'close', align: 'right' },
                  { label: 'Signal', prop: 'weighted_signal', align: 'center' },
                  { label: 'Final Signal', prop: 'final_signal', align: 'center' },
                  { label: 'Sideways', prop: 'sideways', align: 'center' },
                  { label: 'Profit', prop: 'profit', align: 'right' },
                ].map((head) => (
                  <StyledTableCell
                    key={head.label}
                    align={head.align || 'left'}
                  >
                    <TableSortLabel
                      active={orderBy === head.prop}
                      direction={orderDirection}
                      onClick={() => handleSort(head.prop)}
                    >
                      {head.label}
                    </TableSortLabel>
                  </StyledTableCell>
                ))}
              </GradientHeader>
            </TableHead>
            <TableBody>
              {sortedData.map((signal, index) => (
                <HoverRow key={index} onClick={() => handleRowClick(signal)}>
                  <StyledTableCell sx={{ color: '#00ffaa' }}>
                    {parseAndFormatDate(signal.date)}
                  </StyledTableCell>

                  {/* Removed Symbol cell */}

                  <StyledTableCell align="right" sx={{ color: '#FFEB3B' }}>
                    ₹{formatNumber(signal.open || signal.current_open)}
                  </StyledTableCell>

                  <StyledTableCell align="right" sx={{ color: '#4CAF50' }}>
                    ₹{formatNumber(signal.high || signal.current_high)}
                  </StyledTableCell>

                  <StyledTableCell align="right" sx={{ color: '#F44336' }}>
                    ₹{formatNumber(signal.low || signal.current_low)}
                  </StyledTableCell>

                  <StyledTableCell align="right" sx={{ color: '#00ffaa' }}>
                    ₹{formatNumber(signal.close || signal.current_close)}
                  </StyledTableCell>

                  {/* Weighted Signal */}
                  <StyledTableCell align="center">
                    {getSignalDisplay(signal.weighted_signal)}
                  </StyledTableCell>

                  {/* Final Signal */}
                  <StyledTableCell align="center">
                    {getSignalDisplay(signal.final_signal)}
                  </StyledTableCell>

                  {/* Sideways Indicator based on nifty_sideways */}
                  <StyledTableCell align="center">
                    <TrafficLight sideways={normalizeSideways(signal.nifty_sideways) ? 'True' : 'False'} />
                  </StyledTableCell>

                  <StyledTableCell align="right" sx={{ 
                    color: (signal.profit || signal.gained_points || 0) >= 0 ? '#4CAF50' : '#F44336',
                    fontWeight: 900 
                  }}>
                    ₹{formatNumber(signal.profit || signal.gained_points || 0)}
                  </StyledTableCell>
                </HoverRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Signal Details Dialog */}
        <SignalDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle sx={{ 
            color: '#00ffaa', 
            borderBottom: '1px solid #00ffaa30',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Typography variant="h5">
              Signal Breakdown - {selectedSignal ? parseAndFormatDate(selectedSignal.date, 'DD MMM YYYY HH:mm') : ''}
            </Typography>
            <IconButton onClick={handleDialogClose} sx={{ color: '#e0e0e0' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent sx={{ padding: '20px', minHeight: '500px' }}>
            {loadingDetail ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                <CircularProgress sx={{ color: '#00ffaa' }} />
                <Typography sx={{ color: '#e0e0e0', ml: 2 }}>Loading detailed signal data...</Typography>
              </Box>
            ) : detailData && (detailData.data?.length > 0) ? (
              <>
                {/* Overall Signal Summary */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={2}>
                    <Card sx={{ background: 'linear-gradient(45deg, #1a237e 30%, #0d47a1 90%)', border: '1px solid #00ffaa30' }}>
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="h6" sx={{ color: '#e0e0e0' }}>Overall Signal</Typography>
                        <Chip 
                          label={(matchedDetailRow?.weighted_signal) || 'N/A'} 
                          sx={{ 
                            backgroundColor: (matchedDetailRow?.weighted_signal) === 'Buy' ? '#4CAF5030' : 
                                           (matchedDetailRow?.weighted_signal) === 'Sell' ? '#F4433630' : '#9E9E9E30',
                            color: (matchedDetailRow?.weighted_signal) === 'Buy' ? '#4CAF50' : 
                                   (matchedDetailRow?.weighted_signal) === 'Sell' ? '#F44336' : '#9E9E9E',
                            fontWeight: 'bold',
                            fontSize: '1.1rem'
                          }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={2}>
                    <Card sx={{ background: 'linear-gradient(45deg, #1a237e 30%, #0d47a1 90%)', border: '1px solid #00ffaa30' }}>
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="h6" sx={{ color: '#e0e0e0' }}>NIFTY Open</Typography>
                        <Typography variant="h4" sx={{ color: '#00ffaa' }}>
                          {formatNumber(matchedDetailRow?.current_open)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={2}>
                    <Card sx={{ background: 'linear-gradient(45deg, #1a237e 30%, #0d47a1 90%)', border: '1px solid #00ffaa30' }}>
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="h6" sx={{ color: '#e0e0e0' }}>NIFTY Close</Typography>
                        <Typography variant="h4" sx={{ color: '#FFEB3B' }}>
                          {formatNumber(matchedDetailRow?.current_close)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={2}>
                    <Card sx={{ background: 'linear-gradient(45deg, #1a237e 30%, #0d47a1 90%)', border: '1px solid #00ffaa30' }}>
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="h6" sx={{ color: '#e0e0e0' }}>Intraday Change</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                          {niftyIntradayChange > 0 && <ArrowUpward sx={{ color: '#4CAF50', fontSize: 20 }} />}
                          {niftyIntradayChange < 0 && <ArrowDownward sx={{ color: '#F44336', fontSize: 20 }} />}
                          <Typography variant="h4" sx={{ 
                            color: niftyIntradayChange > 0 ? '#4CAF50' : niftyIntradayChange < 0 ? '#F44336' : '#9E9E9E',
                            fontWeight: 'bold'
                          }}>
                            {Math.abs(niftyIntradayChange).toFixed(2)}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={2}>
                    <Card sx={{ background: 'linear-gradient(45deg, #1a237e 30%, #0d47a1 90%)', border: '1px solid #00ffaa30' }}>
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="h6" sx={{ color: '#e0e0e0' }}>Intraday %</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                          {niftyIntradayPercent > 0 && <ArrowUpward sx={{ color: '#4CAF50', fontSize: 20 }} />}
                          {niftyIntradayPercent < 0 && <ArrowDownward sx={{ color: '#F44336', fontSize: 20 }} />}
                          <Typography variant="h4" sx={{ 
                            color: niftyIntradayPercent > 0 ? '#4CAF50' : niftyIntradayPercent < 0 ? '#F44336' : '#9E9E9E',
                            fontWeight: 'bold'
                          }}>
                            {Math.abs(niftyIntradayPercent).toFixed(2)}%
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={2}>
                    <Card sx={{ background: 'linear-gradient(45deg, #1a237e 30%, #0d47a1 90%)', border: '1px solid #00ffaa30' }}>
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="h6" sx={{ color: '#e0e0e0' }}>Points Gained</Typography>
                        <Typography variant="h4" sx={{ 
                          color: (matchedDetailRow?.gained_points || 0) > 0 ? '#4CAF50' : '#F44336' 
                        }}>
                          {formatNumber(matchedDetailRow?.gained_points)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Individual Stock Signals */}
                <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2 }}>Individual Stock Signals</Typography>
                <Box sx={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <TableContainer component={Paper} sx={{ 
                    background: '#0a1929',
                    border: '1px solid #00ffaa30',
                    borderRadius: '8px'
                  }}>
                    <Table stickyHeader sx={{ minWidth: 750 }}>
                      <TableHead>
                        <TableRow sx={{ background: 'linear-gradient(45deg, #1a5fb4 30%, #2a3f9e 90%)' }}>
                          <StyledTableCell>
                            <TableSortLabel
                              active={stockOrderBy === 'stock'}
                              direction={stockOrderDirection}
                              onClick={() => handleStockSort('stock')}
                              sx={{ color: '#e0e0e0' }}
                            >
                              Stock
                            </TableSortLabel>
                          </StyledTableCell>
                          <StyledTableCell align="center">
                            <TableSortLabel
                              active={stockOrderBy === 'weight'}
                              direction={stockOrderDirection}
                              onClick={() => handleStockSort('weight')}
                              sx={{ color: '#e0e0e0' }}
                            >
                              Weight %
                            </TableSortLabel>
                          </StyledTableCell>
                          <StyledTableCell align="center">
                            <TableSortLabel
                              active={stockOrderBy === 'signal'}
                              direction={stockOrderDirection}
                              onClick={() => handleStockSort('signal')}
                              sx={{ color: '#e0e0e0' }}
                            >
                              Signal
                            </TableSortLabel>
                          </StyledTableCell>
                          <StyledTableCell align="right">
                            <TableSortLabel
                              active={stockOrderBy === 'open'}
                              direction={stockOrderDirection}
                              onClick={() => handleStockSort('open')}
                              sx={{ color: '#e0e0e0' }}
                            >
                              Open
                            </TableSortLabel>
                          </StyledTableCell>
                          <StyledTableCell align="right">
                            <TableSortLabel
                              active={stockOrderBy === 'high'}
                              direction={stockOrderDirection}
                              onClick={() => handleStockSort('high')}
                              sx={{ color: '#e0e0e0' }}
                            >
                              High
                            </TableSortLabel>
                          </StyledTableCell>
                          <StyledTableCell align="right">
                            <TableSortLabel
                              active={stockOrderBy === 'low'}
                              direction={stockOrderDirection}
                              onClick={() => handleStockSort('low')}
                              sx={{ color: '#e0e0e0' }}
                            >
                              Low
                            </TableSortLabel>
                          </StyledTableCell>
                          <StyledTableCell align="right">
                            <TableSortLabel
                              active={stockOrderBy === 'close'}
                              direction={stockOrderDirection}
                              onClick={() => handleStockSort('close')}
                              sx={{ color: '#e0e0e0' }}
                            >
                              Close
                            </TableSortLabel>
                          </StyledTableCell>
                          <StyledTableCell align="right">
                            <TableSortLabel
                              active={stockOrderBy === 'volume'}
                              direction={stockOrderDirection}
                              onClick={() => handleStockSort('volume')}
                              sx={{ color: '#e0e0e0' }}
                            >
                              Volume
                            </TableSortLabel>
                          </StyledTableCell>
                          <StyledTableCell align="right">
                            <TableSortLabel
                              active={stockOrderBy === 'change'}
                              direction={stockOrderDirection}
                              onClick={() => handleStockSort('change')}
                              sx={{ color: '#e0e0e0' }}
                            >
                              Intraday Change
                            </TableSortLabel>
                          </StyledTableCell>
                          <StyledTableCell align="right">
                            <TableSortLabel
                              active={stockOrderBy === 'changePercent'}
                              direction={stockOrderDirection}
                              onClick={() => handleStockSort('changePercent')}
                              sx={{ color: '#e0e0e0' }}
                            >
                              Intraday %
                            </TableSortLabel>
                          </StyledTableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {stockRows
                          .sort((a, b) => {
                            let aVal, bVal;

                            switch (stockOrderBy) {
                              case 'stock': {
                                const aName = (a.stockName || a.stock || '').toString();
                                const bName = (b.stockName || b.stock || '').toString();
                                return stockOrderDirection === 'asc'
                                  ? aName.localeCompare(bName)
                                  : bName.localeCompare(aName);
                              }

                              case 'weight':
                                aVal = toNum(a.weight);
                                bVal = toNum(b.weight);
                                break;

                              case 'signal': {
                                const order = { BUY: 3, SELL: 2, HOLD: 1, NoTrade: 1 };
                                aVal = order[a.signal] || 0;
                                bVal = order[b.signal] || 0;
                                break;
                              }

                              default:
                                aVal = toNum(a[stockOrderBy]);
                                bVal = toNum(b[stockOrderBy]);
                            }
                            return stockOrderDirection === 'asc' ? aVal - bVal : bVal - aVal;
                          })
                          .map((stockData) => (
                            <HoverRow key={(stockData.stockName || stockData.stock || '')}>
                              <StyledTableCell sx={{ color: '#00ffaa', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                {((stockData.stockName || stockData.stock || '')
                                  .replace(/([A-Z])/g, ' $1')
                                  .trim()) || 'N/A'}
                              </StyledTableCell>
                              <StyledTableCell align="center" sx={{ color: '#FFEB3B', fontWeight: 'bold' }}>
                                {toNum(stockData.weight).toFixed(2)}%
                              </StyledTableCell>
                              <StyledTableCell align="center">
                                <Chip 
                                  label={stockData.signal || 'N/A'} 
                                  size="small"
                                  sx={{ 
                                    // Normalize signal for coloring
                                    ...( (() => { const s = (stockData.signal || '').toString().toUpperCase(); return {
                                      backgroundColor: s === 'BUY' ? '#4CAF5030' : s === 'SELL' ? '#F4433630' : '#9E9E9E30',
                                      color: s === 'BUY' ? '#4CAF50' : s === 'SELL' ? '#F44336' : '#9E9E9E',
                                    }; })() ),
                                    fontWeight: 'bold'
                                  }}
                                />
                              </StyledTableCell>
                              <StyledTableCell align="right" sx={{ color: '#FFEB3B' }}>
                                ₹{toNum(stockData.open).toFixed(2)}
                              </StyledTableCell>
                              <StyledTableCell align="right" sx={{ color: '#4CAF50' }}>
                                ₹{toNum(stockData.high).toFixed(2)}
                              </StyledTableCell>
                              <StyledTableCell align="right" sx={{ color: '#F44336' }}>
                                ₹{toNum(stockData.low).toFixed(2)}
                              </StyledTableCell>
                              <StyledTableCell align="right" sx={{ color: '#00ffaa' }}>
                                ₹{toNum(stockData.close).toFixed(2)}
                              </StyledTableCell>
                              <StyledTableCell align="right" sx={{ color: '#9E9E9E' }}>
                                {stockData.volume ? stockData.volume.toLocaleString() : 'N/A'}
                              </StyledTableCell>
                              <StyledTableCell align="right">
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                  {stockData.change > 0 && (
                                    <ArrowUpward sx={{ color: '#4CAF50', fontSize: '16px' }} />
                                  )}
                                  {stockData.change < 0 && (
                                    <ArrowDownward sx={{ color: '#F44336', fontSize: '16px' }} />
                                  )}
                                  <Typography variant="body2" sx={{ 
                                    color: stockData.change > 0 ? '#4CAF50' : stockData.change < 0 ? '#F44336' : '#9E9E9E',
                                    fontWeight: 'bold'
                                  }}>
                                    ₹{Math.abs(stockData.change).toFixed(2)}
                                  </Typography>
                                </Box>
                              </StyledTableCell>
                              <StyledTableCell align="right">
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                  {stockData.changePercent > 0 && (
                                    <ArrowUpward sx={{ color: '#4CAF50', fontSize: '16px' }} />
                                  )}
                                  {stockData.changePercent < 0 && (
                                    <ArrowDownward sx={{ color: '#F44336', fontSize: '16px' }} />
                                  )}
                                  <Typography variant="body2" sx={{ 
                                    color: stockData.changePercent > 0 ? '#4CAF50' : stockData.changePercent < 0 ? '#F44336' : '#9E9E9E',
                                    fontWeight: 'bold'
                                  }}>
                                    {Math.abs(stockData.changePercent).toFixed(2)}%
                                  </Typography>
                                </Box>
                              </StyledTableCell>
                            </HoverRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" sx={{ color: '#e0e0e0' }}>
                  No detailed signal data available for this time period
                </Typography>
              </Box>
            )}
          </DialogContent>
          
          {/* Dialog footer - fixed */}
          <DialogActions sx={{ borderTop: '1px solid #00ffaa30', padding: '16px' }}>
            <Button
              onClick={handleDialogClose}
              sx={{
                color: '#00ffaa',
                border: '1px solid #00ffaa30',
                '&:hover': { backgroundColor: '#00ffaa20' }
              }}
            >
              Close
            </Button>
          </DialogActions>
        </SignalDialog>
      </Container>
    </>
  );
};

export default Signal;