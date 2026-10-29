import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

const MOCK_SESSIONS = [
  { id: '1', startedAt: '28 Oct 2026, 6:30 PM', duration: '45 min', status: 'Completed', sos: false },
  { id: '2', startedAt: '25 Oct 2026, 9:10 PM', duration: '12 min', status: 'SOS Triggered', sos: true },
  { id: '3', startedAt: '20 Oct 2026, 7:00 PM', duration: '30 min', status: 'Completed', sos: false },
];

const SessionHistoryScreen = () => {
  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.date}>{item.startedAt}</Text>
      <Text style={styles.meta}>Duration: {item.duration}</Text>
      <Text style={[styles.status, item.sos && styles.statusSos]}>{item.status}</Text>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={MOCK_SESSIONS}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListEmptyComponent={<Text style={styles.empty}>No sessions yet.</Text>}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2 },
  date: { fontSize: 16, fontWeight: 'bold', color: '#25264A' },
  meta: { fontSize: 13, color: '#777', marginTop: 6 },
  status: { fontSize: 13, fontWeight: '600', color: '#15803D', marginTop: 8 },
  statusSos: { color: '#BE123C' },
  empty: { textAlign: 'center', color: '#777', marginTop: 40 },
});

export default SessionHistoryScreen;