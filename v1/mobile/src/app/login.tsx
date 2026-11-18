import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme";
import { useAuth } from "@/lib/auth";
import { API_URL, WEB_URL } from "@/lib/config";
import { Button, Input, Logo } from "@/components/ui";

export default function LoginScreen() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Redirect href={user.role === "COURIER" ? "/route" : "/home"} />;
  }

  async function handleLogin(nextEmail = email, nextPassword = password) {
    setError(null);
    if (!nextEmail.trim() || !nextPassword) {
      setError("Ingresa tu email y contraseña.");
      return;
    }
    setLoading(true);
    try {
      const logged = await login(nextEmail.trim(), nextPassword);
      router.replace(logged.role === "COURIER" ? "/route" : "/home");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos ingresar.");
    } finally {
      setLoading(false);
    }
  }

  const demo = __DEV__
    ? [
        { label: "Cliente demo", email: "cliente@fogon.cl" },
        { label: "Repartidor demo", email: "repartidor@fogon.cl" },
      ]
    : [];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Logo />
          <Text style={styles.eyebrow}>LA COCINA LOCAL, EN TU BOLSILLO</Text>
          <Text style={styles.title}>Pide rico.{"\n"}Pide cerca.</Text>
          <Text style={styles.subtitle}>
            Comida de cocinas de barrio, con precio claro y entrega confiable.
            Si repartes, aquí están tus pedidos.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="tu@email.cl"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Input
            label="Contraseña"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title="Ingresar"
            onPress={() => handleLogin()}
            loading={loading}
            icon="log-in-outline"
          />
        </View>

        {demo.length > 0 && (
          <View style={styles.demo}>
            <Text style={styles.demoTitle}>Cuentas de prueba</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {demo.map((account) => (
                <Pressable
                  key={account.email}
                  onPress={() => {
                    setEmail(account.email);
                    setPassword("fogon123");
                    handleLogin(account.email, "fogon123");
                  }}
                  style={styles.demoButton}
                >
                  <Text style={styles.demoLabel}>{account.label}</Text>
                  <Text style={styles.demoEmail}>{account.email}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.links}>
          <Pressable onPress={() => Linking.openURL(`${WEB_URL}/register`)}>
            <Text style={styles.link}>Crear cuenta de cliente</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(`${WEB_URL}/registro/repartidor`)}>
            <Text style={styles.link}>Quiero repartir</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(`${WEB_URL}/registro/local`)}>
            <Text style={styles.linkMuted}>Soy local · entrar a la web</Text>
          </Pressable>
        </View>

        <View style={styles.note}>
          <Ionicons name="server-outline" size={13} color={colors.muted} />
          <Text style={styles.noteText}>API: {API_URL}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingTop: 70,
    paddingBottom: 40,
    justifyContent: "center",
  },
  brand: { gap: spacing.md, marginBottom: spacing.xl },
  eyebrow: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginTop: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: -1.4,
    lineHeight: 43,
  },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, maxWidth: 340 },
  form: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  error: { color: colors.danger, fontSize: 12 },
  demo: { marginTop: spacing.lg, gap: spacing.sm },
  demoTitle: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  demoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  demoLabel: { color: colors.text, fontSize: 12, fontWeight: "700" },
  demoEmail: { color: colors.muted, fontSize: 9, marginTop: 2 },
  links: { marginTop: spacing.xl, gap: spacing.md, alignItems: "center" },
  link: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  linkMuted: { color: colors.muted, fontSize: 11 },
  note: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  noteText: { color: colors.muted, fontSize: 9 },
});
