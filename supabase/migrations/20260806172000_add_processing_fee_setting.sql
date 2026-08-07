-- Add configurable withdrawal processing fee setting.
INSERT INTO public.platform_settings (key, value, description)
VALUES ('processing_fee_amount', '50', 'Flat fee charged on each withdrawal in Naira')
ON CONFLICT (key) DO NOTHING;
