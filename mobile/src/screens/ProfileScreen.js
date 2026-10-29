import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

const ProfileScreen = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: logout, style: 'destructive' },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user?.name || '-'}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email || '-'}</Text>

        <Text style={styles.label}>Phone</Text>
        <Text style={styles.value}>{user?.phone || '-'}</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 18, elevation: 2 },
  label: { fontSize: 13, color: '#777', marginTop: 12 },
  value: { fontSize: 17, fontWeight: '600', color: '#25264A', marginTop: 4 },
  logoutButton: { backgroundColor: '#EF4444', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 24 },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default ProfileScreen;