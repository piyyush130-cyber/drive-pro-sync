import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updatedDate="August 4, 2026">
      <p>
        This Privacy Policy explains how DrivingOps ("we," "us," "our") collects, uses, and
        protects personal information.
      </p>

      <LegalSection heading="1. Information We Collect">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>From driving school staff (Account Holders):</strong> name, email address, phone
            number.
          </li>
          <li>
            <strong>From students booking a lesson:</strong> name, phone number, email address,
            pickup address, and any notes provided at booking.
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
          <li>Operate the booking and scheduling system</li>
          <li>Send booking confirmations, reminders, and cancellation notices</li>
          <li>Provide customer support</li>
          <li>Maintain the security and reliability of the Service</li>
        </ul>
        <p>We do not sell personal information to third parties.</p>
      </LegalSection>

      <LegalSection heading="3. Who Can See Student Information">
        <p>
          A student's booking information is visible only to the driving school they booked with,
          and to service providers who help us run the platform (such as our hosting and database
          providers), under confidentiality obligations.
        </p>
      </LegalSection>

      <LegalSection heading="4. Data Storage and Security">
        <p>
          Data is stored using reputable third-party infrastructure providers (including Supabase
          and Vercel) with industry-standard security practices. While we take reasonable steps to
          protect information, no system can be guaranteed 100% secure.
        </p>
      </LegalSection>

      <LegalSection heading="5. Data Retention">
        <p>
          We retain personal information for as long as an account or booking record is active, or
          as needed to comply with legal obligations. Driving schools may request deletion of their
          data by contacting us.
        </p>
      </LegalSection>

      <LegalSection heading="6. Your Rights">
        <p>
          Depending on your location, you may have rights to access, correct, or request deletion of
          your personal information. To exercise these rights, contact us at{" "}
          <a
            href="mailto:piyyush130@gmail.com"
            style={{ color: "#1B2B4B", textDecoration: "underline" }}
          >
            piyyush130@gmail.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="7. Children's Information">
        <p>
          Our Service is intended for use by driving schools and their adult staff. Where students
          booking lessons are minors, we rely on the driving school and the minor's parent or
          guardian to ensure appropriate consent for providing booking information.
        </p>
      </LegalSection>

      <LegalSection heading="8. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. Material changes will require
          existing Account Holders to review and re-accept the updated policy.
        </p>
      </LegalSection>

      <LegalSection heading="9. Contact">
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
