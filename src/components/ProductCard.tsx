import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Package } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  stock: number;
  product_variants: {
    id: string;
    type: string;
    value: string;
    stock: number;
  }[];
}

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product, selectedOptions?: { color?: string; size?: string }) => void;
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');

  // Filtrer les variantes par type
  const colorVariants = product.product_variants?.filter(v => v.type === 'color') || [];
  const sizeVariants = product.product_variants?.filter(v => v.type === 'size') || [];

  // Vérifier si le produit est en stock
  const isInStock = product.stock > 0;
  const hasVariants = colorVariants.length > 0 || sizeVariants.length > 0;

  const formatPrice = (price: number) => {
    return `${price.toLocaleString()} FCFA`;
  };

  const handleAddToCart = () => {
    // Vérifier si des variantes sont requises mais non sélectionnées
    if (hasVariants) {
      if (colorVariants.length > 0 && !selectedColor) {
        return; // Ne pas ajouter au panier si couleur requise mais non sélectionnée
      }
      if (sizeVariants.length > 0 && !selectedSize) {
        return; // Ne pas ajouter au panier si taille requise mais non sélectionnée
      }
    }

    const selectedOptions: { color?: string; size?: string } = {};
    
    if (selectedColor) selectedOptions.color = selectedColor;
    if (selectedSize) selectedOptions.size = selectedSize;
    
    onAddToCart?.(product, selectedOptions);
  };

  return (
    <Card className="group overflow-hidden bg-gradient-card shadow-product hover:shadow-glow transition-all duration-300 hover:-translate-y-1">
      <CardHeader className="p-0">
        <div className="aspect-square overflow-hidden bg-muted relative">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-muted-foreground">Pas d'image</span>
            </div>
          )}
          
          {/* Badge de stock */}
          <div className="absolute top-2 right-2">
            {isInStock ? (
              <Badge variant="secondary" className="bg-success text-success-foreground">
                <Package className="w-3 h-3 mr-1" />
                {product.stock}
              </Badge>
            ) : (
              <Badge variant="destructive">
                Rupture
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <CardTitle className="text-lg font-semibold text-foreground mb-2">
          {product.name}
        </CardTitle>
        
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {product.description}
          </p>
        )}
        
        {/* Sélecteurs de variantes */}
        {hasVariants && (
          <div className="space-y-2 mb-4">
            {colorVariants.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1 block">Couleur</label>
                <Select value={selectedColor} onValueChange={setSelectedColor}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir une couleur" />
                  </SelectTrigger>
                  <SelectContent>
                    {colorVariants.map((variant) => (
                      <SelectItem key={variant.id} value={variant.value}>
                        {variant.value} {variant.stock > 0 ? `(${variant.stock})` : '(Rupture)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {sizeVariants.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1 block">Taille</label>
                <Select value={selectedSize} onValueChange={setSelectedSize}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir une taille" />
                  </SelectTrigger>
                  <SelectContent>
                    {sizeVariants.map((variant) => (
                      <SelectItem key={variant.id} value={variant.value}>
                        {variant.value} {variant.stock > 0 ? `(${variant.stock})` : '(Rupture)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-primary">
            {formatPrice(product.price)}
          </span>
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0">
        <Button
          onClick={handleAddToCart}
          className="w-full bg-primary hover:bg-primary-glow"
          disabled={!product.is_active || !isInStock || (hasVariants && (
            (colorVariants.length > 0 && !selectedColor) || 
            (sizeVariants.length > 0 && !selectedSize)
          ))}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          {!isInStock 
            ? 'Rupture de stock' 
            : (hasVariants && ((colorVariants.length > 0 && !selectedColor) || (sizeVariants.length > 0 && !selectedSize)))
              ? 'Sélectionnez les options'
              : 'Ajouter au panier'
          }
        </Button>
      </CardFooter>
    </Card>
  );
}