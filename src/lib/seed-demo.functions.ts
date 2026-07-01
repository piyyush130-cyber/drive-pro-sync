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
  try {
    return await runSeed();
  } catch (err: any) {
    console.error("[seedDemoAccounts] failed:", err);
    throw new Error(`Demo seed failed: ${err?.message || String(err)}`);
  }
});

async function runSeed() {
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

  const adminRoleResult = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: adminId, role: "admin" }, { onConflict: "user_id,role" });
  if (adminRoleResult.error) throw new Error("Admin role failed: " + adminRoleResult.error.message);

  const instRoleResult = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: instId, role: "instructor" }, { onConflict: "user_id,role" });
  if (instRoleResult.error) throw new Error("Instructor role failed: " + instRoleResult.error.message);

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
  const STUDENT_NOTES = [
    "Beginner — wants extra parking practice.",
    "Road test preparation. Focus on shoulder checks.",
    "Needs help with lane changes on Kenaston.",
    "Prefers calm, patient instruction.",
    "Pickup from Red River College main entrance.",
    "Working on parallel parking downtown.",
    "Nervous on Perimeter Hwy — build confidence.",
    "Almost ready for road test — polish 3-point turn.",
  ];
  const studentIds: string[] = [];
  for (let i = 0; i < STUDENTS.length; i++) {
    const s = STUDENTS[i];
    const note = STUDENT_NOTES[i % STUDENT_NOTES.length];
    const { data: exist } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("email", s.email)
      .maybeSingle();
    if (exist) {
      studentIds.push(exist.id);
      await supabaseAdmin.from("students").update({ notes: note, pickup_address: s.address }).eq("id", exist.id);
    } else {
      const { data } = await supabaseAdmin
        .from("students")
        .insert({
          full_name: s.name,
          email: s.email,
          phone: s.phone,
          pickup_address: s.address,
          notes: note,
        })
        .select()
        .single();
      if (data) studentIds.push(data.id);
    }
  }

  // General bookings seed - only if fewer than 5 exist
  const { count: bCount } = await supabaseAdmin
    .from("bookings")
    .select("*", { count: "exact", head: true });
  if ((bCount ?? 0) < 5 && lessonTypes && lessonTypes.length > 0 && studentIds.length > 0) {
    const now = new Date();
    const statuses: ("confirmed" | "pending" | "completed" | "no_show")[] = [
      "completed", "completed", "completed",
      "confirmed", "confirmed",
      "pending", "pending",
      "no_show",
    ];
    const rows = statuses.map((status, i) => {
      const dayOffset = i - 5;
      const date = new Date(now);
      date.setDate(date.getDate() + dayOffset);
      date.setHours(9 + (i % 8), (i % 2) * 30, 0, 0);
      const lt = lessonTypes[i % lessonTypes.length];
      return {
        student_id: studentIds[i % studentIds.length],
        instructor_id: instructorIds[(i + 1) % instructorIds.length],
        lesson_type_id: lt.id,
        scheduled_at: date.toISOString(),
        duration_minutes: lt.duration_minutes,
        price_cents: lt.price_cents,
        status,
        payment_status: (status === "completed" ? "paid" : "unpaid") as "paid" | "unpaid",
        pickup_address: STUDENTS[i % STUDENTS.length].address,
      };
    });
    await supabaseAdmin.from("bookings").insert(rows);

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

  // GUARANTEE: demo instructor has >=5 upcoming confirmed lessons in next 7 days
  if (lessonTypes && lessonTypes.length > 0 && studentIds.length >= 5) {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);
    const { count: upcomingCount } = await supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("instructor_id", primaryInstructorId)
      .eq("status", "confirmed")
      .gte("scheduled_at", now.toISOString())
      .lt("scheduled_at", in7.toISOString());

    if ((upcomingCount ?? 0) < 5) {
      // Wipe any prior demo-instructor upcoming rows to avoid duplicates on reseed
      await supabaseAdmin
        .from("bookings")
        .delete()
        .eq("instructor_id", primaryInstructorId)
        .gte("scheduled_at", now.toISOString());

      const slots = [
        { dayOffset: 0, hour: 10, min: 0 },
        { dayOffset: 0, hour: 14, min: 30 },
        { dayOffset: 1, hour: 9, min: 0 },
        { dayOffset: 1, hour: 13, min: 0 },
        { dayOffset: 2, hour: 11, min: 0 },
        { dayOffset: 3, hour: 15, min: 30 },
        { dayOffset: 4, hour: 10, min: 30 },
      ];
      const rows = slots.map((s, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() + s.dayOffset);
        date.setHours(s.hour, s.min, 0, 0);
        const lt = lessonTypes[i % lessonTypes.length];
        const stu = STUDENTS[i % STUDENTS.length];
        return {
          student_id: studentIds[i % studentIds.length],
          instructor_id: primaryInstructorId,
          lesson_type_id: lt.id,
          scheduled_at: date.toISOString(),
          duration_minutes: lt.duration_minutes,
          price_cents: lt.price_cents,
          status: "confirmed" as const,
          payment_status: "unpaid" as const,
          pickup_address: stu.address,
          notes: STUDENT_NOTES[i % STUDENT_NOTES.length],
        };
      });
      await supabaseAdmin.from("bookings").insert(rows);
    }
  }



  return { ok: true };
}

