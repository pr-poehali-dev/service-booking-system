UPDATE t_p84631928_service_booking_syst.users
SET name = 'Анна Соколова'
WHERE phone = '+79001001010';

UPDATE t_p84631928_service_booking_syst.masters
SET about      = 'Мастер маникюра и педикюра с 8-летним опытом. Специализируюсь на гелевом покрытии, наращивании ногтей и авторском дизайне. Использую только сертифицированные материалы премиум-класса. Берегу здоровье ваших ногтей!',
    address    = 'Москва, ул. Арбат, 24, студия «Розовый лепесток», 2 этаж',
    photo1_url = 'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/49664268-e798-4e7f-948f-9c6902482625.jpg',
    photo2_url = 'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/85f2ebf0-25f6-492d-9c78-0cbbe63e7ea1.jpg',
    photo3_url = 'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/49664268-e798-4e7f-948f-9c6902482625.jpg'
WHERE user_id = (SELECT id FROM t_p84631928_service_booking_syst.users WHERE phone='+79001001010');

UPDATE t_p84631928_service_booking_syst.users
SET name = 'Дарья Орлова'
WHERE phone = '+79001001020';

UPDATE t_p84631928_service_booking_syst.masters
SET about      = 'Профессиональный стилист-парикмахер с 10-летним опытом. Создаю стрижки, укладки и окрашивание любой сложности. Специализируюсь на балаяже, омбре и кератиновом выпрямлении. Каждый клиент — это мой шедевр!',
    address    = 'Москва, ул. Тверская, 18, салон «Glamour», 1 этаж',
    photo1_url = 'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/4513ea13-7b22-4b29-8e9f-d4138d20ce68.jpg',
    photo2_url = 'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/4ce2461c-064b-4910-9784-a86aac36b59c.jpg',
    photo3_url = 'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/4513ea13-7b22-4b29-8e9f-d4138d20ce68.jpg'
WHERE user_id = (SELECT id FROM t_p84631928_service_booking_syst.users WHERE phone='+79001001020');

UPDATE t_p84631928_service_booking_syst.users
SET name = 'Елена Морозова'
WHERE phone = '+79001001030';

UPDATE t_p84631928_service_booking_syst.masters
SET about      = 'Мастер по ламинированию и наращиванию ресниц, коррекции и окрашиванию бровей. Опыт 6 лет. Работаю с материалами Lash Secret, Vilmy, Ellami. Сделаю ваш взгляд выразительным и неотразимым!',
    address    = 'Москва, Садовое кольцо, 14, кабинет 305',
    photo1_url = 'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/dd4b4a6e-274e-41f2-a601-69b3a570f013.jpg',
    photo2_url = 'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/ddcf75a7-f5cc-43b1-8604-dd56c4491bd0.jpg',
    photo3_url = 'https://cdn.poehali.dev/projects/28cea778-46e1-49c3-86e8-ae6d3fa9407f/files/dd4b4a6e-274e-41f2-a601-69b3a570f013.jpg'
WHERE user_id = (SELECT id FROM t_p84631928_service_booking_syst.users WHERE phone='+79001001030')