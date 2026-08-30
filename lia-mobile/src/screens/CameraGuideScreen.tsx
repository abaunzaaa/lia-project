import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import {
  AppText,
  Button,
  EditorialText,
  Header,
  Screen,
  SpeakButton,
  SurfaceCard,
  Toast,
} from '../components';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useMedications } from '../context/MedicationContext';
import { useCameraRecognition } from '../context/CameraRecognitionContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Space } from '../theme/tokens';
import { SPEECH_CAMERA_GUIDE } from '../utils/speechPhrases';
import { normalizeMedicationName } from '../utils/helpers';
import {
  createCameraSession,
  getCameraSession,
  normalizeCameraResult,
  CameraApiError,
  LIA_CAMERA_DEVICE_ID,
} from '../services/cameraApi';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CameraGuide'>;
};

type GuidePhase = 'step1' | 'step2' | 'step3' | 'waiting' | 'result' | 'expired' | 'error';

type RecognizedView = {
  name: string;
  activeIngredient: string | null;
  purpose: string | null;
  importantPoints: string[];
  source: string | null;
};

const POLL_MS = 2000;
const WAIT_TIMEOUT_MS = 90_000;
const TIMEOUT_MESSAGE =
  'No recibimos una respuesta todavía. Puedes intentarlo nuevamente.';

