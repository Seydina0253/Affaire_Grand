// lib/naboopay.ts
import axios from 'axios';

const NABOOPAY_API_KEY = import.meta.env.VITE_NABOOPAY_API_KEY;
const NABOOPAY_BASE_URL = 'https://api.naboopay.com/api/v1';

export const naboopayApi = axios.create({
  baseURL: NABOOPAY_BASE_URL,
  headers: {
    'Authorization': `Bearer ${NABOOPAY_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Types pour NabooPay
export interface NabooProduct {
  name: string;
  category: string;
  amount: number;
  quantity: number;
  description: string;
}

export interface NabooTransactionRequest {
  method_of_payment: string[];
  products: NabooProduct[];
  success_url: string;
  error_url: string;
  is_escrow: boolean;
  is_merchant?: boolean;
  metadata?: {
    order_id?: string;
    customer_phone: string;
    [key: string]: any;
  };
}

export interface NabooTransactionResponse {
  order_id: string;
  method_of_payment: string[];
  amount: number;
  amount_to_pay: number;
  currency: string;
  created_at: string;
  transaction_status: string;
  is_escrow: boolean;
  is_merchant: boolean;
  checkout_url: string;
}

// Fonction utilitaire pour formater le numéro de téléphone
export const formatPhoneNumberForWave = (phone: string): string => {
  // Nettoyer le numéro
  let cleaned = phone.replace(/\s/g, '').replace(/[^\d+]/g, '');
  
  // S'assurer qu'il commence par +
  if (!cleaned.startsWith('+')) {
    // Si c'est un numéro local, ajouter l'indicatif par défaut
    if (cleaned.startsWith('0')) {
      cleaned = '+221' + cleaned.substring(1);
    } else {
      cleaned = '+' + cleaned;
    }
  }
  
  return cleaned;
};