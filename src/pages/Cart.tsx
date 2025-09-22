import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { 
  ShoppingCart, Plus, Minus, X, Truck, Home, 
  Smartphone, ArrowLeft, CreditCard, Shield, 
  CheckCircle, Loader2, ExternalLink 
} from "lucide-react";
import { naboopayApi, NabooTransactionRequest, NabooTransactionResponse } from "@/lib/naboopay";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  color?: string;
  size?: string;
  category?: string;
}

export default function Cart() {
  const { items, removeItem, updateQuantity, clearCart, getTotalPrice } = useCart();
  const [loading, setLoading] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('orange_money');
  const { toast } = useToast();
  const navigate = useNavigate();

  const totalPrice = getTotalPrice();
  const deliveryFee = 2000;
  const finalPrice = totalPrice + deliveryFee;
  const totalItems = items.reduce((total, item) => total + item.quantity, 0);

  const createNabooTransaction = async (orderId: string) => {
    try {
      // Utiliser une URL de production avec HTTPS pour NabooPay
      const baseUrl = 'https://ndionelaye.netlify.app/';
      const successUrl = `${baseUrl}/order-success?order_id=${orderId}`;
      const errorUrl = `${baseUrl}/order-error?order_id=${orderId}`;

      const transactionData: NabooTransactionRequest = {
        method_of_payment: paymentMethod === 'wave' ? ['WAVE'] : ['ORANGE_MONEY'],
        products: items.map(item => ({
          name: item.name.substring(0, 100),
          category: item.category || 'General',
          amount: Math.round(item.price),
          quantity: item.quantity,
          description: `${item.name}${item.color ? ` - Couleur: ${item.color}` : ''}${item.size ? ` - Taille: ${item.size}` : ''}`.substring(0, 200)
        })),
        success_url: successUrl,
        error_url: errorUrl,
        is_escrow: false,
        is_merchant: false,
        metadata: {
          order_id: orderId,
          customer_phone: customerInfo.phone.replace(/\s/g, ''), // Nettoyer le numéro de téléphone
        }
      };

      // Log de débogage pour Wave
      console.log('Méthode de paiement sélectionnée:', paymentMethod);
      console.log('Numéro de téléphone:', customerInfo.phone);
      console.log('Numéro nettoyé:', customerInfo.phone.replace(/\s/g, ''));
      console.log('Données envoyées à NabooPay:', JSON.stringify(transactionData, null, 2));

      const response = await naboopayApi.put<NabooTransactionResponse>(
        '/transaction/create-transaction',
        transactionData
      );

      return response.data;
    } catch (error: any) {
      console.error('Erreur NabooPay détaillée:', error);
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
      
      // Afficher les détails spécifiques des erreurs de validation
      if (error.response?.data?.detail) {
        console.error('Détails des erreurs de validation:', error.response.data.detail);
        if (Array.isArray(error.response.data.detail)) {
          error.response.data.detail.forEach((detail: any, index: number) => {
            console.error(`Erreur ${index + 1}:`, detail);
            if (detail.loc && detail.msg) {
              console.error(`→ Champ: ${detail.loc.join('.')}, Message: ${detail.msg}`);
            }
          });
        }
      }
      
      const errorDetails = error.response?.data?.detail;
      let errorMessage = 'Erreur lors de la création de la transaction de paiement';
      
      if (Array.isArray(errorDetails) && errorDetails.length > 0) {
        const firstError = errorDetails[0];
        if (firstError.msg) {
          errorMessage = firstError.msg;
          if (firstError.loc) {
            errorMessage += ` (${firstError.loc.join('.')})`;
          }
        }
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      throw new Error(errorMessage);
    }
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (items.length === 0) {
      toast({
        title: "Erreur",
        description: "Votre panier est vide",
        variant: "destructive",
      });
      return;
    }

    if (!customerInfo.firstName || !customerInfo.lastName || !customerInfo.phone || !customerInfo.address) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    // Validation spécifique pour Wave
    if (paymentMethod === 'wave') {
      const cleanedPhone = customerInfo.phone.replace(/\s/g, '');
      if (!cleanedPhone.startsWith('+221') && !cleanedPhone.startsWith('+226')) {
        toast({
          title: "Format de numéro invalide",
          description: "Pour Wave, le numéro doit être au format international (+221...)",
          variant: "destructive",
        });
        return;
      }
    }

    if (paymentMethod === 'free') {
      await processFreeOrder();
      return;
    }

    setPaymentProcessing(true);

    try {
      for (const item of items) {
        const { data: product, error: fetchError } = await supabase
          .from('products')
          .select('stock, name')
          .eq('id', item.id)
          .single();

        if (fetchError) throw fetchError;

        if (product.stock < item.quantity) {
          throw new Error(`Stock insuffisant pour ${product.name}. Il ne reste que ${product.stock} unité(s)`);
        }
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_first_name: customerInfo.firstName,
          customer_last_name: customerInfo.lastName,
          customer_phone: customerInfo.phone,
          customer_address: customerInfo.address,
          total_amount: finalPrice,
          delivery_fee: deliveryFee,
          payment_method: paymentMethod,
          status: 'en_attente'
        })
        .select()
        .single();

      if (orderError) {
        console.error("Détails de l'erreur:", orderError);
        throw orderError;
      }

      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        product_image_url: item.image_url,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        color_variant: item.color || null,
        size_variant: item.size || null
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      const nabooTransaction = await createNabooTransaction(order.id);
      
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          naboopay_order_id: nabooTransaction.order_id,
          payment_status: 'pending'
        } as any)
        .eq('id', order.id);

      if (updateError) throw updateError;

      setCheckoutUrl(nabooTransaction.checkout_url);
      
      toast({
        title: "Redirection vers le paiement",
        description: "Vous allez être redirigé vers la page de paiement sécurisée",
      });

      setTimeout(() => {
        window.open(nabooTransaction.checkout_url, '_blank');
        navigate(`/order-tracking?phone=${customerInfo.phone}&order_id=${order.id}`);
      }, 2000);

    } catch (error: any) {
      console.error('Erreur complète:', error);
      
      let errorMessage = error.message || "Impossible de créer la commande";
      
      // Message d'erreur plus spécifique pour Wave
      if (errorMessage.includes('WAVE') || errorMessage.includes('Wave') || 
          errorMessage.includes('wave') || error.response?.data?.detail?.some((d: any) => 
          d.msg?.includes('WAVE') || d.msg?.includes('Wave'))) {
        errorMessage = "Erreur lors de la création du paiement Wave. Veuillez :\n" +
                       "1. Vérifier que votre numéro est au format international (+221... ou +226...)\n" +
                       "2. Vérifier que votre compte NabooPay est configuré pour accepter les paiements Wave\n" +
                       "3. Contacter le support si le problème persiste";
      }
      
      toast({
        title: "Erreur de paiement",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setPaymentProcessing(false);
    }
  };

  const processFreeOrder = async () => {
    setLoading(true);
    
    try {
      for (const item of items) {
        const { data: product, error: fetchError } = await supabase
          .from('products')
          .select('stock, name')
          .eq('id', item.id)
          .single();

        if (fetchError) throw fetchError;

        if (product.stock < item.quantity) {
          throw new Error(`Stock insuffisant pour ${product.name}. Il ne reste que ${product.stock} unité(s)`);
        }
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_first_name: customerInfo.firstName,
          customer_last_name: customerInfo.lastName,
          customer_phone: customerInfo.phone,
          customer_address: customerInfo.address,
          total_amount: finalPrice,
          delivery_fee: deliveryFee,
          payment_method: 'free',
          status: 'confirmee'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        product_image_url: item.image_url,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        color_variant: item.color || null,
        size_variant: item.size || null
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      for (const item of items) {
        const { data: product, error: fetchError } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.id)
          .single();

        if (fetchError) throw fetchError;

        const newStock = product.stock - item.quantity;
        
        if (newStock < 0) {
          throw new Error(`Stock insuffisant pour ${item.name}`);
        }

        const { error: updateError } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.id);

        if (updateError) throw updateError;
      }

      toast({
        title: "Commande créée !",
        description: `Votre commande a été enregistrée avec succès. Vous serez contacté au ${customerInfo.phone}`,
      });

      clearCart();
      navigate(`/order-tracking?phone=${customerInfo.phone}&order_id=${order.id}`);
    } catch (error: any) {
      console.error('Erreur commande gratuite:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la commande",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Votre panier est vide</h2>
        <p className="text-muted-foreground mb-6">Ajoutez des produits à votre panier pour continuer</p>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à la boutique
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}>
            <Home className="w-4 h-4 mr-2" />
            Accueil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Button variant="ghost" onClick={() => navigate('/')}  className="flex items-center gap-1 bg-success text-success-foreground hover:bg-gradient-to-r hover:from-success hover:to-white hover:text-primary border-success transition-all duration-300">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button> 
          <div class="p-4"></div>
          <h1 className="text-3xl font-bold">Mon Panier</h1>
        </div>
        
        
      </div>
      
      {checkoutUrl && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <ExternalLink className="w-5 h-5 text-blue-600 mr-2" />
            <p className="text-blue-800">
              Votre page de paiement est prête. Si la redirection n'a pas fonctionné,{' '}
              <a 
                href={checkoutUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                cliquez ici pour accéder au paiement
              </a>
            </p>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="bg-muted/50">
              <CardTitle className="flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Panier ({totalItems} article{totalItems > 1 ? 's' : ''})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {items.map((item, index) => (
                  <div key={`${item.id}-${item.color}-${item.size}-${index}`} className="flex items-center gap-4 p-6">
                    {item.image_url && (
                      <img 
                        src={item.image_url} 
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium text-lg">{item.name}</h4>
                      {item.color && <p className="text-sm text-muted-foreground">Couleur: {item.color}</p>}
                      {item.size && <p className="text-sm text-muted-foreground">Taille: {item.size}</p>}
                      <p className="text-lg font-medium text-primary mt-2">{item.price.toLocaleString()} FCFA</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            if (item.quantity > 1) {
                              updateQuantity(item.id, item.quantity - 1, item.color, item.size);
                            } else {
                              removeItem(item.id, item.color, item.size);
                            }
                          }}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => updateQuantity(item.id, item.quantity + 1, item.color, item.size)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeItem(item.id, item.color, item.size)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Truck className="w-5 h-5 mr-2" />
                Récapitulatif
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleOrderSubmit} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium">Informations personnelles</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">Prénom *</Label>
                      <Input
                        id="firstName"
                        value={customerInfo.firstName}
                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, firstName: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Nom *</Label>
                      <Input
                        id="lastName"
                        value={customerInfo.lastName}
                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, lastName: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Téléphone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+221 XX XXX XX XX"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="address">Adresse de livraison *</Label>
                    <Input
                      id="address"
                      value={customerInfo.address}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Secteur, rue, point de repère..."
                      required
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Moyen de paiement</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center space-x-3 p-3 border rounded-md hover:border-primary cursor-pointer">
                      <input
                        type="radio"
                        id="orange_money"
                        name="paymentMethod"
                        value="orange_money"
                        checked={paymentMethod === 'orange_money'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="h-4 w-4 text-primary"
                      />
                      <Label htmlFor="orange_money" className="flex items-center cursor-pointer flex-1">
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                          <Smartphone className="w-4 h-4 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">Orange Money</p>
                          <p className="text-sm text-muted-foreground">Paiement mobile sécurisé via NabooPay</p>
                        </div>
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-3 border rounded-md hover:border-primary cursor-pointer">
                      <input
                        type="radio"
                        id="wave"
                        name="paymentMethod"
                        value="wave"
                        checked={paymentMethod === 'wave'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="h-4 w-4 text-primary"
                      />
                      <Label htmlFor="wave" className="flex items-center cursor-pointer flex-1">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <CreditCard className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">WAVE avec la carte bancaire </p>
                          <p className="text-sm text-muted-foreground">payez avec votre carte prépayée wave sécurisé via naboopay</p>
                        </div>
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-3 border rounded-md hover:border-primary cursor-pointer">
                      <input
                        type="radio"
                        id="free"
                        name="paymentMethod"
                        value="free"
                        checked={paymentMethod === 'free'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="h-4 w-4 text-primary"
                      />
                      <Label htmlFor="free" className="flex items-center cursor-pointer flex-1">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">A la livraison</p>
                          <p className="text-sm text-muted-foreground">Commande à payer en espèces</p>
                        </div>
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <div className="flex justify-between">
                    <span>Sous-total ({totalItems} article{totalItems > 1 ? 's' : ''}):</span>
                    <span>{totalPrice.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Livraison:</span>
                    <span>{deliveryFee.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total:</span>
                    <span>{finalPrice.toLocaleString()} FCFA</span>
                  </div>
                </div>

                <div className="flex items-center text-sm text-muted-foreground">
                  <Shield className="w-4 h-4 mr-2" />
                  <span>Paiement sécurisé par NabooPay et protection des données</span>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg" 
                  disabled={loading || paymentProcessing}
                >
                  {paymentProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Création du paiement...
                    </>
                  ) : loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Traitement en cours...
                    </>
                  ) : (
                    `Commander • ${finalPrice.toLocaleString()} FCFA`
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}