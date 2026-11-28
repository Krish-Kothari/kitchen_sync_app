import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { catalogApi, poolApi } from '../services/api';
import {
  ErrorBanner,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  StatusBadge,
} from '../components/UIKit';
import { COLORS, RADIUS } from '../theme/colors';

const CUTOFF_OPTIONS = [2, 4, 6];

export default function CatalogScreen({ navigation }) {
  const [commodities, setCommodities] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [selectedItem, setSelectedItem] = useState(null);
  const [seedWeight, setSeedWeight] = useState('15');
  const [cutoffHours, setCutoffHours] = useState(4);
  const [seeding, setSeeding] = useState(false);

  const loadCatalog = useCallback(
    async ({ isRefresh = false } = {}) => {
      setError('');
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const data = await catalogApi.list({
          category: selectedCategory,
          search: search.trim() || undefined,
          radiusMeters: 3000,
        });
        setCommodities(data.commodities || []);
        if (data.categories && data.categories.length > 1) {
          setCategories(data.categories);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedCategory, search]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCatalog();
    }, 220);
    return () => clearTimeout(timer);
  }, [loadCatalog]);

  function openSeedModal(commodity) {
    setSelectedItem(commodity);
    setSeedWeight(String(Math.min(15, commodity.baseMoqWeight)));
    setCutoffHours(4);
  }

  async function handleCreateSeedPool() {
    if (!selectedItem) return;
    const qty = Number(seedWeight);
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Enter a weight greater than 0.');
      return;
    }

    try {
      setSeeding(true);
      const idempotencyKey = `seed_${selectedItem.id}_${Date.now()}`;
      await poolApi.seedPool(
        {
          commodityId: selectedItem.id,
          quantityWeight: qty,
          cutoffHours,
          radiusMeters: 3000,
        },
        idempotencyKey
      );
      setSelectedItem(null);
      Alert.alert(
        '3 km Pool Opened',
        `Your ${qty} ${selectedItem.unit} order for ${selectedItem.name} is now live for nearby kitchens to join.`
      );
      loadCatalog({ isRefresh: true });
    } catch (err) {
      Alert.alert('Could Not Start Pool', err.message);
    } finally {
      setSeeding(false);
    }
  }

  function renderCommodityCard({ item }) {
    return (
      <SectionCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleBlock}>
            <Text style={styles.categoryLabel}>{item.category.toUpperCase()}</Text>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.wholesalerText}>
              {item.wholesaler?.businessName} • Rating {item.wholesaler?.rating}
            </Text>
          </View>
          <StatusBadge label={`Save up to ${item.maxSavingsPercent}%`} variant="success" />
        </View>

        <View style={styles.priceRow}>
          <View>
            <Text style={styles.metaLabel}>Local Retail</Text>
            <Text style={styles.retailStrike}>
              ₹{item.retailPrice}/{item.unit}
            </Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Best Mandi Tier</Text>
            <Text style={styles.mandiPrice}>
              ₹{item.lowestWholesalePrice}/{item.unit}
            </Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Base MOQ</Text>
            <Text style={styles.moqText}>
              {item.baseMoqWeight} {item.unit}
            </Text>
          </View>
        </View>

        <View style={styles.tiersWrap}>
          {(item.tiers || []).map((tier) => (
            <View key={tier.id} style={styles.tierPill}>
              <Text style={styles.tierName}>{tier.tierName}</Text>
              <Text style={styles.tierValue}>
                {tier.minWeight} {item.unit}+ → ₹{tier.unitPrice}/{item.unit}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.cardFooter}>
          {item.nearbyOpenPoolsCount > 0 ? (
            <StatusBadge
              label={`${item.nearbyOpenPoolsCount} active pool within 3 km`}
              variant="info"
            />
          ) : (
            <Text style={styles.noPoolText}>No active pool within 3 km yet</Text>
          )}
        </View>

        <View style={styles.actionsRow}>
          {item.nearbyOpenPoolsCount > 0 ? (
            <SecondaryButton
              title="View on 3 km Map"
              onPress={() => navigation.navigate('PoolMap')}
              style={styles.halfBtn}
            />
          ) : null}
          <PrimaryButton
            title="Start New Pool"
            onPress={() => openSeedModal(item)}
            style={item.nearbyOpenPoolsCount > 0 ? styles.halfBtn : styles.fullBtn}
          />
        </View>
      </SectionCard>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.controls}>
        <TextInput
          placeholder="Search onions, oil, rice, paneer..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ErrorBanner message={error} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading mandi catalog...</Text>
        </View>
      ) : (
        <FlatList
          data={commodities}
          keyExtractor={(item) => item.id}
          renderItem={renderCommodityCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadCatalog({ isRefresh: true })}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No wholesale commodities match your filter.</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={Boolean(selectedItem)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Start 3 km Wholesale Pool</Text>
            <Text style={styles.modalSub}>{selectedItem?.name}</Text>

            <Text style={styles.inputLabel}>
              Your Initial Order ({selectedItem?.unit})
            </Text>
            <TextInput
              keyboardType="numeric"
              value={seedWeight}
              onChangeText={setSeedWeight}
              style={styles.modalInput}
            />

            <Text style={styles.inputLabel}>Cutoff Window</Text>
            <View style={styles.cutoffRow}>
              {CUTOFF_OPTIONS.map((hrs) => {
                const active = cutoffHours === hrs;
                return (
                  <TouchableOpacity
                    key={hrs}
                    onPress={() => setCutoffHours(hrs)}
                    style={[styles.cutoffPill, active && styles.cutoffPillActive]}
                  >
                    <Text style={[styles.cutoffText, active && styles.cutoffTextActive]}>
                      {hrs} hrs
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setSelectedItem(null)}
                style={styles.halfBtn}
              />
              <PrimaryButton
                title="Open Pool"
                onPress={handleCreateSeedPool}
                loading={seeding}
                style={styles.halfBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  controls: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  chipsRow: { paddingTop: 10, paddingBottom: 4, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF' },
  listContent: { padding: 16, paddingBottom: 32 },
  card: { marginBottom: 14 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleBlock: { flex: 1, marginRight: 10 },
  categoryLabel: { fontSize: 11, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.6 },
  itemName: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2 },
  wholesalerText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 12,
  },
  metaLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 },
  retailStrike: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  mandiPrice: { fontSize: 16, fontWeight: '800', color: COLORS.primaryDark },
  moqText: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  tiersWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tierPill: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tierName: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  tierValue: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  cardFooter: { marginBottom: 12 },
  noPoolText: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  halfBtn: { flex: 1 },
  fullBtn: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 10, color: COLORS.textSecondary, fontWeight: '600' },
  emptyText: { color: COLORS.textSecondary, fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  modalSub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 14 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 14,
  },
  cutoffRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  cutoffPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cutoffPillActive: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  cutoffText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  cutoffTextActive: { color: COLORS.primaryDark },
  modalActions: { flexDirection: 'row', gap: 10 },
});
