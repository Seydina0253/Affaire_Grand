import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Admin from "./admin/Admin";
import Auth from "./admin/Auth";
import Cart from "./pages/Cart";
import OrderTracking from "./pages/OrderTracking";
import NotFound from "./pages/NotFound";
import { CartProvider } from "./contexts/CartContext";
import ProtectedRoute from "./admin/ProtectedRoute";
import OrderSuccess from "./pages/OrderSuccess";
import OrderError from "./pages/OrderError";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Routes publiques avec Layout */}
            <Route path="/*" element={
              <Layout>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/panier" element={<Cart />} />
                  <Route path="/order-tracking" element={<OrderTracking />} />
                  <Route path="/suivi-commande" element={<OrderTracking />} />
                  <Route path="https://ndionelaye.netlify.app/suivi-commande" element={<OrderTracking />} />
                  <Route path="/order-success" element={<OrderSuccess />} />
                  <Route path="/order-error" element={<OrderError />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Layout>
            } />
            
            {/* Routes d'administration sans Layout public */}
            <Route path="/admin/*" element={
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/*" element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                } />
              </Routes>
            } />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;