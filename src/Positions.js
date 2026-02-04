import React, { useState, useEffect, useMemo } from 'react';
import { httpApi } from './api';
import CustomAppBar from './CustomAppBar';
import {
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  TableSortLabel,
  styled,
  useMediaQuery,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Tabs,
  Tab,
  Alert
} from '@mui/material';
import {
  Today as TodayIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Assessment as AssessmentIcon,
  Close as CloseIcon,
  BarChart as BarChartIcon,
  FilterList as FilterListIcon,
  DateRange as DateRangeIcon,
  ViewList as ViewListIcon
} from '@mui/icons-material';
import { useUser } from './UserContext';
import moment from 'moment';

// Styled components matching the app theme
const StyledCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)',
  border: '1px solid #00ffaa30',
  borderRadius: '12px',
  transition: 'all 0.3s ease',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 12px 30px rgba(0, 255, 170, 0.2)',
    border: '1px solid #00ffaa60',
  },
}));

const SummaryCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(135deg, #2a3f9e 0%, #1a5fb4 100%)',
  border: '1px solid #00ffaa30',
  borderRadius: '12px',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(0, 255, 170, 0.15)',
  },
}));

const ControlPanel = styled(Paper)(({ theme }) => ({
  background: 'linear-gradient(135deg, #0d47a1 0%, #1a237e 100%)',
  border: '1px solid #00ffaa40',
  borderRadius: '16px',
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  backdropFilter: 'blur(10px)',
  boxShadow: '0 8px 32px rgba(0, 255, 170, 0.1)',
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 'bold',
  padding: '12px',
  fontFamily: "'Roboto Mono', monospace",
  borderBottom: `1px solid ${theme.palette.divider}`,
  color: '#e0e0e0',
  fontSize: '0.875rem',
}));

const GradientHeader = styled(TableRow)(({ theme }) => ({
  background: 'linear-gradient(45deg, #1a5fb4 30%, #2a3f9e 90%)',
  borderBottom: '2px solid #00ffaa80',
  '& .MuiTableCell-root': {
    color: '#ffffff',
    fontWeight: 'bold',
    borderBottom: 'none',
  },
}));

const HoverRow = styled(TableRow)(({ theme }) => ({
  '&:hover': {
    backgroundColor: '#1a237e30',
    transform: 'scale(1.002)',
    transition: 'all 0.1s ease-in-out',
    cursor: 'pointer',
  },
}));

