import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Medication, MedicationFormData, MedicationPresentation } from '../types';
import AppText from './AppText';
import AppModal from './AppModal';
import DateFieldPicker from './DateFieldPicker';
import Input from './Input';
import OptionPickerModal from './OptionPickerModal';
import Toast from './Toast';
import KeyboardCheckBar, { MED_FORM_KEYBOARD_ACCESSORY_ID } from './medication-form/KeyboardCheckBar';
import FormNavigationButtons from './medication-form/FormNavigationButtons';
import MealRelationSelector from './medication-form/MealRelationSelector';
import MedicationFormHeader from './medication-form/MedicationFormHeader';
import MedicationSummaryCard from './medication-form/MedicationSummaryCard';
import SelectableImageCard from './medication-form/SelectableImageCard';
import TimeScheduleCard from './medication-form/TimeScheduleCard';
import WeekdaySelector from './medication-form/WeekdaySelector';
import { useMedicationFormColors } from './medication-form/useMedicationFormColors';
import { useAccessibility } from '../context/AccessibilityContext';
import { useMedications } from '../context/MedicationContext';
import { useResponsive } from '../hooks/useResponsive';
import {
  requestNotificationPermission,
  setPhoneRemindersPreference,
} from '../services/notificationService';
import { Radius, Space } from '../theme/tokens';
import { normalizeMedicationName, normalizeScheduleTimes } from '../utils/helpers';
import {
  scheduleBellAsset,
  scheduleClockAddAsset,
  presentationAssets,
  treatmentCalendarAsset,
  treatmentNotesAsset,
} from '../utils/medicationFormAssets';
import {
  ALL_WEEKDAYS,
  FormDoseUnit,
  MAX_INSTRUCTIONS,
  MAX_MEDICATION_NAME,
  MAX_PURPOSE,
  MAX_SCHEDULE_TIMES,
  MealRelation,
  PRESENTATION_OPTIONS,
  Weekday,
  formatScheduleSummary,
  formDoseUnitLabel,
  formDoseUnitShort,
  FreqMode,
  defaultTimesForMode,
  doseUnitForPresentation,
  frequencyFromMode,
  modeFromFrequency,
  nextAvailableTime,
  parseDoseAmount,
  parseDoseString,
  toFormDoseUnit,
  todayYmd,
  unitsForPresentation,
  stockUnitForPresentation,
} from '../utils/medicationFormHelpers';

type Props = {
  mode: 'add' | 'edit';
  initial?: Partial<Medication> | null;
  loading?: boolean;
  onSubmit: (data: MedicationFormData) => Promise<void>;
  onCancel: () => void;
};

type FieldErrors = Partial<Record<'name' | 'presentation' | 'dose' | 'unit' | 'weekdays' | 'times' | 'endDate', string>>;

const FREQ_CARDS: { id: FreqMode; label: string; hint: string }[] = [
  { id: 'once', label: '1 vez al día', hint: 'Una toma' },
  { id: 'twice', label: '2 veces al día', hint: 'Mañana y noche' },
  { id: 'thrice', label: '3 veces al día', hint: 'Mañana, tarde y noche' },
  { id: 'custom', label: 'Personalizado', hint: 'Tú eliges las horas' },
];

function inferFreqMode(times: string[], frequency?: string): FreqMode {
  if (frequency) {
    const parsed = modeFromFrequency(frequency);
    if (parsed.mode === 'once' || parsed.mode === 'twice' || parsed.mode === 'thrice') {
      return parsed.mode;
    }
  }
  if (times.length === 1) return 'once';
  if (times.length === 2) return 'twice';
  if (times.length === 3) return 'thrice';
  return 'custom';
}

