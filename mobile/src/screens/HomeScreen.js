
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const HomeScreen = ({ navigation }) => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: logout, style: 'destructive' },
    ]);
  };

  const openFeature = (feature) => {
    if (feature === 'Trusted Contacts') {
      navigation.navigate('TrustedContacts');
    } else {
      Alert.alert(
        feature,
        'This feature is coming soon.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.nameText}>{user?.name || 'User'}</Text>
          <Text style={styles.tagline}>
            Your safety, your priority.
          </Text>
        </View>

        <View style={styles.sessionCard}>
          <Text style={styles.cardTitle}>Safety Session</Text>
          <Text style={styles.cardDescription}>
            Stay prepared and keep your trusted people close.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => openFeature('Safety Session')}
          >
            <Text style={styles.primaryButtonText}>Start Session</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.sosCard}
          onPress={() => openFeature('Emergency SOS')}
        >
          <Text style={styles.sosTitle}>Emergency SOS</Text>
          <Text style={styles.sosDescription}>
            SOS is not active
          </Text>
          <Text style={styles.sosHint}>
            Tap to explore this feature
          </Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Quick Access</Text>

        <TouchableOpacity
          style={styles.featureCard}
          onPress={() => openFeature('Trusted Contacts')}
        >
          <Text style={styles.featureTitle}>Trusted Contacts</Text>
          <Text style={styles.featureDescription}>
            Manage people you trust in an emergency.
          </Text>
          <Text style={styles.arrow}>View Contacts {'>'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.featureCard}
          onPress={() => openFeature('Session History')}
        >
          <Text style={styles.featureTitle}>Session History</Text>
          <Text style={styles.featureDescription}>
            View your previous safety sessions.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.featureCard}
          onPress={() => openFeature('My Profile')}
        >
          <Text style={styles.featureTitle}>My Profile</Text>
          <Text style={styles.featureDescription}>
            Manage your personal details.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.featureCard}
          onPress={() => openFeature('Safety Tips')}
        >
          <Text style={styles.featureTitle}>Safety Tips</Text>
          <Text style={styles.featureDescription}>
            Learn simple ways to stay safe.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  content: {
    padding: 20,
    paddingBottom: 30,
  },
  header: {
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 17,
    color: '#666',
  },
  nameText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#25264A',
    marginTop: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#777',
    marginTop: 8,
  },
  sessionCard: {
    backgroundColor: '#6366F1',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardDescription: {
    fontSize: 14,
    color: '#EEEEFF',
    marginTop: 8,
    lineHeight: 21,
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  primaryButtonText: {
    color: '#6366F1',
    fontWeight: 'bold',
    fontSize: 15,
  },
  sosCard: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  sosTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#BE123C',
  },
  sosDescription: {
    color: '#9F1239',
    marginTop: 8,
    fontWeight: '600',
  },
  sosHint: {
    color: '#9F1239',
    fontSize: 12,
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#25264A',
    marginBottom: 12,
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#25264A',
  },
  featureDescription: {
    fontSize: 13,
    color: '#777',
    marginTop: 6,
    lineHeight: 19,
  },
  arrow: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: 'bold',
    marginTop: 10,
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
