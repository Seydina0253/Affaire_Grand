import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Truck, Clock, AlertCircle } from "lucide-react";

export default function OrderSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!orderId) {
      console.error('Aucun ID de commande trouvé dans les paramètres URL');
      return;
    }

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
  }, [navigate, orderId]);

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
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-800">
                  Redirection automatique dans {countdown} seconde{countdown > 1 ? 's' : ''}...
                </span>
              </div>
              <p className="text-sm text-blue-700">
                Vous serez redirigé vers le suivi de commande pour suivre l'état de votre commande.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                onClick={() => navigate(`/order-tracking?order_id=${orderId}`)}
                className="bg-green-600 hover:bg-green-700"
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