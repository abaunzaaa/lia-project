import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  ImageSourcePropType,
  ActivityIndicator,
  AccessibilityInfo,
  Pressable,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import {
  AppText,
  Button,
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
import { BrandColors, liaCardBorder } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
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

type GuidePhase = 'step1' | 'step2' | 'waiting' | 'capturing' | 'result' | 'expired' | 'error';

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

/** Soft surface used on Recordatorios pending cards. */
const SOFT_BLUE = '#EAF3F7';

const STEP_IMAGES = {
  position: require('../assets/images/camera-step-position.png'),
  medication: require('../assets/images/camera-step-medication.png'),
  button: require('../assets/images/camera-step-button.png'),
} as const;

export default function CameraGuideScreen({ navigation }: Props) {
  const { scaleSpacing, scaleFont, minTouch, voiceEnabled } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const lightChrome = !isDark && !isHighContrast;
  const { width, horizontalPadding } = useResponsive();
  const { medications } = useMedications();
  const { setPendingResult, clearPendingResult } = useCameraRecognition();
  const insets = useSafeAreaInsets();

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

  const pageBg = lightChrome ? BrandColors.white : colors.background;
  const ink = lightChrome ? BrandColors.navy : colors.textPrimary;
  const muted = lightChrome ? BrandColors.teal : colors.textSecondary;
  const teal = lightChrome ? BrandColors.teal : colors.primary;
  const cardBorder = liaCardBorder(lightChrome, colors.border);
  const lineColor = lightChrome ? BrandColors.skyBlue : colors.border;
  const nodeSize = 18;
  const artSize = Math.round(Math.min(118, Math.max(92, width * 0.28)));

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

  const currentStep = phase === 'step1' ? 1 : phase === 'step2' ? 2 : 3;

  useEffect(() => {
    if (phase === 'step1' || phase === 'step2' || phase === 'waiting' || phase === 'capturing') {
      AccessibilityInfo.announceForAccessibility(`Paso ${currentStep} de 3`);
    }
  }, [phase, currentStep]);

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

          if (current.status === 'processing') {
            setPhase('capturing');
            return;
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

  const showGuide =
    phase === 'step1' || phase === 'step2' || phase === 'waiting' || phase === 'capturing';

  const steps: {
    id: 1 | 2 | 3;
    label: string;
    title: string;
    body: string;
    hint?: string;
    image: ImageSourcePropType;
  }[] = [
    {
      id: 1,
      label: 'Paso 1',
      title: 'Ubica la cámara',
      body: 'Déjala firme sobre una superficie estable.',
      image: STEP_IMAGES.position,
    },
    {
      id: 2,
      label: 'Paso 2',
      title: 'Coloca el medicamento',
      body: 'Pon la caja de frente, dentro del área marcada.',
      image: STEP_IMAGES.medication,
    },
    {
      id: 3,
      label: 'Paso 3',
      title: 'Presiona el pulsador',
      body: 'Pulsa una vez el botón físico de la cámara.',
      hint: 'Mantén la caja quieta.',
      image: STEP_IMAGES.button,
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      {flashOn ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: BrandColors.white, zIndex: 50 }]}
        />
      ) : null}

      <Screen
        scroll
        transparent
        padded={false}
        contentStyle={{
          paddingTop: insets.top + scaleSpacing(Space[4]),
          paddingHorizontal: horizontalPadding,
          paddingBottom: scaleSpacing(Space[32]),
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={({ pressed }) => [
            styles.backBtn,
            {
              minWidth: minTouch,
              minHeight: minTouch,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={26} color={ink} />
        </Pressable>

        <AppText
          variant="label"
          tone="secondary"
          style={{ marginTop: scaleSpacing(Space[4]) }}
        >
          Identificar con cámara
        </AppText>

        {showGuide ? (
          <View style={{ marginBottom: scaleSpacing(Space[20]) }}>
            <AppText
              variant="h1"
              accessibilityRole="header"
              style={{
                color: ink,
                fontSize: scaleFont(26),
                lineHeight: scaleFont(32),
                letterSpacing: -0.2,
                fontWeight: '600',
                marginTop: scaleSpacing(Space[8]),
                marginBottom: scaleSpacing(Space[8]),
              }}
            >
              Prepara la cámara de LÍA
            </AppText>
            <AppText
              variant="body"
              style={{
                color: muted,
                flexShrink: 1,
              }}
            >
              Sigue estos pasos para identificar tu medicamento.
            </AppText>
          </View>
        ) : null}

        {showGuide && voiceEnabled ? (
          <SpeakButton
            id="camera-guide"
            label="Escuchar instrucciones"
            stopLabel="Detener"
            text={SPEECH_CAMERA_GUIDE}
            style={{ marginBottom: scaleSpacing(Space[16]) }}
          />
        ) : null}

        {showGuide ? (
          <View style={styles.timeline}>
            {steps.map((step) => {
              const active = currentStep === step.id;
              const done = currentStep > step.id;
              const identifying = step.id === 3 && active && phase === 'capturing';
              const nodeLabel = done
                ? `${step.label}, completado`
                : active
                  ? identifying
                    ? `${step.label}, identificando medicamento`
                    : `${step.label}, actual`
                  : `${step.label}, pendiente`;

              return (
                <View
                  key={step.id}
                  style={[styles.stepRow, { marginBottom: scaleSpacing(Space[12]) }]}
                >
                  <View style={[styles.nodeCol, { width: nodeSize }]}>
                    <View
                      accessible
                      accessibilityRole="image"
                      accessibilityLabel={nodeLabel}
                      style={[
                        styles.node,
                        {
                          width: nodeSize,
                          height: nodeSize,
                          borderRadius: nodeSize / 2,
                          backgroundColor: done
                            ? ink
                            : active
                              ? BrandColors.white
                              : lightChrome
                                ? BrandColors.white
                                : colors.surface,
                          borderWidth: done ? 0 : active ? 2 : 1.5,
                          borderColor: done ? ink : active ? teal : lineColor,
                        },
                      ]}
                    >
                      {done ? (
                        <Ionicons name="checkmark" size={11} color={BrandColors.white} />
                      ) : active ? (
                        <View
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 4,
                            backgroundColor: ink,
                          }}
                        />
                      ) : null}
                    </View>
                    {step.id < 3 ? (
                      <View
                        style={[
                          styles.nodeStem,
                          { backgroundColor: lineColor, marginTop: 6 },
                        ]}
                      />
                    ) : null}
                  </View>

                  <View
                    style={[
                      styles.stepCard,
                      {
                        backgroundColor: active
                          ? lightChrome
                            ? SOFT_BLUE
                            : colors.surfaceElevated
                          : lightChrome
                            ? BrandColors.white
                            : colors.surface,
                        borderColor: active ? teal : isHighContrast ? colors.border : cardBorder,
                        borderWidth: isHighContrast ? 2 : active ? 1.5 : 1,
                        minHeight: identifying ? 176 : 150,
                        paddingVertical: scaleSpacing(Space[12]),
                        paddingHorizontal: scaleSpacing(Space[16]),
                        shadowOpacity: lightChrome ? (active ? 0.08 : 0.05) : 0,
                        elevation: lightChrome ? (active ? 2 : 1) : 0,
                      },
                    ]}
                  >
                    <View style={styles.cardRow}>
                      <View style={styles.cardCopy}>
                        <AppText
                          variant="body"
                          style={{
                            color: muted,
                            fontSize: scaleFont(18),
                            fontWeight: '600',
                            letterSpacing: -0.3,
                            marginBottom: 4,
                          }}
                        >
                          {step.label}
                        </AppText>
                        <AppText
                          variant="h3"
                          style={{
                            color: ink,
                            flexShrink: 1,
                            fontWeight: '600',
                          }}
                        >
                          {identifying ? 'Identificando medicamento' : step.title}
                        </AppText>
                        <AppText
                          variant="body"
                          style={{ color: muted, marginTop: 8, flexShrink: 1 }}
                        >
                          {identifying
                            ? 'Espera un momento mientras LÍA analiza la imagen.'
                            : step.body}
                        </AppText>
                        {active && step.hint && !identifying ? (
                          <AppText
                            variant="body"
                            style={{ color: muted, marginTop: 6, flexShrink: 1 }}
                          >
                            {step.hint}
                          </AppText>
                        ) : null}
                        {identifying ? (
                          <View
                            style={styles.identifyingRow}
                            accessibilityRole="progressbar"
                            accessibilityLabel="Identificando medicamento"
                          >
                            <ActivityIndicator size="small" color={teal} />
                          </View>
                        ) : null}
                      </View>

                      <View
                        style={[styles.cardArt, { width: artSize, minHeight: artSize }]}
                        accessibilityElementsHidden
                      >
                        <Image
                          source={step.image}
                          style={{ width: artSize, height: artSize }}
                          resizeMode="contain"
                          accessibilityIgnoresInvertColors
                        />
                      </View>
                    </View>

                    {step.id === 1 && active ? (
                      <Button
                        title="Cámara ubicada"
                        size="md"
                        onPress={() => setPhase('step2')}
                        style={{ marginTop: scaleSpacing(Space[12]), minHeight: minTouch }}
                        accessibilityLabel="Cámara ubicada"
                        accessibilityHint="Continúa al paso 2"
                      />
                    ) : null}

                    {step.id === 2 && active ? (
                      <Button
                        title="Medicamento listo"
                        size="md"
                        onPress={() => void startSessionAndPoll()}
                        style={{ marginTop: scaleSpacing(Space[12]), minHeight: minTouch }}
                        accessibilityLabel="Medicamento listo"
                        accessibilityHint="Pasa a esperar el pulsador físico de la cámara"
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
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
  backBtn: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  timeline: {
    width: '100%',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    width: '100%',
  },
  nodeCol: {
    alignItems: 'center',
    paddingTop: 16,
    flexShrink: 0,
  },
  node: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nodeStem: {
    width: 1,
    flex: 1,
    minHeight: 12,
    borderRadius: 1,
  },
  stepCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: Radius.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  cardArt: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  identifyingRow: {
    marginTop: 10,
    alignItems: 'flex-start',
  },
});
