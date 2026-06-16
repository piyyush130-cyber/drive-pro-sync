import { createServerFn } from "@tanstack/react-start";

const STUDENTS = [
  { name: "Liam Tremblay", email: "liam.tremblay@example.ca", phone: "(204) 555-0101", address: "248 Wellington Cres, Winnipeg" },
  { name: "Olivia Chen", email: "olivia.chen@example.ca", phone: "(204) 555-0102", address: "1140 Pembina Hwy, Winnipeg" },
  { name: "Noah Kowalski", email: "noah.k@example.ca", phone: "(204) 555-0103", address: "55 Goulet St, Winnipeg" },
  { name: "Emma Singh", email: "emma.singh@example.ca", phone: "(204) 555-0104", address: "920 Henderson Hwy, Winnipeg" },
  { name: "Ethan Dubois", email: "ethan.dubois@example.ca", phone: "(204) 555-0105", address: "313 Portage Ave, Winnipeg" },
  { name: "Sophia Nguyen", email: "sophia.n@example.ca", phone: "(204) 555-0106", address: "78 Stafford St, Winnipeg" },
  { name: "Mateo Reyes", email: "mateo.reyes@example.ca", phone: "(204) 555-0107", address: "401 Corydon Ave, Winnipeg" },
  { name: "Ava Macdonald", email: "ava.mac@example.ca", phone: "(204) 555-0108", address: "612 Osborne St, Winnipeg" },
];
const EXTRA_INSTRUCTORS = [
  { full_name: "Sarah Mitchell", email: "sarah.m@wpgprodrive.ca", phone: "(204) 555-0201" },
  { full_name: "James Okafor", email: "james.o@wpgprodrive.ca", phone: "(204) 555-0202" },
  { full_name: "Priya Singh", email: "priya.s@wpgprodrive.ca", phone: "(204) 555-0203" },
];

