import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Medication, MedicationFormData } from '../types';
import AppText from './AppText';
import Button from './Button';
import EditorialText from './EditorialText';
import Header from './Header';
import Input from './Input';
import Toast from './Toast';
import TimeOfDayPicker from './TimeOfDayPicker';
import DateFieldPicker from './DateFieldPicker';
import OptionPickerModal from './OptionPickerModal';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import { normalizeMedicationName, normalizeScheduleTimes } from '../utils/helpers';
import { useMedications } from '../context/MedicationContext';
import {
  DOSE_UNITS,
  DoseUnitOption,
  FREQ_MODE_OPTIONS,
  FreqMode,
  INTERVAL_OPTIONS,
  buildDoseString,
  defaultTimesForMode,
  estimatedStockNeeded,
  formatShortDate,
  frequencyFromMode,
  generateSameDayTimes,
  intakePromptForUnit,
  isCountDoseUnit,
  modeFromFrequency,
  parseDoseString,
  summarizeSchedules,
  todayYmd,
  unitSingularLabel,
} from '../utils/medicationFormHelpers';

type Props = {
  mode: 'add' | 'edit';
  initial?: Partial<Medication> | null;
  loading?: boolean;
  onSubmit: (data: MedicationFormData) => Promise<void>;
  onCancel: () => void;
};

const INTAKE_OPTIONS = ['1', '2', '3', '4', '5'] as const;

