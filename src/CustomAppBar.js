import React, { useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  IconButton, 
  Typography, 
  Button, 
  Tooltip,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  useMediaQuery,
  useTheme,
  styled,
  Chip
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle as AccountCircleIcon,
  Dashboard as DashboardIcon,
  TrendingUp as PositionsIcon,
  ShowChart as SignalIcon,
  Receipt as OrdersIcon,
  Assessment as TradeSummaryIcon,
  Timeline as TrailDataIcon,
  Logout as LogoutIcon,
  Close as CloseIcon,
  ListAlt as LiveOrdersIcon,
  EventNote as FusionEventsIcon,
  BarChart as TradeAnalysisIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { useUser } from './UserContext';
import ShowChart from '@mui/icons-material/ShowChart';
// Styled components
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)',
  borderBottom: '1px solid #00ffaa30',
  boxShadow: '0 4px 20px rgba(0, 255, 170, 0.1)',
}));

const ScrollableNav = styled(Box)(({ theme }) => ({
  display: 'flex',
  overflowX: 'auto',
  scrollBehavior: 'smooth',
  gap: theme.spacing(1),
  padding: theme.spacing(0, 1),
  '&::-webkit-scrollbar': {
    height: '4px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'rgba(255, 255, 255, 0.1)',
  },
  '&::-webkit-scrollbar-thumb': {
    background: '#00ffaa',
    borderRadius: '2px',
  },
  [theme.breakpoints.up('md')]: {
    overflow: 'visible',
  },
}));

const NavButton = styled(Button)(({ theme, active }) => ({
  whiteSpace: 'nowrap',
  minWidth: 'auto',
  padding: theme.spacing(1, 2),
  borderRadius: '20px',
  textTransform: 'none',
  fontWeight: active ? 'bold' : 'normal',
  background: active 
    ? 'linear-gradient(45deg, #00ffaa30, #4CAF5030)' 
    : 'transparent',
  border: active ? '1px solid #00ffaa60' : '1px solid transparent',
  color: active ? '#00ffaa' : '#e0e0e0',
  transition: 'all 0.3s ease',
  '&:hover': {
    background: active 
      ? 'linear-gradient(45deg, #00ffaa40, #4CAF5040)' 
      : 'rgba(0, 255, 170, 0.1)',
    border: '1px solid #00ffaa40',
    color: '#00ffaa',
    transform: 'translateY(-1px)',
  },
}));

const LogoText = styled(Typography)(({ theme }) => ({
  fontWeight: 'bold',
  background: 'linear-gradient(45deg, #00ffaa, #4CAF50)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontSize: '1.2rem',
  [theme.breakpoints.down('sm')]: {
    fontSize: '1rem',
  },
}));

const UserChip = styled(Chip)(({ theme }) => ({
  background: 'linear-gradient(45deg, #00ffaa20, #4CAF5020)',
  border: '1px solid #00ffaa30',
  color: '#00ffaa',
  '& .MuiChip-avatar': {
    color: '#00ffaa',
  },
}));

