-- Phone assistant settings per shop
CREATE TABLE phone_settings (
  shop_id INTEGER PRIMARY KEY REFERENCES shop_profile(id) ON DELETE CASCADE,
  assistant_name VARCHAR(100) NOT NULL DEFAULT 'Claude',
  aggression_level INTEGER NOT NULL DEFAULT 3 CHECK (aggression_level BETWEEN 1 AND 5),
  roast_mode BOOLEAN NOT NULL DEFAULT true,
  car_commentary VARCHAR(20) NOT NULL DEFAULT 'always' CHECK (car_commentary IN ('always', 'interesting_only', 'never')),
  robocaller_acknowledgment BOOLEAN NOT NULL DEFAULT true,
  greeting_style VARCHAR(20) NOT NULL DEFAULT 'randomized' CHECK (greeting_style IN ('randomized', 'semi_scripted', 'improvised')),
  voice_style VARCHAR(20) NOT NULL DEFAULT 'dry_deadpan' CHECK (voice_style IN ('dry_deadpan', 'warm_funny', 'enthusiastic', 'gruff')),
  generated_prompt TEXT,
  prompt_dirty BOOLEAN NOT NULL DEFAULT false,
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pool of intro/greeting lines the AI can use
CREATE TABLE phone_intro_pool (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shop_profile(id) ON DELETE CASCADE,
  intro_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_phone_intro_pool_shop ON phone_intro_pool(shop_id, sort_order);

-- Seed defaults for shop_id = 1
INSERT INTO phone_settings (shop_id) VALUES (1);

INSERT INTO phone_intro_pool (shop_id, intro_text, sort_order) VALUES
  (1, '{{shop_name}}, this is {{assistant_name}} — I''m the AI here, so fair warning, this call''s recorded. But I actually know this place pretty well, so what''s going on?', 1),
  (1, 'Hey, you''ve reached {{shop_name}}. {{assistant_name}} here — I''m an AI, call''s recorded, but honestly I''m probably more helpful than you''d expect. What can I do for you?', 2),
  (1, '{{shop_name}}, {{assistant_name}} speaking. Yes, I''m an AI. No, I won''t put you on hold. What do you need?', 3),
  (1, 'You got {{shop_name}} — I''m {{assistant_name}}, the AI. This call might be recorded but I promise I won''t make it weird. How can I help?', 4),
  (1, '{{shop_name}}, you''re talking to {{assistant_name}}. I''m an AI and this call''s recorded — but I''m the good kind of AI, the kind that actually helps. What''s up?', 5),
  (1, 'This is {{assistant_name}} at {{shop_name}}. Yes, AI. Yes, recorded. No, I won''t transfer you six times. What do you need?', 6);
