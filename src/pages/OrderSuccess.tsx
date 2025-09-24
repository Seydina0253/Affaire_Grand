import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Truck, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function OrderSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const [countdown, setCountdown] = useState(100);
  const [paymentUpdated, setPaymentUpdated] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!orderId) {
      console.error('Aucun ID de commande trouvé dans les paramètres URL');
      return;  
    }

    // Mettre à jour le statut de paiement
    const updatePaymentStatus = async () => {
      try {
        const { error } = await supabase
          .from('orders')
          .update({ 
            payment_status: 'paye',
            status: 'confirmee' // Optionnel : mettre aussi à jour le statut de la commande
          })
          .eq('id', orderId);

        if (error) throw error;
        
        setPaymentUpdated(true);
        console.log('Statut de paiement mis à jour avec succès');
      } catch (error) {
        console.error('Erreur lors de la mise à jour du statut de paiement:', error);
        toast({
          title: "Erreur",
          description: "Impossible de mettre à jour le statut de paiement",
          variant: "destructive",
        });
      }
    };

    updatePaymentStatus();
  }, [orderId, toast]);

  useEffect(() => {
    if (!orderId || !paymentUpdated) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate(`/order-tracking?order_id=${orderId}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, orderId, paymentUpdated]);

  if (!orderId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card className="border-red-200">
          <CardHeader className="text-center bg-red-50">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-16 h-16 text-red-600" />
            </div>
            <CardTitle className="text-2xl text-red-700">
              Erreur de commande
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-lg text-muted-foreground mb-4">
              Aucun ID de commande n'a été trouvé.
            </p>
            <Button onClick={() => navigate('/')}>
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Card className="border-green-200">
        <CardHeader className="text-center bg-green-50">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-700">
            Paiement Réussi !
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="text-center space-y-4">
            <p className="text-lg text-muted-foreground">
              Votre paiement a été traité avec succès. Votre commande est confirmée.
            </p>
            
            {paymentUpdated ? (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-blue-800">
                    Statut de paiement mis à jour
                  </span>
                </div>
                <div className="flex items-center justify-center space-x-2 mt-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-800">
                    Redirection dans {countdown} seconde{countdown > 1 ? 's' : ''}...
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="flex items-center justify-center space-x-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <span className="font-medium text-yellow-800">
                    Mise à jour du statut de paiement en cours...
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                onClick={() => navigate(`/order-tracking?order_id=${orderId}`)}
                className="bg-green-600 hover:bg-green-700"
                disabled={!paymentUpdated}
              >
                <Truck className="w-4 h-4 mr-2" />
                Suivre ma commande maintenant
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/')}
              >
                Retour à l'accueil
              </Button>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-medium mb-3">Informations de votre commande :</h3>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm">
                <strong>Numéro de commande :</strong> {orderId}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Conservez ce numéro pour suivre votre commande.
              </p>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-medium mb-3">Prochaines étapes :</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                <span>Paiement confirmé</span>
              </li>
              <li className="flex items-center">
                <Clock className="w-4 h-4 text-blue-600 mr-2" />
                <span>Préparation de votre commande</span>
              </li>
              <li className="flex items-center">
                <Truck className="w-4 h-4 text-orange-600 mr-2" />
                <span>Livraison en cours</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 