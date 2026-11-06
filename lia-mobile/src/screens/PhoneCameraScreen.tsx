import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  AccessibilityInfo,
  Linking,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '../components/icons/Ionicons';
import { RootStackParamList } from '../types';
import { AppText, Button, EditorialText, Screen, SurfaceCard } from '../components';
import IdentificationResultCard from '../components/identification-result/IdentificationResultCard';
import IdentificationResultWave from '../components/identification-result/IdentificationResultWave';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useMedications } from '../context/MedicationContext';
import { useCameraRecognition } from '../context/CameraRecognitionContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors, liaCardBorder } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import { normalizeMedicationName } from '../utils/helpers';
import { noteFromRecognition, readingForExistingMedication } from '../utils/recognizedMedication';
import {
  CameraApiError,
  CameraRequestCancelled,
  normalizeDirectRecognition,
  previewableImageUri,
  recognizeMedicationPhoto,
} from '../services/cameraApi';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PhoneCamera'>;
};

type Phase = 'preview' | 'review' | 'processing' | 'result' | 'failure';

type RecognizedView = NonNullable<ReturnType<typeof normalizeDirectRecognition>>;

const PHOTO_MAX_EDGE = 1600;

async function shrinkCapturedPhoto(
  uri: string,
  width?: number,
  height?: number
): Promise<string> {
  const longest = Math.max(width || 0, height || 0);
  if (longest > 0 && longest <= PHOTO_MAX_EDGE) return uri;
  const resize =
    (width || 0) >= (height || 0) ? { width: PHOTO_MAX_EDGE } : { height: PHOTO_MAX_EDGE };
  try {
    const result = await manipulateAsync(uri, [{ resize }], {
      compress: 0.92,
      format: SaveFormat.JPEG,
    });
    return result.uri || uri;
  } catch {
    return uri;
  }
}

const INCONCLUSIVE_MESSAGE =
  'No pudimos identificar el medicamento con esta foto. Toma otra, con el nombre bien visible y con buena luz.';

