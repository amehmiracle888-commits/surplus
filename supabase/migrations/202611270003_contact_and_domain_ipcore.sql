-- Migration 202611270003: Update IPcore office address, operating hours, and ipcore.com.ng emails

UPDATE public.website_settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(value, '{supportEmail}', '"support@ipcore.com.ng"'::jsonb, true),
    '{officeLocation}',
    '"16 Idowu Martins St, Victoria Island, Lagos"'::jsonb,
    true
  ),
  '{businessHours}',
  '"Mon–Fri, 8:00 AM–5:00 PM"'::jsonb,
  true
)
WHERE key = 'contact';

UPDATE public.website_settings
SET value = jsonb_set(
  jsonb_set(value, '{fromEmail}', '"noreply@ipcore.com.ng"'::jsonb, true),
  '{replyTo}',
  '"support@ipcore.com.ng"'::jsonb,
  true
)
WHERE key = 'email_config';

UPDATE public.website_settings
SET value = '[
  {
    "id": "email-support",
    "label": "Customer Support",
    "address": "support@ipcore.com.ng",
    "purpose": "support",
    "is_active": true
  },
  {
    "id": "email-help",
    "label": "Help Desk",
    "address": "help@ipcore.com.ng",
    "purpose": "support",
    "is_active": true
  },
  {
    "id": "email-noreply",
    "label": "Transactional Sender",
    "address": "noreply@ipcore.com.ng",
    "purpose": "transactional",
    "is_active": true
  }
]'::jsonb
WHERE key = 'default_emails';
