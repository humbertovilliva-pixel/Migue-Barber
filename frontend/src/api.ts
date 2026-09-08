import { Platform } from 'react-native';
import { supabase } from './supabase';

const MEDIA_BUCKET = 'barber-media';

function fail(error: any): never {
  throw new Error(error?.message || 'Ocurrió un error inesperado');
}

function clean<T extends Record<string, any>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

async function singleSetting(table: 'site_settings' | 'booking_settings') {
  const { data, error } = await supabase.from(table).select('*').eq('id', 1).single();
  if (error) fail(error);
  return data;
}

async function publicList(table: string, extra?: (q: any) => any) {
  let q: any = supabase.from(table).select('*');
  if (extra) q = extra(q);
  const { data, error } = await q;
  if (error) fail(error);
  return data || [];
}

async function adminCheck() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('No autorizado');
  const { data: allowed, error } = await supabase.rpc('is_current_user_admin');
  if (error || allowed !== true) throw new Error('No autorizado');
  return userData.user;
}

async function adminList(table: string, order = 'display_order', ascending = true) {
  await adminCheck();
  const { data, error } = await supabase.from(table).select('*').order(order, { ascending });
  if (error) fail(error);
  return data || [];
}

async function adminInsert(table: string, body: any) {
  await adminCheck();
  const { data, error } = await supabase.from(table).insert(clean(body)).select('*').single();
  if (error) fail(error);
  return data;
}

async function adminUpdate(table: string, id: string, body: any) {
  await adminCheck();
  const { data, error } = await supabase.from(table).update(clean(body)).eq('id', id).select('*').single();
  if (error) fail(error);
  return data;
}

async function adminDelete(table: string, id: string) {
  await adminCheck();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) fail(error);
  return { ok: true };
}