export default function MedicationForm({
  mode,
  initial,
  loading = false,
  onSubmit,
  onCancel,
}: Props) {
  const { scaleSpacing, scaleFont, minTouch, isSeniorMode } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { horizontalPadding, contentMaxWidth, isSmallPhone } = useResponsive();
  const { medications } = useMedications();
  const stackDose = isSmallPhone || isSeniorMode;

  const parsedDose = parseDoseString(initial?.dose || '');
  const freqInit = modeFromFrequency(initial?.frequency || '24h');
  const initialTimes =
    initial?.schedules && initial.schedules.length > 0
      ? initial.schedules.map((s) => s.time)
      : initial?.time
        ? [initial.time]
        : defaultTimesForMode(freqInit.mode, freqInit.intervalHours);

  const initialUnits =
    initial?.unitsPerIntake != null && initial.unitsPerIntake > 0
      ? String(Math.min(5, Math.max(1, Math.floor(initial.unitsPerIntake))))
      : parsedDose.amount && isCountDoseUnit(parsedDose.unit)
        ? String(Math.min(5, Math.max(1, Math.round(Number(parsedDose.amount)) || 1)))
        : '1';

  const [step, setStep] = useState(1);
  const [name, setName] = useState(initial?.name || '');
  const [doseAmount, setDoseAmount] = useState(
    isCountDoseUnit(parsedDose.unit) ? initialUnits : parsedDose.amount
  );
  const [doseUnit, setDoseUnit] = useState<DoseUnitOption>(parsedDose.unit);
  const [customUnit, setCustomUnit] = useState(parsedDose.customUnit);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [intakePickerOpen, setIntakePickerOpen] = useState(false);

  const [freqMode, setFreqMode] = useState<FreqMode>(freqInit.mode);
  const [intervalHours, setIntervalHours] = useState(freqInit.intervalHours);
  const [intervalPickerOpen, setIntervalPickerOpen] = useState(false);
  const [times, setTimes] = useState<string[]>(initialTimes);

  const [startDate, setStartDate] = useState(initial?.startDate || todayYmd());
  const [hasEndDate, setHasEndDate] = useState(Boolean(initial?.endDate));
  const [endDate, setEndDate] = useState(initial?.endDate || todayYmd());
  const [showInstructions, setShowInstructions] = useState(
    Boolean(initial?.description?.trim())
  );
  const [instructions, setInstructions] = useState(initial?.description || '');
  const [quantity, setQuantity] = useState(
    initial?.quantity != null && initial.quantity > 0 ? String(initial.quantity) : ''
  );

  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ visible: false, message: '', type: 'error' });

  const countUnit = isCountDoseUnit(doseUnit);
  const unitsPerIntakeNum = countUnit
    ? Math.min(5, Math.max(1, parseInt(doseAmount, 10) || 1))
    : undefined;

  const surface = isHighContrast
    ? colors.surface
    : isDark
      ? colors.surfaceElevated
      : BrandColors.white;

  const dosePreview = buildDoseString(doseAmount, doseUnit, customUnit);

  const applyFreqMode = (next: FreqMode) => {
    setFreqMode(next);
    if (next === 'custom') {
      setTimes((prev) => (prev.length ? prev : ['08:00']));
      return;
    }
    if (next === 'interval') {
      setTimes(generateSameDayTimes(times[0] || '08:00', intervalHours));
      return;
    }
    setTimes(defaultTimesForMode(next, intervalHours));
  };

  const setTimeAt = (index: number, hhmm: string) => {
    setTimes((prev) => {
      const next = [...prev];
      if (next.includes(hhmm) && next[index] !== hhmm) {
        setToast({
          visible: true,
          message: 'Esta hora ya fue agregada.',
          type: 'error',
        });
        return prev;
      }
      next[index] = hhmm;
      return next;
    });
    if (freqMode === 'interval' && index === 0) {
      setTimes(generateSameDayTimes(hhmm, intervalHours));
    }
  };

  const addCustomTime = () => {
    const candidates = ['08:00', '12:00', '14:00', '18:00', '20:00', '22:00'];
    const pick = candidates.find((c) => !times.includes(c)) || '09:00';
    if (times.includes(pick)) {
      setToast({ visible: true, message: 'Esta hora ya fue agregada.', type: 'error' });
      return;
    }
    setTimes((prev) => [...prev, pick]);
  };

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!name.trim()) return 'Escribe el nombre del medicamento.';
      if (countUnit) {
        if (!doseAmount.trim() || !INTAKE_OPTIONS.includes(doseAmount as (typeof INTAKE_OPTIONS)[number])) {
          return 'Indica cuántas unidades tomas cada vez.';
        }
      } else {
        if (!doseAmount.trim()) return 'Indica la dosis del medicamento.';
        const n = Number(doseAmount.replace(',', '.'));
        if (!Number.isFinite(n) || n <= 0) return 'La dosis debe ser un número mayor que cero.';
      }
      if (doseUnit === 'otro' && !customUnit.trim()) {
        return 'Escribe la unidad de la dosis.';
      }
      if (!buildDoseString(doseAmount, doseUnit, customUnit)) {
        return 'Indica la dosis del medicamento.';
      }
    }
    if (s === 2) {
      if (times.length === 0) return 'Selecciona al menos una hora.';
      try {
        normalizeScheduleTimes(times);
      } catch (e) {
        return e instanceof Error ? e.message : 'Revisa los horarios.';
      }
    }
    if (s === 3) {
      if (hasEndDate && endDate < startDate) {
        return 'La fecha de finalización debe ser posterior al inicio.';
      }
      if (hasEndDate && quantity.trim() && countUnit) {
        const stock = Math.max(0, Math.floor(Number(quantity)));
        const needed = estimatedStockNeeded({
          startYmd: startDate,
          endYmd: endDate,
          dosesPerDay: Math.max(1, times.length),
          unitsPerIntake: unitsPerIntakeNum ?? 1,
        });
        if (needed > 0 && stock < needed) {
          return `Necesitas al menos ${needed} ${unitSingularLabel(doseUnit)} para cubrir el tratamiento.`;
        }
      }
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      setToast({ visible: true, message: err, type: 'error' });
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const goBack = () => {
    if (step === 1) {
      onCancel();
      return;
    }
    setStep((s) => s - 1);
  };

  const handleSave = async () => {
    const err = validateStep(1) || validateStep(2) || validateStep(3);
    if (err) {
      setToast({ visible: true, message: err, type: 'error' });
      return;
    }

    const nameNorm = normalizeMedicationName(name);
    const duplicate = medications.some((m) => {
      if (mode === 'edit' && initial?.id && m.id === initial.id) return false;
      return normalizeMedicationName(m.name) === nameNorm;
    });
    if (duplicate) {
      setToast({
        visible: true,
        message: 'Este medicamento ya está registrado.',
        type: 'error',
      });
      return;
    }

    let schedules: string[];
    try {
      schedules = normalizeScheduleTimes(times);
    } catch (e) {
      setToast({
        visible: true,
        message: e instanceof Error ? e.message : 'Revisa los horarios.',
        type: 'error',
      });
      return;
    }

    const qty = quantity.trim() ? Math.max(0, Math.floor(Number(quantity))) : undefined;

    await onSubmit({
      name: name.trim(),
      dose: buildDoseString(doseAmount, doseUnit, customUnit),
      quantity: qty,
      unitsPerIntake: unitsPerIntakeNum,
      frequency: frequencyFromMode(freqMode, intervalHours),
      schedules,
      startDate,
      endDate: hasEndDate ? endDate : undefined,
      description: showInstructions ? instructions.trim() || undefined : undefined,
    });
  };

  const stepTitle = useMemo(() => {
    if (step === 1) return '¿Qué medicamento vas a registrar?';
    if (step === 2) return '¿Cuándo lo tomas?';
    return '¿Por cuánto tiempo?';
  }, [step]);

  const timeLabels =
    freqMode === 'once'
      ? ['¿A qué hora?']
      : freqMode === 'twice'
        ? ['Primera toma', 'Segunda toma']
        : freqMode === 'thrice'
          ? ['Primera toma', 'Segunda toma', 'Tercera toma']
          : times.map((_, i) => `Toma ${i + 1}`);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title={mode === 'add' ? 'Agregar medicamento' : 'Editar medicamento'}
        showBack
        onBack={goBack}
        editorial
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingBottom: scaleSpacing(Space[40]),
          maxWidth: contentMaxWidth,
          width: '100%',
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="caption" tone="secondary" style={{ marginBottom: scaleSpacing(Space[8]) }}>
          {`Paso ${step} de 3`}
        </AppText>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(step / 3) * 100}%`,
                backgroundColor: isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal,
              },
            ]}
          />
        </View>

        <EditorialText
          variant="subhead"
          style={{
            fontSize: scaleFont(isSmallPhone ? 24 : 28),
            lineHeight: scaleFont(isSmallPhone ? 30 : 34),
            marginTop: scaleSpacing(Space[16]),
            marginBottom: scaleSpacing(Space[20]),
            flexShrink: 1,
          }}
        >
          {stepTitle}
        </EditorialText>

        {step === 1 ? (
          <View>
            <Input
              label="Nombre del medicamento"
              placeholder="Ej. Losartán"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <AppText variant="label" style={{ marginBottom: scaleSpacing(Space[4]) }}>
              Dosis
            </AppText>
            <AppText
              variant="caption"
              tone="secondary"
              style={{ marginBottom: scaleSpacing(Space[8]), flexShrink: 1 }}
            >
              Lo que tomas cada vez
            </AppText>

            <View
              style={[
                styles.doseRow,
                stackDose && styles.doseStack,
                { gap: scaleSpacing(Space[8]) },
              ]}
            >
              {countUnit ? (
                <Pressable
                  onPress={() => setIntakePickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={intakePromptForUnit(doseUnit)}
                  style={({ pressed }) => [
                    styles.unitBtn,
                    {
                      minHeight: minTouch,
                      backgroundColor: surface,
                      borderColor: colors.border,
                      borderWidth: isHighContrast ? 2 : 1,
                      opacity: pressed ? 0.9 : 1,
                      flex: stackDose ? undefined : 1,
                      width: stackDose ? '100%' : undefined,
                    },
                  ]}
                >
                  <AppText variant="body" style={{ fontWeight: '600', flexShrink: 1 }}>
                    {doseAmount || '1'}
                  </AppText>
                  <Ionicons
                    name="chevron-down"
                    size={scaleFont(18)}
                    color={isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal}
                  />
                </Pressable>
              ) : (
                <View style={[styles.doseAmount, stackDose && { width: '100%' }]}>
                  <TextInput
                    value={doseAmount}
                    onChangeText={(t) => {
                      const cleaned = t.replace(/[^0-9.,]/g, '');
                      setDoseAmount(cleaned);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="50"
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel="Cantidad de la dosis"
                    style={[
                      styles.doseInput,
                      {
                        minHeight: minTouch,
                        fontSize: scaleFont(18),
                        color: colors.textPrimary,
                        backgroundColor: surface,
                        borderColor: colors.border,
                        borderWidth: isHighContrast ? 2 : 1,
                      },
                    ]}
                  />
                </View>
              )}
              <Pressable
                onPress={() => setUnitPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Unidad: ${doseUnit === 'otro' ? customUnit || 'otro' : doseUnit}`}
                style={({ pressed }) => [
                  styles.unitBtn,
                  {
                    minHeight: minTouch,
                    backgroundColor: surface,
                    borderColor: colors.border,
                    borderWidth: isHighContrast ? 2 : 1,
                    opacity: pressed ? 0.9 : 1,
                    flex: stackDose ? undefined : 1,
                    width: stackDose ? '100%' : undefined,
                  },
                ]}
              >
                <AppText variant="body" style={{ fontWeight: '600', flexShrink: 1 }}>
                  {doseUnit === 'otro' ? customUnit || 'Otro' : doseUnit}
                </AppText>
                <Ionicons
                  name="chevron-down"
                  size={scaleFont(18)}
                  color={isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal}
                />
              </Pressable>
            </View>

            {countUnit ? (
              <AppText
                variant="caption"
                tone="secondary"
                style={{ marginTop: scaleSpacing(Space[8]), flexShrink: 1 }}
              >
                {intakePromptForUnit(doseUnit)}
              </AppText>
            ) : null}

            {doseUnit === 'otro' ? (
              <Input
                label="Escribe la unidad"
                placeholder="Ej. medida"
                value={customUnit}
                onChangeText={setCustomUnit}
              />
            ) : null}

            {dosePreview ? (
              <AppText variant="caption" tone="secondary" style={{ marginTop: scaleSpacing(Space[4]) }}>
                {`Se guardará como: ${dosePreview}`}
              </AppText>
            ) : null}

            <View style={{ marginTop: scaleSpacing(Space[24]) }}>
              <AppText variant="label" style={{ marginBottom: scaleSpacing(Space[4]) }}>
                Stock
              </AppText>
              <AppText
                variant="caption"
                tone="secondary"
                style={{ marginBottom: scaleSpacing(Space[8]), flexShrink: 1 }}
              >
                Lo que tienes disponible
              </AppText>
              <Input
                label="Cantidad disponible"
                placeholder="Ej. 30"
                value={quantity}
                onChangeText={(t) => setQuantity(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                accessibilityLabel="Cantidad disponible"
              />
              {countUnit && quantity.trim() ? (
                <View
                  style={[
                    styles.stockVisual,
                    {
                      backgroundColor: isHighContrast
                        ? colors.surface
                        : isDark
                          ? colors.surfaceElevated
                          : BrandColors.white,
                      borderColor: isHighContrast ? colors.border : BrandColors.skyBlue,
                      borderWidth: isHighContrast ? 2 : 1,
                      marginTop: scaleSpacing(Space[8]),
                      padding: scaleSpacing(Space[12]),
                    },
                  ]}
                  accessibilityLabel={`Quedan ${quantity} ${unitSingularLabel(doseUnit)}`}
                >
                  <Ionicons
                    name="file-tray-full-outline"
                    size={scaleFont(22)}
                    color={isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal}
                  />
                  <AppText variant="body" style={{ flexShrink: 1, fontWeight: '600' }}>
                    {`Quedan ${quantity} ${unitSingularLabel(doseUnit)}`}
                  </AppText>
                </View>
              ) : countUnit ? (
                <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
                  {`Unidad: ${unitSingularLabel(doseUnit)}`}
                </AppText>
              ) : doseUnit !== 'otro' ? (
                <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
                  {`Unidad: ${doseUnit}`}
                </AppText>
              ) : null}
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <AppText variant="label" style={{ marginBottom: scaleSpacing(Space[12]) }}>
              Frecuencia
            </AppText>
            <View style={{ gap: scaleSpacing(Space[8]), marginBottom: scaleSpacing(Space[20]) }}>
              {FREQ_MODE_OPTIONS.map((opt) => {
                const selected = freqMode === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => applyFreqMode(opt.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={opt.label}
                    style={({ pressed }) => [
                      styles.freqCard,
                      {
                        minHeight: minTouch,
                        backgroundColor: selected
                          ? isHighContrast
                            ? colors.surface
                            : isDark
                              ? colors.accentSoft
                              : BrandColors.skyBlue
                          : surface,
                        borderColor: selected
                          ? isHighContrast
                            ? colors.textPrimary
                            : isDark
                              ? colors.primary
                              : BrandColors.navy
                          : colors.border,
                        borderWidth: selected || isHighContrast ? 2 : 1,
                        opacity: pressed ? 0.9 : 1,
                        paddingHorizontal: scaleSpacing(Space[16]),
                      },
                    ]}
                  >
                    <AppText variant="body" style={{ fontWeight: selected ? '700' : '500', flexShrink: 1 }}>
                      {opt.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            {freqMode === 'interval' ? (
              <View style={{ marginBottom: scaleSpacing(Space[16]) }}>
                <AppText variant="label" style={{ marginBottom: scaleSpacing(Space[8]) }}>
                  Cada
                </AppText>
                <Pressable
                  onPress={() => setIntervalPickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Cada ${intervalHours} horas`}
                  style={({ pressed }) => [
                    styles.unitBtn,
                    {
                      minHeight: minTouch,
                      backgroundColor: surface,
                      borderColor: colors.border,
                      borderWidth: isHighContrast ? 2 : 1,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <AppText variant="body" style={{ fontWeight: '600' }}>
                    {`${intervalHours} horas`}
                  </AppText>
                  <Ionicons
                    name="chevron-down"
                    size={scaleFont(18)}
                    color={isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal}
                  />
                </Pressable>
                <AppText
                  variant="caption"
                  tone="secondary"
                  style={{ marginTop: scaleSpacing(Space[8]), flexShrink: 1 }}
                >
                  ¿A qué hora empieza?
                </AppText>
              </View>
            ) : null}

            {freqMode === 'interval' ? (
              <>
                <TimeOfDayPicker
                  label="Hora de inicio"
                  valueHhmm={times[0] || '08:00'}
                  onChange={(hhmm) => setTimes(generateSameDayTimes(hhmm, intervalHours))}
                />
                <AppText
                  variant="caption"
                  tone="secondary"
                  style={{ marginBottom: scaleSpacing(Space[16]), flexShrink: 1 }}
                >
                  {`Horarios del día: ${summarizeSchedules(times)}`}
                </AppText>
              </>
            ) : (
              times.map((t, index) => (
                <TimeOfDayPicker
                  key={`${index}-${times.length}`}
                  label={timeLabels[index] || `Toma ${index + 1}`}
                  valueHhmm={t}
                  onChange={(hhmm) => setTimeAt(index, hhmm)}
                  onRemove={
                    freqMode === 'custom' && times.length > 1
                      ? () => setTimes((prev) => prev.filter((_, i) => i !== index))
                      : undefined
                  }
                />
              ))
            )}
            {freqMode === 'custom' ? (
              <Button
                title="Agregar otra hora"
                variant="outline"
                onPress={addCustomTime}
                style={{ marginTop: scaleSpacing(Space[8]) }}
              />
            ) : null}
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <DateFieldPicker label="Empieza" valueYmd={startDate} onChange={setStartDate} />

            <Pressable
              onPress={() => setHasEndDate((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: hasEndDate }}
              accessibilityLabel="Este tratamiento tiene fecha de finalización"
              style={({ pressed }) => [
                styles.toggleRow,
                {
                  minHeight: minTouch,
                  opacity: pressed ? 0.9 : 1,
                  borderColor: colors.border,
                  backgroundColor: surface,
                  borderWidth: isHighContrast ? 2 : 1,
                  paddingHorizontal: scaleSpacing(Space[16]),
                },
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal,
                    backgroundColor: hasEndDate
                      ? isHighContrast
                        ? colors.textPrimary
                        : isDark
                          ? colors.primary
                          : BrandColors.teal
                      : 'transparent',
                  },
                ]}
              >
                {hasEndDate ? (
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={isHighContrast ? colors.background : isDark ? colors.onPrimary : BrandColors.white}
                  />
                ) : null}
              </View>
              <AppText variant="body" style={{ flex: 1, flexShrink: 1 }}>
                Este tratamiento tiene fecha de finalización
              </AppText>
            </Pressable>

            {hasEndDate ? (
              <DateFieldPicker
                label="Termina"
                valueYmd={endDate}
                onChange={setEndDate}
                minimumYmd={startDate}
              />
            ) : (
              <AppText
                variant="caption"
                tone="secondary"
                style={{ marginBottom: scaleSpacing(Space[16]) }}
              >
                Sin fecha de finalización
              </AppText>
            )}

            {!showInstructions ? (
              <Pressable
                onPress={() => setShowInstructions(true)}
                accessibilityRole="button"
                accessibilityLabel="Agregar indicaciones"
                style={{ minHeight: minTouch, justifyContent: 'center', marginBottom: scaleSpacing(Space[16]) }}
              >
                <AppText
                  variant="label"
                  style={{ color: isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal }}
                >
                  + Agregar indicaciones
                </AppText>
              </Pressable>
            ) : (
              <Input
                label="Indicaciones"
                placeholder="Ej. Tomar después del desayuno"
                value={instructions}
                onChangeText={setInstructions}
                multiline
              />
            )}

            <View
              style={[
                styles.summary,
                {
                  backgroundColor: isHighContrast
                    ? colors.surface
                    : isDark
                      ? colors.surfaceElevated
                      : BrandColors.white,
                  borderColor: isHighContrast ? colors.border : BrandColors.skyBlue,
                  borderWidth: isHighContrast ? 2 : 1,
                  padding: scaleSpacing(Space[16]),
                  marginTop: scaleSpacing(Space[8]),
                },
              ]}
            >
              <AppText variant="label" style={{ marginBottom: scaleSpacing(Space[8]) }}>
                Resumen
              </AppText>
              <AppText variant="medicationName" style={{ flexShrink: 1 }}>
                {name.trim() || 'Medicamento'}
              </AppText>
              <AppText variant="body" tone="secondary" style={{ marginTop: 4, flexShrink: 1 }}>
                {dosePreview || '—'}
              </AppText>
              <AppText variant="body" style={{ marginTop: scaleSpacing(Space[12]), flexShrink: 1 }}>
                {FREQ_MODE_OPTIONS.find((o) => o.id === freqMode)?.label}
              </AppText>
              <AppText variant="body" tone="secondary" style={{ marginTop: 4, flexShrink: 1 }}>
                {summarizeSchedules(times)}
              </AppText>
              <AppText variant="body" tone="secondary" style={{ marginTop: scaleSpacing(Space[12]), flexShrink: 1 }}>
                {`Desde ${formatShortDate(startDate)}`}
                {hasEndDate ? ` · Hasta ${formatShortDate(endDate)}` : ' · Sin fecha de finalización'}
              </AppText>
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: scaleSpacing(Space[24]), gap: scaleSpacing(Space[12]) }}>
          {step < 3 ? (
            <Button title="Continuar" onPress={goNext} disabled={loading} />
          ) : (
            <Button
              title={
                loading
                  ? 'Guardando…'
                  : mode === 'add'
                    ? 'Guardar medicamento'
                    : 'Guardar cambios'
              }
              onPress={() => void handleSave()}
              loading={loading}
              disabled={loading}
            />
          )}
          <Button
            title={step === 1 ? 'Cancelar' : 'Atrás'}
            variant="outline"
            onPress={goBack}
            disabled={loading}
          />
        </View>
      </ScrollView>

      <OptionPickerModal
        visible={unitPickerOpen}
        title="Unidad"
        selectedValue={doseUnit}
        options={DOSE_UNITS.map((u) => ({
          value: u,
          label: u === 'otro' ? 'Otro' : u,
        }))}
        onSelect={(v) => {
          const next = v as DoseUnitOption;
          setDoseUnit(next);
          if (isCountDoseUnit(next)) {
            const n = Math.min(5, Math.max(1, parseInt(doseAmount, 10) || 1));
            setDoseAmount(String(n));
          }
          setUnitPickerOpen(false);
        }}
        onClose={() => setUnitPickerOpen(false)}
      />

      <OptionPickerModal
        visible={intakePickerOpen}
        title={intakePromptForUnit(doseUnit)}
        selectedValue={doseAmount || '1'}
        options={INTAKE_OPTIONS.map((n) => ({ value: n, label: n }))}
        onSelect={(v) => {
          setDoseAmount(v);
          setIntakePickerOpen(false);
        }}
        onClose={() => setIntakePickerOpen(false)}
      />

      <OptionPickerModal
        visible={intervalPickerOpen}
        title="Cada cuántas horas"
        selectedValue={String(intervalHours)}
        options={INTERVAL_OPTIONS.map((o) => ({
          value: String(o.hours),
          label: o.label,
        }))}
        onSelect={(v) => {
          const h = parseInt(v, 10);
          setIntervalHours(h);
          setTimes(generateSameDayTimes(times[0] || '08:00', h));
          setIntervalPickerOpen(false);
        }}
        onClose={() => setIntervalPickerOpen(false)}
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
  },
  doseStack: {
    flexDirection: 'column',
  },
  doseAmount: {
    flex: 1,
    minWidth: 0,
  },
  doseInput: {
    borderRadius: Radius.lg,
    paddingHorizontal: Space[16],
    width: '100%',
  },
  unitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: Radius.lg,
    paddingHorizontal: Space[16],
  },
  freqCard: {
    borderRadius: Radius.lg,
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.lg,
    marginBottom: Space[16],
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    borderRadius: Radius.lg,
    width: '100%',
  },
  stockVisual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.lg,
    width: '100%',
  },
});
