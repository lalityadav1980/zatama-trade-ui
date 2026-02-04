import React, { useEffect, useMemo, useState } from 'react';
import {
  Container, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TableSortLabel, styled, Card, CardContent, Typography, Grid, Box, CircularProgress,
  useMediaQuery, useTheme, Chip, TextField, Button, FormControl, InputLabel, Select,
  MenuItem, Collapse, IconButton
} from '@mui/material';
import { ExpandMore, ExpandLess, FilterList, Clear, Download } from '@mui/icons-material';
import CustomAppBar from './CustomAppBar';
import { httpApi } from './api';
import moment from 'moment';

const INITIAL_CAPITAL = 300000;

// ================= Styles =================
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 'bold',
  padding: '12px 16px',
  fontFamily: "'Roboto Mono', monospace",
  borderBottom: `1px solid ${theme.palette.divider}`,
  color: '#e0e0e0',
}));
const GradientHeader = styled(TableRow)(() => ({
  background: 'linear-gradient(45deg, #1a5fb4 30%, #2a3f9e 90%)',
  borderBottom: '2px solid #00ffaa80',
}));
const HoverRow = styled(TableRow)(() => ({
  '&:hover': { backgroundColor: '#1a237e30', transform: 'scale(1.002)', transition: 'all 0.1s ease-in-out' },
}));
const SummaryCard = styled(Card)(() => ({
  background: '#070808',
  border: '2px solid rgba(0, 255, 170, 0.5)',
  borderRadius: '12px',
  transition: 'all 0.3s ease',
  '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 25px rgba(0, 255, 170, 0.15)' },
}));
const MobileOrderCard = styled(Card)(() => ({
  background: '#070808',
  border: '1px solid rgba(0, 255, 170, 0.4)',
  borderRadius: '8px',
  marginBottom: '8px',
  transition: 'all 0.3s ease',
  '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 15px rgba(0, 255, 170, 0.15)' },
}));

const GroupedTradeCard = styled(Card)(() => ({
  background: '#070808',
  border: '2px solid rgba(0, 255, 170, 0.4)',
  borderRadius: '16px',
  marginBottom: '20px',
  transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
  backdropFilter: 'blur(10px)',
  overflow: 'hidden',
  '&:hover': { 
    transform: 'translateY(-4px) scale(1.002)', 
    boxShadow: '0 12px 40px rgba(0, 255, 170, 0.2), 0 0 0 1px rgba(0, 255, 170, 0.3)',
    border: '2px solid rgba(0, 255, 170, 0.7)'
  },
}));

const TransactionBox = styled(Box)(() => ({
  background: '#070808',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '12px',
  padding: '16px',
  margin: '12px 0',
  transition: 'all 0.3s ease',
  backdropFilter: 'blur(5px)',
  '&:hover': {
    background: '#050505',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    transform: 'translateX(4px)'
  }
}));

// ================= Utils =================
const formatNumber = (value) => {
  const num = Number(value);
  return isNaN(num)
    ? (value ?? '')
    : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  const parsed = moment.utc(dateString);
  return parsed.isValid() ? parsed.format('DD-MM-YY HH:mm:ss') : String(dateString);
};
const formatDateOnly = (dateString) => {
  if (!dateString) return 'N/A';
  const parsed = moment.utc(dateString);
  return parsed.isValid() ? parsed.format('DD-MM-YYYY') : String(dateString);
};
const tsMs = (val) => {
  if (!val) return -Infinity;
  const m = moment.utc(val);
  return m.isValid() ? m.valueOf() : -Infinity;
};
const typeRank = (t) => (String(t || '').toUpperCase() === 'BUY' ? 0 : 1);

