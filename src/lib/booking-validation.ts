import { isValidPostalCode, isPickupAreaServiced } from "./postal-code";

export type BookingFormErrors = Partial<{
  service: string;
  date: string;
  time: string;
  full_name: string;
  phone: string;
  email: string;
  pickup_address: string;
  postal_code: string;
}>;

export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// For matching, not display — students.phone is freeform text (however a
// staff member happened to type it), so login lookups compare the last 10
// digits rather than requiring an exact string match.
export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

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
  postal_code: string;
  pickupAvailable: boolean;
  serviceAreas: string[];
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
  if (input.pickupAvailable) {
    if (!input.pickup_address.trim()) e.pickup_address = "Pickup address is required.";
    if (!input.postal_code.trim()) e.postal_code = "Postal code is required.";
    else if (!isValidPostalCode(input.postal_code)) e.postal_code = "Enter a valid postal code.";
    else if (!isPickupAreaServiced(input.postal_code, input.serviceAreas)) {
      e.postal_code = "Sorry, this address is outside our pickup area.";
    }
  }
  return e;
}