export default function MedicationForm({
  mode,
  initial,
  loading = false,
  onSubmit,
  onCancel,
}: Props) {
  const { scaleSpacing, minTouch, scaleFont } = useAccessibility();
  const { medications } = useMedications();
  const { horizontalPadding, contentMaxWidth, isSmallPhone } = useResponsive();
  const palette = useMedicationFormColors();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const nameRef = useRef<TextInput>(null);

  const parsedDose = parseDoseString(initial?.dose || '');
  const initialTimes =
    initial?.schedules && initial.schedules.length > 0
      ? initial.schedules.map((item) => item.time)
      : initial?.time
        ? [initial.time]
        : ['08:00'];

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(initial?.name || '');
  const [presentation, setPresentation] = useState<MedicationPresentation | null>(
    initial?.presentation ?? null
  );
  const [doseAmount, setDoseAmount] = useState(
    initial?.doseAmount != null ? String(initial.doseAmount) : parsedDose.amount
  );
  const [doseUnit, setDoseUnit] = useState<FormDoseUnit>(
    toFormDoseUnit(initial?.doseUnit || parsedDose.unit)
  );
  const [customUnit, setCustomUnit] = useState(
    doseUnit === 'otra' ? parsedDose.customUnit : ''
  );
  const [quantity, setQuantity] = useState(
    initial?.quantity != null ? String(Math.max(0, Math.floor(initial.quantity))) : '1'
  );
  const [purpose, setPurpose] = useState(initial?.purpose || '');
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [weekdays, setWeekdays] = useState<Weekday[]>(
    initial?.weekdays && initial.weekdays.length > 0 ? initial.weekdays : [...ALL_WEEKDAYS]
  );
  const [times, setTimes] = useState<string[]>(initialTimes);
  const [freqMode, setFreqMode] = useState<FreqMode>(() =>
    inferFreqMode(initialTimes, initial?.frequency)
  );
  const [mealRelation, setMealRelation] = useState<MealRelation | null>(
    initial?.mealRelation ?? null
  );
  const [reminderEnabled, setReminderEnabled] = useState(initial?.reminderEnabled !== false);

  const [startDate, setStartDate] = useState(initial?.startDate || todayYmd());
  const [hasEndDate, setHasEndDate] = useState(Boolean(initial?.endDate));
  const [endDate, setEndDate] = useState(initial?.endDate || todayYmd());
  const [instructions, setInstructions] = useState(initial?.description || '');
  const [confirmed, setConfirmed] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ visible: false, message: '', type: 'error' });

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const stockUnit = useMemo(() => stockUnitForPresentation(presentation), [presentation]);

  const keyboardFieldProps = Platform.OS === 'ios'
    ? {
        inputAccessoryViewID: MED_FORM_KEYBOARD_ACCESSORY_ID,
        returnKeyType: 'default' as const,
      }
    : {
        returnKeyType: 'done' as const,
      };

  const unitOptions = useMemo(
    () =>
      unitsForPresentation(presentation).map((unit) => ({
        value: unit,
        label: formDoseUnitLabel(unit),
      })),
    [presentation]
  );

  const dosePreview = useMemo(() => {
    const amount = doseAmount.trim().replace(',', '.');
    if (!amount) return '';
    if (doseUnit === 'otra') {
      return customUnit.trim() ? `${amount} ${customUnit.trim()}` : amount;
    }
    return `${amount} ${doseUnit}`;
  }, [customUnit, doseAmount, doseUnit]);

  const isDirty = useMemo(() => {
    return (
      name.trim() !== (initial?.name || '').trim() ||
      presentation !== (initial?.presentation ?? null) ||
      doseAmount.trim() !== (initial?.doseAmount != null ? String(initial.doseAmount) : parsedDose.amount) ||
      purpose.trim() !== (initial?.purpose || '').trim() ||
      quantity.trim() !== (initial?.quantity != null ? String(Math.max(0, Math.floor(initial.quantity))) : '1') ||
      times.join(',') !== initialTimes.join(',') ||
      weekdays.join(',') !== (initial?.weekdays?.join(',') || ALL_WEEKDAYS.join(',')) ||
      mealRelation !== (initial?.mealRelation ?? null) ||
      reminderEnabled !== (initial?.reminderEnabled !== false) ||
      startDate !== (initial?.startDate || todayYmd()) ||
      hasEndDate !== Boolean(initial?.endDate) ||
      instructions.trim() !== (initial?.description || '').trim()
    );
  }, [
    customUnit,
    doseAmount,
    hasEndDate,
    initial,
    initialTimes,
    instructions,
    mealRelation,
    name,
    parsedDose.amount,
    presentation,
    purpose,
    quantity,
    reminderEnabled,
    startDate,
    times,
    weekdays,
  ]);

  const requestExit = () => {
    if (isDirty) {
      setExitOpen(true);
      return;
    }
    onCancel();
  };

  const handleBack = () => {
    if (step === 1) {
      requestExit();
      return;
    }
    setStep((current) => (current === 3 ? 2 : 1));
  };

  const setError = (patch: FieldErrors) => {
    setFieldErrors(patch);
    if (patch.name) {
      nameRef.current?.focus();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const validateStep = (current: 1 | 2 | 3): boolean => {
    if (current === 1) {
      const next: FieldErrors = {};
      if (!name.trim()) next.name = 'Ingresa el nombre del medicamento.';
      if (!presentation) next.presentation = 'Selecciona la presentación del medicamento.';
      const amount = parseDoseAmount(doseAmount);
      if (amount == null) next.dose = 'Ingresa una dosis válida.';
      if (doseUnit === 'otra' && !customUnit.trim()) next.unit = 'Selecciona una unidad.';
      if (!dosePreview) next.dose = next.dose || 'Ingresa una dosis válida.';
      setError(next);
      return Object.keys(next).length === 0;
    }
    if (current === 2) {
      const next: FieldErrors = {};
      if (weekdays.length === 0) next.weekdays = 'Selecciona al menos un día.';
      try {
        if (times.length === 0) throw new Error('Selecciona al menos una hora.');
        normalizeScheduleTimes(times);
      } catch (error) {
        next.times = error instanceof Error ? error.message : 'Revisa los horarios.';
      }
      setError(next);
      if (next.weekdays || next.times) {
        setToast({
          visible: true,
          message: next.weekdays || next.times || '',
          type: 'error',
        });
      }
      return Object.keys(next).length === 0;
    }
    if (hasEndDate && endDate < startDate) {
      setError({ endDate: 'La fecha de finalización no puede ser anterior a la fecha de inicio.' });
      setToast({
        visible: true,
        message: 'La fecha de finalización no puede ser anterior a la fecha de inicio.',
        type: 'error',
      });
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const goNext = () => {
    Keyboard.dismiss();
    if (!validateStep(step)) return;
    setStep((current) => (current === 1 ? 2 : 3));
  };

  const setTimeAt = (index: number, hhmm: string) => {
    setTimes((prev) => {
      if (prev.includes(hhmm) && prev[index] !== hhmm) {
        setToast({ visible: true, message: 'Ya agregaste esta hora.', type: 'error' });
        return prev;
      }
      const next = [...prev];
      next[index] = hhmm;
      return next.sort();
    });
  };

  const applyFreq = (mode: FreqMode) => {
    setFreqMode(mode);
    if (mode !== 'custom') {
      setTimes(defaultTimesForMode(mode, 8));
    }
    if (fieldErrors.times) {
      setFieldErrors((prev) => ({ ...prev, times: undefined }));
    }
  };

  const addTime = () => {
    if (times.length >= MAX_SCHEDULE_TIMES) {
      setToast({ visible: true, message: 'Alcanzaste el máximo de horarios.', type: 'error' });
      return;
    }
    const next = nextAvailableTime(times);
    if (times.includes(next)) {
      setToast({ visible: true, message: 'Ya agregaste esta hora.', type: 'error' });
      return;
    }
    setFreqMode('custom');
    setTimes((prev) => [...prev, next].sort());
  };

  const removeTime = (index: number) => {
    if (times.length <= 1) return;
    setFreqMode('custom');
    setTimes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;
    if (!confirmed) {
      setToast({
        visible: true,
        message: 'Marca que la información está correcta para guardar.',
        type: 'error',
      });
      return;
    }

    const nameNorm = normalizeMedicationName(name);
    const duplicate = medications.some((item) => {
      if (mode === 'edit' && initial?.id && item.id === initial.id) return false;
      return normalizeMedicationName(item.name) === nameNorm;
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
    } catch (error) {
      setToast({
        visible: true,
        message: error instanceof Error ? error.message : 'Revisa los horarios.',
        type: 'error',
      });
      return;
    }

    if (reminderEnabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        await setPhoneRemindersPreference(true);
      }
    }

    const amount = parseDoseAmount(doseAmount);
    const countUnits = doseUnit === 'tabletas' || doseUnit === 'cápsulas' || doseUnit === 'unidades';
    try {
      await onSubmit({
        name: name.trim(),
        dose: dosePreview,
        doseAmount: amount ?? undefined,
        doseUnit: doseUnit === 'otra' ? customUnit.trim() : doseUnit,
        presentation,
        purpose: purpose.trim() || undefined,
        quantity: Math.max(0, Math.floor(Number.parseInt(quantity, 10) || 0)),
        unitsPerIntake: countUnits ? Math.max(1, Math.round(amount ?? 1)) : 1,
        weekdays,
        mealRelation,
        reminderEnabled,
        frequency: frequencyFromMode(freqMode, 8),
        schedules,
        startDate,
        endDate: hasEndDate ? endDate : undefined,
        description: instructions.trim() || undefined,
      });
    } catch {
      // El toast de error lo muestra la pantalla padre.
    }
  };

  const heading =
    step === 1
      ? { title: '¿Qué medicamento agregarás?', subtitle: 'Cuéntame lo esencial para organizarlo.' }
      : step === 2
        ? { title: '¿Cuándo lo tomas?', subtitle: 'Elige los días y la hora de cada toma.' }
        : { title: '¿Por cuánto tiempo?', subtitle: 'Revisa las fechas antes de guardar.' };

  const sectionLabel = (text: string) => (
    <AppText
      variant="body"
      style={{
        color: palette.navy,
        fontWeight: '700',
        marginBottom: scaleSpacing(Space[8]),
        marginTop: scaleSpacing(Space[16]),
      }}
    >
      {text}
    </AppText>
  );

  return (
    <View style={[styles.root, { backgroundColor: palette.page }]}>
      <MedicationFormHeader
        step={step}
        flowTitle={mode === 'edit' ? 'Editar medicamento' : 'Agregar medicamento'}
        title={heading.title}
        subtitle={heading.subtitle}
        onBack={handleBack}
      />

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingBottom: Math.max(insets.bottom, scaleSpacing(Space[24])) + scaleSpacing(Space[16]),
          maxWidth: contentMaxWidth,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {step === 1 ? (
          <View>
            {sectionLabel('Nombre del medicamento')}
            <Input
              ref={nameRef}
              chrome="white"
              value={name}
              onChangeText={(value) => {
                setName(value.slice(0, MAX_MEDICATION_NAME));
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="Nombre"
              autoCapitalize="words"
              autoCorrect={false}
              {...keyboardFieldProps}
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
              error={fieldErrors.name}
              right={
                name ? (
                  <Pressable
                    onPress={() => setName('')}
                    accessibilityRole="button"
                    accessibilityLabel="Borrar nombre"
                    style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="close-circle" size={20} color={palette.secondary} />
                  </Pressable>
                ) : null
              }
            />

            {sectionLabel('Presentación')}
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingRight: 12 }}
            >
              {PRESENTATION_OPTIONS.map((option) => (
                <SelectableImageCard
                  key={option.id}
                  label={option.label}
                  image={presentationAssets[option.id]}
                  selected={presentation === option.id}
                  onPress={() => {
                    const allowed = unitsForPresentation(option.id);
                    setPresentation(option.id);
                    setDoseUnit((current) =>
                      allowed.includes(current) ? current : doseUnitForPresentation(option.id)
                    );
                    if (fieldErrors.presentation || fieldErrors.unit) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        presentation: undefined,
                        unit: undefined,
                      }));
                    }
                  }}
                  accessibilityLabel={`${option.label}${presentation === option.id ? ', seleccionado' : ''}`}
                />
              ))}
            </ScrollView>
            {fieldErrors.presentation ? (
              <AppText variant="caption" style={{ color: palette.coral, marginTop: 8 }}>
                {fieldErrors.presentation}
              </AppText>
            ) : null}

            {sectionLabel('Dosis')}
            <View style={[styles.doseRow, isSmallPhone && styles.doseStack]}>
              <View style={{ flex: 1 }}>
                <Input
                  chrome="white"
                  value={doseAmount}
                  onChangeText={(value) => {
                    setDoseAmount(value.replace(/[^0-9.,]/g, ''));
                    if (fieldErrors.dose) setFieldErrors((prev) => ({ ...prev, dose: undefined }));
                  }}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  {...keyboardFieldProps}
                  blurOnSubmit
                  onSubmitEditing={() => Keyboard.dismiss()}
                  error={fieldErrors.dose}
                />
              </View>
              <Pressable
                onPress={() => setUnitPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Seleccionar unidad"
                style={[
                  styles.unitCard,
                  {
                    minHeight: Math.max(56, minTouch),
                    backgroundColor: palette.card,
                    borderColor: fieldErrors.unit ? palette.coral : palette.border,
                    borderWidth: palette.borderWidth,
                  },
                ]}
              >
                <AppText variant="body" style={{ color: palette.navy, fontWeight: '600' }}>
                  {formDoseUnitShort(doseUnit, customUnit)}
                </AppText>
                <Ionicons name="chevron-down" size={18} color={palette.navy} />
              </Pressable>
            </View>
            {doseUnit === 'otra' ? (
              <Input
                chrome="white"
                label="Unidad"
                value={customUnit}
                onChangeText={setCustomUnit}
                placeholder="Ej. UI"
                {...keyboardFieldProps}
                blurOnSubmit
                onSubmitEditing={() => Keyboard.dismiss()}
                error={fieldErrors.unit}
              />
            ) : null}

            {sectionLabel('¿Cuántos tienes en casa?')}
            <AppText variant="caption" style={{ color: palette.secondary, marginTop: -4, marginBottom: 8 }}>
              Las {stockUnit} que te quedan. Así LÍA puede avisarte cuando se estén acabando.
            </AppText>
            <View style={styles.stockRow}>
              <Pressable
                onPress={() => {
                  const next = Math.max(0, (Number.parseInt(quantity, 10) || 0) - 1);
                  setQuantity(String(next));
                }}
                accessibilityRole="button"
                accessibilityLabel="Quitar uno"
                style={[
                  styles.stockStep,
                  {
                    minWidth: Math.max(48, minTouch),
                    minHeight: Math.max(48, minTouch),
                    backgroundColor: palette.ice,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Ionicons name="remove" size={22} color={palette.navy} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Input
                  chrome="white"
                  value={quantity}
                  onChangeText={(value) => setQuantity(value.replace(/[^0-9]/g, ''))}
                  placeholder="1"
                  keyboardType="number-pad"
                  {...keyboardFieldProps}
                  blurOnSubmit
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>
              <Pressable
                onPress={() => {
                  const next = Math.min(9999, (Number.parseInt(quantity, 10) || 0) + 1);
                  setQuantity(String(next));
                }}
                accessibilityRole="button"
                accessibilityLabel="Agregar uno"
                style={[
                  styles.stockStep,
                  {
                    minWidth: Math.max(48, minTouch),
                    minHeight: Math.max(48, minTouch),
                    backgroundColor: palette.ice,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Ionicons name="add" size={22} color={palette.navy} />
              </Pressable>
              <AppText variant="body" style={{ color: palette.navy, fontWeight: '700', minWidth: 72 }}>
                {stockUnit}
              </AppText>
            </View>

            {sectionLabel('¿Para qué lo tomas?')}
            <Input
              chrome="white"
              value={purpose}
              onChangeText={(value) => setPurpose(value.slice(0, MAX_PURPOSE))}
              placeholder="Opcional"
              {...keyboardFieldProps}
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            <AppText variant="caption" style={{ color: palette.secondary, marginTop: -8 }}>
              Opcional
            </AppText>

            <View style={{ marginTop: scaleSpacing(Space[20]) }}>
              <MedicationSummaryCard
                name={name.trim()}
                presentation={presentation}
                dosePreview={dosePreview}
                stockLabel={quantity ? `${quantity} ${stockUnit}` : undefined}
                compact
              />
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            {sectionLabel('¿Qué días?')}
            <WeekdaySelector value={weekdays} onChange={setWeekdays} error={fieldErrors.weekdays} />

            {sectionLabel('¿Con qué frecuencia?')}
            <View style={styles.freqGrid}>
              {FREQ_CARDS.map((option) => {
                const selected = freqMode === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => applyFreq(option.id)}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityHint={option.hint}
                    accessibilityState={{ selected }}
                    style={[
                      styles.freqCard,
                      {
                        minHeight: Math.max(64, minTouch + 8),
                        backgroundColor: selected ? palette.navy : palette.ice,
                        borderColor: selected ? palette.navy : palette.border,
                        borderWidth: selected ? 2 : 1,
                      },
                    ]}
                  >
                    <AppText
                      variant="body"
                      style={{
                        color: selected ? palette.onPrimary : palette.navy,
                        fontWeight: '700',
                        textAlign: 'center',
                      }}
                    >
                      {option.label}
                    </AppText>
                    <AppText
                      variant="caption"
                      style={{
                        color: selected ? palette.pastel : palette.secondary,
                        textAlign: 'center',
                        marginTop: 2,
                      }}
                    >
                      {option.hint}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            {sectionLabel('¿A qué hora?')}
            <View style={{ gap: scaleSpacing(Space[12]) }}>
              {times.map((time, index) => (
                <TimeScheduleCard
                  key={`${time}-${index}`}
                  valueHhmm={time}
                  takeLabel={`Toma ${index + 1}`}
                  onChange={(next) => setTimeAt(index, next)}
                  onRemove={times.length > 1 ? () => removeTime(index) : undefined}
                />
              ))}
            </View>
            {fieldErrors.times ? (
              <AppText variant="caption" style={{ color: palette.coral, marginTop: 8 }}>
                {fieldErrors.times}
              </AppText>
            ) : null}
            <Pressable
              onPress={addTime}
              accessibilityRole="button"
              accessibilityLabel="Agregar otra hora"
              style={[
                styles.addTime,
                {
                  minHeight: Math.max(52, minTouch),
                  backgroundColor: palette.ice,
                  borderColor: palette.border,
                },
              ]}
            >
              <Image
                source={scheduleClockAddAsset}
                style={{ width: 36, height: 36, backgroundColor: 'transparent' }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <AppText variant="body" style={{ color: palette.navy, fontWeight: '700' }}>
                + Agregar otra hora
              </AppText>
            </Pressable>

            {sectionLabel('¿Cuándo lo tomas?')}
            <MealRelationSelector value={mealRelation} onChange={setMealRelation} />

            {sectionLabel('Recordatorio')}
            <View
              style={[
                styles.reminder,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  borderWidth: palette.borderWidth,
                  minHeight: Math.max(72, minTouch),
                },
              ]}
            >
              <Image
                source={scheduleBellAsset}
                style={{ width: 48, height: 48, backgroundColor: 'transparent' }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <View style={{ flex: 1 }}>
                <AppText variant="body" style={{ color: palette.navy, fontWeight: '700' }}>
                  Recordatorio
                </AppText>
                <AppText variant="caption" style={{ color: palette.secondary, marginTop: 2 }}>
                  Te avisaré cuando sea hora de tomarlo.
                </AppText>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={setReminderEnabled}
                trackColor={{ false: palette.border, true: palette.navy }}
                thumbColor={palette.card}
                accessibilityLabel="Activar recordatorio"
              />
            </View>

            <View
              style={[
                styles.summaryBar,
                { backgroundColor: palette.ice, borderColor: palette.border },
              ]}
            >
              <Ionicons name="calendar-outline" size={18} color={palette.navyMain} />
              <AppText variant="caption" style={{ color: palette.navy, flex: 1, fontWeight: '600' }}>
                {formatScheduleSummary({ weekdays, times, mealRelation }) || 'Completa días y hora'}
              </AppText>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <View
              style={[
                styles.durationHero,
                {
                  backgroundColor: palette.ice,
                  borderColor: palette.border,
                  borderWidth: palette.borderWidth,
                },
              ]}
            >
              <Image
                source={treatmentCalendarAsset}
                style={[styles.durationCalendar, { backgroundColor: 'transparent' }]}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="body" style={{ color: palette.navy, fontWeight: '700' }}>
                  Duración del tratamiento
                </AppText>
                <AppText variant="caption" style={{ color: palette.secondary, marginTop: 4 }}>
                  Elige las fechas. El fin es opcional.
                </AppText>
              </View>
            </View>
            <View style={{ gap: scaleSpacing(Space[12]), marginTop: scaleSpacing(Space[12]) }}>
              <View
                style={[
                  styles.dateCard,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                    borderWidth: palette.borderWidth,
                  },
                ]}
              >
                <AppText variant="caption" style={{ color: palette.secondary, marginBottom: 8 }}>
                  Fecha de inicio
                </AppText>
                <DateFieldPicker
                  label="Elegir fecha de inicio"
                  valueYmd={startDate}
                  onChange={setStartDate}
                  hideLabel
                  compact
                />
              </View>
              <View
                style={[
                  styles.dateCard,
                  {
                    backgroundColor: palette.card,
                    borderColor: fieldErrors.endDate ? palette.coral : palette.border,
                    borderWidth: palette.borderWidth,
                  },
                ]}
              >
                <View style={styles.endDateHeader}>
                  <AppText variant="caption" style={{ color: palette.secondary, flex: 1 }}>
                    Fecha de finalización
                  </AppText>
                  <Pressable
                    onPress={() => {
                      const next = !hasEndDate;
                      setHasEndDate(next);
                      if (next && endDate < startDate) setEndDate(startDate);
                      if (!next) setFieldErrors((prev) => ({ ...prev, endDate: undefined }));
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: hasEndDate }}
                    accessibilityLabel="Si aplica"
                    style={[
                      styles.aplicaChip,
                      {
                        minHeight: Math.max(36, minTouch * 0.7),
                        backgroundColor: hasEndDate ? palette.navy : palette.ice,
                        borderColor: hasEndDate ? palette.navy : palette.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={hasEndDate ? 'checkmark' : 'add'}
                      size={14}
                      color={hasEndDate ? palette.onPrimary : palette.navy}
                    />
                    <AppText
                      variant="caption"
                      style={{
                        color: hasEndDate ? palette.onPrimary : palette.navy,
                        fontWeight: '700',
                      }}
                    >
                      Si aplica
                    </AppText>
                  </Pressable>
                </View>
                {hasEndDate ? (
                  <DateFieldPicker
                    label="Elegir fecha de finalización"
                    valueYmd={endDate}
                    onChange={setEndDate}
                    minimumYmd={startDate}
                    hideLabel
                    compact
                  />
                ) : (
                  <AppText variant="body" style={{ color: palette.secondary, marginTop: 4 }}>
                    Sin fecha de finalización
                  </AppText>
                )}
              </View>
            </View>
            {fieldErrors.endDate ? (
              <AppText variant="caption" style={{ color: palette.coral, marginTop: 8 }}>
                {fieldErrors.endDate}
              </AppText>
            ) : null}

            {sectionLabel('Indicaciones')}
            <View
              style={[
                styles.notesCard,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  borderWidth: palette.borderWidth,
                },
              ]}
            >
              <TextInput
                value={instructions}
                onChangeText={(value) => setInstructions(value.slice(0, MAX_INSTRUCTIONS))}
                placeholder="Tomar con un vaso de agua."
                placeholderTextColor={palette.secondary}
                multiline
                textAlignVertical="top"
                {...keyboardFieldProps}
                style={{
                  minHeight: 88,
                  color: palette.navy,
                  fontSize: scaleFont(16),
                  flex: 1,
                }}
                accessibilityLabel="Indicaciones"
              />
              <View style={styles.notesFooter}>
                <View style={[styles.optional, { backgroundColor: palette.ice }]}>
                  <AppText variant="caption" style={{ color: palette.navyMain, fontWeight: '600' }}>
                    Opcional
                  </AppText>
                </View>
                <Image
                  source={treatmentNotesAsset}
                  style={{ width: 56, height: 56, backgroundColor: 'transparent' }}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              </View>
            </View>

            <View style={{ marginTop: scaleSpacing(Space[20]) }}>
              <MedicationSummaryCard
                name={name.trim()}
                presentation={presentation}
                dosePreview={dosePreview}
                stockLabel={quantity ? `${quantity} ${stockUnit}` : undefined}
                weekdays={weekdays}
                times={times}
                mealRelation={mealRelation}
                startDate={startDate}
                endDate={hasEndDate ? endDate : null}
                instructions={instructions.trim()}
                reminderEnabled={reminderEnabled}
              />
            </View>

            <Pressable
              onPress={() => setConfirmed((value) => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmed }}
              accessibilityLabel="La información está correcta"
              style={[
                styles.confirm,
                {
                  backgroundColor: palette.ice,
                  minHeight: Math.max(52, minTouch),
                  borderColor: palette.border,
                },
              ]}
            >
              <View
                style={[
                  styles.confirmMark,
                  { backgroundColor: confirmed ? palette.navy : palette.card, borderColor: palette.navy },
                ]}
              >
                {confirmed ? <Ionicons name="checkmark" size={16} color={palette.onPrimary} /> : null}
              </View>
              <AppText variant="body" style={{ color: palette.navy, fontWeight: '600', flex: 1 }}>
                La información está correcta
              </AppText>
            </Pressable>
          </View>
        ) : null}

        {!keyboardVisible ? (
          <View style={{ marginTop: scaleSpacing(Space[24]) }}>
            <FormNavigationButtons
              primaryTitle={step === 3 ? 'Guardar medicamento' : 'Continuar'}
              secondaryTitle={step === 1 ? 'Cancelar' : 'Atrás'}
              onPrimary={step === 3 ? () => void handleSave() : goNext}
              onSecondary={step === 1 ? requestExit : handleBack}
              loading={loading}
              primaryDisabled={step === 3 && !confirmed}
            />
          </View>
        ) : null}
      </ScrollView>

      <OptionPickerModal
        visible={unitPickerOpen}
        title="Unidad"
        selectedValue={doseUnit}
        options={unitOptions}
        onSelect={(value) => {
          setDoseUnit(value as FormDoseUnit);
          setUnitPickerOpen(false);
        }}
        onClose={() => setUnitPickerOpen(false)}
      />

      <AppModal
        visible={exitOpen}
        title="¿Salir sin guardar?"
        message="La información que ingresaste se perderá."
        confirmText="Salir"
        cancelText="Seguir editando"
        destructive
        onConfirm={onCancel}
        onCancel={() => setExitOpen(false)}
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((current) => ({ ...current, visible: false }))}
      />
      <KeyboardCheckBar visible={keyboardVisible} keyboardHeight={keyboardHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  freqGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  freqCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doseRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  doseStack: { flexDirection: 'column' },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  stockStep: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  unitCard: {
    minWidth: 120,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  addTime: {
    marginTop: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  reminder: {
    borderRadius: Radius.xl,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryBar: {
    marginTop: 16,
    borderRadius: Radius.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  durationHero: {
    marginTop: Space[16],
    borderRadius: Radius.xl,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  durationCalendar: {
    width: 72,
    height: 72,
  },
  dateCard: {
    borderRadius: Radius.xl,
    padding: 14,
  },
  endDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  aplicaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  notesCard: {
    borderRadius: Radius.xl,
    padding: 14,
  },
  notesFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  optional: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  confirm: {
    marginTop: 16,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  confirmMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