export default function PhoneCameraScreen({ navigation }: Props) {
  const { scaleSpacing, scaleFont, minTouch } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const lightChrome = !isDark && !isHighContrast;
  const { horizontalPadding } = useResponsive();
  const { medications, updateMedication } = useMedications();
  const { setPendingResult, clearPendingResult } = useCameraRecognition();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<Phase>('preview');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [result, setResult] = useState<RecognizedView | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [canRetake, setCanRetake] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraProblem, setCameraProblem] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const captureLock = useRef(false);
  const submitLock = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const attemptRef = useRef(0);
  const [cameraKey, setCameraKey] = useState(0);

  const pageBg = lightChrome ? BrandColors.white : colors.background;
  const ink = lightChrome ? BrandColors.navy : colors.textPrimary;
  const muted = lightChrome ? BrandColors.teal : colors.textSecondary;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const showFrame = true;

  const resetPhoto = useCallback(() => {
    attemptRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    submitLock.current = false;
    captureLock.current = false;
    setPhotoUri(null);
    setResult(null);
    setFailureMessage(null);
    setCanRetry(false);
    setCanRetake(true);
    setCameraProblem(null);
    setPhase('preview');
  }, []);

  const remountCamera = useCallback((message: string) => {
    setCameraReady(false);
    setCameraKey((key) => key + 1);
    setCanRetake(true);
    setCanRetry(false);
    setPhotoUri(null);
    setFailureMessage(message);
    setPhase('failure');
  }, []);

  const takePhoto = useCallback(async () => {
    if (captureLock.current || !cameraReady || !cameraRef.current) return;
    captureLock.current = true;
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
        imageType: 'jpg',
      });
      const uri = picture?.uri?.trim();
      const format = (picture?.format || 'jpg').toLowerCase();
      if (!uri || (format !== 'jpg' && format !== 'jpeg')) {
        remountCamera('La cámara no quedó lista. Espera un momento y toma la foto otra vez.');
        return;
      }
      const preparedUri = await shrinkCapturedPhoto(uri, picture.width, picture.height);
      let stableUri = preparedUri;
      try {
        const source = new File(preparedUri);
        if (!source.exists || source.size < 1) {
          throw new Error('missing-capture');
        }
        const dest = new File(Paths.cache, `lia-phone-${Date.now()}.jpg`);
        source.copy(dest);
        stableUri = dest.uri;
        if (__DEV__) {
          console.log(`[phone-camera] prepared bytes=${source.size}`);
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(
            `[phone-camera] persist ${error instanceof Error ? error.name : 'unknown'}`
          );
        }
      }
      setPhotoUri(stableUri);
      setFailureMessage(null);
      setResult(null);
      setCanRetry(false);
      setPhase('review');
    } catch (error) {
      if (__DEV__) {
        console.warn(`[phone-camera] capture ${error instanceof Error ? error.name : 'unknown'}`);
      }
      remountCamera('No pudimos usar la cámara. Vuelve a tomar la foto.');
    } finally {
      captureLock.current = false;
    }
  }, [cameraReady, remountCamera]);

  const recognize = useCallback(async () => {
    if (!photoUri || submitLock.current) return;
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    submitLock.current = true;
    setPhase('processing');
    setFailureMessage(null);
    setCanRetry(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const payload = await recognizeMedicationPhoto(photoUri, controller.signal);
      if (!mountedRef.current || controller.signal.aborted || attempt !== attemptRef.current) return;

      const normalized = normalizeDirectRecognition(payload);
      if (!normalized) {
        setResult(null);
        setCanRetake(true);
        setCanRetry(false);
        setFailureMessage(INCONCLUSIVE_MESSAGE);
        setPhase('failure');
        AccessibilityInfo.announceForAccessibility(INCONCLUSIVE_MESSAGE);
        return;
      }

      const withPhoto = {
        ...normalized,
        imageUrl: normalized.imageUrl || null,
      };
      setResult(withPhoto);
      setPendingResult({
        name: withPhoto.name,
        activeIngredient: withPhoto.activeIngredient,
        purpose: withPhoto.purpose,
        observedReading: withPhoto.observedReading,
        importantPoints: withPhoto.importantPoints,
        source: withPhoto.source,
        imageUrl: withPhoto.imageUrl,
      });
      setPhase('result');
      AccessibilityInfo.announceForAccessibility(`Medicamento identificado: ${withPhoto.name}`);
    } catch (error) {
      if (
        !mountedRef.current ||
        error instanceof CameraRequestCancelled ||
        attempt !== attemptRef.current
      ) {
        return;
      }
      if (__DEV__) {
        const status = error instanceof CameraApiError ? error.status ?? 'network' : 'unknown';
        console.warn(`[phone-camera] recognize status=${status}`);
      }
      const message =
        error instanceof CameraApiError
          ? error.message
          : 'No pudimos conectarnos con LIA. Revisa tu conexión e inténtalo nuevamente.';
      const status = error instanceof CameraApiError ? error.status : undefined;
      setFailureMessage(message);
      setCanRetry(status !== 400 && status !== 401);
      setCanRetake(status !== 401);
      setPhase('failure');
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      if (attempt === attemptRef.current) {
        submitLock.current = false;
        if (abortRef.current === controller) abortRef.current = null;
      }
    }
  }, [photoUri, setPendingResult]);

  const handleAdd = async () => {
    const prefilledName = result?.name?.trim() || '';
    if (!prefilledName) return;
    const nameNorm = normalizeMedicationName(prefilledName);
    const existing = medications.find((m) => normalizeMedicationName(m.name) === nameNorm);
    if (existing) {
      const reading = readingForExistingMedication(
        existing.description,
        noteFromRecognition({
          purpose: result?.purpose,
          observedReading: result?.observedReading,
        })
      );
      let kept = false;
      if (reading) {
        try {
          await updateMedication(existing.id, { description: reading });
          kept = true;
        } catch {
          kept = false;
        }
      }
      setToastMessage(
        kept
          ? 'Este medicamento ya está registrado. La lectura de la foto quedó en su detalle.'
          : 'Este medicamento ya está registrado.'
      );
      return;
    }
    const savedNote = noteFromRecognition({
      purpose: result?.purpose,
      observedReading: result?.observedReading,
    });
    clearPendingResult();
    navigation.navigate('AddMedication', {
      prefilled: { name: prefilledName, description: savedNote },
    });
  };

  const handleDismiss = () => {
    clearPendingResult();
    navigation.goBack();
  };

  const speakText = result
    ? [
        result.name,
        result.activeIngredient ? `Principio activo: ${result.activeIngredient}` : '',
        result.purpose || '',
        result.observedReading ? `Lectura de la foto: ${result.observedReading}` : '',
        ...(result.importantPoints || []).slice(0, 3),
      ]
        .filter(Boolean)
        .join('. ')
    : '';

  if (!permission) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: pageBg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <AppText variant="body" style={{ marginTop: 16, color: muted }}>
          Preparando la cámara...
        </AppText>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, { backgroundColor: pageBg }]}>
        <Screen
          scroll
          padded={false}
          contentStyle={{
            paddingTop: insets.top + scaleSpacing(Space[8]),
            paddingHorizontal: horizontalPadding,
            paddingBottom: insets.bottom + scaleSpacing(Space[24]),
          }}
        >
          <BackButton
            label="Volver"
            color={ink}
            minTouch={minTouch}
            onPress={() => navigation.goBack()}
          />
          <EditorialText
            variant="headline"
            accessibilityRole="header"
            style={{
              fontSize: scaleFont(30),
              lineHeight: scaleFont(36),
              marginTop: scaleSpacing(Space[12]),
              marginBottom: scaleSpacing(Space[12]),
            }}
          >
            Permiso de cámara
          </EditorialText>
          <AppText variant="body" style={{ color: muted, flexShrink: 1 }}>
            Para reconocer el medicamento, LÍA necesita usar la cámara de tu celular. Puedes volver
            sin tomar la foto.
          </AppText>
          <View style={{ marginTop: scaleSpacing(Space[24]), gap: scaleSpacing(Space[12]) }}>
            {permission.canAskAgain ? (
              <Button
                title="Permitir cámara"
                onPress={() => void requestPermission()}
                accessibilityLabel="Permitir cámara"
                style={{ minHeight: Math.max(64, minTouch) }}
              />
            ) : (
              <Button
                title="Abrir ajustes"
                onPress={() => void Linking.openSettings()}
                accessibilityLabel="Abrir ajustes del celular"
                accessibilityHint="Desde los ajustes puedes permitir la cámara de LÍA"
                style={{ minHeight: Math.max(64, minTouch) }}
              />
            )}
            <Button
              title="Volver"
              variant="outline"
              onPress={() => navigation.goBack()}
              style={{ minHeight: Math.max(56, minTouch) }}
            />
          </View>
        </Screen>
      </View>
    );
  }

  if (phase === 'result' && result) {
    return (
      <View style={[styles.root, { backgroundColor: pageBg }]}>
        <IdentificationResultWave topOffset={insets.top + scaleSpacing(Space[8])} />
        <Screen
          scroll
          transparent
          padded={false}
          contentStyle={{
            paddingTop: insets.top + scaleSpacing(Space[4]),
            paddingHorizontal: horizontalPadding,
            paddingBottom: insets.bottom + scaleSpacing(Space[32]),
            zIndex: 1,
          }}
        >
          <BackButton
            label="Identificar"
            color={ink}
            minTouch={minTouch}
            onPress={() => navigation.goBack()}
          />
          <EditorialText
            variant="headline"
            accessibilityRole="header"
            style={{
              fontSize: scaleFont(32),
              lineHeight: scaleFont(38),
              marginTop: scaleSpacing(Space[8]),
              marginBottom: scaleSpacing(Space[16]),
            }}
          >
            Medicamento reconocido
          </EditorialText>
          <IdentificationResultCard
            name={result.name}
            purpose={result.purpose}
            observedReading={result.observedReading}
            activeIngredient={result.activeIngredient}
            importantPoints={result.importantPoints}
            source={result.source}
            imageUrl={result.imageUrl || (photoUri ? previewableImageUri(photoUri) : null)}
            photoAccessibilityLabel="Foto tomada con la cámara de tu celular"
            speakId={`phone-camera-result-${result.name}`}
            speakText={speakText}
          />
          <View style={{ gap: scaleSpacing(Space[8]), marginTop: scaleSpacing(Space[20]) }}>
            <Button
              title="Agregar medicamento"
              onPress={handleAdd}
              accessibilityLabel="Agregar medicamento identificado"
              style={{ minHeight: Math.max(56, minTouch), borderRadius: Radius.lg }}
            />
            <Button
              title="Tomar otra foto"
              variant="outline"
              onPress={() => {
                clearPendingResult();
                setCameraReady(false);
                resetPhoto();
              }}
              style={{ minHeight: Math.max(56, minTouch), borderRadius: Radius.lg }}
            />
            <Button
              title="Ahora no"
              variant="outline"
              onPress={handleDismiss}
              accessibilityLabel="Ahora no agregar el medicamento"
              style={{ minHeight: Math.max(54, minTouch), borderRadius: Radius.lg }}
            />
          </View>
          {toastMessage ? (
            <AppText
              variant="body"
              style={{ marginTop: scaleSpacing(Space[12]), color: colors.error || ink }}
            >
              {toastMessage}
            </AppText>
          ) : null}
        </Screen>
      </View>
    );
  }

  const reviewing = phase === 'review' || phase === 'processing' || (phase === 'failure' && Boolean(photoUri));
  const previewSource = photoUri ? previewableImageUri(photoUri) : null;

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + scaleSpacing(Space[4]),
          paddingHorizontal: horizontalPadding,
          paddingBottom: insets.bottom + scaleSpacing(Space[16]),
        }}
      >
        <BackButton
          label="Volver"
          color={ink}
          minTouch={minTouch}
          onPress={() => {
            if (phase === 'processing') {
              abortRef.current?.abort();
              navigation.goBack();
              return;
            }
            if (phase === 'review') {
              resetPhoto();
              return;
            }
            navigation.goBack();
          }}
        />

        <AppText
          variant="h1"
          accessibilityRole="header"
          style={{
            color: ink,
            fontSize: scaleFont(26),
            lineHeight: scaleFont(32),
            fontWeight: '600',
            marginTop: scaleSpacing(Space[4]),
          }}
        >
          {reviewing ? 'Revisa la foto' : 'Cámara de tu celular'}
        </AppText>
        <AppText variant="body" style={{ color: muted, marginTop: 4, flexShrink: 1 }}>
          {phase === 'failure'
            ? 'Puedes tomar otra foto o volver.'
            : reviewing
              ? 'Si se ve el nombre del medicamento, continúa. Si no, toma otra foto.'
              : 'Apunta al nombre del medicamento y mantenlo quieto.'}
        </AppText>

        {showFrame ? (
        <View
          style={[
            styles.preview,
            {
              marginTop: scaleSpacing(Space[16]),
              borderColor: liaCardBorder(lightChrome, colors.border),
              backgroundColor: isHighContrast ? colors.surface : '#1C2B38',
            },
          ]}
        >
        {isFocused ? (
            <CameraView
              key={cameraKey}
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              mode="picture"
              mute
              active
              animateShutter={false}
              onCameraReady={() => setCameraReady(true)}
              onMountError={() => {
                setCameraReady(false);
                setCameraProblem('No pudimos abrir la cámara de tu celular.');
              }}
            />
          ) : null}
          {previewSource && reviewing ? (
            <Image
              source={{ uri: previewSource }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              accessibilityLabel="Fotografía del medicamento"
              accessibilityIgnoresInvertColors
            />
          ) : null}

          {phase === 'processing' ? (
            <View style={styles.processing} accessibilityRole="progressbar">
              <ActivityIndicator size="large" color={BrandColors.white} />
              <AppText
                variant="body"
                style={{ color: BrandColors.white, marginTop: 12, textAlign: 'center' }}
              >
                Reconociendo el medicamento...
              </AppText>
            </View>
          ) : null}
        </View>
        ) : null}

        {cameraProblem && phase === 'preview' ? (
          <SurfaceCard style={{ marginTop: scaleSpacing(Space[12]) }}>
            <AppText variant="body">{cameraProblem}</AppText>
          </SurfaceCard>
        ) : null}

        {phase === 'failure' && failureMessage ? (
          <View style={{ marginTop: scaleSpacing(Space[16]) }}>
            <View style={styles.failureRow}>
              <Ionicons
                name="alert-circle-outline"
                size={scaleFont(28)}
                color={isHighContrast ? colors.textPrimary : BrandColors.navy}
              />
              <AppText variant="body" style={{ flex: 1, color: ink }}>
                {failureMessage}
              </AppText>
            </View>
          </View>
        ) : (
          <AppText
            variant="body"
            style={{ color: muted, marginTop: scaleSpacing(Space[12]), flexShrink: 1 }}
          >
            {reviewing
              ? 'La foto se usa solo para reconocer el medicamento.'
              : 'El botón de abajo toma la foto. Todavía no se envía.'}
          </AppText>
        )}

        <View style={{ marginTop: 'auto', gap: scaleSpacing(Space[8]), paddingTop: scaleSpacing(Space[16]) }}>
          {phase === 'preview' ? (
            <Button
              title={cameraReady ? 'Tomar foto' : 'Preparando cámara...'}
              onPress={() => void takePhoto()}
              disabled={!cameraReady || Boolean(cameraProblem)}
              accessibilityLabel="Tomar foto"
              accessibilityHint="Captura el medicamento que se ve en la cámara"
              style={{ minHeight: Math.max(68, minTouch) }}
            />
          ) : null}

          {phase === 'review' || phase === 'processing' ? (
            <>
              <Button
                title={phase === 'processing' ? 'Reconociendo...' : 'Reconocer medicamento'}
                onPress={() => void recognize()}
                loading={phase === 'processing'}
                disabled={phase === 'processing'}
                accessibilityLabel="Reconocer medicamento"
                style={{ minHeight: Math.max(68, minTouch) }}
              />
              <Button
                title="Volver a tomar"
                variant="outline"
                onPress={resetPhoto}
                disabled={phase === 'processing'}
                accessibilityLabel="Volver a tomar la foto"
                style={{ minHeight: Math.max(60, minTouch) }}
              />
            </>
          ) : null}

          {phase === 'failure' ? (
            <>
              {canRetry && photoUri ? (
                <Button
                  title="Reconocer medicamento"
                  onPress={() => void recognize()}
                  accessibilityLabel="Reconocer medicamento otra vez"
                  style={{ minHeight: Math.max(68, minTouch) }}
                />
              ) : null}
              {canRetake ? (
                <Button
                  title="Volver a tomar"
                  variant={canRetry ? 'outline' : 'primary'}
                  onPress={resetPhoto}
                  style={{ minHeight: Math.max(64, minTouch) }}
                />
              ) : null}
              <Button
                title="Volver"
                variant="outline"
                onPress={() => navigation.goBack()}
                style={{ minHeight: Math.max(56, minTouch) }}
              />
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function BackButton({
  label,
  color,
  minTouch,
  onPress,
}: {
  label: string;
  color: string;
  minTouch: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.backBtn,
        { minWidth: minTouch, minHeight: minTouch, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Ionicons name="chevron-back" size={26} color={color} />
      <AppText variant="body" style={{ color, fontWeight: '600' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  preview: {
    flex: 1,
    minHeight: 240,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
  },
  processing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(23, 43, 64, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  failureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
});
