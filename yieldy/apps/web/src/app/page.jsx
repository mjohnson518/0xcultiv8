"use client";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Cultiv8Agent } from "@/components/Cultiv8Agent/Cultiv8Agent";

// Create a client
const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Cultiv8Agent />
    </QueryClientProvider>
  );
}