export const api = {
  siteSettings: () => singleSetting('site_settings'),
  services: () => publicList('services', q => q.order('display_order', { ascending: true })),
  zones: () => publicList('zones', q => q.order('display_order', { ascending: true })),
  faqs: () => publicList('faqs', q => q.order('display_order', { ascending: true })),
  testimonials: () => publicList('testimonials', q => q.order('display_order', { ascending: true })),
  policies: () => publicList('policies', q => q.order('display_order', { ascending: true })),
  bookingSettings: () => singleSetting('booking_settings'),

  availableSlots: async (serviceId: string, date: string) => {
    const { data, error } = await supabase.rpc('get_available_slots', {
      p_service_id: serviceId,
      p_date: date,
    });
    if (error) fail(error);
    return data;
  },

  createBooking: async (body: any) => {
    const { data, error } = await supabase.rpc('create_booking', {
      p_service_id: body.service_id,
      p_date: body.date,
      p_time: body.time,
      p_name: body.name,
      p_phone: body.phone,
      p_address: body.address,
      p_neighborhood: body.neighborhood,
      p_note: body.note || '',
      p_latitude: body.latitude ?? null,
      p_longitude: body.longitude ?? null,
      p_accepted_policies: body.accepted_policies === true,
    });
    if (error) fail(error);
    return data;
  },

  // Admin auth
  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) throw new Error('Credenciales inválidas');

    const { data: allowed, error: roleError } = await supabase.rpc('is_current_user_admin');
    if (roleError || allowed !== true) {
      await supabase.auth.signOut();
      throw new Error('Credenciales inválidas');
    }

    return { token: data.session.access_token, email: data.user.email || email };
  },
  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) fail(error);
  },
  getStoredEmail: async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.email || null;
  },
  getToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  },
  me: async () => {
    const user = await adminCheck();
    return { email: user.email || '' };
  },

  // Admin services
  adminListServices: () => adminList('services'),
  adminCreateService: (body: any) => adminInsert('services', body),
  adminUpdateService: (id: string, body: any) => adminUpdate('services', id, body),
  adminDeleteService: (id: string) => adminDelete('services', id),

  // Admin zones
  adminListZones: () => adminList('zones'),
  adminCreateZone: (body: any) => adminInsert('zones', body),
  adminUpdateZone: (id: string, body: any) => adminUpdate('zones', id, body),
  adminDeleteZone: (id: string) => adminDelete('zones', id),

  // Admin FAQs
  adminListFaqs: () => adminList('faqs'),
  adminCreateFaq: (body: any) => adminInsert('faqs', body),
  adminUpdateFaq: (id: string, body: any) => adminUpdate('faqs', id, body),
  adminDeleteFaq: (id: string) => adminDelete('faqs', id),

  // Admin testimonials
  adminCreateTestimonial: (body: any) => adminInsert('testimonials', body),
  adminListTestimonials: () => adminList('testimonials'),
  adminUpdateTestimonial: (id: string, body: any) => adminUpdate('testimonials', id, body),
  adminDeleteTestimonial: (id: string) => adminDelete('testimonials', id),

  adminBookings: async () => {
    await adminCheck();
    const { data, error } = await supabase
      .from('bookings')
      .select('id,service_id,service_name,service_duration,service_price,date,time,name,phone,address,neighborhood,note,latitude,longitude,accepted_policies,status,created_at')
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return data || [];
  },

  adminUpdateSiteSettings: async (body: any) => {
    await adminCheck();
    const { data, error } = await supabase.from('site_settings').update(clean(body)).eq('id', 1).select('*').single();
    if (error) fail(error);
    return data;
  },
  adminUpdateBookingSettings: async (body: any) => {
    await adminCheck();
    const { data, error } = await supabase.from('booking_settings').update(clean(body)).eq('id', 1).select('*').single();
    if (error) fail(error);
    return data;
  },
  changePassword: async (current_password: string, new_password: string) => {
    if (new_password.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
    await adminCheck();
    const { error } = await supabase.auth.updateUser({ password: new_password, current_password } as any);
    if (error) fail(error);
    return { ok: true };
  },

  listMedia: (category?: string) => publicList('media', q => {
    let next = q.order('display_order', { ascending: true }).order('created_at', { ascending: false });
    if (category) next = next.eq('category', category);
    return next;
  }),
  adminListMedia: async () => {
    await adminCheck();
    const { data, error } = await supabase.from('media').select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return data || [];
  },
  adminUpdateMedia: (id: string, body: any) => adminUpdate('media', id, body),
  adminDeleteMedia: async (id: string) => {
    await adminCheck();

    const { data: media, error: mediaError } = await supabase
      .from('media')
      .select('id,storage_path,file_url')
      .eq('id', id)
      .single();
    if (mediaError) fail(mediaError);

    const { data: settings, error: settingsError } = await supabase
      .from('site_settings')
      .select('hero_image_url,about_image_url')
      .eq('id', 1)
      .single();
    if (settingsError) fail(settingsError);

    const settingsPatch: Record<string, string> = {};
    if (settings.hero_image_url === media.file_url) settingsPatch.hero_image_url = '';
    if (settings.about_image_url === media.file_url) settingsPatch.about_image_url = '';

    if (Object.keys(settingsPatch).length > 0) {
      const { error: clearReferenceError } = await supabase
        .from('site_settings')
        .update(settingsPatch)
        .eq('id', 1);
      if (clearReferenceError) fail(clearReferenceError);
    }

    const { error: storageError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .remove([media.storage_path]);

    if (storageError) {
      if (Object.keys(settingsPatch).length > 0) {
        await supabase.from('site_settings').update({
          ...(settingsPatch.hero_image_url !== undefined ? { hero_image_url: media.file_url } : {}),
          ...(settingsPatch.about_image_url !== undefined ? { about_image_url: media.file_url } : {}),
        }).eq('id', 1);
      }
      fail(storageError);
    }

    const { error: deleteError } = await supabase.from('media').delete().eq('id', id);
    if (deleteError) fail(deleteError);

    return { ok: true };
  },

  contentBlocks: () => publicList('content_blocks'),
  contentBlock: async (key: string) => {
    const { data, error } = await supabase.from('content_blocks').select('*').eq('section_key', key).single();
    if (error) fail(error);
    return data;
  },
  adminUpdateContentBlock: async (key: string, body: any) => {
    await adminCheck();
    const { data, error } = await supabase.from('content_blocks')
      .upsert({ section_key: key, ...clean(body) }, { onConflict: 'section_key' })
      .select('*').single();
    if (error) fail(error);
    return data;
  },

  adminListClients: async () => {
    await adminCheck();
    const { data, error } = await supabase.from('clients').select('*').order('last_seen_at', { ascending: false });
    if (error) fail(error);
    return data || [];
  },
  adminGetClient: async (id: string) => {
    await adminCheck();
    const { data: client, error: clientError } = await supabase.from('clients').select('*').eq('id', id).single();
    if (clientError) fail(clientError);
    const { data: bookings, error: bookingsError } = await supabase.from('bookings')
      .select('id,service_id,service_name,service_duration,service_price,date,time,name,phone,address,neighborhood,note,latitude,longitude,status,created_at')
      .eq('phone_key', client.phone_key)
      .order('date', { ascending: false })
      .order('time', { ascending: false });
    if (bookingsError) fail(bookingsError);
    return { client, bookings: bookings || [] };
  },
  adminUpdateClient: (id: string, body: any) => adminUpdate('clients', id, body),
  adminDeleteClient: (id: string) => adminDelete('clients', id),

  uploadMedia: async (uri: string, filename: string, mimeType: string, category: string) => {
    const user = await adminCheck();
    if (!mimeType.startsWith('image/')) throw new Error('Solo se permiten imágenes');

    const extRaw = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : 'jpg';
    const ext = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(extRaw) ? extRaw : 'jpg';
    const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const storagePath = `miguel-suarez-barber/uploads/admin/${randomId}.${ext}`;

    const response = await fetch(uri);
    const body: any = Platform.OS === 'web' ? await response.blob() : await response.arrayBuffer();
    const size = typeof body?.size === 'number' ? body.size : body?.byteLength || 0;
    if (size > 8 * 1024 * 1024) throw new Error('Imagen demasiado grande (máx 8 MB)');

    const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, body, {
      contentType: mimeType,
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploadError) fail(uploadError);

    const { data: publicData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
    const doc = {
      storage_path: storagePath,
      file_url: publicData.publicUrl,
      content_type: mimeType,
      size,
      category,
      alt_text: '',
      active: true,
      display_order: 0,
      uploaded_by: user.email || null,
    };

    const { data, error } = await supabase.from('media').insert(doc).select('*').single();
    if (error) {
      await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
      fail(error);
    }
    return data;
  },
};

export function absoluteMediaUrl(path?: string | null) {
  return path || null;
}

export type Service = {
  id: string; name: string; slug: string; short_description: string; full_description: string;
  price: number; currency: string; duration_minutes: number; buffer_minutes: number;
  active: boolean; display_order: number;
};
export type Zone = { id: string; neighborhood: string; featured: boolean; surcharge_amount?: number | null; surcharge_status: string; message: string; active: boolean; display_order: number; };
export type Faq = { id: string; question: string; answer: string; category: string; pending_confirmation: boolean; active: boolean; display_order: number; };
export type Testimonial = { id: string; display_name: string; service_name: string; content: string; permission_confirmed: boolean; active: boolean; display_order: number; };
export type SiteSettings = { business_name: string; full_name: string; descriptor: string; slogan: string; phone: string; whatsapp: string; email: string; city: string; instagram: string; facebook: string; booking_url: string; hero_image_url: string; about_image_url: string; };
export type Media = { id: string; storage_path: string; file_url: string; content_type: string; size: number; category: string; alt_text: string; active: boolean; display_order: number; created_at: string; };
export type ContentBlock = { section_key: string; eyebrow: string; title: string; content: string; cta_label?: string; cta_url?: string; active: boolean; };
export type Client = { id: string; phone: string; phone_key: string; name: string; first_seen_at: string; last_seen_at: string; bookings_count: number; last_address: string; last_neighborhood: string; last_latitude?: number | null; last_longitude?: number | null; notes: string; tags: string[]; };
