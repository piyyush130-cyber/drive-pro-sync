```tsx
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, loading };
}

export function useRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ["roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as "admin" | "instructor" | "student");
    },
  });
}

// Resolves which school the logged-in user belongs to, so new records
// (a new lesson type, a new instructor, etc.) can be tagged with the
// correct school_id when created.
export function useSchoolId(userId: string | undefined) {
  return useQuery({
    queryKey: ["school-id", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("school_id")
        .eq("user_id", userId!)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.school_id as string | undefined;
    },
  });
}

```
