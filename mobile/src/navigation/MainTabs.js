import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/HomeScreen';
import TrustedContactsScreen from '../screens/TrustedContactsScreen';
import SessionHistoryScreen from '../screens/SessionHistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const icon = (emoji) => () => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: '#6366F1' },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: 'bold' },
      tabBarActiveTintColor: '#6366F1',
    }}
  >
    <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Spheriva', tabBarLabel: 'Home', tabBarIcon: icon('🏠') }} />
    <Tab.Screen name="TrustedContacts" component={TrustedContactsScreen} options={{ title: 'Trusted Contacts', tabBarLabel: 'Contacts', tabBarIcon: icon('👥') }} />
    <Tab.Screen name="History" component={SessionHistoryScreen} options={{ title: 'Session History', tabBarLabel: 'History', tabBarIcon: icon('🕒') }} />
    <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile', tabBarLabel: 'Profile', tabBarIcon: icon('👤') }} />
  </Tab.Navigator>
);

export default MainTabs;