import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/theme";
import { statusLabel, statusTone } from "@/lib/format";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.logo}>
      <View style={[styles.logoMark, compact && { width: 30, height: 30 }]}>
        <Ionicons
          name="flame"
          size={compact ? 18 : 22}
          color={colors.primaryInk}
        />
      </View>
      <View>
        <Text style={[styles.logoText, compact && { fontSize: 17 }]}>fogón</Text>
        {!compact && <Text style={styles.logoSub}>COMIDA LOCAL</Text>}
      </View>
    </View>
  );
}

export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
  refreshControl,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement;
}) {
  const insets = useSafeAreaInsets();
  if (!scroll) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }, style]}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      style={[styles.screen, style]}
      contentContainerStyle={[
        { padding: spacing.lg, paddingBottom: spacing.xxl + insets.bottom },
        contentStyle,
      ]}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function PageHeader({
  title,
  subtitle,
  back = false,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <View style={styles.pageHeader}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        {back && (
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryInk, border: colors.primary },
    secondary: { bg: colors.surface2, fg: colors.text, border: colors.border },
    ghost: { bg: "transparent", fg: colors.muted, border: "transparent" },
    danger: { bg: "rgba(246,70,93,0.12)", fg: "#FF7A8A", border: "rgba(246,70,93,0.3)" },
    success: { bg: colors.success, fg: "#04120C", border: colors.success },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={17} color={palette.fg} />}
          <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Input({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string | null }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Badge({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "primary" | "success" | "danger" | "info" | "muted";
}) {
  const tones = {
    primary: { bg: "rgba(240,185,11,0.14)", fg: colors.primary, border: "rgba(240,185,11,0.3)" },
    success: { bg: "rgba(14,203,129,0.14)", fg: colors.success, border: "rgba(14,203,129,0.3)" },
    danger: { bg: "rgba(246,70,93,0.14)", fg: "#FF7A8A", border: "rgba(246,70,93,0.3)" },
    info: { bg: "rgba(30,136,229,0.14)", fg: "#64B5F6", border: "rgba(30,136,229,0.3)" },
    muted: { bg: "rgba(132,142,156,0.12)", fg: colors.muted, border: "rgba(132,142,156,0.2)" },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: tones.bg, borderColor: tones.border }]}>
      <View style={[styles.badgeDot, { backgroundColor: tones.fg }]} />
      <Text style={[styles.badgeText, { color: tones.fg }]}>{label}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone = statusTone(status) as
    | "primary"
    | "success"
    | "danger"
    | "info"
    | "muted";
  return <Badge label={statusLabel(status)} tone={tone} />;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = colors.text,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: string;
}) {
  return (
    <Card style={{ flex: 1, minWidth: 140, gap: spacing.xs }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={styles.statLabel}>{label}</Text>
        {icon && <Ionicons name={icon} size={17} color={colors.muted} />}
      </View>
      <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </Card>
  );
}

export function EmptyState({
  icon = "restaurant-outline",
  title,
  description,
  action,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={colors.muted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyText}>{description}</Text> : null}
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}

export function LoadingScreen({ label = "Cargando…" }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <Logo />
      <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionText}>{title}</Text>
      {action}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: colors.primary, borderColor: colors.primary },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          selected && { color: colors.primaryInk, fontWeight: "700" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Stars({
  value,
  onChange,
  size = 30,
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => onChange?.(star)}
          disabled={!onChange}
          accessibilityRole="button"
          accessibilityLabel={`${star} estrellas`}
        >
          <Ionicons
            name={star <= value ? "star" : "star-outline"}
            size={size}
            color={star <= value ? colors.primary : colors.surface3}
          />
        </Pressable>
      ))}
    </View>
  );
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 20,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        style={styles.stepperButton}
      >
        <Ionicons name="remove" size={17} color={colors.muted} />
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        style={styles.stepperButton}
      >
        <Ionicons name="add" size={17} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  logo: { flexDirection: "row", alignItems: "center", gap: 9 },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: colors.text, fontSize: 21, fontWeight: "800", letterSpacing: -0.4 },
  logoSub: { color: colors.muted, fontSize: 8, letterSpacing: 2, marginTop: -1 },
  pageHeader: { gap: spacing.sm, marginBottom: spacing.sm },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: { color: colors.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.6 },
  pageSubtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  button: {
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  buttonText: { fontSize: 15, fontWeight: "700" },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  error: { color: colors.danger, fontSize: 11 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  statLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  statValue: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  statHint: { color: colors.muted, fontSize: 10 },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: "center",
    backgroundColor: "rgba(21,26,33,0.45)",
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: colors.muted, fontSize: 12, marginTop: spacing.sm },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionText: { color: colors.text, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    padding: 3,
  },
  stepperButton: { width: 32, height: 30, alignItems: "center", justifyContent: "center" },
  stepperValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    width: 28,
    textAlign: "center",
  },
});