const formatNumber = (value) => {
  const num = Number(value);
  return isNaN(num) ? value : num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatCurrency = (value) => {
  const num = Number(value);
  if (isNaN(num)) return '₹0.00';
  return `₹${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return moment(dateString).format('DD-MM-YYYY HH:mm');
};

const formatTime = (dateString) => {
  if (!dateString) return 'N/A';
  return moment(dateString).format('HH:mm:ss');
};

const Positions = () => {
  const theme = useTheme();
  const { user } = useUser();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State management
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // View mode states
  const [viewMode, setViewMode] = useState('current'); // 'current', 'historical', 'dateRange', 'all'
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [dateRange, setDateRange] = useState({
    start: moment().subtract(7, 'days').format('YYYY-MM-DD'),
    end: moment().format('YYYY-MM-DD')
  });
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [showLatestOnly, setShowLatestOnly] = useState(true);
  
  // Sorting and filtering
  const [sortConfig, setSortConfig] = useState({
    key: 'transaction_date',
    direction: 'desc',
  });
  const [selectedSymbol, setSelectedSymbol] = useState('');
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  
  // Summary data
  const [summaryData, setSummaryData] = useState({
    totalPnL: 0,
    profitablePositions: 0,
    lossPositions: 0,
    totalPositions: 0,
    totalValue: 0,
    winRate: 0
  });

  // Fetch positions based on view mode
  const fetchPositions = async () => {
    try {
      setLoading(true);
      setError('');
      let response;
      
      switch (viewMode) {
        case 'current':
          response = showLatestOnly 
            ? await httpApi.get('/positions/latest-current-date')
            : await httpApi.get('/positions/current-date');
          break;
          
        case 'historical':
          response = showLatestOnly
            ? await httpApi.get(`/positions/latest-by-date?date=${selectedDate}`)
            : await httpApi.get(`/positions/by-date?date=${selectedDate}`);
          break;
          
        case 'dateRange':
          response = showLatestOnly
            ? await httpApi.get(`/positions/latest-date-range?start_date=${dateRange.start}&end_date=${dateRange.end}`)
            : await httpApi.get(`/positions/date-range?start_date=${dateRange.start}&end_date=${dateRange.end}`);
          break;
          
        case 'all':
          response = await httpApi.get('/positions');
          break;
          
        default:
          response = await httpApi.get('/positions/latest-current-date');
      }
      
      const data = response.data.data || [];
      setPositions(data);
      calculateSummary(data);
      
    } catch (err) {
      console.error('Error fetching positions:', err);
      setError(err.message || 'Failed to fetch positions');
    } finally {
      setLoading(false);
    }
  };

  // Refresh current date data
  const fetchCurrentDateData = async () => {
    if (viewMode !== 'current') return;
    
    try {
      setRefreshing(true);
      const response = showLatestOnly 
        ? await httpApi.get('/positions/latest-current-date')
        : await httpApi.get('/positions/current-date');
      
      const currentData = response.data.data || [];
      setPositions(currentData);
      calculateSummary(currentData);
    } catch (err) {
      console.error('Error fetching current date data:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Calculate summary statistics
  const calculateSummary = (data) => {
    const summary = data.reduce((acc, position) => {
      const pnl = Number(position.pnl || position.overall_trade_profit || 0);
      const value = Number(position.value || position.net_quantity || 0);
      
      acc.totalPnL += pnl;
      acc.totalValue += Math.abs(value);
      acc.totalPositions += 1;
      
      if (pnl > 0) {
        acc.profitablePositions += 1;
      } else if (pnl < 0) {
        acc.lossPositions += 1;
      }
      
      return acc;
    }, {
      totalPnL: 0,
      profitablePositions: 0,
      lossPositions: 0,
      totalPositions: 0,
      totalValue: 0
    });

    summary.winRate = summary.totalPositions > 0 
      ? (summary.profitablePositions / summary.totalPositions * 100) 
      : 0;
    
    setSummaryData(summary);
  };

  // Effects
  useEffect(() => {
    fetchPositions();
  }, [viewMode, selectedDate, dateRange, showLatestOnly]);

  // Set up live refresh for current date data
  useEffect(() => {
    if (viewMode === 'current' && liveUpdates) {
      const refreshInterval = setInterval(() => {
        fetchCurrentDateData();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(refreshInterval);
    }
  }, [viewMode, liveUpdates, showLatestOnly]);

  // Event handlers
  const handleViewModeChange = (newMode) => {
    setViewMode(newMode);
    setLiveUpdates(newMode === 'current');
  };

  const handleRefreshData = () => {
    fetchPositions();
  };

  const handleSort = (property) => {
    const isAsc = sortConfig.key === property && sortConfig.direction === 'asc';
    setSortConfig({
      key: property,
      direction: isAsc ? 'desc' : 'asc',
    });
  };

  const handlePositionClick = (position) => {
    setSelectedPosition(position);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedPosition(null);
    setTabValue(0);
  };

  // Sorting logic
  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      const { key, direction } = sortConfig;
      
      if (key === 'transaction_date') {
        const dateA = new Date(a.transaction_date || a.exchange_timestamp || a.order_timestamp).getTime();
        const dateB = new Date(b.transaction_date || b.exchange_timestamp || b.order_timestamp).getTime();
        return direction === 'desc' ? dateB - dateA : dateA - dateB;
      } else if (key === 'tradingsymbol') {
        const symbolA = (a.tradingsymbol || a.instrument_token || '').toString();
        const symbolB = (b.tradingsymbol || b.instrument_token || '').toString();
        return direction === 'asc' ? symbolA.localeCompare(symbolB) : symbolB.localeCompare(symbolA);
      } else {
        const aVal = Number(a[key] || 0);
        const bVal = Number(b[key] || 0);
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
  }, [positions, sortConfig]);

  // Filter by symbol if selected
  const filteredPositions = useMemo(() => {
    if (!selectedSymbol) return sortedPositions;
    return sortedPositions.filter(position => 
      (position.tradingsymbol || position.instrument_token || '')
        .toLowerCase().includes(selectedSymbol.toLowerCase())
    );
  }, [sortedPositions, selectedSymbol]);

  // Get unique symbols for filter dropdown
  const uniqueSymbols = useMemo(() => {
    const symbols = positions.map(p => p.tradingsymbol || p.instrument_token).filter(Boolean);
    return [...new Set(symbols)].sort();
  }, [positions]);

  const getPnlStyle = (pnl) => ({
    color: pnl >= 0 ? '#4CAF50' : '#F44336',
    fontWeight: 'bold'
  });

  const getStatusChip = (status) => {
    const statusColors = {
      'COMPLETE': '#4CAF50',
      'OPEN': '#FF9800',
      'CANCELLED': '#F44336',
      'REJECTED': '#F44336'
    };
    
    return (
      <Chip
        label={status || 'UNKNOWN'}
        size="small"
        sx={{
          backgroundColor: statusColors[status] || '#757575',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '0.75rem'
        }}
      />
    );
  };
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
          <Typography sx={{ color: '#e0e0e0', ml: 2 }}>Loading positions data...</Typography>
        </Box>
      </>
    );
  }

  if (error) {
    return (
      <>
        <CustomAppBar />
        <Container maxWidth="xl" sx={{ mt: 4, backgroundColor: '#0a1929', minHeight: '100vh' }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            Error: {error}
          </Alert>
          <Button 
            variant="contained" 
            onClick={handleRefreshData}
            sx={{ backgroundColor: '#00ffaa', color: '#000' }}
          >
            Retry
          </Button>
        </Container>
      </>
    );
  }

  return (
    <>
      <CustomAppBar />
      <Container 
        maxWidth="xl" 
        sx={{ 
          backgroundColor: '#0a1929',
          minHeight: '100vh',
          p: { xs: 1, sm: 2, md: 3 },
          pt: { xs: 1, sm: 2 }
        }}
      >
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 'bold',
              color: '#ffffff',
              textAlign: 'center',
              background: 'linear-gradient(45deg, #00ffaa 30%, #ffffff 90%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1
            }}
          >
            Position Analytics
          </Typography>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              color: '#b0bec5',
              textAlign: 'center',
              fontWeight: 300
            }}
          >
            Real-time position tracking and portfolio analytics
          </Typography>
        </Box>

        {/* Control Panel */}
        <ControlPanel elevation={3}>
          <Grid container spacing={3} alignItems="center">
            {/* View Mode Selection */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#b0bec5' }}>View Mode</InputLabel>
                <Select
                  value={viewMode}
                  onChange={(e) => handleViewModeChange(e.target.value)}
                  label="View Mode"
                  sx={{
                    color: '#ffffff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa50' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa80' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' },
                  }}
                >
                  <MenuItem value="current">
                    <TodayIcon sx={{ mr: 1, fontSize: 18 }} />
                    Current Positions
                  </MenuItem>
                  <MenuItem value="historical">
                    <HistoryIcon sx={{ mr: 1, fontSize: 18 }} />
                    Historical Date
                  </MenuItem>
                  <MenuItem value="dateRange">
                    <DateRangeIcon sx={{ mr: 1, fontSize: 18 }} />
                    Date Range
                  </MenuItem>
                  <MenuItem value="all">
                    <ViewListIcon sx={{ mr: 1, fontSize: 18 }} />
                    All Positions
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Date Selection for Historical */}
            {viewMode === 'historical' && (
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  type="date"
                  label="Select Date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ 
                    shrink: true,
                    sx: { color: '#b0bec5' }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#ffffff',
                      '& fieldset': { borderColor: '#00ffaa50' },
                      '&:hover fieldset': { borderColor: '#00ffaa80' },
                      '&.Mui-focused fieldset': { borderColor: '#00ffaa' },
                    }
                  }}
                />
              </Grid>
            )}

            {/* Date Range Selection */}
            {viewMode === 'dateRange' && (
              <>
                <Grid item xs={12} sm={3} md={2}>
                  <TextField
                    type="date"
                    label="Start Date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    fullWidth
                    size="small"
                    InputLabelProps={{ 
                      shrink: true,
                      sx: { color: '#b0bec5' }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#ffffff',
                        '& fieldset': { borderColor: '#00ffaa50' },
                        '&:hover fieldset': { borderColor: '#00ffaa80' },
                        '&.Mui-focused fieldset': { borderColor: '#00ffaa' },
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={3} md={2}>
                  <TextField
                    type="date"
                    label="End Date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    fullWidth
                    size="small"
                    InputLabelProps={{ 
                      shrink: true,
                      sx: { color: '#b0bec5' }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#ffffff',
                        '& fieldset': { borderColor: '#00ffaa50' },
                        '&:hover fieldset': { borderColor: '#00ffaa80' },
                        '&.Mui-focused fieldset': { borderColor: '#00ffaa' },
                      }
                    }}
                  />
                </Grid>
              </>
            )}

            {/* Symbol Filter */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#b0bec5' }}>Filter by Symbol</InputLabel>
                <Select
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  label="Filter by Symbol"
                  sx={{
                    color: '#ffffff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa50' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa80' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' },
                  }}
                >
                  <MenuItem value="">
                    <FilterListIcon sx={{ mr: 1, fontSize: 18 }} />
                    All Symbols
                  </MenuItem>
                  {uniqueSymbols.map((symbol) => (
                    <MenuItem key={symbol} value={symbol}>
                      {symbol}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Controls */}
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  onClick={handleRefreshData}
                  disabled={refreshing}
                  startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
                  sx={{
                    backgroundColor: '#00ffaa',
                    color: '#000000',
                    fontWeight: 'bold',
                    '&:hover': { backgroundColor: '#00e5aa' },
                    flex: 1,
                    minWidth: 'auto'
                  }}
                >
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
              </Box>
            </Grid>

            {/* Toggles */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showLatestOnly}
                      onChange={(e) => setShowLatestOnly(e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#00ffaa' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#00ffaa' },
                      }}
                    />
                  }
                  label="Show Latest Only"
                  sx={{ color: '#ffffff' }}
                />
                {viewMode === 'current' && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={liveUpdates}
                        onChange={(e) => setLiveUpdates(e.target.checked)}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { color: '#00ffaa' },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#00ffaa' },
                        }}
                      />
                    }
                    label="Live Updates (30s)"
                    sx={{ color: '#ffffff' }}
                  />
                )}
              </Box>
            </Grid>
          </Grid>
        </ControlPanel>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <SummaryCard>
              <CardContent sx={{ textAlign: 'center' }}>
                <TrendingUpIcon sx={{ fontSize: 40, color: '#4CAF50', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                  {summaryData.totalPositions}
                </Typography>
                <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                  Total Positions
                </Typography>
              </CardContent>
            </SummaryCard>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <SummaryCard>
              <CardContent sx={{ textAlign: 'center' }}>
                <AssessmentIcon sx={{ fontSize: 40, color: summaryData.totalPnL >= 0 ? '#4CAF50' : '#F44336', mb: 1 }} />
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 'bold', 
                    color: summaryData.totalPnL >= 0 ? '#4CAF50' : '#F44336' 
                  }}
                >
                  {formatCurrency(summaryData.totalPnL)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                  Total P&L
                </Typography>
              </CardContent>
            </SummaryCard>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <SummaryCard>
              <CardContent sx={{ textAlign: 'center' }}>
                <TrendingUpIcon sx={{ fontSize: 40, color: '#4CAF50', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>
                  {summaryData.profitablePositions}
                </Typography>
                <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                  Profitable Positions
                </Typography>
              </CardContent>
            </SummaryCard>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <SummaryCard>
              <CardContent sx={{ textAlign: 'center' }}>
                <BarChartIcon sx={{ fontSize: 40, color: '#00ffaa', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                  {summaryData.winRate.toFixed(1)}%
                </Typography>
                <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                  Win Rate
                </Typography>
              </CardContent>
            </SummaryCard>
          </Grid>
        </Grid>

        {/* Positions Table */}
        <StyledCard>
          <CardContent sx={{ p: 0 }}>
            <TableContainer sx={{ maxHeight: isMobile ? 400 : 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <GradientHeader>
                    <StyledTableCell>
                      <TableSortLabel
                        active={sortConfig.key === 'transaction_date'}
                        direction={sortConfig.direction}
                        onClick={() => handleSort('transaction_date')}
                        sx={{ color: 'inherit' }}
                      >
                        Date/Time
                      </TableSortLabel>
                    </StyledTableCell>
                    <StyledTableCell>
                      <TableSortLabel
                        active={sortConfig.key === 'tradingsymbol'}
                        direction={sortConfig.direction}
                        onClick={() => handleSort('tradingsymbol')}
                        sx={{ color: 'inherit' }}
                      >
                        Symbol
                      </TableSortLabel>
                    </StyledTableCell>
                    {!isMobile && (
                      <StyledTableCell align="center">Type</StyledTableCell>
                    )}
                    <StyledTableCell align="right">
                      <TableSortLabel
                        active={sortConfig.key === 'quantity'}
                        direction={sortConfig.direction}
                        onClick={() => handleSort('quantity')}
                        sx={{ color: 'inherit' }}
                      >
                        Quantity
                      </TableSortLabel>
                    </StyledTableCell>
                    {!isMobile && (
                      <StyledTableCell align="right">
                        <TableSortLabel
                          active={sortConfig.key === 'price'}
                          direction={sortConfig.direction}
                          onClick={() => handleSort('price')}
                          sx={{ color: 'inherit' }}
                        >
                          Price
                        </TableSortLabel>
                      </StyledTableCell>
                    )}
                    <StyledTableCell align="right">
                      <TableSortLabel
                        active={sortConfig.key === 'pnl'}
                        direction={sortConfig.direction}
                        onClick={() => handleSort('pnl')}
                        sx={{ color: 'inherit' }}
                      >
                        P&L
                      </TableSortLabel>
                    </StyledTableCell>
                    {!isMobile && (
                      <StyledTableCell align="center">Status</StyledTableCell>
                    )}
                  </GradientHeader>
                </TableHead>
                <TableBody>
                  {filteredPositions.length === 0 ? (
                    <TableRow>
                      <StyledTableCell colSpan={isMobile ? 4 : 7} align="center">
                        <Typography sx={{ color: '#b0bec5', py: 4 }}>
                          No positions found for the selected criteria
                        </Typography>
                      </StyledTableCell>
                    </TableRow>
                  ) : (
                    filteredPositions.map((position, index) => (
                      <HoverRow 
                        key={index} 
                        onClick={() => handlePositionClick(position)}
                      >
                        <StyledTableCell>
                          <Box>
                            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                              {formatDate(position.transaction_date || position.exchange_timestamp || position.order_timestamp)}
                            </Typography>
                            {!isMobile && (
                              <Typography variant="caption" sx={{ color: '#b0bec5' }}>
                                {formatTime(position.transaction_date || position.exchange_timestamp || position.order_timestamp)}
                              </Typography>
                            )}
                          </Box>
                        </StyledTableCell>
                        <StyledTableCell>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: '#00ffaa', 
                              fontWeight: 'bold',
                              fontFamily: "'Roboto Mono', monospace" 
                            }}
                          >
                            {position.tradingsymbol || position.instrument_token || 'N/A'}
                          </Typography>
                        </StyledTableCell>
                        {!isMobile && (
                          <StyledTableCell align="center">
                            <Chip
                              label={position.transaction_type || position.order_type || 'N/A'}
                              size="small"
                              sx={{
                                backgroundColor: position.transaction_type === 'BUY' ? '#4CAF5040' : '#F4433640',
                                color: position.transaction_type === 'BUY' ? '#4CAF50' : '#F44336',
                                fontWeight: 'bold'
                              }}
                            />
                          </StyledTableCell>
                        )}
                        <StyledTableCell align="right">
                          <Typography sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                            {formatNumber(position.quantity || position.net_quantity || 0)}
                          </Typography>
                        </StyledTableCell>
                        {!isMobile && (
                          <StyledTableCell align="right">
                            <Typography sx={{ color: '#ffffff' }}>
                              {formatCurrency(position.price || position.average_price || 0)}
                            </Typography>
                          </StyledTableCell>
                        )}
                        <StyledTableCell align="right">
                          <Typography sx={getPnlStyle(position.pnl || position.overall_trade_profit || 0)}>
                            {formatCurrency(position.pnl || position.overall_trade_profit || 0)}
                          </Typography>
                        </StyledTableCell>
                        {!isMobile && (
                          <StyledTableCell align="center">
                            {getStatusChip(position.status || position.order_status || 'UNKNOWN')}
                          </StyledTableCell>
                        )}
                      </HoverRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </StyledCard>

        {/* Position Detail Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              backgroundColor: '#1a237e',
              border: '1px solid #00ffaa40',
              borderRadius: '12px',
            }
          }}
        >
          <DialogTitle sx={{ 
            color: '#ffffff',
            borderBottom: '1px solid #00ffaa40',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Position Details: {selectedPosition?.tradingsymbol || selectedPosition?.instrument_token}
            </Typography>
            <IconButton onClick={handleCloseDialog} sx={{ color: '#ffffff' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            {selectedPosition && (
              <Box>
                <Tabs
                  value={tabValue}
                  onChange={(e, newValue) => setTabValue(newValue)}
                  sx={{
                    mb: 3,
                    '& .MuiTabs-indicator': { backgroundColor: '#00ffaa' },
                    '& .MuiTab-root': { color: '#b0bec5' },
                    '& .Mui-selected': { color: '#00ffaa' }
                  }}
                >
                  <Tab label="Position Info" />
                  <Tab label="Financial Details" />
                  <Tab label="Metadata" />
                </Tabs>

                {tabValue === 0 && (
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Symbol</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2 }}>
                        {selectedPosition.tradingsymbol || selectedPosition.instrument_token || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Transaction Type</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2 }}>
                        {selectedPosition.transaction_type || selectedPosition.order_type || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Quantity</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2 }}>
                        {formatNumber(selectedPosition.quantity || selectedPosition.net_quantity || 0)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Price</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2 }}>
                        {formatCurrency(selectedPosition.price || selectedPosition.average_price || 0)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Date/Time</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2 }}>
                        {formatDate(selectedPosition.transaction_date || selectedPosition.exchange_timestamp || selectedPosition.order_timestamp)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Status</Typography>
                      <Box sx={{ mt: 1 }}>
                        {getStatusChip(selectedPosition.status || selectedPosition.order_status || 'UNKNOWN')}
                      </Box>
                    </Grid>
                  </Grid>
                )}

                {tabValue === 1 && (
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>P&L</Typography>
                      <Typography sx={{ 
                        ...getPnlStyle(selectedPosition.pnl || selectedPosition.overall_trade_profit || 0),
                        mb: 2 
                      }}>
                        {formatCurrency(selectedPosition.pnl || selectedPosition.overall_trade_profit || 0)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Total Value</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2 }}>
                        {formatCurrency(selectedPosition.value || selectedPosition.total_value || 0)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Buy Cost</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2 }}>
                        {formatCurrency(selectedPosition.buy_cost || selectedPosition.buy_value || 0)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Sell Cost</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2 }}>
                        {formatCurrency(selectedPosition.sell_cost || selectedPosition.sell_value || 0)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Available Margin</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2 }}>
                        {formatCurrency(selectedPosition.available_margin || selectedPosition.margin_available || 0)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Used Margin</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2 }}>
                        {formatCurrency(selectedPosition.used_margin || selectedPosition.margin_used || 0)}
                      </Typography>
                    </Grid>
                  </Grid>
                )}

                {tabValue === 2 && (
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Order ID</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2, fontFamily: "'Roboto Mono', monospace" }}>
                        {selectedPosition.order_id || selectedPosition.order_number || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Tag</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2 }}>
                        {selectedPosition.tag || selectedPosition.client_tag || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Exchange</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2 }}>
                        {selectedPosition.exchange || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Product Type</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2 }}>
                        {selectedPosition.product || selectedPosition.product_type || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Instrument Token</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2, fontFamily: "'Roboto Mono', monospace" }}>
                        {selectedPosition.instrument_token || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#b0bec5' }}>Last Updated</Typography>
                      <Typography sx={{ color: '#ffffff', mb: 2 }}>
                        {formatDate(selectedPosition.last_price_date || selectedPosition.updated_at) || 'N/A'}
                      </Typography>
                    </Grid>
                  </Grid>
                )}
              </Box>
            )}
          </DialogContent>
        </Dialog>
      </Container>
    </>
  );
};

export default Positions;