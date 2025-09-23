import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      orders: {
        Row: {
          id: string
          order_number: number
          customer_first_name: string
          customer_last_name: string  
          customer_phone: string
          customer_address: string
          total_amount: number
          delivery_fee: number
          payment_method: string
          payment_status: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number: number
          customer_first_name: string
          customer_last_name: string
          customer_phone: string
          customer_address: string
          total_amount: number
          delivery_fee: number
          payment_method: string
          payment_status?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_number?: number
          customer_first_name?: string
          customer_last_name?: string
          customer_phone?: string
          customer_address?: string
          total_amount?: number
          delivery_fee?: number
          payment_method?: string
          payment_status?: string
          status?: string
          created_at?: string 
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
          total_price: number
          color_variant: string | null
          size_variant: string | null
          product_image_url: string | null
          created_at: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          price: number
          stock: number
          is_active: boolean
        }
        Update: {
          stock?: number
        }
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          type: string
          value: string
          stock: number
        }
        Update: {
          stock?: number
        }
      }
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { orderId } = await req.json()

    if (!orderId) {
      throw new Error('Order ID is required')
    }

    console.log('Processing payment success for order:', orderId)

    // Récupérer la commande et ses articles
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          quantity,
          color_variant,
          size_variant
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError) {
      console.error('Error fetching order:', orderError)
      throw orderError
    }

    console.log('Order found:', order)

    // Mettre à jour le statut de paiement et de la commande
    const { error: updateOrderError } = await supabaseClient
      .from('orders')
      .update({ 
        payment_status: 'paid',
        status: 'confirmee'
      })
      .eq('id', orderId)

    if (updateOrderError) {
      console.error('Error updating order status:', updateOrderError)
      throw updateOrderError
    }

    console.log('Order status updated successfully')

    // Mettre à jour le stock pour chaque article
    for (const item of order.order_items) {
      console.log('Processing item:', item)

      // Si il y a des variantes, mettre à jour le stock de la variante
      if (item.color_variant || item.size_variant) {
        // Récupérer les variantes du produit
        const { data: variants, error: variantsError } = await supabaseClient
          .from('product_variants')
          .select('id, stock')
          .eq('product_id', item.product_id)
          .eq('type', item.color_variant ? 'color' : 'size')
          .eq('value', item.color_variant || item.size_variant)

        if (variantsError) {
          console.error('Error fetching variants:', variantsError)
          throw variantsError
        }

        for (const variant of variants) {
          const newStock = Math.max(0, variant.stock - item.quantity)
          console.log(`Updating variant ${variant.id} stock from ${variant.stock} to ${newStock}`)
          
          const { error: variantUpdateError } = await supabaseClient
            .from('product_variants')
            .update({ stock: newStock })
            .eq('id', variant.id)

          if (variantUpdateError) {
            console.error('Error updating variant stock:', variantUpdateError)
            throw variantUpdateError
          }
        }
      }

      // Toujours mettre à jour le stock principal du produit
      const { data: product, error: productError } = await supabaseClient
        .from('products')
        .select('stock')
        .eq('id', item.product_id)
        .single()

      if (productError) {
        console.error('Error fetching product:', productError)
        throw productError
      }

      const newStock = Math.max(0, product.stock - item.quantity)
      console.log(`Updating product ${item.product_id} stock from ${product.stock} to ${newStock}`)
      
      const { error: stockUpdateError } = await supabaseClient
        .from('products')
        .update({ stock: newStock })
        .eq('id', item.product_id)

      if (stockUpdateError) {
        console.error('Error updating product stock:', stockUpdateError)
        throw stockUpdateError
      }
    }

    console.log('All stocks updated successfully')

    // Envoyer une notification en temps réel pour les mises à jour
    const channel = supabaseClient.channel('payment-updates')
    await channel.send({
      type: 'broadcast',
      event: 'payment-success',
      payload: { orderId, status: 'completed' }
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Paiement traité et stock mis à jour avec succès' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Erreur lors du traitement du paiement:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})