export const seedDemoAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  async function ensureUser(email: string, password: string, fullName: string) {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    let user = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error) throw new Error(error.message);
      user = data.user!;
    }
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: user.id, email, full_name: fullName }, { onConflict: "id" });
    return user.id;
  }

  const adminId = await ensureUser("admin@demo.com", "Demo12345", "Demo Admin");
  const instId = await ensureUser("instructor@demo.com", "Demo12345", "Demo Instructor");

  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: adminId, role: "admin" }, { onConflict: "user_id,role" });
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: instId, role: "instructor" }, { onConflict: "user_id,role" });

  // School settings
  await supabaseAdmin.from("school_settings").upsert(
    {
      id: 1,
      school_name: "Winnipeg Pro Driving School",
      city: "Winnipeg",
      province: "MB",
      contact_phone: "(204) 555-0188",
      contact_email: "info@wpgprodrive.ca",
      service_area: "Within 20km of downtown Winnipeg",
      onboarding_complete: true,
    },
    { onConflict: "id" },
  );

  // Default instructor profile
  const defaultAvail = {
    monday: { enabled: true, start: "09:00", end: "17:00" },
    tuesday: { enabled: true, start: "09:00", end: "17:00" },
    wednesday: { enabled: true, start: "09:00", end: "17:00" },
    thursday: { enabled: true, start: "09:00", end: "17:00" },
    friday: { enabled: true, start: "09:00", end: "17:00" },
    saturday: { enabled: false, start: "09:00", end: "17:00" },
    sunday: { enabled: false, start: "09:00", end: "17:00" },
  };
  const { data: existingPrimary } = await supabaseAdmin
    .from("instructors")
    .select("id")
    .eq("profile_id", instId)
    .maybeSingle();
  let primaryInstructorId: string;
  if (!existingPrimary) {
    const { data } = await supabaseAdmin
      .from("instructors")
      .insert({
        profile_id: instId,
        full_name: "Demo Instructor",
        email: "instructor@demo.com",
        active: true,
        weekly_availability: defaultAvail,
      })
      .select()
      .single();
    primaryInstructorId = data!.id;
  } else {
    primaryInstructorId = existingPrimary.id;
    await supabaseAdmin
      .from("instructors")
      .update({ weekly_availability: defaultAvail })
      .eq("id", primaryInstructorId);
  }

  // Extra instructors
  const instructorIds: string[] = [primaryInstructorId];
  for (const ei of EXTRA_INSTRUCTORS) {
    const { data: exist } = await supabaseAdmin
      .from("instructors")
      .select("id")
      .eq("email", ei.email)
      .maybeSingle();
    if (exist) {
      instructorIds.push(exist.id);
    } else {
      const { data } = await supabaseAdmin
        .from("instructors")
        .insert({ ...ei, active: true, weekly_availability: defaultAvail })
        .select()
        .single();
      if (data) instructorIds.push(data.id);
    }
  }

  // Lesson types - only seed if none exist
  const { count: ltCount } = await supabaseAdmin
    .from("lesson_types")
    .select("*", { count: "exact", head: true });
  if ((ltCount ?? 0) === 0) {
    await supabaseAdmin.from("lesson_types").insert([
      { name: "1 Hour Lesson", duration_minutes: 60, price_cents: 6500, active: true, sort_order: 0, category: "lesson" },
      { name: "1.5 Hour Lesson", duration_minutes: 90, price_cents: 9500, active: true, sort_order: 1, category: "lesson" },
      { name: "2 Hour Lesson", duration_minutes: 120, price_cents: 12000, active: true, sort_order: 2, category: "lesson" },
      { name: "Road Test Package", duration_minutes: 90, price_cents: 18000, active: true, sort_order: 3, category: "lesson" },
    ]);
  }
  const { data: lessonTypes } = await supabaseAdmin.from("lesson_types").select("id, price_cents, duration_minutes").limit(4);

  // Students
  const studentIds: string[] = [];
  for (const s of STUDENTS) {
    const { data: exist } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("email", s.email)
      .maybeSingle();
    if (exist) {
      studentIds.push(exist.id);
    } else {
      const { data } = await supabaseAdmin
        .from("students")
        .insert({
          full_name: s.name,
          email: s.email,
          phone: s.phone,
          pickup_address: s.address,
        })
        .select()
        .single();
      if (data) studentIds.push(data.id);
    }
  }

  // Bookings - only seed if fewer than 5 exist
  const { count: bCount } = await supabaseAdmin
    .from("bookings")
    .select("*", { count: "exact", head: true });
  if ((bCount ?? 0) < 5 && lessonTypes && lessonTypes.length > 0 && studentIds.length > 0) {
    const now = new Date();
    const statuses: ("confirmed" | "pending" | "completed" | "no_show")[] = [
      "completed", "completed", "completed", "completed",
      "confirmed", "confirmed", "confirmed",
      "pending", "pending",
      "no_show",
      "confirmed", "confirmed",
    ];
    const rows = statuses.map((status, i) => {
      const dayOffset = i - 6; // -6..+5
      const date = new Date(now);
      date.setDate(date.getDate() + dayOffset);
      date.setHours(9 + (i % 8), (i % 2) * 30, 0, 0);
      const lt = lessonTypes[i % lessonTypes.length];
      return {
        student_id: studentIds[i % studentIds.length],
        instructor_id: instructorIds[i % instructorIds.length],
        lesson_type_id: lt.id,
        scheduled_at: date.toISOString(),
        duration_minutes: lt.duration_minutes,
        price_cents: lt.price_cents,
        status,
        payment_status: status === "completed" ? "paid" : "unpaid",
      };
    });
    await supabaseAdmin.from("bookings").insert(rows);

    // Cancellation requests on 2 confirmed bookings
    const { data: confirmedBookings } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("status", "confirmed")
      .limit(2);
    if (confirmedBookings) {
      for (const b of confirmedBookings) {
        await supabaseAdmin
          .from("cancellation_requests")
          .insert({ booking_id: b.id, reason: "Schedule conflict, need to reschedule." });
      }
    }
  }

  return { ok: true };
});
