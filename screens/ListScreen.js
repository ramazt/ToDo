import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
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
  getDocs
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Swipeable } from 'react-native-gesture-handler';
import theme from '../theme';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const DEFAULT_ADD_COLOR = theme.colors.primary;
const CARD_WIDTH = SCREEN_WIDTH * 0.5;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.22;

const ListScreen = ({ navigation }) => {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [addButtonColor, setAddButtonColor] = useState(DEFAULT_ADD_COLOR);
  const nav = useNavigation();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      nav.replace('Login');
    } catch (error) {
      Alert.alert('Logout Failed', error.message);
    }
  };

  useLayoutEffect(() => {
    nav.setOptions({ headerShown: false });
  }, [nav]);

  const loadLists = () => {
    if (!auth.currentUser?.uid) {
      console.warn('No authenticated user');
      return;
    }

    const q = query(
      collection(db, 'lists'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt')
    );

    const unsubscribe = onSnapshot(q, 
      async (snapshot) => {
        const listData = await Promise.all(snapshot.docs.map(async (doc) => {
          const list = doc.data();
          // Get tasks for this list
          const tasksQuery = query(
            collection(db, 'tasks'),
            where('listId', '==', doc.id),
            where('userId', '==', auth.currentUser.uid)
          );
          const tasksSnapshot = await getDocs(tasksQuery);
          const tasks = tasksSnapshot.docs.map(task => task.data());
          return {
            id: doc.id,
            ...list,
            totalTasks: tasks.length,
            completedTasks: tasks.filter(task => task.completed).length
          };
        }));
        setLists(listData);
      },
      (error) => {
        Alert.alert('Error', 'Failed to load lists');
        console.error('Firestore error:', error);
      }
    );
    return unsubscribe;
  };

  useEffect(() => {
    const unsubscribe = loadLists();
    return () => unsubscribe();
  }, []);

  const handleDeleteList = async (listId) => {
    setDeletingId(listId);
    setLoading(true);
    try {
      const listRef = doc(db, 'lists', listId);
      const listSnap = await getDoc(listRef);
      if (!listSnap.exists()) {
        throw new Error("List doesn't exist");
      }
      const listData = listSnap.data();
      if (listData.userId !== auth.currentUser?.uid) {
        throw new Error("You don't own this list");
      }
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('listId', '==', listId),
        where('userId', '==', auth.currentUser.uid)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const batch = writeBatch(db);
      tasksSnapshot.forEach(taskDoc => {
        batch.delete(taskDoc.ref);
      });
      batch.delete(listRef);
      await batch.commit();
      Alert.alert('Success', 'List and tasks deleted');
    } catch (error) {
      Alert.alert('Error', error.message);
      console.error('Delete error:', error);
    } finally {
      setLoading(false);
      setDeletingId(null);
    }
  };

  const renderRightActions = (listId) => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => handleDeleteList(listId)}
      disabled={loading}
    >
      <Icon name="delete" size={24} color={theme.colors.surface} />
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => (
    <Swipeable renderRightActions={() => renderRightActions(item.id)}>
      <TouchableOpacity
        style={[styles.listCard, { backgroundColor: item.color || theme.colors.primary }]}
        onPress={() => navigation.navigate('TaskList', {
          listId: item.id,
          listName: item.name,
          color: item.color,
        })}
        activeOpacity={0.85}
      >
        <Text style={styles.listTitle}>{item.name}</Text>
        <View style={styles.countsRow}>
          <View style={styles.countBlock}>
            <Text style={styles.countNumber}>{item.totalTasks - item.completedTasks}</Text>
            <Text style={styles.countLabel}>Remaining</Text>
          </View>
          <View style={styles.countBlock}>
            <Text style={styles.countNumber}>{item.completedTasks}</Text>
            <Text style={styles.countLabel}>Completed</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );

  const handleNewList = (color) => {
    if (color) setAddButtonColor(color);
    navigation.navigate('NewList', { onColorPick: setAddButtonColor });
  };

  // Show confirmation before logging out
  const handleProfilePress = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: handleLogout },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.profileButton}
        onPress={handleProfilePress}
        activeOpacity={0.7}
      >
        <Icon name="person" size={32} color={theme.colors.primary} />
      </TouchableOpacity>
      <View style={styles.centerSection}>
        <View style={styles.headerRowOuter}>
          <View style={styles.line} />
          <Text style={styles.headerTitle}>
            <Text style={styles.headerBold}>Todo</Text> <Text style={styles.headerBlue}>Lists</Text>
          </Text>
          <View style={styles.line} />
        </View>
        <TouchableOpacity
          style={styles.addListButton}
          onPress={() => navigation.navigate('NewList', { onColorPick: setAddButtonColor })}
          activeOpacity={0.8}
        >
          <Icon name="add" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.addListText}>Add List</Text>
      </View>
      <FlatList
        data={lists}
        renderItem={({ item }) => (
          <View style={[styles.listCard, { backgroundColor: item.color }]}> 
            <TouchableOpacity
              style={styles.deleteIcon}
              onPress={() => handleDeleteList(item.id)}
              activeOpacity={0.7}
            >
              <Icon name="delete" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
              onPress={() => navigation.navigate('TaskList', {
                listId: item.id,
                listName: item.name,
                color: item.color,
              })}
              activeOpacity={0.85}
            >
              <Text style={styles.listTitle}>{item.name}</Text>
              <View style={styles.countsRow}>
                <View style={styles.countBlock}>
                  <Text style={styles.countNumber}>{item.totalTasks - item.completedTasks}</Text>
                  <Text style={styles.countLabel}>Remaining</Text>
                </View>
                <View style={styles.countBlock}>
                  <Text style={styles.countNumber}>{item.completedTasks}</Text>
                  <Text style={styles.countLabel}>Completed</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listsContainer}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToAlignment="center"
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + 32}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No lists yet</Text>
            <Text style={styles.emptySubtext}>Add your first list to get started</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadLists();
              setRefreshing(false);
            }}
            colors={[theme.colors.primary]}
          />
        }
        style={styles.flexList}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
    marginBottom: 24,
  },
  headerRowOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    marginHorizontal: 8,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 8,
    marginTop: 200,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '400',
    marginTop: 200,
    textAlign: 'center',
  },
  headerBold: {
    fontWeight: '700',
    color: theme.colors.text,
  },
  headerBlue: {
    color: theme.colors.primary,
    fontWeight: '400',
  },
  addListButton: {
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    marginTop: 20,
    backgroundColor: 'transparent',
  },
  addListText: {
    textAlign: 'center',
    color: theme.colors.primary,
    fontWeight: '500',
    fontSize: 16,
    marginBottom: 24,
  },
  flexList: {
    flex: 1,
  },
  listsContainer: {
    paddingHorizontal: 12,
    paddingBottom: 32,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  listCard: {
    width: CARD_WIDTH,
    marginHorizontal: 8,
    borderRadius: 16,
    minHeight: CARD_HEIGHT,
    maxHeight: CARD_HEIGHT,
    padding: 20,
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    alignItems: 'center',
    position: 'relative',
  },
  listTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 20,
    marginTop: 10,
    marginBottom: 50,
    textAlign: 'center',
  },
  countsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  countBlock: {
    alignItems: 'center',
    flex: 1,
  },
  countNumber: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  countLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.85,
    textAlign: 'center',
  },
  deleteButton: {
    backgroundColor: theme.colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 56,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    height: '100%',
    alignSelf: 'center',
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
  deleteIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 16,
    padding: 4,
  },
  profileButton: {
    position: 'absolute',
    top: 40,
    right: 30,
    zIndex: 10,
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: 32,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ListScreen;