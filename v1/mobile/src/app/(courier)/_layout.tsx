import React from "react";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/lib/auth";
import { LoadingScreen } from "@/components/ui";
import { colors } from "@/theme";

export default function CourierLayout() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== "COURIER") return <Redirect href="/home" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: "slide_from_right",
      }}
    />
  );
}
