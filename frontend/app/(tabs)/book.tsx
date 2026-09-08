import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, type, fonts, radius } from '@/src/theme';
import { PillButton } from '@/src/components/PillButton';
import { SectionHead } from '@/src/components/SectionHead';
import { LocationPicker } from '@/src/components/LocationPicker';
import { api, normalizeBookingPhone, Service } from '@/src/api';
import { openWhatsApp, waMessages } from '@/src/contact';

const DAY_LABELS_JS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Book() {
  const insets = useSafeAreaInsets();
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [openDays, setOpenDays] = useState<number[]>([0]);
  const [dates, setDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', neighborhood: '', note: '', accept: false });
  const [pin, setPin] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneVerificationRequired, setPhoneVerificationRequired] = useState(false);
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [s, bs] = await Promise.all([api.services(), api.bookingSettings()]);
        setServices(s);
        setPhoneVerificationRequired(bs.phone_verification_required === true);
        if (bs.weekly_schedule && typeof bs.weekly_schedule === 'object') {
          const enabledDays = Object.entries(bs.weekly_schedule)
            .filter(([, config]: any) => config?.enabled === true)
            .map(([day]) => Number(day))
            .filter(day => Number.isInteger(day) && day >= 0 && day <= 6);
          setOpenDays(enabledDays);
        } else {
          setOpenDays(bs.open_days || [0]);
        }
        if (serviceId) {
          setSelected(String(serviceId));
        }
      } catch { /* silent */ }
    })();
  }, [serviceId]);

  useEffect(() => {
    const out: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (openDays.includes(d.getDay())) out.push(d);
      if (out.length >= 12) break;
    }
    setDates(out);
  }, [openDays]);

  const service = services.find(s => s.id === selected);
  const totalSteps = phoneVerificationRequired ? 4 : 3;

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setTimeout(() => setResendSeconds(v => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  useEffect(() => {
    if (!selectedDate || !selected) { setSlots([]); return; }
    setLoadingSlots(true);
    api.availableSlots(selected, selectedDate)
      .then(r => setSlots(r.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, selected]);

  const canGoStep2 = !!selected;
  const canGoStep3 = !!selected && !!selectedDate && !!selectedSlot;

  const bookingBody = (phone: string) => ({
    service_id: service!.id,
    date: selectedDate,
    time: selectedSlot,
    name: form.name.trim(),
    phone,
    address: form.address.trim(),
    neighborhood: form.neighborhood.trim(),
    note: form.note.trim(),
    latitude: pin.lat,
    longitude: pin.lng,
    accepted_policies: form.accept,
  });

  const validatedPhone = () => {
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim() || !form.neighborhood.trim()) {
      throw new Error('Por favor completa todos los campos requeridos.');
    }
    if (!form.accept) {
      throw new Error('Debes aceptar las políticas y el aviso de privacidad.');
    }
    return normalizeBookingPhone(form.phone);
  };

  const submit = async () => {
    if (!service || !selectedDate || !selectedSlot) return;
    setError(null);

    let phone: string;
    try {
      phone = validatedPhone();
    } catch (e: any) {
      setError(e.message || 'Revisa tus datos.');
      return;
    }

    setSubmitting(true);
    try {
      if (phoneVerificationRequired) {
        const r = await api.requestBookingOtp(phone);
        setOtpPhone(r.phone);
        setOtpCode('');
        setResendSeconds(60);
        setStep(4);
      } else {
        setConfirmed(await api.createBooking(bookingBody(phone)));
      }
    } catch (e: any) {
      setError(e.message || 'Error al reservar');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtpAndSubmit = async () => {
    if (!service || !selectedDate || !selectedSlot || !otpPhone) return;
    setError(null);
    setSubmitting(true);
    try {
      const r = await api.verifyBookingOtpAndCreate(otpPhone, otpCode, bookingBody(otpPhone));
      setConfirmed(r);
    } catch (e: any) {
      setError(e.message || 'No se pudo verificar el código.');
    } finally {
      setSubmitting(false);
    }
  };

  const resendOtp = async () => {
    if (!otpPhone || resendSeconds > 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const r = await api.requestBookingOtp(otpPhone);
      setOtpPhone(r.phone);
      setResendSeconds(60);
    } catch (e: any) {
      setError(e.message || 'No se pudo reenviar el código.');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmed) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper }}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.brand}>Reserva recibida</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 }}>
          <View style={styles.successCard}>
            <Feather name="check" size={28} color={colors.paper} />
          </View>
          <Text style={[type.h2, { marginTop: spacing.xl }]}>Tu horario ha sido registrado.</Text>
          <Text style={[type.body, { marginTop: spacing.md }]}>
            {confirmed.message}
          </Text>
          <View style={[styles.summary, { marginTop: spacing.xl }]}>
            <SumRow label="Servicio" value={confirmed.booking.service_name} />
            <SumRow label="Fecha" value={confirmed.booking.date} />
            <SumRow label="Hora" value={confirmed.booking.time} />
            <SumRow label="Precio" value={`$${confirmed.booking.service_price} MXN`} />
            <SumRow label="Dirección" value={`${confirmed.booking.address}, ${confirmed.booking.neighborhood}`} />
          </View>
          <PillButton
            label="Confirmar por WhatsApp"
            variant="whatsapp"
            onPress={() => openWhatsApp(
              `Hola, Miguel. Acabo de reservar ${confirmed.booking.service_name} para el ${confirmed.booking.date} a las ${confirmed.booking.time}. Mi dirección es ${confirmed.booking.address}, colonia ${confirmed.booking.neighborhood}.${confirmed.booking.latitude ? ` Pin: https://www.google.com/maps/search/?api=1&query=${confirmed.booking.latitude},${confirmed.booking.longitude}` : ''} ¿Podemos confirmar la ubicación?`
            )}
            testID="confirm-wa-btn"
            style={{ marginTop: spacing.xl }}
            fullWidth
          />
          <PillButton
            label="Nueva reserva"
            variant="secondary"
            onPress={() => {
              api.resetBookingOtp();
              setConfirmed(null); setStep(1); setSelected(null); setSelectedDate(null); setSelectedSlot(null);
              setForm({ name: '', phone: '', address: '', neighborhood: '', note: '', accept: false });
              setOtpPhone(''); setOtpCode(''); setResendSeconds(0);
              setPin({ lat: null, lng: null });
            }}
            style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.brand}>Reservar</Text>
        <Text style={styles.brandSub}>Paso {step} de {totalSteps}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 220 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.progressRow}>
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map(n => (
            <View key={n} style={[styles.progressStep, { backgroundColor: n <= step ? colors.bronze : colors.line }]} />
          ))}
        </View>

        {step === 1 && (
          <View>
            <SectionHead eyebrow="Paso 01" title="Elige el servicio" />
            {services.map(s => (
              <Pressable
                key={s.id}
                onPress={() => setSelected(s.id)}
                style={[styles.svcRow, selected === s.id && styles.svcRowSelected]}
                testID={`select-svc-${s.slug}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={type.bodyStrong}>{s.name}</Text>
                  <Text style={[type.small, { marginTop: 4 }]}>{s.duration_minutes} min · ${s.price} MXN</Text>
                </View>
                <View style={[styles.check, selected === s.id && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
                  {selected === s.id && <Feather name="check" size={14} color={colors.paper} />}
                </View>
              </Pressable>
            ))}
            <PillButton
              label="Continuar"
              onPress={() => setStep(2)}
              disabled={!canGoStep2}
              style={{ marginTop: spacing.xl }}
              testID="book-step1-continue"
              fullWidth
            />
            <View style={styles.altBox}>
              <Text style={[type.micro, { color: colors.bronze }]}>OTRO HORARIO</Text>
              <Text style={[type.body, { marginTop: spacing.sm }]}>
                Si no encuentras una fecha u hora disponible en la agenda, puedes solicitar una opción especial directamente por WhatsApp.
              </Text>
              <PillButton
                label="Solicitar otro horario"
                variant="secondary"
                onPress={() => openWhatsApp(waMessages.weekday)}
                testID="weekday-request-btn"
                style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
              />
            </View>
          </View>
        )}

        {step === 2 && service && (
          <View>
            <SectionHead eyebrow="Paso 02" title="Fecha y hora" />
            <View style={styles.selectedSvc}>
              <Text style={[type.micro, { color: colors.bronze }]}>SERVICIO</Text>
              <Text style={[type.bodyStrong, { marginTop: 4 }]}>{service.name} · {service.duration_minutes} min · ${service.price} MXN</Text>
              <Pressable onPress={() => setStep(1)}><Text style={[type.button, { color: colors.ink, marginTop: spacing.sm }]}>CAMBIAR</Text></Pressable>
            </View>
            <Text style={[type.micro, { marginTop: spacing.xl, marginBottom: spacing.md }]}>ELIGE UN DÍA</Text>
            {dates.length === 0 ? (
              <Text style={type.body}>No hay días habilitados. Contacta por WhatsApp.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.xl }}>
                {dates.map(d => {
                  const ds = toDateStr(d);
                  const active = selectedDate === ds;
                  return (
                    <Pressable key={ds} onPress={() => { setSelectedDate(ds); setSelectedSlot(null); }} style={[styles.dayChip, active && { backgroundColor: colors.ink, borderColor: colors.ink }]} testID={`date-${ds}`}>
                      <Text style={[styles.dayLabel, active && { color: colors.paper }]}>{DAY_LABELS_JS[d.getDay()]}</Text>
                      <Text style={[styles.dayNum, active && { color: colors.paper }]}>{d.getDate()}</Text>
                      <Text style={[styles.dayMonth, active && { color: 'rgba(244,241,233,0.7)' }]}>{MONTHS[d.getMonth()]}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {selectedDate && (
              <View style={{ marginTop: spacing.xl }}>
                <Text style={[type.micro, { marginBottom: spacing.md }]}>HORARIOS DISPONIBLES</Text>
                {loadingSlots ? (
                  <Text style={type.body}>Cargando…</Text>
                ) : slots.length === 0 ? (
                  <Text style={type.body}>No hay horarios disponibles para esta fecha. Elige otro día o solicita por WhatsApp.</Text>
                ) : (
                  <View style={styles.slotsGrid}>
                    {slots.map(t => (
                      <Pressable key={t} onPress={() => setSelectedSlot(t)} style={[styles.slotChip, selectedSlot === t && { backgroundColor: colors.ink, borderColor: colors.ink }]} testID={`slot-${t}`}>
                        <Text style={[styles.slotText, selectedSlot === t && { color: colors.paper }]}>{t}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
              <PillButton label="Atrás" variant="secondary" onPress={() => setStep(1)} />
              <PillButton label="Continuar" onPress={() => setStep(3)} disabled={!canGoStep3} testID="book-step2-continue" style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {step === 3 && service && (
          <View>
            <SectionHead eyebrow="Paso 03" title="Tus datos" />
            <View style={styles.selectedSvc}>
              <Text style={[type.micro, { color: colors.bronze }]}>RESUMEN</Text>
              <Text style={[type.bodyStrong, { marginTop: 4 }]}>{service.name}</Text>
              <Text style={[type.small, { marginTop: 2 }]}>{selectedDate} · {selectedSlot} · ${service.price} MXN</Text>
            </View>
            <Field label="Nombre completo" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} testID="input-name" />
            <Field label="Teléfono" value={form.phone} onChange={(v: string) => setForm({ ...form, phone: v })} keyboardType="phone-pad" testID="input-phone" />
            <Text style={[type.small, { marginTop: 6, color: colors.inkSoft }]}>
              10 dígitos se interpretan como México (+52). Para otro país incluye + y el código de país.
            </Text>
            <Field label="Dirección completa" value={form.address} onChange={(v: string) => setForm({ ...form, address: v })} testID="input-address" />
            <Field label="Colonia" value={form.neighborhood} onChange={(v: string) => setForm({ ...form, neighborhood: v })} testID="input-neighborhood" />
            <Field label="Nota (opcional)" value={form.note} onChange={(v: string) => setForm({ ...form, note: v })} multiline testID="input-note" />

            <LocationPicker
              latitude={pin.lat}
              longitude={pin.lng}
              onChange={(la, lo) => {
                if (isNaN(la) || isNaN(lo)) setPin({ lat: null, lng: null });
                else setPin({ lat: la, lng: lo });
              }}
              testID="location-picker"
            />

            <Pressable onPress={() => setForm({ ...form, accept: !form.accept })} style={styles.acceptRow} testID="accept-policies">
              <View style={[styles.checkbox, form.accept && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
                {form.accept && <Feather name="check" size={12} color={colors.paper} />}
              </View>
              <Text style={[type.small, { flex: 1 }]}>
                Acepto las <Text style={{ textDecorationLine: 'underline' }} onPress={() => router.push('/policies')}>políticas de reserva</Text> y el aviso de privacidad.
              </Text>
            </Pressable>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
              <PillButton label="Atrás" variant="secondary" onPress={() => setStep(2)} />
              <PillButton label={phoneVerificationRequired ? 'Enviar código SMS' : 'Confirmar reserva'} onPress={submit} loading={submitting} testID="book-submit-btn" style={{ flex: 1 }} />
            </View>
          </View>
        )}


        {step === 4 && service && phoneVerificationRequired && (
          <View>
            <SectionHead eyebrow="Paso 04" title="Verifica tu teléfono" />
            <View style={styles.selectedSvc}>
              <Text style={[type.micro, { color: colors.bronze }]}>CÓDIGO SMS</Text>
              <Text style={[type.bodyStrong, { marginTop: 4 }]}>Enviamos un código de 6 dígitos a {otpPhone}</Text>
              <Text style={[type.small, { marginTop: 6, color: colors.inkSoft }]}>
                La reserva no se crea hasta que el número quede verificado.
              </Text>
            </View>

            <Field
              label="Código de verificación"
              value={otpCode}
              onChange={(v: string) => setOtpCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              testID="input-otp"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <PillButton
              label="Verificar y crear reserva"
              onPress={verifyOtpAndSubmit}
              loading={submitting}
              disabled={otpCode.length !== 6}
              testID="verify-otp-btn"
              style={{ marginTop: spacing.xl }}
              fullWidth
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.lg, flexWrap: 'wrap' }}>
              <Pressable
                onPress={async () => {
                  await api.resetBookingOtp();
                  setOtpCode('');
                  setError(null);
                  setStep(3);
                }}
              >
                <Text style={[type.button, { color: colors.ink }]}>CAMBIAR NÚMERO</Text>
              </Pressable>
              <Pressable onPress={resendOtp} disabled={resendSeconds > 0 || submitting}>
                <Text style={[type.button, { color: resendSeconds > 0 ? colors.inkSoft : colors.bronze }]}>
                  {resendSeconds > 0 ? `REENVIAR EN ${resendSeconds}S` : 'REENVIAR CÓDIGO'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, keyboardType, multiline, maxLength, testID }: any) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
        style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        placeholderTextColor={colors.inkSoft}
        testID={testID}
      />
    </View>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sumRow}>
      <Text style={[type.micro, { color: colors.inkSoft }]}>{label.toUpperCase()}</Text>
      <Text style={[type.bodyStrong, { flex: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.paper },
  brand: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
  brandSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkSoft, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 2 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.xl },
  progressStep: { flex: 1, height: 2 },
  svcRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, marginTop: spacing.md },
  svcRowSelected: { borderColor: colors.ink, backgroundColor: colors.paperDeep },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  altBox: { marginTop: spacing.xxl, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white },
  selectedSvc: { padding: spacing.lg, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  dayChip: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', minWidth: 68 },
  dayLabel: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.2, color: colors.inkSoft },
  dayNum: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink, marginTop: 4 },
  dayMonth: { fontFamily: fonts.sans, fontSize: 10, color: colors.inkSoft, marginTop: 2, letterSpacing: 1 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slotChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  slotText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink, letterSpacing: 0.4 },
  fieldLabel: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.6, color: colors.inkSoft, marginBottom: 6 },
  input: { fontFamily: fonts.sans, fontSize: 15, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 10 },
  acceptRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  checkbox: { width: 22, height: 22, borderRadius: 3, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.danger, marginTop: spacing.md },
  successCard: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  summary: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.lg },
  sumRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
});