const CustomAppBar = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const navigationItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
   // { path: '/positions', label: 'Positions', icon: <PositionsIcon /> },
   // { path: '/signal', label: 'Signal', icon: <SignalIcon /> },
    { path: '/orders', label: 'Orders', icon: <OrdersIcon /> },
   // { path: '/live-trade-orders', label: 'Live Orders', icon: <LiveOrdersIcon /> },
   // { path: '/trade-summary', label: 'Trade Summary', icon: <TradeSummaryIcon /> },
    { path: '/trail-data', label: 'Trail Data', icon: <TrailDataIcon /> },
    { path: '/fusion', label: 'Fusion', icon: <TradeSummaryIcon /> },
    { path: '/fusion-events', label: 'Fusion Events', icon: <FusionEventsIcon /> },
    { path: '/trade-analysis', label: 'Trade Analysis', icon: <TradeAnalysisIcon /> },
    { path: '/market-stream', label: 'Market', icon: <ShowChart as={undefined} /> },
  ];

  const currentItem = navigationItems.find(item => item.path === location.pathname);
  const otherItems = navigationItems.filter(item => item.path !== location.pathname);

  return (
    <>
      <StyledAppBar position="static">
        <Toolbar sx={{ minHeight: { xs: '56px', sm: '64px' } }}>
          {/* Mobile Menu Button */}
          {isMobile && (
            <IconButton 
              edge="start" 
              color="inherit" 
              aria-label="menu"
              onClick={toggleDrawer}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Logo */}
          <LogoText variant="h6" component="div">
            Zatamap
          </LogoText>

          {/* Desktop Navigation */}
          {!isMobile && (
            <ScrollableNav sx={{ ml: 3, flexGrow: 1 }}>
              {otherItems.map((item) => (
                <NavButton
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  startIcon={item.icon}
                  active={false}
                >
                  {item.label}
                </NavButton>
              ))}
            </ScrollableNav>
          )}

          {/* Mobile Current Page Indicator */}
          {isMobile && currentItem && (
            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
              <Chip
                icon={currentItem.icon}
                label={currentItem.label}
                variant="outlined"
                sx={{
                  color: '#00ffaa',
                  borderColor: '#00ffaa60',
                  '& .MuiChip-icon': { color: '#00ffaa' }
                }}
              />
            </Box>
          )}

          {/* Spacer for desktop */}
          {!isMobile && <Box sx={{ flexGrow: 1 }} />}

          {/* User Info */}
          {user?.email ? (
            <UserChip
              avatar={<AccountCircleIcon />}
              label={isMobile ? '' : user.email.split('@')[0]}
              size={isMobile ? 'small' : 'medium'}
              sx={{ mr: 1 }}
            />
          ) : (
            <Typography variant="body2" color="inherit" sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}>
              Guest
            </Typography>
          )}

          {/* Logout Button */}
          <Tooltip title="Logout">
            <IconButton 
              color="inherit" 
              onClick={handleLogout}
              sx={{
                border: '1px solid #00ffaa30',
                '&:hover': {
                  background: 'rgba(0, 255, 170, 0.1)',
                  border: '1px solid #00ffaa60',
                }
              }}
            >
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </StyledAppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={toggleDrawer}
        sx={{
          '& .MuiDrawer-paper': {
            background: 'linear-gradient(135deg, #0a1929 0%, #1a237e 100%)',
            border: '1px solid #00ffaa30',
            width: 280,
            color: '#e0e0e0',
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid #00ffaa30' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <LogoText variant="h6">Zatamap</LogoText>
            <IconButton onClick={toggleDrawer} sx={{ color: '#e0e0e0' }}>
              <CloseIcon />
            </IconButton>
          </Box>
          {user?.email && (
            <UserChip
              avatar={<AccountCircleIcon />}
              label={user.email}
              size="small"
              sx={{ width: '100%' }}
            />
          )}
        </Box>

        <List sx={{ flexGrow: 1 }}>
          {navigationItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => {
                  navigate(item.path);
                  setDrawerOpen(false);
                }}
                sx={{
                  '&.Mui-selected': {
                    background: 'linear-gradient(45deg, #00ffaa20, #4CAF5020)',
                    borderRight: '3px solid #00ffaa',
                    '& .MuiListItemIcon-root': { color: '#00ffaa' },
                    '& .MuiListItemText-primary': { color: '#00ffaa', fontWeight: 'bold' },
                  },
                  '&:hover': {
                    background: 'rgba(0, 255, 170, 0.1)',
                  },
                }}
              >
                <ListItemIcon sx={{ color: '#e0e0e0', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.9rem',
                    fontWeight: location.pathname === item.path ? 'bold' : 'normal'
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Box sx={{ p: 2, borderTop: '1px solid #00ffaa30' }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
            sx={{
              color: '#F44336',
              borderColor: '#F4433660',
              '&:hover': {
                borderColor: '#F44336',
                background: 'rgba(244, 67, 54, 0.1)',
              },
            }}
          >
            Logout
          </Button>
        </Box>
      </Drawer>
    </>
  );
};

export default CustomAppBar;
