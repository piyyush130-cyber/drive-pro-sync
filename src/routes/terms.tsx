import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updatedDate="August 4, 2026">
      <p>
        Welcome to DrivingOps ("we," "us," "our"). These Terms of Service ("Terms") govern your
        access to and use of the DrivingOps platform (the "Service"), operated for driving schools
        and their staff.
      </p>
      <p>
        By creating an account, you agree to these Terms. If you do not agree, do not use the
        Service.
      </p>

      <LegalSection heading="1. Who This Applies To">
        <p>
          These Terms apply to driving school administrators and instructors who create an account
          ("Account Holders"). Students who book a lesson through a school's public booking page are
          not required to create an account and are covered separately by our{" "}
          <a href="/privacy" style={{ color: "#1B2B4B", textDecoration: "underline" }}>
            Privacy Policy
          </a>
          .
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
