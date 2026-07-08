import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ExternalLink } from "lucide-react-native";
import { useSession } from "../lib/session";

const GITHUB_REPOSITORY_URL = "https://github.com/tianma-if/edgeever";

export const LoginScreen = () => {
  const { signIn } = useSession();
  const [baseUrl, setBaseUrl] = useState("");
  const [username, setUsername] = useState("owner");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = baseUrl.trim() && username.trim() && password;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await signIn({ baseUrl, username, password });
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Pressable accessibilityLabel="GitHub 仓库" accessibilityRole="link" onPress={() => Linking.openURL(GITHUB_REPOSITORY_URL)} style={styles.githubButton}>
        <ExternalLink color="#475569" size={20} />
      </Pressable>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <View style={styles.header}>
          <Text style={styles.title}>EdgeEver</Text>
          <Text style={styles.subtitle}>连接你的自托管笔记空间</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>实例地址</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onChangeText={setBaseUrl}
              placeholder="https://notes.example.com"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={baseUrl}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>用户名</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setUsername}
              placeholder="owner"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={username}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>密码</Text>
            <TextInput
              onChangeText={setPassword}
              placeholder="首次登录密码"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit || submitting}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.button,
              (!canSubmit || submitting) && styles.buttonDisabled,
              pressed && canSubmit ? styles.buttonPressed : null,
            ]}
          >
            {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>登录</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#f8fafc",
    flex: 1,
  },
  githubButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    position: "absolute",
    right: 18,
    top: 18,
    width: 42,
    zIndex: 2,
  },
  keyboard: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    marginBottom: 28,
  },
  title: {
    color: "#0f172a",
    fontSize: 34,
    fontWeight: "800",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 16,
    marginTop: 8,
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  error: {
    color: "#dc2626",
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 50,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
});
