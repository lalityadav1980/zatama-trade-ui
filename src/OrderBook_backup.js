import React, { useEffect, useState } from 'react';
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
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  CircularProgress,
  useMediaQuery,
  useTheme,
  Chip,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  IconButton,
  Divider
} from '@mui/material';
import { ExpandMore, ExpandLess, FilterList, Clear } from '@mui/icons-material';
import CustomAppBar from './CustomAppBar';
import { httpApi } from './api';
import moment from 'moment';

// Styled components similar to Signal.jsx
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
  },
}));

const SummaryCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)',
  border: '1px solid #00ffaa30',
  borderRadius: '12px',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(0, 255, 170, 0.15)',
  },
}));

const MobileOrderCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)',
  border: '1px solid #00ffaa30',
  borderRadius: '8px',
  marginBottom: '8px',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 15px rgba(0, 255, 170, 0.15)',
  },
}));

const formatNumber = (value) => {
  const num = Number(value);
  return isNaN(num) ? value : num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    // Parse the UTC timestamp and keep it as UTC
    const parsed = moment.utc(dateString);
    if (!parsed.isValid()) return dateString;
    
    // Format as UTC time
    return parsed.format('DD-MM-YY HH:mm');
  } catch (error) {
    return dateString;
  }
};

const OrderBook = () => {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderBy, setOrderBy] = useState('exchange_timestamp');
  const [orderDirection, setOrderDirection] = useState('desc');
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    filterType: 'current-date', // Changed from 'all' to 'current-date'
    startDate: '',
    endDate: '',
    minPnl: '',
    maxPnl: '',
    minMargin: '',
    maxMargin: '',
    tag: '',
    symbol: '',
    dateFilter: 'current'
  });
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const fetchOrderBook = async () => {
    try {
      setLoading(true);
      
      let url = '/orders_book';
      let params = {};
      
      // Determine API endpoint based on filter type
      switch (filters.filterType) {
        case 'current-date':
          url = '/orders_book/current-date';
          break;
        case 'date-range':
          url = '/orders_book/date-range';
          if (filters.startDate) params.start_date = filters.startDate;
          if (filters.endDate) params.end_date = filters.endDate;
          break;
        case 'pnl':
          url = '/orders_book/pnl';
          if (filters.minPnl !== '') params.min_pnl = parseFloat(filters.minPnl);
          if (filters.maxPnl !== '') params.max_pnl = parseFloat(filters.maxPnl);
          if (filters.dateFilter && filters.dateFilter !== 'all') params.date_filter = filters.dateFilter;
          break;
        case 'margin':
          url = '/orders_book/margin';
          if (filters.minMargin !== '') params.min_margin = parseFloat(filters.minMargin);
          if (filters.maxMargin !== '') params.max_margin = parseFloat(filters.maxMargin);
          if (filters.dateFilter && filters.dateFilter !== 'all') params.date_filter = filters.dateFilter;
          break;
        case 'tag':
          url = '/orders_book/tag';
          if (filters.tag) params.tag = filters.tag;
          if (filters.dateFilter && filters.dateFilter !== 'all') params.date_filter = filters.dateFilter;
          break;
        case 'symbol':
          url = '/orders_book/symbol';
          if (filters.symbol) params.tradingsymbol = filters.symbol;
          if (filters.dateFilter && filters.dateFilter !== 'all') params.date_filter = filters.dateFilter;
          break;
        default:
          url = '/orders_book';
      }

      const response = await httpApi.get(url, {
        params,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const data = response.data;
      console.log('API Response:', data);
      console.log('Records count:', data.records?.length);
      console.log('First record:', data.records?.[0]);
      
      // Process records to ensure proper data types
      const processedRecords = (data.records || []).map(record => ({
        ...record,
        matched_pnl: record.matched_pnl === null || record.matched_pnl === undefined || record.matched_pnl === "" || isNaN(record.matched_pnl)
          ? null 
          : parseFloat(record.matched_pnl) || 0,
        price: parseFloat(record.price) || 0,
        available_margin: isNaN(parseFloat(record.available_margin)) ? 0 : parseFloat(record.available_margin),
        quantity: parseInt(record.quantity) || 0,
        buy_cost: isNaN(parseFloat(record.buy_cost)) ? null : parseFloat(record.buy_cost),
        sell_cost: isNaN(parseFloat(record.sell_cost)) ? null : parseFloat(record.sell_cost)
      }));
      
      console.log('Processed records:', processedRecords);
      console.log('Processed records:', processedRecords);
      console.log('Setting records to state, length:', processedRecords.length);
      setRecords(processedRecords);

      const raw = data.summary || {};
      setSummary({
        initial_capital: parseFloat(raw.initial_capital) || 0,
        total_buy_cost: parseFloat(raw.total_buy_cost) || 0,
        total_sell_cost: parseFloat(raw.total_sell_cost) || 0,
        capital_change: parseFloat(raw.capital_change) || 0,
        capital_change_percentage: parseFloat(raw.capital_change_percentage) || 0
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderBook();
    const intervalId = setInterval(fetchOrderBook, 30000); // Refresh every 30 seconds
    return () => clearInterval(intervalId);
  }, [filters]); // Add filters as dependency

  const handleSort = (property) => {
    const isAsc = orderBy === property && orderDirection === 'asc';
    setOrderBy(property);
    setOrderDirection(isAsc ? 'desc' : 'asc');
  };

  console.log('Current records state:', records);
  console.log('Current records length:', records.length);
  
  const sortedData = [...records].sort((a, b) => {
    console.log('Sorting records, length before sort:', records.length);
    if (orderBy === 'exchange_timestamp') {
      const aVal = moment(a.exchange_timestamp).valueOf();
      const bVal = moment(b.exchange_timestamp).valueOf();
      return orderDirection === 'asc' ? aVal - bVal : bVal - aVal;
    } else {
      const aVal = a[orderBy] || 0;
      const bVal = b[orderBy] || 0;
      if (typeof aVal === 'string') {
        return orderDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return orderDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
  });
  
  console.log('Sorted data length:', sortedData.length);
  console.log('First sorted record:', sortedData[0]);

  // Debug log
  console.log('Records state:', records);
  console.log('Sorted data:', sortedData);
  console.log('Loading state:', loading);
  console.log('Error state:', error);

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

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFilterSubmit = () => {
    fetchOrderBook();
  };

  const clearFilters = () => {
    setFilters({
      filterType: 'current-date', // Changed from 'all' to 'current-date'
      startDate: '',
      endDate: '',
      minPnl: '',
      maxPnl: '',
      minMargin: '',
      maxMargin: '',
      tag: '',
      symbol: '',
      dateFilter: 'current'
    });
  };

  const renderFilterControls = () => {
    return (
      <Card sx={{ 
        mb: 2, 
        background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)',
        border: '1px solid #00ffaa30'
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <FilterList sx={{ color: '#00ffaa', mr: 1 }} />
            <Typography variant="h6" sx={{ color: '#e0e0e0', flexGrow: 1 }}>
              Filters
            </Typography>
            <IconButton
              onClick={() => setShowFilters(!showFilters)}
              sx={{ color: '#00ffaa' }}
            >
              {showFilters ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
          
          <Collapse in={showFilters}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ color: '#e0e0e0' }}>Filter Type</InputLabel>
                  <Select
                    value={filters.filterType}
                    onChange={(e) => handleFilterChange('filterType', e.target.value)}
                    label="Filter Type"
                    sx={{
                      color: '#e0e0e0',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa30' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa60' }
                    }}
                  >
                    <MenuItem value="all">All Orders</MenuItem>
                    <MenuItem value="current-date">Current Date</MenuItem>
                    <MenuItem value="date-range">Date Range</MenuItem>
                    <MenuItem value="pnl">P&L Range</MenuItem>
                    <MenuItem value="margin">Margin Range</MenuItem>
                    <MenuItem value="tag">By Tag</MenuItem>
                    <MenuItem value="symbol">By Symbol</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {filters.filterType === 'date-range' && (
                <>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label="Start Date"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange('startDate', e.target.value)}
                      InputLabelProps={{ shrink: true, sx: { color: '#e0e0e0' } }}
                      sx={{
                        '& input': { color: '#e0e0e0' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa30' }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label="End Date"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange('endDate', e.target.value)}
                      InputLabelProps={{ shrink: true, sx: { color: '#e0e0e0' } }}
                      sx={{
                        '& input': { color: '#e0e0e0' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa30' }
                      }}
                    />
                  </Grid>
                </>
              )}

              {filters.filterType === 'pnl' && (
                <>
                  <Grid item xs={12} sm={6} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Min P&L"
                      value={filters.minPnl}
                      onChange={(e) => handleFilterChange('minPnl', e.target.value)}
                      InputLabelProps={{ sx: { color: '#e0e0e0' } }}
                      sx={{
                        '& input': { color: '#e0e0e0' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa30' }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Max P&L"
                      value={filters.maxPnl}
                      onChange={(e) => handleFilterChange('maxPnl', e.target.value)}
                      InputLabelProps={{ sx: { color: '#e0e0e0' } }}
                      sx={{
                        '& input': { color: '#e0e0e0' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa30' }
                      }}
                    />
                  </Grid>
                </>
              )}

              {filters.filterType === 'margin' && (
                <>
                  <Grid item xs={12} sm={6} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Min Margin"
                      value={filters.minMargin}
                      onChange={(e) => handleFilterChange('minMargin', e.target.value)}
                      InputLabelProps={{ sx: { color: '#e0e0e0' } }}
                      sx={{
                        '& input': { color: '#e0e0e0' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa30' }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Max Margin"
                      value={filters.maxMargin}
                      onChange={(e) => handleFilterChange('maxMargin', e.target.value)}
                      InputLabelProps={{ sx: { color: '#e0e0e0' } }}
                      sx={{
                        '& input': { color: '#e0e0e0' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa30' }
                      }}
                    />
                  </Grid>
                </>
              )}

              {filters.filterType === 'tag' && (
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Tag"
                    value={filters.tag}
                    onChange={(e) => handleFilterChange('tag', e.target.value)}
                    InputLabelProps={{ sx: { color: '#e0e0e0' } }}
                    sx={{
                      '& input': { color: '#e0e0e0' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa30' }
                    }}
                  />
                </Grid>
              )}

              {filters.filterType === 'symbol' && (
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Trading Symbol"
                    value={filters.symbol}
                    onChange={(e) => handleFilterChange('symbol', e.target.value)}
                    InputLabelProps={{ sx: { color: '#e0e0e0' } }}
                    sx={{
                      '& input': { color: '#e0e0e0' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa30' }
                    }}
                  />
                </Grid>
              )}

              {(filters.filterType === 'pnl' || filters.filterType === 'margin' || 
                filters.filterType === 'tag' || filters.filterType === 'symbol') && (
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ color: '#e0e0e0' }}>Date Filter</InputLabel>
                    <Select
                      value={filters.dateFilter}
                      onChange={(e) => handleFilterChange('dateFilter', e.target.value)}
                      label="Date Filter"
                      sx={{
                        color: '#e0e0e0',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa30' }
                      }}
                    >
                      <MenuItem value="all">All Dates</MenuItem>
                      <MenuItem value="current">Current Date</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Button
                    variant="contained"
                    onClick={handleFilterSubmit}
                    sx={{
                      background: 'linear-gradient(45deg, #00ffaa 30%, #00cc88 90%)',
                      color: '#000',
                      '&:hover': { background: 'linear-gradient(45deg, #00cc88 30%, #00ffaa 90%)' }
                    }}
                  >
                    Apply Filters
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={clearFilters}
                    startIcon={<Clear />}
                    sx={{
                      borderColor: '#00ffaa',
                      color: '#00ffaa',
                      '&:hover': { borderColor: '#00cc88', backgroundColor: '#00ffaa10' }
                    }}
                  >
                    Clear
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>
    );
  };

  const MobileOrderView = ({ order, index }) => (
    <MobileOrderCard key={index}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ color: '#00ffaa', fontWeight: 'bold' }}>
            {order.tradingsymbol || 'N/A'}
          </Typography>
          <Chip 
            label={order.transaction_type || 'N/A'}
            size="small"
            sx={{ 
              backgroundColor: order.transaction_type === 'BUY' ? '#4CAF5030' : '#F4433630',
              color: order.transaction_type === 'BUY' ? '#4CAF50' : '#F44336',
              fontWeight: 'bold'
            }}
          />
        </Box>
        
        <Grid container spacing={1} sx={{ fontSize: '0.875rem' }}>
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
              Price: <span style={{ color: '#FFEB3B' }}>₹{formatNumber(order.price)}</span>
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
              Qty: <span style={{ color: '#FFEB3B' }}>{order.quantity}</span>
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
              P&L: <span style={{ 
                color: order.matched_pnl === null ? '#9E9E9E' : 
                       order.matched_pnl >= 0 ? '#4CAF50' : '#F44336' 
              }}>
                {order.matched_pnl === null ? 'N/A' : `₹${formatNumber(order.matched_pnl)}`}
              </span>
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
              Tag: <span style={{ color: '#FFEB3B' }}>{order.tag || 'N/A'}</span>
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" sx={{ color: '#e0e0e0', mt: 0.5 }}>
              Time (UTC): <span style={{ color: '#00ffaa' }}>{formatDateTime(order.exchange_timestamp)}</span>
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </MobileOrderCard>
  );

  return (
    <>
      <CustomAppBar />
      <Container maxWidth="xl" sx={{
        borderRadius: '8px',
        border: '1px solid #00ffaa30',
        boxShadow: '0 0 20px #00ffaa20',
        background: '#0a1929',
        mt: 1,
        minHeight: '100vh'
      }}>
        {/* Summary Cards */}
        {summary && (
          <Grid container spacing={2} sx={{ mb: 3, pt: 2 }}>
            <Grid item xs={12} sm={6} md={2.4}>
              <SummaryCard>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
                    Initial Capital
                  </Typography>
                  <Typography variant="h5" sx={{ color: '#00ffaa', fontWeight: 'bold' }}>
                    ₹{formatNumber(summary.initial_capital)}
                  </Typography>
                </CardContent>
              </SummaryCard>
            </Grid>
            
            <Grid item xs={12} sm={6} md={2.4}>
              <SummaryCard>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
                    Total Buy Cost
                  </Typography>
                  <Typography variant="h5" sx={{ color: '#4CAF50', fontWeight: 'bold' }}>
                    ₹{formatNumber(summary.total_buy_cost)}
                  </Typography>
                </CardContent>
              </SummaryCard>
            </Grid>
            
            <Grid item xs={12} sm={6} md={2.4}>
              <SummaryCard>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
                    Total Sell Cost
                  </Typography>
                  <Typography variant="h5" sx={{ color: '#F44336', fontWeight: 'bold' }}>
                    ₹{formatNumber(summary.total_sell_cost)}
                  </Typography>
                </CardContent>
              </SummaryCard>
            </Grid>
            
            <Grid item xs={12} sm={6} md={2.4}>
              <SummaryCard>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
                    Capital Change
                  </Typography>
                  <Typography variant="h5" sx={{ 
                    color: summary.capital_change >= 0 ? '#4CAF50' : '#F44336',
                    fontWeight: 'bold'
                  }}>
                    {summary.capital_change >= 0 ? '+' : ''}₹{formatNumber(Math.abs(summary.capital_change))}
                  </Typography>
                </CardContent>
              </SummaryCard>
            </Grid>
            
            <Grid item xs={12} sm={6} md={2.4}>
              <SummaryCard>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
                    Change %
                  </Typography>
                  <Typography variant="h5" sx={{ 
                    color: summary.capital_change_percentage >= 0 ? '#4CAF50' : '#F44336',
                    fontWeight: 'bold'
                  }}>
                    {summary.capital_change_percentage >= 0 ? '+' : ''}{formatNumber(summary.capital_change_percentage)}%
                  </Typography>
                </CardContent>
              </SummaryCard>
            </Grid>
          </Grid>
        )}

        {/* Filter Controls */}
        {renderFilterControls()}

        {/* Mobile View */}
        {isMobile ? (
          <Box sx={{ pb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#e0e0e0' }}>
                Order Book
              </Typography>
              <Chip 
                label={`${records.length} orders`}
                sx={{ 
                  backgroundColor: '#00ffaa20',
                  color: '#00ffaa',
                  fontWeight: 'bold'
                }}
              />
            </Box>
            {sortedData.map((order, index) => (
              <MobileOrderView key={index} order={order} index={index} />
            ))}
          </Box>
        ) : (
          /* Desktop Table View */
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#e0e0e0' }}>
                Order Book
              </Typography>
              <Chip 
                label={`${records.length} orders`}
                sx={{ 
                  backgroundColor: '#00ffaa20',
                  color: '#00ffaa',
                  fontWeight: 'bold'
                }}
              />
            </Box>
            <TableContainer 
              component={Paper}
              sx={{
                background: '#0a1929',
                border: '1px solid #00ffaa30',
                mb: 2
              }}
            >
            <Table stickyHeader sx={{ minWidth: 1000 }}>
              <TableHead>
                <GradientHeader>
                  {[
                    { label: 'Date & Time (UTC)', prop: 'exchange_timestamp', width: '160px' },
                    { label: 'Symbol', prop: 'tradingsymbol', align: 'left' },
                    { label: 'Type', prop: 'transaction_type', align: 'center' },
                    { label: 'Price', prop: 'price', align: 'right' },
                    { label: 'Quantity', prop: 'quantity', align: 'right' },
                    { label: 'Tag', prop: 'tag', align: 'center' },
                    { label: 'P&L', prop: 'matched_pnl', align: 'right' },
                    { label: 'Margin', prop: 'available_margin', align: 'right' },
                  ].map((head) => (
                    <StyledTableCell
                      key={head.label}
                      align={head.align || 'left'}
                      sx={{ width: head.width }}
                    >
                      <TableSortLabel
                        active={orderBy === head.prop}
                        direction={orderDirection}
                        onClick={() => handleSort(head.prop)}
                        sx={{ 
                          color: '#e0e0e0 !important',
                          '&:hover': { color: '#00ffaa !important' },
                          '& .MuiTableSortLabel-icon': { color: '#00ffaa !important' }
                        }}
                      >
                        {head.label}
                      </TableSortLabel>
                    </StyledTableCell>
                  ))}
                </GradientHeader>
              </TableHead>
              <TableBody>
                {sortedData.map((order, index) => (
                  <HoverRow key={index}>
                    <StyledTableCell sx={{ color: '#00ffaa' }}>
                      {formatDateTime(order.exchange_timestamp)}
                    </StyledTableCell>
                    
                    <StyledTableCell sx={{ color: '#FFEB3B' }}>
                      {order.tradingsymbol || 'N/A'}
                    </StyledTableCell>
                    
                    <StyledTableCell align="center">
                      <Chip 
                        label={order.transaction_type || 'N/A'}
                        size="small"
                        sx={{ 
                          backgroundColor: order.transaction_type === 'BUY' ? '#4CAF5030' : '#F4433630',
                          color: order.transaction_type === 'BUY' ? '#4CAF50' : '#F44336',
                          fontWeight: 'bold'
                        }}
                      />
                    </StyledTableCell>
                    
                    <StyledTableCell align="right" sx={{ color: '#FFEB3B' }}>
                      ₹{formatNumber(order.price)}
                    </StyledTableCell>
                    
                    <StyledTableCell align="right" sx={{ color: '#e0e0e0' }}>
                      {order.quantity}
                    </StyledTableCell>
                    
                    <StyledTableCell align="center" sx={{ color: '#e0e0e0' }}>
                      {order.tag || 'N/A'}
                    </StyledTableCell>
                    
                    <StyledTableCell align="right" sx={{ 
                      color: order.matched_pnl === null ? '#9E9E9E' : 
                             order.matched_pnl >= 0 ? '#4CAF50' : '#F44336',
                      fontWeight: 'bold'
                    }}>
                      {order.matched_pnl === null ? 'N/A' : `₹${formatNumber(order.matched_pnl)}`}
                    </StyledTableCell>
                    
                    <StyledTableCell align="right" sx={{ color: '#e0e0e0' }}>
                      ₹{formatNumber(order.available_margin)}
                    </StyledTableCell>
                  </HoverRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          </Box>
        )}
      </Container>
    </>
  );
};

export default OrderBook;
