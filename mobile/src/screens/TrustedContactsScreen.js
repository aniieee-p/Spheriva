import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { contactsService } from '../services/contacts.service';
import { validateName, validatePhone } from '../utils/validation';

const MAX_CONTACTS = 3;

const TrustedContactsScreen = () => {
  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const limitReached = contacts.length >= MAX_CONTACTS && !editingId;

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await contactsService.getContacts();
      setContacts(data);
    } catch (error) {
      Alert.alert('Error', 'Could not load contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setErrors({});
    setEditingId(null);
  };

  const handleSave = async () => {
    const newErrors = {
      name: validateName(name),
      phone: validatePhone(phone),
    };
    setErrors(newErrors);
    if (newErrors.name || newErrors.phone) return;

    const payload = { name: name.trim(), phone: phone.trim() };

    const duplicate = contacts.some(
      (c) => c.phone === payload.phone && c.id !== editingId
    );
    if (duplicate) {
      setErrors({ phone: 'This number is already in your contacts' });
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        const updated = await contactsService.updateContact(editingId, payload);
        setContacts((prev) =>
          prev.map((c) => (c.id === editingId ? updated : c))
        );
      } else {
        const created = await contactsService.addContact(payload);
        setContacts((prev) => [...prev, created]);
      }
      resetForm();
    } catch (error) {
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Could not save contact.'
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (contact) => {
    setEditingId(contact.id);
    setName(contact.name);
    setPhone(contact.phone);
    setErrors({});
  };

  const confirmDelete = (contact) => {
    Alert.alert('Remove Contact', `Remove ${contact.name} from trusted contacts?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await contactsService.deleteContact(contact.id);
            setContacts((prev) => prev.filter((c) => c.id !== contact.id));
            if (editingId === contact.id) resetForm();
          } catch (error) {
            Alert.alert('Error', 'Could not remove contact.');
          }
        },
      },
    ]);
  };

  const renderContact = ({ item }) => (
    <View style={styles.contactCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.phoneText}>{item.phone}</Text>
      </View>

      <TouchableOpacity onPress={() => startEdit(item)} style={styles.actionButton}>
        <Text style={styles.editText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.actionButton}>
        <Text style={styles.removeText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={renderContact}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <Text style={styles.heading}>Trusted Contacts</Text>
            <Text style={styles.subtitle}>
              Add up to {MAX_CONTACTS} people you trust for emergencies.
            </Text>

            {limitReached ? (
              <View style={styles.limitCard}>
                <Text style={styles.limitText}>
                  You have added the maximum of {MAX_CONTACTS} contacts. Remove
                  one to add a new contact.
                </Text>
              </View>
            ) : (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>
                  {editingId ? 'Edit Contact' : 'Add Contact'}
                </Text>

                <Text style={styles.label}>Contact Name</Text>
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  placeholder="Enter full name"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (errors.name) setErrors({ ...errors, name: '' });
                  }}
                />
                {!!errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={[styles.input, errors.phone && styles.inputError]}
                  placeholder="10-digit number"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    if (errors.phone) setErrors({ ...errors, phone: '' });
                  }}
                />
                {!!errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.addButtonText}>
                      {editingId ? 'Save Changes' : '+ Add Contact'}
                    </Text>
                  )}
                </TouchableOpacity>

                {editingId && (
                  <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <Text style={styles.sectionTitle}>
              Your Contacts ({contacts.length}/{MAX_CONTACTS})
            </Text>
          </>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No contacts added yet.</Text>
        }
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6FA' },
  listContent: { padding: 20, flexGrow: 1 },
  heading: { fontSize: 27, fontWeight: 'bold', color: '#25264A' },
  subtitle: { fontSize: 14, color: '#777', marginTop: 6, marginBottom: 22 },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 25, elevation: 2 },
  formTitle: { fontSize: 17, fontWeight: 'bold', color: '#25264A', marginBottom: 14 },
  limitCard: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 14, marginBottom: 25 },
  limitText: { color: '#92400E', fontSize: 13, lineHeight: 19 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E1E3ED', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: '#222', marginBottom: 16 },
  inputError: { borderColor: '#EF4444' },
  errorText: { color: '#EF4444', fontSize: 13, marginTop: -10, marginBottom: 12 },
  addButton: { backgroundColor: '#6366F1', borderRadius: 10, padding: 14, alignItems: 'center' },
  addButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  cancelButton: { padding: 12, alignItems: 'center', marginTop: 6 },
  cancelText: { color: '#666', fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#25264A', marginBottom: 12 },
  contactCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E8E9FF', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#6366F1' },
  contactInfo: { flex: 1, marginLeft: 12 },
  contactName: { fontSize: 15, fontWeight: 'bold', color: '#25264A' },
  phoneText: { fontSize: 13, color: '#777', marginTop: 4 },
  actionButton: { paddingHorizontal: 8, paddingVertical: 4 },
  editText: { color: '#6366F1', fontSize: 12, fontWeight: '600' },
  removeText: { color: '#DC2626', fontSize: 12, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 12 },
});

export default TrustedContactsScreen;