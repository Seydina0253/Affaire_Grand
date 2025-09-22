import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams, Link, useLocation, useNavigate } from "react-router-dom";
import { Search, Package, Clock, CheckCircle, XCircle, Truck, Home, ShoppingBag, User, MapPin, CreditCard, ArrowLeft } from "lucide-react";

interface Order {
  id: string;
  order_number: number;
  status: string;
  total_amount: number;
  delivery_fee: number;
  customer_first_name: string;
  customer_last_name: string;
  customer_phone: string;
  customer_address: string;
  created_at: string;
  order_items: {
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    color_variant: string | null;
    size_variant: string | null;
    product_image_url: string | null;
  }[];
}

const statusLabels = {
  'en_attente': 'En attente',
  'confirmee': 'Confirmée',
  'en_preparation': 'En préparation',
  'en_livraison': 'En livraison',
  'livree': 'Livrée',
  'annulee': 'Annulée'
};

const statusIcons = {
  'en_attente': Clock,
  'confirmee': CheckCircle,
  'en_preparation': Package,
  'en_livraison': Truck,
  'livree': CheckCircle,
  'annulee': XCircle
};

const statusColors = {
  'en_attente': 'bg-yellow-500',
  'confirmee': 'bg-blue-500',
  'en_preparation': 'bg-orange-500',
  'en_livraison': 'bg-purple-500',
  'livree': 'bg-green-500',
  'annulee': 'bg-red-500'
};

const statusDescriptions = {
  'en_attente': 'Votre commande est en attente de confirmation',
  'confirmee': 'Votre commande a été confirmée',
  'en_preparation': 'Votre commande est en cours de préparation',
  'en_livraison': 'Votre commande est en route vers vous',
  'livree': 'Votre commande a été livrée',
  'annulee': 'Votre commande a été annulée'
};

