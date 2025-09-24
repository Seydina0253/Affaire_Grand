import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, Settings, Trash2, Edit, Upload, ShoppingBag, X, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  stock: number;
  created_at: string;
  product_variants: {
    id: string;
    type: string;
    value: string;
    stock: number;
  }[];
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  color_variant: string | null;
  size_variant: string | null;
  product_image_url: string | null;
}

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
  payment_method: string;
  payment_status?: string;
  order_items: OrderItem[];
}

interface AdminSettings {
  id: string;
  company_name: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  logo_url: string | null;
  footer_text: string | null;
}

interface ProductVariant {
  type: string;
  value: string;
  stock: number;
}

const statusLabels = {
  'en_attente': 'En attente',
  'confirmee': 'Confirmée',
  'en_preparation': 'En préparation',
  'en_livraison': 'En livraison',
  'livree': 'Livrée',
  'annulee': 'Annulée'
};

const paymentMethodLabels = {
  'orange_money': 'Orange Money',
  'wave': 'Wave',
  'free': 'À la livraison'
};

export default function Admin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'orders' | 'settings'>('dashboard');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Formulaire produit
  const [productForm, setProductForm] = useState({
    id: '',
    name: '',
    description: '',
    price: '',
    stock: '',
    is_active: true
  });

  // Variantes de produit
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [newVariant, setNewVariant] = useState({
    type: '',
    value: '',
    stock: ''
  });

  // Upload d'image
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Upload de logo
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Formulaire paramètres
  const [settingsForm, setSettingsForm] = useState({
    company_name: '',
    hero_title: '',
    hero_subtitle: '',
    hero_image_url: '',
    logo_url: '',
    footer_text: ''
  });

  // États pour le tableau de bord
  const [dashboardStats, setDashboardStats] = useState({
    todayOrders: 0,
    todayRevenue: 0,
    lowStockProducts: 0,
    totalProducts: 0
  });

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    fetchSettings();
    fetchDashboardStats();

    // Abonnement en temps réel aux changements
    const productsSubscription = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        () => {
          fetchProducts();
          fetchDashboardStats();
        }
      )
      .subscribe();

    const ordersSubscription = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          fetchOrders();
          fetchDashboardStats();
        }
      )
      .subscribe();

    const orderItemsSubscription = supabase
      .channel('order-items-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items'
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    const settingsSubscription = supabase
      .channel('settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_settings'
        },
        () => {
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productsSubscription);
      supabase.removeChannel(ordersSubscription);
      supabase.removeChannel(orderItemsSubscription);
      supabase.removeChannel(settingsSubscription);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/admin/auth');
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_variants (
            id,
            type,
            value,
            stock
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les produits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_name,
            quantity,
            unit_price,
            total_price,
            color_variant,
            size_variant,
            product_image_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les commandes",
        variant: "destructive",
      });
    }
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings(data);
        setSettingsForm({
          company_name: data.company_name || '',
          hero_title: data.hero_title || '',
          hero_subtitle: data.hero_subtitle || '',
          hero_image_url: data.hero_image_url || '',
          logo_url: data.logo_url || '',
          footer_text: data.footer_text || ''
        });
        setLogoPreview(data.logo_url);
      }
    } catch (error) {
      console.error('Erreur settings:', error);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      // Commandes d'aujourd'hui avec paiement confirmé
      const today = new Date().toISOString().split('T')[0];
      const { data: todayOrdersData, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount, status')
        .gte('created_at', today + 'T00:00:00')
        .lt('created_at', today + 'T23:59:59');

      if (ordersError) throw ordersError;

      // Produits avec stock faible (moins de 5)
      const { data: lowStockData, error: stockError } = await supabase
        .from('products')
        .select('stock')
        .lt('stock', 5);

      if (stockError) throw stockError;

      // Calculer les statistiques - filtrer les commandes payées/confirmées
      const paidOrders = todayOrdersData?.filter(order => 
        order.status === 'confirmee' || order.status === 'en_preparation' || 
        order.status === 'en_livraison' || order.status === 'livree'
      ) || [];
      
      const todayOrders = paidOrders.length;
      const todayRevenue = paidOrders.reduce((sum, order) => sum + order.total_amount, 0);
      const lowStockProducts = lowStockData?.length || 0;

      // Récupérer le nombre total de produits
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id');

      if (productsError) throw productsError;

      setDashboardStats({
        todayOrders,
        todayRevenue,
        lowStockProducts,
        totalProducts: productsData?.length || 0
      });
    } catch (error) {
      console.error('Erreur dashboard stats:', error);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    
    // Créer un aperçu de l'image
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setUploadingImage(true);

    try {
      const imageUrl = await uploadImage(file);
      toast({
        title: "Image uploadée",
        description: "L'image a été uploadée avec succès",
      });
    } catch (error) {
      console.error('Erreur upload:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'uploader l'image",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoFile(file);
    
    // Créer un aperçu du logo
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const addVariant = () => {
    if (!newVariant.type || !newVariant.value || !newVariant.stock) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir le type, la valeur et le stock de la variante",
        variant: "destructive",
      });
      return;
    }

    const variantStock = parseInt(newVariant.stock);
    const totalStock = parseInt(productForm.stock) || 0;
    const currentVariantsStock = variants.reduce((sum, v) => sum + v.stock, 0);

    if (currentVariantsStock + variantStock > totalStock) {
      toast({
        title: "Erreur",
        description: `Le stock des variantes (${currentVariantsStock + variantStock}) ne peut pas dépasser le stock total (${totalStock})`,
        variant: "destructive",
      });
      return;
    }

    setVariants([...variants, {
      type: newVariant.type,
      value: newVariant.value,
      stock: variantStock
    }]);

    setNewVariant({ type: '', value: '', stock: '' });
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const resetProductForm = () => {
    setProductForm({
      id: '',
      name: '',
      description: '',
      price: '',
      stock: '',
      is_active: true
    });
    setVariants([]);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!productForm.name || !productForm.price) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    try {
      let imageUrl = null;
      
      // Upload de l'image si sélectionnée
      if (imageFile) {
        setUploadingImage(true);
        imageUrl = await uploadImage(imageFile);
      }

      // Créer ou mettre à jour le produit
      let product;
      if (productForm.id) {
        // Mise à jour du produit
        const { data, error } = await supabase
          .from('products')
          .update({
            name: productForm.name,
            description: productForm.description || null,
            price: parseInt(productForm.price),
            stock: parseInt(productForm.stock) || 0,
            image_url: imageUrl || productForm.id ? products.find(p => p.id === productForm.id)?.image_url : null,
            is_active: productForm.is_active
          })
          .eq('id', productForm.id)
          .select()
          .single();

        if (error) throw error;
        product = data;
      } else {
        // Création du produit
        const { data, error } = await supabase
          .from('products')
          .insert({
            name: productForm.name,
            description: productForm.description || null,
            price: parseInt(productForm.price),
            stock: parseInt(productForm.stock) || 0,
            image_url: imageUrl,
            is_active: productForm.is_active
          })
          .select()
          .single();

        if (error) throw error;
        product = data;
      }

      // Supprimer les anciennes variantes
      if (productForm.id) {
        await supabase
          .from('product_variants')
          .delete()
          .eq('product_id', productForm.id);
      }

      // Ajouter les variantes si présentes
      if (variants.length > 0) {
        const variantData = variants.map(variant => ({
          product_id: product.id,
          type: variant.type,
          value: variant.value,
          stock: variant.stock
        }));

        const { error: variantError } = await supabase
          .from('product_variants')
          .insert(variantData);

        if (variantError) throw variantError;
      }

      toast({
        title: "Succès",
        description: productForm.id ? "Produit modifié avec succès !" : "Produit ajouté avec succès !",
      });

      resetProductForm();
      fetchProducts();
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: productForm.id ? "Impossible de modifier le produit" : "Impossible d'ajouter le produit",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    setProductForm({
      id: product.id,
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      stock: product.stock.toString(),
      is_active: product.is_active
    });
    
    setVariants(product.product_variants || []);
    setImagePreview(product.image_url);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) return;

    try {
      // Vérifier si le produit est référencé dans des commandes
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('id')
        .eq('product_id', productId)
        .limit(1);

      if (orderItems && orderItems.length > 0) {
        toast({
          title: "Impossible de supprimer",
          description: "Ce produit est référencé dans des commandes existantes. Vous pouvez le désactiver à la place.",
          variant: "destructive",
        });
        return;
      }

      // Supprimer les variantes d'abord
      await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', productId);

      // Supprimer le produit
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Produit supprimé avec succès !",
      });

      fetchProducts();
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le produit",
        variant: "destructive",
      });
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Statut de la commande mis à jour",
      });

      fetchOrders();
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut",
        variant: "destructive",
      });
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let logoUrl = settingsForm.logo_url;
      let heroImageUrl = settingsForm.hero_image_url;
      
      // Upload du logo si sélectionné
      if (logoFile) {
        setUploadingLogo(true);
        logoUrl = await uploadImage(logoFile);
      }

      const { data, error } = await supabase
        .from('admin_settings')
        .upsert({
          id: settings?.id || crypto.randomUUID(),
          company_name: settingsForm.company_name,
          hero_title: settingsForm.hero_title,
          hero_subtitle: settingsForm.hero_subtitle,
          hero_image_url: heroImageUrl,
          logo_url: logoUrl,
          footer_text: settingsForm.footer_text
        });

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Paramètres mis à jour avec succès !",
      });

      fetchSettings();
      setLogoFile(null);
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les paramètres",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Admin */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Settings className="w-8 h-8 text-primary mr-2" />
              <span className="text-xl font-bold text-foreground">
                Administration
              </span>
            </div>
            <Button variant="outline" onClick={handleSignOut} className="flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Tableau de bord</h1>
          <p className="text-muted-foreground">
            Gérez vos produits, commandes et paramètres. Toutes les modifications apparaîtront automatiquement sur la page d'accueil.
          </p>
        </div>

        {/* Navigation des onglets */}
        <div className="flex space-x-4 mb-8 overflow-x-auto">
          <Button
            variant={activeTab === 'dashboard' ? 'default' : 'outline'}
            onClick={() => {setActiveTab('dashboard'); fetchDashboardStats();}}
            className="whitespace-nowrap"
          >
            <Settings className="w-4 h-4 mr-2" />
            Tableau de bord
          </Button>
          <Button
            variant={activeTab === 'products' ? 'default' : 'outline'}
            onClick={() => setActiveTab('products')}
            className="whitespace-nowrap"
          >
            <Package className="w-4 h-4 mr-2" />
            Produits ({products.length})
          </Button>
          <Button
            variant={activeTab === 'orders' ? 'default' : 'outline'}
            onClick={() => setActiveTab('orders')}
            className="whitespace-nowrap"
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            Commandes ({orders.length})
          </Button>
          <Button
            variant={activeTab === 'settings' ? 'default' : 'outline'}
            onClick={() => setActiveTab('settings')}
            className="whitespace-nowrap"
          >
            <Settings className="w-4 h-4 mr-2" />
            Paramètres
          </Button>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="card-elegant">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Commandes payées du jour</p>
                      <p className="text-3xl font-bold text-foreground">{dashboardStats.todayOrders}</p>
                    </div>
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <ShoppingBag className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elegant">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Chiffre d'affaires du jour</p>
                      <p className="text-3xl font-bold text-success">{dashboardStats.todayRevenue.toLocaleString()} FCFA</p>
                    </div>
                    <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
                      <Plus className="w-6 h-6 text-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elegant">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Stock faible</p>
                      <p className="text-3xl font-bold text-destructive">{dashboardStats.lowStockProducts}</p>
                    </div>
                    <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-destructive" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elegant">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total produits</p>
                      <p className="text-3xl font-bold text-foreground">{dashboardStats.totalProducts}</p>
                    </div>
                    <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Aperçu des commandes récentes */}
            <Card className="card-elegant">
              <CardHeader>
                <CardTitle>Commandes récentes (payées uniquement)</CardTitle>
              </CardHeader>
              <CardContent>
            {orders.filter(order => order.status === 'confirmee' || order.status === 'en_preparation' || order.status === 'en_livraison' || order.status === 'livree').slice(0, 5).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Aucune commande payée récente</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="space-y-4">
                  {orders.filter(order => order.status === 'confirmee' || order.status === 'en_preparation' || order.status === 'en_livraison' || order.status === 'livree').slice(0, 5).map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center space-x-4">
                            <div>
                              <p className="font-medium">#{order.order_number}</p>
                              <p className="text-sm text-muted-foreground">
                                {order.customer_first_name} {order.customer_last_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {paymentMethodLabels[order.payment_method as keyof typeof paymentMethodLabels] || order.payment_method}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{order.total_amount.toLocaleString()} FCFA</p>
                            <Badge variant={order.status === 'confirmee' ? 'default' : 'secondary'}>
                              {statusLabels[order.status as keyof typeof statusLabels]}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Formulaire d'ajout/modification de produit */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  {productForm.id ? <Edit className="w-5 h-5 mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
                  {productForm.id ? 'Modifier le produit' : 'Ajouter un produit'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddProduct} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nom du produit *</Label>
                    <Input
                      id="name"
                      value={productForm.name}
                      onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: T-shirt bio"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={productForm.description}
                      onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Description du produit..."
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="price">Prix (FCFA) *</Label>
                      <Input
                        id="price"
                        type="number"
                        value={productForm.price}
                        onChange={(e) => setProductForm(prev => ({ ...prev, price: e.target.value }))}
                        placeholder="5000"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="stock">Stock total *</Label>
                      <Input
                        id="stock"
                        type="number"
                        value={productForm.stock}
                        onChange={(e) => setProductForm(prev => ({ ...prev, stock: e.target.value }))}
                        placeholder="100"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="image">Image du produit</Label>
                    <div className="mt-1 flex items-center space-x-4">
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                      />
                    </div>
                    {imagePreview && (
                      <div className="mt-2 relative w-32 h-32 border rounded-lg overflow-hidden">
                        <img
                          src={imagePreview}
                          alt="Aperçu"
                          className="w-full h-full object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-1 right-1 w-6 h-6 p-0"
                          onClick={() => {
                            setImagePreview(null);
                            setImageFile(null);
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={productForm.is_active}
                      onCheckedChange={(checked) => setProductForm(prev => ({ ...prev, is_active: checked }))}
                    />
                    <Label>Produit actif</Label>
                  </div>
                  
                  {/* Gestion des variantes */}
                  <div className="border-t pt-4">
                    <Label className="text-lg">Variantes (couleur, taille, etc.)</Label>
                    <div className="space-y-3 mt-3">
                      {variants.map((variant, index) => (
                        <div key={index} className="flex items-center space-x-2 p-2 bg-muted rounded">
                          <span className="flex-1 text-sm">
                            {variant.type}: {variant.value} (Stock: {variant.stock})
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVariant(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      
                      <div className="grid grid-cols-12 gap-2">
                        <Input
                          placeholder="Type (ex: couleur)"
                          value={newVariant.type}
                          onChange={(e) => setNewVariant(prev => ({ ...prev, type: e.target.value }))}
                          className="col-span-4"
                        />
                        <Input
                          placeholder="Valeur (ex: rouge)"
                          value={newVariant.value}
                          onChange={(e) => setNewVariant(prev => ({ ...prev, value: e.target.value }))}
                          className="col-span-4"
                        />
                        <Input
                          type="number"
                          placeholder="Stock"
                          value={newVariant.stock}
                          onChange={(e) => setNewVariant(prev => ({ ...prev, stock: e.target.value }))}
                          className="col-span-3"
                        />
                        <Button
                          type="button"
                          onClick={addVariant}
                          className="col-span-1"
                          size="sm"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 pt-4">
                    <Button type="submit" disabled={uploadingImage} className="flex-1">
                      {uploadingImage ? 'Upload...' : (productForm.id ? 'Modifier' : 'Ajouter')}
                    </Button>
                    {productForm.id && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetProductForm}
                      >
                        Annuler
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
            
            {/* Liste des produits */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Liste des produits ({products.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {products.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Aucun produit ajouté</p>
                  ) : (
                    <div className="space-y-4">
                      {products.map((product) => (
                        <div key={product.id} className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                          {product.image_url && (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h3 className="font-medium">{product.name}</h3>
                              {!product.is_active && (
                                <Badge variant="secondary">Inactif</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {product.description || 'Aucune description'}
                            </p>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="font-bold text-primary">{product.price.toLocaleString()} FCFA</span>
                              <span className={`text-sm ${product.stock < 5 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                Stock: {product.stock}
                              </span>
                              {product.product_variants && product.product_variants.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {product.product_variants.length} variante(s)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditProduct(product)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteProduct(product.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <Card>
            <CardHeader>
              <CardTitle>Gestion des commandes ({orders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Aucune commande</p>
              ) : (
                <div className="space-y-6">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <h3 className="font-bold text-lg">Commande #{order.order_number}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString('fr-FR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Paiement:</span>{' '}
                            <Badge variant={order.payment_status === 'paye' ? 'default' : 'secondary'}>
                              {order.payment_status === 'paye' ? 'Payé' : 'En attente'}
                            </Badge>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-xl">{order.total_amount.toLocaleString()} FCFA</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <Select
                              value={order.status}
                              onValueChange={(value) => updateOrderStatus(order.id, value)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(statusLabels).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium mb-2">Informations client</h4>
                          <div className="bg-muted p-3 rounded-lg text-sm">
                            <p><strong>Nom:</strong> {order.customer_first_name} {order.customer_last_name}</p>
                            <p><strong>Téléphone:</strong> {order.customer_phone}</p>
                            <p><strong>Adresse:</strong> {order.customer_address}</p>
                            <p><strong>Méthode de paiement:</strong> {paymentMethodLabels[order.payment_method as keyof typeof paymentMethodLabels] || order.payment_method}</p>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2">Détails de la commande</h4>
                          <div className="space-y-2">
                            {order.order_items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded">
                                <div className="flex items-center space-x-3">
                                  {item.product_image_url && (
                                    <img
                                      src={item.product_image_url}
                                      alt={item.product_name}
                                      className="w-10 h-10 object-cover rounded"
                                    />
                                  )}
                                  <div>
                                    <p className="font-medium">{item.product_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {item.color_variant && `Couleur: ${item.color_variant}`}
                                      {item.size_variant && ` | Taille: ${item.size_variant}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-medium">{item.quantity} × {item.unit_price.toLocaleString()} FCFA</p>
                                  <p className="font-bold">{item.total_price.toLocaleString()} FCFA</p>
                                </div>
                              </div>
                            ))}
                            <div className="flex justify-between items-center pt-2 border-t">
                              <span>Frais de livraison:</span>
                              <span className="font-medium">{order.delivery_fee.toLocaleString()} FCFA</span>
                            </div>
                            <div className="flex justify-between items-center font-bold text-lg">
                              <span>Total:</span>
                              <span>{order.total_amount.toLocaleString()} FCFA</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Paramètres du site</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateSettings} className="space-y-6">
                  <div>
                    <Label htmlFor="company_name">Nom de l'entreprise *</Label>
                    <Input
                      id="company_name"
                      value={settingsForm.company_name}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, company_name: e.target.value }))}
                      placeholder="Votre nom d'entreprise"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="logo">Logo de l'entreprise</Label>
                    <div className="mt-1 flex items-center space-x-4">
                      <Input
                        id="logo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                      />
                    </div>
                    {logoPreview && (
                      <div className="mt-2 relative w-32 h-32 border rounded-lg overflow-hidden">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-full h-full object-contain"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-1 right-1 w-6 h-6 p-0"
                          onClick={() => {
                            setLogoPreview(null);
                            setLogoFile(null);
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="hero_title">Titre principal</Label>
                    <Input
                      id="hero_title"
                      value={settingsForm.hero_title}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, hero_title: e.target.value }))}
                      placeholder="Titre accrocheur pour la page d'accueil"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="hero_subtitle">Sous-titre</Label>
                    <Textarea
                      id="hero_subtitle"
                      value={settingsForm.hero_subtitle}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, hero_subtitle: e.target.value }))}
                      placeholder="Description ou slogan"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="footer_text">Texte de pied de page</Label>
                    <Textarea
                      id="footer_text"
                      value={settingsForm.footer_text}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, footer_text: e.target.value }))}
                      placeholder="Texte à afficher en bas du site"
                      rows={2}
                    />
                  </div>
                  
                  <Button type="submit" disabled={uploadingLogo} className="w-full">
                    {uploadingLogo ? 'Upload du logo...' : 'Enregistrer les paramètres'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}