-- -----------------------------
-- Seed data
-- -----------------------------

insert into public.admin_allowlist (email) values ('suarezmaiky25@gmail.com');

insert into public.services (name, slug, short_description, full_description, price, duration_minutes, display_order) values
('Corte de cabello', 'corte', 'Corte personalizado a tijera, máquina o técnica combinada.', 'Corte personalizado realizado a tijera, máquina o técnica combinada, de acuerdo con el estilo, cabello y resultado deseado.', 400, 40, 1),
('Barba', 'barba', 'Perfilado, definición y arreglo de barba.', 'Perfilado, definición y arreglo de barba con atención a las proporciones del rostro y al estilo del cliente.', 280, 30, 2),
('Corte y barba', 'corte-barba', 'Servicio integral de corte y arreglo de barba.', 'Servicio integral de corte y arreglo de barba para lograr una imagen equilibrada y coherente.', 550, 70, 3),
('Corte, barba y limpieza facial', 'corte-barba-facial', 'Experiencia completa: corte, barba y cuidado facial.', 'Experiencia completa que combina corte, arreglo de barba y cuidado básico de la piel facial.', 600, 90, 4),
('Corte de niño', 'corte-nino', 'Corte infantil a domicilio con atención paciente.', 'Corte infantil a domicilio con atención paciente, profesional y adaptada al niño.', 300, 40, 5);

insert into public.zones (neighborhood, featured, display_order) values
('Viñedos', true, 1),
('Senderos', true, 2),
('Las Villas', true, 3),
('San Isidro', true, 4);

insert into public.faqs (question, answer, pending_confirmation, display_order) values
('¿Trabaja cortes completamente a tijera?', 'Miguel cuenta con experiencia en cortes a tijera y puede recomendar la técnica adecuada según el estilo, tipo de cabello y resultado deseado.', false, 1),
('¿Cuál es el costo del servicio?', 'Los precios se muestran públicamente en la sección de servicios. Puede aplicar un recargo de traslado dependiendo de la colonia o ubicación.', false, 2),
('¿Realiza desvanecidos desde cero?', 'Información pendiente de confirmación por Miguel.', true, 3),
('¿La barba se trabaja con navaja?', 'Información pendiente de confirmación por Miguel.', true, 4),
('¿El servicio es únicamente a domicilio?', 'Sí. Miguel se desplaza hasta la residencia, hotel, oficina o ubicación acordada dentro de Torreón.', false, 5),
('¿Puedo reservar para el mismo día?', 'Sí, siempre que exista disponibilidad y se respete el aviso mínimo configurado (60 minutos).', false, 6),
('¿Cómo se realiza el pago?', 'Al terminar el servicio, mediante efectivo o transferencia.', false, 7),
('¿Puedo reservar entre semana?', 'Sí. Los horarios entre semana se solicitan directamente por WhatsApp y están sujetos a confirmación.', false, 8),
('¿Se atienden bodas o grupos?', 'Sí. Los servicios para varias personas se cotizan de forma personalizada.', false, 9),
('¿Puede aplicar un recargo por traslado?', 'Sí. Dependiendo de la colonia o ubicación, Miguel puede confirmar un recargo antes de la cita.', false, 10);

insert into public.policies (content, display_order) values
('La reserva corresponde a una ubicación específica dentro de Torreón.', 1),
('Miguel podrá confirmar la dirección, acceso, estacionamiento y posible recargo antes de desplazarse.', 2),
('El cliente debe informar cualquier cambio de dirección o servicio antes de la cita.', 3),
('Los retrasos pueden reducir el tiempo disponible o requerir una reprogramación para no afectar la siguiente cita.', 4),
('Después de tres cancelaciones consecutivas o retrasos relevantes, Miguel podrá advertir al cliente.', 5),
('Después de la advertencia, Miguel podrá rechazar o bloquear manualmente nuevas solicitudes.', 6),
('El pago se realiza al concluir el servicio.', 7),
('Los métodos aceptados son efectivo y transferencia.', 8),
('El resultado puede variar según el tipo, estado y longitud del cabello o la barba.', 9),
('Una fotografía de referencia no garantiza una réplica exacta.', 10),
('La reserva puede requerir una confirmación adicional de la ubicación y el traslado.', 11);

insert into public.site_settings (id) values (1);
insert into public.booking_settings (id) values (1);

insert into public.content_blocks (section_key, eyebrow, title, content) values
(
  'about',
  '01 · Sobre Miguel',
  'Detalle, técnica y vocación de servicio.',
  E'Miguel Ángel Suárez es graduado de Medicina en Cuba y encontró en la barbería una actividad que combina precisión, creatividad y trato directo con las personas.\n\nComenzó en la barbería por el placer de realizar cada corte con el máximo nivel de detalle y por la satisfacción de ver a un cliente feliz con el resultado.\n\nCuenta con experiencia en cortes clásicos, cortes a tijera y cortes a máquina, y aplica un enfoque personalizado considerando el estilo, las características del cabello y las facciones del cliente.'
),
(
  'hero',
  'Barbería premium a domicilio · Torreón',
  'Precisión y estilo, donde tú estés.',
  'Cortes, barba y cuidado facial con atención personalizada, técnica detallada y la comodidad de recibir el servicio en tu residencia, hotel u oficina.'
);
