import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Feather from 'react-native-vector-icons/Feather';
import { Swipeable } from 'react-native-gesture-handler';
import { useIsFocused } from '@react-navigation/native';
import theme from '../theme';

const TaskListScreen = ({ route, navigation }) => {
  const { listId, listName, color: navColor } = route.params || {};
  const [taskText, setTaskText] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listData, setListData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();

  // Always use the color from navigation params if present, else fallback to Firestore color, else theme primary
  const headerColor = listData?.color || navColor || theme.colors.primary;

  useEffect(() => {
    if (!isFocused || !listId || !auth.currentUser?.uid) return;

    const loadData = async () => {
      try {
        const listRef = doc(db, 'lists', listId);
        const listSnap = await getDoc(listRef);
        if (!listSnap.exists() || listSnap.data().userId !== auth.currentUser.uid) {
          Alert.alert('Error', 'List not found or access denied');
          navigation.goBack();
          return;
        }
        const data = listSnap.data();
        setListData({
          ...data,
          completedTasks: Math.max(0, Number(data.completedTasks) || 0),
          totalTasks: Math.max(0, Number(data.totalTasks) || 0),
          color: data.color || navColor || theme.colors.primary,
        });
      } catch (error) {
        console.error('Error loading list:', error);
        Alert.alert('Error', 'Failed to load list');
      }
    };

    loadData();

    const q = query(
      collection(db, 'tasks'),
      where('listId', '==', listId),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt')
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const tasksData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTasks(tasksData);
        setLoading(false);
      },
      (error) => {
        console.error('Firestore error:', error);
        setLoading(false);
        Alert.alert('Error', 'Failed to load tasks');
      }
    );

    return () => unsubscribe();
  }, [isFocused, listId]);

  const handleAddTask = async () => {
    if (!taskText.trim()) {
      Alert.alert('Error', 'Task cannot be empty');
      return;
    }
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const taskRef = doc(collection(db, 'tasks'));
      batch.set(taskRef, {
        text: taskText.trim(),
        completed: false,
        listId,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      const listRef = doc(db, 'lists', listId);
      batch.update(listRef, {
        totalTasks: (listData?.totalTasks || 0) + 1,
        updatedAt: serverTimestamp()
      });
      await batch.commit();
      setTaskText('');
    } catch (error) {
      console.error('Error adding task:', error);
      Alert.alert('Error', 'Failed to add task');
    } finally {
      setLoading(false);
    }
  };

  const toggleCompletion = async (taskId, currentlyCompleted) => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const taskRef = doc(db, 'tasks', taskId);
      batch.update(taskRef, {
        completed: !currentlyCompleted,
        updatedAt: serverTimestamp()
      });
      const listRef = doc(db, 'lists', listId);
      const listSnap = await getDoc(listRef);
      const currentCompleted = Math.max(0, Number(listSnap.data()?.completedTasks) || 0 );
      const change = currentlyCompleted ? -1 : 1;
      batch.update(listRef, {
        completedTasks: currentCompleted + change,
        updatedAt: serverTimestamp()
      });
      await batch.commit();
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId, isCompleted) => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'tasks', taskId));
      const listRef = doc(db, 'lists', listId);
      const updates = {
        totalTasks: Math.max(0, (listData?.totalTasks || 0) - 1),
        updatedAt: serverTimestamp()
      };
      if (isCompleted) {
        updates.completedTasks = Math.max(0, (listData?.completedTasks || 0) - 1);
      }
      batch.update(listRef, updates);
      await batch.commit();
    } catch (error) {
      console.error('Error deleting task:', error);
      Alert.alert('Error', 'Failed to delete task');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <Swipeable
      renderRightActions={() => (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteTask(item.id, item.completed)}
          disabled={loading}
        >
          <Icon name="delete" size={24} color={theme.colors.surface} />
        </TouchableOpacity>
      )}
    >
      <View style={styles.taskRow}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => toggleCompletion(item.id, item.completed)}
          disabled={loading}
        >
          <Icon
            name={item.completed ? 'check-box' : 'check-box-outline-blank'}
            size={24}
            color={item.completed ? headerColor : theme.colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.taskText, item.completed ? styles.completedText : styles.activeText]}>
          {item.text}
        </Text>
      </View>
    </Swipeable>
  );

  if (loading && tasks.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={headerColor} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }} />
          <View style={{ flex: 8 }}>
            <Text style={styles.title}>{listName}</Text>
            <Text style={styles.subtitle}>
              {tasks.filter(t => t.completed).length} of {tasks.length} tasks
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="x" size={28} color="#000" />
          </TouchableOpacity>
        </View>
        <View style={[styles.underline, { backgroundColor: headerColor }]} />
      </View>
      <FlatList
        data={tasks}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tasks yet</Text>
            <Text style={styles.emptySubtext}>Add your first task to get started</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 1000);
            }}
            colors={[headerColor]}
          />
        }
      />
      <View style={styles.inputRow}>
        <TextInput
          placeholder="Add Todo"
          placeholderTextColor={theme.colors.placeholder}
          value={taskText}
          onChangeText={setTaskText}
          style={styles.input}
          onSubmitEditing={handleAddTask}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: headerColor }, (!taskText.trim() || loading) && styles.buttonDisabled]}
          onPress={handleAddTask}
          disabled={!taskText.trim() || loading}
        >
          <Icon name="add" size={24} color={theme.colors.surface} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  headerSection: {
    paddingTop: 48,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  closeButton: {
    padding: 30,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'left',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'left',
    marginBottom: 8,
  },
  underline: {
    height: 3,
    borderRadius: 2,
    width: '100%',
    marginTop: 2,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderRadius: 8,
    marginBottom: 4,
  },
  checkbox: {
    marginRight: 12,
  },
  taskText: {
    fontSize: 16,
    flex: 1,
    textAlign: 'left',
  },
  activeText: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  completedText: {
    color: theme.colors.textSecondary,
    textDecorationLine: 'line-through',
    opacity: 0.7,
    fontWeight: '400',
  },
  deleteButton: {
    backgroundColor: theme.colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    alignSelf: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
    backgroundColor: theme.colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.m,
    borderRadius: theme.radius.m,
    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: theme.spacing.xxl,
  },
  emptyText: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginTop: theme.spacing.m,
    textAlign: 'center',
  },
  emptySubtext: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.s,
    textAlign: 'center',
  },
});

export default TaskListScreen;