import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import { AppText, Header, SpeakButton } from '../components';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import { generateId } from '../utils/helpers';
import {
  sendDrugChatMessage,
  DrugChatApiError,
  DRUG_CHAT_MAX_MESSAGE,
  DRUG_CHAT_MAX_HISTORY,
  DrugChatHistoryItem,
} from '../services/drugChatApi';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'DrugChat'>;
  route: RouteProp<RootStackParamList, 'DrugChat'>;
};

type UiRole = 'user' | 'assistant' | 'local' | 'error';

type UiMessage = {
  id: string;
  role: UiRole;
  content: string;
  sourceName?: string;
  createdAt: number;
  retryContent?: string;
};

const QUICK_QUESTIONS = [
  '¿Para qué sirve?',
  '¿Qué precauciones tiene?',
  '¿Qué información importante debo conocer?',
  'Explícamelo de forma sencilla.',
];

function toHistory(messages: UiMessage[]): DrugChatHistoryItem[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content.trim(),
    }))
    .filter((m) => m.content.length > 0)
    .slice(-DRUG_CHAT_MAX_HISTORY);
}

export default function DrugChatScreen({ navigation, route }: Props) {
  const { name, rxcui, registeredDose } = route.params;
  const insets = useSafeAreaInsets();
  const { scaleFont, scaleSpacing, minTouch } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { horizontalPadding, contentMaxWidth, compact } = useResponsive();

  const listRef = useRef<FlatList<UiMessage>>(null);
  const sendingRef = useRef(false);
  const messagesRef = useRef<UiMessage[]>([]);

  const [messages, setMessages] = useState<UiMessage[]>(() => [
    {
      id: generateId(),
      role: 'local',
      content: `Puedes preguntarme sobre la información disponible de ${name}.`,
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages, sending, scrollToEnd]);

  const ask = useCallback(
    async (rawQuestion: string, options?: { isRetry?: boolean }) => {
      const question = rawQuestion.trim();
      if (!question || sendingRef.current) return;
      if (question.length > DRUG_CHAT_MAX_MESSAGE) return;

      sendingRef.current = true;
      setSending(true);
      setHasInteracted(true);
      setInput('');

      const current = messagesRef.current.filter((m) => m.role !== 'error');

      let history: DrugChatHistoryItem[];
      let nextMessages: UiMessage[];

      if (options?.isRetry) {
        let lastUserIdx = -1;
        for (let i = current.length - 1; i >= 0; i -= 1) {
          if (current[i].role === 'user' && current[i].content === question) {
            lastUserIdx = i;
            break;
          }
        }
        history = toHistory(lastUserIdx >= 0 ? current.slice(0, lastUserIdx) : current);
        nextMessages = current;
      } else {
        history = toHistory(current);
        nextMessages = [
          ...current,
          {
            id: generateId(),
            role: 'user',
            content: question,
            createdAt: Date.now(),
          },
        ];
      }

      setMessages(nextMessages);
      messagesRef.current = nextMessages;

      try {
        const medication = rxcui?.trim()
          ? { rxcui: rxcui.trim(), name: name.trim() }
          : { name: name.trim() };

        // Exactamente un POST por pregunta.
        const response = await sendDrugChatMessage({
          medication,
          message: question,
          history,
          registeredDose: registeredDose?.trim() || undefined,
        });

        const assistantMsg: UiMessage = {
          id: generateId(),
          role: 'assistant',
          content: response.message,
          sourceName: response.source?.name,
          createdAt: Date.now(),
        };
        setMessages((prev) => {
          const updated = [...prev.filter((m) => m.role !== 'error'), assistantMsg];
          messagesRef.current = updated;
          return updated;
        });
      } catch (e) {
        const message =
          e instanceof DrugChatApiError
            ? e.message
            : 'No pude consultar la información del medicamento en este momento. Inténtalo nuevamente.';
        const errorMsg: UiMessage = {
          id: generateId(),
          role: 'error',
          content: message,
          createdAt: Date.now(),
          retryContent: question,
        };
        setMessages((prev) => {
          const updated = [...prev.filter((m) => m.role !== 'error'), errorMsg];
          messagesRef.current = updated;
          return updated;
        });
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [name, rxcui, registeredDose]
  );

  const canSend = input.trim().length > 0 && !sending;
  const nearLimit = input.length > DRUG_CHAT_MAX_MESSAGE - 80;
  const chatMaxWidth = Math.min(contentMaxWidth, 560);

  const renderMessage = ({ item }: { item: UiMessage }) => {
    if (item.role === 'local') {
      return (
        <View
          style={[
            styles.localCard,
            {
              backgroundColor: isHighContrast
                ? colors.surface
                : isDark
                  ? colors.surfaceElevated
                  : BrandColors.beige,
              borderColor: isHighContrast ? colors.border : BrandColors.skyBlue,
              borderWidth: isHighContrast ? 2 : 1,
            },
          ]}
        >
          <AppText variant="caption" style={{ fontWeight: '700', marginBottom: 4 }}>
            LIA
          </AppText>
          <AppText variant="body" style={{ flexShrink: 1 }}>
            {item.content}
          </AppText>
        </View>
      );
    }

    if (item.role === 'error') {
      return (
        <View
          style={[
            styles.errorCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: isHighContrast ? 2 : 1,
            },
          ]}
        >
          <AppText variant="body" style={{ flexShrink: 1 }}>
            {item.content}
          </AppText>
          {item.retryContent && !sending ? (
            <Pressable
              onPress={() => void ask(item.retryContent!, { isRetry: true })}
              accessibilityRole="button"
              accessibilityLabel="Intentar de nuevo"
              style={({ pressed }) => [
                styles.retryBtn,
                {
                  minHeight: minTouch,
                  opacity: pressed ? 0.85 : 1,
                  borderColor: isHighContrast ? colors.border : BrandColors.teal,
                },
              ]}
            >
              <AppText
                variant="label"
                style={{ color: isHighContrast ? colors.textPrimary : BrandColors.teal }}
              >
                Intentar de nuevo
              </AppText>
            </Pressable>
          ) : null}
        </View>
      );
    }

    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.bubbleWrap,
          isUser ? styles.bubbleWrapUser : styles.bubbleWrapAssistant,
        ]}
      >
        {!isUser ? (
          <AppText variant="caption" tone="secondary" style={{ marginBottom: 4, marginLeft: 4 }}>
            LIA
          </AppText>
        ) : null}
        <View
          style={[
            styles.bubble,
            isUser
              ? {
                  backgroundColor: isHighContrast ? colors.textPrimary : BrandColors.navy,
                  borderBottomRightRadius: 6,
                }
              : {
                  backgroundColor: isHighContrast
                    ? colors.surface
                    : isDark
                      ? colors.surfaceElevated
                      : BrandColors.skyBlue,
                  borderWidth: isHighContrast ? 2 : 0,
                  borderColor: colors.border,
                  borderBottomLeftRadius: 6,
                },
          ]}
        >
          <AppText
            variant="body"
            selectable
            style={{
              flexShrink: 1,
              color: isUser
                ? isHighContrast
                  ? colors.background
                  : BrandColors.white
                : colors.textPrimary,
              lineHeight: scaleFont(24),
            }}
          >
            {item.content}
          </AppText>
        </View>
        {!isUser && item.sourceName ? (
          <AppText
            variant="caption"
            tone="muted"
            style={{ marginTop: 6, marginLeft: 4, flexShrink: 1 }}
          >
            {`Fuente: ${item.sourceName}`}
          </AppText>
        ) : null}
        {!isUser ? (
          <SpeakButton
            id={`drug-chat-${item.id}`}
            label="Escuchar"
            stopLabel="Detener"
            text={item.content}
            style={{ marginTop: 8, alignSelf: 'flex-start' }}
          />
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Header
        title="Preguntar a LIA"
        subtitle={`Sobre ${name}`}
        showBack
        onBack={() => navigation.goBack()}
        editorial
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.flex,
            {
              maxWidth: chatMaxWidth,
              width: '100%',
              alignSelf: 'center',
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
          <AppText
            variant="caption"
            tone="secondary"
            style={{
              marginBottom: scaleSpacing(Space[8]),
              flexShrink: 1,
              lineHeight: scaleFont(18),
            }}
          >
            LIA ofrece información orientativa y no reemplaza las indicaciones de tu profesional de
            salud.
            {registeredDose ? ` Registrado: ${registeredDose}.` : ''}
          </AppText>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={styles.flex}
            contentContainerStyle={{
              paddingVertical: scaleSpacing(Space[8]),
              paddingBottom: scaleSpacing(Space[16]),
              gap: scaleSpacing(Space[12]),
              flexGrow: 1,
            }}
            onContentSizeChange={scrollToEnd}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              sending ? (
                <View style={styles.typingRow} accessibilityLabel="LIA está escribiendo">
                  <ActivityIndicator size="small" color={colors.primary} />
                  <AppText variant="caption" tone="secondary">
                    LIA está escribiendo…
                  </AppText>
                </View>
              ) : null
            }
          />

          {!hasInteracted ? (
            <View style={[styles.quickWrap, { gap: scaleSpacing(Space[8]) }]}>
              {QUICK_QUESTIONS.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => void ask(q)}
                  disabled={sending}
                  accessibilityRole="button"
                  accessibilityLabel={q}
                  style={({ pressed }) => [
                    styles.quickChip,
                    {
                      minHeight: minTouch,
                      backgroundColor: isHighContrast
                        ? colors.surface
                        : isDark
                          ? colors.surfaceElevated
                          : BrandColors.beige,
                      borderColor: isHighContrast ? colors.border : BrandColors.skyBlue,
                      borderWidth: isHighContrast ? 2 : 1,
                      opacity: sending ? 0.5 : pressed ? 0.88 : 1,
                      paddingHorizontal: scaleSpacing(Space[12]),
                    },
                  ]}
                >
                  <AppText
                    variant="body"
                    style={{
                      fontWeight: '600',
                      flexShrink: 1,
                      fontSize: scaleFont(compact ? 14 : 15),
                    }}
                  >
                    {q}
                  </AppText>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View
            style={[
              styles.inputBar,
              {
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, scaleSpacing(Space[8])),
                paddingTop: scaleSpacing(Space[8]),
                backgroundColor: colors.background,
              },
            ]}
          >
            <View
              style={[
                styles.inputShell,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: isHighContrast ? 2 : 1,
                  minHeight: minTouch,
                },
              ]}
            >
              <TextInput
                style={[
                  styles.input,
                  {
                    fontSize: scaleFont(16),
                    color: colors.textPrimary,
                    maxHeight: scaleFont(16) * 5,
                  },
                ]}
                placeholder="Escribe tu pregunta…"
                placeholderTextColor={colors.textMuted}
                value={input}
                onChangeText={(t) => setInput(t.slice(0, DRUG_CHAT_MAX_MESSAGE))}
                multiline
                editable={!sending}
                maxLength={DRUG_CHAT_MAX_MESSAGE}
                accessibilityLabel="Escribe tu pregunta"
              />
            </View>
            <Pressable
              onPress={() => void ask(input)}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Enviar"
              accessibilityHint="Envía tu pregunta a LIA"
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  minWidth: minTouch,
                  minHeight: minTouch,
                  backgroundColor: canSend
                    ? isHighContrast
                      ? colors.textPrimary
                      : BrandColors.navy
                    : colors.border,
                  opacity: pressed && canSend ? 0.88 : 1,
                },
              ]}
            >
              <Ionicons
                name="send"
                size={scaleFont(18)}
                color={
                  canSend
                    ? isHighContrast
                      ? colors.background
                      : BrandColors.white
                    : colors.textMuted
                }
              />
            </Pressable>
          </View>
          {nearLimit ? (
            <AppText variant="caption" tone="muted" style={{ textAlign: 'right', marginBottom: 4 }}>
              {`${input.length}/${DRUG_CHAT_MAX_MESSAGE}`}
            </AppText>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  localCard: {
    borderRadius: Radius.lg,
    padding: Space[16],
    alignSelf: 'stretch',
  },
  errorCard: {
    borderRadius: Radius.lg,
    padding: Space[16],
    alignSelf: 'stretch',
    gap: 12,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    justifyContent: 'center',
  },
  bubbleWrap: {
    maxWidth: '92%',
  },
  bubbleWrapUser: {
    alignSelf: 'flex-end',
  },
  bubbleWrapAssistant: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: Space[16],
    paddingVertical: Space[12],
    borderRadius: Radius.lg,
    maxWidth: '100%',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  quickWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: Space[8],
  },
  quickChip: {
    borderRadius: Radius.lg,
    justifyContent: 'center',
    maxWidth: '100%',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputShell: {
    flex: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    justifyContent: 'center',
    minWidth: 0,
  },
  input: {
    paddingVertical: 10,
    minWidth: 0,
  },
  sendBtn: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
