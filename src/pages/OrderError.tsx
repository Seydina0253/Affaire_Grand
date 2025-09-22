import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle, Home, ShoppingCart } from 'lucide-react';

export default function OrderError() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('order_id');

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <Card className="text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <XCircle className="w-16 h-16 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Erreur de Paiement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Une erreur s'est produite lors du traitement de votre paiement.
            Veuillez réessayer ou contacter le support.
          </p>
          {orderId && (
            <p className="text-sm text-muted-foreground">
              Référence: {orderId}
            </p>
          )}
          <div className="flex gap-4 justify-center pt-4">
            <Button onClick={() => navigate('/cart')}>
              <ShoppingCart className="w-4 h-4 mr-2" />
              Retour au Panier
            </Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              <Home className="w-4 h-4 mr-2" />
              Accueil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}