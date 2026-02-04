import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    Container,
    Typography,
    Card,
    CardContent,
    CardActions,
    Button,
    Chip,
    Grid,
    TextField,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Paper,
    Badge,
    Stack,
    useTheme,
    useMediaQuery,
    IconButton,
    Tooltip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Divider,
    CircularProgress
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Event as EventIcon,
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    Info as InfoIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    Close as CloseIcon,
    FileDownload as FileDownloadIcon
} from '@mui/icons-material';
import moment from 'moment';
import { httpApi } from './api';
import CustomAppBar from './CustomAppBar';

// API base URL - adjust as needed  
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// Date formatting utilities (similar to fusion.jsx)
const formatToIST = (val) => {
    const m = moment(val);
    return m && m.isValid()
        ? m.utcOffset(330).format('DD-MMM-YYYY HH:mm:ss')
        : String(val ?? '');
};

// API functions using the existing httpApi instance
const fusionEventsAPI = {
    // Fetch grouped events (default for page load)
    getGroupedEvents: async (params = {}) => {
        const queryParams = new URLSearchParams();
        
        if (params.day) {
            queryParams.append('day', params.day);
        }
        
        if (params.limit_traces) {
            queryParams.append('limit_traces', params.limit_traces);
        }

        const url = `/fusion-events/grouped?${queryParams.toString()}`;
        const response = await httpApi.get(url);
        return response.data;
    },

    // Search events
    searchEvents: async (searchParams = {}) => {
        const queryParams = new URLSearchParams();
        
        Object.keys(searchParams).forEach(key => {
            if (searchParams[key]) {
                queryParams.append(key, searchParams[key]);
            }
        });

        const url = `/fusion-events/search?${queryParams.toString()}`;
        const response = await httpApi.get(url);
        return response.data;
    },

    // Get events by creation date
    getEventsByCreated: async (params = {}) => {
        const queryParams = new URLSearchParams();
        
        Object.keys(params).forEach(key => {
            if (params[key]) {
                queryParams.append(key, params[key]);
            }
        });

        const url = `/fusion-events/by-created?${queryParams.toString()}`;
        const response = await httpApi.get(url);
        return response.data;
    }
};

// Event type configurations - 4-Stage Pipeline
const EVENT_TYPE_CONFIG = {
    // Stage 1: Direction Filter
    'DIRECTION_FAIL': {
        color: 'error',
        icon: <WarningIcon />,
        label: 'Direction Fail',
        description: 'SR vs Price momentum conflict detected',
        stage: 'directional_prefilter',
        stageOrder: 1,
        severity: 'high'
    },
    // Stage 2: Direction Validation
    'DIRECTION_PASS': {
        color: 'info',
        icon: <TrendingUpIcon />,
        label: 'Direction Pass',
        description: 'Direction aligned, moving to strength checks',
        stage: 'direction_validation',
        stageOrder: 2,
        severity: 'low'
    },
    // Stage 3: Strength Validation
    'STRENGTH_FAIL': {
        color: 'warning',
        icon: <WarningIcon />,
        label: 'Strength Fail',
        description: 'Failed gate checks (insufficient strength)',
        stage: 'strength_validation',
        stageOrder: 3,
        severity: 'medium'
    },
    // Stage 4: Execution
    'STRENGTH_PASS': {
        color: 'success',
        icon: <CheckCircleIcon />,
        label: 'Strength Pass',
        description: 'All gates passed - Signal executed',
        stage: 'exec_path',
        stageOrder: 4,
        severity: 'success'
    },
    // Legacy event types (backward compatibility)
    'AUTOTUNE': {
        color: 'primary',
        icon: <TrendingUpIcon />,
        label: 'Auto Tune',
        description: 'Automatic parameter adjustment',
        stage: 'legacy',
        stageOrder: 99
    },
    'BLOCK': {
        color: 'error',
        icon: <WarningIcon />,
        label: 'Block',
        description: 'Event blocked from execution',
        stage: 'legacy',
        stageOrder: 99
    },
    'NOEXEC': {
        color: 'default',
        icon: <InfoIcon />,
        label: 'No Exec',
        description: 'Event not executed',
        stage: 'legacy',
        stageOrder: 99
    },
    'PASS_WITH_WAIVER': {
        color: 'warning',
        icon: <WarningIcon />,
        label: 'Pass with Waiver',
        description: 'Event passed with condition waivers',
        stage: 'legacy',
        stageOrder: 99
    },
    'PASSED': {
        color: 'success',
        icon: <CheckCircleIcon />,
        label: 'Passed',
        description: 'Event passed all checks',
        stage: 'legacy',
        stageOrder: 99
    },
    'SELECTED': {
        color: 'success',
        icon: <CheckCircleIcon />,
        label: 'Selected',
        description: 'Event selected for execution',
        stage: 'legacy',
        stageOrder: 99
    },
    // Fallback for any unmapped types
    'DEFAULT': {
        color: 'default',
        icon: <InfoIcon />,
        label: 'Other',
        description: 'Other event type',
        stage: 'unknown',
        stageOrder: 100
    }
};

// Stage configurations for filtering and display
const STAGE_CONFIG = {
    'directional_prefilter': {
        label: 'Stage 1: Direction Filter',
        color: '#FF5252',
        order: 1,
        description: 'SR vs Price momentum conflict detection'
    },
    'direction_validation': {
        label: 'Stage 2: Direction Validation',
        color: '#42A5F5',
        order: 2,
        description: 'Direction alignment validation'
    },
    'strength_validation': {
        label: 'Stage 3: Strength Validation',
        color: '#FFA726',
        order: 3,
        description: 'Gate checks and strength validation'
    },
    'exec_path': {
        label: 'Stage 4: Execution',
        color: '#66BB6A',
        order: 4,
        description: 'All gates passed - Signal execution'
    },
    'legacy': {
        label: 'Legacy Events',
        color: '#BDBDBD',
        order: 99,
        description: 'Older event types'
    }
};

// Side colors
const SIDE_COLORS = {
    'PE': 'error',
    'CE': 'success',
    'NEUTRAL': 'default'
};

// Tag color mapping based on tag type (enhanced for 4-stage pipeline)
const getTagColor = (tag) => {
    if (!tag) return { bg: 'rgba(189,189,189,0.15)', color: '#bdbdbd', border: '#bdbdbd50' };
    
    // 4-Stage Pipeline Tags (priority matching)
    if (tag === 'direction_conflict') {
        return { bg: 'rgba(255,82,82,0.15)', color: '#FF5252', border: '#FF525250' };
    } else if (tag === 'direction_validated') {
        return { bg: 'rgba(66,165,245,0.15)', color: '#42A5F5', border: '#42A5F550' };
    } else if (tag === 'strength_rejected') {
        return { bg: 'rgba(255,167,38,0.15)', color: '#FFA726', border: '#FFA72650' };
    } else if (tag === 'exec_signal') {
        return { bg: 'rgba(102,187,106,0.15)', color: '#66BB6A', border: '#66BB6A50' };
    }
    // Legacy tag patterns
    else if (tag.startsWith('caps')) {
        return { bg: 'rgba(156,39,176,0.15)', color: '#9C27B0', border: '#9C27B050' };
    } else if (tag.startsWith('cfg_autotune')) {
        return { bg: 'rgba(33,150,243,0.15)', color: '#2196F3', border: '#2196F350' };
    } else if (tag.startsWith('cooldown')) {
        return { bg: 'rgba(255,193,7,0.15)', color: '#FFC107', border: '#FFC10750' };
    } else if (tag.includes('detected')) {
        return { bg: 'rgba(255,152,0,0.15)', color: '#FF9800', border: '#FF980050' };
    } else if (tag.includes('veto') || tag.includes('block')) {
        return { bg: 'rgba(244,67,54,0.15)', color: '#F44336', border: '#F4433650' };
    } else if (tag.includes('selected') || tag.includes('pick')) {
        return { bg: 'rgba(76,175,80,0.15)', color: '#4CAF50', border: '#4CAF5050' };
    } else if (tag.includes('strength') || tag.includes('unstable')) {
        return { bg: 'rgba(233,30,99,0.15)', color: '#E91E63', border: '#E91E6350' };
    } else {
        // Default purple for other tags
        return { bg: 'rgba(103,58,183,0.15)', color: '#673AB7', border: '#673AB750' };
    }
};

