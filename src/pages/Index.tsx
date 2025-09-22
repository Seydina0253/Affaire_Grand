import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "react-router-dom";
import { Leaf, ShoppingBag, Star, Menu, X, Package, Shield, Truck, Headphones } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

interface AdminSettings {
  company_name: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  logo_url: string | null;
  footer_text: string | null;
}

interface ProductVariant {
  id: string;
  type: string;
  value: string;
  stock: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  stock: number;
  created_at: string;
  product_variants: ProductVariant[];
}

const Index = () => {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<{[key: string]: string}>({});
  const { toast } = useToast();
  const location = useLocation();
  const { addItem, items } = useCart();

  useEffect(() => {
    fetchSettings();
    fetchProducts();
    
    // Abonnement aux changements des paramètres
    const settingsChannel = supabase
      .channel('admin-settings-changes')
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

    // Abonnement aux changements des produits
    const productsChannel = supabase
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
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_variants'
        },
        () => {
          fetchProducts();
        }
      )
      .subscribe();

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    
    return () => {
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(productsChannel);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Erreur settings:', error);
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
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erreur produits:', error);
    }
  };

  const handleAddToCart = (product: Product) => {
    // Vérifier les variantes requises
    const colorVariants = product.product_variants?.filter(v => v.type === 'color') || [];
    const sizeVariants = product.product_variants?.filter(v => v.type === 'size') || [];
    
    const colorKey = `${product.id}_color`;
    const sizeKey = `${product.id}_size`;
    
    // Valider que les variantes requises sont sélectionnées
    if (colorVariants.length > 0 && !selectedVariants[colorKey]) {
      toast({
        title: "Sélection requise",
        description: "Veuillez choisir une couleur avant d'ajouter au panier",
        variant: "destructive",
      });
      return;
    }
    
    if (sizeVariants.length > 0 && !selectedVariants[sizeKey]) {
      toast({
        title: "Sélection requise", 
        description: "Veuillez choisir une taille avant d'ajouter au panier",
        variant: "destructive",
      });
      return;
    }
    
    const selectedOptions: { colorVariant?: string; sizeVariant?: string } = {};
    if (selectedVariants[colorKey]) selectedOptions.colorVariant = selectedVariants[colorKey];
    if (selectedVariants[sizeKey]) selectedOptions.sizeVariant = selectedVariants[sizeKey];
    
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image_url: product.image_url || undefined,
      ...selectedOptions
    });

    toast({
      title: "Produit ajouté !",
      description: `${product.name} a été ajouté au panier`,
    });
  };

  const handleVariantChange = (productId: string, type: string, value: string) => {
    const key = `${productId}_${type}`;
    setSelectedVariants(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const formatPrice = (price: number) => {
    return `${price.toLocaleString()} FCFA`;
  };

  const companyName = settings?.company_name || "";
  const heroTitle = settings?.hero_title || "Découvrez nos produits d'exception";
  const heroSubtitle = settings?.hero_subtitle || "Qualité, style et innovation pour tous vos besoins";

  return (
    <div className="min-h-screen bg-background">
      {/* Header avec navigation sticky */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-background/95 backdrop-blur-md shadow-card border-b' 
          : 'bg-transparent'
      }`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo avec gestion du logo personnalisé */}
            <Link to="/" className="flex items-center space-x-2">
              {settings?.logo_url ? (
                <img 
                  src={settings.logo_url} 
                  alt={companyName}
                  className="h-12 w-12 object-contain"
                />
              ) : ( <span ></span>

              )}
              <span className="text-xl font-bold text-gradient">{companyName}</span>
            </Link>

            {/* Navigation Desktop */}
            <nav className="hidden md:flex items-center space-x-8">
              <Link to="/" className="text-foreground hover:text-success transition-colors">
                Accueil
              </Link>
              <Link to="/suivi-commande" className="text-foreground hover:text-success transition-colors">
                Suivi de commande
              </Link>
              <Link to="/panier" className="relative flex items-center text-foreground hover:text-success transition-colors">
                <ShoppingBag className="h-5 w-5 mr-1" />
                Panier
                {items.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-success text-success-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                    {items.reduce((total, item) => total + item.quantity, 0)}
                  </span>
                )}
              </Link>
            </nav>

            {/* Navigation Mobile - Panier + Menu */}
            <div className="md:hidden flex items-center space-x-2">
              {/* Panier Mobile */}
              <Link to="/panier" className="relative flex items-center p-2 text-foreground hover:text-success transition-colors">
                <ShoppingBag className="h-6 w-6" />
                {items.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-success text-success-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                    {items.reduce((total, item) => total + item.quantity, 0)}
                  </span>
                )}
              </Link>
              
              {/* Menu Hamburger */}
              <button
                className="p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {/* Menu Mobile Expandable */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-background border-t py-4">
              <nav className="flex flex-col space-y-4">
                <Link to="/" className="text-foreground hover:text-success transition-colors">
                  Accueil
                </Link>
                <Link to="/suivi-commande" className="text-foreground hover:text-success transition-colors">
                  Suivi de commande
                </Link>
                <Link to="/panier" className="flex items-center text-foreground hover:text-success transition-colors">
                  <ShoppingBag className="h-5 w-5 mr-2" />
                  Panier ({items.reduce((total, item) => total + item.quantity, 0)} articles)
                </Link>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Section Hero avec image de fond */}
      <section className="relative min-h-[70vh] flex items-center">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: settings?.hero_image_url ? `url(${settings.hero_image_url})` : 'none' }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20"></div>
        
        <div className="relative container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            {heroTitle}
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-90">
            {heroSubtitle}
          </p>
          <Button 
            size="lg" 
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg"
            onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Découvrir nos produits
          </Button>
        </div>
      </section>

      {/* Section Avantages avec effets de survol */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 hover:scale-105 transition-all duration-300 cursor-pointer group">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <Shield className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">Paiement sécurisé</h3>
              <p className="text-muted-foreground">Vos transactions sont protégées par nos partenaires de confiance</p>
            </div>
            
            <div className="text-center p-6 hover:scale-105 transition-all duration-300 cursor-pointer group">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <Truck className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">Livraison rapide</h3>
              <p className="text-muted-foreground">Livraison en moins de 2h</p>
            </div>
            
            <div className="text-center p-6 hover:scale-105 transition-all duration-300 cursor-pointer group">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <Headphones className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">Suivi de commande</h3>
              <p className="text-muted-foreground">Suivez votre commande en temps réel jusqu'à sa livraison</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section Produits phares */}
      <section id="products" className="py-16 bg-secondary/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nos Produits Phares</h2>
            <p className="text-lg text-muted-foreground">Découvrez notre sélection d'articles d'exception</p>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">Aucun produit disponible pour le moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <Card key={product.id} className="group hover:shadow-lg transition-shadow">
                  <CardHeader className="p-0">
                    <div className="aspect-square overflow-hidden rounded-t-lg bg-muted relative">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* Badge de stock */}
                      <div className="absolute top-2 right-2">
                        {product.stock > 0 ? (
                          <span className="bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-medium">
                            En stock ({product.stock})
                          </span>
                        ) : (
                          <span className="bg-destructive text-destructive-foreground px-2 py-1 rounded-full text-xs font-medium">
                            Rupture
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4">
                    <CardTitle className="text-lg mb-2 line-clamp-2">{product.name}</CardTitle>
                    {product.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    <p className="text-2xl font-bold text-primary mb-4">
                      {formatPrice(product.price)}
                    </p>

                    {/* Sélection des variantes */}
                    <div className="space-y-3 mb-4">
                      {/* Couleurs */}
                      {product.product_variants?.filter(v => v.type === 'color').length > 0 && (
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Couleur</Label>
                          <Select
                            value={selectedVariants[`${product.id}_color`] || ''}
                            onValueChange={(value) => handleVariantChange(product.id, 'color', value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Choisir une couleur" />
                            </SelectTrigger>
                            <SelectContent>
                              {product.product_variants
                                .filter(v => v.type === 'color')
                                .map((variant) => (
                                  <SelectItem key={variant.id} value={variant.value}>
                                    {variant.value} ({variant.stock} disponible{variant.stock > 1 ? 's' : ''})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Tailles */}
                      {product.product_variants?.filter(v => v.type === 'size').length > 0 && (
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Taille</Label>
                          <Select
                            value={selectedVariants[`${product.id}_size`] || ''}
                            onValueChange={(value) => handleVariantChange(product.id, 'size', value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Choisir une taille" />
                            </SelectTrigger>
                            <SelectContent>
                              {product.product_variants
                                .filter(v => v.type === 'size')
                                .map((variant) => (
                                  <SelectItem key={variant.id} value={variant.value}>
                                    {variant.value} ({variant.stock} disponible{variant.stock > 1 ? 's' : ''})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <Button 
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={() => handleAddToCart(product)}
                      disabled={product.stock === 0}
                    >
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      {product.stock > 0 ? 'Ajouter au panier' : 'Rupture de stock'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-lg font-bold">{companyName}</span>
              </div>
              <p className="text-primary-foreground/80">
                {settings?.footer_text || "Votre boutique de confiance pour des produits d'exception"}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Liens rapides</h4>
              <ul className="space-y-2 text-primary-foreground/80">
                <li><Link to="/" className="hover:text-primary-foreground transition-colors">Accueil</Link></li>
                <li><Link to="/suivi-commande" className="hover:text-primary-foreground transition-colors">Suivi de commande</Link></li>
                <li><Link to="/panier" className="hover:text-primary-foreground transition-colors">Panier</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-primary-foreground/80">
                <li>Email: contact@affairedegrand.com</li>
                <li>Téléphone: +221 77 777 77 77</li>
                <li>Adresse: Keur Massar,Dakar, Sénégal</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Informations</h4>
              <ul className="space-y-2 text-primary-foreground/80">
                <li><a href="#" className="hover:text-primary-foreground transition-colors">À propos</a></li>
                <li><a href="#" className="hover:text-primary-foreground transition-colors">Politique de retour</a></li>
                <li><a href="#" className="hover:text-primary-foreground transition-colors">Conditions générales</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-primary-foreground/20 mt-8 pt-8 text-center text-primary-foreground/60">
            <p>&copy; <Link to="/admin/auth" className="hover:text-primary-foreground transition-colors">2025</Link> {companyName}. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;