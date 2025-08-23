import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import theme from '../theme';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Feather from 'react-native-vector-icons/Feather';

const COLORS = [
  '#60A5FA', // blue
  '#A78BFA', // purple
  '#F472B6', // pink
  '#34D399', // green
  '#FBBF24', // yellow
  '#F87171', // red
  '#6366F1', // indigo
  '#F59E42', // orange
];

const NewListScreen = ({ navigation, route }) => {
  const [listName, setListName] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const onColorPick = route?.params?.onColorPick;

  const handleColorPick = (color) => {
    setSelectedColor(color);
    if (onColorPick) onColorPick(color);
  };

  const handleCreate = async () => {
    if (!listName.trim()) {
      Alert.alert('Error', 'Please enter a list name');
      return;
    }
    Keyboard.dismiss();
    setLoading(true);

    try {
      await addDoc(collection(db, 'lists'), {
        name: listName.trim(),
        userId: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
        totalTasks: 0,
        completedTasks: 0,
        color: selectedColor,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to create list');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.closeHeader}>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Feather name="x" size={28} color="#3B82F6" />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Create New List</Text>
          <Text style={styles.subtitle}>Give your list a name to get started</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Icon name="edit" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              placeholder="List Name"
              placeholderTextColor={theme.colors.placeholder}
              value={listName}
              onChangeText={setListName}
              style={styles.input}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
          </View>

          <View style={styles.colorRow}>
            {COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[styles.colorCircle, { backgroundColor: color, borderWidth: selectedColor === color ? 3 : 1, borderColor: selectedColor === color ? theme.colors.text : theme.colors.border }]}
                onPress={() => handleColorPick(color)}
              />
            ))}
          </View>

          <TouchableOpacity 
            style={[styles.button, (!listName.trim() || loading) && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={!listName.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.surface} />
            ) : (
              <Text style={styles.buttonText}>Create List</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  closeHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 16,
    paddingRight: 16,
  },
  closeButton: {
    padding: 50,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  content: {
    flex: 1,
    padding: theme.spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginTop: theme.spacing.m,
    marginBottom: theme.spacing.s,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.m,
    marginBottom: theme.spacing.l,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
  },
  inputIcon: {
    padding: theme.spacing.m,
  },
  input: {
    flex: 1,
    padding: theme.spacing.m,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginHorizontal: 6,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.m,
    borderRadius: theme.radius.m,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    ...theme.shadows.small,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
});

export default NewListScreen;