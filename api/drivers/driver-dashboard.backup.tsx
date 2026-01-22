import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, ActivityIndicator } from 'react-native';
import { FontAwesome5, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://temp-weld-rho.vercel.app';

export default function DriverDashboard() {
  const [driverData, setDriverData] = useState<any>(null);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken') || await AsyncStorage.getItem('token');
        const userId = await AsyncStorage.getItem('userId');
        if (token && userId) {
          const response = await fetch(`${API_BASE_URL}/api/drivers/${userId}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
          const data = await response.json();
          if (data.success) {
            setDriverData(data.data);
            setIsActive(data.data?.isActive || false);
          }
        }
      } catch (error) {
        console.error('Failed to load driver dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  const toggleActive = async (value: boolean) => {
    setIsActive(value);
    try {
      const token = await AsyncStorage.getItem('userToken') || await AsyncStorage.getItem('token');
      const userId = await AsyncStorage.getItem('userId');
      const response = await fetch(`${API_BASE_URL}/api/drivers/${userId}/toggle-active`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: value }),
      });
      const data = await response.json();
      if (data.success) {
        setDriverData(data.data);
      }
    } catch (error) {
      console.error('Failed to toggle active status:', error);
      setIsActive(!value);
    }
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <ActivityIndicator size="large" color="#5A0FC8" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#5A0FC8', '#5A0FC8']} style={styles.headerBackground}>
        <View style={styles.topRow}>
          <Image source={require('@/assets/images/logo2.png')} style={styles.logo} />
          <Ionicons name="notifications-outline" size={24} color="white" />
        </View>
        <Text style={styles.welcome}>Welcome {driverData?.userId?.name || 'Driver'}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.heading}>ACTIVE</Text>
          <Switch value={isActive} onValueChange={toggleActive} trackColor={{ false: '#767577', true: '#81C784' }} thumbColor={isActive ? '#4CAF50' : '#f4f3f4'} />
        </View>
      </LinearGradient>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={styles.subheading}>Status</Text>
        <View style={styles.statusCard}>
          <Text style={{ color: isActive ? '#00C853' : '#FF5252', fontWeight: 'bold', fontSize: 16 }}>{ isActive ? 'Ready for Trips' : 'Offline' }</Text>
        </View>
        <Text style={styles.subheading}>Earnings Today</Text>
        <LinearGradient colors={['#5A0FC8', '#5A0FC8']} style={styles.earningCard}>
          <Text style={styles.earningAmountWhite}>R{driverData?.totalEarnings || 0}</Text>
        </LinearGradient>
        <View style={styles.buttonRow}>
          <LinearGradient colors={['#5A0FC8', '#5A0FC8']} style={styles.featureButton}>
            <TouchableOpacity onPress={() => router.push('/driver-wallet')}>
              <MaterialCommunityIcons name="wallet" size={28} color="#fff" />
              <Text style={styles.buttonTextWhite}>Wallet</Text>
            </TouchableOpacity>
          </LinearGradient>
          <LinearGradient colors={['#5A0FC8', '#5A0FC8']} style={styles.featureButton}>
            <TouchableOpacity onPress={() => router.push('/driver-childen')}>
              <Ionicons name="people" size={28} color="#fff" />
              <Text style={styles.buttonTextWhite}>Children</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
        <View style={styles.bottomRow}>
          <TouchableOpacity style={styles.emergencyButton}>
            <Text style={styles.emergencyText}>Emergency SOS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/driver-settings')}>
            <Ionicons name="settings-outline" size={28} color="#5A0FC8" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f6f6' },
  logo: { width: 60, height: 60, resizeMode: 'contain' },
  headerBackground: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  welcome: { fontSize: 16, color: '#fff', marginBottom: 4 },
  heading: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  contentContainer: { padding: 20 },
  subheading: { fontSize: 18, fontWeight: '600', marginBottom: 10, color: '#333' },
  statusCard: { backgroundColor: '#fff', padding: 16, borderRadius: 10, marginBottom: 20 },
  earningCard: { padding: 16, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4, marginBottom: 20 },
  earningAmountWhite: { fontWeight: 'bold', fontSize: 28, color: '#fff' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 20 },
  featureButton: { width: '48%', padding: 16, borderRadius: 10, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  buttonTextWhite: { fontWeight: 'bold', color: '#fff', marginTop: 8 },
  emergencyButton: { backgroundColor: '#FF3B30', padding: 16, borderRadius: 12, alignItems: 'center', flex: 1, marginRight: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  emergencyText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  settingsButton: { backgroundColor: '#fff', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
});
