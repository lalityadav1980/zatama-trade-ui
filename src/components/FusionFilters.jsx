import React from 'react';
import { Box, TextField, Button } from '@mui/material';
import moment from 'moment';

const FusionFilters = ({ filters, setFilters, onApply }) => {
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
      <TextField
        label="Specific Date"
        type="datetime-local"
        value={filters.date || ''}
        onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
        InputLabelProps={{ shrink: true }}
        size="small"
      />

      <TextField
        label="Date From"
        type="date"
        value={filters.from || ''}
        onChange={(e) => setFilters(prev => ({ ...prev, from: e.target.value }))}
        InputLabelProps={{ shrink: true }}
        size="small"
      />

      <TextField
        label="Date To"
        type="date"
        value={filters.to || ''}
        onChange={(e) => setFilters(prev => ({ ...prev, to: e.target.value }))}
        InputLabelProps={{ shrink: true }}
        size="small"
      />

      <Button variant="contained" onClick={onApply} sx={{ bgcolor: '#00ffaa' }}>
        Apply
      </Button>
    </Box>
  );
};

export default FusionFilters;
