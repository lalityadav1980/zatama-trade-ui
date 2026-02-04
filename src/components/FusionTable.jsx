import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import moment from 'moment';

const formatToIST = (ts) => {
  if (!ts) return '';
  return moment(ts).utcOffset('+05:30').format('DD-MMM-YYYY HH:mm:ss');
};

const FusionTable = ({ rows = [], onRowClick }) => {
  return (
    <TableContainer component={Paper} sx={{ background: '#071029' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ color: '#00ffaa' }}>Date (IST)</TableCell>
            <TableCell sx={{ color: '#00ffaa' }}>Signal Type</TableCell>
            <TableCell sx={{ color: '#00ffaa' }}>Strength</TableCell>
            <TableCell sx={{ color: '#00ffaa' }}>Symbol</TableCell>
            <TableCell sx={{ color: '#00ffaa' }}>Token</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow 
              key={i} 
              hover 
              sx={{ cursor: 'pointer' }}
              onClick={() => onRowClick && onRowClick(r)}
            >
              <TableCell>{formatToIST(r.date)}</TableCell>
              <TableCell>{r.signal_type || r.type || r.signal}</TableCell>
              <TableCell>{r.strength ?? r.score ?? ''}</TableCell>
              <TableCell>{r.symbol || r.ticker}</TableCell>
              <TableCell>{r.token || r.instrument_token || ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default FusionTable;
