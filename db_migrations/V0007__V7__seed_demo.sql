INSERT INTO users (name, phone, role, session_token) VALUES
  ('Анна Соколова',  '+79001001010', 'master', 'token-master-1'),
  ('Дмитрий Орлов',  '+79001001020', 'master', 'token-master-2'),
  ('Елена Морозова', '+79001001030', 'master', 'token-master-3'),
  ('Иван Петров',    '+79001002010', 'client', 'token-client-1'),
  ('Мария Козлова',  '+79001002020', 'client', 'token-client-2')
ON CONFLICT DO NOTHING;

INSERT INTO masters (user_id, about, photo1_url, photo2_url, photo3_url)
SELECT id, 'Помогаю предпринимателям выстроить стратегию роста. 12 лет в консалтинге, более 300 проектов.',
  'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/a910b70d-901a-410f-ac33-8e81a6ca89f6.jpg',
  'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/e58ab882-16ce-4cee-9ebc-d850d0faf123.jpg',
  'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/ccdac817-54fc-49a5-b475-b6c6c7e1e899.jpg'
FROM users WHERE phone='+79001001010' ON CONFLICT DO NOTHING;

INSERT INTO masters (user_id, about, photo1_url, photo2_url, photo3_url)
SELECT id, 'Финансовое планирование и налоговая оптимизация для малого бизнеса.',
  'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/ccdac817-54fc-49a5-b475-b6c6c7e1e899.jpg',
  'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/a910b70d-901a-410f-ac33-8e81a6ca89f6.jpg',
  'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/e58ab882-16ce-4cee-9ebc-d850d0faf123.jpg'
FROM users WHERE phone='+79001001020' ON CONFLICT DO NOTHING;

INSERT INTO masters (user_id, about, photo1_url, photo2_url, photo3_url)
SELECT id, 'Подбор и адаптация персонала. Выстраиваю HR-процессы с нуля. Работаю мягко и по делу.',
  'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/e58ab882-16ce-4cee-9ebc-d850d0faf123.jpg',
  'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/ccdac817-54fc-49a5-b475-b6c6c7e1e899.jpg',
  'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/a910b70d-901a-410f-ac33-8e81a6ca89f6.jpg'
FROM users WHERE phone='+79001001030' ON CONFLICT DO NOTHING;

INSERT INTO services (master_id, title, price_type, price)
SELECT m.id, s.title, s.price_type, s.price FROM masters m
JOIN users u ON u.id=m.user_id AND u.phone='+79001001010'
CROSS JOIN (VALUES
  ('Консультация','fixed',3500),
  ('Стратегия','fixed',5000),
  ('Аудит','per_hour',2000)
) AS s(title,price_type,price);

INSERT INTO services (master_id, title, price_type, price)
SELECT m.id, s.title, s.price_type, s.price FROM masters m
JOIN users u ON u.id=m.user_id AND u.phone='+79001001020'
CROSS JOIN (VALUES
  ('Финансы','per_hour',2000),
  ('Налоги','fixed',4500),
  ('Отчётность','fixed',3000)
) AS s(title,price_type,price);

INSERT INTO services (master_id, title, price_type, price)
SELECT m.id, s.title, s.price_type, s.price FROM masters m
JOIN users u ON u.id=m.user_id AND u.phone='+79001001030'
CROSS JOIN (VALUES
  ('Подбор','fixed',2800),
  ('Адаптация','per_hour',1500),
  ('Оценка','fixed',2000)
) AS s(title,price_type,price);

INSERT INTO slots (master_id, slot_start, slot_end)
SELECT m.id,
  NOW() + (d * interval '1 day') + (h * interval '1 hour'),
  NOW() + (d * interval '1 day') + (h * interval '1 hour') + interval '1 hour'
FROM masters m
JOIN users u ON u.id=m.user_id AND u.phone='+79001001010'
CROSS JOIN (VALUES (1,10),(1,11),(1,14),(1,15),(2,9),(2,11),(2,14)) AS t(d,h)
ON CONFLICT DO NOTHING;

INSERT INTO slots (master_id, slot_start, slot_end)
SELECT m.id,
  NOW() + (d * interval '1 day') + (h * interval '1 hour'),
  NOW() + (d * interval '1 day') + (h * interval '1 hour') + interval '1 hour'
FROM masters m
JOIN users u ON u.id=m.user_id AND u.phone='+79001001020'
CROSS JOIN (VALUES (1,10),(1,13),(1,15),(2,10),(2,12),(2,16)) AS t(d,h)
ON CONFLICT DO NOTHING;

INSERT INTO slots (master_id, slot_start, slot_end)
SELECT m.id,
  NOW() + (d * interval '1 day') + (h * interval '1 hour'),
  NOW() + (d * interval '1 day') + (h * interval '1 hour') + interval '1 hour'
FROM masters m
JOIN users u ON u.id=m.user_id AND u.phone='+79001001030'
CROSS JOIN (VALUES (1,10),(1,11),(1,16),(2,9),(2,14),(2,17)) AS t(d,h)
ON CONFLICT DO NOTHING