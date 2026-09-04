import React, { useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator, Image, ImageSourcePropType, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, MainTabParamList, Reminder } from '../types';
import {
  AppText,
  Button,
  EmptyMedicationsCard,
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
import { BrandColors, brandAccent, liaCardBorder } from '../theme/brand';
import { FontFamily, FontWeight, Radius, Space } from '../theme/tokens';
import { getMedicationImageScale, getMedicationImageSource, MEDICATION_IMAGE_SLOT } from '../config/medicationImages';
import { getGreeting, normalizeMedicationName } from '../utils/helpers';
import { formatTimeForDisplay } from '../utils/dateTime';
import { buildNextDoseSpeech, buildReminderSpeech } from '../utils/speechPhrases';

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type Props = { navigation: HomeNavProp };

const VISIBLE_MEDS = 3;

const profilePhotoStorageKey = (uid: string) =>
  `lia_profile_photo_${uid}`;

const PILL_IMAGE = require('../assets/images/lia-pill.png');
const CAMERA_IMAGE = require('../assets/images/lia-camera.png');

export default function HomeScreen({ navigation }: Props) {
  const { user, isDemo } = useAuth();
  const { medications, loading: medsLoading } = useMedications();
  const { nextDoseGroup, todayReminders, homeLoading, refreshHome } = useReminders();
  const { pendingResult, clearPendingResult } = useCameraRecognition();
  const { scaleSpacing, minTouch, scaleFont, isSeniorMode } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { compact, width, horizontalPadding } = useResponsive();
  const [toast, setToast] = React.useState({ visible: false, message: '', type: 'error' as const });
  const [profileImage, setProfileImage] = React.useState<string | null>(null);

  const firstName = user?.fullName?.split(' ')[0] || 'Amigo';
  const hasMeds = medications.length > 0;
  const lightChrome = !isDark && !isHighContrast;
  const greeting = getGreeting();

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

  const medCardWidth = Math.min(320, Math.max(280, width - horizontalPadding * 2 - 36));

  const medCards = useMemo(
    () =>
      medications.map((med) => {
        const missedReminders = todayReminders.filter(
          (r) => r.medicationId === med.id && r.status === 'missed'
        );
        const missed = missedReminders.length;
        const missedReminder =
          missedReminders
            .slice()
            .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))[0] ?? null;
        const nextPending = todayReminders
          .filter((r) => r.medicationId === med.id && r.status === 'pending')
          .slice()
          .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))[0];
        const nextTimeRaw = nextPending?.scheduledTime || med.time || null;
        const nextTime = nextTimeRaw
          ? formatTimeForDisplay(nextTimeRaw)
          : null;
        return {
          id: med.id,
          name: med.name,
          dose: med.dose,
          imageUrl: med.imageUrl,
          nextTime,
          nextTimeRaw,
          missed,
          missedReminder,
        };
      }),
    [medications, todayReminders]
  );

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
    <View style={[styles.root, { backgroundColor: lightChrome ? '#FFFFFF' : colors.background }]}>
      <Screen scroll safeTop>
        <View
          style={[
            styles.headerRow,
            {
              paddingTop: scaleSpacing(Space[20]),
              marginBottom: scaleSpacing(compact ? Space[32] : Space[40]),
            },
          ]}
        >
          <View style={styles.greetingBlock}>
            <AppText
              variant="h1"
              accessibilityRole="header"
              numberOfLines={1}
              style={{
                color: lightChrome ? BrandColors.navy : colors.textPrimary,
                fontSize: scaleFont(30),
                lineHeight: scaleFont(36),
                fontWeight: '600',
              }}
            >
              Hola, {firstName}
            </AppText>
            <AppText
              variant="body"
              numberOfLines={1}
              style={{
                marginTop: 4,
                color: lightChrome ? BrandColors.teal : colors.textSecondary,
                fontSize: scaleFont(compact ? 24 : 26),
                lineHeight: scaleFont(compact ? 30 : 32),
                fontWeight: '400',
              }}
            >
              ¡{greeting}!
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
                backgroundColor: colors.primary,
                borderWidth: isHighContrast ? 2 : 1,
                borderColor: isHighContrast ? colors.border : liaCardBorder(lightChrome, colors.border),
                width: Math.max(56, minTouch),
                height: Math.max(56, minTouch),
                minWidth: Math.max(56, minTouch),
                minHeight: Math.max(56, minTouch),
                borderRadius: Math.max(56, minTouch) / 2,
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
              <AppText variant="h3" style={{ color: colors.onPrimary }}>
                {firstName.charAt(0).toUpperCase()}
              </AppText>
            )}
          </Pressable>
        </View>

        <HomeDailyTipBanner hasMedications={hasMeds} />

        {pendingResult ? (
          <SurfaceCard
            variant="emphasis"
            style={{
              marginBottom: scaleSpacing(Space[20]),
              backgroundColor: isHighContrast
                ? colors.surface
                : isDark
                  ? colors.surfaceElevated
                  : BrandColors.white,
              borderColor: liaCardBorder(lightChrome, colors.border),
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
                style={{
                  borderRadius: Radius.lg,
                  minHeight: Math.max(minTouch, 56),
                  backgroundColor: colors.primary,
                }}
              />
              <Button
                title="Ahora no"
                variant="outline"
                onPress={clearPendingResult}
                accessibilityLabel="Ahora no"
                style={{
                  borderRadius: Radius.lg,
                  minHeight: Math.max(minTouch, 56),
                }}
              />
            </View>
          </SurfaceCard>
        ) : null}

        <View>
          <AppText
            variant="body"
            style={[
              styles.sectionTitle,
              !lightChrome && { color: colors.textSecondary },
            ]}
          >
            Registrar medicamentos
          </AppText>
          <HomeActionCard
            image={PILL_IMAGE}
            tint="#E8ECEF"
            imageSize={130}
            title="Identificar manualmente"
            description="Ingresa el nombre del medicamento para más detalles"
            buttonTitle="Buscar"
            onPress={() => navigation.navigate('DrugSearch')}
            accessibilityLabel="Buscar medicamento"
            accessibilityHint="Busca un medicamento por su nombre"
          />
          <HomeActionCard
            image={CAMERA_IMAGE}
            tint="#E8ECEF"
            imageSize={100}
            title="Identificar con cámara"
            description="Reconoce tus medicamentos de forma rápida y sencilla con LIA"
            buttonTitle="Abrir cámara"
            onPress={() => navigation.navigate('CameraGuide')}
            accessibilityLabel="Abrir cámara"
            accessibilityHint="Abre la guía de la cámara física LIA"
          />
        </View>

        <View>
          <AppText
            variant="body"
            style={[
              styles.sectionTitle,
              !lightChrome && { color: colors.textSecondary },
            ]}
          >
            Tus medicamentos
          </AppText>

          {showBootstrapLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : !hasMeds ? (
            <EmptyMedicationsCard />
          ) : (
            <>
              {showNextDoseLoading ? (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : null}
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={medCardWidth + 14}
                snapToAlignment="start"
                contentContainerStyle={styles.medCarousel}
              >
                {medCards.map((card) => (
                  <HomeMedicationCard
                    key={card.id}
                    id={card.id}
                    width={medCardWidth}
                    name={card.name}
                    dose={card.dose}
                    nextTime={card.nextTime}
                    nextTimeRaw={card.nextTimeRaw}
                    missed={card.missed}
                    missedReminder={card.missedReminder}
                    imageUrl={card.imageUrl}
                    onReview={goToReminders}
                  />
                ))}
              </ScrollView>
            </>
          )}
        </View>
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

const TIP_NO_MEDS =
  'Registra tu primer medicamento y lleva un mejor control de tus tomas con LIA';
const TIP_WITH_MEDS = [
  'Recuerda tomar tus medicamentos a la hora indicada para cuidar tu bienestar.',
  'Mantén tus horarios al día y no olvides registrar cada toma',
] as const;
const BULB_YELLOW = '#F0B429';
const BULB_CIRCLE = '#FFF6E0';

function dailyAdherenceTip() {
  const day = new Date().getDate();
  return TIP_WITH_MEDS[day % TIP_WITH_MEDS.length];
}

function HomeDailyTipBanner({ hasMedications }: { hasMedications: boolean }) {
  const { colors, isHighContrast, isDark } = useTheme();
  const lightChrome = !isDark && !isHighContrast;
  const description = hasMedications ? dailyAdherenceTip() : TIP_NO_MEDS;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Consejo del día. ${description}`}
      style={[
        styles.tipCard,
        {
          backgroundColor: lightChrome ? BrandColors.white : colors.surface,
          borderColor: liaCardBorder(lightChrome, colors.border),
          borderWidth: isHighContrast ? 2 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.tipIcon,
          {
            backgroundColor: lightChrome ? BULB_CIRCLE : colors.surfaceElevated,
          },
        ]}
      >
        <Ionicons name="bulb" size={24} color={BULB_YELLOW} />
      </View>

      <View style={styles.tipCopy}>
        <AppText
          variant="h3"
          style={{
            color: lightChrome ? BrandColors.navy : colors.textPrimary,
            fontWeight: '600',
          }}
        >
          Consejo del día
        </AppText>
        <AppText
          variant="body"
          style={{
            color: lightChrome ? BrandColors.teal : colors.textSecondary,
            marginTop: 6,
          }}
        >
          {description}
        </AppText>
      </View>
    </View>
  );
}

type HomeActionCardProps = {
  image: ImageSourcePropType;
  tint: string;
  imageSize?: number;
  title: string;
  description: string;
  buttonTitle: string;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint: string;
};

function HomeActionCard({
  image,
  tint,
  imageSize = 100,
  title,
  description,
  buttonTitle,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: HomeActionCardProps) {
  const { colors, isHighContrast, isDark } = useTheme();
  const { minTouch } = useAccessibility();
  const lightChrome = !isDark && !isHighContrast;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.actionCard,
        {
          backgroundColor: lightChrome
            ? tint
            : isHighContrast && !isDark
              ? colors.surfaceElevated
              : colors.surface,
          borderColor: liaCardBorder(lightChrome, colors.border),
          borderWidth: isHighContrast ? 2 : 1,
          minHeight: Math.max(124, minTouch + 64),
          opacity: pressed ? 0.94 : 1,
        },
      ]}
    >
      <View style={styles.actionCopy}>
        <AppText
          variant="h3"
          style={{
            color: lightChrome ? BrandColors.navy : colors.textPrimary,
            fontWeight: '600',
          }}
        >
          {title}
        </AppText>
        <AppText
          variant="body"
          style={{
            color: lightChrome ? BrandColors.teal : colors.textSecondary,
            marginTop: 8,
            marginBottom: 10,
          }}
        >
          {description}
        </AppText>
        <View
          pointerEvents="none"
          style={[
            styles.actionChip,
            {
              minHeight: Math.max(40, Math.min(minTouch, 48)),
              backgroundColor: colors.primary,
              borderRadius: Radius.lg,
              borderWidth: isHighContrast ? 2 : 0,
              borderColor: isHighContrast ? colors.border : 'transparent',
            },
          ]}
        >
          <AppText
            variant="button"
            numberOfLines={1}
            style={{
              color: colors.onPrimary,
              fontFamily: FontFamily.semiBold,
              fontWeight: FontWeight.semiBold,
              textAlign: 'center',
            }}
          >
            {buttonTitle}
          </AppText>
        </View>
      </View>

      <View style={styles.actionArt} pointerEvents="none">
        <Image
          source={image}
          style={{ width: imageSize, height: imageSize }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    </Pressable>
  );
}

type HomeMedicationCardProps = {
  id: string;
  width: number;
  name: string;
  dose: string;
  nextTime: string | null;
  nextTimeRaw: string | null;
  missed: number;
  missedReminder: Reminder | null;
  imageUrl?: string;
  onReview: () => void;
};

function HomeMedicationCard({
  id,
  width,
  name,
  dose,
  nextTime,
  nextTimeRaw,
  missed,
  missedReminder,
  imageUrl,
  onReview,
}: HomeMedicationCardProps) {
  const { colors, isHighContrast, isDark } = useTheme();
  const { minTouch } = useAccessibility();
  const lightChrome = !isDark && !isHighContrast;
  const hasMissed = missed > 0;
  const [imageFailed, setImageFailed] = React.useState(false);
  const showImage = Boolean(imageUrl) && !imageFailed;

  React.useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <View
      style={[
        styles.medCard,
        {
          width,
          backgroundColor: lightChrome ? '#FFFFFF' : colors.surface,
          borderColor: liaCardBorder(lightChrome, colors.border),
          borderWidth: isHighContrast ? 2 : 1,
        },
      ]}
    >
      <View style={styles.medBodyRow}>
        <View style={styles.medCopy}>
          <AppText
            variant="h3"
            numberOfLines={1}
            style={{
              color: lightChrome ? BrandColors.navy : colors.textPrimary,
              fontWeight: '600',
            }}
          >
            {name}
          </AppText>
          {dose ? (
            <AppText
              variant="caption"
              numberOfLines={1}
              style={{
                color: lightChrome ? BrandColors.teal : colors.textSecondary,
                marginTop: 2,
              }}
            >
              {dose}
            </AppText>
          ) : null}
          {hasMissed || nextTime ? (
            <AppText
              variant="caption"
              numberOfLines={2}
              style={{
                color: lightChrome ? BrandColors.teal : colors.textSecondary,
                marginTop: 2,
              }}
            >
              {hasMissed
                ? 'Esta toma quedó sin registrar'
                : `Próxima toma: ${nextTime}`}
            </AppText>
          ) : null}

          <View style={[styles.medStatus, { marginTop: 8 }]}>
            <Ionicons
              name={hasMissed ? 'alert-circle-outline' : 'checkmark-circle-outline'}
              size={16}
              color={lightChrome ? BrandColors.navy : colors.textPrimary}
            />
            <AppText
              variant="caption"
              numberOfLines={1}
              style={{
                flex: 1,
                color: lightChrome ? BrandColors.navy : colors.textPrimary,
                fontWeight: '600',
              }}
            >
              {hasMissed
                ? missed === 1
                  ? '1 toma sin registrar'
                  : `${missed} tomas sin registrar`
                : 'Todo al día'}
            </AppText>
          </View>
        </View>

        <View style={styles.medArt} pointerEvents="none">
          <Image
            source={
              showImage && imageUrl
                ? { uri: imageUrl }
                : getMedicationImageSource(name)
            }
            style={[
              styles.medArtImage,
              { transform: [{ scale: getMedicationImageScale(name) }], backgroundColor: 'transparent' },
            ]}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            onError={() => setImageFailed(true)}
          />
        </View>
      </View>

      <View style={styles.medFooter}>
        <SpeakButton
          id={`home-med-${id}`}
          label="Escuchar"
          stopLabel="Detener"
          textVariant="button"
          text={() =>
            hasMissed && missedReminder
              ? buildReminderSpeech(missedReminder)
              : buildNextDoseSpeech({
                  time: nextTimeRaw || '',
                  items: [{ medicationName: name, dose }],
                })
          }
          style={[
            styles.medReview,
            {
              minHeight: Math.max(48, Math.min(minTouch, 52)),
              backgroundColor: lightChrome ? colors.primaryLight : colors.surface,
              borderWidth: isHighContrast ? 2 : 1,
              borderColor: lightChrome && !isHighContrast ? colors.primaryLight : colors.border,
            },
          ]}
        />

        <Pressable
          onPress={onReview}
          accessibilityRole="button"
          accessibilityLabel={hasMissed ? 'Revisar' : 'Ver recordatorios'}
          accessibilityHint={
            hasMissed
              ? 'Abre la pestaña Recordatorios'
              : 'Abre la pestaña Recordatorios para registrar cada toma'
          }
          style={({ pressed }) => [
            styles.medReview,
            {
              minHeight: Math.max(48, Math.min(minTouch, 52)),
              borderRadius: Radius.lg,
              backgroundColor: colors.primary,
              opacity: pressed ? 0.88 : 1,
              borderWidth: isHighContrast ? 2 : 0,
              borderColor: isHighContrast ? colors.border : 'transparent',
            },
          ]}
        >
          <AppText
            variant="button"
            numberOfLines={1}
            style={{
              color: colors.onPrimary,
              fontFamily: FontFamily.semiBold,
              fontWeight: FontWeight.semiBold,
              textAlign: 'center',
            }}
          >
            {hasMissed ? 'Revisar' : 'Ver recordatorios'}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 26,
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 16,
    marginBottom: 16,
    minHeight: 124,
    backgroundColor: '#E8ECEF',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 1,
  },
  actionCopy: {
    flex: 1.4,
    minWidth: 0,
    paddingRight: 8,
    zIndex: 1,
  },
  actionChip: {
    width: 168,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionArt: {
    width: '30%',
    maxWidth: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
  },
  tipIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tipCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 18,
    color: '#6F747A',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  medCarousel: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingRight: 28,
    paddingBottom: 8,
  },
  medCard: {
    borderRadius: 24,
    padding: 16,
    minHeight: 168,
    marginRight: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },
  medBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 118,
  },
  medCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  medArt: {
    width: MEDICATION_IMAGE_SLOT.width,
    height: MEDICATION_IMAGE_SLOT.height,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  medArtImage: {
    width: MEDICATION_IMAGE_SLOT.width,
    height: MEDICATION_IMAGE_SLOT.height,
  },
  medFooter: {
    marginTop: 12,
    gap: 8,
  },
  medStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  medReview: {
    alignSelf: 'stretch',
    width: '100%',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
});
