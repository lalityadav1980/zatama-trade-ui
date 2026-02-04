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
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  IconButton,
  CircularProgress
} from '@mui/material';
import { Close as CloseIcon, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import CustomAppBar from './CustomAppBar';
import { httpApi } from './api';
import moment from 'moment';

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
  },
}));

const SummaryCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(45deg, #1a237e 30%, #0d47a1 90%)',
  border: '1px solid #00ffaa30',
  boxShadow: '0 0 20px #00ffaa20',
  marginBottom: '20px',
  height: '140px', // Fixed height for all cards
  display: 'flex',
  flexDirection: 'column',
  '& .MuiCardContent-root': {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '16px !important',
  },
}));

const StatValue = styled(Typography)(({ positive }) => ({
  color: positive === true ? '#4CAF50' : positive === false ? '#F44336' : '#FFEB3B',
  fontWeight: 'bold',
  fontSize: '1.5rem',
  filter: 'drop-shadow(0 0 2px currentColor)',
}));

const ClickableDate = styled(TableCell)(({ theme }) => ({
  color: '#00ffaa',
  cursor: 'pointer',
  textDecoration: 'underline',
  '&:hover': {
    color: '#00ff88',
    backgroundColor: '#00ffaa20',
  },
}));

const TradeDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    background: 'linear-gradient(135deg, #0a1929 0%, #1a237e 100%)',
    border: '1px solid #00ffaa30',
    boxShadow: '0 0 30px #00ffaa20',
    minWidth: '1000px',
    maxWidth: '95vw',
  },
}));

const TradeCard = styled(Card)(({ theme, positive }) => ({
  background: positive 
    ? 'linear-gradient(45deg, #1b5e20 30%, #2e7d32 90%)' 
    : 'linear-gradient(45deg, #b71c1c 30%, #d32f2f 90%)',
  border: `1px solid ${positive ? '#4CAF50' : '#F44336'}30`,
  boxShadow: `0 0 10px ${positive ? '#4CAF50' : '#F44336'}20`,
  marginBottom: '12px',
}));

