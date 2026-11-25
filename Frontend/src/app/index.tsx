import React, { useEffect } from 'react';
import { View, StatusBar, StyleSheet, Platform, BackHandler } from 'react-native';
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
import { loadKioskSession } from '../features/kiosk/store/kioskSessionStorage';
import { getRouteForUserGroup, resolveUserRoleCategory } from '../features/auth/utils/userGroupRouting';
import { initTimeSync } from '../services/timeService';

export type AppMode = 'LOGIN' | 'POS' | 'KIOSK';

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
  '/dealers',
  '/history',
];

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const loadStoredSession = useAuthStore((state) => state.loadStoredSession);

  // Restore saved session if available & initialize Singapore DB time sync
  useEffect(() => {
    loadStoredSession();
    const cleanupTimeSync = initTimeSync();
    return () => {
      cleanupTimeSync?.();
    };
  }, [loadStoredSession]);

  const userRole = resolveUserRoleCategory(user);

  // Handle root "/" or query parameter redirection based on User Group Code
  useEffect(() => {
    if (location.pathname === '/') {
      if (typeof window !== 'undefined' && window.location?.search?.includes('mode=login')) {
        navigate('/login', { replace: true });
      } else if (typeof window !== 'undefined' && window.location?.search?.includes('mode=pos')) {
        navigate(isAuthenticated ? '/dashboard' : '/login', { replace: true });
      } else if (isAuthenticated) {
        const dest = getRouteForUserGroup(user);
        navigate(dest, { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [location.pathname, isAuthenticated, navigate, user]);

  // Prevent unauthorized access to internal protected pages
  useEffect(() => {
    if (!isAuthenticated && location.pathname !== '/login') {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  // KIOSK role guard: strictly restrict to Kiosk UI; do not allow POS or Backoffice
  useEffect(() => {
    if (isAuthenticated && userRole === 'KIOSK') {
      const isPos = POS_ROUTES.includes(location.pathname);
      const isBackoffice = location.pathname === '/backoffice';
      if (isPos || isBackoffice) {
        navigate('/customer-login', { replace: true });
      }
    }
  }, [isAuthenticated, userRole, location.pathname, navigate]);

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
      case 'DEALERS':
        navigate('/dealers');
        break;
      case 'HISTORY':
        navigate('/history');
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
    if (location.pathname === '/dealers') return 'DEALERS';
    if (location.pathname === '/history') return 'HISTORY';
    return 'ORDERS';
  };

  // Hardware/gesture back-button navigation for Android
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      const path = location.pathname;

      // Kiosk step navigation backwards
      if (path === '/vehicles' || path === '/new-wash') {
        navigate('/customer-login');
        return true;
      }
      if (path === '/services' || path === '/packages') {
        navigate('/new-wash');
        return true;
      }
      if (path === '/details') {
        navigate('/services');
        return true;
      }
      if (path === '/payment' || path === '/checkout' || path === '/dealer-confirm') {
        navigate('/details');
        return true;
      }
      if (path === '/dealer-login') {
        navigate('/customer-login');
        return true;
      }
      if (path === '/dealer-password') {
        navigate('/dealer-login');
        return true;
      }
      if (path === '/success') {
        navigate('/customer-login');
        return true;
      }

      // POS sub-tab navigation backwards
      if (
        path === '/reports' ||
        path === '/bays' ||
        path === '/settings' ||
        path === '/customers' ||
        path === '/dealers' ||
        path === '/history'
      ) {
        navigate('/dashboard');
        return true;
      }

      // Backoffice navigation backwards
      if (path === '/backoffice') {
        navigate('/login');
        return true;
      }

      // Login navigation backwards: allow standard Android behavior (exit/minimize app)
      if (path === '/login') {
        return false;
      }

      // Root pages (/dashboard, /customer-login): allow standard Android behavior
      return false;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [location.pathname, navigate]);

  // Determine initial kiosk page and user type from pathname
  const getKioskInitial = (): { page: KioskPage; userType: KioskUserType } => {
    const session = loadKioskSession();
    const sessionUserType: KioskUserType = session?.userType || 'CUSTOMER';

    switch (location.pathname) {
      case '/dealer-login':
        return { page: 'DEALER_CHOOSE', userType: 'DEALER' };
      case '/dealer-password':
        return { page: 'DEALER_PASSWORD', userType: 'DEALER' };
      case '/dealer-confirm':
        return { page: 'DEALER_CREDIT_CONFIRM', userType: 'DEALER' };
      case '/new-wash':
      case '/vehicles':
        return { page: 'PAGE_2_VEHICLE', userType: sessionUserType };
      case '/services':
        return { page: 'PAGE_3_SERVICE_CAT', userType: sessionUserType };
      case '/packages':
        return { page: 'PAGE_3_PACKAGES', userType: sessionUserType };
      case '/details':
        return { page: 'PAGE_4_DETAILS', userType: sessionUserType };
      case '/checkout':
      case '/payment':
        return { page: 'PAGE_5_PAYMENT', userType: sessionUserType };
      case '/success':
        return { page: 'PAGE_6_SUCCESS', userType: sessionUserType };
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
    <View style={[styles.container, isKioskRoute && styles.kioskContainer]}>
      <StatusBar barStyle={isKioskRoute ? 'dark-content' : 'light-content'} backgroundColor={isKioskRoute ? '#F8FAFC' : '#080808'} />

      {isLoginRoute ? (
        <LoginScreen
          onLoginSuccess={(loggedInUser?: any) => {
            const dest = getRouteForUserGroup(loggedInUser || user);
            navigate(dest, { replace: true });
          }}
          onQuickSwitchToKiosk={() => navigate('/customer-login')}
          onBackofficeAccess={() => navigate('/backoffice')}
        />
      ) : !isAuthenticated ? (
        <Navigate to="/login" replace />
      ) : isBackofficeRoute ? (
        <BackofficeScreen
          onLogout={handleLogout}
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
          onExitToPos={() => {
            const currentUser = useAuthStore.getState().user;
            const dest = getRouteForUserGroup(currentUser);
            navigate(dest);
          }}
        />
      ) : (
        <Routes>
          <Route path="/" element={<View />} />
          <Route path="/orders" element={<Navigate to="/dashboard" replace />} />
          <Route path="/day-management" element={<Navigate to="/dashboard" replace />} />
          <Route path="/day-start" element={<Navigate to="/dashboard" replace />} />
          <Route path="/day-end" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
        </Routes>
      )}
    </View>
  );
}

export default function App() {
  return Platform.OS === 'web' ? (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent />
    </BrowserRouter>
  ) : (
    <MemoryRouter initialEntries={['/login']}>
      <AppContent />
    </MemoryRouter>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
    position: 'relative',
    width: '100%',
    height: '100%',
    margin: 0,
    padding: 0,
    ...(Platform.OS === 'web'
      ? {
          height: '100vh' as any,
          maxHeight: '100vh' as any,
          width: '100vw' as any,
          maxWidth: '100vw' as any,
          boxSizing: 'border-box' as any,
          overflow: 'hidden' as any,
        }
      : {}),
  },
  kioskContainer: {
    backgroundColor: '#F8FAFC',
    margin: 0,
    padding: 0,
    width: '100%',
    height: '100%',
  },
});
