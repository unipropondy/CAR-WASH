import React, { useEffect } from 'react';
import { View, StatusBar, StyleSheet, Platform } from 'react-native';
import { 
  BrowserRouter, 
  MemoryRouter, 
  Routes, 
  Route, 
  Navigate, 
  useLocation, 
  useNavigate 
} from 'react-router-dom';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { PosDashboardScreen } from '../features/pos/screens/PosDashboardScreen';
import { KioskMainScreen } from '../features/kiosk/screens/KioskMainScreen';
import { BackofficeScreen } from '../features/backoffice/screens/BackofficeScreen';
import { useAuthStore } from '../features/auth/store/authStore';
import { PosNavTab } from '../features/pos/components/PosSidebar';
import { KioskPage, KioskUserType } from '../features/kiosk/types/kiosk.types';

export type AppMode = 'LOGIN' | 'POS' | 'KIOSK';

const Router = Platform.OS === 'web' ? BrowserRouter : MemoryRouter;

export const KIOSK_ROUTES = [
  '/customer-login',
  '/kiosk',
  '/dealer-login',
  '/dealer-password',
  '/dealer-confirm',
  '/new-wash',
  '/vehicles',
  '/services',
  '/packages',
  '/details',
  '/checkout',
  '/payment',
  '/success',
];

export const POS_ROUTES = [
  '/dashboard',
  '/orders',
  '/reports',
  '/bays',
  '/settings',
  '/customers',
];

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const loadStoredSession = useAuthStore((state) => state.loadStoredSession);

  // Restore saved session if available
  useEffect(() => {
    loadStoredSession();
  }, [loadStoredSession]);

  // Handle root "/" or query parameter redirection
  useEffect(() => {
    if (location.pathname === '/') {
      if (typeof window !== 'undefined' && window.location?.search?.includes('mode=login')) {
        navigate('/login', { replace: true });
      } else if (typeof window !== 'undefined' && window.location?.search?.includes('mode=pos')) {
        navigate('/dashboard', { replace: true });
      } else if (isAuthenticated) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/customer-login', { replace: true });
      }
    }
  }, [location.pathname, isAuthenticated, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handlePosTabChange = (tab: PosNavTab) => {
    switch (tab) {
      case 'ORDERS':
        navigate('/dashboard');
        break;
      case 'REPORTS':
        navigate('/reports');
        break;
      case 'BAYS':
        navigate('/bays');
        break;
      case 'SETTINGS':
        navigate('/settings');
        break;
      case 'CUSTOMERS':
        navigate('/customers');
        break;
    }
  };

  const displayName = user?.userName || 'User';

  // Determine current POS tab from pathname
  const getPosTab = (): PosNavTab => {
    if (location.pathname === '/reports') return 'REPORTS';
    if (location.pathname === '/bays') return 'BAYS';
    if (location.pathname === '/settings') return 'SETTINGS';
    if (location.pathname === '/customers') return 'CUSTOMERS';
    return 'ORDERS';
  };

  // Determine initial kiosk page and user type from pathname
  const getKioskInitial = (): { page: KioskPage; userType: KioskUserType } => {
    switch (location.pathname) {
      case '/dealer-login':
        return { page: 'DEALER_CHOOSE', userType: 'DEALER' };
      case '/dealer-password':
        return { page: 'DEALER_PASSWORD', userType: 'DEALER' };
      case '/dealer-confirm':
        return { page: 'DEALER_CREDIT_CONFIRM', userType: 'DEALER' };
      case '/new-wash':
      case '/vehicles':
        return { page: 'PAGE_2_VEHICLE', userType: 'CUSTOMER' };
      case '/services':
      case '/packages':
        return { page: 'PAGE_3_SERVICE_CAT', userType: 'CUSTOMER' };
      case '/details':
        return { page: 'PAGE_4_DETAILS', userType: 'CUSTOMER' };
      case '/checkout':
      case '/payment':
        return { page: 'PAGE_5_PAYMENT', userType: 'CUSTOMER' };
      case '/success':
        return { page: 'PAGE_6_SUCCESS', userType: 'CUSTOMER' };
      case '/customer-login':
      case '/kiosk':
      default:
        return { page: 'PAGE_1_USER_TYPE', userType: 'CUSTOMER' };
    }
  };

  const isPosRoute = POS_ROUTES.includes(location.pathname);
  const isKioskRoute = KIOSK_ROUTES.includes(location.pathname);
  const isLoginRoute = location.pathname === '/login';
  const isBackofficeRoute = location.pathname === '/backoffice';

  const kioskInitial = getKioskInitial();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080808" />

      {isLoginRoute ? (
        <LoginScreen
          onLoginSuccess={() => {
            navigate('/dashboard');
          }}
          onQuickSwitchToKiosk={() => navigate('/customer-login')}
          onBackofficeAccess={() => navigate('/backoffice')}
        />
      ) : isBackofficeRoute ? (
        <BackofficeScreen
          onLogout={() => navigate('/login')}
        />
      ) : isPosRoute ? (
        <PosDashboardScreen
          currentMode="POS"
          cashierName={displayName}
          currentTab={getPosTab()}
          onTabChange={handlePosTabChange}
          onSwitchMode={(mode) => {
            if (mode === 'KIOSK') navigate('/customer-login');
          }}
          onSwitchToKiosk={() => navigate('/customer-login')}
          onLogout={handleLogout}
        />
      ) : isKioskRoute ? (
        <KioskMainScreen
          initialPage={kioskInitial.page}
          initialUserType={kioskInitial.userType}
          currentRoute={location.pathname}
          onNavigateScreen={(route) => navigate(route)}
          onExitToPos={() => navigate('/dashboard')}
        />
      ) : (
        <Routes>
          <Route path="/" element={<View />} />
          <Route path="/orders" element={<Navigate to="/dashboard" replace />} />
          <Route path="/day-management" element={<Navigate to="/dashboard" replace />} />
          <Route path="/day-start" element={<Navigate to="/dashboard" replace />} />
          <Route path="/day-end" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/customer-login'} replace />} />
        </Routes>
      )}
    </View>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? {
          height: '100vh' as any,
          minHeight: '100vh' as any,
          width: '100vw' as any,
          overflow: 'hidden' as any,
        }
      : {}),
  },
});
