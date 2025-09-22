-- Fix security warning by setting search_path for the function
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.order_number = nextval('public.order_number_seq');
  RETURN NEW;
END;
$$;