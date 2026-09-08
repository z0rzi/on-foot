import { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useTheme } from '../theme/useTheme'

// Breathing room between the focused field and the top of the keyboard.
const KEYBOARD_GAP = 16

// KeyboardAwareScrollView rather than KeyboardAvoidingView: the latter is inert on Android under
// edge-to-edge, where the window no longer resizes for the IME, leaving a focused field covered
// with nothing to scroll.
export function FormScreen({ children }: { children: ReactNode }) {
  const c = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={KEYBOARD_GAP}
      >
        {children}
      </KeyboardAwareScrollView>
    </View>
  )
}

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  const c = useTheme()
  return (
    // The wrapper repeats the scroll content gap so pairing a label with its
    // control does not tighten the spacing the flat layout had.
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.onSurface }]}>{label}</Text>
      {children}
    </View>
  )
}

export function FormTextInput({
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  value: string
  onChangeText: (text: string) => void
  placeholder: string
  multiline?: boolean
}) {
  const c = useTheme()
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.onSurfaceVariant}
      multiline={multiline}
      style={[styles.input, multiline && styles.multiline, { color: c.onSurface, borderColor: c.panelDivider }]}
    />
  )
}

export function SubmitButton({
  label,
  busy,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  label: string
  busy: boolean
  disabled: boolean
  onPress: () => void
  accessibilityLabel: string
}) {
  const c = useTheme()
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={[styles.save, { backgroundColor: c.controlAccent, opacity: disabled ? 0.5 : 1 }]}
    >
      {busy ? <ActivityIndicator color={c.onControlAccent} /> : <Text style={[styles.saveLabel, { color: c.onControlAccent }]}>{label}</Text>}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  field: { gap: 12 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  save: { marginTop: 12, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveLabel: { fontSize: 16, fontWeight: '700' },
})