const formatNumber = (value) => {
  const num = Number(value);
  return isNaN(num) ? value : num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const TradeSummary = () => {
  const [summaryData, setSummaryData] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [orderBy, setOrderBy] = useState('date');
  const [orderDirection, setOrderDirection] = useState('desc');
  const [selectedDate, setSelectedDate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateTradeData, setDateTradeData] = useState(null);
  const [loadingTradeData, setLoadingTradeData] = useState(false);
  const [dialogOrderBy, setDialogOrderBy] = useState('date');
  const [dialogOrderDirection, setDialogOrderDirection] = useState('asc');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchTradeSummary = async () => {
    try {
      // Use httpApi to call the trade-summary endpoint (expect JSON)
      const raw = await httpApi.get('api/trade-summary');
      const data = raw.data;
      // Fallback defaults for missing fields
      const safeData = {
        overall: data.overall || {
          avg_gained_points: 0,
          max_gain: 0,
          max_loss: 0,
          negative_trades: 0,
          positive_trades: 0,
          sum_gained_points: 0,
          total_trades: 0,
          win_rate: 0
        },
        by_date: Array.isArray(data.by_date) ? data.by_date : [],
        by_week: Array.isArray(data.by_week) ? data.by_week : [],
        weekly_meta: data.weekly_meta || {
          no_trade_weeks: [],
          no_trade_weeks_count: 0,
          total_weeks_in_data: 0,
          trade_week_hit_rate: 0,
          trade_weeks_count: 0
        },
        no_trade_dates: Array.isArray(data.no_trade_dates) ? data.no_trade_dates : [],
        no_trade_days_count: typeof data.no_trade_days_count === 'number' ? data.no_trade_days_count : 0,
        total_days_in_data: typeof data.total_days_in_data === 'number' ? data.total_days_in_data : 0,
        trade_day_hit_rate: typeof data.trade_day_hit_rate === 'number' ? data.trade_day_hit_rate : 0,
        trade_days_count: typeof data.trade_days_count === 'number' ? data.trade_days_count : 0
      };
      // Check for required fields
      if (!safeData.overall || !safeData.by_date || !safeData.by_week) {
        setErrorMsg('Trade summary data is missing required fields.');
        setSummaryData(null);
      } else {
        setErrorMsg('');
        setSummaryData(safeData);
      }
    } catch (error) {
      setErrorMsg('Error fetching trade summary: ' + (error?.message || 'Unknown error'));
      setSummaryData(null);
    }
  };

  const fetchTradeDataForDate = async (date) => {
    setLoadingTradeData(true);
    try {
      // Format the selected date for the API call
      const selectedDateStr = moment(date).format('YYYY-MM-DD');
      
      // Call the trade-signals range API with start and end date as the same date
      const response = await httpApi.get(`trade-signals/range?start=${selectedDateStr}&end=${selectedDateStr}`);
      
      // Extract data array from response
      const responseData = response.data.data || response.data || [];
      
      // Debug logging
      console.log('Full API response:', response.data);
      console.log('Extracted responseData:', responseData);
      console.log('responseData length:', responseData.length);
      
      // Count Buy/Sell signals for debugging
      const buyCount = responseData.filter(signal => signal.weighted_signal === 'Buy').length;
      const sellCount = responseData.filter(signal => signal.weighted_signal === 'Sell').length;
      console.log('Buy signals count:', buyCount);
      console.log('Sell signals count:', sellCount);
      console.log('Sample signals:', responseData.slice(0, 3).map(s => ({ 
        weighted_signal: s.weighted_signal, 
        date: s.date,
        gained_points: s.gained_points 
      })));
      
      setDateTradeData(responseData);
    } catch (error) {
      console.error('Error fetching signal data for date:', error);
      setDateTradeData(null);
    } finally {
      setLoadingTradeData(false);
    }
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setDialogOpen(true);
    fetchTradeDataForDate(date);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedDate(null);
    setDateTradeData(null);
    setDialogOrderBy('date');
    setDialogOrderDirection('asc');
  };

  const handleDialogSort = (property) => {
    const isAsc = dialogOrderBy === property && dialogOrderDirection === 'asc';
    setDialogOrderBy(property);
    setDialogOrderDirection(isAsc ? 'desc' : 'asc');
  };

  const sortDialogData = (data) => {
    return [...data].sort((a, b) => {
      if (dialogOrderBy === 'date') {
        const aVal = moment(a[dialogOrderBy]).valueOf();
        const bVal = moment(b[dialogOrderBy]).valueOf();
        return dialogOrderDirection === 'asc' ? aVal - bVal : bVal - aVal;
      } else if (dialogOrderBy === 'gained_points' || dialogOrderBy === 'current_open') {
        const aVal = a[dialogOrderBy] || 0;
        const bVal = b[dialogOrderBy] || 0;
        return dialogOrderDirection === 'asc' ? aVal - bVal : bVal - aVal;
      } else {
        const aVal = a[dialogOrderBy] || '';
        const bVal = b[dialogOrderBy] || '';
        return dialogOrderDirection === 'asc' ? 
          aVal.toString().localeCompare(bVal.toString()) : 
          bVal.toString().localeCompare(aVal.toString());
      }
    });
  };

  useEffect(() => {
    fetchTradeSummary();
    const intervalId = setInterval(fetchTradeSummary, 300000); // Refresh every 5 minutes
    return () => clearInterval(intervalId);
  }, []);

  const handleSort = (property) => {
    const isAsc = orderBy === property && orderDirection === 'asc';
    setOrderBy(property);
    setOrderDirection(isAsc ? 'desc' : 'asc');
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const sortData = (data) => {
    return [...data].sort((a, b) => {
      if (orderBy === 'date' || orderBy === 'start_date') {
        const aVal = moment(a[orderBy]).valueOf();
        const bVal = moment(b[orderBy]).valueOf();
        return orderDirection === 'asc' ? aVal - bVal : bVal - aVal;
      } else {
        const aVal = a[orderBy] || 0;
        const bVal = b[orderBy] || 0;
        return orderDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
  };

  if (errorMsg) {
    return (
      <>
        <CustomAppBar />
        <Container maxWidth="xl" sx={{ mt: 2 }}>
          <Typography variant="h4" sx={{ color: '#F44336', textAlign: 'center', mt: 4 }}>
            {errorMsg}
          </Typography>
        </Container>
      </>
    );
  }
  if (!summaryData) {
    return (
      <>
        <CustomAppBar />
        <Container maxWidth="xl" sx={{ mt: 2 }}>
          <Typography variant="h4" sx={{ color: '#e0e0e0', textAlign: 'center', mt: 4 }}>
            {errorMsg ? errorMsg : 'Loading Trade Summary...'}
          </Typography>
        </Container>
      </>
    );
  }

  return (
    <>
      <CustomAppBar />
      <Container maxWidth="xl" sx={{ mt: 2 }}>
        
        {/* Overall Summary Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={4}>
            <SummaryCard>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
                  Total Trades
                </Typography>
                <StatValue>{summaryData.overall.total_trades}</StatValue>
              </CardContent>
            </SummaryCard>
          </Grid>
          
          <Grid item xs={12} sm={6} md={4}>
            <SummaryCard>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
                  Trade Breakdown
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="h6" sx={{ color: '#4CAF50', fontSize: '1.1rem', fontWeight: 'bold' }}>
                    Positive: {summaryData.overall.positive_trades}
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#F44336', fontSize: '1.1rem', fontWeight: 'bold' }}>
                    Negative: {summaryData.overall.negative_trades}
                  </Typography>
                </Box>
              </CardContent>
            </SummaryCard>
          </Grid>
          
          <Grid item xs={12} sm={6} md={4}>
            <SummaryCard>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
                  Win Rate
                </Typography>
                <StatValue positive={summaryData.overall.win_rate > 50}>
                  {summaryData.overall.win_rate.toFixed(1)}%
                </StatValue>
              </CardContent>
            </SummaryCard>
          </Grid>
          
          <Grid item xs={12} sm={6} md={4}>
            <SummaryCard>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
                  Total Points
                </Typography>
                <StatValue positive={summaryData.overall.sum_gained_points > 0 ? true : summaryData.overall.sum_gained_points < 0 ? false : null}>
                  {formatNumber(summaryData.overall.sum_gained_points)}
                </StatValue>
              </CardContent>
            </SummaryCard>
          </Grid>
          
          <Grid item xs={12} sm={6} md={4}>
            <SummaryCard>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
                  Avg Points/Trade
                </Typography>
                <StatValue positive={summaryData.overall.avg_gained_points > 0}>
                  {formatNumber(summaryData.overall.avg_gained_points)}
                </StatValue>
              </CardContent>
            </SummaryCard>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <SummaryCard>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
                  Trading Days
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="h5" sx={{ color: '#00ffaa' }}>
                    Days: {summaryData.trade_days_count}/{summaryData.total_days_in_data}
                  </Typography>
                  <Typography variant="h5" sx={{ color: summaryData.trade_day_hit_rate === 100 ? '#4CAF50' : '#FFEB3B' }}>
                    Hit Rate: {summaryData.trade_day_hit_rate}%
                  </Typography>
                </Box>
              </CardContent>
            </SummaryCard>
          </Grid>
        </Grid>

        {/* Tabs for Daily and Weekly Views */}
        <Paper sx={{
          background: '#0a1929',
          border: '1px solid #00ffaa30',
          borderRadius: '8px',
          boxShadow: '0 0 20px #00ffaa20',
        }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            sx={{
              borderBottom: '1px solid #00ffaa30',
              '& .MuiTab-root': { color: '#e0e0e0' },
              '& .Mui-selected': { color: '#00ffaa' },
              '& .MuiTabs-indicator': { backgroundColor: '#00ffaa' }
            }}
          >
            <Tab label="Daily Summary" />
            <Tab label="Weekly Summary" />
            <Tab label="Weekly Meta" />
            <Tab label="No Trade Days" />
          </Tabs>

          <TableContainer>
            <Table stickyHeader sx={{ minWidth: 1200 }}>
              <TableHead>
                <GradientHeader>
                  {(tabValue === 0 ? 
                    // Daily Headers
                    [
                      { label: 'Date', prop: 'date', width: '120px' },
                      { label: 'Trades', prop: 'trades', align: 'center' },
                      { label: 'Win Rate %', prop: 'win_rate', align: 'center' },
                      { label: 'Points', prop: 'sum_gained_points', align: 'right' },
                      { label: 'Avg Points', prop: 'avg_gained_points', align: 'right' },
                      { label: 'Max Gain', prop: 'max_gain', align: 'right' },
                      { label: 'Max Loss', prop: 'max_loss', align: 'right' },
                      { label: 'Positive', prop: 'positive_trades', align: 'center' },
                      { label: 'Negative', prop: 'negative_trades', align: 'center' },
                    ]
                    : tabValue === 1 ?
                    // Weekly Headers
                    [
                      { label: 'Week', prop: 'start_date', width: '200px' },
                      { label: 'Trade Days', prop: 'trade_days', align: 'center' },
                      { label: 'Trades', prop: 'trades', align: 'center' },
                      { label: 'Win Rate %', prop: 'win_rate', align: 'center' },
                      { label: 'Points', prop: 'sum_gained_points', align: 'right' },
                      { label: 'Avg Points', prop: 'avg_gained_points', align: 'right' },
                      { label: 'Max Gain', prop: 'max_gain', align: 'right' },
                      { label: 'Max Loss', prop: 'max_loss', align: 'right' },
                      { label: 'Missing Days', prop: 'missing_trade_dates', align: 'center' },
                    ]
                    : tabValue === 2 ?
                    // Weekly Meta Headers
                    [
                      { label: 'Metric', prop: 'metric', width: '200px' },
                      { label: 'Value', prop: 'value', align: 'center' },
                    ]
                    :
                    // No Trade Days Headers
                    [
                      { label: 'Date', prop: 'date', width: '200px' },
                      { label: 'Day of Week', prop: 'day_of_week', align: 'center' },
                      { label: 'Reason', prop: 'reason', align: 'center' },
                    ]
                  ).map((head) => (
                    <StyledTableCell
                      key={head.label}
                      align={head.align || 'left'}
                    >
                      <TableSortLabel
                        active={orderBy === head.prop}
                        direction={orderDirection}
                        onClick={() => handleSort(head.prop)}
                        sx={{ color: '#e0e0e0' }}
                      >
                        {head.label}
                      </TableSortLabel>
                    </StyledTableCell>
                  ))}
                </GradientHeader>
              </TableHead>
              <TableBody>
                {tabValue === 0 ? 
                  // Daily Data
                  sortData(summaryData.by_date).map((day, index) => (
                    <HoverRow key={index}>
                      <ClickableDate onClick={() => handleDateClick(day.date)}>
                        {moment(day.date).format('DD-MMM-YYYY')}
                      </ClickableDate>
                      <StyledTableCell align="center">{day.trades}</StyledTableCell>
                      <StyledTableCell align="center" sx={{
                        color: day.win_rate >= 80 ? '#4CAF50' : day.win_rate >= 50 ? '#FFEB3B' : '#F44336'
                      }}>
                        {day.win_rate.toFixed(1)}%
                      </StyledTableCell>
                      <StyledTableCell align="right" sx={{
                        color: day.sum_gained_points > 0 ? '#4CAF50' : day.sum_gained_points < 0 ? '#F44336' : '#FFEB3B',
                        fontWeight: 'bold'
                      }}>
                        {formatNumber(day.sum_gained_points)}
                      </StyledTableCell>
                      <StyledTableCell align="right" sx={{
                        color: day.avg_gained_points > 0 ? '#4CAF50' : day.avg_gained_points < 0 ? '#F44336' : '#FFEB3B'
                      }}>
                        {formatNumber(day.avg_gained_points)}
                      </StyledTableCell>
                      <StyledTableCell align="right" sx={{ color: '#4CAF50' }}>
                        {day.max_gain}
                      </StyledTableCell>
                      <StyledTableCell align="right" sx={{ color: day.max_loss < 0 ? '#F44336' : '#e0e0e0' }}>
                        {day.max_loss}
                      </StyledTableCell>
                      <StyledTableCell align="center" sx={{ color: '#4CAF50' }}>
                        {day.positive_trades}
                      </StyledTableCell>
                      <StyledTableCell align="center" sx={{ color: day.negative_trades > 0 ? '#F44336' : '#e0e0e0' }}>
                        {day.negative_trades}
                      </StyledTableCell>
                    </HoverRow>
                  ))
                  : tabValue === 1 ?
                  // Weekly Data
                  sortData(summaryData.by_week).map((week, index) => (
                    <HoverRow key={index}>
                      <StyledTableCell sx={{ color: '#00ffaa' }}>
                        {moment(week.start_date).format('DD-MMM')} to {moment(week.end_date).format('DD-MMM-YYYY')}
                      </StyledTableCell>
                      <StyledTableCell align="center">
                        {week.trade_days}/{week.expected_trade_days}
                      </StyledTableCell>
                      <StyledTableCell align="center">{week.trades}</StyledTableCell>
                      <StyledTableCell align="center" sx={{
                        color: week.win_rate >= 80 ? '#4CAF50' : week.win_rate >= 50 ? '#FFEB3B' : '#F44336'
                      }}>
                        {week.win_rate.toFixed(1)}%
                      </StyledTableCell>
                      <StyledTableCell align="right" sx={{
                        color: week.sum_gained_points > 0 ? '#4CAF50' : week.sum_gained_points < 0 ? '#F44336' : '#FFEB3B',
                        fontWeight: 'bold'
                      }}>
                        {formatNumber(week.sum_gained_points)}
                      </StyledTableCell>
                      <StyledTableCell align="right" sx={{
                        color: week.avg_gained_points > 0 ? '#4CAF50' : week.avg_gained_points < 0 ? '#F44336' : '#FFEB3B'
                      }}>
                        {formatNumber(week.avg_gained_points)}
                      </StyledTableCell>
                      <StyledTableCell align="right" sx={{ color: '#4CAF50' }}>
                        {week.max_gain}
                      </StyledTableCell>
                      <StyledTableCell align="right" sx={{ color: week.max_loss < 0 ? '#F44336' : '#e0e0e0' }}>
                        {week.max_loss}
                      </StyledTableCell>
                      <StyledTableCell align="center">
                        {week.missing_trade_dates.length > 0 ? (
                          <Box sx={{ color: '#FFEB3B' }}>
                            {week.missing_trade_dates.length} days
                          </Box>
                        ) : (
                          <Box sx={{ color: '#4CAF50' }}>Complete</Box>
                        )}
                      </StyledTableCell>
                    </HoverRow>
                  ))
                  : tabValue === 2 ?
                  // Weekly Meta Data
                  [
                    { metric: 'Total Weeks in Data', value: summaryData.weekly_meta.total_weeks_in_data },
                    { metric: 'Trade Weeks Count', value: summaryData.weekly_meta.trade_weeks_count },
                    { metric: 'No Trade Weeks Count', value: summaryData.weekly_meta.no_trade_weeks_count },
                    { metric: 'Trade Week Hit Rate', value: `${summaryData.weekly_meta.trade_week_hit_rate}%` },
                  ].map((item, index) => (
                    <HoverRow key={index}>
                      <StyledTableCell sx={{ color: '#00ffaa' }}>
                        {item.metric}
                      </StyledTableCell>
                      <StyledTableCell align="center" sx={{
                        color: item.metric.includes('Hit Rate') && item.value === '100%' ? '#4CAF50' : 
                               item.metric.includes('No Trade') && item.value === 0 ? '#4CAF50' : '#e0e0e0',
                        fontWeight: 'bold'
                      }}>
                        {item.value}
                      </StyledTableCell>
                    </HoverRow>
                  ))
                  :
                  // No Trade Days Data
                  summaryData.no_trade_dates.map((date, index) => (
                    <HoverRow key={index}>
                      <StyledTableCell sx={{ color: '#00ffaa' }}>
                        {moment(date).format('DD-MMM-YYYY')}
                      </StyledTableCell>
                      <StyledTableCell align="center" sx={{ color: '#FFEB3B' }}>
                        {moment(date).format('dddd')}
                      </StyledTableCell>
                      <StyledTableCell align="center" sx={{ color: '#F44336' }}>
                        No Trading Activity
                      </StyledTableCell>
                    </HoverRow>
                  ))
                }
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Trade Details Dialog */}
        <TradeDialog
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
              Signal Details - {selectedDate ? moment(selectedDate).format('DD MMM YYYY') : ''}
            </Typography>
            <IconButton onClick={handleDialogClose} sx={{ color: '#e0e0e0' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent sx={{ padding: '20px', minHeight: '400px' }}>
            {loadingTradeData ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                <CircularProgress sx={{ color: '#00ffaa' }} />
                <Typography sx={{ color: '#e0e0e0', ml: 2 }}>Loading signal data...</Typography>
              </Box>
            ) : dateTradeData && dateTradeData.length > 0 ? (
              <>
                {/* Summary Stats for the Day */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={3}>
                    <Card sx={{ background: 'linear-gradient(45deg, #1a237e 30%, #0d47a1 90%)', border: '1px solid #00ffaa30' }}>
                      <CardContent sx={{ textAlign: 'center', py: 1 }}>
                        <Typography variant="h6" sx={{ color: '#e0e0e0' }}>Total Signals</Typography>
                        <Typography variant="h4" sx={{ color: '#00ffaa' }}>{dateTradeData.length}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={3}>
                    <Card sx={{ background: 'linear-gradient(45deg, #1a237e 30%, #0d47a1 90%)', border: '1px solid #00ffaa30' }}>
                      <CardContent sx={{ textAlign: 'center', py: 1 }}>
                        <Typography variant="h6" sx={{ color: '#e0e0e0' }}>Buy Signals</Typography>
                        <Typography variant="h4" sx={{ color: '#4CAF50' }}>
                          {dateTradeData.filter(signal => signal.weighted_signal === 'Buy').length}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={3}>
                    <Card sx={{ background: 'linear-gradient(45deg, #1a237e 30%, #0d47a1 90%)', border: '1px solid #00ffaa30' }}>
                      <CardContent sx={{ textAlign: 'center', py: 1 }}>
                        <Typography variant="h6" sx={{ color: '#e0e0e0' }}>Sell Signals</Typography>
                        <Typography variant="h4" sx={{ color: '#F44336' }}>
                          {dateTradeData.filter(signal => signal.weighted_signal === 'Sell').length}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={3}>
                    <Card sx={{ background: 'linear-gradient(45deg, #1a237e 30%, #0d47a1 90%)', border: '1px solid #00ffaa30' }}>
                      <CardContent sx={{ textAlign: 'center', py: 1 }}>
                        <Typography variant="h6" sx={{ color: '#e0e0e0' }}>Total Points</Typography>
                        <Typography variant="h4" sx={{ 
                          color: dateTradeData.reduce((sum, signal) => sum + (signal.gained_points || 0), 0) > 0 ? '#4CAF50' : '#F44336' 
                        }}>
                          {formatNumber(dateTradeData.reduce((sum, signal) => sum + (signal.gained_points || 0), 0))}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Individual Signal Table */}
                <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2 }}>Signal Details</Typography>
                <TableContainer component={Paper} sx={{ 
                  maxHeight: '400px', 
                  background: '#0a1929',
                  border: '1px solid #00ffaa30'
                }}>
                  <Table stickyHeader>
                    <TableHead>
                      <GradientHeader>
                        <StyledTableCell>
                          <TableSortLabel
                            active={dialogOrderBy === 'date'}
                            direction={dialogOrderDirection}
                            onClick={() => handleDialogSort('date')}
                            sx={{ color: '#e0e0e0' }}
                          >
                            Time
                          </TableSortLabel>
                        </StyledTableCell>
                        <StyledTableCell align="right">
                          <TableSortLabel
                            active={dialogOrderBy === 'current_open'}
                            direction={dialogOrderDirection}
                            onClick={() => handleDialogSort('current_open')}
                            sx={{ color: '#e0e0e0' }}
                          >
                            Market Price
                          </TableSortLabel>
                        </StyledTableCell>
                        <StyledTableCell align="center">
                          <TableSortLabel
                            active={dialogOrderBy === 'weighted_signal'}
                            direction={dialogOrderDirection}
                            onClick={() => handleDialogSort('weighted_signal')}
                            sx={{ color: '#e0e0e0' }}
                          >
                            Signal
                          </TableSortLabel>
                        </StyledTableCell>
                        <StyledTableCell align="right">
                          <TableSortLabel
                            active={dialogOrderBy === 'gained_points'}
                            direction={dialogOrderDirection}
                            onClick={() => handleDialogSort('gained_points')}
                            sx={{ color: '#e0e0e0' }}
                          >
                            Points Gained
                          </TableSortLabel>
                        </StyledTableCell>
                      </GradientHeader>
                    </TableHead>
                    <TableBody>
                      {sortDialogData(dateTradeData).map((signal, index) => {
                        const isPositive = (signal.gained_points || 0) > 0;
                        const signalType = signal.weighted_signal;
                        
                        // Determine row background color based on signal type
                        const getRowColor = () => {
                          switch(signalType) {
                            case 'Buy':
                              return '#1b5e2030'; // Green background
                            case 'Sell':
                              return '#b71c1c30'; // Red background
                            default:
                              return '#42424230'; // Grey background for NoTrade
                          }
                        };
                        
                        return (
                          <TableRow 
                            key={index}
                            sx={{
                              backgroundColor: getRowColor(),
                              '&:hover': {
                                backgroundColor: signalType === 'Buy' ? '#1b5e2050' : 
                                                signalType === 'Sell' ? '#b71c1c50' : '#42424250',
                                transform: 'scale(1.002)',
                                transition: 'all 0.1s ease-in-out',
                              },
                            }}
                          >
                            <StyledTableCell>
                              <Typography variant="body2" sx={{ color: '#00ffaa' }}>
                                {moment(signal.date).format('HH:mm:ss')}
                              </Typography>
                            </StyledTableCell>
                            <StyledTableCell align="right">
                              <Typography variant="body2" sx={{ color: '#FFEB3B' }}>
                                {signal.current_open ? formatNumber(signal.current_open) : 'N/A'}
                              </Typography>
                            </StyledTableCell>
                            <StyledTableCell align="center">
                              <Chip 
                                label={signalType || 'NoTrade'} 
                                size="small" 
                                sx={{ 
                                  backgroundColor: signalType === 'Buy' ? '#4CAF5030' : 
                                                 signalType === 'Sell' ? '#F4433630' : '#9E9E9E30',
                                  color: signalType === 'Buy' ? '#4CAF50' : 
                                         signalType === 'Sell' ? '#F44336' : '#9E9E9E',
                                  fontWeight: 'bold'
                                }}
                              />
                            </StyledTableCell>
                            <StyledTableCell align="right">
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                {(signal.gained_points || 0) > 0 && (
                                  <ArrowUpward sx={{ color: '#4CAF50', fontSize: '16px' }} />
                                )}
                                {(signal.gained_points || 0) < 0 && (
                                  <ArrowDownward sx={{ color: '#F44336', fontSize: '16px' }} />
                                )}
                                <Typography variant="body2" sx={{ 
                                  color: isPositive ? '#4CAF50' : (signal.gained_points || 0) < 0 ? '#F44336' : '#FFEB3B',
                                  fontWeight: 'bold'
                                }}>
                                  {signal.gained_points ? 
                                    (isPositive ? '+' : '') + formatNumber(signal.gained_points) : 
                                    '0.00'
                                  }
                                </Typography>
                              </Box>
                            </StyledTableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" sx={{ color: '#e0e0e0' }}>
                  No signal data available for {selectedDate ? moment(selectedDate).format('DD MMM YYYY') : 'this date'}
                </Typography>
              </Box>
            )}
          </DialogContent>
          
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
        </TradeDialog>
      </Container>
    </>
  );
};

export default TradeSummary;
