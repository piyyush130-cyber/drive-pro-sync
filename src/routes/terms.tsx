import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updatedDate="August 8, 2026">
      <p>
        Welcome to DrivingOps ("we," "us," "our"). These Terms of Service ("Terms") govern your
        access to and use of the DrivingOps platform (the "Service"), operated for driving schools,
        their staff, and the students who book lessons through them.
      </p>
      <p>
        By creating an account, or by booking a lesson through a school's DrivingOps booking page,
        portal, or a text/email booking link, you agree to these Terms. If you do not agree, do not
        use the Service.
      </p>

      <LegalSection heading="1. Who This Applies To">
        <p>
          Sections 2–9 below apply to driving school administrators and instructors who create an
          account ("Account Holders"). Students who book a lesson are not required to create an
          account, but by booking are bound by Section 3A ("Students Booking a Lesson") and by our{" "}
          <a href="/privacy" style={{ color: "#1B2B4B", textDecoration: "underline" }}>
            Privacy Policy
          </a>
          , which covers what information is collected about you and how it's used.
        </p>
      </LegalSection>

      <LegalSection heading="2. Your Account">
        <p>
          You are responsible for maintaining the confidentiality of your login credentials and for
          all activity under your account. Notify us immediately if you suspect unauthorized access.
        </p>
      </LegalSection>

      <LegalSection heading="3. Your Data">
        <p>
          You (the driving school) own all data you and your customers submit through the Service —
          including student records, bookings, and payment tracking information. We act as a
          processor of that data on your behalf, not an owner of it.
        </p>
      </LegalSection>

      <LegalSection heading="3A. Students Booking a Lesson">
        <p>
          If you book a lesson through a driving school's DrivingOps booking page, portal, or a
          text/email booking link, you're not required to create an account, but the following
          applies to you:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            You're responsible for providing accurate contact information (name, phone, email, and
            pickup address) so your school can reach you about your booking.
          </li>
          <li>
            <strong>By providing a phone number and booking a lesson, you consent to receive text
            messages</strong> from your driving school about that booking — confirmations,
            reminders, cancellation and reschedule notices, and waitlist offers. See our{" "}
            <a href="/privacy" style={{ color: "#1B2B4B", textDecoration: "underline" }}>
              Privacy Policy
            </a>{" "}
            for details on message frequency, applicable rates, and how to opt out (reply STOP at
            any time).
          </li>
          <li>
            You agree not to submit false booking information or use the booking system to
            interfere with a school's normal operation (e.g. spam bookings).
          </li>
          <li>
            Your booking, cancellation, and payment terms (including any late-cancellation or
            no-show fees) are set by the individual driving school, not by us — refer to the
            school's own cancellation policy shown on their booking page.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Free Trial and Subscriptions">
        <p>
          We offer a 14-day free trial. After the trial, continued use requires an active paid
          subscription under one of our published plans. Subscription terms, pricing, and billing
          details are provided separately at checkout.
        </p>
      </LegalSection>

      <LegalSection heading="5. Acceptable Use">
        <p>
          You agree not to use the Service to store or transmit unlawful content, attempt to gain
          unauthorized access to the Service or other accounts, or interfere with the normal
          operation of the Service.
        </p>
      </LegalSection>

      <LegalSection heading="6. Service Availability">
        <p>
          We aim for high reliability but do not guarantee the Service will be uninterrupted or
          error-free. We are not liable for indirect or consequential losses arising from downtime,
          to the maximum extent permitted by law.
        </p>
      </LegalSection>

      <LegalSection heading="7. Limitation of Liability">
        <p>
          To the maximum extent permitted by applicable law, our total liability arising from your
          use of the Service is limited to the amount you paid us in the 12 months preceding the
          claim.
        </p>
      </LegalSection>

      <LegalSection heading="8. Termination">
        <p>
          You may cancel your subscription at any time. We may suspend or terminate accounts that
          violate these Terms or that we reasonably believe pose a security risk to the Service or
          other users.
        </p>
      </LegalSection>

      <LegalSection heading="9. Changes to These Terms">
        <p>
          We may update these Terms from time to time. If changes are material, we will require you
          to review and re-accept them before continuing to use the Service.
        </p>
      </LegalSection>

      <LegalSection heading="10. Governing Law">
        <p>
          These Terms are governed by the laws of the Province of Manitoba, Canada, without regard
          to conflict of law principles.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact">
        <p>
          Questions about these Terms can be sent to{" "}
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