export default function OrderTracking() {
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (phone) {
      searchOrders();
    }
  }, []);

  const formatPhoneNumber = (input: string) => {
    // Nettoyer le numéro en gardant seulement les chiffres
    const cleaned = input.replace(/\D/g, '');
    
    // Si le numéro commence par 221, on le garde tel quel
    if (cleaned.startsWith('221')) {
      return `+${cleaned}`;
    }
    
    // Si c'est un numéro local (9 chiffres), on ajoute +221
    if (cleaned.length === 9) {
      return `+221${cleaned}`;
    }
    
    // Pour les autres formats, on retourne le numéro nettoyé
    return cleaned ? `+${cleaned}` : '';
  };

  const searchOrders = async () => {
    const formattedPhone = formatPhoneNumber(phone);
    
    if (!formattedPhone.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un numéro de téléphone",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            product_name,
            quantity,
            unit_price,
            total_price,
            color_variant,
            size_variant,
            product_image_url
          )
        `)
        .eq('customer_phone', formattedPhone)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(ordersData || []);

      if (ordersData?.length === 0) {
        toast({
          title: "Aucune commande trouvée",
          description: "Aucune commande n'a été trouvée pour ce numéro de téléphone",
        });
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: "Impossible de rechercher les commandes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Permettre seulement les chiffres
    const numericValue = value.replace(/\D/g, '');
    setPhone(numericValue);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header Section avec bouton Retour */}
        <div className="text-center mb-12 pt-8 relative">
          <div className="absolute top-0 left-0">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')} 
              className="flex items-center gap-1 bg-success text-success-foreground hover:bg-gradient-to-r hover:from-success hover:to-white hover:text-primary border-success transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
          </div>
          
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-6">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Suivi de Commande
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Entrez votre numéro de téléphone pour suivre l'état de vos commandes en temps réel
          </p>
        </div>

        {/* Search Form */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm mb-12">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-3">
                <Search className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">
                Rechercher une commande
              </h2>
              <p className="text-muted-foreground">
                Saisissez les 9 chiffres de votre numéro de téléphone (sans indicatif)
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="phone" className="text-sm font-medium mb-2 block">
                  Numéro de téléphone
                </Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center">
                    <span className="text-muted-foreground mr-1">+221</span>
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="XX XXX XX XX"
                    className="pl-20 py-4 sm:py-6 text-base sm:text-lg border-2 focus:border-primary transition-colors"
                    onKeyPress={(e) => e.key === 'Enter' && searchOrders()}
                    maxLength={9}
                  />
                </div>
                
              </div>
              <Button 
                onClick={searchOrders} 
                disabled={loading} 
                className="py-4 sm:py-6 px-6 sm:px-8 text-base sm:text-lg font-semibold min-w-[140px] w-full sm:w-auto"
                size="lg"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-1"></div>
                    Recherche...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Search className="w-5 h-5 mr-2" />
                    Rechercher
                  </div>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {orders.length > 0 && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground mb-2">
                Vos Commandes
              </h2>
              <p className="text-muted-foreground">
                {orders.length} commande{orders.length > 1 ? 's' : ''} trouvée{orders.length > 1 ? 's' : ''}
              </p>
            </div>

            {orders.map((order) => {
              const StatusIcon = statusIcons[order.status as keyof typeof statusIcons];
              const statusColor = statusColors[order.status as keyof typeof statusColors];
              const statusDescription = statusDescriptions[order.status as keyof typeof statusDescriptions];
              
              return (
                <Card key={order.id} className="shadow-lg border-0 overflow-hidden">
                  {/* Order Header */}
                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 sm:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                          <Badge className={`text-white ${statusColor} px-3 py-1 text-sm w-fit`}>
                            <StatusIcon className="w-4 h-4 mr-1" />
                            {statusLabels[order.status as keyof typeof statusLabels]}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            #{order.order_number}
                          </span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-semibold text-foreground">
                          {statusDescription}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Commandé le {formatDate(order.created_at)}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xl sm:text-2xl font-bold text-primary">
                          {order.total_amount.toLocaleString()} FCFA
                        </p>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                      {/* Order Items */}
                      <div>
                        <h4 className="font-semibold text-lg mb-4 flex items-center">
                          <ShoppingBag className="w-5 h-5 mr-2 text-primary" />
                          Articles commandés
                        </h4>
                        <div className="space-y-3">
                          {order.order_items.map((item, index) => (
                            <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 sm:p-4 bg-muted/50 rounded-lg">
                              {item.product_image_url && (
                                <img 
                                  src={item.product_image_url} 
                                  alt={item.product_name}
                                  className="w-16 h-16 object-cover rounded-lg shadow-sm mx-auto sm:mx-0"
                                />
                              )}
                              <div className="flex-1 min-w-0 text-center sm:text-left">
                                <p className="font-medium text-foreground truncate">
                                  {item.product_name}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-1 justify-center sm:justify-start">
                                  {item.color_variant && (
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                      {item.color_variant}
                                    </span>
                                  )}
                                  {item.size_variant && (
                                    <span className="text-xs bg-secondary/10 text-secondary px-2 py-1 rounded">
                                      {item.size_variant}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Quantité: {item.quantity}
                                </p>
                              </div>
                              <div className="text-center sm:text-right w-full sm:w-auto">
                                <p className="font-semibold text-foreground">
                                  {item.total_price.toLocaleString()} FCFA
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {item.unit_price.toLocaleString()} FCFA/unité
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order Details */}
                      <div className="space-y-6">
                        {/* Customer Info */}
                        <div>
                          <h4 className="font-semibold text-lg mb-3 flex items-center">
                            <User className="w-5 h-5 mr-2 text-primary" />
                            Informations client
                          </h4>
                          <div className="bg-muted/30 p-4 rounded-lg">
                            <p className="font-medium">
                              {order.customer_first_name} {order.customer_last_name}
                            </p>
                            <p className="text-muted-foreground mt-1">
                              {order.customer_phone}
                            </p>
                          </div>
                        </div>

                        {/* Delivery Address */}
                        <div>
                          <h4 className="font-semibold text-lg mb-3 flex items-center">
                            <MapPin className="w-5 h-5 mr-2 text-primary" />
                            Adresse de livraison
                          </h4>
                          <div className="bg-muted/30 p-4 rounded-lg">
                            <p className="text-foreground">{order.customer_address}</p>
                          </div>
                        </div>

                        {/* Order Summary */}
                        <div>
                          <h4 className="font-semibold text-lg mb-3 flex items-center">
                            <CreditCard className="w-5 h-5 mr-2 text-primary" />
                            Récapitulatif
                          </h4>
                          <div className="space-y-2 bg-muted/30 p-4 rounded-lg">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Sous-total:</span>
                              <span className="font-medium">{(order.total_amount - order.delivery_fee).toLocaleString()} FCFA</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Livraison:</span>
                              <span className="font-medium">{order.delivery_fee.toLocaleString()} FCFA</span>
                            </div>
                            <div className="border-t pt-2 mt-2">
                              <div className="flex justify-between items-center font-bold text-lg">
                                <span>Total:</span>
                                <span className="text-primary">{order.total_amount.toLocaleString()} FCFA</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty State */}
       
      </div>

      {/* Footer */}
      
    </div>
  );
}