// CSV Export Function
const exportToCSV = (data, filename = 'orderbook_data.csv') => {
  const csvHeaders = [
    'Date',
    'Time',
    'Symbol',
    'Parent Order ID',
    'Transaction Type',
    'Quantity',
    'Price',
    'Total Value',
    'Tag',
    'P&L',
    'Trade %',
    'Available Margin'
  ];

  const csvData = data.map(order => [
    formatDateOnly(order.exchange_timestamp),
    formatDateTime(order.exchange_timestamp).split(' ')[1] || '',
    order.tradingsymbol || '',
    order.parent_order_id || '',
    order.transaction_type || '',
    order.quantity || '',
    order.price || '',
    ((Number(order.quantity) || 0) * (Number(order.price) || 0)).toFixed(2),
    order.tag || '',
    order.matched_pnl || '',
    order.trade_pct || '',
    order.available_margin || ''
  ]);

  const csvContent = [
    csvHeaders.join(','),
    ...csvData.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// ================= Core math =================

/**
 * FIFO per parent. Annotates each SELL with:
 *   - trade_pct ( (proceeds - matchedCost)/matchedCost*100 )
 *   - trade_pnl_abs (proceeds - matchedCost)
 *
 * Aggregates per parent:
 *   - parent_pct = (Σ proceeds - Σ matchedCost) / (Σ matchedCost) * 100  (only if matchedCost>0)
 * Returns:
 *   - total_pct_sum_parents: sum of parent_pct over all parent_order_id
 *   - total_pnl_sum: sum of all SELL trade_pnl_abs across all rows
 *   - lastTradePct: most recent SELL’s trade_pct
 *   - latestAvailable: best-effort available margin display
 */
function annotateAndAggregate(records) {
  const byParent = new Map();
  records.forEach((r, idx) => {
    const pid = r.parent_order_id ?? '__NO_PARENT__';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push({ ...r, __idx: idx });
  });

  const annotated = [];
  let total_pnl_sum = 0;
  let lastSellMeta = null;

  // for per-parent % sum
  let total_pct_sum_parents = 0;

  const parentIds = Array.from(byParent.keys()).sort();
  for (const pid of parentIds) {
    const rows = byParent.get(pid).slice().sort((a, b) => {
      const t = tsMs(a.exchange_timestamp) - tsMs(b.exchange_timestamp);
      if (t !== 0) return t;
      const tr = typeRank(a.transaction_type) - typeRank(b.transaction_type);
      if (tr !== 0) return tr;
      return a.__idx - b.__idx;
    });

    const fifo = []; // { qty, price }
    let parentMatchedCost = 0;
    let parentProceeds = 0;

    for (const row of rows) {
      const qty = Number(row.quantity) || 0;
      const price = Number(row.price) || 0;
      const kind = String(row.transaction_type || '').toUpperCase();

      let trade_pct = null;
      let trade_pnl_abs = null;

      if (kind === 'BUY') {
        if (qty > 0) fifo.push({ qty, price });
      } else if (kind === 'SELL' && qty > 0) {
        let remaining = qty;
        let matchedCost = 0;
        let proceeds = 0;

        while (remaining > 0 && fifo.length) {
          const lot = fifo[0];
          const take = Math.min(remaining, lot.qty);
          matchedCost += take * lot.price;
          proceeds += take * price;
          lot.qty -= take;
          remaining -= take;
          if (lot.qty === 0) fifo.shift();
        }

        if (matchedCost > 0) {
          trade_pnl_abs = proceeds - matchedCost;
          trade_pct = (trade_pnl_abs / matchedCost) * 100;

          // accumulate global PnL
          total_pnl_sum += trade_pnl_abs;

          // accumulate per-parent totals for parent-level %
          parentMatchedCost += matchedCost;
          parentProceeds += proceeds;
        }

        // pick latest SELL for "Last Trade %"
        const t = tsMs(row.exchange_timestamp);
        const better =
          !lastSellMeta ||
          t > lastSellMeta.ts ||
          (t === lastSellMeta.ts && row.__idx > lastSellMeta.idxInOriginal);
        if (better) lastSellMeta = { pct: trade_pct ?? 0, ts: t, idxInOriginal: row.__idx, avail: row.available_margin };
      }

      annotated.push({ ...row, trade_pct, trade_pnl_abs });
    }

    // parent-level % (only once per parent)
    if (parentMatchedCost > 0) {
      const parent_pct = ((parentProceeds - parentMatchedCost) / parentMatchedCost) * 100;
      total_pct_sum_parents += parent_pct;
    }
  }

  // Available margin for the card:
  // Use the most recent record's available_margin as it represents the current balance
  let latestAvailable = INITIAL_CAPITAL + total_pnl_sum;
  if (records.length) {
    const lastAvail = Number(records[records.length - 1].available_margin);
    if (isFinite(lastAvail) && lastAvail > 0) {
      latestAvailable = lastAvail;
    }
  }

  return {
    annotated,
    total_pnl_sum,
    total_pct_sum_parents,
    lastTradePct: lastSellMeta?.pct ?? 0,
    latestAvailable
  };
}

// ================= Component =================
const OrderBook = () => {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sorting state
  const [orderBy, setOrderBy] = useState('parent_order_id_then_time'); // default grouping
  const [orderDirection, setOrderDirection] = useState('asc');

  // Card states
  const [lastTradePct, setLastTradePct] = useState(0);
  const [cumulativePct, setCumulativePct] = useState(0);
  const [latestAvailable, setLatestAvailable] = useState(INITIAL_CAPITAL);

  // CSV Export Handler
  const handleExportCSV = () => {
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    exportToCSV(sortedData, `orderbook_export_${timestamp}.csv`);
  };

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    filterType: 'current-date',
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

  // -------- fetch ----------
  const fetchOrderBook = async () => {
    try {
      setLoading(true);

      let url = '/orders_book';
      let params = {};

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
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });

      let data = response.data;

      if (typeof data === 'string') {
        const cleanedData = data.replace(/:\s*NaN\s*([,}])/g, ': null$1');
        data = JSON.parse(cleanedData);
      }
      if (!data || typeof data !== 'object') throw new Error('Invalid response format: expected object');

      if (!Array.isArray(data.records)) {
        setRecords([]);
        setSummary(null);
        setLastTradePct(0);
        setCumulativePct(0);
        setLatestAvailable(INITIAL_CAPITAL);
        return;
      }

      // normalize records
      const processed = data.records.map(r => ({
        ...r,
        matched_pnl: r.matched_pnl == null || isNaN(r.matched_pnl) ? null : Number(r.matched_pnl) || 0,
        price: Number(r.price) || 0,
        available_margin: isNaN(Number(r.available_margin)) ? 0 : Number(r.available_margin),
        quantity: parseInt(r.quantity) || 0
      }));

      const {
        annotated,
        total_pnl_sum,
        total_pct_sum_parents,
        lastTradePct: lastPct,
        latestAvailable: calculatedAvail
      } = annotateAndAggregate(processed);

      setRecords(annotated);

      // Use API summary's available_margin if available, otherwise use calculated value
      const finalAvailableMargin = Number(data.summary?.available_margin) || calculatedAvail;

      // Cards:
      // - Capital Change = sum of P&L across all SELLs
      // - Change % = sum of parent-level % (per parent_order_id)
      setSummary({
        initial_capital: INITIAL_CAPITAL,
        total_buy_cost: Number(data.summary?.total_buy_cost) || 0,
        total_sell_cost: Number(data.summary?.total_sell_cost) || 0, // displayed as Total Sell Value
        capital_change: total_pnl_sum,
        capital_change_percentage: total_pct_sum_parents,
        available_margin: finalAvailableMargin
      });

      setLastTradePct(lastPct);
      setCumulativePct(total_pct_sum_parents);
      setLatestAvailable(finalAvailableMargin);

    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderBook();
    const intervalId = setInterval(fetchOrderBook, 30000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // --------- sorting ----------
  const handleSort = (property) => {
    const isAsc = orderBy === property && orderDirection === 'asc';
    setOrderBy(property);
    setOrderDirection(isAsc ? 'desc' : 'asc');
  };

  const sortedData = useMemo(() => {
    const data = [...records];
    const dir = orderDirection === 'asc' ? 1 : -1;

    if (orderBy === 'parent_order_id_then_time') {
      return data.sort((a, b) => {
        const pA = String(a.parent_order_id || '');
        const pB = String(b.parent_order_id || '');
        if (pA !== pB) return (pA < pB ? -1 : 1) * dir;
        const t = tsMs(a.exchange_timestamp) - tsMs(b.exchange_timestamp);
        if (t !== 0) return t * dir;
        const tr = typeRank(a.transaction_type) - typeRank(b.transaction_type);
        if (tr !== 0) return tr * dir;
        return 0;
      });
    }

    if (orderBy === 'exchange_timestamp') {
      return data.sort((a, b) => (tsMs(a.exchange_timestamp) - tsMs(b.exchange_timestamp)) * dir);
    }

    // numeric preferred
    return data.sort((a, b) => {
      const nA = Number(a[orderBy]);
      const nB = Number(b[orderBy]);
      const bothNum = isFinite(nA) && isFinite(nB);
      if (bothNum) return (nA - nB) * dir;

      // string fallback
      const sA = String(a[orderBy] ?? '').toLowerCase();
      const sB = String(b[orderBy] ?? '').toLowerCase();
      return (sA > sB ? 1 : sA < sB ? -1 : 0) * dir;
    });
  }, [records, orderBy, orderDirection]);

  // ---------- grouping logic ----------
  const groupedData = useMemo(() => {
    const groups = new Map();
    sortedData.forEach(order => {
      const parentId = order.parent_order_id || '__NO_PARENT__';
      if (!groups.has(parentId)) {
        groups.set(parentId, {
          parent_order_id: parentId,
          orders: [],
          buyOrders: [],
          sellOrders: [],
          symbol: order.tradingsymbol,
          totalBuyQty: 0,
          totalSellQty: 0,
          totalBuyValue: 0,
          totalSellValue: 0,
          netPnL: 0,
          netPnLPercentage: 0,
          latestTimestamp: order.exchange_timestamp,
          buyTag: null,
          sellTag: null,
          avgBuyPrice: 0,
          avgSellPrice: 0,
          firstBuyTime: null,
          lastSellTime: null
        });
      }
      
      const group = groups.get(parentId);
      group.orders.push(order);
      
      if (String(order.transaction_type).toUpperCase() === 'BUY') {
        group.buyOrders.push(order);
        group.totalBuyQty += Number(order.quantity) || 0;
        const buyValue = (Number(order.price) || 0) * (Number(order.quantity) || 0);
        group.totalBuyValue += buyValue;
        group.buyTag = order.tag || group.buyTag; // Keep first non-null buy tag
        if (!group.firstBuyTime || tsMs(order.exchange_timestamp) < tsMs(group.firstBuyTime)) {
          group.firstBuyTime = order.exchange_timestamp;
        }
      } else if (String(order.transaction_type).toUpperCase() === 'SELL') {
        group.sellOrders.push(order);
        group.totalSellQty += Number(order.quantity) || 0;
        const sellValue = (Number(order.price) || 0) * (Number(order.quantity) || 0);
        group.totalSellValue += sellValue;
        group.sellTag = order.tag || group.sellTag; // Keep first non-null sell tag
        if (order.trade_pnl_abs != null) {
          group.netPnL += Number(order.trade_pnl_abs) || 0;
        }
        if (order.trade_pct != null) {
          group.netPnLPercentage = Number(order.trade_pct) || 0;
        }
        if (!group.lastSellTime || tsMs(order.exchange_timestamp) > tsMs(group.lastSellTime)) {
          group.lastSellTime = order.exchange_timestamp;
        }
      }
      
      // Update latest timestamp
      if (tsMs(order.exchange_timestamp) > tsMs(group.latestTimestamp)) {
        group.latestTimestamp = order.exchange_timestamp;
      }
    });
    
    // Calculate average prices after processing all orders
    groups.forEach(group => {
      if (group.totalBuyQty > 0) {
        group.avgBuyPrice = group.totalBuyValue / group.totalBuyQty;
      }
      if (group.totalSellQty > 0) {
        group.avgSellPrice = group.totalSellValue / group.totalSellQty;
      }
    });
    
    return Array.from(groups.values()).sort((a, b) => 
      tsMs(b.latestTimestamp) - tsMs(a.latestTimestamp)
    );
  }, [sortedData]);

  // ---------- filters ----------
  const handleFilterChange = (field, value) => setFilters(prev => ({ ...prev, [field]: value }));
  const handleFilterSubmit = () => { fetchOrderBook(); };
  const clearFilters = () => setFilters({
    filterType: 'current-date',
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

  const renderFilterControls = () => (
    <Card sx={{ mb: 2, background: '#070808', border: '2px solid rgba(0, 255, 170, 0.5)' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <FilterList sx={{ color: '#00ffaa', mr: 1 }} />
          <Typography variant="h6" sx={{ color: '#e0e0e0', flexGrow: 1 }}>Filters</Typography>
          <IconButton onClick={() => setShowFilters(!showFilters)} sx={{ color: '#00ffaa' }}>
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
                    fullWidth size="small" type="date" label="Start Date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    InputLabelProps={{ shrink: true, sx: { color: '#e0e0e0' } }}
                    sx={{ '& input': { color: '#e0e0e0' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa30' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth size="small" type="date" label="End Date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    InputLabelProps={{ shrink: true, sx: { color: '#e0e0e0' } }}
                    sx={{ '& input': { color: '#e0e0e0' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa30' } }}
                  />
                </Grid>
              </>
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
                    borderColor: '#00ffaa', color: '#00ffaa',
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

  // ============== Render ==============
  if (loading) {
    return (
      <>
        <CustomAppBar />
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" sx={{ backgroundColor: '#070808' }}>
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
          <Typography color="error" align="center" variant="h6">Error: {error}</Typography>
        </Container>
      </>
    );
  }

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
              backgroundColor: String(order.transaction_type).toUpperCase() === 'BUY' ? '#4CAF5030' : '#F4433630',
              color: String(order.transaction_type).toUpperCase() === 'BUY' ? '#4CAF50' : '#F44336',
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
              Tag: <span style={{ color: '#00ffaa' }}>{order.tag || 'N/A'}</span>
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
              P&L:{' '}
              <span style={{ color: order.matched_pnl === null ? '#9E9E9E' : order.matched_pnl >= 0 ? '#4CAF50' : '#F44336' }}>
                {order.matched_pnl === null ? 'N/A' : `₹${formatNumber(order.matched_pnl)}`}
              </span>
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
              Trade %:{' '}
              <span style={{ color: order.trade_pct == null ? '#9E9E9E' : order.trade_pct >= 0 ? '#4CAF50' : '#F44336' }}>
                {order.trade_pct == null ? '—' : `${formatNumber(order.trade_pct)}%`}
              </span>
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

  const GroupedTradeView = ({ group, index }) => {
    const hasProfit = group.netPnL >= 0;
    const profitColor = hasProfit ? '#00E676' : '#FF5252';
    const profitBg = hasProfit ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 82, 82, 0.1)';
    
    return (
      <GroupedTradeCard key={index}>
        <CardContent sx={{ p: 0 }}>
          {/* Header Section */}
          <Box sx={{ 
            background: '#070808',
            p: { xs: 2, md: 2.5 }, 
            borderBottom: '2px solid rgba(0, 255, 170, 0.3)',
            borderRadius: '16px 16px 0 0'
          }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: { xs: 'flex-start', md: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2, sm: 1 }
            }}>
              <Box sx={{ 
                flex: 1,
                minWidth: 0, // Allows text to wrap/truncate
                mr: { xs: 0, sm: 2 }
              }}>
                <Typography variant="h5" sx={{ 
                  color: '#00ffaa', 
                  fontWeight: 800,
                  mb: { xs: 0.5, md: 0.3 },
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: { xs: '1rem', sm: '1.1rem', md: '1.3rem' },
                  letterSpacing: '0.5px',
                  wordBreak: 'break-all', // Ensures long option names break properly
                  lineHeight: { xs: 1.2, md: 1.3 }
                }}>
                  {group.symbol || 'N/A'}
                </Typography>
                <Typography variant="body2" sx={{ 
                  color: 'rgba(255, 255, 255, 0.6)', 
                  fontSize: { xs: '0.75rem', md: '0.8rem' },
                  fontWeight: 500,
                  mt: { xs: 0.5, md: 0 },
                  wordBreak: 'break-all' // Ensures long Chain IDs break properly
                }}>
                  {group.parent_order_id === '__NO_PARENT__' ? 'Individual Option Order' : `Chain ID: ${group.parent_order_id}`}
                </Typography>
              </Box>
              
              <Box sx={{ 
                textAlign: { xs: 'left', sm: 'right' },
                background: profitBg,
                borderRadius: '10px',
                p: { xs: 1.5, md: 2 },
                minWidth: { xs: 'auto', sm: '120px' },
                width: { xs: '100%', sm: 'auto' },
                border: `1px solid ${profitColor}30`,
                display: 'flex',
                flexDirection: { xs: 'row', sm: 'column' },
                justifyContent: { xs: 'space-between', sm: 'center' },
                alignItems: { xs: 'center', sm: 'flex-end' }
              }}>
                <Typography variant="h4" sx={{ 
                  color: profitColor, 
                  fontWeight: 700,
                  fontFamily: 'Roboto Mono, monospace',
                  fontSize: { xs: '1.1rem', sm: '1.2rem', md: '1.4rem' },
                  lineHeight: 1.2
                }}>
                  {hasProfit ? '+' : ''}₹{formatNumber(Math.abs(group.netPnL))}
                </Typography>
                <Typography variant="body1" sx={{ 
                  color: profitColor,
                  fontWeight: 600,
                  fontSize: { xs: '0.85rem', sm: '0.9rem' },
                  fontFamily: 'Roboto Mono, monospace',
                  ml: { xs: 2, sm: 0 },
                  mt: { xs: 0, sm: 0.5 }
                }}>
                  {hasProfit ? '+' : ''}{formatNumber(group.netPnLPercentage)}%
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Options Trading Summary */}
          <Box sx={{ p: { xs: 2, md: 2.5 }, borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <Grid container spacing={{ xs: 1.5, md: 2 }}>
              {/* BUY Position - CE/PE */}
              <Grid item xs={12} md={4}>
                <Box sx={{ 
                  background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.1) 0%, rgba(0, 200, 100, 0.05) 100%)',
                  border: '1px solid rgba(0, 230, 118, 0.25)',
                  borderRadius: '10px',
                  p: 1.8,
                  height: '140px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.15) 0%, rgba(0, 200, 100, 0.08) 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 20px rgba(0, 230, 118, 0.2)'
                  }
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Box sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#00E676',
                      mr: 1
                    }} />
                    <Typography variant="subtitle2" sx={{ 
                      color: '#00E676', 
                      fontWeight: 700, 
                      fontSize: '0.85rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      BUY ORDERS
                    </Typography>
                  </Box>
                  
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ 
                      color: '#ffffff', 
                      fontWeight: 700, 
                      mb: 0.5,
                      fontFamily: 'Roboto Mono, monospace',
                      fontSize: '1.1rem'
                    }}>
                      {group.totalBuyQty} Lots
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '0.8rem',
                      fontWeight: 500
                    }}>
                      Avg Premium: ₹{formatNumber(group.avgBuyPrice)}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '0.8rem',
                      fontWeight: 500
                    }}>
                      Total Cost: ₹{formatNumber(group.totalBuyValue)}
                    </Typography>
                  </Box>
                  
                  {group.buyTag && (
                    <Chip
                      label={group.buyTag}
                      size="small"
                      sx={{
                        height: '22px',
                        background: 'rgba(0, 230, 118, 0.2)',
                        color: '#00E676',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        border: '1px solid rgba(0, 230, 118, 0.3)',
                        '& .MuiChip-label': { px: 1 }
                      }}
                    />
                  )}
                </Box>
              </Grid>

              {/* SELL Position - Options */}
              <Grid item xs={12} md={4}>
                <Box sx={{ 
                  background: 'linear-gradient(135deg, rgba(255, 82, 82, 0.1) 0%, rgba(244, 67, 54, 0.05) 100%)',
                  border: '1px solid rgba(255, 82, 82, 0.25)',
                  borderRadius: '10px',
                  p: 1.8,
                  height: '140px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, rgba(255, 82, 82, 0.15) 0%, rgba(244, 67, 54, 0.08) 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 20px rgba(255, 82, 82, 0.2)'
                  }
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Box sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#FF5252',
                      mr: 1
                    }} />
                    <Typography variant="subtitle2" sx={{ 
                      color: '#FF5252', 
                      fontWeight: 700, 
                      fontSize: '0.85rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      SELL ORDERS
                    </Typography>
                  </Box>
                  
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ 
                      color: '#ffffff', 
                      fontWeight: 700, 
                      mb: 0.5,
                      fontFamily: 'Roboto Mono, monospace',
                      fontSize: '1.1rem'
                    }}>
                      {group.totalSellQty} Lots
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '0.8rem',
                      fontWeight: 500
                    }}>
                      Avg Premium: ₹{formatNumber(group.avgSellPrice)}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '0.8rem',
                      fontWeight: 500
                    }}>
                      Total Value: ₹{formatNumber(group.totalSellValue)}
                    </Typography>
                  </Box>
                  
                  {group.sellTag && (
                    <Chip
                      label={group.sellTag}
                      size="small"
                      sx={{
                        height: '22px',
                        background: 'rgba(255, 82, 82, 0.2)',
                        color: '#FF5252',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        border: '1px solid rgba(255, 82, 82, 0.3)',
                        '& .MuiChip-label': { px: 1 }
                      }}
                    />
                  )}
                </Box>
              </Grid>

              {/* Timing & Performance Info */}
              <Grid item xs={12} md={4}>
                <Box sx={{ 
                  background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 235, 59, 0.05) 100%)',
                  border: '1px solid rgba(255, 193, 7, 0.25)',
                  borderRadius: '10px',
                  p: 1.8,
                  height: '140px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 235, 59, 0.08) 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 20px rgba(255, 193, 7, 0.2)'
                  }
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Box sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#FFC107',
                      mr: 1
                    }} />
                    <Typography variant="subtitle2" sx={{ 
                      color: '#FFC107', 
                      fontWeight: 700, 
                      fontSize: '0.85rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      TRADE TIMING
                    </Typography>
                  </Box>
                  
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
                    <Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem', mb: 0.2 }}>
                        Entry Date:
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: '#FFC107', 
                        fontFamily: 'Roboto Mono, monospace',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        {group.firstBuyTime ? formatDateOnly(group.firstBuyTime) : 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: '#FFC107', 
                        fontFamily: 'Roboto Mono, monospace',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}>
                        {group.firstBuyTime ? formatDateTime(group.firstBuyTime).split(' ')[1] : 'N/A'}
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem', mb: 0.2 }}>
                        Exit Date:
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: '#FFC107', 
                        fontFamily: 'Roboto Mono, monospace',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        {group.lastSellTime ? formatDateOnly(group.lastSellTime) : 'Active'}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: '#FFC107', 
                        fontFamily: 'Roboto Mono, monospace',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}>
                        {group.lastSellTime ? formatDateTime(group.lastSellTime).split(' ')[1] : 'Position Open'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* Transaction History - Compact */}
          <Box sx={{ p: { xs: 2, md: 2.5 } }}>
            <Typography variant="h6" sx={{ 
              color: '#e0e0e0', 
              mb: 1.5, 
              fontWeight: 700,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Box sx={{ width: 4, height: 16, backgroundColor: '#00ffaa', mr: 1, borderRadius: 1 }} />
              Transaction History
            </Typography>
            
            {/* BUY Orders - Compact */}
            {group.buyOrders.length > 0 && (
              <TransactionBox>
                <Typography variant="subtitle1" sx={{ 
                  color: '#00E676', 
                  mb: 1.5, 
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Box sx={{ width: 6, height: 6, backgroundColor: '#00E676', borderRadius: '50%', mr: 1 }} />
                  BUY Orders ({group.buyOrders.length})
                </Typography>
                {group.buyOrders.map((order, idx) => (
                  <Box key={idx} sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    mb: 1, 
                    p: 1.2,
                    borderRadius: '8px',
                    background: 'rgba(0, 230, 118, 0.04)',
                    border: '1px solid rgba(0, 230, 118, 0.15)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: 'rgba(0, 230, 118, 0.08)',
                      transform: 'translateX(4px)'
                    }
                  }}>
                    <Box sx={{ minWidth: '110px' }}>
                      <Typography variant="body2" sx={{ 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontFamily: 'Roboto Mono, monospace',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        {formatDateOnly(order.exchange_timestamp)}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: 'rgba(255, 255, 255, 0.7)', 
                        fontFamily: 'Roboto Mono, monospace',
                        fontSize: '0.8rem'
                      }}>
                        {formatDateTime(order.exchange_timestamp).split(' ')[1]}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ 
                      color: '#FFEB3B', 
                      fontWeight: 600, 
                      textAlign: 'center',
                      fontFamily: 'Roboto Mono, monospace',
                      fontSize: '0.85rem'
                    }}>
                      {order.quantity} × ₹{formatNumber(order.price)}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: '#00E676', 
                      fontWeight: 700, 
                      textAlign: 'right',
                      fontFamily: 'Roboto Mono, monospace',
                      fontSize: '0.85rem'
                    }}>
                      ₹{formatNumber((Number(order.quantity) || 0) * (Number(order.price) || 0))}
                    </Typography>
                  </Box>
                ))}
              </TransactionBox>
            )}

            {/* SELL Orders - Compact */}
            {group.sellOrders.length > 0 && (
              <TransactionBox>
                <Typography variant="subtitle1" sx={{ 
                  color: '#FF5252', 
                  mb: 1.5, 
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Box sx={{ width: 6, height: 6, backgroundColor: '#FF5252', borderRadius: '50%', mr: 1 }} />
                  SELL Orders ({group.sellOrders.length})
                </Typography>
                {group.sellOrders.map((order, idx) => (
                  <Box key={idx} sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    mb: 1, 
                    p: 1.2,
                    borderRadius: '8px',
                    background: 'rgba(255, 82, 82, 0.04)',
                    border: '1px solid rgba(255, 82, 82, 0.15)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: 'rgba(255, 82, 82, 0.08)',
                      transform: 'translateX(4px)'
                    }
                  }}>
                    <Box sx={{ minWidth: '110px' }}>
                      <Typography variant="body2" sx={{ 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontFamily: 'Roboto Mono, monospace',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        {formatDateOnly(order.exchange_timestamp)}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: 'rgba(255, 255, 255, 0.7)', 
                        fontFamily: 'Roboto Mono, monospace',
                        fontSize: '0.8rem'
                      }}>
                        {formatDateTime(order.exchange_timestamp).split(' ')[1]}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ 
                      color: '#FFEB3B', 
                      fontWeight: 600, 
                      textAlign: 'center',
                      fontFamily: 'Roboto Mono, monospace',
                      fontSize: '0.85rem'
                    }}>
                      {order.quantity} × ₹{formatNumber(order.price)}
                    </Typography>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" sx={{ 
                        color: '#FF5252', 
                        fontWeight: 700,
                        fontFamily: 'Roboto Mono, monospace',
                        fontSize: '0.85rem'
                      }}>
                        ₹{formatNumber((Number(order.quantity) || 0) * (Number(order.price) || 0))}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: (order.trade_pct || 0) >= 0 ? '#00E676' : '#FF5252', 
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        fontFamily: 'Roboto Mono, monospace'
                      }}>
                        ({(order.trade_pct || 0) >= 0 ? '+' : ''}{formatNumber(order.trade_pct || 0)}%)
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </TransactionBox>
            )}
          </Box>
        </CardContent>
      </GroupedTradeCard>
    );
  };

  return (
    <>
      <CustomAppBar />
      <Container maxWidth="xl" sx={{
        borderRadius: '8px',
        border: '2px solid rgba(0, 255, 170, 0.5)',
        boxShadow: '0 0 30px rgba(0, 255, 170, 0.3), inset 0 0 20px rgba(0, 255, 170, 0.1)',
        background: '#070808',
        mt: 1,
        minHeight: '100vh'
      }}>
        {/* Enhanced Compact Summary Dashboard */}
        {summary && (
          <Card sx={{ 
            mb: 3, 
            mt: 2,
            background: '#070808',
            backdropFilter: 'blur(20px)',
            border: '2px solid rgba(0, 255, 170, 0.6)',
            borderRadius: '20px',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 8px 32px rgba(0, 255, 170, 0.2)',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #00ffaa, #00e676, #4caf50, #ffeb3b, #ff9800, #f44336, #e91e63)',
            }
          }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              {/* Header Section */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                mb: 2,
                pb: 2,
                borderBottom: '2px solid rgba(255, 255, 255, 0.2)'
              }}>
                <Typography variant="h5" sx={{ 
                  color: '#ffffff', 
                  fontWeight: 800,
                  fontFamily: 'Roboto, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <Box sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: 'linear-gradient(45deg, #00ffaa, #00e676)',
                    boxShadow: '0 0 10px rgba(0, 255, 170, 0.5)'
                  }} />
                  Portfolio Dashboard
                </Typography>
                <Chip 
                  label={`${sortedData.length} Orders`}
                  sx={{ 
                    backgroundColor: 'rgba(0, 255, 170, 0.15)', 
                    color: '#00ffaa', 
                    fontWeight: 'bold',
                    border: '1px solid rgba(0, 255, 170, 0.3)'
                  }} 
                />
              </Box>

              {/* Main Stats Grid - Responsive Layout */}
              <Grid container spacing={{ xs: 2, md: 3 }}>
                {/* Row 1: Initial Capital - Full Width */}
                <Grid item xs={12}>
                  <Box sx={{
                    background: '#070808',
                    border: '2px solid rgba(138, 43, 226, 0.6)',
                    borderRadius: '18px',
                    p: { xs: 2.5, md: 3 },
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: 'linear-gradient(90deg, #8a2be2, #4b0082, #483d8b)',
                    }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>
                      <Box sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: '#8a2be2',
                        mr: 1.5,
                        boxShadow: '0 0 12px rgba(138, 43, 226, 0.6)',
                        animation: 'pulse 2s infinite'
                      }} />
                      <Typography variant="h6" sx={{ 
                        color: '#8a2be2', 
                        fontWeight: 700,
                        fontSize: { xs: '1rem', md: '1.1rem' },
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}>
                        Initial Capital
                      </Typography>
                    </Box>
                    <Typography variant="h3" sx={{ 
                      color: '#ffffff', 
                      fontWeight: 900,
                      fontFamily: 'Roboto Mono, monospace',
                      fontSize: { xs: '2rem', md: '2.5rem' },
                      lineHeight: 1,
                      textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}>
                      ₹{formatNumber(summary.initial_capital)}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      mt: 1
                    }}>
                      Starting Investment Base
                    </Typography>
                  </Box>
                </Grid>

                {/* Row 2: Buy & Sell Values */}
                <Grid item xs={12} sm={6}>
                  <Box sx={{
                    background: '#070808',
                    border: '2px solid rgba(34, 139, 34, 0.7)',
                    borderRadius: '16px',
                    p: { xs: 2.5, md: 3 },
                    height: { xs: 'auto', md: '140px' },
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: '0 12px 30px rgba(34, 139, 34, 0.2)',
                      border: '1px solid rgba(34, 139, 34, 0.6)'
                    }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>
                      <Box sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#228b22',
                        mr: 1.5,
                        boxShadow: '0 0 10px rgba(34, 139, 34, 0.6)'
                      }} />
                      <Typography variant="subtitle1" sx={{ 
                        color: '#228b22', 
                        fontWeight: 700,
                        fontSize: { xs: '0.85rem', md: '0.9rem' },
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Total Buy Cost
                      </Typography>
                    </Box>
                    <Typography variant="h4" sx={{ 
                      color: '#ffffff', 
                      fontWeight: 800,
                      fontFamily: 'Roboto Mono, monospace',
                      fontSize: { xs: '1.4rem', md: '1.6rem' },
                      lineHeight: 1.2,
                      mb: 1
                    }}>
                      ₹{formatNumber(summary.total_buy_cost)}
                    </Typography>
                    <Typography variant="caption" sx={{ 
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontSize: '0.75rem',
                      fontWeight: 500
                    }}>
                      Total Amount Invested
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{
                    background: '#070808',
                    border: '2px solid rgba(220, 20, 60, 0.7)',
                    borderRadius: '16px',
                    p: { xs: 2.5, md: 3 },
                    height: { xs: 'auto', md: '140px' },
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: '0 12px 30px rgba(220, 20, 60, 0.2)',
                      border: '1px solid rgba(220, 20, 60, 0.6)'
                    }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>
                      <Box sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#dc143c',
                        mr: 1.5,
                        boxShadow: '0 0 10px rgba(220, 20, 60, 0.6)'
                      }} />
                      <Typography variant="subtitle1" sx={{ 
                        color: '#dc143c', 
                        fontWeight: 700,
                        fontSize: { xs: '0.85rem', md: '0.9rem' },
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Total Sell Value
                      </Typography>
                    </Box>
                    <Typography variant="h4" sx={{ 
                      color: '#ffffff', 
                      fontWeight: 800,
                      fontFamily: 'Roboto Mono, monospace',
                      fontSize: { xs: '1.4rem', md: '1.6rem' },
                      lineHeight: 1.2,
                      mb: 1
                    }}>
                      ₹{formatNumber(summary.total_sell_cost)}
                    </Typography>
                    <Typography variant="caption" sx={{ 
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontSize: '0.75rem',
                      fontWeight: 500
                    }}>
                      Total Returns Received
                    </Typography>
                  </Box>
                </Grid>

                {/* Row 3: Performance Metrics with proper spacing */}
                <Grid item xs={12}>
                  <Box sx={{ mt: { xs: 1, md: 2 } }}>
                    <Grid container spacing={{ xs: 2, sm: 2, md: 3 }}>
                      <Grid item xs={12} sm={6} lg={3}>
                        <Box sx={{
                          background: '#070808',
                          border: `2px solid ${summary.capital_change >= 0 ? 'rgba(0, 191, 165, 0.4)' : 'rgba(244, 67, 54, 0.4)'}`,
                          borderRadius: '16px',
                          p: { xs: 2, md: 2.5 },
                          height: { xs: '110px', md: '120px' },
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          textAlign: 'center',
                          transition: 'all 0.4s ease',
                          position: 'relative',
                          overflow: 'hidden',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '3px',
                            background: summary.capital_change >= 0 
                              ? 'linear-gradient(90deg, #00bfa5, #009688)' 
                              : 'linear-gradient(90deg, #f44336, #d32f2f)',
                          },
                          '&:hover': {
                            transform: 'translateY(-4px) scale(1.02)',
                            boxShadow: summary.capital_change >= 0 
                              ? '0 15px 35px rgba(0, 191, 165, 0.3)'
                              : '0 15px 35px rgba(244, 67, 54, 0.3)'
                          }
                        }}>
                          <Typography variant="caption" sx={{ 
                            color: 'rgba(255, 255, 255, 0.8)', 
                            fontWeight: 600,
                            fontSize: { xs: '0.7rem', md: '0.75rem' },
                            mb: 1,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Capital Change
                          </Typography>
                          <Typography variant="h5" sx={{ 
                            color: summary.capital_change >= 0 ? '#00bfa5' : '#f44336', 
                            fontWeight: 900,
                            fontFamily: 'Roboto Mono, monospace',
                            fontSize: { xs: '1.1rem', sm: '1.2rem', md: '1.4rem' },
                            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                          }}>
                            {summary.capital_change >= 0 ? '+' : ''}₹{formatNumber(summary.capital_change)}
                          </Typography>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={6} lg={3}>
                        <Box sx={{
                          background: '#070808',
                          border: `2px solid ${cumulativePct >= 0 ? 'rgba(67, 160, 71, 0.4)' : 'rgba(229, 57, 53, 0.4)'}`,
                          borderRadius: '16px',
                          p: { xs: 2, md: 2.5 },
                          height: { xs: '110px', md: '120px' },
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          textAlign: 'center',
                          transition: 'all 0.4s ease',
                          position: 'relative',
                          overflow: 'hidden',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '3px',
                            background: cumulativePct >= 0 
                              ? 'linear-gradient(90deg, #43a047, #388e3c)' 
                              : 'linear-gradient(90deg, #e53935, #c62828)',
                          },
                          '&:hover': {
                            transform: 'translateY(-4px) scale(1.02)',
                            boxShadow: cumulativePct >= 0 
                              ? '0 15px 35px rgba(67, 160, 71, 0.3)'
                              : '0 15px 35px rgba(229, 57, 53, 0.3)'
                          }
                        }}>
                          <Typography variant="caption" sx={{ 
                            color: 'rgba(255, 255, 255, 0.8)', 
                            fontWeight: 600,
                            fontSize: { xs: '0.7rem', md: '0.75rem' },
                            mb: 1,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Total Return %
                          </Typography>
                          <Typography variant="h5" sx={{ 
                            color: cumulativePct >= 0 ? '#43a047' : '#e53935', 
                            fontWeight: 900,
                            fontFamily: 'Roboto Mono, monospace',
                            fontSize: { xs: '1.1rem', sm: '1.2rem', md: '1.4rem' },
                            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                          }}>
                            {cumulativePct >= 0 ? '+' : ''}{formatNumber(cumulativePct)}%
                          </Typography>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={6} lg={3}>
                        <Box sx={{
                          background: '#070808',
                          border: `2px solid ${lastTradePct >= 0 ? 'rgba(102, 187, 106, 0.4)' : 'rgba(239, 83, 80, 0.4)'}`,
                          borderRadius: '16px',
                          p: { xs: 2, md: 2.5 },
                          height: { xs: '110px', md: '120px' },
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          textAlign: 'center',
                          transition: 'all 0.4s ease',
                          position: 'relative',
                          overflow: 'hidden',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '3px',
                            background: lastTradePct >= 0 
                              ? 'linear-gradient(90deg, #66bb6a, #4caf50)' 
                              : 'linear-gradient(90deg, #ef5350, #e53935)',
                          },
                          '&:hover': {
                            transform: 'translateY(-4px) scale(1.02)',
                            boxShadow: lastTradePct >= 0 
                              ? '0 15px 35px rgba(102, 187, 106, 0.3)'
                              : '0 15px 35px rgba(239, 83, 80, 0.3)'
                          }
                        }}>
                          <Typography variant="caption" sx={{ 
                            color: 'rgba(255, 255, 255, 0.8)', 
                            fontWeight: 600,
                            fontSize: { xs: '0.7rem', md: '0.75rem' },
                            mb: 1,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Last Trade %
                          </Typography>
                          <Typography variant="h5" sx={{ 
                            color: lastTradePct >= 0 ? '#66bb6a' : '#ef5350', 
                            fontWeight: 900,
                            fontFamily: 'Roboto Mono, monospace',
                            fontSize: { xs: '1.1rem', sm: '1.2rem', md: '1.4rem' },
                            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                          }}>
                            {lastTradePct >= 0 ? '+' : ''}{formatNumber(lastTradePct)}%
                          </Typography>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={6} lg={3}>
                        <Box sx={{
                          background: '#070808',
                          border: '2px solid rgba(255, 152, 0, 0.4)',
                          borderRadius: '16px',
                          p: { xs: 2, md: 2.5 },
                          height: { xs: '110px', md: '120px' },
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          textAlign: 'center',
                          transition: 'all 0.4s ease',
                          position: 'relative',
                          overflow: 'hidden',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '3px',
                            background: 'linear-gradient(90deg, #ff9800, #f57c00)',
                          },
                          '&:hover': {
                            transform: 'translateY(-4px) scale(1.02)',
                            boxShadow: '0 15px 35px rgba(255, 152, 0, 0.3)'
                          }
                        }}>
                          <Typography variant="caption" sx={{ 
                            color: 'rgba(255, 255, 255, 0.8)', 
                            fontWeight: 600,
                            fontSize: { xs: '0.7rem', md: '0.75rem' },
                            mb: 1,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Available Margin
                          </Typography>
                          <Typography variant="h5" sx={{ 
                            color: '#ff9800', 
                            fontWeight: 900,
                            fontFamily: 'Roboto Mono, monospace',
                            fontSize: { xs: '1rem', sm: '1.1rem', md: '1.3rem' },
                            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                          }}>
                            ₹{formatNumber(latestAvailable)}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        {renderFilterControls()}

        {/* Lists */}
        <Box sx={{ pb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h6" sx={{ color: '#e0e0e0' }}>Grouped Order Book</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Chip 
                label={`${groupedData.length} trade groups (${sortedData.length} total orders)`} 
                sx={{ backgroundColor: '#00ffaa20', color: '#00ffaa', fontWeight: 'bold' }} 
              />
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={() => exportToCSV(sortedData, `orderbook_${moment().format('YYYY-MM-DD_HH-mm')}.csv`)}
                sx={{
                  background: 'linear-gradient(135deg, #00ffaa 0%, #00cc88 100%)',
                  color: '#000',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  textTransform: 'none',
                  px: 3,
                  '&:hover': {
                    background: 'linear-gradient(135deg, #00cc88 0%, #00ffaa 100%)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(0, 255, 170, 0.3)'
                  }
                }}
              >
                Export CSV
              </Button>
            </Box>
          </Box>
          
          {/* Grouped Trade Cards - Same for both mobile and desktop */}
          {groupedData.map((group, index) => (
            <GroupedTradeView 
              key={`${group.parent_order_id || index}-${group.latestTimestamp || index}`} 
              group={group} 
              index={index} 
            />
          ))}
        </Box>
      </Container>
    </>
  );
};

export default OrderBook;
