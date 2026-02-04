// src/MarketStream.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Card, CardContent, Chip, Container, Grid, Typography,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper,
  TextField, InputAdornment, IconButton, Tooltip
} from '@mui/material';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import RemoveIcon from '@mui/icons-material/Remove';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import CustomAppBar from './CustomAppBar';
import { connectSocket, wsState } from './api';

// Safe number formatter that shows — for null/undefined/NaN
const fmt = (v, digits = 2) => {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '—';
};

const safeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const formatPercentChange = (value) => {
  const num = safeNumber(value);
  if (num === null) return '—';
  const abs = Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${num >= 0 ? '+' : '-'}${abs}%`;
};

const formatTimestamp = (ts) => (ts ? new Date(ts).toLocaleTimeString() : '—');

const TREND_COLORS = {
  UP: '#4CAF50',
  DOWN: '#EF5350',
  FLAT: '#90A4AE',
  STEADY: '#90A4AE',
  NEUTRAL: '#90A4AE',
};

const TrendIcon = ({ trend }) => {
  const key = String(trend || '').toUpperCase();
  if (key === 'UP') return <ArrowDropUpIcon sx={{ color: TREND_COLORS.UP, fontSize: 22, verticalAlign: 'middle' }} />;
  if (key === 'DOWN') return <ArrowDropDownIcon sx={{ color: TREND_COLORS.DOWN, fontSize: 22, verticalAlign: 'middle' }} />;
  return <RemoveIcon sx={{ color: TREND_COLORS.NEUTRAL, fontSize: 20, verticalAlign: 'middle' }} />;
};

const ValuePercentTrend = ({ value, percent, trend, isRupee, digits = 2 }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
    <span style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 500 }}>
      {isRupee ? '₹' : ''}{fmt(value, digits)}
    </span>
    <span style={{ color: '#90caf9', fontSize: '0.85em', fontFamily: "'Roboto Mono', monospace" }}>
      {formatPercentChange(percent)}
    </span>
    <TrendIcon trend={trend} />
  </Box>
);

const normalizeMetricRow = (payload = {}) => {
  const tokenValue = payload.token ?? payload.instrument_token ?? payload.id;
  const token = tokenValue !== undefined && tokenValue !== null ? String(tokenValue) : '';
  if (!token) return null;

  return {
    token,
    symbol: payload.tradingsymbol ?? payload.symbol ?? '',
    ltp: safeNumber(payload.ltp ?? payload.last_price),
    ltp_rate_of_change: safeNumber(payload.ltp_rate_of_change),
    ltp_trend: payload.ltp_trend ?? null,
    oi: safeNumber(payload.open_interest ?? payload.oi),
    oi_rate_of_change: safeNumber(payload.oi_rate_of_change),
    oi_trend: payload.oi_trend ?? null,
    volume: safeNumber(payload.volume ?? payload.volume_traded ?? payload.vol),
    volume_rate_of_change: safeNumber(payload.volume_rate_of_change),
    volume_trend: payload.volume_trend ?? null,
    ts: payload.ts ?? payload.time ?? Date.now(),
  };
};

const METRIC_TOPIC_PREFIX = 'option-metrics/';
const AGGREGATE_TOPIC = `${METRIC_TOPIC_PREFIX}all`;
const SUBSCRIPTION_TOPICS = [AGGREGATE_TOPIC];

export default function MarketStream() {
  const [connected, setConnected] = useState(false);
  const [pageActive, setPageActive] = useState(document.visibilityState === 'visible');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [lastAggregateTs, setLastAggregateTs] = useState(null);

  const socketRef = useRef(null);
  const metricsMapRef = useRef(new Map());

  const updateRowsFromMap = useCallback(() => {
    const arr = Array.from(metricsMapRef.current.values())
      .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
    setRows(arr);
  }, []);

  const upsertRow = useCallback((payload = {}) => {
    const normalized = normalizeMetricRow(payload);
    if (!normalized) return false;
    metricsMapRef.current.set(normalized.token, normalized);
    return true;
  }, []);

  const upsertFromItems = useCallback((items = []) => {
    let touched = false;
    items.forEach((item) => {
      if (upsertRow(item)) touched = true;
    });
    return touched;
  }, [upsertRow]);

  const processAggregatePayload = useCallback((payload = {}) => {
    const touched = upsertFromItems(payload.items || []);
    if (payload.ts) {
      setLastAggregateTs(payload.ts);
    } else {
      setLastAggregateTs(Date.now());
    }
    if (touched) {
      updateRowsFromMap();
    }
  }, [upsertFromItems, updateRowsFromMap]);

  const processTokenPayload = useCallback((payload = {}) => {
    if (upsertRow(payload.data ?? payload)) {
      updateRowsFromMap();
    }
  }, [upsertRow, updateRowsFromMap]);

  const loadLatestSnapshot = useCallback(async () => {
    try {
      const { result } = await wsState({ prefix: 'option-metrics', latest: true, limit: 500 });
      metricsMapRef.current.clear();

      let aggregateTimestamp = null;
      const entries = Array.isArray(result)
        ? result
        : Object.entries(result || {}).map(([topic, payload]) => ({ topic, ...payload }));

      entries.forEach((entry) => {
        const topic = entry.topic || '';
        const payload = entry.data ?? entry.payload ?? entry;

        if (topic === AGGREGATE_TOPIC || Array.isArray(payload?.items)) {
          upsertFromItems(payload?.items || []);
          aggregateTimestamp = payload?.ts ?? entry.ts ?? aggregateTimestamp;
        } else if (topic.startsWith(METRIC_TOPIC_PREFIX)) {
          upsertRow(payload);
        }
      });

      if (aggregateTimestamp) {
        setLastAggregateTs(aggregateTimestamp);
      }
      updateRowsFromMap();
    } catch (error) {
      console.error('Failed to load option metrics snapshot', error);
    }
  }, [upsertFromItems, upsertRow, updateRowsFromMap]);

  // Filter by token or trading symbol
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      String(r.token ?? '').toLowerCase().includes(q) ||
      String(r.symbol ?? '').toLowerCase().includes(q)
    );
  }, [rows, query]);

  // Handle page visibility: disconnect when hidden, reconnect when visible
  useEffect(() => {
    const onVis = () => setPageActive(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Connect to option-metrics streams
  useEffect(() => {
    if (!pageActive) {
      if (socketRef.current) {
        try { socketRef.current.disconnect(); } catch {}
        socketRef.current = null;
      }
      setConnected(false);
      return;
    }

    const socket = connectSocket();
    socketRef.current = socket;

    const handleAggregate = (payload) => processAggregatePayload(payload || {});
    const handleAny = (event, payload) => {
      if (!event || typeof event !== 'string') return;
      if (!event.startsWith(METRIC_TOPIC_PREFIX) || event === AGGREGATE_TOPIC) return;
      processTokenPayload(payload || {});
    };

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('subscribe', { topics: SUBSCRIPTION_TOPICS });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on(AGGREGATE_TOPIC, handleAggregate);
    socket.onAny(handleAny);

    loadLatestSnapshot();

    return () => {
      socket.off(AGGREGATE_TOPIC, handleAggregate);
      socket.offAny(handleAny);
      socket.disconnect();
    };
  }, [pageActive, loadLatestSnapshot, processAggregatePayload, processTokenPayload]);

  const refreshState = () => {
    loadLatestSnapshot();
  };

  return (
    <>
      <CustomAppBar />
      <Container
        maxWidth="xl"
        sx={{
          borderRadius: '8px',
          border: '1px solid #00ffaa30',
          boxShadow: '0 0 20px #00ffaa20',
          background: '#0a1929',
          mt: 1,
          minHeight: '100vh',
          pb: 2,
        }}
      >
        <Typography variant="h4" sx={{ color: '#00ffaa', textAlign: 'center', py: 3, fontWeight: 'bold' }}>
          Live Market Stream
        </Typography>

        <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #2a3f9e 0%, #1a5fb4 100%)', border: '1px solid #00ffaa30' }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              {/* WS status + page-activity */}
              <Grid item xs={12} md="auto">
                <Chip
                  icon={<FiberManualRecordIcon sx={{ color: connected ? '#4CAF50' : '#F44336' }} />}
                  label={connected ? 'WebSocket: Connected' : 'WebSocket: Disconnected'}
                  sx={{
                    mr: 1,
                    backgroundColor: connected ? '#4CAF5020' : '#F4433620',
                    color: connected ? '#4CAF50' : '#F44336',
                    border: `1px solid ${connected ? '#4CAF50' : '#F44336'}40`,
                  }}
                />
                {!pageActive && (
                  <Chip
                    icon={<PauseCircleOutlineIcon sx={{ color: '#FFC107' }} />}
                    label="Paused (tab hidden)"
                    sx={{
                      backgroundColor: '#FFC10720',
                      color: '#FFC107',
                      border: '1px solid #FFC10740',
                    }}
                  />
                )}
              </Grid>

              {/* search filter */}
              <Grid item xs={12} md>
                <TextField
                  size="small"
                  fullWidth
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  label="Filter token / trading symbol"
                  placeholder="e.g. 16559106 or NIFTY25SEP20000CE"
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#9E9E9E' }} />
                      </InputAdornment>
                    ),
                    sx: {
                      color: '#e0e0e0',
                      '& fieldset': { borderColor: '#00ffaa30' },
                      '&:hover fieldset': { borderColor: '#00ffaa60' },
                    }
                  }}
                />
              </Grid>

              {/* refresh */}
              <Grid item xs={12} md="auto">
                <Tooltip title="Refresh last values from server">
                  <span>
                    <IconButton onClick={refreshState} sx={{ color: '#00ffaa', border: '1px solid #00ffaa40' }}>
                      <RefreshIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Grid>

              <Grid item xs={12} md="auto">
                <Typography variant="body2" sx={{ color: '#cfd8dc', fontFamily: "'Roboto Mono', monospace", mt: { xs: 1, md: 0 } }}>
                  Last aggregate: {formatTimestamp(lastAggregateTs)}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Data table */}
        <Card
          sx={{
            background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)',
            border: '1px solid #00ffaa30',
          }}
        >
          <CardContent>
            <TableContainer component={Paper} sx={{ background: '#0a1929' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ background: 'linear-gradient(45deg, #1a5fb4 30%, #2a3f9e 90%)', borderBottom: '2px solid #00ffaa80' }}>
                    <TableCell sx={headCell} align="left">Trading Symbol</TableCell>
                    <TableCell sx={headCell} align="right">LTP</TableCell>
                    <TableCell sx={headCell} align="right">ATR</TableCell>
                    <TableCell sx={headCell} align="right">OI</TableCell>
                    <TableCell sx={headCell} align="right">Volume</TableCell>
                    <TableCell sx={headCell} align="right">Updated</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRows.map((r, idx) => (
                    <TableRow key={`${r.token}-${idx}`} sx={{ '&:hover': { backgroundColor: '#1a237e30' } }}>
                      <TableCell sx={bodyCell}>{r.symbol || '—'}</TableCell>
                      <TableCell sx={bodyCellRight} align="right">
                        <ValuePercentTrend value={r.ltp} percent={r.ltp_rate_of_change} trend={r.ltp_trend} isRupee />
                      </TableCell>
                      <TableCell sx={bodyCellRight} align="right">
                        <ValuePercentTrend value={r.atr} percent={r.atr_rate_of_change} trend={r.atr_trend} />
                      </TableCell>
                      <TableCell sx={bodyCellRight} align="right">
                        <ValuePercentTrend value={r.oi} percent={r.oi_rate_of_change} trend={r.oi_trend} />
                      </TableCell>
                      <TableCell sx={bodyCellRight} align="right">
                        <ValuePercentTrend value={r.volume} percent={r.volume_rate_of_change} trend={r.volume_trend} digits={0} />
                      </TableCell>
                      <TableCell sx={bodyCellRight} align="right">{formatTimestamp(r.ts)}</TableCell>
                    </TableRow>
                  ))}
                  {!filteredRows.length && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ color: '#9E9E9E', textAlign: 'center', py: 4 }}>
                        {pageActive
                          ? 'No data yet — waiting for ticks.'
                          : 'Paused — switch back to this tab to resume.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Container>
    </>
  );
}

const headCell = {
  fontWeight: 'bold',
  padding: '8px 12px',
  fontFamily: "'Roboto Mono', monospace",
  color: '#e0e0e0',
};

const bodyCell = {
  color: '#e0e0e0',
  fontFamily: "'Roboto Mono', monospace",
  padding: '8px 12px',
};

const bodyCellRight = { ...bodyCell, textAlign: 'right' };
