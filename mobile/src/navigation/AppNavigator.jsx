import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme/colors';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import OnboardingLocationScreen from '../screens/OnboardingLocationScreen';
import CatalogScreen from '../screens/CatalogScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function createPlaceholderScreen(title, subtitle) {
  return function PlaceholderTab() {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderTitle}>{title}</Text>
        <Text style={styles.placeholderSub}>{subtitle}</Text>
      </View>
    );
  };
}

const PoolMapPlaceholder = createPlaceholderScreen(
  'Nearby 3 km Pools',
  'Live map with radius circles and cluster pins arrives in Day 5.'
);
const OrdersPlaceholder = createPlaceholderScreen(
  'My Sub-Orders',
  'Active pool commitments and locked rates arrive in Day 6.'
);

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTitleStyle: { fontWeight: '800', color: COLORS.textPrimary },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="PoolMap"
        component={PoolMapPlaceholder}
        options={{ title: '3 km Map', tabBarLabel: 'Map' }}
      />
      <Tab.Screen
        name="Catalog"
        component={CatalogScreen}
        options={{ title: 'Wholesale Catalog', tabBarLabel: 'Catalog' }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersPlaceholder}
        options={{ title: 'My Orders', tabBarLabel: 'Orders' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Kitchen Hub', tabBarLabel: 'Hub' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { bootstrapping, isAuthenticated, isLocationVerified } = useAuth();

  if (bootstrapping) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.splashText}>Connecting to CloudPool Hub...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : !isLocationVerified ? (
        <Stack.Screen name="OnboardingLocation" component={OnboardingLocationScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen
            name="UpdateLocation"
            component={OnboardingLocationScreen}
            options={{ headerShown: true, title: 'Update Kitchen Pin' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  placeholder: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  placeholderSub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
