-- Add photo_url column to products
ALTER TABLE public.products ADD COLUMN photo_url text;

-- Create storage bucket for product photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-photos', 'product-photos', true);

-- Public read access
CREATE POLICY "Product photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-photos');

-- Authenticated users can upload their own photos
CREATE POLICY "Users can upload product photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own photos
CREATE POLICY "Users can update product photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own photos
CREATE POLICY "Users can delete product photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
