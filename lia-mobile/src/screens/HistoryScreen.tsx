import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, HistoryDeleteModals, HistoryDoseCard, HistoryProgressRing } from '../components';
import { useAuth } from '../context/AuthContext';
import { useReminders } from '../context/ReminderContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { Space } from '../theme/tokens';
import { getDeviceTimeZone, getLocalDateString } from '../utils/dateTime';
import { HistoryImages } from '../utils/historyAssets';
import {
  formatTodayHeading,
  HistoryPalette,
  isVisibleHistoryStatus,
  progressForDay,
} from '../utils/historyUi';
import { HistoryEntry, HistoryStackParamList } from '../types';
import { getHistory } from '../services/historyApi';

type Props = {
  navigation: NativeStackNavigationProp<HistoryStackParamList, 'HistoryHome'>;
};

export default function HistoryScreen({ navigation }: Props) {
  const { isDemo } = useAuth();
  const { history: contextHistory } = useReminders();
  const insets = useSafeAreaInsets();
  const { scaleFont, scaleSpacing, minTouch } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { horizontalPadding, contentMaxWidth, isSmallPhone } = useResponsive();
  const lightChrome = !isDark && !isHighContrast;

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmEntry, setConfirmEntry] = useState<HistoryEntry | null>(null);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ visible: false, message: '', type: 'error' });

  const requestGen = useRef(0);
  const today = getLocalDateString();

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      const gen = ++requestGen.current;
      if (!options?.silent) setLoading(true);

      if (isDemo) {
        if (gen !== requestGen.current) return;
        setEntries(contextHistory.filter((item) => item.date === today));
        setLoading(false);
        return;
      }

      try {
        const data = await getHistory(today, today, getDeviceTimeZone());
        if (gen !== requestGen.current) return;
        setEntries(data);
      } catch {
        if (gen !== requestGen.current) return;
        if (!options?.silent) {
          setToast({
            visible: true,
            message:
              'No pudimos actualizar tu historial. Revisa tu conexión e inténtalo nuevamente.',
            type: 'error',
          });
        }
      } finally {
        if (gen === requestGen.current) setLoading(false);
      }
    },
    [isDemo, contextHistory, today]
  );

  useFocusEffect(
    useCallback(() => {
      void load({ silent: true });
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const visible = useMemo(
    () =>
      entries
        .filter((item) => isVisibleHistoryStatus(item.status))
        .slice()
        .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor)),
    [entries]
  );
  const todayAll = useMemo(
    () => entries.filter((item) => item.date === today),
    [entries, today]
  );
  const progress = useMemo(() => progressForDay(todayAll), [todayAll]);
  const isEmpty = !loading && visible.length === 0;
  const hasScheduled = progress.total > 0;

  const pageBg = lightChrome ? HistoryPalette.white : colors.background;
  const ink = lightChrome ? HistoryPalette.navyDark : colors.textPrimary;
  const muted = lightChrome ? HistoryPalette.muted : colors.textSecondary;
  const heroBg = lightChrome ? HistoryPalette.pastel : colors.surfaceElevated;
  const ringSize = isSmallPhone ? 100 : 112;
  const actionIcon = isSmallPhone ? 40 : 48;

  const onConfirmDelete = () => {
    setConfirmEntry(null);
    setToast({
      visible: true,
      message: 'No pudimos eliminar el registro. Inténtalo nuevamente.',
      type: 'error',
    });
  };

  const listHeader = (
    <View>
      <AppText
        variant="h1"
        accessibilityRole="header"
        style={{
          color: ink,
          fontSize: scaleFont(26),
          lineHeight: scaleFont(32),
          letterSpacing: -0.2,
          fontWeight: '600',
        }}
      >
        Historial
      </AppText>
      <AppText
        variant="body"
        style={{ color: muted, marginTop: 4, marginBottom: scaleSpacing(Space[16]), flexShrink: 1 }}
      >
        Consulta tus tomas registradas.
      </AppText>

      <View
        style={[
          styles.hero,
          {
            backgroundColor: heroBg,
            borderColor: isHighContrast ? colors.border : 'transparent',
            borderWidth: isHighContrast ? 2 : 0,
            padding: scaleSpacing(Space[16]),
            marginBottom: scaleSpacing(Space[16]),
            shadowOpacity: lightChrome ? 0.06 : 0,
            elevation: lightChrome ? 2 : 0,
          },
        ]}
      >
        <View style={styles.heroRow}>
          <View style={styles.heroArt}>
            <Image
              source={HistoryImages.olderWoman}
              style={styles.heroImg}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              accessible
              accessibilityLabel="Ilustración de una señora adulta mayor"
            />
          </View>
          <View style={styles.heroCopy}>
            <AppText
              variant="body"
              style={{ color: ink, fontWeight: '600', marginBottom: 10, textAlign: 'center', flexShrink: 1 }}
            >
              Tu progreso de hoy
            </AppText>
            {hasScheduled ? (
              <>
                <HistoryProgressRing
                  progress={(progress.percent ?? 0) / 100}
                  size={ringSize}
                  thickness={9}
                  color={lightChrome ? HistoryPalette.navy : colors.primary}
                  trackColor={lightChrome ? '#D4E6EF' : colors.border}
                  holeColor={heroBg}
                >
                  <AppText
                    variant="h2"
                    style={{ color: ink, fontWeight: '700', fontSize: scaleFont(22) }}
                  >
                    {`${progress.percent} %`}
                  </AppText>
                </HistoryProgressRing>
                <AppText
                  variant="body"
                  style={{ color: ink, fontWeight: '600', marginTop: 10, flexShrink: 1, textAlign: 'center' }}
                >
                  {`${progress.registered} de ${progress.total} tomas`}
                </AppText>
              </>
            ) : (
              <AppText
                variant="body"
                style={{ color: muted, textAlign: 'center', flexShrink: 1, paddingHorizontal: 4 }}
              >
                No tienes tomas registradas para hoy
              </AppText>
            )}
          </View>
        </View>
      </View>

      <View style={[styles.actions, { marginBottom: scaleSpacing(Space[24]), gap: scaleSpacing(Space[12]) }]}>
        <Pressable
          onPress={() => navigation.navigate('HistoryAnalysis')}
          accessibilityRole="button"
          accessibilityLabel="Ver análisis"
          style={({ pressed }) => [
            styles.actionCard,
            {
              backgroundColor: lightChrome ? HistoryPalette.white : colors.surface,
              minHeight: Math.max(minTouch + 12, 72),
              borderColor: isHighContrast ? colors.border : 'transparent',
              borderWidth: isHighContrast ? 2 : 0,
              shadowOpacity: lightChrome ? 0.06 : 0,
              elevation: lightChrome ? 2 : 0,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <AppText
            variant="body"
            style={{ color: ink, fontWeight: '600', flex: 1, flexShrink: 1 }}
            numberOfLines={2}
          >
            Ver análisis
          </AppText>
          <Image
            source={HistoryImages.analysis}
            style={{ width: actionIcon, height: actionIcon }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('HistoryCalendar')}
          accessibilityRole="button"
          accessibilityLabel="Calendario"
          style={({ pressed }) => [
            styles.actionCard,
            {
              backgroundColor: lightChrome ? HistoryPalette.white : colors.surface,
              minHeight: Math.max(minTouch + 12, 72),
              borderColor: isHighContrast ? colors.border : 'transparent',
              borderWidth: isHighContrast ? 2 : 0,
              shadowOpacity: lightChrome ? 0.06 : 0,
              elevation: lightChrome ? 2 : 0,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <AppText
            variant="body"
            style={{ color: ink, fontWeight: '600', flex: 1, flexShrink: 1 }}
            numberOfLines={2}
          >
            Calendario
          </AppText>
          <Image
            source={HistoryImages.calendar}
            style={{ width: actionIcon, height: actionIcon }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </Pressable>
      </View>

      <AppText
        variant="h3"
        style={{
          color: ink,
          fontWeight: '600',
          marginBottom: scaleSpacing(Space[12]),
        }}
      >
        {formatTodayHeading(today)}
      </AppText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      {loading && entries.length === 0 ? (
        <>
          <View
            style={{
              paddingTop: insets.top + scaleSpacing(Space[8]),
              paddingHorizontal: horizontalPadding,
            }}
          >
            {listHeader}
          </View>
          <View style={styles.loadingWrap} accessibilityLabel="Preparando tu historial">
            <ActivityIndicator size="large" color={colors.primary} />
            <AppText variant="body" tone="secondary" style={{ marginTop: scaleSpacing(Space[16]) }}>
              Preparando tu historial…
            </AppText>
          </View>
        </>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <HistoryDoseCard item={item} onDelete={setConfirmEntry} />
          )}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            isEmpty ? (
              <View
                accessible
                accessibilityRole="text"
                accessibilityLabel="Aún no hay registros. Cuando registres una toma, podrás consultarla aquí."
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: lightChrome ? HistoryPalette.white : colors.surface,
                    padding: scaleSpacing(Space[20]),
                    shadowOpacity: lightChrome ? 0.05 : 0,
                    elevation: lightChrome ? 1 : 0,
                  },
                ]}
              >
                <AppText variant="h3" style={{ color: ink, fontWeight: '600' }}>
                  Aún no hay registros
                </AppText>
                <AppText variant="body" style={{ color: muted, marginTop: 8, flexShrink: 1 }}>
                  Cuando registres una toma, podrás consultarla aquí.
                </AppText>
              </View>
            ) : null
          }
          contentContainerStyle={{
            paddingTop: insets.top + scaleSpacing(Space[8]),
            paddingHorizontal: horizontalPadding,
            paddingBottom: scaleSpacing(Space[40]),
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            width: '100%',
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      )}

      <HistoryDeleteModals
        confirmEntry={confirmEntry}
        toast={toast}
        onConfirm={onConfirmDelete}
        onCancel={() => setConfirmEntry(null)}
        onHideToast={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  hero: {
    width: '100%',
    borderRadius: 24,
    shadowColor: '#245C86',
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroArt: {
    flex: 0.44,
    minWidth: 108,
    maxWidth: 160,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  heroImg: {
    width: '100%',
    height: 168,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'stretch',
  },
  actionCard: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#245C86',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  emptyCard: {
    width: '100%',
    borderRadius: 22,
    shadowColor: '#245C86',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
});
