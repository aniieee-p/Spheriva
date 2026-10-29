import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const formatElapsed = (totalSeconds) => {
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();

  // TODO (Nistha): replace this local state with the real session state/context
  const [sessionActive, setSessionActive] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!sessionActive) {
      setElapsed(0);
      return undefined;
    }
    const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [sessionActive]);

  const handleStartSession = () => {
    Alert.alert(
      'Start Safety Session',
      'Your trusted contacts will be able to follow your session.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => {
            // TODO (Nistha): call the start session function here
            setSessionActive(true);
          },
        },
      ]
    );
  };

  const handleStopSession = () => {
    Alert.alert('Stop Session', 'Are you sure you want to end this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: () => {
          // TODO (Nistha): call the stop session function here
          setSessionActive(false);
          setSosActive(false);
        },
      },
    ]);
  };

  const handleSos = () => {
    if (sosActive) {
      Alert.alert('Cancel SOS', 'Mark yourself as safe and cancel the alert?', [
        { text: 'Keep SOS On', style: 'cancel' },
        {
          text: 'I am Safe',
          onPress: () => {
            // TODO (Nistha): call the cancel SOS function here
            setSosActive(false);
          },
        },
      ]);
      return;
    }

    Alert.alert(
      'Send SOS Alert',
      'This will alert your trusted contacts. Send it now?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: () => {
            // TODO (Nistha): call the create SOS function here
            setSosActive(true);
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome back,</Text>
        <Text style={styles.nameText}>{user?.name || 'User'}</Text>
        <Text style={styles.tagline}>Your safety, your priority.</Text>
      </View>

      {/* Safety Session card */}
      <View style={[styles.sessionCard, sessionActive && styles.sessionCardActive]}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Safety Session</Text>
          <View style={[styles.badge, sessionActive ? styles.badgeOn : styles.badgeOff]}>
            <Text style={styles.badgeText}>
              {sessionActive ? 'ACTIVE' : 'INACTIVE'}
            </Text>
          </View>
        </View>

        {sessionActive ? (
          <>
            <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
            <Text style={styles.cardDescription}>
              Your session is running. Trusted contacts can follow it.
            </Text>
            <TouchableOpacity style={styles.stopButton} onPress={handleStopSession}>
              <Text style={styles.stopButtonText}>Stop Session</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.cardDescription}>
              Stay prepared and keep your trusted people close.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={handleStartSession}>
              <Text style={styles.primaryButtonText}>Start Session</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* SOS card */}
      <TouchableOpacity
        style={[styles.sosCard, sosActive && styles.sosCardActive]}
        onPress={handleSos}
      >
        <Text style={[styles.sosTitle, sosActive && styles.sosTitleActive]}>
          {sosActive ? 'SOS Active' : 'Emergency SOS'}
        </Text>
        <Text style={[styles.sosDescription, sosActive && styles.sosTextActive]}>
          {sosActive
            ? 'Your trusted contacts are being alerted.'
            : 'SOS is not active'}
        </Text>
        <Text style={[styles.sosHint, sosActive && styles.sosTextActive]}>
          {sosActive ? 'Tap to cancel SOS' : 'Tap to send an emergency alert'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Quick Access</Text>

      <TouchableOpacity
        style={styles.featureCard}
        onPress={() => navigation.navigate('TrustedContacts')}
      >
        <Text style={styles.featureTitle}>Trusted Contacts</Text>
        <Text style={styles.featureDescription}>
          Manage people you trust in an emergency.
        </Text>
        <Text style={styles.arrow}>View Contacts {'>'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.featureCard}
        onPress={() => navigation.navigate('History')}
      >
        <Text style={styles.featureTitle}>Session History</Text>
        <Text style={styles.featureDescription}>
          View your previous safety sessions.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.featureCard}
        onPress={() => navigation.navigate('Profile')}
      >
        <Text style={styles.featureTitle}>My Profile</Text>
        <Text style={styles.featureDescription}>
          Manage your personal details.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.featureCard}
        onPress={() => Alert.alert('Safety Tips', 'This feature is coming soon.')}
      >
        <Text style={styles.featureTitle}>Safety Tips</Text>
        <Text style={styles.featureDescription}>
          Learn simple ways to stay safe.
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { padding: 20, paddingBottom: 30 },
  header: { marginBottom: 24 },
  welcomeText: { fontSize: 17, color: '#666' },
  nameText: { fontSize: 30, fontWeight: 'bold', color: '#25264A', marginTop: 4 },
  tagline: { fontSize: 14, color: '#777', marginTop: 8 },

  sessionCard: { backgroundColor: '#6366F1', borderRadius: 16, padding: 20, marginBottom: 16 },
  sessionCardActive: { backgroundColor: '#15803D' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 21, fontWeight: 'bold', color: '#FFFFFF' },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeOn: { backgroundColor: '#DCFCE7' },
  badgeOff: { backgroundColor: 'rgba(255,255,255,0.25)' },
  badgeText: { fontSize: 11, fontWeight: 'bold', color: '#14532D' },
  timer: { fontSize: 40, fontWeight: 'bold', color: '#FFFFFF', marginTop: 14 },
  cardDescription: { fontSize: 14, color: '#EEEEFF', marginTop: 8, lineHeight: 21 },
  primaryButton: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 18 },
  primaryButtonText: { color: '#6366F1', fontWeight: 'bold', fontSize: 15 },
  stopButton: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 18 },
  stopButtonText: { color: '#B91C1C', fontWeight: 'bold', fontSize: 15 },

  sosCard: { backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3', borderRadius: 16, padding: 18, marginBottom: 24 },
  sosCardActive: { backgroundColor: '#BE123C', borderColor: '#9F1239' },
  sosTitle: { fontSize: 19, fontWeight: 'bold', color: '#BE123C' },
  sosTitleActive: { color: '#FFFFFF' },
  sosDescription: { color: '#9F1239', marginTop: 8, fontWeight: '600' },
  sosHint: { color: '#9F1239', fontSize: 12, marginTop: 5 },
  sosTextActive: { color: '#FFE4E6' },

  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#25264A', marginBottom: 12 },
  featureCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2 },
  featureTitle: { fontSize: 16, fontWeight: 'bold', color: '#25264A' },
  featureDescription: { fontSize: 13, color: '#777', marginTop: 6, lineHeight: 19 },
  arrow: { fontSize: 13, color: '#6366F1', fontWeight: 'bold', marginTop: 10 },
});

export default HomeScreen;