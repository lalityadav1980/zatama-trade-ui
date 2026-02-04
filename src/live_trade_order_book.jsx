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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  Snackbar,
  TableSortLabel,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Close as CloseIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon,
  Today as TodayIcon,
  History as HistoryIcon,
  Assessment as AssessmentIcon,
  AccountBalance as AccountBalanceIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  GetApp as ExportIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon
} from '@mui/icons-material';
import CustomAppBar from './CustomAppBar';
import { httpApi } from './api';
import moment from 'moment';

// Styled components matching the existing theme
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
  background: 'linear-gradient(45deg, #1a237e 30%, #0d47a1 90%)',
  border: '1px solid #00ffaa30',
  boxShadow: '0 0 20px #00ffaa20',
  marginBottom: '20px',
  height: '140px',
  display: 'flex',
  flexDirection: 'column',
  '& .MuiCardContent-root': {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '16px !important',
  },
  [theme.breakpoints.down('sm')]: {
    height: '120px',
    marginBottom: '16px',
    '& .MuiCardContent-root': {
      padding: '12px !important',
    },
  },
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 'bold',
  padding: '8px 12px',
  fontFamily: "'Roboto Mono', monospace",
  borderBottom: `1px solid ${theme.palette.divider}`,
  color: '#e0e0e0',
  fontSize: '0.875rem',
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
  },
}));

const StatValue = styled(Typography)(({ positive }) => ({
  color: positive === true ? '#4CAF50' : positive === false ? '#F44336' : '#FFEB3B',
  fontWeight: 'bold',
  fontSize: '1.5rem',
  filter: 'drop-shadow(0 0 2px currentColor)',
}));

const FilterCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(135deg, #2a3f9e 0%, #1a5fb4 100%)',
  border: '1px solid #00ffaa30',
  borderRadius: '8px',
  marginBottom: '16px',
  padding: '16px',
  [theme.breakpoints.down('sm')]: {
    padding: '12px',
    marginBottom: '12px',
  },
}));

const StatusChip = styled(Chip)(({ status }) => {
  let color = '#FFEB3B';
  let bgColor = '#FFEB3B20';
  
  if (status === 'COMPLETE') {
    color = '#4CAF50';
    bgColor = '#4CAF5020';
  } else if (status === 'CANCELLED') {
    color = '#F44336';
    bgColor = '#F4433620';
  } else if (status === 'OPEN') {
    color = '#FF9800';
    bgColor = '#FF980020';
  }
  
  return {
    color: color,
    backgroundColor: bgColor,
    border: `1px solid ${color}40`,
    fontWeight: 'bold',
    fontSize: '0.75rem',
  };
});

const TransactionChip = styled(Chip)(({ transaction }) => ({
  color: transaction === 'BUY' ? '#4CAF50' : '#F44336',
  backgroundColor: transaction === 'BUY' ? '#4CAF5020' : '#F4433620',
  border: `1px solid ${transaction === 'BUY' ? '#4CAF50' : '#F44336'}40`,
  fontWeight: 'bold',
  fontSize: '0.75rem',
}));