export default function CameraGuideScreen({ navigation }: Props) {
  const { scaleSpacing, scaleFont, minTouch, voiceEnabled } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const lightChrome = !isDark && !isHighContrast;
  const { compact } = useResponsive();
  const { medications } = useMedications();
  const { setPendingResult, clearPendingResult } = useCameraRecognition();

  const [phase, setPhase] = useState<GuidePhase>('step1');
  const [result, setResult] = useState<RecognizedView | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' as const });
  const [flashOn, setFlashOn] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusedRef = useRef(true);
  const networkFailRef = useRef(0);
  const creationInProgressRef = useRef(false);
  const attemptActiveRef = useRef(false);
  const attemptGenerationRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (waitTimeoutRef.current) {
      clearTimeout(waitTimeoutRef.current);
      waitTimeoutRef.current = null;
    }
  }, []);

  const resetAttemptGuards = useCallback(() => {
    stopPolling();
    sessionIdRef.current = null;
    creationInProgressRef.current = false;
    attemptActiveRef.current = false;
    attemptGenerationRef.current += 1;
    networkFailRef.current = 0;
  }, [stopPolling]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      return () => {
        focusedRef.current = false;
        stopPolling();
      };
    }, [stopPolling])
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startSessionAndPoll = useCallback(async () => {
    if (creationInProgressRef.current || attemptActiveRef.current || sessionIdRef.current) {
      if (__DEV__) {
        console.log('[camera-mobile] create-session skipped reason=existing-session');
      }
      return;
    }

    creationInProgressRef.current = true;
    attemptActiveRef.current = true;
    const generation = ++attemptGenerationRef.current;

    if (__DEV__) {
      console.log('[camera-mobile] starting attempt');
    }

    setErrorMsg(null);
    setResult(null);
    setPhase('waiting');
    setFlashOn(true);
    setTimeout(() => setFlashOn(false), 450);
    networkFailRef.current = 0;
    stopPolling();

    try {
      if (__DEV__) {
        console.log('[camera-mobile] create-session requested');
      }
      const session = await createCameraSession(LIA_CAMERA_DEVICE_ID);

      if (generation !== attemptGenerationRef.current) {
        if (__DEV__) {
          console.log('[camera-mobile] create-session skipped reason=stale-attempt');
        }
        return;
      }

      const sessionId = session.id;
      sessionIdRef.current = sessionId;
      creationInProgressRef.current = false;

      if (__DEV__) {
        console.log(`[camera-mobile] session-created id=${sessionId}`);
      }

      let resolved = false;

      const poll = async () => {
        if (resolved) return;
        if (!focusedRef.current) return;
        if (generation !== attemptGenerationRef.current) return;
        if (sessionIdRef.current !== sessionId) return;

        try {
          const current = await getCameraSession(sessionId);
          if (resolved || generation !== attemptGenerationRef.current) return;
          networkFailRef.current = 0;

          if (__DEV__) {
            console.log(`[camera-mobile] poll id=${sessionId} status=${current.status}`);
          }

          if (current.status === 'recognized' && 'result' in current) {
            resolved = true;
            stopPolling();
            if (__DEV__) {
              console.log('[camera-mobile] polling-stopped reason=recognized');
            }
            const normalized = normalizeCameraResult(current);
            if (!normalized) {
              setPhase('error');
              setErrorMsg('No pudimos leer el resultado del reconocimiento.');
              return;
            }
            setResult(normalized);
            setPendingResult({
              name: normalized.name,
              activeIngredient: normalized.activeIngredient,
              purpose: normalized.purpose,
              importantPoints: normalized.importantPoints,
              source: normalized.source,
            });
            setPhase('result');
            if (__DEV__) {
              console.log(`[camera-mobile] showing-result id=${sessionId}`);
            }
            return;
          }
          if (current.status === 'expired' || current.status === 'failed') {
            resolved = true;
            stopPolling();
            if (__DEV__) {
              console.log(`[camera-mobile] polling-stopped reason=${current.status}`);
            }
            setPhase(current.status === 'expired' ? 'expired' : 'error');
            setErrorMsg(
              current.status === 'expired'
                ? TIMEOUT_MESSAGE
                : 'message' in current && current.message
                  ? current.message
                  : TIMEOUT_MESSAGE
            );
          }
        } catch (e) {
          networkFailRef.current += 1;
          if (networkFailRef.current < 3) return;
          resolved = true;
          stopPolling();
          setPhase('error');
          setErrorMsg(
            e instanceof CameraApiError
              ? e.message
              : 'No pudimos conectarnos con LIA. Revisa tu conexión.'
          );
        }
      };

      await poll();
      if (
        !resolved &&
        focusedRef.current &&
        generation === attemptGenerationRef.current &&
        sessionIdRef.current === sessionId
      ) {
        pollTimerRef.current = setInterval(() => {
          void poll();
        }, POLL_MS);
        waitTimeoutRef.current = setTimeout(() => {
          if (resolved || generation !== attemptGenerationRef.current) return;
          resolved = true;
          stopPolling();
          if (__DEV__) {
            console.log('[camera-mobile] polling-stopped reason=timeout');
          }
          setPhase('expired');
          setErrorMsg(TIMEOUT_MESSAGE);
        }, WAIT_TIMEOUT_MS);
      }
    } catch (e) {
      if (generation !== attemptGenerationRef.current) return;
      creationInProgressRef.current = false;
      attemptActiveRef.current = false;
      sessionIdRef.current = null;
      setPhase('error');
      setErrorMsg(
        e instanceof CameraApiError
          ? e.message
          : 'No pudimos iniciar la sesión de cámara. Inténtalo nuevamente.'
      );
    }
  }, [setPendingResult, stopPolling]);

  const handleAdd = () => {
    const prefilledName = result?.name?.trim() || '';
    if (prefilledName) {
      const nameNorm = normalizeMedicationName(prefilledName);
      const exists = medications.some((m) => normalizeMedicationName(m.name) === nameNorm);
      if (exists) {
        setToast({
          visible: true,
          message: 'Este medicamento ya está registrado.',
          type: 'error',
        });
        return;
      }
    }
    clearPendingResult();
    navigation.navigate('AddMedication', {
      prefilled: prefilledName ? { name: prefilledName } : {},
    });
  };

  const handleDismiss = () => {
    clearPendingResult();
    setResult(null);
    resetAttemptGuards();
    setPhase('step1');
  };

  const speakText = result
    ? [
        result.name,
        result.activeIngredient ? `Principio activo: ${result.activeIngredient}` : '',
        result.purpose || '',
        ...(result.importantPoints || []).slice(0, 3),
      ]
        .filter(Boolean)
        .join('. ')
    : '';

  const cardBg = isHighContrast
    ? colors.surface
    : isDark
      ? colors.surfaceElevated
      : BrandColors.white;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {flashOn ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: BrandColors.white, zIndex: 50 }]}
        />
      ) : null}

      <Header title="Identificar" showBack onBack={() => navigation.goBack()} editorial />

      <Screen scroll padded contentStyle={{ paddingBottom: scaleSpacing(Space[40]) }}>
        <EditorialText
          variant="headline"
          accessibilityRole="header"
          style={{
            fontSize: scaleFont(compact ? 28 : 32),
            lineHeight: scaleFont(compact ? 34 : 38),
            marginBottom: scaleSpacing(Space[8]),
          }}
        >
          Usa la cámara LIA
        </EditorialText>

        <AppText
          variant="body"
          tone="secondary"
          style={{ marginBottom: scaleSpacing(Space[20]), maxWidth: 420, flexShrink: 1 }}
        >
          Te guiamos paso a paso. No hay botón de foto en la app: usa el botón rojo de la cámara.
        </AppText>

        {phase === 'step1' || phase === 'step2' || phase === 'step3' ? (
          <SpeakButton
            id="camera-guide"
            label="Escuchar instrucciones"
            stopLabel="Detener"
            text={SPEECH_CAMERA_GUIDE}
            style={{ marginBottom: scaleSpacing(Space[16]) }}
          />
        ) : null}

        {phase === 'step1' ? (
          <SurfaceCard variant="default" style={{ backgroundColor: cardBg }}>
            <View style={styles.stepNumRow}>
              <View
                style={[
                  styles.stepNum,
                  {
                    backgroundColor: isHighContrast ? colors.textPrimary : BrandColors.navy,
                    minWidth: Math.max(40, minTouch * 0.75),
                    minHeight: Math.max(40, minTouch * 0.75),
                  },
                ]}
              >
                <AppText
                  variant="h3"
                  style={{ color: isHighContrast ? colors.background : BrandColors.white }}
                >
                  1
                </AppText>
              </View>
              <AppText variant="medicationName" style={{ flex: 1, flexShrink: 1 }}>
                Ubica la cámara
              </AppText>
            </View>
            <AppText variant="body" tone="secondary" style={{ marginTop: scaleSpacing(Space[12]) }}>
              Pon la cámara sobre una superficie firme y bien apoyada.
            </AppText>
            <Button
              title="Siguiente"
              onPress={() => setPhase('step2')}
              style={{ marginTop: scaleSpacing(Space[20]) }}
            />
          </SurfaceCard>
        ) : null}

        {phase === 'step2' ? (
          <SurfaceCard variant="default" style={{ backgroundColor: cardBg }}>
            <View style={styles.stepNumRow}>
              <View
                style={[
                  styles.stepNum,
                  {
                    backgroundColor: isHighContrast ? colors.textPrimary : BrandColors.navy,
                    minWidth: Math.max(40, minTouch * 0.75),
                    minHeight: Math.max(40, minTouch * 0.75),
                  },
                ]}
              >
                <AppText
                  variant="h3"
                  style={{ color: isHighContrast ? colors.background : BrandColors.white }}
                >
                  2
                </AppText>
              </View>
              <AppText variant="medicationName" style={{ flex: 1, flexShrink: 1 }}>
                Coloca el medicamento
              </AppText>
            </View>
            <AppText variant="body" tone="secondary" style={{ marginTop: scaleSpacing(Space[12]) }}>
              Pon la caja o el frasco frente a la cámara, a unos 15–20 cm, con el nombre visible.
            </AppText>
            <Button
              title="Siguiente"
              onPress={() => void startSessionAndPoll()}
              style={{ marginTop: scaleSpacing(Space[20]) }}
              accessibilityLabel="Siguiente"
              accessibilityHint="Pasa a esperar la identificación con el pulsador físico de LIA"
            />
          </SurfaceCard>
        ) : null}

        {phase === 'waiting' ? (
          <View
            style={styles.waitingWrap}
            accessibilityLabel="Presiona el pulsador físico de LIA. LIA está identificando tu medicamento"
          >
            <View style={[styles.stepNumRow, { marginBottom: scaleSpacing(Space[16]) }]}>
              <View
                style={[
                  styles.stepNum,
                  {
                    backgroundColor: isHighContrast ? colors.textPrimary : BrandColors.navy,
                    minWidth: Math.max(40, minTouch * 0.75),
                    minHeight: Math.max(40, minTouch * 0.75),
                  },
                ]}
              >
                <AppText
                  variant="h3"
                  style={{ color: isHighContrast ? colors.background : BrandColors.white }}
                >
                  3
                </AppText>
              </View>
              <AppText variant="medicationName" style={{ flex: 1, flexShrink: 1 }}>
                Presiona el pulsador físico de LIA
              </AppText>
            </View>
            <ActivityIndicator size="large" color={colors.primary} />
            <AppText
              variant="body"
              style={{ marginTop: scaleSpacing(Space[16]), textAlign: 'center', flexShrink: 1 }}
            >
              LIA está identificando tu medicamento…
            </AppText>
            <AppText
              variant="caption"
              tone="secondary"
              style={{
                marginTop: scaleSpacing(Space[8]),
                textAlign: 'center',
                flexShrink: 1,
              }}
            >
              Usa el pulsador físico de la cámara. No hay captura desde la app.
            </AppText>
          </View>
        ) : null}

        {(phase === 'error' || phase === 'expired') && errorMsg ? (
          <View>
            <EmptyLike message={errorMsg} />
            <Button
              title="Intentar de nuevo"
              onPress={() => {
                setErrorMsg(null);
                setResult(null);
                resetAttemptGuards();
                setPhase('step1');
              }}
              style={{ marginTop: scaleSpacing(Space[16]) }}
            />
            <Button
              title="Volver"
              variant="outline"
              onPress={() => navigation.goBack()}
              style={{ marginTop: scaleSpacing(Space[8]) }}
            />
          </View>
        ) : null}

        {phase === 'result' && result ? (
          <SurfaceCard
            variant="emphasis"
            style={{
              backgroundColor: isHighContrast
                ? colors.surface
                : isDark
                  ? colors.surfaceElevated
                  : BrandColors.white,
              borderColor: lightChrome ? BrandColors.skyBlue : colors.border,
              borderWidth: isHighContrast ? 2 : 1,
            }}
          >
            <AppText
              variant="overline"
              style={{
                color: isHighContrast ? colors.textSecondary : isDark ? colors.primary : BrandColors.teal,
                marginBottom: scaleSpacing(Space[8]),
              }}
            >
              Medicamento identificado
            </AppText>
            <AppText variant="medicationName" style={{ flexShrink: 1 }}>
              {result.name.trim() ? result.name : 'Medicamento identificado'}
            </AppText>
            {result.activeIngredient ? (
              <AppText variant="body" tone="secondary" style={{ marginTop: 4, flexShrink: 1 }}>
                {`Principio activo: ${result.activeIngredient}`}
              </AppText>
            ) : null}
            {result.purpose ? (
              <View style={{ marginTop: scaleSpacing(Space[12]) }}>
                <AppText variant="label" style={{ marginBottom: scaleSpacing(Space[8]) }}>
                  ¿Para qué se utiliza?
                </AppText>
                <AppText variant="body" style={{ flexShrink: 1 }}>
                  {result.purpose}
                </AppText>
              </View>
            ) : null}
            {result.importantPoints.length > 0 ? (
              <View style={{ marginTop: scaleSpacing(Space[12]), gap: scaleSpacing(Space[8]) }}>
                <AppText variant="label">Puntos importantes</AppText>
                {result.importantPoints.slice(0, 4).map((p, i) => (
                  <AppText key={`${i}-${p.slice(0, 12)}`} variant="body" style={{ flexShrink: 1 }}>
                    {`· ${p}`}
                  </AppText>
                ))}
              </View>
            ) : null}
            {result.source ? (
              <AppText variant="caption" tone="muted" style={{ marginTop: scaleSpacing(Space[12]) }}>
                {result.source}
              </AppText>
            ) : null}

            {voiceEnabled && speakText ? (
              <SpeakButton
                id={`camera-result-${result.name}`}
                label="Escuchar"
                stopLabel="Detener"
                text={speakText}
                style={{ marginTop: scaleSpacing(Space[16]) }}
              />
            ) : null}

            <View style={{ gap: scaleSpacing(Space[8]), marginTop: scaleSpacing(Space[16]) }}>
              <Button title="Agregar medicamento" onPress={handleAdd} />
              <Button title="Ahora no" variant="outline" onPress={handleDismiss} />
            </View>
          </SurfaceCard>
        ) : null}
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

function EmptyLike({ message }: { message: string }) {
  const { scaleSpacing, scaleFont } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: scaleSpacing(Space[24]) }}>
      <Ionicons
        name="alert-circle-outline"
        size={scaleFont(40)}
        color={isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.navy}
      />
      <AppText
        variant="body"
        style={{ marginTop: scaleSpacing(Space[12]), textAlign: 'center', flexShrink: 1 }}
      >
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stepNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  stepNum: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  redHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: Space[16],
  },
  redDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#C45C5C',
    flexShrink: 0,
  },
  waitingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
});
