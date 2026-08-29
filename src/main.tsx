import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./styles/base.css";

// I dati vivono in SQLite sulla stessa macchina: nessun refetch opportunistico,
// le viste si aggiornano quando un comando invalida esplicitamente la query.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: Infinity, retry: false },
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root non trovato");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
