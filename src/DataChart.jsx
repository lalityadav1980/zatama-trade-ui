import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import CustomAppBar from './CustomAppBar';
import { Container, Typography, Paper, Box } from '@mui/material';

const DataChart = ({ data = [] }) => {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const candleSeriesRef = useRef();

  useEffect(() => {
    if (!chartContainerRef.current) return;
    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
    }
    chartRef.current = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.offsetWidth || 1200,
      height: 500,
      layout: {
        background: { type: 'solid', color: '#0a1929' },
        textColor: '#e0e0e0',
      },
      grid: {
        vertLines: { color: '#1a237e' },
        horzLines: { color: '#1a237e' },
      },
      crosshair: {
        mode: 1,
      },
      timeScale: {
        borderColor: '#00ffaa',
        timeVisible: true,
        secondsVisible: true,
      },
      rightPriceScale: {
        borderColor: '#00ffaa',
      },
    });
    candleSeriesRef.current = chartRef.current.addCandlestickSeries({
      upColor: '#4CAF50',
      downColor: '#F44336',
      borderUpColor: '#4CAF50',
      borderDownColor: '#F44336',
      wickUpColor: '#4CAF50',
      wickDownColor: '#F44336',
    });
    // Format data for lightweight-charts
    const candleData = data.map(d => ({
      time: d.date ? Math.floor(new Date(d.date).getTime() / 1000) : undefined,
      open: Number(d.open),
      high: Number(d.high),
      low: Number(d.low),
      close: Number(d.close),
      volume: Number(d.volume),
      weighted_signal: d.weighted_signal,
      gained_points: d.gained_points
    })).filter(d => d.time);
    candleSeriesRef.current.setData(candleData);
    // Add notes as markers
    candleSeriesRef.current.setMarkers(
      candleData.map((d, idx) => ({
        time: d.time,
        position: 'aboveBar',
        color: '#FFD700',
        shape: 'text',
        text: `O:${d.open} H:${d.high} L:${d.low} C:${d.close}`,
        id: `note-${idx}`,
        tooltip: `Open: ${d.open}, High: ${d.high}, Low: ${d.low}, Close: ${d.close}, Volume: ${d.volume}, Signal: ${d.weighted_signal || '-'}, Points: ${typeof d.gained_points === 'number' ? d.gained_points : '-'}`
      }))
    );
    // Resize chart on window resize
    const handleResize = () => {
      chartRef.current.applyOptions({ width: chartContainerRef.current.offsetWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) chartRef.current.remove();
    };
  }, [data]);

  return (
    <>
      <CustomAppBar />
      <Container maxWidth="xl" sx={{ mt: 2 }}>
        <Typography variant="h4" sx={{ color: '#00ffaa', mb: 2, textAlign: 'center', fontWeight: 'bold', letterSpacing: 1 }}>
          Trade Signal Data Chart
        </Typography>
        <Paper sx={{ p: 2, mb: 3, background: 'linear-gradient(45deg, #1a237e 30%, #0d47a1 90%)', border: '1px solid #00ffaa30', boxShadow: '0 0 20px #00ffaa20', borderRadius: '12px' }}>
          <Box ref={chartContainerRef} sx={{ width: '100%', height: 500 }} />
        </Paper>
      </Container>
    </>
  );
};

export default DataChart;