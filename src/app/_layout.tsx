import { Stack } from "expo-router";
import "../../global.css";
import { SpotsProvider } from "../context/SpotsContext";

export default function RootLayout() {
  return (
    <SpotsProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SpotsProvider>
  );
}
