// TradeAnalysis.jsx - Complete 360° Analytics Overview as standalone page
// Extracted from fusion.jsx analytics dialog to provide comprehensive trade analysis

import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Container, CircularProgress, Grid, Card, CardContent, Chip, Stack,
  TextField, MenuItem, Button, useTheme, useMediaQuery, Alert, LinearProgress,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper
} from '@mui/material';
import {
  BarChart as BarChartIcon, ShowChart as ShowChartIcon, TrendingUp as TrendingUpIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import CustomAppBar from './CustomAppBar';
import { httpApi } from './api';
import moment from 'moment';

// ===== HELPER FUNCTIONS =====
const parseToMoment = (val) => {
  if (!val) return null;
  if (moment.isMoment(val)) return val;
  const parsed = moment(val);
  return parsed.isValid() ? parsed : null;
};

const formatToIST = (val) => {
  const m = parseToMoment(val);
  return m && m.isValid()
    ? m.utcOffset(330).format('DD-MMM-YYYY HH:mm:ss')
    : String(val ?? '');
};

const fmtNum = (n, d = 2) => (Number.isFinite(Number(n)) ? Number(n).toFixed(d) : String(n ?? ''));
const sum = (arr) => arr.reduce((acc, v) => acc + (Number(v) || 0), 0);

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

// ===== ANALYTICS COMPUTATION =====
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

  // Fund movement analysis
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
    const firstTrade = allTrades[0];
    const lastTrade = allTrades[allTrades.length - 1];
    
    if (firstTrade.transaction_type === 'BUY' && firstTrade.used_margin) {
      initialMargin = firstTrade.available_margin + firstTrade.used_margin;
    } else {
      initialMargin = firstTrade.available_margin;
    }
    
    finalMargin = lastTrade.available_margin;
    
    if (initialMargin > 0) {
      const capitalChange = finalMargin - initialMargin;
      marginBasedPortfolioPct = (capitalChange / initialMargin) * 100;
    }

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
  
  const outcomeStats = {
    PROFIT: profitTrades.length,
    LOSS: lossTrades.length,
    FLAT: flat,
    'IN-PROGRESS': rows.filter(r => r.in_progress).length
  };
  
  return {
    totalTrades, wins, losses, flat, winRate,
    totalPnL, totalBuyCost, totalSellValue, portfolioPnLPct,
    marginBasedPortfolioPct, fundMovementAnalysis,
    profitFactor, avgProfit, avgLoss, avgPnL,
    totalProfit, totalLoss, tagAnalysis, signalAnalysis, outcomeStats
  };
};

// ===== CHART COMPONENTS =====
// (Continuation follows in next command due to size limit)
