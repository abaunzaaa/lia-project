import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { AppText, SpeakButton } from '../components';
import AskLiaHeader from '../components/chat/AskLiaHeader';
import SuggestedQuestionChip from '../components/chat/SuggestedQuestionChip';
import ChatComposer from '../components/chat/ChatComposer';
import {
  CHAT_BEIGE,
  CHAT_BUBBLE_SIZE,
  CHAT_MESSAGE_FILL,
  LIA_CHAT_BUBBLE,
} from '../components/chat/chatAssets';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors, brandInk } from '../theme/brand';
import { FontFamily, FontWeight, Radius, Space } from '../theme/tokens';
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
  const lightChrome = !isDark && !isHighContrast;
  const { horizontalPadding, contentMaxWidth } = useResponsive();
  const ink = brandInk(isDark, isHighContrast, colors.textPrimary);
  const messageFill = lightChrome ? CHAT_MESSAGE_FILL : colors.surfaceElevated;
  const bubbleSize = Math.min(58, Math.max(48, scaleSpacing(CHAT_BUBBLE_SIZE)));

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
        <View style={styles.localBlock}>
          <AppText
            variant="caption"
            style={{
              color: lightChrome ? BrandColors.teal : colors.textSecondary,
              fontFamily: FontFamily.semiBold,
              fontWeight: FontWeight.semiBold,
              marginBottom: scaleSpacing(Space[8]),
            }}
          >
            LIA
          </AppText>
          <View style={[styles.localRow, { gap: scaleSpacing(14) }]}>
            <View
              style={[styles.liaBubbleSlot, { width: bubbleSize, height: bubbleSize }]}
              pointerEvents="none"
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Image
                source={LIA_CHAT_BUBBLE}
                style={{ width: bubbleSize, height: bubbleSize, backgroundColor: 'transparent' }}
                resizeMode="contain"
                accessible={false}
                accessibilityIgnoresInvertColors
              />
            </View>
            <View
              style={[
                styles.localCard,
                {
                  backgroundColor: isHighContrast ? colors.surface : messageFill,
                  borderColor: isHighContrast ? colors.border : messageFill,
                  borderWidth: isHighContrast ? 2 : 0,
                },
              ]}
            >
              <AppText
                variant="body"
                style={{
                  flexShrink: 1,
                  color: ink,
                  fontFamily: FontFamily.regular,
                  lineHeight: scaleFont(24),
                }}
              >
                {item.content}
              </AppText>
            </View>
          </View>
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
                  borderColor: isHighContrast ? colors.border : isDark ? colors.border : BrandColors.teal,
                },
              ]}
            >
              <AppText
                variant="label"
                style={{ color: isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal }}
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
                  borderBottomRightRadius: 8,
                }
              : {
                  backgroundColor: isHighContrast ? colors.surface : messageFill,
                  borderWidth: isHighContrast ? 2 : 0,
                  borderColor: isHighContrast ? colors.border : messageFill,
                  borderBottomLeftRadius: 8,
                },
          ]}
        >
          <AppText
            variant="body"
            selectable
            style={{
              flexShrink: 1,
              fontFamily: FontFamily.regular,
              color: isUser
                ? isHighContrast
                  ? colors.background
                  : BrandColors.white
                : ink,
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
      <AskLiaHeader
        onBack={() => navigation.goBack()}
        medicationName={name}
        registeredDose={registeredDose}
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
          <View
            style={[
              styles.notice,
              {
                backgroundColor: lightChrome ? CHAT_BEIGE : colors.surfaceElevated,
                borderColor: lightChrome ? CHAT_BEIGE : colors.border,
                borderWidth: isHighContrast ? 2 : 0,
                paddingVertical: scaleSpacing(12),
                paddingHorizontal: scaleSpacing(16),
                marginTop: scaleSpacing(Space[8]),
                marginBottom: scaleSpacing(Space[8]),
              },
            ]}
          >
            <AppText
              variant="caption"
              style={{
                color: colors.textSecondary,
                fontFamily: FontFamily.regular,
                fontSize: scaleFont(14),
                lineHeight: scaleFont(20),
                flexShrink: 1,
              }}
            >
              LIA ofrece información orientativa y no reemplaza las indicaciones de tu profesional de
              salud.
            </AppText>
          </View>

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
                <SuggestedQuestionChip
                  key={q}
                  question={q}
                  onPress={() => void ask(q)}
                  disabled={sending}
                />
              ))}
            </View>
          ) : null}

          <ChatComposer
            value={input}
            onChangeText={(t) => setInput(t.slice(0, DRUG_CHAT_MAX_MESSAGE))}
            onSend={() => void ask(input)}
            canSend={canSend}
            sending={sending}
            maxLength={DRUG_CHAT_MAX_MESSAGE}
            nearLimit={nearLimit}
            placeholder="Escribe tu pregunta…"
            accessibilityLabel="Escribe tu pregunta"
            bottomInset={Math.max(insets.bottom, scaleSpacing(Space[8]))}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  notice: {
    borderRadius: 14,
    alignSelf: 'stretch',
  },
  localBlock: {
    alignSelf: 'stretch',
  },
  localRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  liaBubbleSlot: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  localCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 28,
    paddingHorizontal: Space[16],
    paddingVertical: Space[16],
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
    borderRadius: 26,
    maxWidth: '100%',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  quickWrap: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingBottom: Space[12],
  },
});
