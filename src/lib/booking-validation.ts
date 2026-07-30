export type BookingFormErrors = Partial<{
  service: string;
  date: string;
  time: string;
  full_name: string;
  phone: string;
  email: string;
  pickup_address: string;
}>;

export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  const len = digits.length;
  if (len === 0) return "";
  if (len < 4) return `(${digits}`;
  if (len < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function validateBookingForm(input: {
  hasSelectedService: boolean;
  hasSelectedDate: boolean;
  hasSelectedTime: boolean;
  full_name: string;
  phone: string;
  email: string;
  pickup_address: string;
}): BookingFormErrors {
  const e: BookingFormErrors = {};
  if (!input.hasSelectedService) e.service = "Please choose a lesson.";
  if (!input.hasSelectedDate) e.date = "Please pick a date.";
  if (!input.hasSelectedTime) e.time = "Please pick a time.";
  if (!input.full_name.trim()) e.full_name = "Full name is required.";
  if (!input.phone.trim()) e.phone = "Phone number is required.";
  else if (input.phone.replace(/\D/g, "").length !== 10) e.phone = "Enter a 10-digit phone number.";
  if (!input.email.trim()) e.email = "Email is required.";
  else if (!emailOk(input.email.trim())) e.email = "Enter a valid email.";
  if (!input.pickup_address.trim()) e.pickup_address = "Pickup address is required.";
  return e;
}
