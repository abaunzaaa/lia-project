import React, { useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, MainTabParamList } from '../types';
import {
  AppText,
  Button,
  EditorialText,
  EmptyState,
  Screen,
  SpeakButton,
  SurfaceCard,
  Toast,
} from '../components';
import { useAuth } from '../context/AuthContext';
import { useMedications } from '../context/MedicationContext';
import { useReminders } from '../context/ReminderContext';
import { useCameraRecognition } from '../context/CameraRecognitionContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors, brandInk, brandAccent } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import { getGreeting, normalizeMedicationName } from '../utils/helpers';
import { formatTimeForDisplay } from '../utils/dateTime';
import { buildNextDoseSpeech } from '../utils/speechPhrases';

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type Props = { navigation: HomeNavProp };

const VISIBLE_MEDS = 3;

const profilePhotoStorageKey = (uid: string) =>
  `lia_profile_photo_${uid}`;

export default function HomeScreen({ navigation }: Props) {
  const { user, isDemo } = useAuth();
  const { medications, loading: medsLoading } = useMedications();
  const { nextDoseGroup, todayReminders, homeLoading, refreshHome } = useReminders();
  const { pendingResult, clearPendingResult } = useCameraRecognition();
  const { scaleSpacing, minTouch, scaleFont, isSeniorMode } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { compact } = useResponsive();
  const [toast, setToast] = React.useState({ visible: false, message: '', type: 'error' as const });
  const [profileImage, setProfileImage] = React.useState<string | null>(null);

  const firstName = user?.fullName?.split(' ')[0] || 'Amigo';
  const hasMeds = medications.length > 0;

  useFocusEffect(
    useCallback(() => {
      void refreshHome();

      if (!user?.uid) {
        setProfileImage(null);
        return;
      }

      const uid = user.uid;
      void (async () => {
        try {
          const stored = await AsyncStorage.getItem(profilePhotoStorageKey(uid));
          setProfileImage(stored);
        } catch {
          setProfileImage(null);
        }
      })();
    }, [refreshHome, user?.uid])
  );

  const goToReminders = useCallback(() => {
    navigation.navigate('Reminders');
  }, [navigation]);

  const goToProfile = useCallback(() => {
    navigation.navigate('Profile');
  }, [navigation]);

  const missedCount = useMemo(
    () => todayReminders.filter((r) => r.status === 'missed').length,
    [todayReminders]
  );

  const visibleItems = nextDoseGroup
    ? nextDoseGroup.items.slice(0, VISIBLE_MEDS)
    : [];
  const hiddenCount = nextDoseGroup
    ? Math.max(0, nextDoseGroup.items.length - VISIBLE_MEDS)
    : 0;

  const showBootstrapLoading = (medsLoading || homeLoading) && !hasMeds && !isDemo;
  const showNextDoseLoading = hasMeds && homeLoading && !isDemo && todayReminders.length === 0;

  const handleAddRecognized = () => {
    if (!pendingResult?.name) return;
    const nameNorm = normalizeMedicationName(pendingResult.name);
    const exists = medications.some(
      (m) => normalizeMedicationName(m.name) === nameNorm
    );
    if (exists) {
      setToast({
        visible: true,
        message: 'Este medicamento ya está registrado.',
        type: 'error',
      });
      return;
    }
    const name = pendingResult.name;
    clearPendingResult();
    navigation.navigate('AddMedication', { prefilled: { name } });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {!isHighContrast && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View
            style={[
              styles.arc,
              {
                borderColor: BrandColors.skyBlue,
                opacity: isDark ? 0.2 : 0.45,
              },
            ]}
          />
        </View>
      )}

      <Screen scroll safeTop>
        <View style={[styles.headerRow, { marginBottom: scaleSpacing(compact ? Space[20] : Space[32]) }]}>
          <View style={styles.greetingBlock}>
            <EditorialText
              variant="subhead"
              accessibilityRole="header"
              style={{
                fontSize: scaleFont(compact ? 26 : 30),
                lineHeight: scaleFont(compact ? 32 : 36),
              }}
            >
              {getGreeting()}, {firstName}
            </EditorialText>
            <AppText
              variant="body"
              tone="secondary"
              style={{ marginTop: scaleSpacing(Space[8]), maxWidth: 340 }}
            >
              Hoy te acompañaré con tus medicamentos
            </AppText>
          </View>
          <Pressable
            onPress={goToProfile}
            accessibilityRole="button"
            accessibilityLabel={`Perfil de ${firstName}`}
            accessibilityHint="Abre tu perfil"
            hitSlop={8}
            style={({ pressed }) => [
              styles.avatar,
              {
                backgroundColor: isHighContrast ? colors.surface : BrandColors.navy,
                borderWidth: isHighContrast ? 2 : 0,
                borderColor: colors.border,
                minWidth: Math.max(48, minTouch),
                minHeight: Math.max(48, minTouch),
                width: Math.max(48, minTouch),
                height: Math.max(48, minTouch),
                borderRadius: Math.max(48, minTouch) / 2,
                overflow: 'hidden',
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.avatarImage}
                onError={() => setProfileImage(null)}
              />
            ) : (
              <AppText variant="h3" style={{ color: isHighContrast ? colors.textPrimary : BrandColors.white }}>
                {firstName.charAt(0).toUpperCase()}
              </AppText>
            )}
          </Pressable>
        </View>

        {pendingResult ? (
          <SurfaceCard
            variant="emphasis"
            style={{
              marginBottom: scaleSpacing(Space[20]),
              backgroundColor: isHighContrast
                ? colors.surface
                : isDark
                  ? colors.surfaceElevated
                  : BrandColors.beige,
              borderColor: isHighContrast ? colors.border : BrandColors.skyBlue,
              borderWidth: isHighContrast ? 2 : 1,
            }}
          >
            <AppText
              variant="overline"
              style={{
                color: isHighContrast ? colors.textSecondary : brandAccent(isDark, isHighContrast, colors.primary, colors.textPrimary),
                marginBottom: scaleSpacing(Space[8]),
              }}
            >
              Medicamento reconocido
            </AppText>
            <AppText variant="medicationName" style={{ flexShrink: 1 }}>
              {pendingResult.name}
            </AppText>
            {pendingResult.activeIngredient ? (
              <AppText variant="body" tone="secondary" style={{ marginTop: 4, flexShrink: 1 }}>
                {pendingResult.activeIngredient}
              </AppText>
            ) : null}
            {pendingResult.purpose ? (
              <AppText variant="body" style={{ marginTop: scaleSpacing(Space[8]), flexShrink: 1 }}>
                {pendingResult.purpose}
              </AppText>
            ) : null}
            {pendingResult.source ? (
              <AppText variant="caption" tone="muted" style={{ marginTop: scaleSpacing(Space[8]) }}>
                {pendingResult.source}
              </AppText>
            ) : null}
            <View style={{ gap: scaleSpacing(Space[8]), marginTop: scaleSpacing(Space[16]) }}>
              <Button
                title="Agregar medicamento"
                onPress={handleAddRecognized}
                accessibilityLabel="Agregar medicamento"
              />
              <Button
                title="Ahora no"
                variant="outline"
                onPress={clearPendingResult}
                accessibilityLabel="Ahora no"
              />
            </View>
          </SurfaceCard>
        ) : null}

        <View style={{ gap: scaleSpacing(Space[12]), marginBottom: scaleSpacing(Space[20]) }}>
          <Button
            title="Identificar medicamento manualmente"
            variant="outline"
            onPress={() => navigation.navigate('DrugSearch')}
            icon={
              <Ionicons
                name="search"
                size={scaleFont(20)}
                color={isHighContrast ? colors.textPrimary : colors.primary}
              />
            }
            accessibilityLabel="Identificar medicamento manualmente"
            accessibilityHint="Busca un medicamento por su nombre"
          />
          <Button
            title="Identificar con cámara LIA"
            onPress={() => navigation.navigate('CameraGuide')}
            icon={<Ionicons name="camera" size={scaleFont(20)} color={colors.onPrimary} />}
            accessibilityLabel="Identificar con cámara LIA"
            accessibilityHint="Abre la guía de la cámara física LIA"
          />
        </View>

        {showBootstrapLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !hasMeds ? (
          <EmptyState
            icon="medkit-outline"
            title="Aún no hay medicamentos"
            description="Identifica un medicamento con la cámara LIA o de forma manual para empezar. También puedes agregarlo después desde Medicamentos."
          />
        ) : (
          <>
            {missedCount > 0 ? (
              <Pressable
                onPress={goToReminders}
                accessibilityRole="button"
                accessibilityLabel={
                  missedCount === 1
                    ? '1 toma sin registrar. Revisar en recordatorios'
                    : `${missedCount} tomas sin registrar. Revisar en recordatorios`
                }
                accessibilityHint="Abre la pestaña Recordatorios"
                style={({ pressed }) => [
                  styles.missedBanner,
                  isSeniorMode && styles.missedBannerStack,
                  {
                    backgroundColor: isHighContrast
                      ? colors.surface
                      : isDark
                        ? colors.surfaceElevated
                        : BrandColors.beige,
                    borderColor: isHighContrast ? colors.border : BrandColors.skyBlue,
                    borderWidth: isHighContrast ? 2 : 1,
                    opacity: pressed ? 0.9 : 1,
                    marginBottom: scaleSpacing(Space[16]),
                    minHeight: minTouch,
                    paddingVertical: scaleSpacing(Space[12]),
                    paddingHorizontal: scaleSpacing(Space[16]),
                  },
                ]}
              >
                <View style={styles.missedTextCol}>
                  <AppText variant="body" style={{ flexShrink: 1 }}>
                    {missedCount === 1
                      ? '1 toma sin registrar'
                      : `${missedCount} tomas sin registrar`}
                  </AppText>
                </View>
                <AppText
                  variant="label"
                  style={{
                    color: isHighContrast ? colors.textPrimary : brandAccent(isDark, isHighContrast, colors.primary, colors.textPrimary),
                    flexShrink: 0,
                  }}
                >
                  Revisar
                </AppText>
              </Pressable>
            ) : null}

            {showNextDoseLoading ? (
              <View style={[styles.loadingWrap, { marginBottom: scaleSpacing(Space[20]) }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <AppText variant="body" tone="secondary" style={{ marginTop: scaleSpacing(Space[12]) }}>
                  Cargando tu próxima toma…
                </AppText>
              </View>
            ) : nextDoseGroup ? (
              <SurfaceCard
                variant="emphasis"
                style={{
                  marginBottom: scaleSpacing(Space[20]),
                  paddingVertical: scaleSpacing(Space[12]),
                  paddingHorizontal: scaleSpacing(Space[16]),
                  backgroundColor: isHighContrast
                    ? colors.surface
                    : isDark
                      ? colors.surfaceElevated
                      : BrandColors.skyBlue,
                  borderTopWidth: 0,
                  maxWidth: '100%',
                }}
              >
                <AppText
                  variant="overline"
                  style={{
                    color: isHighContrast ? colors.textSecondary : brandInk(isDark, isHighContrast, colors.textPrimary),
                    marginBottom: scaleSpacing(Space[4]),
                  }}
                >
                  Próxima toma
                </AppText>

                <EditorialText
                  variant="display"
                  style={{
                    color: isHighContrast ? colors.textPrimary : brandInk(isDark, isHighContrast, colors.textPrimary),
                    fontSize: scaleFont(compact ? 28 : 32),
                    lineHeight: scaleFont(compact ? 34 : 38),
                    marginBottom: scaleSpacing(Space[8]),
                    flexShrink: 1,
                  }}
                >
                  {formatTimeForDisplay(nextDoseGroup.time)}
                </EditorialText>

                <View style={{ gap: scaleSpacing(Space[8]) }}>
                  {visibleItems.map((item) => (
                    <View key={item.reminderId} style={styles.medInfo}>
                      <AppText variant="medicationName" style={{ flexShrink: 1 }}>
                        {item.medicationName}
                      </AppText>
                      {item.dose ? (
                        <AppText
                          variant="body"
                          tone="secondary"
                          style={{ marginTop: 2, flexShrink: 1 }}
                        >
                          {item.dose}
                        </AppText>
                      ) : null}
                    </View>
                  ))}
                </View>

                {hiddenCount > 0 ? (
                  <AppText
                    variant="caption"
                    tone="secondary"
                    style={{ marginTop: scaleSpacing(Space[8]), flexShrink: 1 }}
                  >
                    {`+ ${hiddenCount} medicamento${hiddenCount === 1 ? '' : 's'} más`}
                  </AppText>
                ) : null}

                <SpeakButton
                  id={`home-next-${nextDoseGroup.date}-${nextDoseGroup.time}`}
                  label="Escuchar"
                  stopLabel="Detener"
                  text={() =>
                    buildNextDoseSpeech({
                      time: nextDoseGroup.time,
                      items: nextDoseGroup.items,
                    })
                  }
                  style={{ marginTop: scaleSpacing(Space[12]) }}
                />

                <Button
                  title="Ver recordatorios"
                  variant="outline"
                  size="md"
                  onPress={goToReminders}
                  accessibilityLabel="Ver recordatorios"
                  accessibilityHint="Abre la pestaña Recordatorios para registrar cada toma"
                  style={{ marginTop: scaleSpacing(Space[8]) }}
                />
              </SurfaceCard>
            ) : (
              <View style={{ marginBottom: scaleSpacing(Space[20]) }}>
                <AppText variant="h3" style={{ marginBottom: scaleSpacing(Space[8]), flexShrink: 1 }}>
                  Ya no tienes más tomas programadas para hoy
                </AppText>
                <AppText variant="body" tone="secondary" style={{ flexShrink: 1 }}>
                  {missedCount > 0
                    ? 'Puedes revisar las tomas sin registrar en Recordatorios.'
                    : 'Cuando llegue el momento de la próxima dosis, LIA te lo mostrará aquí.'}
                </AppText>
              </View>
            )}

          </>
        )}
      </Screen>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  greetingBlock: {
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  missedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: Radius.lg,
    width: '100%',
    maxWidth: '100%',
  },
  missedBannerStack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  missedTextCol: {
    flex: 1,
    minWidth: 0,
  },
  medInfo: {
    flex: 1,
    minWidth: 0,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  arc: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    top: -70,
    right: -80,
    backgroundColor: 'transparent',
  },
});
