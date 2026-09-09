import {
  getPublicProfile,
  handlePublicProfileError,
  publicJsonOk,
} from "@/modules/profile";
import {
  PUBLIC_RATE_LIMIT,
  enforceRateLimit,
} from "@/server/rate-limit";

type RouteContext = {
  params: Promise<{ username: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const limited = enforceRateLimit(request, "public:profile", PUBLIC_RATE_LIMIT);
  if (limited) return limited;

  try {
    const { username } = await context.params;
    const profile = await getPublicProfile(username);
    return publicJsonOk({ profile });
  } catch (error) {
    return handlePublicProfileError(error);
  }
}