// Utility functions
const formatNumber = (value) => {
  const num = Number(value);
  return isNaN(num) ? value : num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatCurrency = (value) => {
  const num = Number(value);
  return isNaN(num) ? value : `₹${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  return moment(dateString).format('DD-MM-YYYY HH:mm:ss');
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return moment(dateString).format('DD-MM-YYYY');
};

const LiveTradeOrderBook = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [groupedOrders, setGroupedOrders] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grouped'
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [filters, setFilters] = useState({
    status: '',
    symbol: '',
    user: '',
    exchange: '',
    transaction_type: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: 'exchange_timestamp', direction: 'desc' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [detailDialog, setDetailDialog] = useState({ open: false, order: null, isGrouped: false });
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Fetch data functions
  const fetchOrders = async (endpoint = 'current-date') => {
    try {
      setLoading(true);
      let url = `/trade-orders/${endpoint}`;
      
      if (endpoint === 'date') {
        if (!selectedDate) {
          showSnackbar('Please select a date first', 'warning');
          setLoading(false);
          return;
        }
        url = `/trade-orders/date/${selectedDate}`;
      }
      
      const response = await httpApi.get(url);
      if (response.data.status === 'success') {
        setOrders(response.data.data || []);
        setFilteredOrders(response.data.data || []);
        setLastRefresh(new Date());
      } else {
        showSnackbar('Failed to fetch orders: ' + response.data.message, 'error');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      showSnackbar('Error fetching orders: ' + error.message, 'error');
      setOrders([]);
      setFilteredOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupedOrders = async (date = null) => {
    try {
      setLoading(true);
      const endpoint = date ? `/trade-orders/grouped/date/${date}` : '/trade-orders/grouped/current-date';
      const response = await httpApi.get(endpoint);
      
      if (response.data.status === 'success') {
        setGroupedOrders(response.data.data.grouped_data || []);
        setLastRefresh(new Date());
      } else {
        showSnackbar('Failed to fetch grouped orders: ' + response.data.message, 'error');
        setGroupedOrders([]);
      }
    } catch (error) {
      console.error('Error fetching grouped orders:', error);
      showSnackbar('Error fetching grouped orders: ' + error.message, 'error');
      setGroupedOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async (date = null) => {
    try {
      const endpoint = date ? `/trade-orders/summary/date/${date}` : '/trade-orders/summary/current-date';
      const response = await httpApi.get(endpoint);
      
      if (response.data.status === 'success') {
        setSummary(response.data.data);
      } else {
        setSummary(null);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
      setSummary(null);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await httpApi.get('/trade-orders/statistics');
      if (response.data.status === 'success') {
        setStatistics(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleRefresh = () => {
    if (currentTab === 0) {
      fetchOrders('current-date');
      fetchSummary();
      if (viewMode === 'grouped') {
        fetchGroupedOrders();
      }
    } else if (currentTab === 1) {
      if (selectedDate) {
        fetchOrders('date');
        fetchSummary(selectedDate);
        if (viewMode === 'grouped') {
          fetchGroupedOrders(selectedDate);
        }
      } else {
        showSnackbar('Please select a date to refresh historical data', 'warning');
      }
    } else if (currentTab === 2) {
      fetchStatistics();
    }
  };

  const handleManualRefresh = async () => {
    if (currentTab === 0) {
      await fetchOrders('current-date');
      await fetchSummary();
      await fetchStatistics();
      if (viewMode === 'grouped') {
        await fetchGroupedOrders();
      }
    } else if (currentTab === 1) {
      if (selectedDate) {
        await fetchOrders('date');
        await fetchSummary(selectedDate);
        if (viewMode === 'grouped') {
          await fetchGroupedOrders(selectedDate);
        }
      } else {
        showSnackbar('Please select a date to refresh historical data', 'warning');
      }
    } else if (currentTab === 2) {
      await fetchStatistics();
    }
    showSnackbar('Data refreshed successfully', 'success');
  };

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
    showSnackbar(
      autoRefreshEnabled ? 'Auto-refresh disabled' : 'Auto-refresh enabled', 
      'info'
    );
  };

  const formatLastRefresh = () => {
    return lastRefresh.toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
    if (newValue === 0) {
      fetchOrders('current-date');
      fetchSummary();
      if (viewMode === 'grouped') {
        fetchGroupedOrders();
      }
    } else if (newValue === 1) {
      if (selectedDate) {
        fetchOrders('date');
        fetchSummary(selectedDate);
        if (viewMode === 'grouped') {
          fetchGroupedOrders(selectedDate);
        }
      } else {
        showSnackbar('Please select a date to view historical data', 'warning');
      }
    } else if (newValue === 2) {
      fetchStatistics();
    }
  };

  const handleDateChange = (event) => {
    const date = event.target.value;
    setSelectedDate(date);
    if (currentTab === 1) {
      fetchOrders('date');
      fetchSummary(date);
      if (viewMode === 'grouped') {
        fetchGroupedOrders(date);
      }
    }
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    if (mode === 'grouped') {
      if (currentTab === 0) {
        fetchGroupedOrders();
      } else if (currentTab === 1) {
        fetchGroupedOrders(selectedDate);
      }
    }
  };

  const handleFilterChange = (filterType, value) => {
    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    applyFilters(orders, newFilters);
  };

  const applyFilters = (data, filterConfig) => {
    let filtered = [...data];
    
    Object.keys(filterConfig).forEach(key => {
      if (filterConfig[key]) {
        filtered = filtered.filter(order => {
          const orderValue = String(order[key] || '').toLowerCase();
          const filterValue = String(filterConfig[key]).toLowerCase();
          return orderValue.includes(filterValue);
        });
      }
    });
    
    setFilteredOrders(filtered);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    
    const sorted = [...filteredOrders].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    setFilteredOrders(sorted);
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      symbol: '',
      user: '',
      exchange: '',
      transaction_type: ''
    });
    setFilteredOrders(orders);
  };

  const exportToCSV = () => {
    if (filteredOrders.length === 0) {
      showSnackbar('No data to export', 'warning');
      return;
    }
    
    const headers = [
      'Order ID', 'Symbol', 'Type', 'Status', 'Quantity', 'Price', 'Amount',
      'Exchange', 'User', 'Order Time', 'Exchange Time'
    ];
    
    const csvData = filteredOrders.map(order => [
      order.order_id,
      order.tradingsymbol,
      order.transaction_type,
      order.status,
      order.quantity,
      order.average_price || order.price,
      (order.quantity * (order.average_price || order.price)).toFixed(2),
      order.exchange,
      order.userid,
      formatDateTime(order.order_timestamp),
      formatDateTime(order.exchange_timestamp)
    ]);
    
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade_orders_${moment().format('YYYY-MM-DD_HH-mm-ss')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showSnackbar('Data exported successfully', 'success');
  };

  useEffect(() => {
    fetchOrders('current-date');
    fetchSummary();
    fetchStatistics();
    
    // Also fetch grouped data for historical tab
    if (currentTab === 1 && viewMode === 'grouped') {
      fetchGroupedOrders(selectedDate);
    }
    
    // Set up auto-refresh for current date view (every 1 minute)
    if (autoRefreshEnabled) {
      const interval = setInterval(() => {
        if (currentTab === 0) {
          fetchOrders('current-date');
          fetchSummary();
          fetchStatistics();
          if (viewMode === 'grouped') {
            fetchGroupedOrders();
          }
        }
      }, 60000); // Refresh every 60 seconds (1 minute)
      
      setRefreshInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [currentTab, autoRefreshEnabled, viewMode]);

  // Cleanup interval on component unmount
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [refreshInterval]);

  useEffect(() => {
    applyFilters(orders, filters);
  }, [orders]);

  const renderSummaryCards = () => {
    if (!summary || !summary.overall_summary) return null;
    
    const { overall_summary } = summary;
    
    return (
      <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={6} md={3}>
          <SummaryCard>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: '#00ffaa', 
                      fontSize: isMobile ? '0.8rem' : '0.9rem'
                    }}
                  >
                    Total Trades
                  </Typography>
                  <StatValue>{overall_summary.total_trades}</StatValue>
                </Box>
                <TimelineIcon sx={{ 
                  fontSize: isMobile ? 32 : 40, 
                  color: '#00ffaa60' 
                }} />
              </Box>
            </CardContent>
          </SummaryCard>
        </Grid>
        
        <Grid item xs={6} sm={6} md={3}>
          <SummaryCard>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: '#00ffaa', 
                      fontSize: isMobile ? '0.8rem' : '0.9rem'
                    }}
                  >
                    Total P&L
                  </Typography>
                  <StatValue positive={overall_summary.total_pnl_absolute >= 0}>
                    {formatCurrency(overall_summary.total_pnl_absolute)}
                  </StatValue>
                </Box>
                {overall_summary.total_pnl_absolute >= 0 ? 
                  <TrendingUpIcon sx={{ 
                    fontSize: isMobile ? 32 : 40, 
                    color: '#4CAF50' 
                  }} /> :
                  <TrendingDownIcon sx={{ 
                    fontSize: isMobile ? 32 : 40, 
                    color: '#F44336' 
                  }} />
                }
              </Box>
            </CardContent>
          </SummaryCard>
        </Grid>
        
        <Grid item xs={6} sm={6} md={3}>
          <SummaryCard>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: '#00ffaa', 
                      fontSize: isMobile ? '0.8rem' : '0.9rem'
                    }}
                  >
                    Win Rate
                  </Typography>
                  <StatValue positive={overall_summary.win_rate >= 50}>
                    {overall_summary.win_rate}%
                  </StatValue>
                </Box>
                <AssessmentIcon sx={{ 
                  fontSize: isMobile ? 32 : 40, 
                  color: '#00ffaa60' 
                }} />
              </Box>
            </CardContent>
          </SummaryCard>
        </Grid>
        
        <Grid item xs={6} sm={6} md={3}>
          <SummaryCard>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: '#00ffaa', 
                      fontSize: isMobile ? '0.8rem' : '0.9rem'
                    }}
                  >
                    Symbols Traded
                  </Typography>
                  <StatValue>{overall_summary.total_symbols}</StatValue>
                </Box>
                <AccountBalanceIcon sx={{ 
                  fontSize: isMobile ? 32 : 40, 
                  color: '#00ffaa60' 
                }} />
              </Box>
            </CardContent>
          </SummaryCard>
        </Grid>
      </Grid>
    );
  };

  const renderFilters = () => (
    <FilterCard>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap">
        <Typography 
          variant={isMobile ? "subtitle1" : "h6"} 
          sx={{ 
            color: '#00ffaa', 
            display: 'flex', 
            alignItems: 'center',
            fontWeight: 'bold',
            mb: isMobile ? 1 : 0
          }}
        >
          <FilterListIcon sx={{ mr: 1 }} />
          Filters
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={clearFilters}
          sx={{ 
            color: '#00ffaa', 
            borderColor: '#00ffaa',
            minWidth: isMobile ? '80px' : 'auto'
          }}
        >
          Clear All
        </Button>
      </Box>
      
      <Grid container spacing={isMobile ? 1 : 2}>
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel sx={{ color: '#e0e0e0' }}>Status</InputLabel>
            <Select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              sx={{ color: '#e0e0e0' }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="COMPLETE">Complete</MenuItem>
              <MenuItem value="OPEN">Open</MenuItem>
              <MenuItem value="CANCELLED">Cancelled</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel sx={{ color: '#e0e0e0' }}>Transaction</InputLabel>
            <Select
              value={filters.transaction_type}
              onChange={(e) => handleFilterChange('transaction_type', e.target.value)}
              sx={{ color: '#e0e0e0' }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="BUY">Buy</MenuItem>
              <MenuItem value="SELL">Sell</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <TextField
            label="Symbol"
            size="small"
            fullWidth
            value={filters.symbol}
            onChange={(e) => handleFilterChange('tradingsymbol', e.target.value)}
            InputLabelProps={{ sx: { color: '#e0e0e0' } }}
            sx={{ '& .MuiInputBase-input': { color: '#e0e0e0' } }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <TextField
            label="User ID"
            size="small"
            fullWidth
            value={filters.user}
            onChange={(e) => handleFilterChange('userid', e.target.value)}
            InputLabelProps={{ sx: { color: '#e0e0e0' } }}
            sx={{ '& .MuiInputBase-input': { color: '#e0e0e0' } }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <TextField
            label="Exchange"
            size="small"
            fullWidth
            value={filters.exchange}
            onChange={(e) => handleFilterChange('exchange', e.target.value)}
            InputLabelProps={{ sx: { color: '#e0e0e0' } }}
            sx={{ '& .MuiInputBase-input': { color: '#e0e0e0' } }}
          />
        </Grid>
        
        <Grid item xs={12} md={2}>
          <Box display="flex" gap={1} flexDirection={isMobile ? 'column' : 'row'}>
            <Button
              variant="contained"
              size="small"
              onClick={handleRefresh}
              startIcon={<RefreshIcon />}
              fullWidth={isMobile}
              sx={{ 
                background: 'linear-gradient(45deg, #00ffaa 30%, #00cc88 90%)',
                color: '#000',
                minHeight: '40px'
              }}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={exportToCSV}
              startIcon={<ExportIcon />}
              sx={{ color: '#00ffaa', borderColor: '#00ffaa' }}
            >
              Export
            </Button>
          </Box>
        </Grid>
      </Grid>
    </FilterCard>
  );

  const renderOrdersTable = () => {
    if (isMobile) {
      return renderMobileOrdersList();
    }

    return (
      <TableContainer component={Paper} sx={{ 
        background: 'linear-gradient(135deg, #0a1929 0%, #1a237e 100%)',
        border: '1px solid #00ffaa30'
      }}>
        <Table stickyHeader>
          <TableHead>
            <GradientHeader>
              <StyledTableCell>
                <TableSortLabel
                  active={sortConfig.key === 'order_id'}
                  direction={sortConfig.direction}
                  onClick={() => handleSort('order_id')}
                  sx={{ color: '#e0e0e0' }}
                >
                  Order ID
                </TableSortLabel>
              </StyledTableCell>
              <StyledTableCell>
                <TableSortLabel
                  active={sortConfig.key === 'tradingsymbol'}
                  direction={sortConfig.direction}
                  onClick={() => handleSort('tradingsymbol')}
                  sx={{ color: '#e0e0e0' }}
                >
                  Symbol
                </TableSortLabel>
              </StyledTableCell>
              <StyledTableCell>Type</StyledTableCell>
              <StyledTableCell>Status</StyledTableCell>
              <StyledTableCell align="right">
                <TableSortLabel
                  active={sortConfig.key === 'quantity'}
                  direction={sortConfig.direction}
                  onClick={() => handleSort('quantity')}
                  sx={{ color: '#e0e0e0' }}
                >
                  Quantity
                </TableSortLabel>
              </StyledTableCell>
              <StyledTableCell align="right">
                <TableSortLabel
                  active={sortConfig.key === 'average_price'}
                  direction={sortConfig.direction}
                  onClick={() => handleSort('average_price')}
                  sx={{ color: '#e0e0e0' }}
                >
                  Price
                </TableSortLabel>
              </StyledTableCell>
              <StyledTableCell align="right">Amount</StyledTableCell>
              <StyledTableCell>Exchange</StyledTableCell>
              <StyledTableCell>User</StyledTableCell>
              <StyledTableCell>
                <TableSortLabel
                  active={sortConfig.key === 'exchange_timestamp'}
                  direction={sortConfig.direction}
                  onClick={() => handleSort('exchange_timestamp')}
                  sx={{ color: '#e0e0e0' }}
                >
                  Time
                </TableSortLabel>
              </StyledTableCell>
            </GradientHeader>
          </TableHead>
          <TableBody>
            {filteredOrders.map((order) => (
              <HoverRow
                key={order.id || order.order_id}
                onClick={() => setDetailDialog({ open: true, order, isGrouped: false })}
              >
                <StyledTableCell>{order.order_id}</StyledTableCell>
                <StyledTableCell>{order.tradingsymbol}</StyledTableCell>
                <StyledTableCell>
                  <TransactionChip
                    label={order.transaction_type}
                    size="small"
                    transaction={order.transaction_type}
                  />
                </StyledTableCell>
                <StyledTableCell>
                  <StatusChip
                    label={order.status}
                    size="small"
                    status={order.status}
                  />
                </StyledTableCell>
                <StyledTableCell align="right">
                  {formatNumber(order.quantity)}
                </StyledTableCell>
                <StyledTableCell align="right">
                  {formatCurrency(order.average_price || order.price)}
                </StyledTableCell>
                <StyledTableCell align="right">
                  {formatCurrency(order.quantity * (order.average_price || order.price))}
                </StyledTableCell>
                <StyledTableCell>{order.exchange}</StyledTableCell>
                <StyledTableCell>{order.userid}</StyledTableCell>
                <StyledTableCell>
                  {formatDateTime(order.exchange_timestamp)}
                </StyledTableCell>
              </HoverRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderMobileOrdersList = () => (
    <Box>
      {filteredOrders.map((order) => (
        <Card 
          key={order.id || order.order_id}
          onClick={() => setDetailDialog({ open: true, order, isGrouped: false })}
          sx={{
            mb: 2,
            background: 'linear-gradient(135deg, #0a1929 0%, #1a237e 100%)',
            border: '1px solid #00ffaa30',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 25px rgba(0, 255, 170, 0.15)',
              border: '1px solid #00ffaa60',
            },
          }}
        >
          <CardContent sx={{ p: 2 }}>
            {/* Header row with symbol and status */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="h6" sx={{ color: '#00ffaa', fontWeight: 'bold' }}>
                {order.tradingsymbol}
              </Typography>
              <StatusChip
                label={order.status}
                size="small"
                status={order.status}
              />
            </Box>
            
            {/* Order ID and Type */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                Order: {order.order_id}
              </Typography>
              <TransactionChip
                label={order.transaction_type}
                size="small"
                transaction={order.transaction_type}
              />
            </Box>
            
            {/* Quantity and Price */}
            <Grid container spacing={2} sx={{ mb: 1 }}>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                  Quantity
                </Typography>
                <Typography variant="body1" sx={{ color: '#e0e0e0', fontWeight: 'bold' }}>
                  {formatNumber(order.quantity)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                  Price
                </Typography>
                <Typography variant="body1" sx={{ color: '#e0e0e0', fontWeight: 'bold' }}>
                  {formatCurrency(order.average_price || order.price)}
                </Typography>
              </Grid>
            </Grid>
            
            {/* Amount and Exchange */}
            <Grid container spacing={2} sx={{ mb: 1 }}>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                  Amount
                </Typography>
                <Typography variant="body1" sx={{ color: '#00ffaa', fontWeight: 'bold' }}>
                  {formatCurrency(order.quantity * (order.average_price || order.price))}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                  Exchange
                </Typography>
                <Typography variant="body1" sx={{ color: '#e0e0e0' }}>
                  {order.exchange}
                </Typography>
              </Grid>
            </Grid>
            
            {/* User and Time */}
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                  User: {order.userid}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                {formatDateTime(order.exchange_timestamp)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );

  const renderOrderDetail = () => (
    <Dialog
      open={detailDialog.open}
      onClose={() => setDetailDialog({ open: false, order: null, isGrouped: false })}
      maxWidth={detailDialog.isGrouped ? "lg" : "md"}
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, #0a1929 0%, #1a237e 100%)',
          border: '1px solid #00ffaa30',
          boxShadow: '0 0 30px #00ffaa20',
          ...(isMobile && {
            margin: 0,
            borderRadius: 0,
            maxHeight: '100vh',
          }),
        }
      }}
    >
      <DialogTitle sx={{ 
        color: '#00ffaa', 
        borderBottom: '1px solid #00ffaa30',
        p: isMobile ? 2 : 3
      }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant={isMobile ? "h6" : "h5"}>
            {detailDialog.isGrouped ? 'Symbol P&L Details' : 'Order Details'}
          </Typography>
          <IconButton
            onClick={() => setDetailDialog({ open: false, order: null, isGrouped: false })}
            sx={{ color: '#e0e0e0' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ mt: 2, p: isMobile ? 2 : 3 }}>
        {detailDialog.order && (
          <>
            {detailDialog.isGrouped ? (
              /* Grouped Symbol Details */
              <Box>
                {/* Summary Section */}
                <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2 }}>
                  {detailDialog.order.tradingsymbol} Summary
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #00ffaa30', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ color: '#a0a0a0' }}>P&L</Typography>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          color: detailDialog.order.pnl_absolute > 0 ? '#4CAF50' : 
                                 detailDialog.order.pnl_absolute < 0 ? '#F44336' : '#e0e0e0',
                          fontWeight: 'bold'
                        }}
                      >
                        {detailDialog.order.pnl_absolute > 0 ? '+' : ''}{formatCurrency(detailDialog.order.pnl_absolute)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                        ({detailDialog.order.pnl_percentage > 0 ? '+' : ''}{detailDialog.order.pnl_percentage.toFixed(2)}%)
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #00ffaa30', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ color: '#a0a0a0' }}>Trades</Typography>
                      <Typography variant="h6" sx={{ color: '#00ffaa' }}>
                        {detailDialog.order.total_trades}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                        {detailDialog.order.buy_orders}B / {detailDialog.order.sell_orders}S
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #00ffaa30', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ color: '#a0a0a0' }}>Position</Typography>
                      <Typography variant="h6" sx={{ color: '#00ffaa' }}>
                        {detailDialog.order.position_status}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                        Net: {formatNumber(detailDialog.order.net_quantity)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #00ffaa30', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ color: '#a0a0a0' }}>Duration</Typography>
                      <Typography variant="h6" sx={{ color: '#00ffaa' }}>
                        {detailDialog.order.trading_duration_minutes}m
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {/* Trade Details Table */}
                <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2 }}>
                  Individual Trades
                </Typography>
                <TableContainer component={Paper} sx={{ 
                  background: 'transparent',
                  border: '1px solid #00ffaa30',
                  maxHeight: 400
                }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <GradientHeader>
                        <StyledTableCell>Order ID</StyledTableCell>
                        <StyledTableCell>Type</StyledTableCell>
                        <StyledTableCell align="right">Qty</StyledTableCell>
                        <StyledTableCell align="right">Price</StyledTableCell>
                        <StyledTableCell align="right">Amount</StyledTableCell>
                        <StyledTableCell>Exchange</StyledTableCell>
                        <StyledTableCell>Time</StyledTableCell>
                      </GradientHeader>
                    </TableHead>
                    <TableBody>
                      {detailDialog.order.trade_details && detailDialog.order.trade_details.map((trade, index) => (
                        <TableRow key={index} sx={{ '&:hover': { backgroundColor: '#1a237e30' } }}>
                          <StyledTableCell>{trade.order_id}</StyledTableCell>
                          <StyledTableCell>
                            <TransactionChip
                              label={trade.type}
                              size="small"
                              transaction={trade.type}
                            />
                          </StyledTableCell>
                          <StyledTableCell align="right">{formatNumber(trade.quantity)}</StyledTableCell>
                          <StyledTableCell align="right">{formatCurrency(trade.price)}</StyledTableCell>
                          <StyledTableCell align="right">{formatCurrency(trade.cost)}</StyledTableCell>
                          <StyledTableCell>{trade.exchange}</StyledTableCell>
                          <StyledTableCell>{formatDateTime(trade.time)}</StyledTableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ) : (
              /* Individual Order Details */
              <Grid container spacing={isMobile ? 1 : 2}>
                {Object.entries(detailDialog.order).map(([key, value]) => (
                  <Grid item xs={12} sm={isMobile ? 12 : 6} key={key}>
                    <Box sx={{ 
                      p: isMobile ? 1.5 : 2, 
                      border: '1px solid #00ffaa30', 
                      borderRadius: 1,
                      background: 'rgba(0, 255, 170, 0.05)'
                    }}>
                      <Typography 
                        variant="subtitle2" 
                        sx={{ 
                          color: '#00ffaa', 
                          mb: 1,
                          fontSize: isMobile ? '0.8rem' : '0.875rem'
                        }}
                      >
                        {key.replace(/_/g, ' ').toUpperCase()}
                      </Typography>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          color: '#e0e0e0',
                          fontSize: isMobile ? '0.9rem' : '1rem'
                        }}
                      >
                        {key.includes('timestamp') ? formatDateTime(value) :
                         key.includes('price') || key.includes('quantity') ? formatNumber(value) :
                         value || 'N/A'}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  const renderStatisticsTab = () => {
    if (!statistics) return <Typography>No statistics available</Typography>;
    
    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2 }}>
                Overall Statistics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    Total Orders
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#00ffaa' }}>
                    {formatNumber(statistics.total_orders)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    Unique Symbols
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#00ffaa' }}>
                    {statistics.unique_symbols}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    Unique Users
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#00ffaa' }}>
                    {statistics.unique_users}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    Exchanges
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#00ffaa' }}>
                    {statistics.unique_exchanges}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </StyledCard>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2 }}>
                Order Status Breakdown
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Box textAlign="center">
                    <CheckCircleIcon sx={{ color: '#4CAF50', fontSize: 30 }} />
                    <Typography variant="h6" sx={{ color: '#4CAF50' }}>
                      {statistics.completed_orders}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#e0e0e0' }}>
                      Completed
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box textAlign="center">
                    <ScheduleIcon sx={{ color: '#FF9800', fontSize: 30 }} />
                    <Typography variant="h6" sx={{ color: '#FF9800' }}>
                      {statistics.open_orders}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#e0e0e0' }}>
                      Open
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box textAlign="center">
                    <CancelIcon sx={{ color: '#F44336', fontSize: 30 }} />
                    <Typography variant="h6" sx={{ color: '#F44336' }}>
                      {statistics.cancelled_orders}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#e0e0e0' }}>
                      Cancelled
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </StyledCard>
        </Grid>
        
        <Grid item xs={12}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2 }}>
                Trading Metrics
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    Total Volume
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#00ffaa' }}>
                    {formatNumber(statistics.total_quantity)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    Average Price
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#00ffaa' }}>
                    {formatCurrency(statistics.avg_price)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    First Order
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#00ffaa' }}>
                    {formatDate(statistics.earliest_order)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    Latest Order
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#00ffaa' }}>
                    {formatDate(statistics.latest_order)}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </StyledCard>
        </Grid>
      </Grid>
    );
  };

  const renderGroupedOrdersTable = () => {
    if (isMobile) {
      return renderMobileGroupedOrdersList();
    }

    return (
      <TableContainer component={Paper} sx={{ 
        background: 'linear-gradient(135deg, #0a1929 0%, #1a237e 100%)',
        border: '1px solid #00ffaa30'
      }}>
        <Table stickyHeader>
          <TableHead>
            <GradientHeader>
              <StyledTableCell>
                <TableSortLabel
                  active={sortConfig.key === 'tradingsymbol'}
                  direction={sortConfig.direction}
                  onClick={() => handleSort('tradingsymbol')}
                  sx={{ color: '#e0e0e0' }}
                >
                  Symbol
                </TableSortLabel>
              </StyledTableCell>
              <StyledTableCell align="center">Total Trades</StyledTableCell>
              <StyledTableCell align="center">Buy Orders</StyledTableCell>
              <StyledTableCell align="center">Sell Orders</StyledTableCell>
              <StyledTableCell align="right">Net Quantity</StyledTableCell>
              <StyledTableCell align="right">Avg Buy Price</StyledTableCell>
              <StyledTableCell align="right">Avg Sell Price</StyledTableCell>
              <StyledTableCell align="right">
                <TableSortLabel
                  active={sortConfig.key === 'pnl_absolute'}
                  direction={sortConfig.direction}
                  onClick={() => handleSort('pnl_absolute')}
                  sx={{ color: '#e0e0e0' }}
                >
                  P&L (₹)
                </TableSortLabel>
              </StyledTableCell>
              <StyledTableCell align="right">
                <TableSortLabel
                  active={sortConfig.key === 'pnl_percentage'}
                  direction={sortConfig.direction}
                  onClick={() => handleSort('pnl_percentage')}
                  sx={{ color: '#e0e0e0' }}
                >
                  P&L %
                </TableSortLabel>
              </StyledTableCell>
              <StyledTableCell align="center">Position</StyledTableCell>
              <StyledTableCell>Duration</StyledTableCell>
            </GradientHeader>
          </TableHead>
          <TableBody>
            {groupedOrders.map((symbolData) => (
              <HoverRow
                key={symbolData.tradingsymbol}
                onClick={() => setDetailDialog({ open: true, order: symbolData, isGrouped: true })}
              >
                <StyledTableCell>
                  <Typography variant="body2" sx={{ color: '#00ffaa', fontWeight: 'bold' }}>
                    {symbolData.tradingsymbol}
                  </Typography>
                </StyledTableCell>
                <StyledTableCell align="center">
                  {symbolData.total_trades}
                </StyledTableCell>
                <StyledTableCell align="center">
                  <Typography sx={{ color: '#4CAF50' }}>
                    {symbolData.buy_orders}
                  </Typography>
                </StyledTableCell>
                <StyledTableCell align="center">
                  <Typography sx={{ color: '#F44336' }}>
                    {symbolData.sell_orders}
                  </Typography>
                </StyledTableCell>
                <StyledTableCell align="right">
                  <Typography sx={{ 
                    color: symbolData.net_quantity > 0 ? '#4CAF50' : 
                           symbolData.net_quantity < 0 ? '#F44336' : '#FFEB3B'
                  }}>
                    {formatNumber(symbolData.net_quantity)}
                  </Typography>
                </StyledTableCell>
                <StyledTableCell align="right">
                  {formatCurrency(symbolData.avg_buy_price)}
                </StyledTableCell>
                <StyledTableCell align="right">
                  {formatCurrency(symbolData.avg_sell_price)}
                </StyledTableCell>
                <StyledTableCell align="right">
                  <Typography sx={{ 
                    color: symbolData.pnl_absolute >= 0 ? '#4CAF50' : '#F44336',
                    fontWeight: 'bold'
                  }}>
                    {symbolData.pnl_absolute >= 0 ? '+' : ''}{formatNumber(symbolData.pnl_absolute)}
                  </Typography>
                </StyledTableCell>
                <StyledTableCell align="right">
                  <Typography sx={{ 
                    color: symbolData.pnl_percentage >= 0 ? '#4CAF50' : '#F44336',
                    fontWeight: 'bold'
                  }}>
                    {symbolData.pnl_percentage >= 0 ? '+' : ''}{symbolData.pnl_percentage.toFixed(2)}%
                  </Typography>
                </StyledTableCell>
                <StyledTableCell align="center">
                  <Chip
                    label={symbolData.position_status}
                    size="small"
                    sx={{
                      color: symbolData.position_status === 'SQUARED_OFF' ? '#4CAF50' :
                             symbolData.position_status === 'LONG' ? '#2196F3' : '#FF9800',
                      backgroundColor: symbolData.position_status === 'SQUARED_OFF' ? '#4CAF5020' :
                                      symbolData.position_status === 'LONG' ? '#2196F320' : '#FF980020',
                      border: `1px solid ${symbolData.position_status === 'SQUARED_OFF' ? '#4CAF50' :
                                          symbolData.position_status === 'LONG' ? '#2196F3' : '#FF9800'}40`,
                      fontWeight: 'bold',
                      fontSize: '0.75rem',
                    }}
                  />
                </StyledTableCell>
                <StyledTableCell>
                  {symbolData.trading_duration_minutes > 0 ? 
                    `${symbolData.trading_duration_minutes}m` : 
                    'Instant'
                  }
                </StyledTableCell>
              </HoverRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderMobileGroupedOrdersList = () => (
    <Box>
      {groupedOrders.map((symbolData) => (
        <Card 
          key={symbolData.tradingsymbol}
          onClick={() => setDetailDialog({ open: true, order: symbolData, isGrouped: true })}
          sx={{
            mb: 2,
            background: symbolData.pnl_absolute > 0 ? 'linear-gradient(135deg, #0a1929 0%, #1a4d1a 100%)' : 
                       symbolData.pnl_absolute < 0 ? 'linear-gradient(135deg, #0a1929 0%, #4d1a1a 100%)' : 
                       'linear-gradient(135deg, #0a1929 0%, #1a237e 100%)',
            border: `1px solid ${symbolData.pnl_absolute > 0 ? '#4CAF5030' : 
                                symbolData.pnl_absolute < 0 ? '#F4433630' : '#00ffaa30'}`,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: `0 8px 25px ${symbolData.pnl_absolute > 0 ? 'rgba(76, 175, 80, 0.15)' : 
                                     symbolData.pnl_absolute < 0 ? 'rgba(244, 67, 54, 0.15)' : 
                                     'rgba(0, 255, 170, 0.15)'}`,
              border: `1px solid ${symbolData.pnl_absolute > 0 ? '#4CAF5060' : 
                                 symbolData.pnl_absolute < 0 ? '#F4433660' : '#00ffaa60'}`,
            },
          }}
        >
          <CardContent sx={{ p: 2 }}>
            {/* Header row with symbol and P&L */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="h6" sx={{ color: '#00ffaa', fontWeight: 'bold' }}>
                {symbolData.tradingsymbol}
              </Typography>
              <Box textAlign="right">
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: symbolData.pnl_absolute > 0 ? '#4CAF50' : 
                           symbolData.pnl_absolute < 0 ? '#F44336' : '#e0e0e0',
                    fontWeight: 'bold'
                  }}
                >
                  {symbolData.pnl_absolute > 0 ? '+' : ''}{formatCurrency(symbolData.pnl_absolute)}
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: symbolData.pnl_percentage > 0 ? '#4CAF50' : 
                           symbolData.pnl_percentage < 0 ? '#F44336' : '#e0e0e0'
                  }}
                >
                  ({symbolData.pnl_percentage > 0 ? '+' : ''}{symbolData.pnl_percentage.toFixed(2)}%)
                </Typography>
              </Box>
            </Box>
            
            {/* Trades and Status */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Chip 
                label={`${symbolData.total_trades} trades`} 
                size="small" 
                sx={{ 
                  backgroundColor: '#00ffaa20', 
                  color: '#00ffaa'
                }} 
              />
              <Chip 
                label={symbolData.position_status} 
                size="small" 
                sx={{ 
                  backgroundColor: symbolData.position_status === 'SQUARED_OFF' ? '#4CAF5020' : 
                                 symbolData.position_status === 'LONG' ? '#2196F320' : '#FF980020',
                  color: symbolData.position_status === 'SQUARED_OFF' ? '#4CAF50' : 
                         symbolData.position_status === 'LONG' ? '#2196F3' : '#FF9800'
                }} 
              />
            </Box>
            
            {/* Quantities */}
            <Grid container spacing={2} sx={{ mb: 1 }}>
              <Grid item xs={4}>
                <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                  Buy Qty
                </Typography>
                <Typography variant="body1" sx={{ color: '#4CAF50', fontWeight: 'bold' }}>
                  {formatNumber(symbolData.buy_quantity)}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                  Sell Qty
                </Typography>
                <Typography variant="body1" sx={{ color: '#F44336', fontWeight: 'bold' }}>
                  {formatNumber(symbolData.sell_quantity)}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                  Net Qty
                </Typography>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    color: symbolData.net_quantity > 0 ? '#4CAF50' : 
                           symbolData.net_quantity < 0 ? '#F44336' : '#e0e0e0',
                    fontWeight: 'bold'
                  }}
                >
                  {formatNumber(symbolData.net_quantity)}
                </Typography>
              </Grid>
            </Grid>
            
            {/* Prices */}
            <Grid container spacing={2} sx={{ mb: 1 }}>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                  Avg Buy Price
                </Typography>
                <Typography variant="body1" sx={{ color: '#e0e0e0', fontWeight: 'bold' }}>
                  {formatCurrency(symbolData.avg_buy_price)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                  Avg Sell Price
                </Typography>
                <Typography variant="body1" sx={{ color: '#e0e0e0', fontWeight: 'bold' }}>
                  {formatCurrency(symbolData.avg_sell_price)}
                </Typography>
              </Grid>
            </Grid>
            
            {/* Duration and trade range */}
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                Duration: {symbolData.trading_duration_minutes}m
              </Typography>
              <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                {symbolData.buy_orders}B / {symbolData.sell_orders}S
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );

  const renderGroupedTable = () => {
    if (isMobile) {
      return renderMobileGroupedList();
    }

    return (
      <TableContainer component={Paper} sx={{ 
        background: 'linear-gradient(135deg, #0a1929 0%, #1a237e 100%)',
        border: '1px solid #00ffaa30'
      }}>
        <Table stickyHeader>
          <TableHead>
            <GradientHeader>
              <StyledTableCell>Symbol</StyledTableCell>
              <StyledTableCell align="center">Trades</StyledTableCell>
              <StyledTableCell align="center">Buy Qty</StyledTableCell>
              <StyledTableCell align="center">Sell Qty</StyledTableCell>
              <StyledTableCell align="center">Net Qty</StyledTableCell>
              <StyledTableCell align="right">Avg Buy Price</StyledTableCell>
              <StyledTableCell align="right">Avg Sell Price</StyledTableCell>
              <StyledTableCell align="right">P&L</StyledTableCell>
              <StyledTableCell align="right">P&L %</StyledTableCell>
              <StyledTableCell align="center">Status</StyledTableCell>
              <StyledTableCell align="center">Duration</StyledTableCell>
            </GradientHeader>
          </TableHead>
          <TableBody>
            {groupedOrders.map((group) => (
              <HoverRow
                key={group.tradingsymbol}
                onClick={() => setDetailDialog({ open: true, order: group, isGrouped: true })}
                sx={{
                  backgroundColor: group.pnl_absolute > 0 ? '#4CAF5010' : 
                                 group.pnl_absolute < 0 ? '#F4433610' : 'transparent'
                }}
              >
                <StyledTableCell>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#00ffaa' }}>
                    {group.tradingsymbol}
                  </Typography>
                </StyledTableCell>
                <StyledTableCell align="center">
                  <Chip 
                    label={group.total_trades} 
                    size="small" 
                    sx={{ 
                      backgroundColor: '#00ffaa20', 
                      color: '#00ffaa',
                      fontWeight: 'bold'
                    }} 
                  />
                </StyledTableCell>
                <StyledTableCell align="center">
                  <Typography variant="body2" sx={{ color: '#4CAF50' }}>
                    {formatNumber(group.buy_quantity)}
                  </Typography>
                </StyledTableCell>
                <StyledTableCell align="center">
                  <Typography variant="body2" sx={{ color: '#F44336' }}>
                    {formatNumber(group.sell_quantity)}
                  </Typography>
                </StyledTableCell>
                <StyledTableCell align="center">
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: group.net_quantity > 0 ? '#4CAF50' : 
                             group.net_quantity < 0 ? '#F44336' : '#e0e0e0',
                      fontWeight: 'bold'
                    }}
                  >
                    {formatNumber(group.net_quantity)}
                  </Typography>
                </StyledTableCell>
                <StyledTableCell align="right">
                  {formatCurrency(group.avg_buy_price)}
                </StyledTableCell>
                <StyledTableCell align="right">
                  {formatCurrency(group.avg_sell_price)}
                </StyledTableCell>
                <StyledTableCell align="right">
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: group.pnl_absolute > 0 ? '#4CAF50' : 
                             group.pnl_absolute < 0 ? '#F44336' : '#e0e0e0',
                      fontWeight: 'bold'
                    }}
                  >
                    {group.pnl_absolute > 0 ? '+' : ''}{formatCurrency(group.pnl_absolute)}
                  </Typography>
                </StyledTableCell>
                <StyledTableCell align="right">
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: group.pnl_percentage > 0 ? '#4CAF50' : 
                             group.pnl_percentage < 0 ? '#F44336' : '#e0e0e0',
                      fontWeight: 'bold'
                    }}
                  >
                    {group.pnl_percentage > 0 ? '+' : ''}{group.pnl_percentage.toFixed(2)}%
                  </Typography>
                </StyledTableCell>
                <StyledTableCell align="center">
                  <Chip 
                    label={group.position_status} 
                    size="small" 
                    sx={{ 
                      backgroundColor: group.position_status === 'SQUARED_OFF' ? '#4CAF5020' : 
                                     group.position_status === 'LONG' ? '#2196F320' : '#FF980020',
                      color: group.position_status === 'SQUARED_OFF' ? '#4CAF50' : 
                             group.position_status === 'LONG' ? '#2196F3' : '#FF9800',
                      fontSize: '0.7rem'
                    }} 
                  />
                </StyledTableCell>
                <StyledTableCell align="center">
                  <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                    {group.trading_duration_minutes}m
                  </Typography>
                </StyledTableCell>
              </HoverRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderMobileGroupedList = () => (
    <Box>
      {groupedOrders.map((group) => (
        <Card 
          key={group.tradingsymbol}
          onClick={() => setDetailDialog({ open: true, order: group, isGrouped: true })}
          sx={{
            mb: 2,
            background: group.pnl_absolute > 0 ? 'linear-gradient(135deg, #0a1929 0%, #1a4d1a 100%)' : 
                       group.pnl_absolute < 0 ? 'linear-gradient(135deg, #0a1929 0%, #4d1a1a 100%)' : 
                       'linear-gradient(135deg, #0a1929 0%, #1a237e 100%)',
            border: `1px solid ${group.pnl_absolute > 0 ? '#4CAF5030' : 
                                group.pnl_absolute < 0 ? '#F4433630' : '#00ffaa30'}`,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: `0 8px 25px ${group.pnl_absolute > 0 ? 'rgba(76, 175, 80, 0.15)' : 
                                     group.pnl_absolute < 0 ? 'rgba(244, 67, 54, 0.15)' : 
                                     'rgba(0, 255, 170, 0.15)'}`,
              border: `1px solid ${group.pnl_absolute > 0 ? '#4CAF5060' : 
                                 group.pnl_absolute < 0 ? '#F4433660' : '#00ffaa60'}`,
            },
          }}
        >
          <CardContent sx={{ p: 2 }}>
            {/* Header row with symbol and P&L */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="h6" sx={{ color: '#00ffaa', fontWeight: 'bold' }}>
                {group.tradingsymbol}
              </Typography>
              <Box textAlign="right">
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: group.pnl_absolute > 0 ? '#4CAF50' : 
                           group.pnl_absolute < 0 ? '#F44336' : '#e0e0e0',
                    fontWeight: 'bold'
                  }}
                >
                  {group.pnl_absolute > 0 ? '+' : ''}{formatCurrency(group.pnl_absolute)}
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: group.pnl_percentage > 0 ? '#4CAF50' : 
                           group.pnl_percentage < 0 ? '#F44336' : '#e0e0e0'
                  }}
                >
                  ({group.pnl_percentage > 0 ? '+' : ''}{group.pnl_percentage.toFixed(2)}%)
                </Typography>
              </Box>
            </Box>
            
            {/* Trades and Status */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Chip 
                label={`${group.total_trades} trades`} 
                size="small" 
                sx={{ 
                  backgroundColor: '#00ffaa20', 
                  color: '#00ffaa'
                }} 
              />
              <Chip 
                label={group.position_status} 
                size="small" 
                sx={{ 
                  backgroundColor: group.position_status === 'SQUARED_OFF' ? '#4CAF5020' : 
                                 group.position_status === 'LONG' ? '#2196F320' : '#FF980020',
                  color: group.position_status === 'SQUARED_OFF' ? '#4CAF50' : 
                         group.position_status === 'LONG' ? '#2196F3' : '#FF9800'
                }} 
              />
            </Box>
            
            {/* Quantities */}
            <Grid container spacing={2} sx={{ mb: 1 }}>
              <Grid item xs={4}>
                <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                  Buy Qty
                </Typography>
                <Typography variant="body1" sx={{ color: '#4CAF50', fontWeight: 'bold' }}>
                  {formatNumber(group.buy_quantity)}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                  Sell Qty
                </Typography>
                <Typography variant="body1" sx={{ color: '#F44336', fontWeight: 'bold' }}>
                  {formatNumber(group.sell_quantity)}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                  Net Qty
                </Typography>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    color: group.net_quantity > 0 ? '#4CAF50' : 
                           group.net_quantity < 0 ? '#F44336' : '#e0e0e0',
                    fontWeight: 'bold'
                  }}
                >
                  {formatNumber(group.net_quantity)}
                </Typography>
              </Grid>
            </Grid>
            
            {/* Prices */}
            <Grid container spacing={2} sx={{ mb: 1 }}>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                  Avg Buy Price
                </Typography>
                <Typography variant="body1" sx={{ color: '#e0e0e0', fontWeight: 'bold' }}>
                  {formatCurrency(group.avg_buy_price)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                  Avg Sell Price
                </Typography>
                <Typography variant="body1" sx={{ color: '#e0e0e0', fontWeight: 'bold' }}>
                  {formatCurrency(group.avg_sell_price)}
                </Typography>
              </Grid>
            </Grid>
            
            {/* Duration and trade range */}
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                Duration: {group.trading_duration_minutes}m
              </Typography>
              <Typography variant="caption" sx={{ color: '#a0a0a0' }}>
                {group.buy_orders}B / {group.sell_orders}S
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );

  return (
    <Box sx={{ backgroundColor: '#0a1929', minHeight: '100vh', pb: 4 }}>
      <CustomAppBar />
      
      <Container maxWidth="xl" sx={{ mt: 4, px: isMobile ? 1 : 3 }}>
        <Box 
          display="flex" 
          justifyContent="space-between" 
          alignItems={isMobile ? "flex-start" : "center"} 
          mb={3}
          flexDirection={isMobile ? "column" : "row"}
          gap={isMobile ? 2 : 0}
        >
          <Typography 
            variant={isMobile ? "h5" : "h4"} 
            sx={{ 
              color: '#00ffaa', 
              fontWeight: 'bold',
              textShadow: '0 0 10px #00ffaa50'
            }}
          >
            Live Trade Order Book
          </Typography>
          
          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
            <Badge 
              badgeContent={filteredOrders.length} 
              color="primary"
              sx={{ '& .MuiBadge-badge': { backgroundColor: '#00ffaa', color: '#000' } }}
            >
              <TimelineIcon sx={{ color: '#00ffaa' }} />
            </Badge>
            
            {/* Auto-refresh status and controls */}
            <Box display="flex" alignItems="center" gap={1}>
              <Tooltip title={`Last refresh: ${formatLastRefresh()}`}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: '#e0e0e0',
                    fontSize: isMobile ? '0.7rem' : '0.75rem'
                  }}
                >
                  {formatLastRefresh()}
                </Typography>
              </Tooltip>
              
              <Button
                size="small"
                onClick={handleManualRefresh}
                sx={{ 
                  color: '#00ffaa',
                  minWidth: 'auto',
                  p: 1
                }}
                disabled={loading}
              >
                <RefreshIcon />
              </Button>
              
              <Button
                size="small"
                onClick={toggleAutoRefresh}
                sx={{ 
                  color: autoRefreshEnabled ? '#00ffaa' : '#666',
                  fontSize: isMobile ? '0.7rem' : '0.75rem',
                  minWidth: 'auto'
                }}
              >
                Auto {autoRefreshEnabled ? 'ON' : 'OFF'}
              </Button>
            </Box>
            
            {currentTab === 1 && (
              <TextField
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                size="small"
                InputLabelProps={{ shrink: true, sx: { color: '#e0e0e0' } }}
                sx={{ 
                  '& .MuiInputBase-input': { color: '#e0e0e0' },
                  '& .MuiOutlinedInput-root': { 
                    '& fieldset': { borderColor: '#00ffaa60' },
                    '&:hover fieldset': { borderColor: '#00ffaa' },
                    '&.Mui-focused fieldset': { borderColor: '#00ffaa' }
                  }
                }}
              />
            )}
          </Box>
        </Box>

        <Paper sx={{ 
          background: 'linear-gradient(135deg, #0a1929 0%, #1a237e 100%)',
          border: '1px solid #00ffaa30',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            variant={isMobile ? "fullWidth" : "standard"}
            sx={{
              '& .MuiTab-root': { 
                color: '#e0e0e0',
                fontSize: isMobile ? '0.75rem' : '0.875rem',
                minHeight: isMobile ? '48px' : '64px',
                '&.Mui-selected': { color: '#00ffaa' }
              },
              '& .MuiTabs-indicator': { backgroundColor: '#00ffaa' },
              borderBottom: '1px solid #00ffaa30'
            }}
          >
            <Tab 
              icon={<TodayIcon />} 
              label={isMobile ? "Today" : "Today's Orders"} 
              iconPosition="start"
            />
            <Tab 
              icon={<HistoryIcon />} 
              label={isMobile ? "History" : "Historical Orders"} 
              iconPosition="start"
            />
            <Tab 
              icon={<AssessmentIcon />} 
              label={isMobile ? "Stats" : "Statistics"} 
              iconPosition="start"
            />
          </Tabs>

          <Box p={isMobile ? 2 : 3}>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress sx={{ color: '#00ffaa' }} />
              </Box>
            ) : (
              <>
                {(currentTab === 0 || currentTab === 1) && (
                  <>
                    {renderSummaryCards()}
                    {renderFilters()}
                    
                    {/* View Mode Toggle */}
                    <Box mb={2} display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap">
                      <Typography variant="h6" sx={{ color: '#00ffaa', mb: isMobile ? 1 : 0 }}>
                        {viewMode === 'list' ? `Orders (${filteredOrders.length})` : `Grouped by Symbol (${groupedOrders.length})`}
                      </Typography>
                      <Box display="flex" gap={1}>
                        <Button
                          size="small"
                          variant={viewMode === 'list' ? 'contained' : 'outlined'}
                          startIcon={<ViewListIcon />}
                          onClick={() => handleViewModeChange('list')}
                          sx={{
                            color: viewMode === 'list' ? '#000' : '#00ffaa',
                            backgroundColor: viewMode === 'list' ? '#00ffaa' : 'transparent',
                            borderColor: '#00ffaa',
                            '&:hover': {
                              backgroundColor: viewMode === 'list' ? '#00ffaa' : '#00ffaa20',
                            }
                          }}
                        >
                          {isMobile ? 'List' : 'List View'}
                        </Button>
                        <Button
                          size="small"
                          variant={viewMode === 'grouped' ? 'contained' : 'outlined'}
                          startIcon={<ViewModuleIcon />}
                          onClick={() => handleViewModeChange('grouped')}
                          sx={{
                            color: viewMode === 'grouped' ? '#000' : '#00ffaa',
                            backgroundColor: viewMode === 'grouped' ? '#00ffaa' : 'transparent',
                            borderColor: '#00ffaa',
                            '&:hover': {
                              backgroundColor: viewMode === 'grouped' ? '#00ffaa' : '#00ffaa20',
                            }
                          }}
                        >
                          {isMobile ? 'P&L' : 'Grouped P&L'}
                        </Button>
                      </Box>
                    </Box>
                    
                    <Box mb={2}>
                      {viewMode === 'list' ? (
                        filteredOrders.length === 0 ? (
                          <Alert severity="info" sx={{ 
                            backgroundColor: '#00ffaa20',
                            color: '#e0e0e0',
                            '& .MuiAlert-icon': { color: '#00ffaa' }
                          }}>
                            No orders found for the selected criteria
                          </Alert>
                        ) : (
                          renderOrdersTable()
                        )
                      ) : (
                        groupedOrders.length === 0 ? (
                          <Alert severity="info" sx={{ 
                            backgroundColor: '#00ffaa20',
                            color: '#e0e0e0',
                            '& .MuiAlert-icon': { color: '#00ffaa' }
                          }}>
                            No grouped data available for the selected date
                          </Alert>
                        ) : (
                          renderGroupedTable()
                        )
                      )}
                    </Box>
                  </>
                )}
                
                {currentTab === 2 && renderStatisticsTab()}
              </>
            )}
          </Box>
        </Paper>
      </Container>

      {renderOrderDetail()}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ 
            backgroundColor: snackbar.severity === 'error' ? '#F4433620' : 
                             snackbar.severity === 'success' ? '#4CAF5020' : '#00ffaa20',
            color: '#e0e0e0'
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default LiveTradeOrderBook;
