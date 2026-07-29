import { createServerFn } from "@tanstack/react-start";
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "@/lib/legal";

export const recordPolicyAcceptance = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("policy_acceptances").upsert(
      [
        { user_id: data.userId, policy_type: "terms_of_service", version: CURRENT_TERMS_VERSION },
        { user_id: data.userId, policy_type: "privacy_policy", version: CURRENT_PRIVACY_VERSION },
      ],
      { onConflict: "user_id,policy_type,version" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
