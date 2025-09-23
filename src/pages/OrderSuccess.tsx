import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Home, ShoppingBag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const orderId = searchParams.get('order_id');

  useEffect(() => {
    const processPaymentSuccess = async () => {
      if (orderId) {
        try {
          console.log('Processing payment success for order:', orderId);
          
          // Call Edge Function to process payment and update stock
          const { data, error } = await supabase.functions.invoke('process-payment-success', {
            body: { orderId }
          });

          if (error) {
            console.error('Erreur traitement paiement:', error);
            toast({
              title: "Erreur",
              description: "Erreur lors du traitement du paiement. Veuillez contacter le support.",
              variant: "destructive",
            });
          } else {
            console.log('Paiement traité avec succès:', data);
            toast({
              title: "Succès",
              description: "Votre commande a été confirmée et le stock mis à jour.",
            });
          }
        } catch (error) {
          console.error('Erreur:', error);
          toast({
            title: "Erreur",
            description: "Une erreur inattendue s'est produite.",
            variant: "destructive",
          });
        }
      }
    };

    processPaymentSuccess();
  }, [orderId, toast]);

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <Card className="text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Paiement Réussi !</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Votre paiement a été traité avec succès. Votre commande est maintenant confirmée.
          </p>
          {orderId && (
            <p className="text-sm text-muted-foreground">
              Référence: {orderId}
            </p>
          )}
          <div className="flex gap-4 justify-center pt-4">
            <Button onClick={() => navigate('/')}>
              <Home className="w-4 h-4 mr-2" />
              Accueil
            </Button>
            <Button variant="outline" onClick={() => navigate('/suivi-commande')}>
              <ShoppingBag className="w-4 h-4 mr-2" />
              Suivi de Commande
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}