import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updatedDate="August 8, 2026">
      <p>
        This Privacy Policy explains how DrivingOps ("we," "us," "our") collects, uses, and
        protects personal information, and applies to driving school staff who create an account
        and to students who book lessons through a school's DrivingOps booking page, portal, or
        text/email links, whether or not they create an account.
      </p>

      <LegalSection heading="1. Information We Collect">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>From driving school staff (Account Holders):</strong> name, email address, and
            phone number.
          </li>
          <li>
            <strong>From students booking a lesson:</strong> name, phone number, email address,
            pickup and drop-off address, and any notes provided at booking (e.g. pickup
            instructions).
          </li>
          <li>
            <strong>Lesson and progress records kept by your school:</strong> booking history,
            lesson notes, skills progress, road-test readiness, and — in Manitoba — MPI Training
            Support Requirement (TSR) verification records showing completed instruction hours and
            who issued the verification.
          </li>
          <li>
            <strong>Incident or complaint notes:</strong> a free-text field your school's staff may
            use to record incidents involving your booking or account. This is internal to the
            school and is never shown to you or your instructor.
          </li>
          <li>
            <strong>Communications:</strong> the content and delivery status of emails and text
            messages sent to you about your bookings (see "SMS Communications" below).
          </li>
          <li>
            <strong>Automatically:</strong> basic technical information such as browser type and
            access times, used for security and troubleshooting.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. How We Use Information">
        <p>We use collected information to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Operate the booking and scheduling system, including assigning instructors and vehicles</li>
          <li>Send booking confirmations, reminders, cancellation notices, and waitlist offers</li>
          <li>Track lesson progress and, where applicable, MPI TSR compliance records</li>
          <li>Provide customer support</li>
          <li>Maintain the security and reliability of the Service</li>
        </ul>
        <p>We do not sell or rent personal information to third parties.</p>
      </LegalSection>

      <LegalSection heading="3. SMS Communications">
        <p>
          If you provide a phone number when booking a lesson, your driving school may text you
          about that booking — confirmations, reminders, reschedule/cancellation notices, waitlist
          offers when a slot opens up, and account-related notices such as a no-show or late-
          cancellation fee. Message frequency varies based on your booking activity.
        </p>
        <p>
          <strong>Message and data rates may apply.</strong> These messages are sent through Twilio,
          our SMS delivery provider, acting only as a processor on our behalf — we do not sell or
          share your phone number with any other third party, and Twilio does not use it for its
          own purposes.
        </p>
        <p>
          You can opt out of text messages at any time by replying <strong>STOP</strong> to any
          message you receive from us. You'll get a one-time confirmation that you've been
          unsubscribed, and future messages to that number will stop; reply START to resume. Reply{" "}
          <strong>HELP</strong> to any message for support. Opting out of SMS does not affect email
          communications or your ability to book lessons.
        </p>
      </LegalSection>

      <LegalSection heading="4. Who Can See Student Information">
        <p>
          A student's booking, lesson, and progress information is visible only to the driving
          school they booked with (its admin staff and the instructor(s) assigned to their
          lessons), and to service providers who help us run the platform (such as our hosting,
          database, email, and SMS providers), under confidentiality obligations. Incident/
          complaint notes are visible to school admin staff only.
        </p>
      </LegalSection>

      <LegalSection heading="5. Data Storage and Security">
        <p>
          Data is stored using reputable third-party infrastructure providers (including Supabase
          and Vercel) with industry-standard security practices. While we take reasonable steps to
          protect information, no system can be guaranteed 100% secure.
        </p>
      </LegalSection>

      <LegalSection heading="6. Data Retention">
        <p>
          We retain personal information for as long as an account or booking record is active, or
          as needed to comply with legal obligations. Some records — such as MPI TSR verification
          records in Manitoba — may be retained longer where a school has a regulatory or
          evidentiary reason to keep proof that required instruction was completed. Driving schools
          may request deletion of their data by contacting us.
        </p>
      </LegalSection>

      <LegalSection heading="7. Your Rights">
        <p>
          Depending on your location, you may have rights to access, correct, or request deletion
          of your personal information, and to withdraw consent to communications (see "SMS
          Communications" above for how to opt out of texts specifically). To exercise these
          rights, contact us at{" "}
          <a
            href="mailto:piyyush130@gmail.com"
            style={{ color: "#1B2B4B", textDecoration: "underline" }}
          >
            piyyush130@gmail.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="8. PIPEDA Compliance (Canada)">
        <p>
          DrivingOps operates in Canada and handles personal information in accordance with the
          Personal Information Protection and Electronic Documents Act (PIPEDA). We collect only
          the information reasonably needed to operate the Service, use it only for the purposes
          described in this policy, and take reasonable steps to protect it. If you believe we have
          not handled your personal information appropriately, you may contact us directly (see
          "Contact" below) or the Office of the Privacy Commissioner of Canada.
        </p>
      </LegalSection>

      <LegalSection heading="9. Children's Information">
        <p>
          Our Service is intended for use by driving schools and their adult staff. Where students
          booking lessons are minors, we rely on the driving school and the minor's parent or
          guardian to ensure appropriate consent for providing booking information and for SMS/
          email communications about the booking.
        </p>
      </LegalSection>

      <LegalSection heading="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. Material changes will require
          existing Account Holders to review and re-accept the updated policy.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact">
        <p>
          Questions about this Privacy Policy can be sent to{" "}
          <a
            href="mailto:piyyush130@gmail.com"
            style={{ color: "#1B2B4B", textDecoration: "underline" }}
          >
            piyyush130@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
