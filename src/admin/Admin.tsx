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

      setDashboardStats({
        todayOrders,
        todayRevenue,
        lowStockProducts,
        totalProducts: products.length
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
                        placeholder="15000"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="stock">Stock *</Label>
                      <Input
                        id="stock"
                        type="number"
                        value={productForm.stock}
                        onChange={(e) => setProductForm(prev => ({ ...prev, stock: e.target.value }))}
                        placeholder="10"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="image">Image du produit</Label>
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="cursor-pointer"
                    />
                    {uploadingImage && <p className="text-sm text-muted-foreground mt-1">Upload en cours...</p>}
                    {imagePreview && (
                      <div className="mt-2">
                        <img 
                          src={imagePreview} 
                          alt="Aperçu" 
                          className="w-20 h-20 object-cover rounded border"
                        />
                      </div>
                    )}
                  </div>

                  {/* Gestion des variantes */}
                  <div className="space-y-3">
                    <Label>Variantes (couleur, taille - facultatif)</Label>
                    
                    {/* Ajouter une nouvelle variante */}
                    <div className="grid grid-cols-4 gap-2">
                      <Select value={newVariant.type} onValueChange={(value) => setNewVariant(prev => ({ ...prev, type: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="color">Couleur</SelectItem>
                          <SelectItem value="size">Taille</SelectItem>
                        </SelectContent>
                        </Select>
                      <Input
                        placeholder="Valeur"
                        value={newVariant.value}
                        onChange={(e) => setNewVariant(prev => ({ ...prev, value: e.target.value }))}
                      />
                      <Input
                        type="number"
                        placeholder="Stock"
                        value={newVariant.stock}
                        onChange={(e) => setNewVariant(prev => ({ ...prev, stock: e.target.value }))}
                      />
                      <Button type="button" onClick={addVariant} size="sm">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Liste des variantes ajoutées */}
                    {variants.length > 0 && (
                      <div className="space-y-2">
                        {variants.map((variant, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="text-sm">
                              {variant.type}: {variant.value} (Stock: {variant.stock})
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeVariant(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button type="submit" className="flex-1" disabled={uploadingImage}>
                      {uploadingImage ? "Upload en cours..." : (productForm.id ? "Modifier le produit" : "Ajouter le produit")}
                    </Button>
                    {productForm.id && (
                      <Button type="button" variant="outline" onClick={resetProductForm}>
                        Annuler
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Liste des produits existants */}
            <Card>
              <CardHeader>
                <CardTitle>Produits existants ({products.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Aucun produit. Ajoutez votre premier produit !
                  </p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {products.map((product) => (
                      <div key={product.id} className="flex items-start justify-between p-4 border rounded-lg">
                        <div className="flex items-start space-x-3 flex-1">
                          {product.image_url && (
                            <img 
                              src={product.image_url} 
                              alt={product.name}
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-medium">{product.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {product.price.toLocaleString()} FCFA - Stock: {product.stock}
                            </p>
                            {product.product_variants && product.product_variants.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {product.product_variants.map((variant) => (
                                  <Badge key={variant.id} variant="outline" className="text-xs">
                                    {variant.type}: {variant.value} ({variant.stock})
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            <Switch
                              checked={product.is_active}
                              onCheckedChange={async (checked) => {
                                try {
                                  const { error } = await supabase
                                    .from('products')
                                    .update({ is_active: checked })
                                    .eq('id', product.id);

                                  if (error) throw error;

                                  toast({
                                    title: "Succès",
                                    description: `Produit ${checked ? 'activé' : 'désactivé'}`,
                                  });

                                  fetchProducts();
                                } catch (error) {
                                  console.error('Erreur:', error);
                                  toast({
                                    title: "Erreur",
                                    description: "Impossible de modifier le statut",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            />
                            <span className="text-sm">{product.is_active ? 'Actif' : 'Inactif'}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
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
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6">
            {orders.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucune commande</h3>
                  <p className="text-muted-foreground">Les nouvelles commandes apparaîtront ici</p>
                </CardContent>
              </Card>
            ) : (
              orders.map((order) => (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>Commande #{order.order_number}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {order.customer_first_name} {order.customer_last_name} - {order.customer_phone}
                        </p>
                        <p className="text-sm text-muted-foreground">{order.customer_address}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant={
                            order.status === 'confirmee' || order.status === 'en_preparation' || 
                            order.status === 'en_livraison' || order.status === 'livree' ? 'default' : 'secondary'
                          }>
                            Paiement: {
                              order.status === 'confirmee' || order.status === 'en_preparation' || 
                              order.status === 'en_livraison' || order.status === 'livree' ? 'Payé' : 'En attente'
                            }
                          </Badge>
                          <Badge variant="outline">
                            {paymentMethodLabels[order.payment_method as keyof typeof paymentMethodLabels] || order.payment_method}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{order.total_amount.toLocaleString()} FCFA</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Articles */}
                      <div>
                        <h4 className="font-medium mb-2">Articles</h4>
                        <div className="space-y-2">
                          {order.order_items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                              <div className="flex items-center space-x-3">
                                {item.product_image_url && (
                                  <img 
                                    src={item.product_image_url} 
                                    alt={item.product_name}
                                    className="w-12 h-12 object-cover rounded border"
                                  />
                                )}
                                <div>
                                  <span className="font-medium">{item.product_name}</span>
                                  {item.color_variant && <span className="text-sm text-muted-foreground ml-2">({item.color_variant})</span>}
                                  {item.size_variant && <span className="text-sm text-muted-foreground ml-1">- {item.size_variant}</span>}
                                </div>
                              </div>
                              <div className="text-right">
                                <p>Qté: {item.quantity}</p>
                                <p className="font-medium">{item.total_price.toLocaleString()} FCFA</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Statut */}
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor={`status-${order.id}`}>Statut de la commande</Label>
                          <Select
                            value={order.status}
                            onValueChange={(value) => updateOrderStatus(order.id, value)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <Card>
            <CardHeader>
              <CardTitle>Paramètres du site</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateSettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="company_name">Nom de l'entreprise</Label>
                    <Input
                      id="company_name"
                      value={settingsForm.company_name}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, company_name: e.target.value }))}
                      placeholder="Mon Entreprise"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="hero_title">Titre principal</Label>
                    <Input
                      id="hero_title"
                      value={settingsForm.hero_title}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, hero_title: e.target.value }))}
                      placeholder="Bienvenue sur notre boutique"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="hero_subtitle">Sous-titre</Label>
                  <Input
                    id="hero_subtitle"
                    value={settingsForm.hero_subtitle}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, hero_subtitle: e.target.value }))}
                    placeholder="Découvrez nos produits de qualité"
                  />
                </div>
                
                <div>
                  <Label htmlFor="hero_image_upload">Image héro (Upload local)</Label>
                  <Input
                    id="hero_image_upload"
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          setUploadingImage(true);
                          const imageUrl = await uploadImage(file);
                          setSettingsForm(prev => ({ ...prev, hero_image_url: imageUrl }));
                          toast({
                            title: "Image uploadée",
                            description: "L'image héro a été uploadée avec succès",
                          });
                        } catch (error) {
                          toast({
                            title: "Erreur",
                            description: "Impossible d'uploader l'image",
                            variant: "destructive",
                          });
                        } finally {
                          setUploadingImage(false);
                        }
                      }
                    }}
                  />
                </div>

                <div>
                  <Label htmlFor="logo">Logo de l'entreprise</Label>
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="cursor-pointer"
                  />
                  {uploadingLogo && <p className="text-sm text-muted-foreground mt-1">Upload du logo en cours...</p>}
                  {logoPreview && (
                    <div className="mt-2">
                      <img 
                        src={logoPreview} 
                        alt="Aperçu du logo" 
                        className="w-20 h-20 object-cover rounded border"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="footer_text">Texte du footer</Label>
                  <Textarea
                    id="footer_text"
                    value={settingsForm.footer_text}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, footer_text: e.target.value }))}
                    placeholder="Votre boutique de confiance pour des produits d'exception"
                    rows={2}
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={uploadingImage || uploadingLogo}>
                  {uploadingImage || uploadingLogo ? "Upload en cours..." : "Sauvegarder les paramètres"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}