// Event Card Component with fusion.jsx styling
const EventCard = ({ event, onViewDetails, onViewJourney }) => {
    const eventConfig = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG['DEFAULT'];
    const sideColor = SIDE_COLORS[event.side] || 'default';
    const tagColors = getTagColor(event.tag);

    return (
        <Card 
            sx={{ 
                mb: { xs: 1, md: 2 },
                background: '#070B0A',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: { xs: 1, md: 2 },
                '&:hover': { 
                    boxShadow: { xs: '0 4px 15px rgba(0,255,170,0.2)', md: '0 8px 25px rgba(0,255,170,0.25)' },
                    transform: { xs: 'translateY(-2px)', md: 'translateY(-4px)' },
                    transition: 'all 0.3s ease-in-out',
                    border: '1px solid rgba(0,255,170,0.5)'
                },
                position: 'relative',
                overflow: 'hidden',
                width: '100%',
                maxWidth: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <CardContent sx={{ 
                pb: 1, 
                px: { xs: 1.5, md: 2 }, 
                py: { xs: 1.5, md: 2 },
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column' 
            }}>
                {/* Header Section - Split into rows to prevent overlap */}
                <Box mb={{ xs: 1.5, md: 2 }} sx={{ 
                    borderBottom: '1px solid rgba(255,255,255,0.05)', 
                    pb: { xs: 1.5, md: 2 }
                }}>
                    {/* First Row: Event Type and Icon */}
                    <Box 
                        display="flex" 
                        alignItems="center" 
                        gap={{ xs: 0.5, md: 1 }}
                        mb={{ xs: 1, md: 1.5 }}
                    >
                        {eventConfig.icon}
                        <Typography 
                            variant={{ xs: "subtitle1", md: "h6" }}
                            component="div" 
                            sx={{ 
                                color: '#00ffaa', 
                                fontWeight: 600,
                                flex: 1,
                                fontSize: { xs: '1rem', md: '1.25rem' }
                            }}
                        >
                            {eventConfig.label}
                        </Typography>
                        <Chip 
                            label={event.event_type} 
                            size="small" 
                            sx={{ 
                                bgcolor: 'rgba(0,255,170,0.15)', 
                                color: '#00ffaa',
                                border: '1px solid #00ffaa50',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                fontSize: { xs: '0.7rem', md: '0.75rem' }
                            }}
                        />
                    </Box>
                    
                    {/* Second Row: ID and Tag */}
                    <Box 
                        display="flex" 
                        gap={1} 
                        alignItems="center"
                        flexWrap="wrap"
                        justifyContent="flex-start"
                    >
                        <Chip 
                            label={`ID: ${event.id}`} 
                            size="small" 
                            sx={{ 
                                bgcolor: 'rgba(144,202,249,0.15)', 
                                color: '#90caf9',
                                fontFamily: 'Roboto Mono, monospace',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}
                        />
                        {event.tag && (
                            <Chip
                                label={event.tag}
                                size="small"
                                sx={{
                                    bgcolor: tagColors.bg,
                                    color: tagColors.color,
                                    border: `1px solid ${tagColors.border}`,
                                    fontFamily: 'Roboto Mono, monospace',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                    maxWidth: '200px',
                                    '& .MuiChip-label': {
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }
                                }}
                            />
                        )}
                    </Box>
                </Box>

                <Grid container spacing={{ xs: 1, md: 2 }} sx={{ mt: { xs: 0.5, md: 1 } }}>
                    <Grid item xs={12} sm={6}>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ 
                                color: '#ffeb99', 
                                mb: { xs: 0.5, md: 1 }, 
                                display: 'flex', 
                                alignItems: 'center', 
                                flexWrap: 'wrap', 
                                gap: { xs: 0.5, md: 1 },
                                fontSize: { xs: '0.8rem', md: '0.875rem' }
                            }}>
                                <strong>Symbol:</strong> 
                                <Chip 
                                    label={event.symbol}
                                    size="small"
                                    sx={{ 
                                        bgcolor: 'rgba(255,235,153,0.15)', 
                                        color: '#ffeb99',
                                        fontFamily: 'Roboto Mono, monospace',
                                        fontWeight: 600,
                                        maxWidth: { xs: '120px', md: '150px' },
                                        fontSize: { xs: '0.7rem', md: '0.75rem' },
                                        '& .MuiChip-label': {
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }
                                    }}
                                />
                            </Typography>
                            <Typography variant="body2" sx={{ 
                                color: '#9ecbff', 
                                mb: { xs: 0.5, md: 1 },
                                fontSize: { xs: '0.8rem', md: '0.875rem' }
                            }}>
                                <strong>Token:</strong> 
                                <Box 
                                    component="span" 
                                    sx={{ 
                                        fontFamily: 'Roboto Mono, monospace', 
                                        marginLeft: { xs: 0.5, md: 1 },
                                        wordBreak: 'break-all',
                                        display: 'inline-block',
                                        maxWidth: '100%',
                                        fontSize: { xs: '0.75rem', md: '0.875rem' }
                                    }}
                                >
                                    {event.token}
                                </Box>
                            </Typography>
                            <Typography variant="body2" sx={{ 
                                color: '#9ecbff', 
                                mb: { xs: 0.5, md: 1 }, 
                                display: 'flex', 
                                alignItems: 'center', 
                                flexWrap: 'wrap', 
                                gap: { xs: 0.5, md: 1 },
                                fontSize: { xs: '0.8rem', md: '0.875rem' }
                            }}>
                                <strong>Side:</strong>
                                <Chip 
                                    label={event.side} 
                                    color="default" 
                                    size="small" 
                                    sx={{ 
                                        bgcolor: event.side === 'CE' ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
                                        color: event.side === 'CE' ? '#4CAF50' : '#F44336',
                                        border: `1px solid ${event.side === 'CE' ? '#4CAF5050' : '#F4433650'}`,
                                        whiteSpace: 'nowrap',
                                        fontSize: { xs: '0.7rem', md: '0.75rem' }
                                    }}
                                />
                            </Typography>
                        </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ 
                                color: '#ffeb99', 
                                mb: { xs: 0.5, md: 1 },
                                fontSize: { xs: '0.8rem', md: '0.875rem' }
                            }}>
                                <strong>Event Time:</strong> 
                            </Typography>
                            <Typography 
                                variant="caption" 
                                sx={{ 
                                    color: '#ffeb99', 
                                    fontFamily: 'Roboto Mono, monospace', 
                                    display: 'block', 
                                    mb: { xs: 0.5, md: 1 },
                                    wordBreak: 'break-word',
                                    fontSize: { xs: '0.7rem', md: '0.75rem' }
                                }}
                            >
                                {formatToIST(event.event_ts)} IST
                            </Typography>
                            <Typography variant="body2" sx={{ 
                                color: '#9ecbff', 
                                mb: { xs: 0.5, md: 1 }, 
                                display: 'flex', 
                                alignItems: 'center', 
                                flexWrap: 'wrap', 
                                gap: { xs: 0.5, md: 1 },
                                fontSize: { xs: '0.8rem', md: '0.875rem' }
                            }}>
                                <strong>Trace:</strong> 
                                <Tooltip title="Click to view complete event journey for this trace">
                                    <Chip
                                        label={event.trace}
                                        size="small"
                                        onClick={() => onViewJourney && onViewJourney(event.trace)}
                                        sx={{
                                            bgcolor: 'rgba(156,203,255,0.15)',
                                            color: '#9ecbff',
                                            fontFamily: 'Roboto Mono, monospace',
                                            maxWidth: { xs: '150px', md: '200px' },
                                            fontSize: { xs: '0.7rem', md: '0.75rem' },
                                            cursor: 'pointer',
                                            '&:hover': {
                                                bgcolor: 'rgba(156,203,255,0.25)',
                                                boxShadow: '0 2px 8px rgba(156,203,255,0.3)'
                                            },
                                            '& .MuiChip-label': {
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }
                                        }}
                                    />
                                </Tooltip>
                            </Typography>
                            <Typography variant="body2" sx={{ 
                                color: '#9ecbff', 
                                mb: { xs: 0.5, md: 1 },
                                fontSize: { xs: '0.8rem', md: '0.875rem' }
                            }}>
                                <strong>Tag:</strong> 
                            </Typography>
                            <Chip
                                label={event.tag || 'No Tag'}
                                size="small"
                                sx={{
                                    bgcolor: tagColors.bg,
                                    color: tagColors.color,
                                    border: `1px solid ${tagColors.border}`,
                                    fontFamily: 'Roboto Mono, monospace',
                                    fontWeight: 600,
                                    mb: { xs: 0.5, md: 1 },
                                    maxWidth: '100%',
                                    fontSize: { xs: '0.7rem', md: '0.75rem' },
                                    '& .MuiChip-label': {
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }
                                }}
                            />
                        </Box>
                    </Grid>
                </Grid>

                {/* Stage-Specific Information Display */}
                {event.event_data && (
                    <Box mt={{ xs: 1.5, md: 2 }} sx={{ 
                        minWidth: 0,
                        p: { xs: 1, md: 1.5 },
                        bgcolor: 'rgba(0,0,0,0.3)',
                        borderRadius: 1,
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        {/* DIRECTION_FAIL Stage */}
                        {event.event_type === 'DIRECTION_FAIL' && (
                            <Box>
                                <Typography variant="subtitle2" sx={{ 
                                    color: '#FF5252', 
                                    mb: 1, 
                                    fontWeight: 600,
                                    fontSize: { xs: '0.85rem', md: '0.875rem' }
                                }}>
                                    🎯 Direction Conflict Details
                                </Typography>
                                <Grid container spacing={1}>
                                    {event.event_data.sr_side && (
                                        <Grid item xs={6}>
                                            <Typography variant="caption" sx={{ color: '#9ecbff', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>SR Side:</strong> {event.event_data.sr_side}
                                            </Typography>
                                        </Grid>
                                    )}
                                    {event.event_data.price_momentum && (
                                        <Grid item xs={6}>
                                            <Typography variant="caption" sx={{ color: '#9ecbff', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>Price Momentum:</strong> {event.event_data.price_momentum}
                                            </Typography>
                                        </Grid>
                                    )}
                                    {event.event_data.conflict_reason && (
                                        <Grid item xs={12}>
                                            <Typography variant="caption" sx={{ color: '#FF5252', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>Conflict:</strong> {event.event_data.conflict_reason}
                                            </Typography>
                                        </Grid>
                                    )}
                                    {event.event_data.sr_distance_pts && (
                                        <Grid item xs={6}>
                                            <Typography variant="caption" sx={{ color: '#9ecbff', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>SR Distance:</strong> {event.event_data.sr_distance_pts} pts
                                            </Typography>
                                        </Grid>
                                    )}
                                </Grid>
                            </Box>
                        )}

                        {/* DIRECTION_PASS Stage */}
                        {event.event_type === 'DIRECTION_PASS' && (
                            <Box>
                                <Typography variant="subtitle2" sx={{ 
                                    color: '#42A5F5', 
                                    mb: 1, 
                                    fontWeight: 600,
                                    fontSize: { xs: '0.85rem', md: '0.875rem' }
                                }}>
                                    ✅ Direction Validated
                                </Typography>
                                <Grid container spacing={1}>
                                    {event.event_data.chosen_side && (
                                        <Grid item xs={6}>
                                            <Typography variant="caption" sx={{ color: '#9ecbff', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>Chosen Side:</strong> {event.event_data.chosen_side}
                                            </Typography>
                                        </Grid>
                                    )}
                                    {event.event_data.sr_strength && (
                                        <Grid item xs={6}>
                                            <Typography variant="caption" sx={{ color: '#9ecbff', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>SR Strength:</strong> {event.event_data.sr_strength}
                                            </Typography>
                                        </Grid>
                                    )}
                                    {event.event_data.price_side && (
                                        <Grid item xs={4}>
                                            <Typography variant="caption" sx={{ color: '#66BB6A', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>Price:</strong> {event.event_data.price_side}
                                            </Typography>
                                        </Grid>
                                    )}
                                    {event.event_data.pcr_side && (
                                        <Grid item xs={4}>
                                            <Typography variant="caption" sx={{ color: '#66BB6A', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>PCR:</strong> {event.event_data.pcr_side}
                                            </Typography>
                                        </Grid>
                                    )}
                                    {event.event_data.flow_side && (
                                        <Grid item xs={4}>
                                            <Typography variant="caption" sx={{ color: '#66BB6A', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>Flow:</strong> {event.event_data.flow_side}
                                            </Typography>
                                        </Grid>
                                    )}
                                </Grid>
                            </Box>
                        )}

                        {/* STRENGTH_FAIL Stage */}
                        {event.event_type === 'STRENGTH_FAIL' && (
                            <Box>
                                <Typography variant="subtitle2" sx={{ 
                                    color: '#FFA726', 
                                    mb: 1, 
                                    fontWeight: 600,
                                    fontSize: { xs: '0.85rem', md: '0.875rem' }
                                }}>
                                    ⚠️ Strength Validation Failed
                                </Typography>
                                <Grid container spacing={1}>
                                    {event.event_data.conditions_met !== undefined && (
                                        <Grid item xs={6}>
                                            <Typography variant="caption" sx={{ color: '#9ecbff', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>Gates:</strong> {event.event_data.conditions_met}/{event.event_data.conditions_total}
                                            </Typography>
                                        </Grid>
                                    )}
                                    {event.event_data.strength && (
                                        <Grid item xs={6}>
                                            <Typography variant="caption" sx={{ color: '#9ecbff', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>Strength:</strong> {event.event_data.strength}
                                            </Typography>
                                        </Grid>
                                    )}
                                    {event.event_data.reasons_fail && event.event_data.reasons_fail.length > 0 && (
                                        <Grid item xs={12}>
                                            <Typography variant="caption" sx={{ color: '#FFA726', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>Failures:</strong> {event.event_data.reasons_fail.slice(0, 2).join(', ')}
                                                {event.event_data.reasons_fail.length > 2 && ` +${event.event_data.reasons_fail.length - 2} more`}
                                            </Typography>
                                        </Grid>
                                    )}
                                </Grid>
                            </Box>
                        )}

                        {/* STRENGTH_PASS Stage */}
                        {event.event_type === 'STRENGTH_PASS' && (
                            <Box>
                                <Typography variant="subtitle2" sx={{ 
                                    color: '#66BB6A', 
                                    mb: 1, 
                                    fontWeight: 600,
                                    fontSize: { xs: '0.85rem', md: '0.875rem' }
                                }}>
                                    🎯 Signal Executed
                                </Typography>
                                <Grid container spacing={1}>
                                    {event.event_data.signal_type && (
                                        <Grid item xs={6}>
                                            <Typography variant="caption" sx={{ color: '#9ecbff', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>Signal Type:</strong> {event.event_data.signal_type}
                                            </Typography>
                                        </Grid>
                                    )}
                                    {event.event_data.strength && (
                                        <Grid item xs={6}>
                                            <Typography variant="caption" sx={{ color: '#9ecbff', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>Strength:</strong> {event.event_data.strength}
                                            </Typography>
                                        </Grid>
                                    )}
                                    {event.event_data.conditions_met !== undefined && (
                                        <Grid item xs={6}>
                                            <Typography variant="caption" sx={{ color: '#66BB6A', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>Gates:</strong> {event.event_data.conditions_met}/{event.event_data.conditions_total} ✓
                                            </Typography>
                                        </Grid>
                                    )}
                                    {event.event_data.premium && (
                                        <Grid item xs={6}>
                                            <Typography variant="caption" sx={{ color: '#ffeb99', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>Premium:</strong> ₹{event.event_data.premium}
                                            </Typography>
                                        </Grid>
                                    )}
                                    {event.event_data.fusion_data_trace && (
                                        <Grid item xs={12}>
                                            <Typography variant="caption" sx={{ color: '#9ecbff', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                                <strong>Trade Record:</strong> {event.event_data.fusion_data_trace}
                                            </Typography>
                                        </Grid>
                                    )}
                                </Grid>
                            </Box>
                        )}
                    </Box>
                )}

                {/* Caps Information */}
                {(event.raised_caps?.length > 0 || event.waived_caps?.length > 0) && (
                    <Box mt={{ xs: 1.5, md: 2 }} sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ 
                            color: '#00ffaa', 
                            mb: { xs: 0.5, md: 1 }, 
                            fontWeight: 600,
                            fontSize: { xs: '0.85rem', md: '0.875rem' }
                        }}>
                            Capabilities:
                        </Typography>
                        <Box display="flex" gap={{ xs: 0.5, md: 1 }} flexWrap="wrap" sx={{ maxWidth: '100%' }}>
                            {event.raised_caps?.map((cap, idx) => (
                                <Chip 
                                    key={`raised-${idx}`}
                                    label={cap} 
                                    size="small" 
                                    sx={{
                                        bgcolor: 'rgba(244,67,54,0.15)',
                                        color: '#F44336',
                                        border: '1px solid #F4433650',
                                        maxWidth: { xs: '150px', md: '200px' },
                                        fontSize: { xs: '0.65rem', md: '0.75rem' },
                                        '& .MuiChip-label': {
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }
                                    }}
                                />
                            ))}
                            {event.waived_caps?.map((cap, idx) => (
                                <Chip 
                                    key={`waived-${idx}`}
                                    label={cap} 
                                    size="small"
                                    sx={{
                                        bgcolor: 'rgba(255,152,0,0.15)',
                                        color: '#FF9800',
                                        border: '1px solid #FF980050',
                                        maxWidth: { xs: '150px', md: '200px' },
                                        fontSize: { xs: '0.65rem', md: '0.75rem' },
                                        '& .MuiChip-label': {
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }
                                    }}
                                />
                            ))}
                        </Box>
                    </Box>
                )}

                {/* Reason snippet */}
                {event.reason && (
                    <Box mt={{ xs: 1.5, md: 2 }} sx={{ minWidth: 0 }}>
                        <Typography 
                            variant="body2" 
                            sx={{ 
                                color: '#a0a0a0',
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word',
                                hyphens: 'auto',
                                fontSize: { xs: '0.8rem', md: '0.875rem' }
                            }}
                        >
                            <strong>Reason:</strong> {event.reason.substring(0, { xs: 80, md: 100 }[0] || 100)}
                            {event.reason.length > 100 && '...'}
                        </Typography>
                    </Box>
                )}
            </CardContent>
            
            <CardActions sx={{ 
                justifyContent: 'flex-end', 
                pt: 0, 
                pb: { xs: 1.5, md: 2 }, 
                px: { xs: 1.5, md: 2 }, 
                mt: 'auto' 
            }}>
                <Button 
                    size="small" 
                    onClick={() => onViewDetails(event)}
                    startIcon={<InfoIcon />}
                    sx={{ 
                        color: '#00ffaa', 
                        borderColor: '#00ffaa50',
                        fontSize: { xs: '0.75rem', md: '0.875rem' },
                        padding: { xs: '4px 8px', md: '6px 12px' },
                        '&:hover': { 
                            bgcolor: 'rgba(0,255,170,0.1)',
                            borderColor: '#00ffaa'
                        }
                    }}
                    variant="outlined"
                >
                    View Details
                </Button>
            </CardActions>
        </Card>
    );
};

// Event Details Dialog Component
const EventDetailsDialog = ({ open, onClose, event }) => {
    if (!event) return null;
    
    const tagColors = getTagColor(event.tag);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    background: '#070B0A',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#e0e0e0'
                }
            }}
        >
            <DialogTitle sx={{ color: '#00ffaa', pr: 10 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EventIcon />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Event Details - {event.symbol}
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    sx={{ position: 'absolute', right: 8, top: 8, color: '#e0e0e0' }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ background: 'transparent' }}>
                <Stack spacing={3}>
                    {/* Basic Information */}
                    <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)' }}>
                        <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>
                            Basic Information
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                    <strong>Event ID:</strong> {event.id}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                    <strong>Symbol:</strong> {event.symbol}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                    <strong>Token:</strong> {event.token}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                    <strong>Side:</strong> {event.side}
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                    <strong>Event Type:</strong> {event.event_type}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                    <strong>Trace:</strong> {event.trace}
                                </Typography>
                                <Box sx={{ mt: 1 }}>
                                    <Typography variant="body2" sx={{ color: '#9ecbff', mb: 0.5 }}>
                                        <strong>Tag:</strong>
                                    </Typography>
                                    <Chip
                                        label={event.tag || 'No Tag'}
                                        size="small"
                                        sx={{
                                            bgcolor: tagColors.bg,
                                            color: tagColors.color,
                                            border: `1px solid ${tagColors.border}`,
                                            fontFamily: 'Roboto Mono, monospace',
                                            fontWeight: 600
                                        }}
                                    />
                                </Box>
                            </Grid>
                        </Grid>
                    </Paper>

                    {/* Stage-Specific Detailed Information */}
                    {event.event_data && (
                        <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)' }}>
                            <Typography variant="h6" sx={{ 
                                color: '#00ffaa', 
                                mb: 2, 
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                            }}>
                                {EVENT_TYPE_CONFIG[event.event_type]?.icon || <InfoIcon />}
                                Stage-Specific Analysis
                            </Typography>
                            
                            {/* DIRECTION_FAIL Details */}
                            {event.event_type === 'DIRECTION_FAIL' && (
                                <Box>
                                    <Typography variant="subtitle1" sx={{ color: '#FF5252', mb: 2, fontWeight: 600 }}>
                                        🎯 Direction Conflict Analysis
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Decision:</strong> {event.event_data.decision || 'DIRECTION_FAIL'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Stage:</strong> {event.event_data.stage || 'directional_prefilter'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>SR Side:</strong> {event.event_data.sr_side}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>SR Level:</strong> {event.event_data.sr_level}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>SR Kind:</strong> {event.event_data.sr_kind}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>SR Strength:</strong> {event.event_data.sr_strength}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>SR Distance:</strong> {event.event_data.sr_distance_pts} pts
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Price Momentum:</strong> {event.event_data.price_momentum}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Conflict Threshold:</strong> {event.event_data.conflict_threshold}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12}>
                                            <Typography variant="body2" sx={{ 
                                                color: '#FF5252', 
                                                p: 1.5, 
                                                bgcolor: 'rgba(255,82,82,0.1)',
                                                borderRadius: 1,
                                                border: '1px solid #FF525250'
                                            }}>
                                                <strong>⚠️ Conflict Reason:</strong> {event.event_data.conflict_reason}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                </Box>
                            )}

                            {/* DIRECTION_PASS Details */}
                            {event.event_type === 'DIRECTION_PASS' && (
                                <Box>
                                    <Typography variant="subtitle1" sx={{ color: '#42A5F5', mb: 2, fontWeight: 600 }}>
                                        ✅ Direction Validation Success
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Decision:</strong> {event.event_data.decision || 'DIRECTION_PASS'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Stage:</strong> {event.event_data.stage || 'direction_validation'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#66BB6A', mb: 1 }}>
                                                <strong>Chosen Side:</strong> {event.event_data.chosen_side}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Next Stage:</strong> {event.event_data.next_stage || 'strength_validation'}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>SR Strength:</strong> {event.event_data.sr_strength}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>SR Quality Score:</strong> {event.event_data.sr_quality_score}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>SR Distance:</strong> {event.event_data.sr_distance_pts} pts
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>SR Proximity OK:</strong> {event.event_data.sr_proximity_ok ? '✓ Yes' : '✗ No'}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12}>
                                            <Typography variant="subtitle2" sx={{ color: '#42A5F5', mb: 1 }}>
                                                Signal Alignment:
                                            </Typography>
                                            <Box display="flex" gap={1} flexWrap="wrap">
                                                {event.event_data.sr_side && (
                                                    <Chip label={`SR: ${event.event_data.sr_side}`} size="small" sx={{ bgcolor: '#42A5F515', color: '#42A5F5' }} />
                                                )}
                                                {event.event_data.price_side && (
                                                    <Chip label={`Price: ${event.event_data.price_side}`} size="small" sx={{ bgcolor: '#42A5F515', color: '#42A5F5' }} />
                                                )}
                                                {event.event_data.pcr_side && (
                                                    <Chip label={`PCR: ${event.event_data.pcr_side}`} size="small" sx={{ bgcolor: '#42A5F515', color: '#42A5F5' }} />
                                                )}
                                                {event.event_data.flow_side && (
                                                    <Chip label={`Flow: ${event.event_data.flow_side}`} size="small" sx={{ bgcolor: '#42A5F515', color: '#42A5F5' }} />
                                                )}
                                            </Box>
                                        </Grid>
                                    </Grid>
                                </Box>
                            )}

                            {/* STRENGTH_FAIL Details */}
                            {event.event_type === 'STRENGTH_FAIL' && (
                                <Box>
                                    <Typography variant="subtitle1" sx={{ color: '#FFA726', mb: 2, fontWeight: 600 }}>
                                        ⚠️ Strength Validation Failed
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Decision:</strong> {event.event_data.decision || 'STRENGTH_FAIL'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Stage:</strong> {event.event_data.stage || 'strength_validation'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#FFA726', mb: 1 }}>
                                                <strong>Gates Passed:</strong> {event.event_data.conditions_met}/{event.event_data.conditions_total}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Strength:</strong> {event.event_data.strength}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Signal Type:</strong> {event.event_data.signal_type}
                                            </Typography>
                                            {event.event_data.premium && (
                                                <Typography variant="body2" sx={{ color: '#ffeb99', mb: 1 }}>
                                                    <strong>Premium:</strong> ₹{event.event_data.premium}
                                                </Typography>
                                            )}
                                            {event.event_data.strike && (
                                                <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                    <strong>Strike:</strong> {event.event_data.strike}
                                                </Typography>
                                            )}
                                        </Grid>
                                        {event.event_data.reasons_fail && event.event_data.reasons_fail.length > 0 && (
                                            <Grid item xs={12}>
                                                <Typography variant="subtitle2" sx={{ color: '#FFA726', mb: 1 }}>
                                                    Failed Checks:
                                                </Typography>
                                                <Box display="flex" gap={1} flexWrap="wrap">
                                                    {event.event_data.reasons_fail.map((reason, idx) => (
                                                        <Chip 
                                                            key={idx}
                                                            label={reason}
                                                            size="small"
                                                            sx={{
                                                                bgcolor: 'rgba(255,167,38,0.15)',
                                                                color: '#FFA726',
                                                                border: '1px solid #FFA72650'
                                                            }}
                                                        />
                                                    ))}
                                                </Box>
                                            </Grid>
                                        )}
                                    </Grid>
                                </Box>
                            )}

                            {/* STRENGTH_PASS Details */}
                            {event.event_type === 'STRENGTH_PASS' && (
                                <Box>
                                    <Typography variant="subtitle1" sx={{ color: '#66BB6A', mb: 2, fontWeight: 600 }}>
                                        🎯 Signal Execution Success
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Decision:</strong> {event.event_data.decision || 'STRENGTH_PASS'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Stage:</strong> {event.event_data.stage || 'exec_path'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#66BB6A', mb: 1 }}>
                                                <strong>All Gates Passed:</strong> ✓ {event.event_data.all_gates_passed ? 'YES' : 'NO'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Gates:</strong> {event.event_data.conditions_met}/{event.event_data.conditions_total}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Strength:</strong> {event.event_data.strength}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                <strong>Signal Type:</strong> {event.event_data.signal_type}
                                            </Typography>
                                            {event.event_data.premium && (
                                                <Typography variant="body2" sx={{ color: '#ffeb99', mb: 1 }}>
                                                    <strong>Premium:</strong> ₹{event.event_data.premium}
                                                </Typography>
                                            )}
                                            {event.event_data.strike && (
                                                <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                    <strong>Strike:</strong> {event.event_data.strike}
                                                </Typography>
                                            )}
                                            {event.event_data.greeks_multiplier && (
                                                <Typography variant="body2" sx={{ color: '#9ecbff', mb: 1 }}>
                                                    <strong>Greeks Multiplier:</strong> {event.event_data.greeks_multiplier}
                                                </Typography>
                                            )}
                                        </Grid>
                                        <Grid item xs={12}>
                                            {event.event_data.fusion_data_trace && (
                                                <Typography variant="body2" sx={{ 
                                                    color: '#66BB6A', 
                                                    p: 1.5, 
                                                    bgcolor: 'rgba(102,187,106,0.1)',
                                                    borderRadius: 1,
                                                    border: '1px solid #66BB6A50',
                                                    fontFamily: 'Roboto Mono, monospace'
                                                }}>
                                                    <strong>📊 Dual Persistence:</strong> fusion_data trace = {event.event_data.fusion_data_trace}
                                                </Typography>
                                            )}
                                        </Grid>
                                        {event.event_data.reasons_pass && event.event_data.reasons_pass.length > 0 && (
                                            <Grid item xs={12}>
                                                <Typography variant="subtitle2" sx={{ color: '#66BB6A', mb: 1 }}>
                                                    Success Factors:
                                                </Typography>
                                                <Box display="flex" gap={1} flexWrap="wrap">
                                                    {event.event_data.reasons_pass.map((reason, idx) => (
                                                        <Chip 
                                                            key={idx}
                                                            label={reason}
                                                            size="small"
                                                            sx={{
                                                                bgcolor: 'rgba(102,187,106,0.15)',
                                                                color: '#66BB6A',
                                                                border: '1px solid #66BB6A50'
                                                            }}
                                                        />
                                                    ))}
                                                </Box>
                                            </Grid>
                                        )}
                                    </Grid>
                                </Box>
                            )}
                        </Paper>
                    )}

                    {/* Timestamps */}
                    <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)' }}>
                        <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>
                            Timestamps
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ffeb99', mb: 1, fontFamily: 'Roboto Mono, monospace' }}>
                            <strong>Event Time:</strong> {formatToIST(event.event_ts)} IST
                        </Typography>
                        {event.created_ts && (
                            <Typography variant="body2" sx={{ color: '#ffeb99', mb: 1, fontFamily: 'Roboto Mono, monospace' }}>
                                <strong>Created:</strong> {formatToIST(event.created_ts)} IST
                            </Typography>
                        )}
                        {event.updated_ts && (
                            <Typography variant="body2" sx={{ color: '#ffeb99', fontFamily: 'Roboto Mono, monospace' }}>
                                <strong>Updated:</strong> {formatToIST(event.updated_ts)} IST
                            </Typography>
                        )}
                    </Paper>

                    {/* Capabilities */}
                    {event.kept_caps?.length > 0 && (
                        <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)' }}>
                            <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>
                                BLOCKED CAPABILITIES
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                                {event.kept_caps.map((cap, idx) => (
                                    <Chip 
                                        key={idx}
                                        label={cap}
                                        size="small"
                                        sx={{
                                            bgcolor: 'rgba(76,175,80,0.15)',
                                            color: '#4CAF50',
                                            border: '1px solid #4CAF5050'
                                        }}
                                    />
                                ))}
                            </Stack>
                        </Paper>
                    )}

                    {/* Full Reason */}
                    {event.reason && (
                        <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)' }}>
                            <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>
                                Event Reason
                            </Typography>
                            <Typography 
                                variant="body2" 
                                sx={{ 
                                    color: '#e0e0e0', 
                                    whiteSpace: 'pre-wrap',
                                    fontFamily: 'Roboto Mono, monospace',
                                    background: 'rgba(0,0,0,0.3)',
                                    p: 2,
                                    borderRadius: 1,
                                    border: '1px solid #ffffff12'
                                }}
                            >
                                {event.reason}
                            </Typography>
                        </Paper>
                    )}

                    {/* Raw Event Data */}
                    <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)' }}>
                        <Typography variant="h6" sx={{ color: '#00ffaa', mb: 2, fontWeight: 600 }}>
                            Raw Event Data
                        </Typography>
                        <Typography 
                            variant="body2" 
                            sx={{ 
                                color: '#e0e0e0', 
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'Roboto Mono, monospace',
                                fontSize: '0.75rem',
                                background: 'rgba(0,0,0,0.3)',
                                p: 2,
                                borderRadius: 1,
                                border: '1px solid #ffffff12'
                            }}
                        >
                            {JSON.stringify(event, null, 2)}
                        </Typography>
                    </Paper>
                </Stack>
            </DialogContent>
        </Dialog>
    );
};

// Main Fusion Events Component  
const FusionEvents = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(moment());
    const [limitTraces, setLimitTraces] = useState(100);
    const [eventStats, setEventStats] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [eventTypeFilter, setEventTypeFilter] = useState('ALL');
    const [stageFilter, setStageFilter] = useState('ALL'); // New: Stage-based filter
    const [tagFilter, setTagFilter] = useState('ALL');
    const [sideFilter, setSideFilter] = useState('ALL');
    const [symbolFilter, setSymbolFilter] = useState('ALL');
    const [dateTimeFilter, setDateTimeFilter] = useState('ALL');
    const [customStartDateTime, setCustomStartDateTime] = useState(moment().startOf('day'));
    const [customEndDateTime, setCustomEndDateTime] = useState(moment().endOf('day'));
    const [traceFilter, setTraceFilter] = useState(''); // New: Trace-based filtering for event journey
    
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Calculate event statistics
    const calculateEventStats = (eventsData) => {
        const stats = {
            total: eventsData.length,
            byType: {},
            byTag: {},
            bySide: {},
            uniqueTags: new Set(),
            uniqueSymbols: new Set()
        };

        // Debug: log first few events to see structure
        console.log('Sample events data:', eventsData.slice(0, 3));

        eventsData.forEach((event, index) => {
            // Debug: log first few events in detail
            if (index < 3) {
                console.log(`Event ${index} tag info:`, {
                    id: event.id,
                    tag: event.tag,
                    tagType: typeof event.tag,
                    hasTag: !!event.tag,
                    allKeys: Object.keys(event)
                });
            }

            // Count by type
            const type = event.event_type || 'UNKNOWN';
            stats.byType[type] = (stats.byType[type] || 0) + 1;

            // Count by tag - be more careful about tag processing
            const tag = event.tag || 'NO_TAG';
            stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
            
            // Add to unique tags only if it's a real tag (not null/undefined/empty)
            if (event.tag && typeof event.tag === 'string' && event.tag.trim() !== '') {
                stats.uniqueTags.add(event.tag.trim());
            }

            // Add to unique symbols
            if (event.symbol && typeof event.symbol === 'string' && event.symbol.trim() !== '') {
                stats.uniqueSymbols.add(event.symbol.trim());
            }

            // Count by side
            const side = event.side || 'UNKNOWN';
            stats.bySide[side] = (stats.bySide[side] || 0) + 1;
        });

        // Convert uniqueTags and uniqueSymbols Sets to Arrays and sort
        stats.uniqueTagsArray = Array.from(stats.uniqueTags).sort();
        stats.uniqueSymbolsArray = Array.from(stats.uniqueSymbols).sort();
        
        // Enhanced debug logging
        console.log('Event stats calculated:', {
            totalEvents: stats.total,
            uniqueTagsCount: stats.uniqueTags.size,
            uniqueTagsArray: stats.uniqueTagsArray,
            uniqueSymbolsCount: stats.uniqueSymbols.size,
            uniqueSymbolsArray: stats.uniqueSymbolsArray,
            byTag: stats.byTag,
            bySide: stats.bySide,
            sampleTagValues: eventsData.slice(0, 5).map(e => ({ id: e.id, tag: e.tag, symbol: e.symbol }))
        });

        return stats;
    };

    // Load events function
    const loadEvents = async (date = selectedDate, limit = limitTraces) => {
        setLoading(true);
        setError(null);

        try {
            const params = {
                day: date.format('YYYY-MM-DD'),
                limit_traces: limit
            };

            const response = await fusionEventsAPI.getGroupedEvents(params);
            
            if (response && response.records) {
                setEvents(response.records);
                
                // Flatten all events from all traces for statistics
                const allEvents = response.records.flatMap(trace => 
                    trace.events ? trace.events.map(event => ({
                        ...event,
                        trace: trace.trace // Add trace ID to each event
                    })) : []
                );
                
                // Calculate event statistics using flattened events
                const stats = calculateEventStats(allEvents);
                setEventStats(stats);
                setError(null);
            } else if (response && Array.isArray(response)) {
                // Handle case where response is directly an array
                setEvents(response);
                
                // Flatten events if needed
                const allEvents = response.flatMap(trace => 
                    trace.events ? trace.events.map(event => ({
                        ...event,
                        trace: trace.trace
                    })) : []
                );
                
                const stats = calculateEventStats(allEvents);
                setEventStats(stats);
                setError(null);
            } else {
                setError('No event data received from server');
                setEvents([]);
                setEventStats({});
            }
        } catch (err) {
            console.error('Error loading events:', err);
            if (err.response?.status === 403) {
                setError('Access denied. Please check your authentication.');
            } else if (err.response?.status === 404) {
                setError('Fusion events API endpoint not found. Please verify the API is running.');
            } else if (err.response?.status >= 500) {
                setError('Server error. Please try again later.');
            } else if (err.message?.includes('Network Error')) {
                setError('Network error. Please check your connection and API server.');
            } else {
                setError(err.message || 'Failed to load events');
            }
            setEvents([]);
            setEventStats({});
        } finally {
            setLoading(false);
        }
    };

    // Filter events based on search and filters
    const filteredEvents = useMemo(() => {
        // First, flatten all events from all traces
        const allEvents = events.flatMap(trace => 
            trace.events ? trace.events.map(event => ({
                ...event,
                trace: trace.trace
            })) : []
        );
        
        return allEvents.filter(event => {
            // Trace filter - for event journey view
            if (traceFilter && event.trace !== traceFilter) {
                return false;
            }

            // Search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const searchableFields = [
                    event.symbol,
                    event.token,
                    event.side,
                    event.trace,
                    event.tag,
                    event.reason,
                    event.event_type
                ].filter(Boolean);
                
                const matchesSearch = searchableFields.some(field => 
                    String(field).toLowerCase().includes(searchLower)
                );
                
                if (!matchesSearch) return false;
            }

            // Event type filter
            if (eventTypeFilter !== 'ALL' && event.event_type !== eventTypeFilter) {
                return false;
            }

            // Stage filter - NEW for 4-stage pipeline
            if (stageFilter !== 'ALL') {
                const eventConfig = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG['DEFAULT'];
                if (eventConfig.stage !== stageFilter) {
                    return false;
                }
            }

            // Tag filter
            if (tagFilter !== 'ALL') {
                if (tagFilter === 'NO_TAG' && event.tag) {
                    return false;
                } else if (tagFilter !== 'NO_TAG' && event.tag !== tagFilter) {
                    return false;
                }
            }

            // Side filter
            if (sideFilter !== 'ALL' && event.side !== sideFilter) {
                return false;
            }

            // Symbol filter
            if (symbolFilter !== 'ALL' && event.symbol !== symbolFilter) {
                return false;
            }

            // Date/Time range filter
            if (dateTimeFilter !== 'ALL') {
                // Parse event time - handle various formats and ensure IST timezone
                let eventTime = moment(event.event_ts);
                
                // If the event time doesn't have timezone info, assume it's IST
                if (!eventTime.isValid()) {
                    eventTime = moment(event.event_ts, 'YYYY-MM-DD HH:mm:ss');
                }
                
                // Convert to IST if it's in UTC or other timezone
                if (eventTime.isValid()) {
                    eventTime = eventTime.utcOffset(330); // IST offset
                }
                
                const now = moment().utcOffset(330);
                
                switch (dateTimeFilter) {
                    case 'LAST_HOUR':
                        if (eventTime.isBefore(now.clone().subtract(1, 'hour'))) {
                            return false;
                        }
                        break;
                    case 'LAST_3_HOURS':
                        if (eventTime.isBefore(now.clone().subtract(3, 'hours'))) {
                            return false;
                        }
                        break;
                    case 'LAST_6_HOURS':
                        if (eventTime.isBefore(now.clone().subtract(6, 'hours'))) {
                            return false;
                        }
                        break;
                    case 'LAST_12_HOURS':
                        if (eventTime.isBefore(now.clone().subtract(12, 'hours'))) {
                            return false;
                        }
                        break;
                    case 'TODAY':
                        if (!eventTime.isSame(now, 'day')) {
                            return false;
                        }
                        break;
                    case 'CUSTOM':
                        // Ensure both custom dates are in IST
                        const customStart = customStartDateTime.utcOffset(330);
                        const customEnd = customEndDateTime.utcOffset(330);
                        
                        // Add debug logging
                        if (event.side === 'PE') {
                            console.log('🔍 Custom Filter Debug:', {
                                symbol: event.symbol,
                                side: event.side,
                                event_ts: event.event_ts,
                                eventTime: eventTime.format('YYYY-MM-DD HH:mm:ss'),
                                customStart: customStart.format('YYYY-MM-DD HH:mm:ss'),
                                customEnd: customEnd.format('YYYY-MM-DD HH:mm:ss'),
                                isBefore: eventTime.isBefore(customStart),
                                isAfter: eventTime.isAfter(customEnd),
                                inRange: eventTime.isSameOrAfter(customStart) && eventTime.isSameOrBefore(customEnd)
                            });
                        }
                        
                        // Use isSameOrAfter and isSameOrBefore for inclusive range
                        if (!eventTime.isSameOrAfter(customStart) || !eventTime.isSameOrBefore(customEnd)) {
                            return false;
                        }
                        break;
                    default:
                        break;
                }
            }

            return true;
        });
    }, [events, searchTerm, eventTypeFilter, stageFilter, tagFilter, sideFilter, symbolFilter, dateTimeFilter, customStartDateTime, customEndDateTime, traceFilter]);

    // Load events on component mount and when date/limit changes
    useEffect(() => {
        loadEvents();
    }, [selectedDate, limitTraces]);

    // Recalculate stats whenever events change
    useEffect(() => {
        if (events.length > 0) {
            // Flatten all events from all traces for statistics
            const allEvents = events.flatMap(trace => 
                trace.events ? trace.events.map(event => ({
                    ...event,
                    trace: trace.trace
                })) : []
            );
            
            const stats = calculateEventStats(allEvents);
            setEventStats(stats);
        }
    }, [events]);

    const handleViewDetails = (event) => {
        setSelectedEvent(event);
        setDetailsDialogOpen(true);
    };

    const handleViewJourney = (trace) => {
        // Set trace filter to show all events for this trace
        setTraceFilter(trace);
        // Scroll to top to see filtered results
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleRefresh = () => {
        loadEvents();
    };

    const handleExportCSV = () => {
        try {
            // Define CSV headers
            const headers = [
                'Event Type',
                'Symbol',
                'Token',
                'Side',
                'Event Time (IST)',
                'Created Time (IST)',
                'Updated Time (IST)',
                'Tag',
                'Reason',
                'Trace',
                'Blocked Capabilities'
            ];

            // Convert filtered events to CSV format
            const csvData = filteredEvents.map(event => [
                event.event_type || '',
                event.symbol || '',
                event.token || '',
                event.side || '',
                event.event_ts ? formatToIST(event.event_ts) : '',
                event.created_ts ? formatToIST(event.created_ts) : '',
                event.updated_ts ? formatToIST(event.updated_ts) : '',
                event.tag || '',
                event.reason ? `"${event.reason.replace(/"/g, '""')}"` : '',
                event.trace || '',
                event.kept_caps ? event.kept_caps.join('; ') : ''
            ]);

            // Create CSV content
            const csvContent = [
                headers.join(','),
                ...csvData.map(row => row.join(','))
            ].join('\n');

            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                
                // Generate filename with current date and filter info
                const currentDate = moment().format('YYYY-MM-DD_HH-mm-ss');
                const filterSuffix = dateTimeFilter === 'CUSTOM' 
                    ? `_${customStartDateTime.format('YYYY-MM-DD_HH-mm')}-${customEndDateTime.format('YYYY-MM-DD_HH-mm')}`
                    : dateTimeFilter !== 'ALL' ? `_${dateTimeFilter}` : '';
                const filename = `fusion_events_${currentDate}${filterSuffix}.csv`;
                
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                console.log(`📊 Exported ${filteredEvents.length} events to ${filename}`);
            }
        } catch (error) {
            console.error('❌ Error exporting CSV:', error);
            // Could add a toast notification here if you have one
        }
    };

    return (
        <>
            <CustomAppBar />
            <Container maxWidth="xl" sx={{ 
                mt: { xs: 1, md: 2 }, 
                px: { xs: 0.5, sm: 2, md: 3 } // Reduced horizontal padding on mobile
            }}>
                <Paper
                    sx={{
                        p: { xs: 1, sm: 1.5, md: 2 }, // More aggressive padding reduction
                        background: '#070B0A',
                        borderRadius: { xs: 1, md: 2 }, // Smaller border radius on mobile
                        border: '1px solid rgba(255,255,255,0.15)',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        overflow: 'hidden' // Prevent horizontal overflow
                    }}
                >
                    {/* Header - Mobile Optimized */}
                    <Stack 
                        direction={{ xs: 'column', sm: 'row' }} 
                        spacing={{ xs: 1, sm: 1.5 }} 
                        alignItems={{ xs: 'stretch', sm: 'center' }} 
                        justifyContent="space-between" 
                        sx={{ mb: { xs: 2, md: 3 } }}
                    >
                        <Box>
                            <Typography 
                                variant={{ xs: 'h5', sm: 'h4' }} 
                                sx={{ 
                                    color: '#00ffaa', 
                                    fontWeight: 700, 
                                    mb: 0.5,
                                    fontSize: { xs: '1.25rem', sm: '2rem' }, // Responsive font size
                                    lineHeight: 1.2
                                }}
                            >
                                🎯 Fusion Events
                            </Typography>
                            <Typography 
                                variant={{ xs: 'body2', sm: 'body1' }} 
                                sx={{ 
                                    color: '#9ecbff',
                                    fontSize: { xs: '0.8rem', sm: '1rem' },
                                    display: { xs: 'none', sm: 'block' } // Hide subtitle on mobile
                                }}
                            >
                                Monitor and analyze fusion trading events in real-time
                            </Typography>
                        </Box>
                        
                        <Stack 
                            direction="row" 
                            spacing={1} 
                            alignItems="center"
                            sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
                        >
                            <Tooltip title="Export Filtered Data to CSV">
                                <IconButton 
                                    onClick={handleExportCSV}
                                    disabled={loading || filteredEvents.length === 0}
                                    sx={{ 
                                        color: '#ff9800',
                                        p: { xs: 0.5, sm: 1 }
                                    }}
                                    size="small"
                                >
                                    <FileDownloadIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Refresh Events">
                                <IconButton 
                                    onClick={handleRefresh} 
                                    disabled={loading}
                                    sx={{ 
                                        color: '#00ffaa',
                                        p: { xs: 0.5, sm: 1 } // Smaller touch target on mobile
                                    }}
                                    size="small"
                                >
                                    <RefreshIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Chip 
                                label={`${filteredEvents.length}`}
                                sx={{ 
                                    bgcolor: 'rgba(0,255,170,0.15)', 
                                    color: '#00ffaa', 
                                    border: '1px solid #00ffaa50',
                                    fontWeight: 600,
                                    fontSize: { xs: '0.7rem', sm: '0.875rem' },
                                    height: { xs: 22, sm: 32 },
                                    '& .MuiChip-label': {
                                        px: { xs: 0.5, sm: 1 }
                                    }
                                }}
                                size="small"
                            />
                        </Stack>
                    </Stack>

                    {/* Filters and Search - Mobile Optimized */}
                    <Paper 
                        sx={{ 
                            p: { xs: 1, sm: 1.5, md: 2 }, 
                            mb: { xs: 2, md: 3 }, 
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: { xs: 1, md: 2 } 
                        }}
                    >
                        <Stack 
                            spacing={{ xs: 2, md: 3 }}
                            sx={{ width: '100%' }}
                        >
                            {/* First Row: Search and Basic Filters */}
                            <Stack 
                                direction={{ xs: 'column', sm: 'row' }} 
                                spacing={{ xs: 1.5, sm: 2 }} 
                                alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                                sx={{ width: '100%' }}
                            >
                                <TextField
                                    label="Search Events"
                                    variant="outlined"
                                    size="small"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Symbol, trace, tag..."
                                    sx={{
                                        flex: { xs: 1, sm: 2 },
                                        minWidth: { xs: '100%', sm: 200 },
                                        maxWidth: { xs: '100%', sm: 300 },
                                        '& .MuiOutlinedInput-root': { 
                                            background: 'rgba(255,255,255,0.05)', 
                                            color: '#e0e0e0',
                                            fontSize: { xs: '0.875rem', md: '1rem' }
                                        },
                                        '& .MuiOutlinedInput-notchedOutline': { 
                                            borderColor: 'rgba(255,255,255,0.2)' 
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': { 
                                            borderColor: '#00ffaa' 
                                        }
                                    }}
                                    InputProps={{ 
                                        sx: { 
                                            fontSize: { xs: '0.875rem', md: '1rem' }
                                        } 
                                    }}
                                    InputLabelProps={{ 
                                        sx: { 
                                            color: '#00ffaa',
                                            fontSize: { xs: '0.875rem', md: '1rem' }
                                        } 
                                    }}
                                />
                                
                                {/* NEW: Trace Filter for Event Journey View */}
                                <TextField
                                    label="Trace ID (Journey)"
                                    variant="outlined"
                                    size="small"
                                    value={traceFilter}
                                    onChange={(e) => setTraceFilter(e.target.value)}
                                    placeholder="Filter by trace..."
                                    sx={{
                                        flex: { xs: 1, sm: 1.5 },
                                        minWidth: { xs: '100%', sm: 150 },
                                        maxWidth: { xs: '100%', sm: 220 },
                                        '& .MuiOutlinedInput-root': { 
                                            background: 'rgba(255,255,255,0.05)', 
                                            color: '#e0e0e0',
                                            fontSize: { xs: '0.875rem', md: '1rem' }
                                        },
                                        '& .MuiOutlinedInput-notchedOutline': { 
                                            borderColor: 'rgba(255,255,255,0.2)' 
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': { 
                                            borderColor: '#00ffaa' 
                                        }
                                    }}
                                    InputProps={{ 
                                        sx: { 
                                            fontSize: { xs: '0.875rem', md: '1rem' }
                                        },
                                        endAdornment: traceFilter && (
                                            <IconButton
                                                size="small"
                                                onClick={() => setTraceFilter('')}
                                                sx={{ color: '#00ffaa' }}
                                            >
                                                <CloseIcon fontSize="small" />
                                            </IconButton>
                                        )
                                    }}
                                    InputLabelProps={{ 
                                        sx: { 
                                            color: '#00ffaa',
                                            fontSize: { xs: '0.875rem', md: '1rem' }
                                        } 
                                    }}
                                />
                                
                                <Stack 
                                    direction={{ xs: 'column', sm: 'row' }} 
                                    spacing={{ xs: 1, sm: 1.5 }} 
                                    sx={{ 
                                        width: { xs: '100%', sm: 'auto' },
                                        flex: { xs: 'none', sm: 1 }
                                    }}
                                >
                                    <TextField
                                        label="Date"
                                        type="date"
                                        value={selectedDate.format('YYYY-MM-DD')}
                                        onChange={(e) => setSelectedDate(moment(e.target.value))}
                                        InputLabelProps={{ 
                                            shrink: true, 
                                            sx: { 
                                                color: '#00ffaa',
                                                fontSize: { xs: '0.875rem', md: '1rem' }
                                            } 
                                        }}
                                        size="small"
                                        sx={{ 
                                            minWidth: { xs: '100%', sm: 140 },
                                            '& .MuiOutlinedInput-root': { 
                                                background: 'rgba(255,255,255,0.05)',
                                                color: '#e0e0e0',
                                                fontSize: { xs: '0.875rem', md: '1rem' }
                                            },
                                            '& .MuiOutlinedInput-notchedOutline': { 
                                                borderColor: 'rgba(255,255,255,0.2)' 
                                            },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { 
                                                borderColor: '#00ffaa' 
                                            }
                                        }}
                                    />
                                    
                                    <TextField
                                        label="Limit"
                                        type="number"
                                        value={limitTraces}
                                        onChange={(e) => setLimitTraces(parseInt(e.target.value) || 100)}
                                        inputProps={{ min: 1, max: 1000 }}
                                        size="small"
                                        sx={{ 
                                            minWidth: { xs: '100%', sm: 80 },
                                            '& .MuiOutlinedInput-root': { 
                                                background: 'rgba(255,255,255,0.05)',
                                                color: '#e0e0e0',
                                                fontSize: { xs: '0.875rem', md: '1rem' }
                                            },
                                            '& .MuiOutlinedInput-notchedOutline': { 
                                                borderColor: 'rgba(255,255,255,0.2)' 
                                            },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { 
                                                borderColor: '#00ffaa' 
                                            }
                                        }}
                                        InputLabelProps={{ 
                                            sx: { 
                                                color: '#00ffaa',
                                                fontSize: { xs: '0.875rem', md: '1rem' }
                                            } 
                                        }}
                                    />
                                </Stack>
                            </Stack>
                            
                            {/* Second Row: Category Filters */}
                            <Stack 
                                direction={{ xs: 'column', sm: 'row' }} 
                                spacing={{ xs: 1.5, sm: 2 }} 
                                sx={{ 
                                    width: '100%',
                                    flexWrap: { sm: 'wrap', md: 'nowrap' }
                                }}
                            >
                                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 110 }, flex: { sm: 1, md: 'none' } }}>
                                    <InputLabel sx={{ 
                                        color: '#00ffaa',
                                        fontSize: { xs: '0.875rem', md: '1rem' }
                                    }}>Type</InputLabel>
                                    <Select
                                        value={eventTypeFilter}
                                        onChange={(e) => setEventTypeFilter(e.target.value)}
                                        label="Type"
                                        sx={{ 
                                            background: 'rgba(255,255,255,0.05)',
                                            color: '#e0e0e0',
                                            fontSize: { xs: '0.875rem', md: '1rem' },
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' }
                                        }}
                                    >
                                        <MenuItem value="ALL">All Types</MenuItem>
                                        {Object.keys(EVENT_TYPE_CONFIG).map(type => (
                                            <MenuItem key={type} value={type}>
                                                {EVENT_TYPE_CONFIG[type].label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            
                                {/* NEW: Stage Filter for 4-stage pipeline */}
                                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140 }, flex: { sm: 1, md: 'none' } }}>
                                    <InputLabel sx={{ 
                                        color: '#00ffaa',
                                        fontSize: { xs: '0.875rem', md: '1rem' }
                                    }}>Stage</InputLabel>
                                    <Select
                                        value={stageFilter}
                                        onChange={(e) => setStageFilter(e.target.value)}
                                        label="Stage"
                                        sx={{ 
                                            background: 'rgba(255,255,255,0.05)',
                                            color: '#e0e0e0',
                                            fontSize: { xs: '0.875rem', md: '1rem' },
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' }
                                        }}
                                    >
                                        <MenuItem value="ALL">All Stages</MenuItem>
                                        {Object.keys(STAGE_CONFIG)
                                            .sort((a, b) => STAGE_CONFIG[a].order - STAGE_CONFIG[b].order)
                                            .map(stage => (
                                                <MenuItem key={stage} value={stage}>
                                                    {STAGE_CONFIG[stage].label}
                                                </MenuItem>
                                            ))
                                        }
                                    </Select>
                                </FormControl>

                                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 100 }, flex: { sm: 1, md: 'none' } }}>
                                    <InputLabel sx={{ 
                                        color: '#00ffaa',
                                        fontSize: { xs: '0.875rem', md: '1rem' }
                                    }}>Side</InputLabel>
                                    <Select
                                        value={sideFilter}
                                        onChange={(e) => setSideFilter(e.target.value)}
                                        label="Side"
                                        sx={{ 
                                            background: 'rgba(255,255,255,0.05)',
                                            color: '#e0e0e0',
                                            fontSize: { xs: '0.875rem', md: '1rem' },
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' }
                                        }}
                                    >
                                        <MenuItem value="ALL">All Sides</MenuItem>
                                        <MenuItem value="CE">CE (Call)</MenuItem>
                                        <MenuItem value="PE">PE (Put)</MenuItem>
                                    </Select>
                                </FormControl>
                                
                                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 120 }, flex: { sm: 1, md: 'none' } }}>
                                    <InputLabel sx={{ 
                                        color: '#00ffaa',
                                        fontSize: { xs: '0.875rem', md: '1rem' }
                                    }}>Symbol</InputLabel>
                                    <Select
                                        value={symbolFilter}
                                        onChange={(e) => setSymbolFilter(e.target.value)}
                                        label="Symbol"
                                        sx={{ 
                                            background: 'rgba(255,255,255,0.05)',
                                            color: '#e0e0e0',
                                            fontSize: { xs: '0.875rem', md: '1rem' },
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' }
                                        }}
                                    >
                                        <MenuItem value="ALL">All Symbols</MenuItem>
                                        {loading && (
                                            <MenuItem disabled>Loading symbols...</MenuItem>
                                        )}
                                        {!loading && eventStats.uniqueSymbolsArray?.length === 0 && (
                                            <MenuItem disabled>No symbols found</MenuItem>
                                        )}
                                        {eventStats.uniqueSymbolsArray?.map(symbol => (
                                            <MenuItem key={symbol} value={symbol}>
                                                {symbol}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Stack>
                            
                            {/* Third Row: Tag and Time Range Filters */}
                            <Stack 
                                direction={{ xs: 'column', sm: 'row' }} 
                                spacing={{ xs: 1.5, sm: 2 }} 
                                sx={{ 
                                    width: '100%',
                                    flexWrap: { sm: 'wrap', md: 'nowrap' }
                                }}
                            >
                                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 110 }, flex: { sm: 1, md: 'none' } }}>
                                    <InputLabel sx={{ 
                                        color: '#00ffaa',
                                        fontSize: { xs: '0.875rem', md: '1rem' }
                                    }}>Tag</InputLabel>
                                    <Select
                                        value={tagFilter}
                                        onChange={(e) => setTagFilter(e.target.value)}
                                        label="Tag"
                                        sx={{ 
                                            background: 'rgba(255,255,255,0.05)',
                                            color: '#e0e0e0',
                                            fontSize: { xs: '0.875rem', md: '1rem' },
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' }
                                        }}
                                    >
                                        <MenuItem value="ALL">All Tags</MenuItem>
                                        <MenuItem value="NO_TAG">No Tag</MenuItem>
                                        {loading && (
                                            <MenuItem disabled>Loading tags...</MenuItem>
                                        )}
                                        {!loading && eventStats.uniqueTagsArray?.length === 0 && (
                                            <MenuItem disabled>No tags found</MenuItem>
                                        )}
                                        {eventStats.uniqueTagsArray?.map(tag => (
                                            <MenuItem key={tag} value={tag}>
                                                {tag}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                
                                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140 }, flex: { sm: 1, md: 'none' } }}>
                                    <InputLabel sx={{ 
                                        color: '#00ffaa',
                                        fontSize: { xs: '0.875rem', md: '1rem' }
                                    }}>Time Range</InputLabel>
                                    <Select
                                        value={dateTimeFilter}
                                        onChange={(e) => setDateTimeFilter(e.target.value)}
                                        label="Time Range"
                                        sx={{ 
                                            background: 'rgba(255,255,255,0.05)',
                                            color: '#e0e0e0',
                                            fontSize: { xs: '0.875rem', md: '1rem' },
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#00ffaa' }
                                        }}
                                    >
                                        <MenuItem value="ALL">All Time</MenuItem>
                                        <MenuItem value="LAST_HOUR">Last Hour</MenuItem>
                                        <MenuItem value="LAST_3_HOURS">Last 3 Hours</MenuItem>
                                        <MenuItem value="LAST_6_HOURS">Last 6 Hours</MenuItem>
                                        <MenuItem value="LAST_12_HOURS">Last 12 Hours</MenuItem>
                                        <MenuItem value="TODAY">Today</MenuItem>
                                        <MenuItem value="CUSTOM">Custom Range</MenuItem>
                                    </Select>
                                </FormControl>
                                
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => {
                                        console.log('🧹 Clearing all filters');
                                        setSearchTerm('');
                                        setEventTypeFilter('ALL');
                                        setTagFilter('ALL');
                                        setSideFilter('ALL');
                                        setSymbolFilter('ALL');
                                        setDateTimeFilter('ALL');
                                        setCustomStartDateTime(moment().startOf('day'));
                                        setCustomEndDateTime(moment().endOf('day'));
                                    }}
                                    sx={{
                                        color: '#ff9800',
                                        borderColor: '#ff980050',
                                        fontSize: { xs: '0.75rem', md: '0.875rem' },
                                        px: { xs: 1.5, md: 2 },
                                        minWidth: { xs: '100%', sm: 'auto' },
                                        '&:hover': {
                                            bgcolor: 'rgba(255, 152, 0, 0.1)',
                                            borderColor: '#ff9800'
                                        }
                                    }}
                                >
                                    Clear Filters
                                </Button>
                            </Stack>
                            
                            {/* Custom Date/Time Range - Full Width on Mobile */}
                            {dateTimeFilter === 'CUSTOM' && (
                                <Stack 
                                    direction={{ xs: 'column', sm: 'row' }} 
                                    spacing={{ xs: 1.5, sm: 2 }} 
                                    sx={{ 
                                        width: '100%',
                                        p: { xs: 1.5, sm: 2 },
                                        bgcolor: 'rgba(255,255,255,0.03)',
                                        borderRadius: 1,
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}
                                >
                                    <TextField
                                        label="Start Date/Time (IST)"
                                        type="datetime-local"
                                        value={customStartDateTime.format('YYYY-MM-DDTHH:mm')}
                                        onChange={(e) => {
                                            const newDateTime = moment(e.target.value);
                                            setCustomStartDateTime(newDateTime);
                                            console.log('📅 Start DateTime Changed:', newDateTime.format('YYYY-MM-DD HH:mm:ss'));
                                        }}
                                        InputLabelProps={{ 
                                            shrink: true, 
                                            sx: { 
                                                color: '#00ffaa',
                                                fontSize: { xs: '0.875rem', md: '1rem' }
                                            } 
                                        }}
                                        size="small"
                                        sx={{ 
                                            flex: 1,
                                            minWidth: { xs: '100%', sm: 180 },
                                            '& .MuiOutlinedInput-root': { 
                                                background: 'rgba(255,255,255,0.05)',
                                                color: '#e0e0e0',
                                                fontSize: { xs: '0.875rem', md: '1rem' }
                                            },
                                            '& .MuiOutlinedInput-notchedOutline': { 
                                                borderColor: 'rgba(255,255,255,0.2)' 
                                            },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { 
                                                borderColor: '#00ffaa' 
                                            }
                                        }}
                                    />
                                    <TextField
                                        label="End Date/Time (IST)"
                                        type="datetime-local"
                                        value={customEndDateTime.format('YYYY-MM-DDTHH:mm')}
                                        onChange={(e) => {
                                            const newDateTime = moment(e.target.value);
                                            setCustomEndDateTime(newDateTime);
                                            console.log('📅 End DateTime Changed:', newDateTime.format('YYYY-MM-DD HH:mm:ss'));
                                        }}
                                        InputLabelProps={{ 
                                            shrink: true, 
                                            sx: { 
                                                color: '#00ffaa',
                                                fontSize: { xs: '0.875rem', md: '1rem' }
                                            } 
                                        }}
                                        size="small"
                                        sx={{ 
                                            flex: 1,
                                            minWidth: { xs: '100%', sm: 180 },
                                            '& .MuiOutlinedInput-root': { 
                                                background: 'rgba(255,255,255,0.05)',
                                                color: '#e0e0e0',
                                                fontSize: { xs: '0.875rem', md: '1rem' }
                                            },
                                            '& .MuiOutlinedInput-notchedOutline': { 
                                                borderColor: 'rgba(255,255,255,0.2)' 
                                            },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { 
                                                borderColor: '#00ffaa' 
                                            }
                                        }}
                                    />
                                </Stack>
                            )}
                        </Stack>
                    </Paper>

                    {/* Statistics Cards - Mobile Optimized */}
                    {eventStats.total > 0 && (
                        <Box
                            sx={{
                                mb: { xs: 2, md: 3 },
                                display: 'grid',
                                gridTemplateColumns: { 
                                    xs: 'repeat(2, 1fr)', 
                                    sm: 'repeat(2, 1fr)', 
                                    md: 'repeat(4, 1fr)' 
                                },
                                gap: { xs: 1, sm: 1.5, md: 2 }
                            }}
                        >
                            <Card sx={{ 
                                background: 'rgba(0, 255, 170, 0.08)', 
                                border: '1px solid #00ffaa30',
                                borderRadius: { xs: 1, md: 2 }
                            }}>
                                <CardContent sx={{ textAlign: 'center', py: { xs: 1, md: 1.5 }, px: { xs: 1, md: 2 } }}>
                                    <Typography variant={{ xs: 'h6', md: 'h4' }} sx={{ 
                                        color: '#00ffaa', 
                                        fontFamily: 'Roboto Mono, monospace', 
                                        fontWeight: 700,
                                        fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem' }
                                    }}>
                                        {eventStats.total}
                                    </Typography>
                                    <Typography variant={{ xs: 'caption', md: 'body2' }} sx={{ 
                                        color: '#a7ffeb',
                                        fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }
                                    }}>Total Events</Typography>
                                </CardContent>
                            </Card>
                            
                            <Card sx={{ 
                                background: 'rgba(76, 175, 80, 0.08)', 
                                border: '1px solid #4CAF5030',
                                borderRadius: { xs: 1, md: 2 }
                            }}>
                                <CardContent sx={{ textAlign: 'center', py: { xs: 1, md: 1.5 }, px: { xs: 1, md: 2 } }}>
                                    <Typography variant={{ xs: 'h6', md: 'h4' }} sx={{ 
                                        color: '#4CAF50', 
                                        fontFamily: 'Roboto Mono, monospace', 
                                        fontWeight: 700,
                                        fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem' }
                                    }}>
                                        {eventStats.bySide?.CE || 0}
                                    </Typography>
                                    <Typography variant={{ xs: 'caption', md: 'body2' }} sx={{ 
                                        color: '#a5d6a7',
                                        fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }
                                    }}>Call Events</Typography>
                                </CardContent>
                            </Card>
                            
                            <Card sx={{ 
                                background: 'rgba(244, 67, 54, 0.08)', 
                                border: '1px solid #F4433630',
                                borderRadius: { xs: 1, md: 2 }
                            }}>
                                <CardContent sx={{ textAlign: 'center', py: { xs: 1, md: 1.5 }, px: { xs: 1, md: 2 } }}>
                                    <Typography variant={{ xs: 'h6', md: 'h4' }} sx={{ 
                                        color: '#F44336', 
                                        fontFamily: 'Roboto Mono, monospace', 
                                        fontWeight: 700,
                                        fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem' }
                                    }}>
                                        {eventStats.bySide?.PE || 0}
                                    </Typography>
                                    <Typography variant={{ xs: 'caption', md: 'body2' }} sx={{ 
                                        color: '#ef9a9a',
                                        fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }
                                    }}>Put Events</Typography>
                                </CardContent>
                            </Card>
                            
                            <Card sx={{ 
                                background: 'rgba(255, 193, 7, 0.08)', 
                                border: '1px solid #FFC10730',
                                borderRadius: { xs: 1, md: 2 }
                            }}>
                                <CardContent sx={{ textAlign: 'center', py: { xs: 1, md: 1.5 }, px: { xs: 1, md: 2 } }}>
                                    <Typography variant={{ xs: 'h6', md: 'h4' }} sx={{ 
                                        color: '#FFC107', 
                                        fontFamily: 'Roboto Mono, monospace', 
                                        fontWeight: 700,
                                        fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem' }
                                    }}>
                                        {eventStats.uniqueTagsArray?.length || 0}
                                    </Typography>
                                    <Typography variant={{ xs: 'caption', md: 'body2' }} sx={{ 
                                        color: '#fff9c4',
                                        fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }
                                    }}>Unique Tags</Typography>
                                </CardContent>
                            </Card>
                        </Box>
                    )}

                    {/* Error Alert */}
                    {error && (
                        <Alert severity="error" sx={{ mb: 3, bgcolor: 'rgba(244, 67, 54, 0.1)', border: '1px solid #F4433630' }}>
                            {error}
                        </Alert>
                    )}

                    {/* Loading State */}
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress sx={{ color: '#00ffaa' }} />
                        </Box>
                    ) : (
                        <>
                            {/* Events List */}
                            {filteredEvents.length === 0 ? (
                                <Paper sx={{ 
                                    p: 4, 
                                    textAlign: 'center',
                                    background: 'rgba(158,158,158,0.05)',
                                    border: '1px solid #9e9e9e30'
                                }}>
                                    <EventIcon sx={{ fontSize: 60, color: '#9e9e9e', mb: 2 }} />
                                    <Typography variant="h6" sx={{ color: '#9e9e9e' }}>
                                        No events found
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#9e9e9e', mt: 1 }}>
                                        {events.length === 0 
                                            ? 'Try selecting a different date or adjusting the filters'
                                            : 'Try adjusting your search or filter criteria'
                                        }
                                    </Typography>
                                </Paper>
                            ) : (
                                <Grid container spacing={{ xs: 1, sm: 2, md: 3 }} sx={{ mt: 1 }}>
                                    {filteredEvents.map((event, index) => (
                                        <Grid item xs={12} sm={6} lg={4} xl={3} key={event.id || index}>
                                            <Box sx={{ 
                                                height: '100%',
                                                display: 'flex',
                                                flexDirection: 'column'
                                            }}> {/* Ensure consistent card heights and mobile optimization */}
                                                <EventCard
                                                    event={event}
                                                    onViewDetails={handleViewDetails}
                                                />
                                            </Box>
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </>
                    )}
                </Paper>
            </Container>

            {/* Event Details Dialog */}
            <EventDetailsDialog
                open={detailsDialogOpen}
                onClose={() => setDetailsDialogOpen(false)}
                event={selectedEvent}
            />
        </>
    );
};

export default FusionEvents;