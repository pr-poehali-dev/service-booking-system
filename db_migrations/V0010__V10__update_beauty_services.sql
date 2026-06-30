UPDATE t_p84631928_service_booking_syst.services
SET title='Маникюр классический', description='Обрезной маникюр с покрытием гель-лаком. Включает уход за кутикулой, придание формы ногтям и долговечное покрытие на 3–4 недели.', price=2500
WHERE master_id=1 AND title='Консультация';

UPDATE t_p84631928_service_booking_syst.services
SET title='Наращивание ногтей', description='Наращивание на типсах или формах с использованием акрила или геля. Результат — крепкие красивые ногти желаемой длины и формы.', price=4500
WHERE master_id=1 AND title='Стратегия';

UPDATE t_p84631928_service_booking_syst.services
SET title='Дизайн ногтей', description='Авторский дизайн: градиент, стемпинг, фольга, стразы, роспись. Работа художника на ваших ногтях.', price=800, price_type='per_hour'
WHERE master_id=1 AND title='Аудит';

UPDATE t_p84631928_service_booking_syst.services
SET title='Женская стрижка', description='Стрижка с учётом формы лица, типа волос и ваших пожеланий. Включает мытьё, укладку и профессиональный совет по уходу.', price=3000, price_type='fixed'
WHERE master_id=2 AND title='Финансы';

UPDATE t_p84631928_service_booking_syst.services
SET title='Балаяж / Омбре', description='Модное окрашивание волос техникой balayage или ombre. Плавные переходы, натуральный вид, без резкой границы отросших корней.', price=8000, price_type='fixed'
WHERE master_id=2 AND title='Налоги';

UPDATE t_p84631928_service_booking_syst.services
SET title='Кератиновое выпрямление', description='Профессиональное выпрямление волос с восстанавливающим эффектом. Результат держится 3–6 месяцев. Волосы становятся гладкими, блестящими и послушными.', price=7000, price_type='fixed'
WHERE master_id=2 AND title='Отчётность';

UPDATE t_p84631928_service_booking_syst.services
SET title='Ламинирование ресниц', description='Процедура придания ресницам красивого изгиба и объёма без накладных ресниц. Эффект держится до 6 недель. Взгляд выразительный с утра без туши.', price=2800, price_type='fixed'
WHERE master_id=3 AND title='Подбор';

UPDATE t_p84631928_service_booking_syst.services
SET title='Наращивание ресниц', description='Классическое или объёмное наращивание ресниц (2D–6D). Использую материалы премиум-класса. Коррекция через 2–3 недели.', price=3500, price_type='fixed'
WHERE master_id=3 AND title='Адаптация';

UPDATE t_p84631928_service_booking_syst.services
SET title='Коррекция и окрашивание бровей', description='Придание формы бровям, подчёркивающей черты лица. Окрашивание хной или краской для стойкого и выразительного результата на 2–4 недели.', price=1800, price_type='fixed'
WHERE master_id=3 AND title='Оценка'